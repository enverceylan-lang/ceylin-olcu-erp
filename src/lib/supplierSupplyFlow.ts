import {
  getProductionSourceReadiness,
  type ProductionSourceReadinessStatus,
} from "./productionReadiness";
import type {
  ProductionSourcePlan,
  ProductionSourceType,
} from "./productionSourceModel";
import type { ErpScope } from "./erpScope";

export type SupplierOrderStatus =
  | "PREPARING"
  | "ORDERED"
  | "WAITING_SUPPLIER"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CHECKED"
  | "READY_FOR_TAILOR"
  | "READY_FOR_OPERATION";

export type SupplierOrderUnit =
  | "mt"
  | "m2"
  | "adet";

export type SupplierOrderPurpose =
  | "TAILOR_MATERIAL"
  | "MECHANICAL_PRODUCT";

export interface SupplierOrderRequest extends ErpScope {
  id: string;
  idempotencyKey: string;
  allocationId: string;
  supplierId: string;
  purchaseOrderId: string;
  saleId: string;
  saleItemId: string;
  productionOrderId: string;
  stockItemId: string;
  orderedQuantity: number;

  /*
   * Legacy records may omit orderedUnit.
   * Omitted orderedUnit means mt for backward compatibility.
   */
  orderedUnit?: SupplierOrderUnit;
  purpose: SupplierOrderPurpose;

  expectedAt?: string;
  createdByUserId: string;
  createdAt: string;
}

export interface SupplierOrder extends SupplierOrderRequest {
  status: SupplierOrderStatus;
  receivedQuantity: number;
}

export type SupplierOrderDecision =
  | { outcome: "CREATE"; order: SupplierOrder }
  | { outcome: "REPLAY"; order: SupplierOrder }
  | {
      outcome: "REJECT";
      reason:
        | "INVALID_REQUEST"
        | "IDEMPOTENCY_CONFLICT"
        | "DUPLICATE_ALLOCATION";
    };

export interface SupplierReceiptSummary {
  orderedQuantity: number;
  receivedQuantity: number;
  missingQuantity: number;
  excessQuantity: number;
  status: "WAITING" | "PARTIAL" | "READY" | "OVER_RECEIVED";
}

export interface SupplierReceiptRequest extends ErpScope {
  id: string;
  idempotencyKey: string;
  supplierOrderId: string;
  receivedQuantity: number;
  receivedByUserId: string;
  receivedAt: string;
}

export interface SupplierReceipt extends SupplierReceiptRequest {
  cumulativeReceivedQuantity: number;
  orderStatus:
    | "PARTIALLY_RECEIVED"
    | "READY_FOR_TAILOR"
    | "READY_FOR_OPERATION";
}

export type SupplierReceiptDecision =
  | {
      outcome: "CREATE";
      receipt: SupplierReceipt;
      order: SupplierOrder;
    }
  | {
      outcome: "REPLAY";
      receipt: SupplierReceipt;
      order: SupplierOrder;
    }
  | {
      outcome: "REJECT";
      reason:
        | "INVALID_REQUEST"
        | "ORDER_NOT_FOUND"
        | "SCOPE_MISMATCH"
        | "IDEMPOTENCY_CONFLICT"
        | "OVER_RECEIPT"
        | "ORDER_ALREADY_READY";
    };

export interface MixedSupplyLineSummary {
  productionItemId: string;
  sourceTypes: ProductionSourceType[];
  readiness: ProductionSourceReadinessStatus;
  requiredQuantity: number;
  readyQuantity: number;
}

export interface MixedSupplySummary {
  status: "WAITING" | "PARTIALLY_READY" | "READY" | "INVALID";
  isMixedSource: boolean;
  requiredQuantity: number;
  readyQuantity: number;
  lines: MixedSupplyLineSummary[];
}

const EPSILON = 0.000001;

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

function sameSupplierPayload(
  request: SupplierOrderRequest,
  order: SupplierOrder
): boolean {
  return (
    request.id === order.id &&
    request.allocationId === order.allocationId &&
    request.supplierId === order.supplierId &&
    request.purchaseOrderId === order.purchaseOrderId &&
    request.saleItemId === order.saleItemId &&
    request.productionOrderId === order.productionOrderId &&
    request.stockItemId === order.stockItemId &&
    Math.abs(request.orderedQuantity - order.orderedQuantity) <= EPSILON &&
    (request.orderedUnit ?? "mt") ===
      (order.orderedUnit ?? "mt") &&
    request.purpose === order.purpose &&
    sameScope(request, order)
  );
}

export function decideSupplierOrder(
  request: SupplierOrderRequest,
  existing: SupplierOrder[]
): SupplierOrderDecision {
  const requiredText = [
    request.id,
    request.idempotencyKey,
    request.allocationId,
    request.supplierId,
    request.purchaseOrderId,
    request.saleId,
    request.saleItemId,
    request.productionOrderId,
    request.stockItemId,
    request.createdByUserId,
    request.createdAt,
    request.tenantId,
    request.companyId,
    request.branchId,
    request.accountingPeriodId,
  ];
  if (
    requiredText.some((value) => value.trim().length === 0) ||
    (request.purpose !== "TAILOR_MATERIAL" &&
      request.purpose !== "MECHANICAL_PRODUCT") ||
    !Number.isFinite(request.orderedQuantity) ||
    request.orderedQuantity <= 0
  ) {
    return { outcome: "REJECT", reason: "INVALID_REQUEST" };
  }

  const replay = existing.find(
    (order) =>
      order.idempotencyKey === request.idempotencyKey &&
      sameScope(order, request)
  );
  if (replay) {
    return sameSupplierPayload(request, replay)
      ? { outcome: "REPLAY", order: replay }
      : { outcome: "REJECT", reason: "IDEMPOTENCY_CONFLICT" };
  }

  if (
    existing.some(
      (order) =>
        order.allocationId === request.allocationId &&
        order.saleItemId === request.saleItemId &&
        sameScope(order, request)
    )
  ) {
    return { outcome: "REJECT", reason: "DUPLICATE_ALLOCATION" };
  }

  return {
    outcome: "CREATE",
    order: {
      ...request,
      status: "PREPARING",
      receivedQuantity: 0,
    },
  };
}

export function summarizeSupplierReceipt(
  orderedQuantity: number,
  receivedQuantity: number
): SupplierReceiptSummary {
  const missingQuantity = Math.max(0, orderedQuantity - receivedQuantity);
  const excessQuantity = Math.max(0, receivedQuantity - orderedQuantity);
  let status: SupplierReceiptSummary["status"] = "WAITING";
  if (excessQuantity > EPSILON) status = "OVER_RECEIVED";
  else if (missingQuantity <= EPSILON) status = "READY";
  else if (receivedQuantity > EPSILON) status = "PARTIAL";

  return {
    orderedQuantity,
    receivedQuantity,
    missingQuantity,
    excessQuantity,
    status,
  };
}

export function decideSupplierReceipt(
  request: SupplierReceiptRequest,
  existingReceipts: SupplierReceipt[],
  order: SupplierOrder | undefined
): SupplierReceiptDecision {
  const requiredText = [
    request.id,
    request.idempotencyKey,
    request.supplierOrderId,
    request.receivedByUserId,
    request.receivedAt
  ];

  if (
    requiredText.some(
      value => !value.trim()
    ) ||
    !Number.isFinite(
      request.receivedQuantity
    ) ||
    request.receivedQuantity <=
      EPSILON
  ) {
    return {
      outcome: "REJECT",
      reason: "INVALID_REQUEST"
    };
  }

  if (
    order &&
    order.purpose !== "TAILOR_MATERIAL" &&
    order.purpose !== "MECHANICAL_PRODUCT"
  ) {
    return {
      outcome: "REJECT",
      reason: "INVALID_REQUEST"
    };
  }

  const replay =
    existingReceipts.find(
      receipt =>
        receipt.idempotencyKey ===
          request.idempotencyKey &&
        sameScope(receipt, request)
    );

  if (replay) {
    if (
      replay.id !== request.id ||
      replay.supplierOrderId !==
        request.supplierOrderId ||
      Math.abs(
        replay.receivedQuantity -
          request.receivedQuantity
      ) > EPSILON
    ) {
      return {
        outcome: "REJECT",
        reason:
          "IDEMPOTENCY_CONFLICT"
      };
    }

    if (!order) {
      return {
        outcome: "REJECT",
        reason: "ORDER_NOT_FOUND"
      };
    }

    return {
      outcome: "REPLAY",
      receipt: replay,
      order
    };
  }

  if (!order) {
    return {
      outcome: "REJECT",
      reason: "ORDER_NOT_FOUND"
    };
  }

  if (!sameScope(order, request)) {
    return {
      outcome: "REJECT",
      reason: "SCOPE_MISMATCH"
    };
  }

  if (
    order.status ===
      "READY_FOR_TAILOR" ||
    order.status ===
      "READY_FOR_OPERATION" ||
    order.receivedQuantity >=
      order.orderedQuantity -
        EPSILON
  ) {
    return {
      outcome: "REJECT",
      reason:
        "ORDER_ALREADY_READY"
    };
  }

  const cumulative =
    order.receivedQuantity +
    request.receivedQuantity;

  if (
    cumulative >
    order.orderedQuantity + EPSILON
  ) {
    return {
      outcome: "REJECT",
      reason: "OVER_RECEIPT"
    };
  }

  const summary =
    summarizeSupplierReceipt(
      order.orderedQuantity,
      cumulative
    );

  const orderStatus =
    summary.status === "READY"
      ? order.purpose ===
        "MECHANICAL_PRODUCT"
        ? "READY_FOR_OPERATION"
        : "READY_FOR_TAILOR"
      : "PARTIALLY_RECEIVED";

  const nextOrder: SupplierOrder = {
    ...order,
    receivedQuantity:
      cumulative,
    status: orderStatus
  };

  return {
    outcome: "CREATE",
    receipt: {
      ...request,
      cumulativeReceivedQuantity:
        cumulative,
      orderStatus
    },
    order: nextOrder
  };
}

export function buildMixedSupplySummary(
  plans: ProductionSourcePlan[]
): MixedSupplySummary {
  const lines = plans.map((plan) => {
    const readiness = getProductionSourceReadiness(plan);
    return {
      productionItemId: plan.productionItemId,
      sourceTypes: [
        ...new Set(
          plan.allocations
            .filter((allocation) => allocation.status !== "CANCELLED")
            .map((allocation) => allocation.sourceType)
        ),
      ],
      readiness: readiness.status,
      requiredQuantity: readiness.requiredQuantity,
      readyQuantity: readiness.readyQuantity,
    };
  });
  const requiredQuantity = lines.reduce(
    (total, line) => total + line.requiredQuantity,
    0
  );
  const readyQuantity = lines.reduce(
    (total, line) => total + line.readyQuantity,
    0
  );
  const hasInvalid = lines.some((line) => line.readiness === "INVALID");
  let status: MixedSupplySummary["status"] = "WAITING";
  if (hasInvalid) status = "INVALID";
  else if (
    requiredQuantity > 0 &&
    Math.abs(requiredQuantity - readyQuantity) <= EPSILON
  ) {
    status = "READY";
  } else if (readyQuantity > 0) {
    status = "PARTIALLY_READY";
  }

  return {
    status,
    isMixedSource:
      new Set(lines.flatMap((line) => line.sourceTypes)).size > 1,
    requiredQuantity,
    readyQuantity,
    lines,
  };
}
