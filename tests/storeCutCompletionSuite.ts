import assert from "node:assert/strict";
import {
  decideStoreCutCompletion,
  type StoreCutCompletion,
  type StoreCutCompletionLot,
  type StoreCutCompletionRequest,
} from "../src/lib/storeCutCompletion";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
};

function request(
  overrides: Partial<StoreCutCompletionRequest> = {}
): StoreCutCompletionRequest {
  return {
    ...scope,
    id: "completion-1",
    idempotencyKey: "complete:cut-order-1",
    cutOrderId: "cut-order-1",
    reservationId: "reservation-1",
    saleId: "sale-1",
    saleItemId: "sale-item-1",
    productionOrderId: "production-1",
    stockItemId: "fabric-1",
    stockLotId: "lot-1",
    reservedMeters: 10,
    plannedCutMeters: 10,
    actualCutMeters: 10,
    usableOutputMeters: 9.5,
    completedByUserId: "office-1",
    completedAt: "2026-07-26T03:20:00.000Z",
    ...overrides,
  };
}

const lot: StoreCutCompletionLot = {
  ...scope,
  id: "lot-1",
  stockItemId: "fabric-1",
  onHandMeters: 12,
};

const created = decideStoreCutCompletion(request(), [], lot);
assert.equal(created.outcome, "CREATE");
if (created.outcome === "CREATE") {
  assert.equal(created.completion.wasteMeters, 0.5);
  assert.equal(created.completion.lotRemainingMeters, 2);
}

const saved = (created as { completion: StoreCutCompletion }).completion;
assert.equal(
  decideStoreCutCompletion(request(), [saved], lot).outcome,
  "REPLAY"
);

const conflict = decideStoreCutCompletion(
  request({ usableOutputMeters: 9 }),
  [saved],
  lot
);
assert.equal(conflict.outcome, "REJECT");
if (conflict.outcome === "REJECT") {
  assert.equal(conflict.reason, "IDEMPOTENCY_CONFLICT");
}

const overReservation = decideStoreCutCompletion(
  request({ actualCutMeters: 11 }),
  [],
  lot
);
assert.equal(overReservation.outcome, "REJECT");
if (overReservation.outcome === "REJECT") {
  assert.equal(overReservation.reason, "ACTUAL_EXCEEDS_RESERVATION");
}

const impossibleOutput = decideStoreCutCompletion(
  request({ usableOutputMeters: 10.5 }),
  [],
  lot
);
assert.equal(impossibleOutput.outcome, "REJECT");
if (impossibleOutput.outcome === "REJECT") {
  assert.equal(impossibleOutput.reason, "OUTPUT_EXCEEDS_ACTUAL_CUT");
}

console.log("[PASS] store cut completion");
