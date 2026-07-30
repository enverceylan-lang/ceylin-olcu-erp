import Dexie, {
  type Table
} from "dexie";
import {
  validateErpScope,
  type ErpScope
} from "@/lib/erpScope";
import type {
  SaleReturnDocument
} from "@/lib/saleReturnService";
import type {
  SaleReturnStatusAudit
} from "@/lib/saleReturnStatusService";

export interface SaleReturnStatusAuditRecord
  extends SaleReturnStatusAudit,
    ErpScope {
  saleId: string;
  customerId: string;
}

export type SaleReturnFinanceOutboxStatus =
  | "PENDING"
  | "PROCESSING"
  | "SYNCED"
  | "ERROR";

export interface SaleReturnFinanceOutboxRecord
  extends ErpScope {
  id: string;
  saleReturnId: string;
  saleId: string;
  customerId: string;
  saleReturnSnapshot:
    SaleReturnDocument;
  status:
    SaleReturnFinanceOutboxStatus;
  retryCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
}

export interface SaveSaleReturnInput {
  saleReturn: SaleReturnDocument;
}

export interface ApplySaleReturnStatusInput {
  scope: ErpScope;
  saleReturnId: string;
  expectedStatus:
    SaleReturnDocument["status"];
  nextStatus:
    SaleReturnDocument["status"];
  audit: SaleReturnStatusAudit;
}

export type SaveSaleReturnOutcome =
  | {
      outcome: "CREATED";
      saleReturn: SaleReturnDocument;
    }
  | {
      outcome: "REPLAY";
      saleReturn: SaleReturnDocument;
    }
  | {
      outcome: "CONFLICT";
      reason:
        "IDEMPOTENCY_PAYLOAD_CONFLICT";
    };

export type ApplySaleReturnStatusOutcome =
  | {
      outcome: "UPDATED";
      saleReturn: SaleReturnDocument;
      audit:
        SaleReturnStatusAuditRecord;
    }
  | {
      outcome: "REPLAY";
      saleReturn: SaleReturnDocument;
      audit:
        SaleReturnStatusAuditRecord;
    };

class LocalSaleReturnsDatabase
  extends Dexie {
  saleReturns!: Table<
    SaleReturnDocument,
    string
  >;

  statusAudits!: Table<
    SaleReturnStatusAuditRecord,
    string
  >;

  financeOutbox!: Table<
    SaleReturnFinanceOutboxRecord,
    string
  >;

  constructor() {
    super(
      "CeylinLocalSaleReturnsDb"
    );

    this.version(1).stores({
      saleReturns:
        "id, saleId, customerId, status, " +
        "idempotencyKey, occurredAt, updatedAt, " +
        "[tenantId+companyId+branchId+accountingPeriodId], " +
        "&[tenantId+companyId+branchId+accountingPeriodId+idempotencyKey], " +
        "[tenantId+companyId+branchId+accountingPeriodId+saleId]",

      statusAudits:
        "id, saleReturnId, saleId, customerId, " +
        "fromStatus, toStatus, actorUserId, occurredAt, " +
        "[tenantId+companyId+branchId+accountingPeriodId], " +
        "[tenantId+companyId+branchId+accountingPeriodId+saleReturnId]"
    });

    this.version(2).stores({
      saleReturns:
        "id, saleId, customerId, status, " +
        "idempotencyKey, occurredAt, updatedAt, " +
        "[tenantId+companyId+branchId+accountingPeriodId], " +
        "&[tenantId+companyId+branchId+accountingPeriodId+idempotencyKey], " +
        "[tenantId+companyId+branchId+accountingPeriodId+saleId]",

      statusAudits:
        "id, saleReturnId, saleId, customerId, " +
        "fromStatus, toStatus, actorUserId, occurredAt, " +
        "[tenantId+companyId+branchId+accountingPeriodId], " +
        "[tenantId+companyId+branchId+accountingPeriodId+saleReturnId]",

      financeOutbox:
        "id, saleReturnId, saleId, customerId, status, updatedAt, " +
        "[tenantId+companyId+branchId+accountingPeriodId], " +
        "[tenantId+companyId+branchId+accountingPeriodId+saleReturnId]"
    });
  }
}

export const localSaleReturnsDb =
  new LocalSaleReturnsDatabase();

function assertValidScope(
  scope: ErpScope
): void {
  const validation =
    validateErpScope(scope);

  if (!validation.valid) {
    throw new Error(
      `SALE_RETURN_SCOPE_REQUIRED:${validation.missingFields.join(",")}`
    );
  }
}

function sameReturnPayload(
  existing: SaleReturnDocument,
  incoming: SaleReturnDocument
): boolean {
  return (
    existing.id === incoming.id &&
    existing.saleId ===
      incoming.saleId &&
    existing.customerId ===
      incoming.customerId &&
    existing.status ===
      incoming.status &&
    existing.actorUserId ===
      incoming.actorUserId &&
    existing.amount ===
      incoming.amount &&
    existing.currency ===
      incoming.currency &&
    existing.reason ===
      incoming.reason &&
    existing.occurredAt ===
      incoming.occurredAt &&
    existing.idempotencyKey ===
      incoming.idempotencyKey &&
    existing.tenantId ===
      incoming.tenantId &&
    existing.companyId ===
      incoming.companyId &&
    existing.branchId ===
      incoming.branchId &&
    existing.accountingPeriodId ===
      incoming.accountingPeriodId
  );
}

export async function saveLocalSaleReturn(
  input: SaveSaleReturnInput
): Promise<SaveSaleReturnOutcome> {
  const saleReturn =
    input.saleReturn;

  assertValidScope(saleReturn);

  if (!saleReturn.id.trim()) {
    throw new Error(
      "SALE_RETURN_ID_REQUIRED"
    );
  }

  if (
    !saleReturn.idempotencyKey.trim()
  ) {
    throw new Error(
      "SALE_RETURN_IDEMPOTENCY_KEY_REQUIRED"
    );
  }

  return localSaleReturnsDb.transaction(
    "rw",
    localSaleReturnsDb.saleReturns,
    async () => {
      const existingByKey =
        await localSaleReturnsDb
          .saleReturns
          .where(
            "[tenantId+companyId+branchId+accountingPeriodId+idempotencyKey]"
          )
          .equals([
            saleReturn.tenantId,
            saleReturn.companyId,
            saleReturn.branchId,
            saleReturn.accountingPeriodId,
            saleReturn.idempotencyKey
          ])
          .first();

      if (existingByKey) {
        if (
          sameReturnPayload(
            existingByKey,
            saleReturn
          )
        ) {
          return {
            outcome: "REPLAY",
            saleReturn:
              existingByKey
          };
        }

        return {
          outcome: "CONFLICT",
          reason:
            "IDEMPOTENCY_PAYLOAD_CONFLICT"
        };
      }

      const existingById =
        await localSaleReturnsDb
          .saleReturns
          .get(saleReturn.id);

      if (existingById) {
        if (
          sameReturnPayload(
            existingById,
            saleReturn
          )
        ) {
          return {
            outcome: "REPLAY",
            saleReturn:
              existingById
          };
        }

        return {
          outcome: "CONFLICT",
          reason:
            "IDEMPOTENCY_PAYLOAD_CONFLICT"
        };
      }

      await localSaleReturnsDb
        .saleReturns
        .add(saleReturn);

      return {
        outcome: "CREATED",
        saleReturn
      };
    }
  );
}

export async function applyLocalSaleReturnStatus(
  input: ApplySaleReturnStatusInput
): Promise<
  ApplySaleReturnStatusOutcome
> {
  assertValidScope(input.scope);

  if (!input.saleReturnId.trim()) {
    throw new Error(
      "SALE_RETURN_ID_REQUIRED"
    );
  }

  if (
    input.audit.saleReturnId !==
    input.saleReturnId
  ) {
    throw new Error(
      "SALE_RETURN_STATUS_AUDIT_ID_MISMATCH"
    );
  }

  if (
    input.audit.fromStatus !==
      input.expectedStatus ||
    input.audit.toStatus !==
      input.nextStatus
  ) {
    throw new Error(
      "SALE_RETURN_STATUS_AUDIT_TRANSITION_MISMATCH"
    );
  }

  return localSaleReturnsDb.transaction(
    "rw",
    localSaleReturnsDb.saleReturns,
    localSaleReturnsDb.statusAudits,
    localSaleReturnsDb.financeOutbox,
    async () => {
      const existingAudit =
        await localSaleReturnsDb
          .statusAudits
          .get(input.audit.id);

      const existingReturn =
        await localSaleReturnsDb
          .saleReturns
          .get(input.saleReturnId);

      if (!existingReturn) {
        throw new Error(
          "SALE_RETURN_NOT_FOUND"
        );
      }

      if (
        existingReturn.tenantId !==
          input.scope.tenantId ||
        existingReturn.companyId !==
          input.scope.companyId ||
        existingReturn.branchId !==
          input.scope.branchId ||
        existingReturn
          .accountingPeriodId !==
          input.scope.accountingPeriodId
      ) {
        throw new Error(
          "SALE_RETURN_SCOPE_MISMATCH"
        );
      }

      if (existingAudit) {
        if (
          existingReturn.status !==
          input.nextStatus
        ) {
          throw new Error(
            "SALE_RETURN_AUDIT_REPLAY_STATE_MISMATCH"
          );
        }

        return {
          outcome: "REPLAY",
          saleReturn:
            existingReturn,
          audit:
            existingAudit
        };
      }

      if (
        existingReturn.status !==
        input.expectedStatus
      ) {
        throw new Error(
          "SALE_RETURN_STATUS_CONFLICT"
        );
      }

      const updatedReturn:
        SaleReturnDocument = {
          ...existingReturn,
          status:
            input.nextStatus,
          updatedAt:
            input.audit.occurredAt
        };

      const auditRecord:
        SaleReturnStatusAuditRecord = {
          ...input.scope,
          ...input.audit,
          saleId:
            existingReturn.saleId,
          customerId:
            existingReturn.customerId
        };

      await localSaleReturnsDb
        .saleReturns
        .put(updatedReturn);

      await localSaleReturnsDb
        .statusAudits
        .add(auditRecord);

      if (
        input.expectedStatus ===
          "BAŞLATILDI" &&
        input.nextStatus ===
          "ONAYLANDI"
      ) {
        const outboxId = [
          "sale-return-finance-outbox",
          encodeURIComponent(
            input.scope.tenantId
          ),
          encodeURIComponent(
            input.scope.companyId
          ),
          encodeURIComponent(
            input.scope.branchId
          ),
          encodeURIComponent(
            input.scope.accountingPeriodId
          ),
          encodeURIComponent(
            updatedReturn.id
          )
        ].join(":");

        const outboxRecord:
          SaleReturnFinanceOutboxRecord = {
          ...input.scope,

          id: outboxId,
          saleReturnId:
            updatedReturn.id,
          saleId:
            updatedReturn.saleId,
          customerId:
            updatedReturn.customerId,

          saleReturnSnapshot:
            updatedReturn,

          status: "PENDING",
          retryCount: 0,

          createdAt:
            input.audit.occurredAt,
          updatedAt:
            input.audit.occurredAt
        };

        await localSaleReturnsDb
          .financeOutbox
          .put(outboxRecord);
      }

      return {
        outcome: "UPDATED",
        saleReturn:
          updatedReturn,
        audit:
          auditRecord
      };
    }
  );
}

export async function loadLocalSaleReturns(
  scope: ErpScope,
  saleId?: string
): Promise<SaleReturnDocument[]> {
  assertValidScope(scope);

  if (saleId?.trim()) {
    return localSaleReturnsDb
      .saleReturns
      .where(
        "[tenantId+companyId+branchId+accountingPeriodId+saleId]"
      )
      .equals([
        scope.tenantId,
        scope.companyId,
        scope.branchId,
        scope.accountingPeriodId,
        saleId
      ])
      .sortBy("occurredAt");
  }

  return localSaleReturnsDb
    .saleReturns
    .where(
      "[tenantId+companyId+branchId+accountingPeriodId]"
    )
    .equals([
      scope.tenantId,
      scope.companyId,
      scope.branchId,
      scope.accountingPeriodId
    ])
    .sortBy("occurredAt");
}

export async function loadPendingSaleReturnFinanceOutbox():
Promise<SaleReturnFinanceOutboxRecord[]> {
  return localSaleReturnsDb
    .financeOutbox
    .where("status")
    .anyOf([
      "PENDING",
      "PROCESSING",
      "ERROR"
    ])
    .sortBy("updatedAt");
}

export async function updateSaleReturnFinanceOutbox(
  record: SaleReturnFinanceOutboxRecord
): Promise<void> {
  assertValidScope(record);

  const existing =
    await localSaleReturnsDb
      .financeOutbox
      .get(record.id);

  if (!existing) {
    throw new Error(
      "SALE_RETURN_FINANCE_OUTBOX_NOT_FOUND"
    );
  }

  if (
    existing.tenantId !==
      record.tenantId ||
    existing.companyId !==
      record.companyId ||
    existing.branchId !==
      record.branchId ||
    existing.accountingPeriodId !==
      record.accountingPeriodId
  ) {
    throw new Error(
      "SALE_RETURN_FINANCE_OUTBOX_SCOPE_MISMATCH"
    );
  }

  await localSaleReturnsDb
    .financeOutbox
    .put({
      ...record,
      updatedAt:
        record.updatedAt
    });
}

export async function loadLocalSaleReturnStatusAudits(
  scope: ErpScope,
  saleReturnId: string
): Promise<
  SaleReturnStatusAuditRecord[]
> {
  assertValidScope(scope);

  if (!saleReturnId.trim()) {
    throw new Error(
      "SALE_RETURN_ID_REQUIRED"
    );
  }

  return localSaleReturnsDb
    .statusAudits
    .where(
      "[tenantId+companyId+branchId+accountingPeriodId+saleReturnId]"
    )
    .equals([
      scope.tenantId,
      scope.companyId,
      scope.branchId,
      scope.accountingPeriodId,
      saleReturnId
    ])
    .sortBy("occurredAt");
}