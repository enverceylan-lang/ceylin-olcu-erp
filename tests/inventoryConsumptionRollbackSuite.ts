import assert from "node:assert/strict";
import {
  buildInventoryConsumption,
  decideInventoryConsumptionReversal
} from "../src/lib/inventoryConsumption";
import type {
  StoreCutCompletion
} from "../src/lib/storeCutCompletion";
import {
  useSupplyChainStore
} from "../src/store/useSupplyChainStore";

const scope = {
  tenantId: "tenant-a",
  companyId: "company-a",
  branchId: "branch-a",
  accountingPeriodId: "period-a"
};

const completion: StoreCutCompletion = {
  ...scope,
  id: "completion-rollback-1",
  idempotencyKey: "idem-cut-rollback-1",
  cutOrderId: "cut-order-rollback-1",
  reservationId: "reservation-rollback-1",
  saleId: "sale-rollback-1",
  saleItemId: "sale-item-rollback-1",
  productionOrderId:
    "production-rollback-1",
  stockItemId: "fabric-rollback-1",
  stockLotId: "lot-rollback-1",
  consumptionMode: "USE_WHOLE_LOT",
  reservedMeters: 18,
  plannedCutMeters: 19,
  actualCutMeters: 19,
  usableOutputMeters: 19,
  completedByUserId: "cut-user-1",
  completedAt:
    "2026-08-08T00:00:00.000Z",
  wasteMeters: 0,
  lotRemainingMeters: 0,
  status: "COMPLETED"
};

const original =
  buildInventoryConsumption(completion);

const pureCreate =
  decideInventoryConsumptionReversal(
    {
      original,
      scope,
      actorUserId: "rollback-user-1",
      occurredAt:
        "2026-08-08T00:10:00.000Z",
      reason:
        "STORE_CUT_COMPLETION_ROLLBACK",
      source:
        "STORE_CUT_COMPLETION_COORDINATOR"
    },
    []
  );

assert.equal(pureCreate.outcome, "CREATE");
if (pureCreate.outcome !== "CREATE") {
  throw new Error("reversal create expected");
}

assert.equal(
  pureCreate.reversal.originalConsumptionId,
  original.id
);
assert.equal(
  pureCreate.reversal.originalCutCompletionId,
  original.cutCompletionId
);
assert.equal(
  pureCreate.reversal.reversedQuantityMeters,
  19
);

const pureReplay =
  decideInventoryConsumptionReversal(
    {
      original,
      scope,
      actorUserId: "rollback-user-2",
      occurredAt:
        "2026-08-08T00:20:00.000Z",
      reason: "SECOND_ATTEMPT",
      source: "TEST"
    },
    [pureCreate.reversal]
  );

assert.equal(pureReplay.outcome, "REPLAY");

const pureWrongScope =
  decideInventoryConsumptionReversal(
    {
      original,
      scope: {
        ...scope,
        companyId: "company-b"
      },
      actorUserId: "rollback-user-1",
      occurredAt:
        "2026-08-08T00:10:00.000Z",
      reason: "WRONG_SCOPE",
      source: "TEST"
    },
    []
  );

assert.equal(pureWrongScope.outcome, "REJECT");

const current =
  useSupplyChainStore.getState();

const lot = {
  ...scope,
  id: completion.stockLotId,
  stockItemId: completion.stockItemId,
  onHandMeters: 0,
  unusableMeters: 0,
  updatedAt: completion.completedAt
} as unknown as typeof current.lots[number];

const reservation = {
  ...scope,
  id: completion.reservationId,
  idempotencyKey: "reservation-idem-1",
  saleId: completion.saleId,
  saleItemId: completion.saleItemId,
  productionOrderId:
    completion.productionOrderId,
  stockItemId: completion.stockItemId,
  stockLotId: completion.stockLotId,
  quantityMeters: 18,
  status: "CONSUMED",
  createdAt:
    "2026-08-08T00:00:00.000Z"
} as unknown as typeof current.reservations[number];

useSupplyChainStore.setState({
  lots: [lot],
  reservations: [reservation],
  cutCompletions: [completion],
  inventoryConsumptions: [original],
  inventoryConsumptionReversals: []
});

const rollbackInput = {
  scope,
  completionId: completion.id,
  reservationId: completion.reservationId,
  lotId: completion.stockLotId,
  previousOnHandMeters: 19,
  reversedByUserId: "rollback-user-1",
  reversedAt:
    "2026-08-08T00:10:00.000Z",
  reason:
    "STORE_CUT_COMPLETION_ROLLBACK",
  source:
    "STORE_CUT_COMPLETION_COORDINATOR"
};

const firstRollback =
  useSupplyChainStore
    .getState()
    .rollbackStoreCutCompletionCreated(
      rollbackInput
    );

assert.equal(firstRollback.outcome, "CREATED");

let after =
  useSupplyChainStore.getState();

assert.equal(after.lots[0].onHandMeters, 19);
assert.equal(
  after.reservations[0].status,
  "ACTIVE"
);
assert.equal(after.cutCompletions.length, 0);
assert.equal(
  after.inventoryConsumptions.length,
  1
);
assert.equal(
  after.inventoryConsumptionReversals.length,
  1
);

const secondRollback =
  useSupplyChainStore
    .getState()
    .rollbackStoreCutCompletionCreated({
      ...rollbackInput,
      reversedByUserId: "rollback-user-2",
      reversedAt:
        "2026-08-08T00:20:00.000Z",
      reason: "SECOND_ATTEMPT"
    });

assert.equal(secondRollback.outcome, "REPLAY");

after = useSupplyChainStore.getState();

assert.equal(
  after.inventoryConsumptions.length,
  1
);
assert.equal(
  after.inventoryConsumptionReversals.length,
  1
);

const wrongScopeRollback =
  useSupplyChainStore
    .getState()
    .rollbackStoreCutCompletionCreated({
      ...rollbackInput,
      scope: {
        ...scope,
        companyId: "company-b"
      }
    });

assert.equal(
  wrongScopeRollback.outcome,
  "REJECTED"
);

after = useSupplyChainStore.getState();

assert.equal(after.lots[0].onHandMeters, 19);
assert.equal(
  after.reservations[0].status,
  "ACTIVE"
);
assert.equal(
  after.inventoryConsumptions.length,
  1
);
assert.equal(
  after.inventoryConsumptionReversals.length,
  1
);

console.log(
  "[PASS] consumption append-only audit preserved"
);
console.log(
  "[PASS] rollback appends one idempotent reversal"
);
console.log(
  "[PASS] lot balance restored"
);
console.log(
  "[PASS] reservation CONSUMED -> ACTIVE"
);
console.log(
  "[PASS] wrong scope fails closed"
);