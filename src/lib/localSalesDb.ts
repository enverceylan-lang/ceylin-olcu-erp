import Dexie, { type Table } from 'dexie';
import { Sale } from '@/store/salesStore';
import {
  erpScopeMatches,
  validateErpScope,
  type ErpScope
} from '@/lib/erpScope';
import {
  captureSaleDeleteForSync,
  captureSaleSaveForSync
} from '@/lib/salesSyncQueueBridge';
import type {
  SaleStatusTransitionAudit
} from '@/lib/saleStatusTransitionService';


export type SalesFinanceOutboxStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SYNCED'
  | 'ERROR';

export interface SalesFinanceOutboxRecord
  extends ErpScope {
  id: string;
  saleId: string;
  saleSnapshot: Sale;
  currency: string;
  approvedByUserId?: string;
  approvedAt?: string;
  status: SalesFinanceOutboxStatus;
  retryCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
}

export interface SaleStatusTransitionAuditRecord
  extends SaleStatusTransitionAudit,
    ErpScope {
}

export interface SaveSaleWithFinanceOutboxInput {
  sale: Sale;
  scope: ErpScope;
  currency: string;
  statusAudit?:
    SaleStatusTransitionAudit;
}

class LocalSalesDatabase extends Dexie {
  sales!: Table<Sale, string>;

  financeOutbox!: Table<
    SalesFinanceOutboxRecord,
    string
  >;

  saleStatusAudits!: Table<
    SaleStatusTransitionAuditRecord,
    string
  >;

  constructor() {
    super('CeylinLocalSalesDb');
    this.version(1).stores({
      sales: 'id, customerId, saleNo, status'
    });

    this.version(2).stores({
      sales:
        'id, customerId, saleNo, status',

      financeOutbox:
        'id, saleId, status, updatedAt, ' +
        '[tenantId+companyId+branchId+accountingPeriodId]'
    });

    this.version(3).stores({
      sales:
        'id, customerId, saleNo, status',

      financeOutbox:
        'id, saleId, status, updatedAt, ' +
        '[tenantId+companyId+branchId+accountingPeriodId]',

      saleStatusAudits:
        'id, saleId, actorUserId, occurredAt, ' +
        '[tenantId+companyId+branchId+accountingPeriodId], ' +
        '[tenantId+companyId+branchId+accountingPeriodId+saleId]'
    });

    this.version(4).stores({
      sales:
        'id, customerId, saleNo, status, ' +
        '[tenantId+companyId+branchId+accountingPeriodId], ' +
        '[tenantId+companyId+branchId+accountingPeriodId+id]',

      financeOutbox:
        'id, saleId, status, updatedAt, ' +
        '[tenantId+companyId+branchId+accountingPeriodId]',

      saleStatusAudits:
        'id, saleId, actorUserId, occurredAt, ' +
        '[tenantId+companyId+branchId+accountingPeriodId], ' +
        '[tenantId+companyId+branchId+accountingPeriodId+saleId]'
    });
  }
}

export const localSalesDb = new LocalSalesDatabase();

export async function loadLocalSales(
  scope: ErpScope
): Promise<Sale[]> {
  const scopeValidation = validateErpScope(scope);

  if (!scopeValidation.valid) {
    throw new Error(
      `SALE_SCOPE_REQUIRED:${scopeValidation.missingFields.join(',')}`
    );
  }
  try {
    return await localSalesDb.sales
      .where(
        '[tenantId+companyId+branchId+accountingPeriodId]'
      )
      .equals([
        scope.tenantId,
        scope.companyId,
        scope.branchId,
        scope.accountingPeriodId
      ])
      .toArray();
  } catch (err) {
    console.error('[localSalesDb] Failed to load scoped sales:', err);
    throw err;
  }
}

export async function saveLocalSale(sale: Sale): Promise<void> {
  const scopeValidation = validateErpScope(sale);

  if (!scopeValidation.valid) {
    throw new Error(
      `SALE_SCOPE_REQUIRED:${scopeValidation.missingFields.join(',')}`
    );
  }
  try {
    const existing = await localSalesDb.sales.get(sale.id);

    if (existing && !erpScopeMatches(existing, sale)) {
      throw new Error('SALE_SCOPE_CONFLICT');
    }
    const now = new Date().toISOString();
    const storedSale: Sale = existing
      ? { ...existing, ...sale, updatedAt: now }
      : { ...sale, createdAt: now, updatedAt: now };

    if (existing) {
      await localSalesDb.sales.put(storedSale);
    } else {
      await localSalesDb.sales.add(storedSale);
    }

    try {
      await captureSaleSaveForSync(
        storedSale,
        existing
      );
    } catch {
      console.error(
        '[localSalesDb] Sale saved locally, but sync queue capture failed.'
      );
    }
  } catch (err) {
    console.error('[localSalesDb] Failed to save sale:', err);
    throw err;
  }
}

function buildFinanceOutboxId(
  sale: Sale,
  scope: ErpScope
): string {
  return [
    'sale-finance-outbox',
    encodeURIComponent(scope.tenantId),
    encodeURIComponent(scope.companyId),
    encodeURIComponent(scope.branchId),
    encodeURIComponent(
      scope.accountingPeriodId
    ),
    encodeURIComponent(sale.id),
    encodeURIComponent(sale.updatedAt)
  ].join(':');
}

export async function saveLocalSaleWithFinanceOutbox(
  input: SaveSaleWithFinanceOutboxInput
): Promise<SalesFinanceOutboxRecord> {
  const scopeValidation =
    validateErpScope(input.scope);

  if (!scopeValidation.valid) {
    throw new Error(
      `SALES_FINANCE_OUTBOX_SCOPE_REQUIRED:${scopeValidation.missingFields.join(',')}`
    );
  }

  const saleScopeValidation =
    validateErpScope(input.sale);

  if (!saleScopeValidation.valid) {
    throw new Error(
      `SALE_SCOPE_REQUIRED:${saleScopeValidation.missingFields.join(',')}`
    );
  }

  if (!erpScopeMatches(input.sale, input.scope)) {
    throw new Error('SALE_SCOPE_MISMATCH');
  }

  const currency =
    input.currency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(
      'SALES_FINANCE_OUTBOX_CURRENCY_INVALID'
    );
  }

  if (!input.sale.id.trim()) {
    throw new Error(
      'SALES_FINANCE_OUTBOX_SALE_ID_REQUIRED'
    );
  }

  if (!input.sale.customerId.trim()) {
    throw new Error(
      'SALES_FINANCE_OUTBOX_CUSTOMER_ID_REQUIRED'
    );
  }

  const existing =
    await localSalesDb.sales.get(
      input.sale.id
    );

  const now =
    new Date().toISOString();

  const storedSale: Sale =
    existing
      ? {
          ...existing,
          ...input.sale,
          updatedAt:
            input.sale.updatedAt || now
        }
      : {
          ...input.sale,
          createdAt:
            input.sale.createdAt || now,
          updatedAt:
            input.sale.updatedAt || now
        };

  const outboxRecord:
    SalesFinanceOutboxRecord = {
      ...input.scope,

      id:
        buildFinanceOutboxId(
          storedSale,
          input.scope
        ),

      saleId:
        storedSale.id,

      saleSnapshot:
        storedSale,

      currency,

      approvedByUserId:
        input.statusAudit?.actorUserId,

      approvedAt:
        input.statusAudit?.occurredAt,

      status:
        'PENDING',

      retryCount:
        0,

      createdAt:
        now,

      updatedAt:
        now
    };

  let statusAuditRecord:
    SaleStatusTransitionAuditRecord |
    undefined;

  if (input.statusAudit) {
    if (
      input.statusAudit.saleId !==
      storedSale.id
    ) {
      throw new Error(
        'SALE_STATUS_AUDIT_SALE_ID_MISMATCH'
      );
    }

    statusAuditRecord = {
      ...input.scope,
      ...input.statusAudit
    };
  }

  await localSalesDb.transaction(
    'rw',
    localSalesDb.sales,
    localSalesDb.financeOutbox,
    localSalesDb.saleStatusAudits,
    async () => {
      await localSalesDb.sales.put(
        storedSale
      );

      await localSalesDb.financeOutbox.put(
        outboxRecord
      );

      if (statusAuditRecord) {
        await localSalesDb
          .saleStatusAudits
          .put(statusAuditRecord);
      }
    }
  );

  try {
    await captureSaleSaveForSync(
      storedSale,
      existing
    );
  } catch {
    console.error(
      '[localSalesDb] Sale and finance outbox saved, but sync queue capture failed.'
    );
  }

  return outboxRecord;
}

export async function loadSaleStatusAudits(
  scope: ErpScope,
  saleId: string
): Promise<
  SaleStatusTransitionAuditRecord[]
> {
  const scopeValidation =
    validateErpScope(scope);

  if (!scopeValidation.valid) {
    throw new Error(
      `SALE_STATUS_AUDIT_SCOPE_REQUIRED:${scopeValidation.missingFields.join(',')}`
    );
  }

  if (!saleId.trim()) {
    throw new Error(
      'SALE_STATUS_AUDIT_SALE_ID_REQUIRED'
    );
  }

  return localSalesDb
    .saleStatusAudits
    .where(
      '[tenantId+companyId+branchId+accountingPeriodId+saleId]'
    )
    .equals([
      scope.tenantId,
      scope.companyId,
      scope.branchId,
      scope.accountingPeriodId,
      saleId
    ])
    .sortBy('occurredAt');
}

export function isSalesFinanceOutboxRetryCandidate(
  record: SalesFinanceOutboxRecord,
  scope: ErpScope
): boolean {
  return (
    record.tenantId === scope.tenantId &&
    record.companyId === scope.companyId &&
    record.branchId === scope.branchId &&
    record.accountingPeriodId === scope.accountingPeriodId &&
    (
      record.status === 'PENDING' ||
      record.status === 'PROCESSING' ||
      record.status === 'ERROR'
    )
  );
}

export async function loadPendingSalesFinanceOutbox(
  scope: ErpScope
): Promise<SalesFinanceOutboxRecord[]> {
  const scopeValidation =
    validateErpScope(scope);

  if (!scopeValidation.valid) {
    throw new Error(
      `SALES_FINANCE_OUTBOX_SCOPE_REQUIRED:${scopeValidation.missingFields.join(',')}`
    );
  }

  return localSalesDb.financeOutbox
    .where(
      '[tenantId+companyId+branchId+accountingPeriodId]'
    )
    .equals([
      scope.tenantId,
      scope.companyId,
      scope.branchId,
      scope.accountingPeriodId
    ])
    .filter(record =>
      isSalesFinanceOutboxRetryCandidate(
        record,
        scope
      )
    )
    .sortBy('updatedAt');
}

export async function updateSalesFinanceOutbox(
  record: SalesFinanceOutboxRecord
): Promise<void> {
  await localSalesDb.financeOutbox.put({
    ...record,
    updatedAt:
      new Date().toISOString()
  });
}
export async function deleteLocalSale(
  scope: ErpScope,
  saleId: string
): Promise<void> {
  const scopeValidation = validateErpScope(scope);

  if (!scopeValidation.valid) {
    throw new Error(
      `SALE_SCOPE_REQUIRED:${scopeValidation.missingFields.join(',')}`
    );
  }
  try {
    const existing = await localSalesDb.sales.get(saleId);

    if (existing && !erpScopeMatches(existing, scope)) {
      throw new Error('SALE_SCOPE_CONFLICT');
    }

    if (existing) {
      try {
        await captureSaleDeleteForSync(existing);
      } catch {
        console.error(
          '[localSalesDb] Local delete will continue; sync tombstone capture failed.'
        );
      }
    }

    await localSalesDb.sales.delete(saleId);
  } catch (err) {
    console.error('[localSalesDb] Failed to delete sale:', err);
    throw err;
  }
}

export async function getLocalSale(id: string): Promise<Sale | undefined> {
  try {
    return await localSalesDb.sales.get(id);
  } catch (err) {
    console.error('[localSalesDb] Failed to get sale:', err);
    return undefined;
  }
}
