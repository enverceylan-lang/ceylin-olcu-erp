import assert from "node:assert/strict";
import {
  ACCESS_POLICY_APPROVAL,
  approvedRoleAllowsFeature,
  APPROVED_ROLE_CAPABILITIES,
  getApprovedRoleCapabilities,
} from "../src/lib/approvedAccessPolicy";

assert.equal(ACCESS_POLICY_APPROVAL.status, "APPROVED");
assert.equal(ACCESS_POLICY_APPROVAL.pendingDecisionCount, 0);
assert.equal(Object.keys(APPROVED_ROLE_CAPABILITIES).length, 7);

assert.equal(approvedRoleAllowsFeature("ADMIN", "capacityPlanning"), true);
assert.equal(
  getApprovedRoleCapabilities("ADMIN").canManagePackageLicense,
  true
);

assert.equal(
  getApprovedRoleCapabilities("MODERATOR").scopeAccess,
  "SELECT_ASSIGNED"
);
assert.equal(
  getApprovedRoleCapabilities("MODERATOR").canManageSystemSettings,
  false
);
assert.equal(
  getApprovedRoleCapabilities("OFFICE").canManagePackageLicense,
  false
);

for (const feature of [
  "operations",
  "agenda",
  "operationPdf",
  "operationWhatsApp",
] as const) {
  assert.equal(approvedRoleAllowsFeature("ADMIN", feature), true);
  assert.equal(approvedRoleAllowsFeature("MODERATOR", feature), true);
  assert.equal(approvedRoleAllowsFeature("OFFICE", feature), false);
  assert.equal(approvedRoleAllowsFeature("FIELD", feature), false);
  assert.equal(approvedRoleAllowsFeature("TAILOR", feature), false);
  assert.equal(approvedRoleAllowsFeature("INSTALLER", feature), false);
  assert.equal(approvedRoleAllowsFeature("ACCOUNTING", feature), false);
}

assert.equal(
  getApprovedRoleCapabilities("OFFICE").features.length,
  16
);

assert.equal(approvedRoleAllowsFeature("FIELD", "measurement"), true);
assert.equal(approvedRoleAllowsFeature("FIELD", "sales"), false);
assert.equal(
  getApprovedRoleCapabilities("FIELD")
    .assignmentRequiredForOperationalTasks,
  true
);

assert.equal(approvedRoleAllowsFeature("TAILOR", "tailorWorkOrders"), true);
assert.equal(approvedRoleAllowsFeature("TAILOR", "tailorPayroll"), true);
assert.equal(getApprovedRoleCapabilities("TAILOR").canViewOwnPayroll, true);
assert.equal(
  getApprovedRoleCapabilities("TAILOR").canEditPayrollRules,
  false
);

assert.equal(approvedRoleAllowsFeature("INSTALLER", "installerTasks"), true);
assert.equal(approvedRoleAllowsFeature("INSTALLER", "installerPayroll"), true);
assert.equal(
  getApprovedRoleCapabilities("INSTALLER").canViewOwnPayroll,
  true
);

assert.equal(
  approvedRoleAllowsFeature("ACCOUNTING", "basicFinance"),
  true
);
assert.equal(
  approvedRoleAllowsFeature("ACCOUNTING", "customerFinance"),
  true
);
assert.equal(approvedRoleAllowsFeature("ACCOUNTING", "sales"), false);
assert.equal(
  getApprovedRoleCapabilities("ACCOUNTING").scopeAccess,
  "DEFAULT_ONLY"
);

assert.equal(
  getApprovedRoleCapabilities("SALES"),
  getApprovedRoleCapabilities("OFFICE")
);
assert.equal(
  getApprovedRoleCapabilities("PRODUCTION"),
  getApprovedRoleCapabilities("TAILOR")
);

console.log("[PASS] approved access policy contract");
