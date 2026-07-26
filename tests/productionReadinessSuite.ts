import assert from "node:assert/strict";
import {
  getProductionOrderReadiness,
  getProductionSourceReadiness,
} from "../src/lib/productionReadiness";
import type { ProductionSourcePlan } from "../src/lib/productionSourceModel";

function createPlan(): ProductionSourcePlan {
  return {
    id: "plan-1",
    productionItemId: "item-1",
    requiredQuantity: 10,
    unit: "mt",
    version: 1,
    allocations: [
      {
        id: "allocation-1",
        productionItemId: "item-1",
        sourceType: "STORE_CUT",
        quantity: 6,
        unit: "mt",
        status: "RESERVED",
        lotId: "lot-1",
        reservationId: "reservation-1",
      },
      {
        id: "allocation-2",
        productionItemId: "item-1",
        sourceType: "SUPPLIER_ORDER",
        quantity: 4,
        unit: "mt",
        status: "ORDERED",
        supplierId: "supplier-1",
        supplierOrderId: "order-1",
      },
    ],
  };
}

const waitingPlan = createPlan();
assert.deepEqual(getProductionSourceReadiness(waitingPlan), {
  status: "WAITING",
  requiredQuantity: 10,
  readyQuantity: 0,
  pendingQuantity: 10,
  missingQuantity: 0,
  completionPercent: 0,
  errors: [],
});

const partiallyReadyPlan = createPlan();
partiallyReadyPlan.allocations[0].status = "READY";
assert.deepEqual(getProductionSourceReadiness(partiallyReadyPlan), {
  status: "PARTIALLY_READY",
  requiredQuantity: 10,
  readyQuantity: 6,
  pendingQuantity: 4,
  missingQuantity: 0,
  completionPercent: 60,
  errors: [],
});

const readyPlan = createPlan();
readyPlan.allocations[0].status = "CONSUMED";
readyPlan.allocations[1].status = "READY";
assert.equal(getProductionSourceReadiness(readyPlan).status, "READY");
assert.equal(
  getProductionSourceReadiness(readyPlan).completionPercent,
  100
);

const incompletePlan = createPlan();
incompletePlan.allocations.pop();
incompletePlan.allocations[0].status = "READY";
const incompleteResult = getProductionSourceReadiness(incompletePlan);
assert.equal(incompleteResult.status, "PARTIALLY_READY");
assert.equal(incompleteResult.readyQuantity, 6);
assert.equal(incompleteResult.missingQuantity, 4);

const invalidPlan = createPlan();
invalidPlan.allocations[1].quantity = 5;
assert.equal(getProductionSourceReadiness(invalidPlan).status, "INVALID");

assert.deepEqual(getProductionOrderReadiness([]), {
  status: "EMPTY",
  totalCount: 0,
  activeCount: 0,
  readyCount: 0,
  waitingCount: 0,
  problemCount: 0,
  cancelledCount: 0,
  completionPercent: 0,
});

const partialOrder = getProductionOrderReadiness([
  { productionStatus: "READY" },
  { productionStatus: "SEWING" },
  { productionStatus: "CANCELLED" },
]);
assert.equal(partialOrder.status, "PARTIALLY_READY");
assert.equal(partialOrder.activeCount, 2);
assert.equal(partialOrder.readyCount, 1);
assert.equal(partialOrder.cancelledCount, 1);
assert.equal(partialOrder.completionPercent, 50);

const cancelledOrder = getProductionOrderReadiness([
  { productionStatus: "CANCELLED" },
  { productionStatus: "CANCELLED" },
]);
assert.equal(cancelledOrder.status, "CANCELLED");
assert.equal(cancelledOrder.readyCount, 0);
assert.equal(cancelledOrder.completionPercent, 0);

const problemOrder = getProductionOrderReadiness([
  { productionStatus: "READY" },
  { productionStatus: "PROBLEM" },
]);
assert.equal(problemOrder.status, "PROBLEM");
assert.equal(problemOrder.problemCount, 1);

const readyOrder = getProductionOrderReadiness([
  { productionStatus: "READY" },
  { productionStatus: "READY" },
  { productionStatus: "CANCELLED" },
]);
assert.equal(readyOrder.status, "READY");
assert.equal(readyOrder.completionPercent, 100);

console.log("[PASS] production readiness");
