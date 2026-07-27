import assert from "node:assert/strict";
import {
  decideFinanceAccess,
  type FinanceAccessRequest,
} from "../src/lib/finance/financeAccessPolicy";
import type { ErpScope } from "../src/lib/erpScope";

const scope: ErpScope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
};

function request(
  overrides: Partial<FinanceAccessRequest> = {},
): FinanceAccessRequest {
  return {
    packageType: "NORMAL",
    permissions: ["customerFinance.view"],
    scope,
    requestedCapability: "CUSTOMER_FINANCE",
    financeContext: { scope },
    ...overrides,
  };
}

const allowed = decideFinanceAccess(request());
assert.equal(allowed.allowed, true);
assert.equal(allowed.reasonCode, "ALLOWED");
assert.equal(allowed.requiredPermission, "customerFinance.view");
assert.equal(allowed.requiredFeature, "customerFinance");

const permissionDenied = decideFinanceAccess(request({ permissions: [] }));
assert.equal(permissionDenied.allowed, false);
assert.equal(permissionDenied.reasonCode, "PERMISSION_DENIED");

const packageDenied = decideFinanceAccess(
  request({ packageType: "ECO" }),
);
assert.equal(packageDenied.allowed, false);
assert.equal(packageDenied.reasonCode, "PACKAGE_FEATURE_DENIED");

const ecoBasic = decideFinanceAccess(
  request({
    packageType: "ECO",
    permissions: ["finance.view"],
    requestedCapability: "BASIC_FINANCE",
  }),
);
assert.equal(ecoBasic.allowed, true);
assert.equal(ecoBasic.requiredFeature, "basicFinance");

const ecoCustomer = decideFinanceAccess(
  request({ packageType: "ECO" }),
);
assert.equal(ecoCustomer.allowed, false);

assert.equal(
  decideFinanceAccess(request({ packageType: "NORMAL" })).allowed,
  true,
);
assert.equal(
  decideFinanceAccess(request({ packageType: "PLUS" })).allowed,
  true,
);

const noAdminBypass = decideFinanceAccess(
  request({
    packageType: "PLUS",
    permissions: [],
  }),
);
assert.equal(noAdminBypass.allowed, false);
assert.equal(noAdminBypass.reasonCode, "PERMISSION_DENIED");

const missingScope = decideFinanceAccess(
  request({
    scope: { ...scope, branchId: "" },
  }),
);
assert.equal(missingScope.allowed, false);
assert.equal(missingScope.reasonCode, "MISSING_SCOPE");
assert.deepEqual(
  missingScope.evaluatedScope.missingActorScopeFields,
  ["branchId"],
);

const scopeDenied = decideFinanceAccess(
  request({
    financeContext: {
      scope: { ...scope, accountingPeriodId: "period-2" },
    },
  }),
);
assert.equal(scopeDenied.allowed, false);
assert.equal(scopeDenied.reasonCode, "SCOPE_DENIED");

assert.deepEqual(decideFinanceAccess(request()), decideFinanceAccess(request()));

console.log("[PASS] finance access policy (10 required scenarios)");
