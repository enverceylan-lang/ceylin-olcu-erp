import type { ErpScope } from "./erpScope";

export type StockReservationStatus = "ACTIVE" | "RELEASED" | "CONSUMED";

export type StockReservationScope = ErpScope;

export interface StockReservationRequest extends StockReservationScope {
  id: string;
  idempotencyKey: string;
  allocationId: string;
  saleId: string;
  saleItemId: string;
  productionOrderId: string;
  stockItemId: string;
  stockLotId: string;
  quantityMeters: number;
  createdByUserId: string;
  createdAt: string;
}

export interface StockReservation extends StockReservationRequest {
  status: StockReservationStatus;
}

export interface ReservableStockLot extends StockReservationScope {
  id: string;
  stockItemId: string;
  onHandMeters: number;
  unusableMeters: number;
  isBlocked?: boolean;
}

export type StockReservationRejectionReason =
  | "INVALID_REQUEST"
  | "SCOPE_MISMATCH"
  | "LOT_NOT_FOUND"
  | "LOT_BLOCKED"
  | "STOCK_ITEM_MISMATCH"
  | "IDEMPOTENCY_CONFLICT"
  | "DUPLICATE_ALLOCATION"
  | "INSUFFICIENT_AVAILABLE_STOCK";

export type StockReservationDecision =
  | {
      outcome: "CREATE";
      reservation: StockReservation;
      availableBeforeMeters: number;
      availableAfterMeters: number;
    }
  | {
      outcome: "REPLAY";
      reservation: StockReservation;
      availableBeforeMeters: number;
      availableAfterMeters: number;
    }
  | {
      outcome: "REJECT";
      reason: StockReservationRejectionReason;
      message: string;
    };

const EPSILON = 0.000001;

function roundMeters(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function sameScope(
  left: StockReservationScope,
  right: StockReservationScope
): boolean {
  return (
    left.tenantId === right.tenantId &&
    left.companyId === right.companyId &&
    left.branchId === right.branchId &&
    left.accountingPeriodId === right.accountingPeriodId
  );
}

function sameRequestPayload(
  request: StockReservationRequest,
  reservation: StockReservation
): boolean {
  return (
    request.id === reservation.id &&
    request.allocationId === reservation.allocationId &&
    request.saleId === reservation.saleId &&
    request.saleItemId === reservation.saleItemId &&
    request.productionOrderId === reservation.productionOrderId &&
    request.stockItemId === reservation.stockItemId &&
    request.stockLotId === reservation.stockLotId &&
    Math.abs(request.quantityMeters - reservation.quantityMeters) <= EPSILON &&
    sameScope(request, reservation)
  );
}

function sameAllocation(
  request: StockReservationRequest,
  reservation: StockReservation
): boolean {
  return (
    sameScope(request, reservation) &&
    request.saleItemId === reservation.saleItemId &&
    request.allocationId === reservation.allocationId
  );
}

function activeReservedMeters(
  lotId: string,
  reservations: StockReservation[]
): number {
  return roundMeters(
    reservations
      .filter(
        (reservation) =>
          reservation.stockLotId === lotId && reservation.status === "ACTIVE"
      )
      .reduce(
        (total, reservation) => total + reservation.quantityMeters,
        0
      )
  );
}

function reject(
  reason: StockReservationRejectionReason,
  message: string
): StockReservationDecision {
  return { outcome: "REJECT", reason, message };
}

export function decideStockReservation(
  request: StockReservationRequest,
  existingReservations: StockReservation[],
  lot: ReservableStockLot | undefined
): StockReservationDecision {
  const requiredText = [
    request.id,
    request.idempotencyKey,
    request.allocationId,
    request.saleId,
    request.saleItemId,
    request.productionOrderId,
    request.stockItemId,
    request.stockLotId,
    request.createdByUserId,
    request.createdAt,
    request.tenantId,
    request.companyId,
    request.branchId,
    request.accountingPeriodId,
  ];

  if (
    requiredText.some((value) => !hasText(value)) ||
    !Number.isFinite(request.quantityMeters) ||
    request.quantityMeters <= 0
  ) {
    return reject("INVALID_REQUEST", "Rezervasyon isteği eksik veya geçersiz.");
  }

  const idempotentMatch = existingReservations.find(
    (reservation) =>
      reservation.idempotencyKey === request.idempotencyKey &&
      sameScope(reservation, request)
  );
  if (idempotentMatch) {
    if (!sameRequestPayload(request, idempotentMatch)) {
      return reject(
        "IDEMPOTENCY_CONFLICT",
        "Aynı idempotency anahtarı farklı rezervasyon içeriğiyle kullanılamaz."
      );
    }

    const availableBeforeMeters = lot
      ? roundMeters(
          lot.onHandMeters -
            lot.unusableMeters -
            activeReservedMeters(lot.id, existingReservations) +
            (idempotentMatch.status === "ACTIVE"
              ? idempotentMatch.quantityMeters
              : 0)
        )
      : 0;
    return {
      outcome: "REPLAY",
      reservation: idempotentMatch,
      availableBeforeMeters,
      availableAfterMeters: roundMeters(
        availableBeforeMeters -
          (idempotentMatch.status === "ACTIVE"
            ? idempotentMatch.quantityMeters
            : 0)
      ),
    };
  }

  const duplicateAllocation = existingReservations.find(
    (reservation) =>
      reservation.status !== "RELEASED" &&
      sameAllocation(request, reservation)
  );
  if (duplicateAllocation) {
    return reject(
      "DUPLICATE_ALLOCATION",
      "Aynı satış kalemi ve kaynak tahsisi için ikinci rezervasyon oluşturulamaz."
    );
  }

  if (!lot || lot.id !== request.stockLotId) {
    return reject("LOT_NOT_FOUND", "Rezervasyon top/lot kaydı bulunamadı.");
  }
  if (!sameScope(request, lot)) {
    return reject(
      "SCOPE_MISMATCH",
      "Rezervasyon ve top/lot şirket kapsamı eşleşmiyor."
    );
  }
  if (lot.isBlocked) {
    return reject("LOT_BLOCKED", "Bloke top/lot rezerve edilemez.");
  }
  if (lot.stockItemId !== request.stockItemId) {
    return reject(
      "STOCK_ITEM_MISMATCH",
      "Rezervasyon ürünü ile top/lot ürünü eşleşmiyor."
    );
  }

  const availableBeforeMeters = roundMeters(
    lot.onHandMeters -
      lot.unusableMeters -
      activeReservedMeters(lot.id, existingReservations)
  );
  if (request.quantityMeters > availableBeforeMeters + EPSILON) {
    return reject(
      "INSUFFICIENT_AVAILABLE_STOCK",
      "Rezervasyon miktarı kullanılabilir lot metresini aşıyor."
    );
  }

  return {
    outcome: "CREATE",
    reservation: {
      ...request,
      status: "ACTIVE",
    },
    availableBeforeMeters,
    availableAfterMeters: roundMeters(
      availableBeforeMeters - request.quantityMeters
    ),
  };
}
