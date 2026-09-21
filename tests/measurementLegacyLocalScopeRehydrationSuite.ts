import assert from "node:assert/strict";
import fs from "node:fs";

const store = fs.readFileSync("src/store/useStore.ts", "utf8");
const scope = fs.readFileSync("src/lib/customerTreeScope.ts", "utf8");
const localMeasurement = fs.readFileSync(
  "src/lib/localMeasurementDb.ts",
  "utf8",
);

assert.match(store, /loadVerifiedClientErpScope/);
assert.doesNotMatch(store, /activeMeasurementScope/);
assert.doesNotMatch(store, /requiresLegacyScopeRehydrate/);
assert.doesNotMatch(
  store,
  /saveLocalCustomerWithoutSync\(rehydratedCustomer\)/,
);
assert.doesNotMatch(
  store,
  /inheritConsistentErpScope\([\s\S]*activeMeasurementScope/,
);
assert.match(store, /MEASUREMENT_CUSTOMER_SCOPE_MISSING/);
assert.match(
  store,
  /optionalScopeConflicts\(targetRoom, customerScope\)/,
);
assert.match(scope, /export function stripErpScope/);
assert.match(scope, /export function normalizeCustomerOwnershipTree/);
assert.match(localMeasurement, /resolveMeasurementOwnerScope/);
assert.match(
  localMeasurement,
  /MEASUREMENT_CUSTOMER_SCOPE_MISSING/,
);
assert.match(localMeasurement, /stripErpScope/);

console.log("PAK_MEASUREMENT_ROOT_OWNERSHIP_NO_SESSION_REHYDRATE_V1");
