import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import {
  useStore,
  type ProductionItem
} from "../src/store/useStore";
import {
  useProductionMaterialStore
} from "../src/store/useProductionMaterialStore";
import type {
  ProductionSourcePlan
} from "../src/lib/productionSourceModel";

function productionItem():
  ProductionItem {
  return {
    id:
      "central-production-sale-1-item-1",
    orderId: "sale-1",
    saleLineId: "item-1",
    customerId: "customer-1",
    roomName: "Salon",
    openingName: "Pencere",
    productName: "Tül",
    productType: "Tül",
    width: 300,
    height: 260,
    quantity: 10,
    quantityUnit: "mt",
    productionStatus:
      "WAITING_MATERIAL",
    cutCompleted: false,
    sewingCompleted: false,
    ironingCompleted: false,
    packagingCompleted: false,
    dueDate: "2026-08-05",
    history: []
  };
}

function plan(
  version: number,
  status:
    | "RESERVED"
    | "READY"
): ProductionSourcePlan {
  return {
    id:
      "production-source-plan:central-production-sale-1-item-1",
    productionItemId:
      "central-production-sale-1-item-1",
    requiredQuantity: 10,
    unit: "mt",
    version,
    allocations: [
      {
        id: "allocation-1",
        productionItemId:
          "central-production-sale-1-item-1",
        sourceType:
          "STORE_CUT",
        quantity: 10,
        unit: "mt",
        status,
        lotId: "lot-1",
        reservationId:
          "reservation-1"
      }
    ]
  };
}

const originalItems =
  useStore.getState()
    .productionItems;

useStore.setState({
  productionItems: [
    productionItem()
  ]
});

useProductionMaterialStore.setState({
  plans: []
});

const waiting =
  useProductionMaterialStore
    .getState()
    .savePlan(
      plan(1, "RESERVED")
    );

assert.equal(
  waiting.outcome,
  "CREATED"
);

assert.equal(
  useStore
    .getState()
    .productionItems[0]
    .productionStatus,
  "WAITING_MATERIAL"
);

const replay =
  useProductionMaterialStore
    .getState()
    .savePlan(
      plan(1, "RESERVED")
    );

assert.equal(
  replay.outcome,
  "REPLAY"
);

const conflictPlan =
  plan(1, "READY");

const conflict =
  useProductionMaterialStore
    .getState()
    .savePlan(
      conflictPlan
    );

assert.equal(
  conflict.outcome,
  "REJECTED"
);

if (
  conflict.outcome ===
  "REJECTED"
) {
  assert.equal(
    conflict.reason,
    "VERSION_CONFLICT"
  );
}

const ready =
  useProductionMaterialStore
    .getState()
    .savePlan(
      plan(2, "READY")
    );

assert.equal(
  ready.outcome,
  "UPDATED"
);

assert.equal(
  ready.outcome ===
    "UPDATED"
    ? ready.releasedForCutting
    : false,
  true
);

assert.equal(
  useStore
    .getState()
    .productionItems[0]
    .productionStatus,
  "READY_FOR_CUTTING"
);

const stale =
  useProductionMaterialStore
    .getState()
    .savePlan(
      plan(1, "RESERVED")
    );

assert.equal(
  stale.outcome,
  "REJECTED"
);

if (
  stale.outcome ===
  "REJECTED"
) {
  assert.equal(
    stale.reason,
    "STALE_VERSION"
  );
}

useStore.setState({
  productionItems:
    originalItems
});

useProductionMaterialStore.setState({
  plans: []
});

console.log(
  "[PASS] waitingPlanKeepsMaterialGateClosed"
);
console.log(
  "[PASS] sameVersionSamePayloadReplays"
);
console.log(
  "[PASS] sameVersionDifferentPayloadConflicts"
);
console.log(
  "[PASS] readyPlanReleasesCutting"
);
console.log(
  "[PASS] stalePlanRejected"
);
console.log(
  "[PASS] productionMaterialStoreSuite completed"
);