import type { MixedSupplySummary } from "./supplierSupplyFlow";
import type { ErpScope } from "./erpScope";

export interface TailorAssignmentRequest extends ErpScope {
  id: string;
  idempotencyKey: string;
  saleId: string;
  productionOrderId: string;
  assignedTailorId: string;
  assignedByUserId: string;
  assignedByRole: string;
  assignedAt: string;
  partialStartApprovedByUserId?: string;
}

export interface TailorWorkOrder extends TailorAssignmentRequest {
  status: "ASSIGNED";
  partialStartApproved: boolean;
}

export type TailorAssignmentDecision =
  | { outcome: "CREATE"; workOrder: TailorWorkOrder }
  | { outcome: "REPLAY"; workOrder: TailorWorkOrder }
  | {
      outcome: "REJECT";
      reason:
        | "INVALID_REQUEST"
        | "ROLE_FORBIDDEN"
        | "IDEMPOTENCY_CONFLICT"
        | "DUPLICATE_WORK_ORDER"
        | "SUPPLY_INVALID"
        | "SUPPLY_NOT_READY"
        | "PARTIAL_APPROVAL_REQUIRED";
    };

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

function canAssignTailor(role: string): boolean {
  const normalized = role.trim().toLowerCase();
  return normalized === "admin" || normalized === "office";
}

function samePayload(
  request: TailorAssignmentRequest,
  workOrder: TailorWorkOrder
): boolean {
  return (
    request.id === workOrder.id &&
    request.productionOrderId === workOrder.productionOrderId &&
    request.assignedTailorId === workOrder.assignedTailorId &&
    request.partialStartApprovedByUserId ===
      workOrder.partialStartApprovedByUserId &&
    sameScope(request, workOrder)
  );
}

export function decideTailorAssignment(
  request: TailorAssignmentRequest,
  supply: MixedSupplySummary,
  existing: TailorWorkOrder[]
): TailorAssignmentDecision {
  const requiredText = [
    request.id,
    request.idempotencyKey,
    request.saleId,
    request.productionOrderId,
    request.assignedTailorId,
    request.assignedByUserId,
    request.assignedByRole,
    request.assignedAt,
    request.tenantId,
    request.companyId,
    request.branchId,
    request.accountingPeriodId,
  ];
  if (requiredText.some((value) => value.trim().length === 0)) {
    return { outcome: "REJECT", reason: "INVALID_REQUEST" };
  }
  if (!canAssignTailor(request.assignedByRole)) {
    return { outcome: "REJECT", reason: "ROLE_FORBIDDEN" };
  }

  const replay = existing.find(
    (workOrder) =>
      workOrder.idempotencyKey === request.idempotencyKey &&
      sameScope(workOrder, request)
  );
  if (replay) {
    return samePayload(request, replay)
      ? { outcome: "REPLAY", workOrder: replay }
      : { outcome: "REJECT", reason: "IDEMPOTENCY_CONFLICT" };
  }

  if (
    existing.some(
      (workOrder) =>
        workOrder.productionOrderId === request.productionOrderId &&
        sameScope(workOrder, request)
    )
  ) {
    return { outcome: "REJECT", reason: "DUPLICATE_WORK_ORDER" };
  }
  if (supply.status === "INVALID") {
    return { outcome: "REJECT", reason: "SUPPLY_INVALID" };
  }
  if (supply.status === "WAITING") {
    return { outcome: "REJECT", reason: "SUPPLY_NOT_READY" };
  }
  if (
    supply.status === "PARTIALLY_READY" &&
    !request.partialStartApprovedByUserId?.trim()
  ) {
    return {
      outcome: "REJECT",
      reason: "PARTIAL_APPROVAL_REQUIRED",
    };
  }

  return {
    outcome: "CREATE",
    workOrder: {
      ...request,
      status: "ASSIGNED",
      partialStartApproved: supply.status === "PARTIALLY_READY",
    },
  };
}
