import assert from "node:assert/strict";
import {
  decideStoreCutCompletion,
  type StoreCutCompletionRequest
} from "../src/lib/storeCutCompletion";
import {
  decideInventoryConsumption
} from "../src/lib/inventoryConsumption";

const scope = {
  tenantId: "tenant-a",
  companyId: "company-a",
  branchId: "branch-a",
  accountingPeriodId: "period-a"
};

const lot = {
  ...scope,
  id: "lot-19",
  stockItemId: "fabric-1",
  onHandMeters: 19
};

function request(
  patch: Partial<StoreCutCompletionRequest> = {}
): StoreCutCompletionRequest {
  return {
    ...scope,
    id: "cut-completion-1",
    idempotencyKey: "idem-cut-1",
    cutOrderId: "cut-order-1",
    reservationId: "reservation-1",
    saleId: "sale-1",
    saleItemId: "sale-item-1",
    productionOrderId: "production-1",
    stockItemId: "fabric-1",
    stockLotId: "lot-19",
    reservedMeters: 18,
    plannedCutMeters: 18,
    actualCutMeters: 18,
    usableOutputMeters: 18,
    completedByUserId: "user-1",
    completedAt: "2026-08-07T20:00:00.000Z",
    ...patch
  };
}

const normalOverCut = decideStoreCutCompletion(
  request({
    actualCutMeters: 18.5,
    usableOutputMeters: 18.5
  }),
  [],
  lot
);
assert.equal(
  normalOverCut.outcome,
  "REJECT"
);
if (normalOverCut.outcome === "REJECT") {
  assert.equal(
    normalOverCut.reason,
    "ACTUAL_EXCEEDS_RESERVATION"
  );
}

const wholeLotDecision =
  decideStoreCutCompletion(
    request({
      consumptionMode: "USE_WHOLE_LOT",
      plannedCutMeters: 19,
      actualCutMeters: 19,
      usableOutputMeters: 19
    }),
    [],
    lot
  );

assert.equal(
  wholeLotDecision.outcome,
  "CREATE"
);

if (wholeLotDecision.outcome !== "CREATE") {
  throw new Error("whole lot completion expected");
}

assert.equal(
  wholeLotDecision.completion.reservedMeters,
  18
);
assert.equal(
  wholeLotDecision.completion.actualCutMeters,
  19
);
assert.equal(
  wholeLotDecision.completion.usableOutputMeters,
  19
);
assert.equal(
  wholeLotDecision.completion.wasteMeters,
  0
);
assert.equal(
  wholeLotDecision.completion.lotRemainingMeters,
  0
);

const consumptionDecision =
  decideInventoryConsumption(
    wholeLotDecision.completion,
    []
  );

assert.equal(
  consumptionDecision.outcome,
  "CREATE"
);

if (consumptionDecision.outcome !== "CREATE") {
  throw new Error(
    "inventory consumption expected"
  );
}

const movement =
  consumptionDecision.consumption;

assert.equal(
  movement.plannedQuantityMeters,
  18
);
assert.equal(
  movement.physicalConsumptionMeters,
  19
);
assert.equal(
  movement.nonReusableRemainderMeters,
  1
);
assert.equal(
  movement.classification,
  "WHOLE_LOT_REMAINDER_ABSORBED"
);
assert.equal(movement.saleId, "sale-1");
assert.equal(
  movement.saleItemId,
  "sale-item-1"
);
assert.equal(movement.stockLotId, "lot-19");

const replay =
  decideInventoryConsumption(
    wholeLotDecision.completion,
    [movement]
  );

assert.equal(replay.outcome, "REPLAY");

const partialWholeLot =
  decideStoreCutCompletion(
    request({
      consumptionMode: "USE_WHOLE_LOT",
      actualCutMeters: 18.5,
      usableOutputMeters: 18.5
    }),
    [],
    lot
  );

assert.equal(
  partialWholeLot.outcome,
  "REJECT"
);

if (partialWholeLot.outcome === "REJECT") {
  assert.equal(
    partialWholeLot.reason,
    "WHOLE_LOT_REQUIRES_FULL_LOT"
  );
}

const wholeLotWithWaste =
  decideStoreCutCompletion(
    request({
      consumptionMode: "USE_WHOLE_LOT",
      plannedCutMeters: 19,
      actualCutMeters: 19,
      usableOutputMeters: 18
    }),
    [],
    lot
  );

assert.equal(
  wholeLotWithWaste.outcome,
  "REJECT"
);

if (wholeLotWithWaste.outcome === "REJECT") {
  assert.equal(
    wholeLotWithWaste.reason,
    "WHOLE_LOT_OUTPUT_MISMATCH"
  );
}

const insufficient =
  decideStoreCutCompletion(
    request({
      consumptionMode: "USE_WHOLE_LOT",
      plannedCutMeters: 20,
      actualCutMeters: 20,
      usableOutputMeters: 20
    }),
    [],
    lot
  );

assert.equal(
  insufficient.outcome,
  "REJECT"
);

console.log(
  "[PASS] Inventory Consumption package"
);
console.log(
  "[PASS] sale quantity remains 18; physical consumption may be 19"
);
console.log(
  "[PASS] whole-lot micro remainder is not waste and lot remainder is zero"
);
console.log(
  "[PASS] inventory consumption idempotency replay"
);