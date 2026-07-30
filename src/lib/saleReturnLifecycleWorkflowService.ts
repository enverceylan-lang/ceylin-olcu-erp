import type {
  ErpScope
} from "@/lib/erpScope";

import type {
  SaleReturnDocument,
  SaleReturnStatus
} from "@/lib/saleReturnService";

import {
  requestSaleReturnStatusTransition,
  type SaleReturnStatusAudit,
  type SaleReturnStatusRejectReason
} from "@/lib/saleReturnStatusService";

import {
  applyLocalSaleReturnStatus,
  type ApplySaleReturnStatusOutcome
} from "@/lib/localSaleReturnsDb";

export type SaleReturnLifecycleAction =
  | "REJECT"
  | "COMPLETE";

export interface SaleReturnLifecycleInput {
  scope: ErpScope;
  saleReturn: SaleReturnDocument;
  action: SaleReturnLifecycleAction;
  actorUserId: string;
  occurredAt: string;
  reason?: string;
}

export type SaleReturnLifecycleResult =
  | {
      outcome: "UPDATED" | "REPLAY";
      saleReturn: SaleReturnDocument;
      audit: SaleReturnStatusAudit;
    }
  | {
      outcome: "REJECTED";
      reason:
        SaleReturnStatusRejectReason;
    };

export interface SaleReturnLifecycleDependencies {
  requestSaleReturnStatusTransition(
    request: {
      saleReturnId: string;
      fromStatus: SaleReturnStatus;
      toStatus: SaleReturnStatus;
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
        reason:
          SaleReturnStatusRejectReason;
      };

  applyLocalSaleReturnStatus(
    input: {
      scope: ErpScope;
      saleReturnId: string;
      expectedStatus:
        SaleReturnStatus;
      nextStatus:
        SaleReturnStatus;
      audit:
        SaleReturnStatusAudit;
    }
  ): Promise<
    ApplySaleReturnStatusOutcome
  >;
}

const defaultDependencies:
  SaleReturnLifecycleDependencies = {
    requestSaleReturnStatusTransition,
    applyLocalSaleReturnStatus
  };

function targetStatusFor(
  action: SaleReturnLifecycleAction
): SaleReturnStatus {
  return action === "REJECT"
    ? "REDDEDİLDİ"
    : "TAMAMLANDI";
}

export async function executeSaleReturnLifecycle(
  input:
    SaleReturnLifecycleInput,
  dependencies:
    SaleReturnLifecycleDependencies =
      defaultDependencies
): Promise<
  SaleReturnLifecycleResult
> {
  const nextStatus =
    targetStatusFor(input.action);

  const transition =
    dependencies
      .requestSaleReturnStatusTransition({
        saleReturnId:
          input.saleReturn.id,
        fromStatus:
          input.saleReturn.status,
        toStatus:
          nextStatus,
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
      outcome: "REJECTED",
      reason:
        transition.reason
    };
  }

  const persistence =
    await dependencies
      .applyLocalSaleReturnStatus({
        scope:
          input.scope,
        saleReturnId:
          input.saleReturn.id,
        expectedStatus:
          input.saleReturn.status,
        nextStatus,
        audit:
          transition.audit
      });

  return {
    outcome:
      persistence.outcome,
    saleReturn:
      persistence.saleReturn,
    audit:
      transition.audit
  };
}

export function rejectSaleReturnWorkflow(
  input:
    Omit<
      SaleReturnLifecycleInput,
      "action"
    >,
  dependencies:
    SaleReturnLifecycleDependencies =
      defaultDependencies
): Promise<
  SaleReturnLifecycleResult
> {
  return executeSaleReturnLifecycle(
    {
      ...input,
      action: "REJECT"
    },
    dependencies
  );
}

export function completeSaleReturnWorkflow(
  input:
    Omit<
      SaleReturnLifecycleInput,
      "action"
    >,
  dependencies:
    SaleReturnLifecycleDependencies =
      defaultDependencies
): Promise<
  SaleReturnLifecycleResult
> {
  return executeSaleReturnLifecycle(
    {
      ...input,
      action: "COMPLETE"
    },
    dependencies
  );
}