import assert from "node:assert/strict";
import {
  buildShadowRoleInventory,
  PENDING_ACCESS_DECISIONS,
  SHADOW_INVENTORY_PACKAGES,
  SHADOW_INVENTORY_ROLES,
  summarizeShadowRoleInventory,
} from "../src/lib/shadowRoleInventory";

const rows = buildShadowRoleInventory();
const summary = summarizeShadowRoleInventory(rows);

assert.equal(SHADOW_INVENTORY_ROLES.length, 7);
assert.equal(SHADOW_INVENTORY_PACKAGES.length, 3);
assert.equal(rows.length, 7 * 3 * 16);
assert.equal(summary.rowCount, 336);
assert.equal(summary.byPackage.ECO.rowCount, 112);
assert.equal(summary.byPackage.NORMAL.rowCount, 112);
assert.equal(summary.byPackage.PLUS.rowCount, 112);
assert.equal(summary.byPackage.PLUS.differenceCount, 0);
assert.equal(summary.byPackage.ECO.differenceCount > 0, true);
assert.equal(summary.byPackage.NORMAL.differenceCount > 0, true);

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
