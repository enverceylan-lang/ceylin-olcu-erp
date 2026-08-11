import type { ErpScope } from "./erpScope";
import type {
  StoreCutCompletion
} from "./storeCutCompletion";

const EPSILON = 0.000001;

function roundMeters(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function sameScope(
  left: ErpScope,
  right: ErpScope
): boolean {
  return (
    left.tenantId === right.tenantId &&
    left.companyId === right.companyId &&
    left.branchId === right.branchId &&
    left.accountingPeriodId ===
      right.accountingPeriodId
  );
}

export type InventoryConsumptionClassification =
  | "RESERVED_CONSUMPTION"
  | "WHOLE_LOT_REMAINDER_ABSORBED";

export interface InventoryConsumption
  extends ErpScope {
  id: string;
  idempotencyKey: string;
  cutCompletionId: string;
  cutOrderId: string;
  reservationId: string;
  saleId: string;
  saleItemId: string;
  productionOrderId: string;
  stockItemId: string;
  stockLotId: string;
  plannedQuantityMeters: number;
  physicalConsumptionMeters: number;
  nonReusableRemainderMeters: number;
  unit: "METER";
  classification:
    InventoryConsumptionClassification;
  actorUserId: string;
  occurredAt: string;
}

export type InventoryConsumptionDecision =
  | {
      outcome: "CREATE";
      consumption: InventoryConsumption;
    }
  | {
      outcome: "REPLAY";
      consumption: InventoryConsumption;
    }
  | {
      outcome: "REJECT";
      reason:
        | "IDEMPOTENCY_CONFLICT"
        | "DUPLICATE_CUT_COMPLETION";
    };

function samePayload(
  left: InventoryConsumption,
  right: InventoryConsumption
): boolean {
  return (
    left.id === right.id &&
    left.cutCompletionId ===
      right.cutCompletionId &&
    left.cutOrderId === right.cutOrderId &&
    left.reservationId === right.reservationId &&
    left.saleId === right.saleId &&
    left.saleItemId === right.saleItemId &&
    left.productionOrderId ===
      right.productionOrderId &&
    left.stockItemId === right.stockItemId &&
    left.stockLotId === right.stockLotId &&
    left.plannedQuantityMeters ===
      right.plannedQuantityMeters &&
    left.physicalConsumptionMeters ===
      right.physicalConsumptionMeters &&
    left.nonReusableRemainderMeters ===
      right.nonReusableRemainderMeters &&
    left.classification ===
      right.classification &&
    left.actorUserId === right.actorUserId &&
    left.occurredAt === right.occurredAt &&
    sameScope(left, right)
  );
}

export function buildInventoryConsumption(
  completion: StoreCutCompletion
): InventoryConsumption {
  const physicalConsumptionMeters =
    roundMeters(completion.actualCutMeters);
  const plannedQuantityMeters =
    roundMeters(completion.reservedMeters);
  const nonReusableRemainderMeters =
    completion.consumptionMode ===
      "USE_WHOLE_LOT"
      ? roundMeters(
          Math.max(
            0,
            physicalConsumptionMeters -
              plannedQuantityMeters
          )
        )
      : 0;

  return {
    id: completion.id,
    idempotencyKey:
      completion.idempotencyKey,
    tenantId: completion.tenantId,
    companyId: completion.companyId,
    branchId: completion.branchId,
    accountingPeriodId:
      completion.accountingPeriodId,
    cutCompletionId: completion.id,
    cutOrderId: completion.cutOrderId,
    reservationId: completion.reservationId,
    saleId: completion.saleId,
    saleItemId: completion.saleItemId,
    productionOrderId:
      completion.productionOrderId,
    stockItemId: completion.stockItemId,
    stockLotId: completion.stockLotId,
    plannedQuantityMeters,
    physicalConsumptionMeters,
    nonReusableRemainderMeters,
    unit: "METER",
    classification:
      nonReusableRemainderMeters > EPSILON
        ? "WHOLE_LOT_REMAINDER_ABSORBED"
        : "RESERVED_CONSUMPTION",
    actorUserId:
      completion.completedByUserId,
    occurredAt: completion.completedAt
  };
}

export function decideInventoryConsumption(
  completion: StoreCutCompletion,
  existing: InventoryConsumption[]
): InventoryConsumptionDecision {
  const candidate =
    buildInventoryConsumption(completion);

  const replay = existing.find(
    current =>
      current.idempotencyKey ===
        candidate.idempotencyKey &&
      sameScope(current, candidate)
  );

  if (replay) {
    if (!samePayload(candidate, replay)) {
      return {
        outcome: "REJECT",
        reason: "IDEMPOTENCY_CONFLICT"
      };
    }

    return {
      outcome: "REPLAY",
      consumption: replay
    };
  }

  const duplicateSource = existing.find(
    current =>
      current.cutCompletionId ===
        candidate.cutCompletionId &&
      sameScope(current, candidate)
  );

  if (duplicateSource) {
    return {
      outcome: "REJECT",
      reason: "DUPLICATE_CUT_COMPLETION"
    };
  }

  return {
    outcome: "CREATE",
    consumption: candidate
  };
}
export interface InventoryConsumptionReversal
  extends ErpScope {
  id: string;
  idempotencyKey: string;
  originalConsumptionId: string;
  originalCutCompletionId: string;
  reservationId: string;
  saleId: string;
  saleItemId: string;
  productionOrderId: string;
  stockItemId: string;
  stockLotId: string;
  reversedQuantityMeters: number;
  unit: "METER";
  reason: string;
  source: string;
  actorUserId: string;
  occurredAt: string;
}

export interface InventoryConsumptionReversalRequest {
  original: InventoryConsumption;
  scope: ErpScope;
  actorUserId: string;
  occurredAt: string;
  reason: string;
  source: string;
}

export type InventoryConsumptionReversalDecision =
  | {
      outcome: "CREATE";
      reversal: InventoryConsumptionReversal;
    }
  | {
      outcome: "REPLAY";
      reversal: InventoryConsumptionReversal;
    }
  | {
      outcome: "REJECT";
      reason:
        | "SCOPE_MISMATCH"
        | "IDEMPOTENCY_CONFLICT";
    };

function sameReversalSource(
  left: InventoryConsumptionReversal,
  right: InventoryConsumptionReversal
): boolean {
  return (
    left.originalConsumptionId ===
      right.originalConsumptionId &&
    left.originalCutCompletionId ===
      right.originalCutCompletionId &&
    left.reversedQuantityMeters ===
      right.reversedQuantityMeters &&
    sameScope(left, right)
  );
}

export function decideInventoryConsumptionReversal(
  request: InventoryConsumptionReversalRequest,
  existing: InventoryConsumptionReversal[]
): InventoryConsumptionReversalDecision {
  if (!sameScope(request.original, request.scope)) {
    return {
      outcome: "REJECT",
      reason: "SCOPE_MISMATCH"
    };
  }

  const reversal: InventoryConsumptionReversal = {
    id:
      "inventory-consumption-reversal:" +
      request.original.id,
    idempotencyKey:
      "inventory-consumption-reversal:" +
      request.original.idempotencyKey,
    tenantId: request.original.tenantId,
    companyId: request.original.companyId,
    branchId: request.original.branchId,
    accountingPeriodId:
      request.original.accountingPeriodId,
    originalConsumptionId:
      request.original.id,
    originalCutCompletionId:
      request.original.cutCompletionId,
    reservationId:
      request.original.reservationId,
    saleId: request.original.saleId,
    saleItemId: request.original.saleItemId,
    productionOrderId:
      request.original.productionOrderId,
    stockItemId:
      request.original.stockItemId,
    stockLotId:
      request.original.stockLotId,
    reversedQuantityMeters:
      request.original.physicalConsumptionMeters,
    unit: "METER",
    reason: request.reason,
    source: request.source,
    actorUserId: request.actorUserId,
    occurredAt: request.occurredAt
  };

  const replay = existing.find(
    current =>
      current.idempotencyKey ===
        reversal.idempotencyKey &&
      sameScope(current, reversal)
  );

  if (replay) {
    if (!sameReversalSource(reversal, replay)) {
      return {
        outcome: "REJECT",
        reason: "IDEMPOTENCY_CONFLICT"
      };
    }

    return {
      outcome: "REPLAY",
      reversal: replay
    };
  }

  return {
    outcome: "CREATE",
    reversal
  };
}
