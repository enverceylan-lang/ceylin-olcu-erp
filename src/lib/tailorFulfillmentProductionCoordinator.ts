import type {
  SaleOperationWorkPackage
} from "@/lib/saleOperationWorkPackages";
import {
  executeSaleSupplyFulfillment,
  type SaleSupplyFulfillmentInput,
  type SaleSupplyFulfillmentResult
} from "@/lib/saleSupplyFulfillmentOrchestrator";
import {
  buildProductionSourcePlansFromFulfillment
} from "@/lib/supplyFulfillmentProductionSourceBridge";
import type {
  ProductionSourcePlan
} from "@/lib/productionSourceModel";
import {
  useProductionMaterialStore,
  type SaveProductionSourcePlanResult
} from "@/store/useProductionMaterialStore";
import {
  useSupplyChainStore
} from "@/store/useSupplyChainStore";

export interface TailorFulfillmentProductionInput {
  workPackage: SaleOperationWorkPackage;
  fulfillmentInput:
    SaleSupplyFulfillmentInput;
  version?: number;
}

export type TailorFulfillmentProductionResult =
  | {
      outcome: "COMMITTED";
      fulfillment:
        SaleSupplyFulfillmentResult;
      plans: ProductionSourcePlan[];
      productionResults:
        SaveProductionSourcePlanResult[];
    }
  | {
      outcome: "REJECTED";
      stage:
        | "INPUT"
        | "FULFILLMENT"
        | "SOURCE_BRIDGE"
        | "PRODUCTION_STORE";
      errors: string[];
    };

function rollbackCreatedSupply(
  input: SaleSupplyFulfillmentInput,
  fulfillment:
    SaleSupplyFulfillmentResult
): void {
  useSupplyChainStore
    .getState()
    .rollbackFulfillmentCreated({
      scope: {
        tenantId: input.tenantId,
        companyId: input.companyId,
        branchId: input.branchId,
        accountingPeriodId:
          input.accountingPeriodId
      },
      reservationIds:
        fulfillment
          .createdReservationIds ?? [],
      supplierOrderIds:
        fulfillment
          .createdSupplierOrderIds ?? []
    });
}

export function executeTailorFulfillmentToProduction(
  input: TailorFulfillmentProductionInput
): TailorFulfillmentProductionResult {
  if (
    input.workPackage.kind !==
    "TAILOR_MATERIAL"
  ) {
    return {
      outcome: "REJECTED",
      stage: "INPUT",
      errors: [
        "Yalnız TAILOR_MATERIAL paketi fulfillment-production coordinator üzerinden yürütülebilir."
      ]
    };
  }

  if (
    input.workPackage.saleId !==
      input.fulfillmentInput.saleId ||
    (
      input.fulfillmentInput
        .optimization.outcome ===
        "READY" &&
      input.fulfillmentInput
        .optimization.saleId !==
        input.fulfillmentInput.saleId
    )
  ) {
    return {
      outcome: "REJECTED",
      stage: "INPUT",
      errors: [
        "Satış kimliği work package, fulfillment ve optimization arasında aynı olmalıdır."
      ]
    };
  }

  const fulfillment =
    executeSaleSupplyFulfillment(
      input.fulfillmentInput
    );

  if (
    fulfillment.outcome ===
    "REJECTED"
  ) {
    return {
      outcome: "REJECTED",
      stage: "FULFILLMENT",
      errors: fulfillment.errors
    };
  }

  const sourceBridge =
    buildProductionSourcePlansFromFulfillment(
      input.workPackage,
      fulfillment,
      input.version ?? 1
    );

  if (
    sourceBridge.outcome ===
    "REJECTED"
  ) {
    rollbackCreatedSupply(
      input.fulfillmentInput,
      fulfillment
    );

    return {
      outcome: "REJECTED",
      stage: "SOURCE_BRIDGE",
      errors: sourceBridge.errors
    };
  }

  const productionSave =
    useProductionMaterialStore
      .getState()
      .savePlansAtomically(
        sourceBridge.plans
      );

  if (
    productionSave.outcome ===
    "REJECTED"
  ) {
    rollbackCreatedSupply(
      input.fulfillmentInput,
      fulfillment
    );

    return {
      outcome: "REJECTED",
      stage: "PRODUCTION_STORE",
      errors: productionSave.errors
    };
  }

  return {
    outcome: "COMMITTED",
    fulfillment,
    plans: sourceBridge.plans,
    productionResults:
      productionSave.results
  };
}