import assert from "node:assert/strict";
import {
  packageInputHasFeature,
  normalizeErpPackage,
  getPackageDisplayLabel,
  PACKAGE_FEATURES,
  decideFeatureAccess,
  hasPackageFeature,
  type ErpFeature,
  type ErpRecordScope,
} from "../src/lib/packageFeatures";

const allFeatures = Object.keys(PACKAGE_FEATURES.PLUS) as ErpFeature[];

assert.equal(hasPackageFeature("ECO", "measurement"), true);
assert.equal(hasPackageFeature("ECO", "sales"), true);
assert.equal(hasPackageFeature("ECO", "stockLots"), false);
assert.equal(hasPackageFeature("NORMAL", "stockLots"), true);
assert.equal(
  hasPackageFeature("NORMAL", "advancedCutOptimization"),
  false
);
assert.equal(hasPackageFeature("PLUS", "advancedCutOptimization"), true);

for (const feature of allFeatures) {
  if (PACKAGE_FEATURES.ECO[feature]) {
    assert.equal(
      PACKAGE_FEATURES.NORMAL[feature],
      true,
      `Normal paket Eco özelliğini kaybetti: ${feature}`
    );
  }
  if (PACKAGE_FEATURES.NORMAL[feature]) {
    assert.equal(
      PACKAGE_FEATURES.PLUS[feature],
      true,
      `Plus paket Normal özelliğini kaybetti: ${feature}`
    );
  }
}

const scope: ErpRecordScope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
};

const licenseDenied = decideFeatureAccess({
  package: "ECO",
  feature: "stockLots",
  roleAllows: true,
  userAllows: true,
});
assert.deepEqual(licenseDenied, {
  allowed: false,
  reason: "PACKAGE_LICENSE_DENIED",
});

const roleDenied = decideFeatureAccess({
  package: "NORMAL",
  feature: "stockLots",
  roleAllows: false,
  userAllows: true,
});
assert.deepEqual(roleDenied, { allowed: false, reason: "ROLE_DENIED" });

const userCannotOverrideRole = decideFeatureAccess({
  package: "PLUS",
  feature: "stockLots",
  roleAllows: false,
  userAllows: true,
});
assert.deepEqual(userCannotOverrideRole, {
  allowed: false,
  reason: "ROLE_DENIED",
});

const userDenied = decideFeatureAccess({
  package: "NORMAL",
  feature: "stockLots",
  roleAllows: true,
  userAllows: false,
});
assert.deepEqual(userDenied, { allowed: false, reason: "USER_DENIED" });

const scopeDenied = decideFeatureAccess({
  package: "NORMAL",
  feature: "stockLots",
  roleAllows: true,
  actorScope: scope,
  recordScope: { ...scope, branchId: "branch-2" },
});
assert.deepEqual(scopeDenied, { allowed: false, reason: "SCOPE_DENIED" });

const ownershipDenied = decideFeatureAccess({
  package: "NORMAL",
  feature: "tailorWorkOrders",
  roleAllows: true,
  actorScope: scope,
  recordScope: scope,
  ownershipRequired: true,
  actorUserId: "tailor-2",
  assignedUserId: "tailor-1",
});
assert.deepEqual(ownershipDenied, {
  allowed: false,
  reason: "OWNERSHIP_DENIED",
});

assert.deepEqual(
  decideFeatureAccess({
    package: "NORMAL",
    feature: "tailorWorkOrders",
    roleAllows: true,
    actorScope: scope,
    recordScope: scope,
    ownershipRequired: true,
    actorUserId: "tailor-1",
    assignedUserId: "tailor-1",
  }),
  { allowed: true }
);

console.log("[PASS] package features and access order");
assert.equal(
  normalizeErpPackage("STANDARD"),
  "NORMAL"
);

assert.equal(
  normalizeErpPackage("NORMAL"),
  "NORMAL"
);

assert.equal(
  getPackageDisplayLabel("NORMAL"),
  "STANDARD"
);

assert.equal(
  getPackageDisplayLabel("STANDARD"),
  "STANDARD"
);

assert.equal(
  packageInputHasFeature(
    "ECO",
    "operations"
  ),
  false
);

assert.equal(
  packageInputHasFeature(
    "NORMAL",
    "operations"
  ),
  true
);

assert.equal(
  packageInputHasFeature(
    "STANDARD",
    "agenda"
  ),
  true
);

assert.equal(
  packageInputHasFeature(
    "PLUS",
    "operationPdf"
  ),
  true
);

assert.equal(
  packageInputHasFeature(
    "PLUS",
    "operationWhatsApp"
  ),
  true
);

console.log(
  "PACKAGE_OPERATIONS_COMPAT_TEST: PAK"
);
