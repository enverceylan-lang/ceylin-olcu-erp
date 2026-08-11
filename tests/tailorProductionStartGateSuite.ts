import assert from "node:assert/strict";
import {
  getAuthorizedProductionTransition,
  getProductionTransition
} from "../src/lib/productionWorkflow";
import type {
  ProductionItem
} from "../src/store/useStore";

function item(
  productionStatus: string,
  assignedEmployeeId =
    "tailor-1"
): ProductionItem {
  return {
    id: "production-item-1",
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
    productionStatus,
    cutCompleted: false,
    sewingCompleted: false,
    ironingCompleted: false,
    packagingCompleted: false,
    assignedEmployeeId,
    dueDate: "2026-08-05",
    history: []
  };
}

const waiting =
  getProductionTransition(
    item("WAITING_MATERIAL"),
    "CUT"
  );

assert.equal(
  waiting.allowed,
  false
);

if (!waiting.allowed) {
  assert.equal(
    waiting.reason,
    "MATERIAL_NOT_READY"
  );
}

console.log(
  "[PASS] waitingMaterialCannotStartPhysicalCut"
);

const partiallyReady =
  getProductionTransition(
    item("WAITING_FACTORY"),
    "CUT"
  );

assert.equal(
  partiallyReady.allowed,
  false
);

console.log(
  "[PASS] waitingFactoryCannotStartPhysicalCut"
);

const ready =
  getProductionTransition(
    item("READY_FOR_CUTTING"),
    "CUT"
  );

assert.equal(
  ready.allowed,
  true
);

console.log(
  "[PASS] readyForCuttingCanStartPhysicalCut"
);

const assignedTailor =
  getAuthorizedProductionTransition(
    item("READY_FOR_CUTTING"),
    "CUT",
    {
      userId: "tailor-1",
      role: "TAILOR"
    }
  );

assert.equal(
  assignedTailor.allowed,
  true
);

const otherTailor =
  getAuthorizedProductionTransition(
    item("READY_FOR_CUTTING"),
    "CUT",
    {
      userId: "tailor-2",
      role: "TAILOR"
    }
  );

assert.equal(
  otherTailor.allowed,
  false
);

if (!otherTailor.allowed) {
  assert.equal(
    otherTailor.reason,
    "ASSIGNMENT_REQUIRED"
  );
}

console.log(
  "[PASS] onlyAssignedTailorCanCut"
);

const adminWaiting =
  getAuthorizedProductionTransition(
    item("WAITING_MATERIAL"),
    "CUT",
    {
      userId: "admin-1",
      role: "ADMIN"
    }
  );

assert.equal(
  adminWaiting.allowed,
  false
);

if (!adminWaiting.allowed) {
  assert.equal(
    adminWaiting.reason,
    "MATERIAL_NOT_READY"
  );
}

console.log(
  "[PASS] adminCannotBypassMaterialGate"
);

console.log(
  "[PASS] tailorProductionStartGateSuite completed"
);