import {
  analyzeProductionSourcePlan,
  validateProductionSourcePlan,
  type ProductionSourcePlan,
} from "./productionSourceModel";

export type ProductionSourceReadinessStatus =
  | "WAITING"
  | "PARTIALLY_READY"
  | "READY"
  | "INVALID";

export interface ProductionSourceReadiness {
  status: ProductionSourceReadinessStatus;
  requiredQuantity: number;
  readyQuantity: number;
  pendingQuantity: number;
  missingQuantity: number;
  completionPercent: number;
  errors: string[];
}

export interface ProductionItemStatusSnapshot {
  productionStatus: string;
}

export type ProductionOrderReadinessStatus =
  | "EMPTY"
  | "WAITING"
  | "PARTIALLY_READY"
  | "READY"
  | "PROBLEM"
  | "CANCELLED";

export interface ProductionOrderReadiness {
  status: ProductionOrderReadinessStatus;
  totalCount: number;
  activeCount: number;
  readyCount: number;
  waitingCount: number;
  problemCount: number;
  cancelledCount: number;
  completionPercent: number;
}

const READY_SOURCE_STATUSES = new Set(["READY", "CONSUMED"]);
const PROBLEM_ITEM_STATUSES = new Set(["PROBLEM", "REWORK"]);

function roundQuantity(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function toPercent(ready: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((ready / total) * 100));
}

export function getProductionSourceReadiness(
  plan: ProductionSourcePlan
): ProductionSourceReadiness {
  const errors = validateProductionSourcePlan(plan);
  const coverage = analyzeProductionSourcePlan(plan);
  const readyQuantity = roundQuantity(
    plan.allocations
      .filter((allocation) => READY_SOURCE_STATUSES.has(allocation.status))
      .reduce((total, allocation) => total + allocation.quantity, 0)
  );
  const pendingQuantity = roundQuantity(
    Math.max(0, coverage.allocatedQuantity - readyQuantity)
  );

  let status: ProductionSourceReadinessStatus = "WAITING";
  if (errors.length > 0) {
    status = "INVALID";
  } else if (
    coverage.isFullyAllocated &&
    readyQuantity >= plan.requiredQuantity
  ) {
    status = "READY";
  } else if (readyQuantity > 0) {
    status = "PARTIALLY_READY";
  }

  return {
    status,
    requiredQuantity: plan.requiredQuantity,
    readyQuantity,
    pendingQuantity,
    missingQuantity: coverage.missingQuantity,
    completionPercent: toPercent(readyQuantity, plan.requiredQuantity),
    errors,
  };
}

export function getProductionOrderReadiness(
  items: ProductionItemStatusSnapshot[]
): ProductionOrderReadiness {
  const totalCount = items.length;
  const cancelledCount = items.filter(
    (item) => item.productionStatus === "CANCELLED"
  ).length;
  const problemCount = items.filter((item) =>
    PROBLEM_ITEM_STATUSES.has(item.productionStatus)
  ).length;
  const readyCount = items.filter(
    (item) => item.productionStatus === "READY"
  ).length;
  const activeCount = totalCount - cancelledCount;
  const waitingCount = Math.max(
    0,
    activeCount - readyCount - problemCount
  );
  const completionPercent = toPercent(readyCount, activeCount);

  let status: ProductionOrderReadinessStatus;
  if (totalCount === 0) {
    status = "EMPTY";
  } else if (activeCount === 0) {
    status = "CANCELLED";
  } else if (problemCount > 0) {
    status = "PROBLEM";
  } else if (readyCount === activeCount) {
    status = "READY";
  } else if (readyCount > 0) {
    status = "PARTIALLY_READY";
  } else {
    status = "WAITING";
  }

  return {
    status,
    totalCount,
    activeCount,
    readyCount,
    waitingCount,
    problemCount,
    cancelledCount,
    completionPercent,
  };
}
