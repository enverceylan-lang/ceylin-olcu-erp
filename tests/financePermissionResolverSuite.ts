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
const cashCollectionOnly = resolve({
  role: "FIELD",
  financePermissionGrants: ["finance.cash.collection.create"],
});
assert.equal(
  cashCollectionOnly.effectivePermissions.includes(
    "finance.cash.collection.create",
  ),
  true,
);
assert.equal(
  cashCollectionOnly.effectivePermissions.includes(
    "finance.cash.payment.create",
  ),
  false,
);
assert.equal(
  resolve({
    role: "FIELD",
    financePermissionGrants: ["finance.bank.collection.create"],
  }).effectivePermissions.includes("finance.bank.payment.create"),
  false,
);
assert.equal(
  resolve({
    role: "FIELD",
    financePermissionGrants: ["finance.pos.collection.create"],
  }).effectivePermissions.includes("finance.pos.refund.create"),
  false,
);
const channelDeny = resolve({
  financePermissionDenies: ["finance.bank.payment.create"],
});
assert.equal(
  channelDeny.effectivePermissions.includes("finance.cash.collection.create"),
  true,
);
assert.equal(
  resolve({
    role: "FIELD",
    financePermissionGrants: ["finance.cash.collection.create"],
    financePermissionDenies: ["finance.cash.collection.create"],
  }).effectivePermissions.includes("finance.cash.collection.create"),
  false,
);
const legacyCollection = resolve({
  role: "FIELD",
  storedPermissions: ["finance.collection.create"],
});
assert.equal(
  legacyCollection.effectivePermissions.includes(
    "finance.cash.collection.create",
  ),
  false,
);
assert.deepEqual(legacyCollection.legacyPermissions, [
  "finance.collection.create",
]);
assert.equal(
  legacyCollection.issues.includes("LEGACY_FINANCE_PERMISSION_PRESENT"),
  true,
);
assert.equal(
  resolve({
    role: "FIELD",
    storedPermissions: ["finance.payment.create"],
  }).effectivePermissions.includes("finance.bank.payment.create"),
  false,
);

console.log("[PASS] finance permission resolver (Aşama 5 + 12 channel scenarios)");
