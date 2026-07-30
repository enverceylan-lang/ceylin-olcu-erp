import type {
  ErpScope
} from "@/lib/erpScope";

import {
  createSaleReturn,
  type CreateSaleReturnRequest,
  type CreateSaleReturnResult,
  type SaleReturnDocument,
  type SaleReturnRejectReason
} from "@/lib/saleReturnService";

import {
  requestSaleReturnStatusTransition,
  type SaleReturnStatusAudit
} from "@/lib/saleReturnStatusService";

import {
  applyLocalSaleReturnStatus,
  loadPendingSaleReturnFinanceOutbox,
  saveLocalSaleReturn,
  type ApplySaleReturnStatusOutcome,
  type SaleReturnFinanceOutboxRecord,
  type SaveSaleReturnOutcome
} from "@/lib/localSaleReturnsDb";

import {
  executeSaleReturnFinanceOutboxRecord,
  type SaleReturnFinanceOutboxExecutionResult
} from "@/lib/finance/saleReturnFinanceOutboxExecutor";

export type StartSaleReturnWorkflowResult =
  | {
      outcome: "CREATED" | "REPLAY";
      saleReturn: SaleReturnDocument;
    }
  | {
      outcome: "REJECTED";
      reason: SaleReturnRejectReason;
    }
  | {
      outcome: "CONFLICT";
      reason:
        "IDEMPOTENCY_PAYLOAD_CONFLICT";
    };

export type ApproveSaleReturnWorkflowResult =
  | {
      outcome: "SYNCED";
      statusOutcome:
        ApplySaleReturnStatusOutcome["outcome"];
      financeOutcome:
        "CREATED" | "REPLAY";
      saleReturn: SaleReturnDocument;
      audit: SaleReturnStatusAudit;
    }
  | {
      outcome: "STATUS_REJECTED";
      reason: string;
    }
  | {
      outcome: "FINANCE_ERROR";
      reason: string;
      saleReturn: SaleReturnDocument;
      audit: SaleReturnStatusAudit;
    };

export interface ApproveSaleReturnWorkflowInput {
  scope: ErpScope;
  saleReturn: SaleReturnDocument;
  actorUserId: string;
  occurredAt: string;
  reason?: string;
}

export interface SaleReturnWorkflowDependencies {
  createSaleReturn(
    request: CreateSaleReturnRequest
  ): CreateSaleReturnResult;

  saveLocalSaleReturn(
    input: {
      saleReturn: SaleReturnDocument;
    }
  ): Promise<SaveSaleReturnOutcome>;

  requestSaleReturnStatusTransition(
    request: {
      saleReturnId: string;
      fromStatus:
        SaleReturnDocument["status"];
      toStatus:
        SaleReturnDocument["status"];
      actorUserId: string;
      occurredAt: string;
      reason?: string;
    }
  ):
    | {
        outcome: "ACCEPTED";
        audit: SaleReturnStatusAudit;
      }
    | {
        outcome: "REJECTED";
        reason: string;
      };

  applyLocalSaleReturnStatus(
    input: {
      scope: ErpScope;
      saleReturnId: string;
      expectedStatus:
        SaleReturnDocument["status"];
      nextStatus:
        SaleReturnDocument["status"];
      audit: SaleReturnStatusAudit;
    }
  ): Promise<ApplySaleReturnStatusOutcome>;

  loadPendingSaleReturnFinanceOutbox():
    Promise<
      SaleReturnFinanceOutboxRecord[]
    >;

  executeSaleReturnFinanceOutboxRecord(
    record:
      SaleReturnFinanceOutboxRecord
  ): Promise<
    SaleReturnFinanceOutboxExecutionResult
  >;
}

const defaultDependencies:
  SaleReturnWorkflowDependencies = {
    createSaleReturn,
    saveLocalSaleReturn,
    requestSaleReturnStatusTransition,
    applyLocalSaleReturnStatus,
    loadPendingSaleReturnFinanceOutbox,
    executeSaleReturnFinanceOutboxRecord
  };

export async function startSaleReturnWorkflow(
  request: CreateSaleReturnRequest,
  dependencies:
    SaleReturnWorkflowDependencies =
      defaultDependencies
): Promise<
  StartSaleReturnWorkflowResult
> {
  const creation =
    dependencies.createSaleReturn(
      request
    );

  if (
    creation.outcome ===
    "REJECTED"
  ) {
    return {
      outcome: "REJECTED",
      reason: creation.reason
    };
  }

  const persistence =
    await dependencies
      .saveLocalSaleReturn({
        saleReturn:
          creation.saleReturn
      });

  if (
    persistence.outcome ===
    "CONFLICT"
  ) {
    return {
      outcome: "CONFLICT",
      reason:
        persistence.reason
    };
  }

  return {
    outcome:
      persistence.outcome,
    saleReturn:
      persistence.saleReturn
  };
}

export async function approveSaleReturnWorkflow(
  input:
    ApproveSaleReturnWorkflowInput,
  dependencies:
    SaleReturnWorkflowDependencies =
      defaultDependencies
): Promise<
  ApproveSaleReturnWorkflowResult
> {
  const transition =
    dependencies
      .requestSaleReturnStatusTransition({
        saleReturnId:
          input.saleReturn.id,
        fromStatus:
          input.saleReturn.status,
        toStatus:
          "ONAYLANDI",
        actorUserId:
          input.actorUserId,
        occurredAt:
          input.occurredAt,
        reason:
          input.reason
      });

  if (
    transition.outcome ===
    "REJECTED"
  ) {
    return {
      outcome:
        "STATUS_REJECTED",
      reason:
        transition.reason
    };
  }

  const statusResult =
    await dependencies
      .applyLocalSaleReturnStatus({
        scope:
          input.scope,
        saleReturnId:
          input.saleReturn.id,
        expectedStatus:
          input.saleReturn.status,
        nextStatus:
          "ONAYLANDI",
        audit:
          transition.audit
      });

  const outboxRecords =
    await dependencies
      .loadPendingSaleReturnFinanceOutbox();

  const matchingOutbox =
    outboxRecords.find(
      record =>
        record.saleReturnId ===
          input.saleReturn.id &&
        record.tenantId ===
          input.scope.tenantId &&
        record.companyId ===
          input.scope.companyId &&
        record.branchId ===
          input.scope.branchId &&
        record.accountingPeriodId ===
          input.scope.accountingPeriodId
    );

  if (!matchingOutbox) {
    return {
      outcome:
        "FINANCE_ERROR",
      reason:
        "SALE_RETURN_FINANCE_OUTBOX_NOT_FOUND",
      saleReturn:
        statusResult.saleReturn,
      audit:
        transition.audit
    };
  }

  const financeResult =
    await dependencies
      .executeSaleReturnFinanceOutboxRecord(
        matchingOutbox
      );

  if (
    financeResult.outcome ===
    "ERROR"
  ) {
    return {
      outcome:
        "FINANCE_ERROR",
      reason:
        financeResult.reason,
      saleReturn:
        statusResult.saleReturn,
      audit:
        transition.audit
    };
  }

  return {
    outcome: "SYNCED",
    statusOutcome:
      statusResult.outcome,
    financeOutcome:
      financeResult.financeOutcome,
    saleReturn:
      statusResult.saleReturn,
    audit:
      transition.audit
  };
}