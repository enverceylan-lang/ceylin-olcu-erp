import type {
  StoreCutCompletion,
  StoreCutCompletionRequest
} from "@/lib/storeCutCompletion";
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

const EPSILON = 0.000001;

export interface CompleteStoreCutToProductionInput {
  request: StoreCutCompletionRequest;
}

export type CompleteStoreCutToProductionResult =
  | {
      outcome: "COMMITTED" | "REPLAY";
      completion: StoreCutCompletion;
      plan: ProductionSourcePlan;
      productionResult:
        SaveProductionSourcePlanResult;
      releasedForCutting: boolean;
    }
  | {
      outcome: "REJECTED";
      stage:
        | "SUPPLY"
        | "SOURCE_PLAN"
        | "PRODUCTION_STORE";
      errors: string[];
    };

function scopeFromRequest(
  request: StoreCutCompletionRequest
) {
  return {
    tenantId: request.tenantId,
    companyId: request.companyId,
    branchId: request.branchId,
    accountingPeriodId:
      request.accountingPeriodId
  };
}

function findPlanByReservation(
  reservationId: string
):
  | {
      plan: ProductionSourcePlan;
      allocationIndex: number;
    }
  | undefined {
  const plans =
    useProductionMaterialStore
      .getState()
      .plans;

  for (const plan of plans) {
    const allocationIndex =
      plan.allocations.findIndex(
        allocation =>
          allocation.sourceType ===
            "STORE_CUT" &&
          allocation.reservationId ===
            reservationId
      );

    if (allocationIndex >= 0) {
      return {
        plan,
        allocationIndex
      };
    }
  }

  return undefined;
}

function buildCompletedPlan(
  plan: ProductionSourcePlan,
  allocationIndex: number,
  usableOutputMeters: number
): ProductionSourcePlan {
  const allocation =
    plan.allocations[
      allocationIndex
    ];

  if (
    allocation.status === "READY" ||
    allocation.status === "CONSUMED" ||
    allocation.status === "CANCELLED"
  ) {
    return plan;
  }

  const nextAllocation =
    usableOutputMeters <= EPSILON
      ? {
          ...allocation,
          status:
            "CANCELLED" as const
        }
      : {
          ...allocation,
          quantity: Math.min(
            allocation.quantity,
            usableOutputMeters
          ),
          status: "READY" as const
        };

  return {
    ...plan,
    version: plan.version + 1,
    allocations:
      plan.allocations.map(
        (current, index) =>
          index === allocationIndex
            ? nextAllocation
            : current
      )
  };
}

export function executeStoreCutCompletionToProduction(
  input: CompleteStoreCutToProductionInput
): CompleteStoreCutToProductionResult {
  const supply =
    useSupplyChainStore.getState();

  const beforeLot =
    supply.lots.find(
      lot =>
        lot.id ===
          input.request.stockLotId &&
        lot.tenantId ===
          input.request.tenantId &&
        lot.companyId ===
          input.request.companyId &&
        lot.branchId ===
          input.request.branchId &&
        lot.accountingPeriodId ===
          input.request
            .accountingPeriodId
    );

  if (!beforeLot) {
    return {
      outcome: "REJECTED",
      stage: "SUPPLY",
      errors: [
        "Kesim yapılacak stok lotu bulunamadı."
      ]
    };
  }

  const supplyResult =
    supply.completeStoreCut(
      input.request
    );

  if (
    supplyResult.outcome ===
    "REJECTED"
  ) {
    return {
      outcome: "REJECTED",
      stage: "SUPPLY",
      errors: [supplyResult.reason]
    };
  }

  const planMatch =
    findPlanByReservation(
      input.request.reservationId
    );

  if (!planMatch) {
    if (
      supplyResult.outcome ===
      "CREATED"
    ) {
      useSupplyChainStore
        .getState()
        .rollbackStoreCutCompletionCreated({
          scope:
            scopeFromRequest(
              input.request
            ),
          completionId:
            supplyResult.value.id,
          reservationId:
            input.request.reservationId,
          lotId:
            input.request.stockLotId,
          previousOnHandMeters:
            beforeLot.onHandMeters,
          reversedByUserId:
            input.request.completedByUserId,
          reversedAt:
            new Date().toISOString(),
          reason:
            "STORE_CUT_COMPLETION_ROLLBACK",
          source:
            "STORE_CUT_COMPLETION_COORDINATOR"
        });
    }

    return {
      outcome: "REJECTED",
      stage: "SOURCE_PLAN",
      errors: [
        "Rezervasyona bağlı üretim kaynak planı bulunamadı."
      ]
    };
  }

  const currentAllocation =
    planMatch.plan.allocations[
      planMatch.allocationIndex
    ];

  if (
    currentAllocation.status !==
      "RESERVED" &&
    currentAllocation.status !==
      "READY" &&
    currentAllocation.status !==
      "CONSUMED" &&
    currentAllocation.status !==
      "CANCELLED"
  ) {
    if (
      supplyResult.outcome ===
      "CREATED"
    ) {
      useSupplyChainStore
        .getState()
        .rollbackStoreCutCompletionCreated({
          scope:
            scopeFromRequest(
              input.request
            ),
          completionId:
            supplyResult.value.id,
          reservationId:
            input.request.reservationId,
          lotId:
            input.request.stockLotId,
          previousOnHandMeters:
            beforeLot.onHandMeters,
          reversedByUserId:
            input.request.completedByUserId,
          reversedAt:
            new Date().toISOString(),
          reason:
            "STORE_CUT_COMPLETION_ROLLBACK",
          source:
            "STORE_CUT_COMPLETION_COORDINATOR"
        });
    }

    return {
      outcome: "REJECTED",
      stage: "SOURCE_PLAN",
      errors: [
        "Mağaza kesimi kaynak tahsisi uygun durumda değil."
      ]
    };
  }

  const nextPlan =
    buildCompletedPlan(
      planMatch.plan,
      planMatch.allocationIndex,
      input.request.usableOutputMeters
    );

  const productionStore =
    useProductionMaterialStore
      .getState();

  const productionResult =
    nextPlan === planMatch.plan
      ? productionStore
          .refreshProductionItem(
            planMatch.plan
              .productionItemId
          )
      : productionStore
          .savePlan(nextPlan);

  if (
    productionResult.outcome ===
    "REJECTED"
  ) {
    if (
      supplyResult.outcome ===
      "CREATED"
    ) {
      useSupplyChainStore
        .getState()
        .rollbackStoreCutCompletionCreated({
          scope:
            scopeFromRequest(
              input.request
            ),
          completionId:
            supplyResult.value.id,
          reservationId:
            input.request.reservationId,
          lotId:
            input.request.stockLotId,
          previousOnHandMeters:
            beforeLot.onHandMeters,
          reversedByUserId:
            input.request.completedByUserId,
          reversedAt:
            new Date().toISOString(),
          reason:
            "STORE_CUT_COMPLETION_ROLLBACK",
          source:
            "STORE_CUT_COMPLETION_COORDINATOR"
        });
    }

    return {
      outcome: "REJECTED",
      stage: "PRODUCTION_STORE",
      errors:
        productionResult.errors
    };
  }

  return {
    outcome:
      supplyResult.outcome ===
        "REPLAY"
        ? "REPLAY"
        : "COMMITTED",
    completion:
      supplyResult.value,
    plan:
      productionResult.plan,
    productionResult,
    releasedForCutting:
      productionResult
        .releasedForCutting
  };
}