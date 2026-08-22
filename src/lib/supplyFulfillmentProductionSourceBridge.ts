import type {
  SaleOperationWorkPackage
} from "@/lib/saleOperationWorkPackages";
import {
  buildTailorMaterialSourcePlan
} from "@/lib/tailorMaterialSourcePlanner";
import type {
  SaleSupplyFulfillmentResult,
  FulfillmentMaterialAllocation
} from "@/lib/saleSupplyFulfillmentOrchestrator";
import type {
  ProductionSourcePlan
} from "@/lib/productionSourceModel";

export type FulfillmentProductionSourceBridgeResult =
  | {
      outcome: "READY";
      plans: ProductionSourcePlan[];
    }
  | {
      outcome: "REJECTED";
      reason:
        | "TAILOR_PACKAGE_REQUIRED"
        | "FULFILLMENT_REJECTED"
        | "NO_ALLOCATIONS"
        | "PARENT_ITEM_CONFLICT"
        | "INVALID_PLAN";
      errors: string[];
    };

interface GroupedAllocation {
  saleItemId: string;
  parentSaleItemId: string;
  requiredQuantity:
    number | null;
  allocations:
    FulfillmentMaterialAllocation[];
}

export interface FulfillmentProductionRequirement {
  saleItemId: string;
  parentSaleItemId: string;
  requiredQuantity: number;
}

export function buildProductionSourcePlansFromFulfillment(
  workPackage: SaleOperationWorkPackage,
  fulfillment: SaleSupplyFulfillmentResult,
  version = 1,
  requirements:
    FulfillmentProductionRequirement[] = []
): FulfillmentProductionSourceBridgeResult {
  if (
    workPackage.kind !==
    "TAILOR_MATERIAL"
  ) {
    return {
      outcome: "REJECTED",
      reason:
        "TAILOR_PACKAGE_REQUIRED",
      errors: [
        "Yalnız TAILOR_MATERIAL paketi ProductionSourcePlan köprüsüne alınabilir."
      ]
    };
  }

  if (
    fulfillment.outcome ===
    "REJECTED"
  ) {
    return {
      outcome: "REJECTED",
      reason:
        "FULFILLMENT_REJECTED",
      errors:
        fulfillment.errors
    };
  }

  if (
    fulfillment.materialAllocations
      .length === 0 &&
    requirements.length === 0
  ) {
    return {
      outcome: "REJECTED",
      reason: "NO_ALLOCATIONS",
      errors: [
        "Üretim kaynak planı için malzeme tahsisi bulunamadı."
      ]
    };
  }

  const grouped =
    new Map<
      string,
      GroupedAllocation
    >();

  for (
    const requirement of
    requirements
  ) {
    if (
      !Number.isFinite(
        requirement.requiredQuantity
      ) ||
      requirement.requiredQuantity <= 0
    ) {
      return {
        outcome: "REJECTED",
        reason: "INVALID_PLAN",
        errors: [
          `${requirement.saleItemId}: gerekli üretim miktarı geçersiz.`
        ]
      };
    }

    const existing =
      grouped.get(
        requirement.saleItemId
      );

    if (existing) {
      if (
        existing.parentSaleItemId !==
        requirement.parentSaleItemId
      ) {
        return {
          outcome: "REJECTED",
          reason:
            "PARENT_ITEM_CONFLICT",
          errors: [
            `${requirement.saleItemId}: aynı üretim kalemi birden fazla satış üst kalemine bağlanamaz.`
          ]
        };
      }

      existing.requiredQuantity =
        (existing.requiredQuantity ?? 0) +
        requirement.requiredQuantity;

      continue;
    }

    grouped.set(
      requirement.saleItemId,
      {
        saleItemId:
          requirement.saleItemId,
        parentSaleItemId:
          requirement
            .parentSaleItemId,
        requiredQuantity:
          requirement
            .requiredQuantity,
        allocations: []
      }
    );
  }

  for (
    const allocation of
    fulfillment.materialAllocations
  ) {
    const existing =
      grouped.get(
        allocation.saleItemId
      );

    if (existing) {
      if (
        existing.parentSaleItemId !==
        allocation.parentSaleItemId
      ) {
        return {
          outcome: "REJECTED",
          reason:
            "PARENT_ITEM_CONFLICT",
          errors: [
            `${allocation.saleItemId}: aynı üretim kalemi birden fazla satış üst kalemine bağlanamaz.`
          ]
        };
      }

      existing.allocations.push(
        allocation
      );

      continue;
    }

    grouped.set(
      allocation.saleItemId,
      {
        saleItemId:
          allocation.saleItemId,
        parentSaleItemId:
          allocation.parentSaleItemId,
        requiredQuantity: null,
        allocations: [
          allocation
        ]
      }
    );
  }

  const plans:
    ProductionSourcePlan[] = [];

  for (
    const group of
    grouped.values()
  ) {
    const allocatedQuantity =
      group.allocations.reduce(
        (total, allocation) =>
          total +
          allocation.quantity,
        0
      );

    const requiredQuantity =
      group.requiredQuantity ??
      allocatedQuantity;

    const decision =
      buildTailorMaterialSourcePlan({
        workPackage,
        saleItemId:
          group.saleItemId,
        workPackageSaleItemId:
          group.parentSaleItemId,
        requiredQuantity,
        unit: "mt",
        version,
        allocations:
          group.allocations.map(
            allocation => ({
              id: allocation.id,
              sourceType:
                allocation.sourceType,
              quantity:
                allocation.quantity,
              status:
                allocation.status,
              lotId:
                allocation.lotId,
              reservationId:
                allocation.reservationId,
              supplierId:
                allocation.supplierId,
              supplierOrderId:
                allocation.supplierOrderId
            })
          )
      });

    if (
      decision.outcome ===
      "REJECT"
    ) {
      return {
        outcome: "REJECTED",
        reason: "INVALID_PLAN",
        errors:
          decision.errors
      };
    }

    plans.push(
      decision.plan
    );
  }

  return {
    outcome: "READY",
    plans
  };
}
