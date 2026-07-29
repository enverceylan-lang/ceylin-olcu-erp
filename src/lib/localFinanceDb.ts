import Dexie, { type Table } from "dexie";

import type {
  FinanceTransaction
} from "@/lib/finance/financeContracts";
import {
  validateErpScope,
  type ErpScope
} from "@/lib/erpScope";

export interface LocalFinanceAuditRecord extends ErpScope {
  id: string;
  transactionId: string;
  idempotencyKey: string;
  action: "POSTED";
  actorUserId: string;
  customerId: string;
  saleId: string;
  occurredAt: string;
}

export type LocalFinanceWriteResult =
  | {
      outcome: "CREATED";
      transaction: FinanceTransaction;
      audit: LocalFinanceAuditRecord;
    }
  | {
      outcome: "REPLAY";
      transaction: FinanceTransaction;
      audit: LocalFinanceAuditRecord;
    };

class LocalFinanceDatabase extends Dexie {
  transactions!: Table<FinanceTransaction, string>;
  audits!: Table<LocalFinanceAuditRecord, string>;

  constructor() {
    super("CeylinLocalFinanceDb");

    this.version(1).stores({
      transactions:
        "id, transactionId, customerId, saleId, status, " +
        "[tenantId+companyId+branchId+accountingPeriodId], " +
        "&[tenantId+companyId+branchId+accountingPeriodId+idempotencyKey]",
      audits:
        "id, transactionId, customerId, saleId, occurredAt, " +
        "[tenantId+companyId+branchId+accountingPeriodId]"
    });
  }
}

export const localFinanceDb = new LocalFinanceDatabase();

function sameScope(
  left: ErpScope,
  right: ErpScope
): boolean {
  return (
    left.tenantId === right.tenantId &&
    left.companyId === right.companyId &&
    left.branchId === right.branchId &&
    left.accountingPeriodId === right.accountingPeriodId
  );
}

function stableTransactionPayload(
  transaction: FinanceTransaction
): string {
  return JSON.stringify({
    ...transaction,
    createdAt: transaction.createdAt,
    postedAt: transaction.postedAt
  });
}

function assertValidTransaction(
  transaction: FinanceTransaction
): void {
  const scopeValidation = validateErpScope(transaction);

  if (!scopeValidation.valid) {
    throw new Error(
      `FINANCE_SCOPE_REQUIRED:${scopeValidation.missingFields.join(",")}`
    );
  }

  if (!transaction.id?.trim()) {
    throw new Error("FINANCE_ID_REQUIRED");
  }

  if (!transaction.transactionId?.trim()) {
    throw new Error("FINANCE_TRANSACTION_ID_REQUIRED");
  }

  if (!transaction.idempotencyKey?.trim()) {
    throw new Error("FINANCE_IDEMPOTENCY_KEY_REQUIRED");
  }

  if (!transaction.customerId?.trim()) {
    throw new Error("FINANCE_CUSTOMER_ID_REQUIRED");
  }

  if (!transaction.saleId?.trim()) {
    throw new Error("FINANCE_SALE_ID_REQUIRED");
  }

  if (
    !Number.isFinite(transaction.netAmount) ||
    transaction.netAmount <= 0
  ) {
    throw new Error("FINANCE_AMOUNT_INVALID");
  }

  if (transaction.status !== "POSTED") {
    throw new Error("FINANCE_STATUS_MUST_BE_POSTED");
  }
}

function buildAudit(
  transaction: FinanceTransaction
): LocalFinanceAuditRecord {
  return {
    tenantId: transaction.tenantId,
    companyId: transaction.companyId,
    branchId: transaction.branchId,
    accountingPeriodId: transaction.accountingPeriodId,
    id: `audit:${transaction.transactionId}`,
    transactionId: transaction.transactionId,
    idempotencyKey: transaction.idempotencyKey,
    action: "POSTED",
    actorUserId: transaction.createdBy,
    customerId: transaction.customerId,
    saleId: transaction.saleId,
    occurredAt:
      transaction.postedAt ||
      transaction.createdAt
  };
}

export async function appendLocalFinanceTransaction(
  transaction: FinanceTransaction
): Promise<LocalFinanceWriteResult> {
  assertValidTransaction(transaction);

  return localFinanceDb.transaction(
    "rw",
    localFinanceDb.transactions,
    localFinanceDb.audits,
    async () => {
      const existing =
        await localFinanceDb.transactions
          .where(
            "[tenantId+companyId+branchId+accountingPeriodId+idempotencyKey]"
          )
          .equals([
            transaction.tenantId,
            transaction.companyId,
            transaction.branchId,
            transaction.accountingPeriodId,
            transaction.idempotencyKey
          ])
          .first();

      if (existing) {
        if (
          !sameScope(existing, transaction) ||
          stableTransactionPayload(existing) !==
            stableTransactionPayload(transaction)
        ) {
          throw new Error("FINANCE_IDEMPOTENCY_CONFLICT");
        }

        const existingAudit =
          await localFinanceDb.audits
            .where("transactionId")
            .equals(existing.transactionId)
            .first();

        if (!existingAudit) {
          throw new Error("FINANCE_AUDIT_MISSING");
        }

        return {
          outcome: "REPLAY",
          transaction: existing,
          audit: existingAudit
        };
      }

      const audit = buildAudit(transaction);

      await localFinanceDb.transactions.add(transaction);
      await localFinanceDb.audits.add(audit);

      return {
        outcome: "CREATED",
        transaction,
        audit
      };
    }
  );
}

export async function listLocalFinanceTransactions(
  scope: ErpScope,
  customerId?: string,
  saleId?: string
): Promise<FinanceTransaction[]> {
  const scopeValidation = validateErpScope(scope);

  if (!scopeValidation.valid) {
    throw new Error(
      `FINANCE_SCOPE_REQUIRED:${scopeValidation.missingFields.join(",")}`
    );
  }

  const scoped =
    await localFinanceDb.transactions
      .where(
        "[tenantId+companyId+branchId+accountingPeriodId]"
      )
      .equals([
        scope.tenantId,
        scope.companyId,
        scope.branchId,
        scope.accountingPeriodId
      ])
      .toArray();

  return scoped.filter(transaction => {
    if (
      customerId &&
      transaction.customerId !== customerId
    ) {
      return false;
    }

    if (
      saleId &&
      transaction.saleId !== saleId
    ) {
      return false;
    }

    return true;
  });
}

export async function listLocalFinanceAudits(
  scope: ErpScope,
  transactionId?: string
): Promise<LocalFinanceAuditRecord[]> {
  const scopeValidation = validateErpScope(scope);

  if (!scopeValidation.valid) {
    throw new Error(
      `FINANCE_SCOPE_REQUIRED:${scopeValidation.missingFields.join(",")}`
    );
  }

  const scoped =
    await localFinanceDb.audits
      .where(
        "[tenantId+companyId+branchId+accountingPeriodId]"
      )
      .equals([
        scope.tenantId,
        scope.companyId,
        scope.branchId,
        scope.accountingPeriodId
      ])
      .toArray();

  return transactionId
    ? scoped.filter(
        audit => audit.transactionId === transactionId
      )
    : scoped;
}
