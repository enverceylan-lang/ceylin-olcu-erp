import type {
  ProductionItem
} from "@/store/useStore";
import {
  getProductionSourceReadiness
} from "@/lib/productionReadiness";
import type {
  ProductionSourcePlan
} from "@/lib/productionSourceModel";

const DO_NOT_REGRESS_STATUSES =
  new Set([
    "READY_FOR_CUTTING",
    "CUT",
    "SEWING",
    "SEWN",
    "IRONING",
    "PACKAGING",
    "READY",
    "PROBLEM",
    "REWORK",
    "CANCELLED"
  ]);

export interface ProductionMaterialGateResult {
  item: ProductionItem;
  sourceStatus:
    | "MISSING"
    | "WAITING"
    | "PARTIALLY_READY"
    | "READY"
    | "INVALID";
  releasedForCutting: boolean;
}

export function applyProductionMaterialReadiness(
  item: ProductionItem,
  plan?: ProductionSourcePlan
): ProductionMaterialGateResult {
  if (
    DO_NOT_REGRESS_STATUSES.has(
      item.productionStatus
    )
  ) {
    return {
      item,
      sourceStatus: plan
        ? getProductionSourceReadiness(
            plan
          ).status
        : "MISSING",
      releasedForCutting:
        item.productionStatus !==
          "CANCELLED" &&
        item.productionStatus !==
          "PROBLEM"
    };
  }

  if (!plan) {
    return {
      item: {
        ...item,
        productionStatus:
          "WAITING_MATERIAL"
      },
      sourceStatus: "MISSING",
      releasedForCutting: false
    };
  }

  const readiness =
    getProductionSourceReadiness(plan);

  if (readiness.status === "READY") {
    return {
      item: {
        ...item,
        productionStatus:
          "READY_FOR_CUTTING"
      },
      sourceStatus: "READY",
      releasedForCutting: true
    };
  }

  if (readiness.status === "INVALID") {
    return {
      item: {
        ...item,
        productionStatus: "PROBLEM"
      },
      sourceStatus: "INVALID",
      releasedForCutting: false
    };
  }

  return {
    item: {
      ...item,
      productionStatus:
        "WAITING_MATERIAL"
    },
    sourceStatus: readiness.status,
    releasedForCutting: false
  };
}