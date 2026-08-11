import assert from "node:assert/strict";
import {
  decideCurtainCutMaterial,
  getCurtainPleatLowerBoundary
} from "../src/lib/curtainCutMaterialDecision";

assert.equal(
  getCurtainPleatLowerBoundary("TIGHT"),
  2.85
);

assert.equal(
  getCurtainPleatLowerBoundary("NORMAL"),
  2.35
);

const tightExact =
  decideCurtainCutMaterial({
    selectedPleat: "TIGHT",
    requiredMeters: 9.3,
    availableMeters: 9.3,
    minimumReusableRemnantMeters: 1
  });

assert.equal(
  tightExact.status,
  "EXACT_OR_MORE_AVAILABLE"
);
assert.equal(
  tightExact.effectivePleatRatio,
  3.1
);
assert.equal(
  tightExact.plannedProductionMeters,
  9.3
);

const tightApprove =
  decideCurtainCutMaterial({
    selectedPleat: "TIGHT",
    requiredMeters: 9.3,
    availableMeters: 8.7,
    minimumReusableRemnantMeters: 1
  });

assert.equal(
  tightApprove.status,
  "ACCEPT_WITH_USER_APPROVAL"
);
assert.equal(
  tightApprove.effectivePleatRatio,
  2.9
);
assert.equal(
  tightApprove.requiresUserApproval,
  true
);

const tightReject =
  decideCurtainCutMaterial({
    selectedPleat: "TIGHT",
    requiredMeters: 9.3,
    availableMeters: 7,
    minimumReusableRemnantMeters: 1
  });

assert.equal(
  tightReject.status,
  "SUPPLY_REQUIRED"
);
assert.equal(
  tightReject.effectivePleatRatio,
  2.333333
);
assert.equal(
  tightReject.shouldCreateSupplierOrder,
  true
);

const normalWholeLot =
  decideCurtainCutMaterial({
    selectedPleat: "NORMAL",
    requiredMeters: 8.4,
    availableMeters: 9,
    minimumReusableRemnantMeters: 1
  });

assert.equal(
  normalWholeLot.status,
  "USE_WHOLE_LOT"
);
assert.equal(
  normalWholeLot.plannedProductionMeters,
  9
);
assert.equal(
  normalWholeLot.inventoryRemainderMeters,
  0
);
assert.equal(
  normalWholeLot.wasteMeters,
  0
);

const normalKeepRemainder =
  decideCurtainCutMaterial({
    selectedPleat: "NORMAL",
    requiredMeters: 8.4,
    availableMeters: 11,
    minimumReusableRemnantMeters: 1
  });

assert.equal(
  normalKeepRemainder.status,
  "EXACT_OR_MORE_AVAILABLE"
);
assert.equal(
  normalKeepRemainder.plannedProductionMeters,
  8.4
);
assert.equal(
  normalKeepRemainder.inventoryRemainderMeters,
  2.6
);

const normalApprove =
  decideCurtainCutMaterial({
    selectedPleat: "NORMAL",
    requiredMeters: 8.4,
    availableMeters: 8,
    minimumReusableRemnantMeters: 1
  });

assert.equal(
  normalApprove.status,
  "ACCEPT_WITH_USER_APPROVAL"
);

const normalReject =
  decideCurtainCutMaterial({
    selectedPleat: "NORMAL",
    requiredMeters: 8.4,
    availableMeters: 7,
    minimumReusableRemnantMeters: 1
  });

assert.equal(
  normalReject.status,
  "SUPPLY_REQUIRED"
);

console.log(
  "[PASS] tight 9.30/9.30 exact"
);
console.log(
  "[PASS] tight 9.30/8.70 -> effective x2.90 -> user approval"
);
console.log(
  "[PASS] tight 9.30/7.00 -> effective x2.33 -> supply required"
);
console.log(
  "[PASS] normal 8.40/9.00 with 0.60 remnant -> whole 9.00 goes to production"
);
console.log(
  "[PASS] small remnant is not written as fire and not kept as micro-lot"
);
console.log(
  "[PASS] meaningful 2.60 remnant remains inventory"
);
console.log(
  "[PASS] curtainCutMaterialDecisionSuite completed"
);