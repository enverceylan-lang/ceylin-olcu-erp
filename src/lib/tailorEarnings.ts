import type { ErpScope } from "./erpScope";

export type TailorEarningStatus =
  | "ACCRUED"
  | "APPROVED"
  | "PAID"
  | "REVERSED";

export interface TailorEarningAccrualRequest extends ErpScope {
  id: string;
  idempotencyKey: string;
  saleId: string;
  saleItemId: string;
  productionOrderId: string;
  tailorWorkOrderId: string;
  tailorId: string;
  productionStatus: string;
  sewingFee: number;
  approvedExtraWorkFee: number;
  createdByUserId: string;
  createdAt: string;
}

export interface TailorEarning extends TailorEarningAccrualRequest {
  amount: number;
  status: TailorEarningStatus;
}

export interface TailorEarningAudit {
  id: string;
  earningId: string;
  action: "ACCRUED";
  actorUserId: string;
  occurredAt: string;
  previousStatus: null;
  nextStatus: "ACCRUED";
  productionOrderId: string;
  tailorWorkOrderId: string;
}

export type TailorEarningDecision =
  | {
      outcome: "CREATE";
      earning: TailorEarning;
      audit: TailorEarningAudit;
    }
  | {
      outcome: "REPLAY";
      earning: TailorEarning;
    }
  | {
      outcome: "REJECT";
      reason:
        | "INVALID_REQUEST"
        | "PRODUCTION_NOT_READY"
        | "IDEMPOTENCY_CONFLICT"
        | "DUPLICATE_WORK_ORDER";
    };

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

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

function samePayload(
  request: TailorEarningAccrualRequest,
  earning: TailorEarning
): boolean {
  return (
    request.id === earning.id &&
    request.tailorWorkOrderId === earning.tailorWorkOrderId &&
    request.tailorId === earning.tailorId &&
    request.sewingFee === earning.sewingFee &&
    request.approvedExtraWorkFee === earning.approvedExtraWorkFee &&
    sameScope(request, earning)
  );
}

export function decideTailorEarningAccrual(
  request: TailorEarningAccrualRequest,
  existing: TailorEarning[]
): TailorEarningDecision {
  const requiredText = [
    request.id,
    request.idempotencyKey,
    request.saleId,
    request.saleItemId,
    request.productionOrderId,
    request.tailorWorkOrderId,
    request.tailorId,
    request.productionStatus,
    request.createdByUserId,
    request.createdAt,
    request.tenantId,
    request.companyId,
    request.branchId,
    request.accountingPeriodId,
  ];
  if (
    requiredText.some((value) => value.trim().length === 0) ||
    !Number.isFinite(request.sewingFee) ||
    !Number.isFinite(request.approvedExtraWorkFee) ||
    request.sewingFee < 0 ||
    request.approvedExtraWorkFee < 0 ||
    request.sewingFee + request.approvedExtraWorkFee <= 0
  ) {
    return { outcome: "REJECT", reason: "INVALID_REQUEST" };
  }
  if (request.productionStatus !== "READY") {
    return { outcome: "REJECT", reason: "PRODUCTION_NOT_READY" };
  }

  const replay = existing.find(
    (earning) =>
      earning.idempotencyKey === request.idempotencyKey &&
      sameScope(earning, request)
  );
  if (replay) {
    return samePayload(request, replay)
      ? { outcome: "REPLAY", earning: replay }
      : { outcome: "REJECT", reason: "IDEMPOTENCY_CONFLICT" };
  }

  if (
    existing.some(
      (earning) =>
        earning.tailorWorkOrderId === request.tailorWorkOrderId &&
        earning.status !== "REVERSED" &&
        sameScope(earning, request)
    )
  ) {
    return { outcome: "REJECT", reason: "DUPLICATE_WORK_ORDER" };
  }

  const earning: TailorEarning = {
    ...request,
    amount: roundMoney(request.sewingFee + request.approvedExtraWorkFee),
    status: "ACCRUED",
  };
  return {
    outcome: "CREATE",
    earning,
    audit: {
      id: `audit-${request.id}`,
      earningId: request.id,
      action: "ACCRUED",
      actorUserId: request.createdByUserId,
      occurredAt: request.createdAt,
      previousStatus: null,
      nextStatus: "ACCRUED",
      productionOrderId: request.productionOrderId,
      tailorWorkOrderId: request.tailorWorkOrderId,
    },
  };
}

export function calculateTailorPayableBalance(
  earnings: TailorEarning[],
  tailorId: string
): number {
  return roundMoney(
    earnings
      .filter(
        (earning) =>
          earning.tailorId === tailorId &&
          (earning.status === "ACCRUED" || earning.status === "APPROVED")
      )
      .reduce((total, earning) => total + earning.amount, 0)
  );
}
