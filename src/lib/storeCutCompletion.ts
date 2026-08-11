import type { ErpScope } from "./erpScope";

export type StoreCutConsumptionMode =
  | "WITHIN_RESERVATION"
  | "USE_WHOLE_LOT";

export interface StoreCutCompletionRequest extends ErpScope {
  id: string;
  idempotencyKey: string;
  cutOrderId: string;
  reservationId: string;
  saleId: string;
  saleItemId: string;
  productionOrderId: string;
  stockItemId: string;
  stockLotId: string;
  consumptionMode?: StoreCutConsumptionMode;
  reservedMeters: number;
  plannedCutMeters: number;
  actualCutMeters: number;
  usableOutputMeters: number;
  completedByUserId: string;
  completedAt: string;
}

export interface StoreCutCompletion extends StoreCutCompletionRequest {
  wasteMeters: number;
  lotRemainingMeters: number;
  status: "COMPLETED";
}

export interface StoreCutCompletionLot extends ErpScope {
  id: string;
  stockItemId: string;
  onHandMeters: number;
}

export type StoreCutCompletionDecision =
  | { outcome: "CREATE"; completion: StoreCutCompletion }
  | { outcome: "REPLAY"; completion: StoreCutCompletion }
  | {
      outcome: "REJECT";
      reason:
        | "INVALID_REQUEST"
        | "IDEMPOTENCY_CONFLICT"
        | "DUPLICATE_CUT_ORDER"
        | "SCOPE_MISMATCH"
        | "LOT_MISMATCH"
        | "ACTUAL_EXCEEDS_RESERVATION"
        | "WHOLE_LOT_REQUIRES_FULL_LOT"
        | "WHOLE_LOT_BELOW_RESERVATION"
        | "WHOLE_LOT_OUTPUT_MISMATCH"
        | "OUTPUT_EXCEEDS_ACTUAL_CUT"
        | "INSUFFICIENT_PHYSICAL_STOCK";
      message: string;
    };

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
    left.accountingPeriodId === right.accountingPeriodId
  );
}

function samePayload(
  request: StoreCutCompletionRequest,
  completion: StoreCutCompletion
): boolean {
  return (
    request.id === completion.id &&
    request.cutOrderId === completion.cutOrderId &&
    request.reservationId === completion.reservationId &&
    request.stockLotId === completion.stockLotId &&
    (request.consumptionMode ?? "WITHIN_RESERVATION") ===
      (completion.consumptionMode ?? "WITHIN_RESERVATION") &&
    request.actualCutMeters === completion.actualCutMeters &&
    request.usableOutputMeters === completion.usableOutputMeters &&
    sameScope(request, completion)
  );
}

export function decideStoreCutCompletion(
  request: StoreCutCompletionRequest,
  existing: StoreCutCompletion[],
  lot: StoreCutCompletionLot
): StoreCutCompletionDecision {
  const numericValues = [
    request.reservedMeters,
    request.plannedCutMeters,
    request.actualCutMeters,
    request.usableOutputMeters,
  ];
  const textValues = [
    request.id,
    request.idempotencyKey,
    request.cutOrderId,
    request.reservationId,
    request.saleId,
    request.saleItemId,
    request.productionOrderId,
    request.stockItemId,
    request.stockLotId,
    request.completedByUserId,
    request.completedAt,
  ];
  if (
    textValues.some((value) => value.trim().length === 0) ||
    numericValues.some((value) => !Number.isFinite(value) || value < 0) ||
    request.actualCutMeters <= 0
  ) {
    return {
      outcome: "REJECT",
      reason: "INVALID_REQUEST",
      message: "Gerçek kesim kaydı eksik veya geçersiz.",
    };
  }

  const replay = existing.find(
    (completion) =>
      completion.idempotencyKey === request.idempotencyKey &&
      sameScope(completion, request)
  );
  if (replay) {
    if (!samePayload(request, replay)) {
      return {
        outcome: "REJECT",
        reason: "IDEMPOTENCY_CONFLICT",
        message: "Aynı anahtar farklı kesim sonucu için kullanılamaz.",
      };
    }
    return { outcome: "REPLAY", completion: replay };
  }

  if (
    existing.some(
      (completion) =>
        completion.cutOrderId === request.cutOrderId &&
        sameScope(completion, request)
    )
  ) {
    return {
      outcome: "REJECT",
      reason: "DUPLICATE_CUT_ORDER",
      message: "Aynı kesim iş emri ikinci kez tamamlanamaz.",
    };
  }
  if (!sameScope(request, lot)) {
    return {
      outcome: "REJECT",
      reason: "SCOPE_MISMATCH",
      message: "Kesim ve lot şirket kapsamı eşleşmiyor.",
    };
  }
  if (lot.id !== request.stockLotId || lot.stockItemId !== request.stockItemId) {
    return {
      outcome: "REJECT",
      reason: "LOT_MISMATCH",
      message: "Kesim kaydı ile top/lot eşleşmiyor.",
    };
  }
  const consumptionMode =
    request.consumptionMode ??
    "WITHIN_RESERVATION";

  if (
    request.actualCutMeters >
      request.reservedMeters + EPSILON &&
    consumptionMode !== "USE_WHOLE_LOT"
  ) {
    return {
      outcome: "REJECT",
      reason: "ACTUAL_EXCEEDS_RESERVATION",
      message: "Gerçek kesim rezerve edilmiş miktarı yalnız açık USE_WHOLE_LOT kararıyla aşabilir.",
    };
  }

  if (consumptionMode === "USE_WHOLE_LOT") {
    if (
      request.actualCutMeters + EPSILON <
      request.reservedMeters
    ) {
      return {
        outcome: "REJECT",
        reason: "WHOLE_LOT_BELOW_RESERVATION",
        message: "USE_WHOLE_LOT tüketimi rezerve miktarın altında olamaz.",
      };
    }

    if (
      Math.abs(
        request.actualCutMeters -
          lot.onHandMeters
      ) > EPSILON
    ) {
      return {
        outcome: "REJECT",
        reason: "WHOLE_LOT_REQUIRES_FULL_LOT",
        message: "USE_WHOLE_LOT yalnız lotun fiziksel tamamı tüketildiğinde kullanılabilir.",
      };
    }

    if (
      Math.abs(
        request.usableOutputMeters -
          request.actualCutMeters
      ) > EPSILON
    ) {
      return {
        outcome: "REJECT",
        reason: "WHOLE_LOT_OUTPUT_MISMATCH",
        message: "USE_WHOLE_LOT durumunda küçük kalan fire yazılmaz; üretime çıkan metre fiziksel tüketimle eşleşmelidir.",
      };
    }
  }

  if (request.usableOutputMeters > request.actualCutMeters + EPSILON) {
    return {
      outcome: "REJECT",
      reason: "OUTPUT_EXCEEDS_ACTUAL_CUT",
      message: "Kullanılabilir çıktı gerçek kesimden fazla olamaz.",
    };
  }
  if (request.actualCutMeters > lot.onHandMeters + EPSILON) {
    return {
      outcome: "REJECT",
      reason: "INSUFFICIENT_PHYSICAL_STOCK",
      message: "Gerçek kesim fiziksel lot miktarını aşıyor.",
    };
  }

  return {
    outcome: "CREATE",
    completion: {
      ...request,
      wasteMeters: roundMeters(
        request.actualCutMeters - request.usableOutputMeters
      ),
      lotRemainingMeters: roundMeters(
        lot.onHandMeters - request.actualCutMeters
      ),
      status: "COMPLETED",
    },
  };
}
