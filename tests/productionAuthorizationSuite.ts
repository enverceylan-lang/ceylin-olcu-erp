import assert from "node:assert/strict";
import { getAuthorizedProductionTransition } from "../src/lib/productionWorkflow";
import type { ProductionItem } from "../src/store/useStore";

const item: ProductionItem = {
  id: "item-1",
  orderId: "sale-1",
  saleLineId: "line-1",
  customerId: "customer-1",
  roomName: "Salon",
  openingName: "Pencere",
  productName: "Tül",
  productType: "Tül",
  width: 300,
  height: 260,
  quantity: 7,
  quantityUnit: "mt",
  productionStatus: "READY_FOR_CUTTING",
  cutCompleted: false,
  sewingCompleted: false,
  ironingCompleted: false,
  packagingCompleted: false,
  assignedEmployeeId: "tailor-1",
  dueDate: "2026-07-30",
  history: [],
};

assert.equal(
  getAuthorizedProductionTransition(item, "CUT", {
    userId: "tailor-1",
    role: "TAILOR",
  }).allowed,
  true
);

const otherTailor = getAuthorizedProductionTransition(item, "CUT", {
  userId: "tailor-2",
  role: "TAILOR",
});
assert.equal(otherTailor.allowed, false);
if (!otherTailor.allowed) {
  assert.equal(otherTailor.reason, "ASSIGNMENT_REQUIRED");
}

const tailorCannotChangeSupply = getAuthorizedProductionTransition(
  item,
  "WAITING_FACTORY",
  { userId: "tailor-1", role: "TAILOR" }
);
assert.equal(tailorCannotChangeSupply.allowed, false);
if (!tailorCannotChangeSupply.allowed) {
  assert.equal(
    tailorCannotChangeSupply.reason,
    "STATUS_FORBIDDEN_FOR_TAILOR"
  );
}

assert.equal(
  getAuthorizedProductionTransition(item, "WAITING_FACTORY", {
    userId: "office-1",
    role: "OFFICE",
  }).allowed,
  true
);

console.log("[PASS] production authorization");
