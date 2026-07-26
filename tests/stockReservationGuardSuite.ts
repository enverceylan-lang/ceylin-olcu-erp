import assert from "node:assert/strict";
import {
  decideStockReservation,
  type ReservableStockLot,
  type StockReservation,
  type StockReservationRequest,
} from "../src/lib/stockReservationGuard";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
};

function createRequest(
  overrides: Partial<StockReservationRequest> = {}
): StockReservationRequest {
  return {
    ...scope,
    id: "reservation-1",
    idempotencyKey: "reserve:sale-item-1:allocation-1",
    allocationId: "allocation-1",
    saleId: "sale-1",
    saleItemId: "sale-item-1",
    productionOrderId: "production-1",
    stockItemId: "fabric-1",
    stockLotId: "lot-1",
    quantityMeters: 8,
    createdByUserId: "office-1",
    createdAt: "2026-07-26T03:00:00.000Z",
    ...overrides,
  };
}

const lot: ReservableStockLot = {
  ...scope,
  id: "lot-1",
  stockItemId: "fabric-1",
  onHandMeters: 20,
  unusableMeters: 2,
};

const createDecision = decideStockReservation(createRequest(), [], lot);
assert.equal(createDecision.outcome, "CREATE");
if (createDecision.outcome === "CREATE") {
  assert.equal(createDecision.availableBeforeMeters, 18);
  assert.equal(createDecision.availableAfterMeters, 10);
  assert.equal(createDecision.reservation.status, "ACTIVE");
}

const existingReservation: StockReservation = {
  ...createRequest(),
  status: "ACTIVE",
};
const replayDecision = decideStockReservation(
  createRequest(),
  [existingReservation],
  lot
);
assert.equal(replayDecision.outcome, "REPLAY");
if (replayDecision.outcome === "REPLAY") {
  assert.equal(replayDecision.availableBeforeMeters, 18);
  assert.equal(replayDecision.availableAfterMeters, 10);
}

const idempotencyConflict = decideStockReservation(
  createRequest({ quantityMeters: 9 }),
  [existingReservation],
  lot
);
assert.equal(idempotencyConflict.outcome, "REJECT");
if (idempotencyConflict.outcome === "REJECT") {
  assert.equal(idempotencyConflict.reason, "IDEMPOTENCY_CONFLICT");
}

const duplicateAllocation = decideStockReservation(
  createRequest({
    id: "reservation-2",
    idempotencyKey: "another-key",
  }),
  [existingReservation],
  lot
);
assert.equal(duplicateAllocation.outcome, "REJECT");
if (duplicateAllocation.outcome === "REJECT") {
  assert.equal(duplicateAllocation.reason, "DUPLICATE_ALLOCATION");
}

const insufficientStock = decideStockReservation(
  createRequest({
    id: "reservation-3",
    idempotencyKey: "reserve:sale-item-2:allocation-2",
    saleItemId: "sale-item-2",
    allocationId: "allocation-2",
    quantityMeters: 11,
  }),
  [existingReservation],
  lot
);
assert.equal(insufficientStock.outcome, "REJECT");
if (insufficientStock.outcome === "REJECT") {
  assert.equal(insufficientStock.reason, "INSUFFICIENT_AVAILABLE_STOCK");
}

const releasedReservation: StockReservation = {
  ...existingReservation,
  status: "RELEASED",
};
const replacementAfterRelease = decideStockReservation(
  createRequest({
    id: "reservation-4",
    idempotencyKey: "replacement-key",
  }),
  [releasedReservation],
  lot
);
assert.equal(replacementAfterRelease.outcome, "CREATE");

const crossCompanyLot: ReservableStockLot = {
  ...lot,
  companyId: "company-2",
};
const scopeMismatch = decideStockReservation(
  createRequest(),
  [],
  crossCompanyLot
);
assert.equal(scopeMismatch.outcome, "REJECT");
if (scopeMismatch.outcome === "REJECT") {
  assert.equal(scopeMismatch.reason, "SCOPE_MISMATCH");
}

console.log("[PASS] stock reservation guard");
