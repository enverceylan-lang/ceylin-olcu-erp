import assert from "node:assert/strict";
import type {
  ProductionItem
} from "../src/store/useStore";
import type {
  ProductionSourcePlan
} from "../src/lib/productionSourceModel";
import {
  applyProductionMaterialReadiness
} from "../src/lib/productionMaterialReadinessGate";

function item(
  status:
    ProductionItem["productionStatus"] =
      "WAITING_MATERIAL"
): ProductionItem {
  return {
    id: "central-production-sale-1-item-1",
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
    productionStatus: status,
    cutCompleted: false,
    sewingCompleted: false,
    ironingCompleted: false,
    packagingCompleted: false,
    dueDate: "2026-08-05",
    history: []
  };
}

function plan(
  allocationStatus:
    | "RESERVED"
    | "ORDERED"
    | "READY"
    | "CONSUMED"
): ProductionSourcePlan {
  return {
    id:
      "production-source-plan:central-production-sale-1-item-1",
    productionItemId:
      "central-production-sale-1-item-1",
    requiredQuantity: 10,
    unit: "mt",
    version: 1,
    allocations: [
      {
        id: "alloc-1",
        productionItemId:
          "central-production-sale-1-item-1",
        sourceType: "STORE_CUT",
        quantity: 10,
        unit: "mt",
        status: allocationStatus,
        lotId: "lot-1",
        reservationId: "reservation-1"
      }
    ]
  };
}

const missing =
  applyProductionMaterialReadiness(
    item(),
    undefined
  );

assert.equal(
  missing.item.productionStatus,
  "WAITING_MATERIAL"
);
assert.equal(
  missing.releasedForCutting,
  false
);

const reserved =
  applyProductionMaterialReadiness(
    item(),
    plan("RESERVED")
  );

assert.equal(
  reserved.item.productionStatus,
  "WAITING_MATERIAL"
);
assert.equal(
  reserved.releasedForCutting,
  false
);

const ready =
  applyProductionMaterialReadiness(
    item(),
    plan("READY")
  );

assert.equal(
  ready.item.productionStatus,
  "READY_FOR_CUTTING"
);
assert.equal(
  ready.releasedForCutting,
  true
);

const consumed =
  applyProductionMaterialReadiness(
    item(),
    plan("CONSUMED")
  );

assert.equal(
  consumed.item.productionStatus,
  "READY_FOR_CUTTING"
);

const progressed =
  applyProductionMaterialReadiness(
    item("SEWING"),
    undefined
  );

assert.equal(
  progressed.item.productionStatus,
  "SEWING"
);

const legacyReadyForCutting =
  applyProductionMaterialReadiness(
    item("READY_FOR_CUTTING"),
    undefined
  );

assert.equal(
  legacyReadyForCutting.item
    .productionStatus,
  "READY_FOR_CUTTING"
);

console.log(
  "[PASS] missingMaterialWaits"
);
console.log(
  "[PASS] reservedMaterialWaits"
);
console.log(
  "[PASS] readyMaterialReleasesCutting"
);
console.log(
  "[PASS] consumedMaterialRemainsReady"
);
console.log(
  "[PASS] progressedProductionDoesNotRegress"
);
console.log(
  "[PASS] legacyReadyForCuttingDoesNotRegress"
);
console.log(
  "[PASS] productionMaterialReadinessGateSuite completed"
);