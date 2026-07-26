import assert from "node:assert/strict";
import {
  compareShadowFeatureAccess,
  currentRoleAllowsFeature,
  ERP_FEATURES,
  normalizeShadowAccessRole,
  parseShadowAccessRole,
} from "../src/lib/shadowFeatureAccess";

assert.equal(ERP_FEATURES.length, 16);
assert.equal(normalizeShadowAccessRole("SALES"), "OFFICE");
assert.equal(normalizeShadowAccessRole("MEASUREMENT"), "FIELD");
assert.equal(normalizeShadowAccessRole("PRODUCTION"), "TAILOR");
assert.equal(normalizeShadowAccessRole("INSTALLATION"), "INSTALLER");
assert.equal(parseShadowAccessRole(" sales "), "SALES");
assert.equal(parseShadowAccessRole("UNKNOWN"), null);

assert.equal(currentRoleAllowsFeature("FIELD", "measurement"), true);
assert.equal(currentRoleAllowsFeature("FIELD", "sales"), false);
assert.equal(currentRoleAllowsFeature("TAILOR", "tailorWorkOrders"), true);
assert.equal(currentRoleAllowsFeature("TAILOR", "tailorPayroll"), false);
assert.equal(currentRoleAllowsFeature("INSTALLER", "installerTasks"), true);
assert.equal(currentRoleAllowsFeature("ACCOUNTING", "basicFinance"), true);
assert.equal(currentRoleAllowsFeature("ACCOUNTING", "measurement"), false);

const plusOffice = compareShadowFeatureAccess({
  role: "OFFICE",
  package: "PLUS",
});
assert.equal(plusOffice.every((item) => !item.differs), true);

const ecoOffice = compareShadowFeatureAccess({
  role: "OFFICE",
  package: "ECO",
});
assert.deepEqual(
  ecoOffice
    .filter((item) => item.differs)
    .map((item) => [item.feature, item.shadowDecision]),
  [
    [
      "customerFinance",
      { allowed: false, reason: "PACKAGE_LICENSE_DENIED" },
    ],
  ]
);

const overriddenOffice = compareShadowFeatureAccess({
  role: "OFFICE",
  package: "PLUS",
  featureOverrides: {
    sales: false,
    measurement: "false",
  },
});
assert.deepEqual(
  overriddenOffice
    .filter((item) => item.differs)
    .map((item) => [item.feature, item.shadowDecision]),
  [["sales", { allowed: false, reason: "USER_DENIED" }]]
);

console.log("[PASS] shadow feature access comparison");
