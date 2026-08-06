import {
  getProductionSourceReadiness,
  type ProductionSourceReadiness
} from "@/lib/productionReadiness";
import {
  validateProductionSourcePlan,
  type ProductionQuantityUnit,
  type ProductionSourceAllocation,
  type ProductionSourcePlan,
  type ProductionSourceStatus,
  type ProductionSourceType
} from "@/lib/productionSourceModel";
import type {
  SaleOperationWorkPackage
} from "@/lib/saleOperationWorkPackages";

export interface TailorMaterialAllocationInput {
  id: string;
  sourceType: ProductionSourceType;
  quantity: number;
  status: ProductionSourceStatus;
  lotId?: string;
  reservationId?: string;
  supplierId?: string;
  supplierOrderId?: string;
}

export interface BuildTailorMaterialSourcePlanInput {
  workPackage: SaleOperationWorkPackage;
  saleItemId: string;
  workPackageSaleItemId?: string;
  requiredQuantity: number;
  unit: ProductionQuantityUnit;
  version?: number;
  allocations: TailorMaterialAllocationInput[];
}

export type TailorMaterialSourcePlanDecision =
  | {
      outcome: "READY";
      plan: ProductionSourcePlan;
      readiness: ProductionSourceReadiness;
    }
  | {
      outcome: "WAITING";
      plan: ProductionSourcePlan;
      readiness: ProductionSourceReadiness;
    }
  | {
      outcome: "REJECT";
      reason:
        | "TAILOR_PACKAGE_REQUIRED"
        | "SALE_ITEM_NOT_IN_PACKAGE"
        | "INVALID_REQUIRED_QUANTITY"
        | "INVALID_PLAN";
      errors: string[];
    };

export function getCentralProductionItemId(
  saleId: string,
  saleItemId: string
): string {
  return [
    "central-production",
    saleId,
    saleItemId
  ].join("-");
}

function buildAllocation(
  productionItemId: string,
  unit: ProductionQuantityUnit,
  input: TailorMaterialAllocationInput
): ProductionSourceAllocation {
  return {
    id: input.id,
    productionItemId,
    sourceType: input.sourceType,
    quantity: input.quantity,
    unit,
    status: input.status,
    lotId: input.lotId,
    reservationId: input.reservationId,
    supplierId: input.supplierId,
    supplierOrderId: input.supplierOrderId
  };
}

export function buildTailorMaterialSourcePlan(
  input: BuildTailorMaterialSourcePlanInput
): TailorMaterialSourcePlanDecision {
  if (
    input.workPackage.kind !==
    "TAILOR_MATERIAL"
  ) {
    return {
      outcome: "REJECT",
      reason: "TAILOR_PACKAGE_REQUIRED",
      errors: [
        "Yalnız TAILOR_MATERIAL paketi için üretim kaynak planı oluşturulabilir."
      ]
    };
  }

  if (
    !input.workPackage.itemIds.includes(
      input.workPackageSaleItemId ??
        input.saleItemId
    )
  ) {
    return {
      outcome: "REJECT",
      reason: "SALE_ITEM_NOT_IN_PACKAGE",
      errors: [
        "Satış kalemi TAILOR_MATERIAL paketine ait değil."
      ]
    };
  }

  if (
    !Number.isFinite(
      input.requiredQuantity
    ) ||
    input.requiredQuantity <= 0
  ) {
    return {
      outcome: "REJECT",
      reason: "INVALID_REQUIRED_QUANTITY",
      errors: [
        "Gerekli üretim miktarı sıfırdan büyük olmalıdır."
      ]
    };
  }

  const productionItemId =
    getCentralProductionItemId(
      input.workPackage.saleId,
      input.saleItemId
    );

  const plan: ProductionSourcePlan = {
    id: [
      "production-source-plan",
      productionItemId
    ].join(":"),
    productionItemId,
    requiredQuantity:
      input.requiredQuantity,
    unit: input.unit,
    version:
      input.version ?? 1,
    allocations:
      input.allocations.map(
        allocation =>
          buildAllocation(
            productionItemId,
            input.unit,
            allocation
          )
      )
  };

  const errors =
    validateProductionSourcePlan(plan);

  if (errors.length > 0) {
    return {
      outcome: "REJECT",
      reason: "INVALID_PLAN",
      errors
    };
  }

  const readiness =
    getProductionSourceReadiness(plan);

  return {
    outcome:
      readiness.status === "READY"
        ? "READY"
        : "WAITING",
    plan,
    readiness
  };
}

export function canReleaseTailorWork(
  decision: TailorMaterialSourcePlanDecision
): boolean {
  return (
    decision.outcome === "READY" &&
    decision.readiness.status === "READY"
  );
}