import assert from "node:assert/strict";
import { ERP_FEATURES } from "../src/lib/shadowFeatureAccess";
import {
  buildShadowRoleInventory,
  PENDING_ACCESS_DECISIONS,
  SHADOW_INVENTORY_PACKAGES,
  SHADOW_INVENTORY_ROLES,
  summarizeShadowRoleInventory,
} from "../src/lib/shadowRoleInventory";

const rows = buildShadowRoleInventory();
const summary = summarizeShadowRoleInventory(rows);

const expectedRowsPerPackage =
  SHADOW_INVENTORY_ROLES.length * ERP_FEATURES.length;
const expectedRowCount =
  SHADOW_INVENTORY_PACKAGES.length * expectedRowsPerPackage;

assert.equal(SHADOW_INVENTORY_ROLES.length, 7);
assert.equal(SHADOW_INVENTORY_PACKAGES.length, 4);
assert.equal(rows.length, expectedRowCount);
assert.equal(summary.rowCount, rows.length);
assert.equal(summary.byPackage.ECO.rowCount, expectedRowsPerPackage);
assert.equal(summary.byPackage.PRO.rowCount, expectedRowsPerPackage);
assert.equal(summary.byPackage.PLUS.rowCount, expectedRowsPerPackage);
assert.equal(summary.byPackage.ELITE.rowCount, expectedRowsPerPackage);
assert.equal(summary.byPackage.PLUS.differenceCount, 0);
assert.equal(summary.byPackage.ECO.differenceCount > 0, true);
assert.equal(summary.byPackage.PRO.differenceCount > 0, true);

assert.equal(PENDING_ACCESS_DECISIONS.length, 6);
assert.equal(
  PENDING_ACCESS_DECISIONS.every(
    (decision) =>
      decision.status === "DECISION_REQUIRED" &&
      decision.safeDefault === "KEEP_CURRENT_ACCESS"
  ),
  true
);
assert.equal(
  new Set(PENDING_ACCESS_DECISIONS.map((decision) => decision.id)).size,
  PENDING_ACCESS_DECISIONS.length
);

console.log(
  `[PASS] shadow role inventory rows=${summary.rowCount} differences=${summary.differenceCount}`
);
