import assert from "node:assert/strict";
import {
  resolveFinancePermissions,
  type FinancePermissionResolverInput,
} from "../src/lib/finance/financePermissionResolver";

function resolve(
  overrides: Partial<FinancePermissionResolverInput> = {},
) {
  return resolveFinancePermissions({
    role: "OFFICE",
    storedPermissions: [],
    financePermissionGrants: [],
    financePermissionDenies: [],
    permissionVersion: 1,
    expectedPermissionVersion: 1,
    ...overrides,
  });
}

assert.equal(resolve().inheritedPermissions.includes("finance.view"), true);
assert.equal(
  resolve({ financePermissionGrants: ["finance.cheque.view"] })
    .effectivePermissions.includes("finance.cheque.view"),
  true,
);
assert.equal(
  resolve({ financePermissionDenies: ["finance.view"] })
    .effectivePermissions.includes("finance.view"),
  false,
);
assert.equal(
  resolve({
    financePermissionGrants: ["finance.payment.create"],
    financePermissionDenies: ["finance.payment.create"],
  }).effectivePermissions.includes("finance.payment.create"),
  false,
);
assert.equal(
  resolve({
    financePermissionGrants: ["finance.view", "finance.view"],
  }).effectivePermissions.filter((value) => value === "finance.view").length,
  1,
);
const invalid = resolve({ financePermissionGrants: ["unknown.permission"] });
assert.deepEqual(invalid.invalidPermissions, ["unknown.permission"]);
assert.equal(invalid.issues.includes("INVALID_PERMISSION"), true);
assert.equal(resolve({ storedPermissions: undefined }).versionMatches, true);
assert.deepEqual(
  resolve({ role: "UNKNOWN", storedPermissions: undefined })
    .effectivePermissions,
  [],
);
const grants = ["finance.cheque.view"];
const denies = ["finance.view"];
resolve({ financePermissionGrants: grants, financePermissionDenies: denies });
assert.deepEqual(grants, ["finance.cheque.view"]);
assert.deepEqual(denies, ["finance.view"]);
assert.deepEqual(resolve(), resolve());
assert.equal(resolve().versionMatches, true);
const mismatch = resolve({ expectedPermissionVersion: 2 });
assert.equal(mismatch.versionMatches, false);
assert.deepEqual(mismatch.effectivePermissions, []);
assert.deepEqual(
  resolve({
    role: "FIELD",
    storedPermissions: ["finance.report.view", "dashboard"],
    applyRoleDefaults: false,
  }).effectivePermissions,
  ["finance.report.view"],
);
assert.deepEqual(resolve({ role: "PLATFORM_SUPER_ADMIN" }).effectivePermissions, []);
assert.deepEqual(
  resolve({
    role: "PLATFORM_SUPER_ADMIN",
    financePermissionGrants: ["finance.view"],
  }).effectivePermissions,
  [],
);
assert.equal(
  resolve({ role: "COMPANY_ADMIN" }).effectivePermissions.length > 0,
  true,
);

console.log("[PASS] finance permission resolver (15 required scenarios)");
