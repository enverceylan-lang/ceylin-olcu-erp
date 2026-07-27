import assert from "node:assert/strict";
import {
  guardServerFinanceAccess,
  type ServerFinanceAccessGuardInput,
} from "../src/lib/serverFinanceAccessGuard";
import type { ErpScope } from "../src/lib/erpScope";

const scope: ErpScope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
};

function request(
  overrides: Partial<ServerFinanceAccessGuardInput> = {},
): ServerFinanceAccessGuardInput {
  return {
    authenticatedUser: {
      id: "office-1",
      role: "OFFICE",
      permissionVersion: 1,
      sessionPermissionVersion: 1,
    },
    requestedPermission: "finance.collection.create",
    requestedCapability: "COLLECTION_CREATE",
    packageType: "NORMAL",
    actorScope: scope,
    resourceScope: scope,
    customerId: "customer-1",
    ...overrides,
  };
}

assert.equal(guardServerFinanceAccess(request()).allowed, true);
assert.equal(
  guardServerFinanceAccess(
    request({
      authenticatedUser: {
        id: "field-1",
        role: "FIELD",
        permissionVersion: 1,
        sessionPermissionVersion: 1,
      },
    }),
  ).reasonCode,
  "PERMISSION_DENIED",
);
assert.equal(
  guardServerFinanceAccess(
    request({
      requestedPermission: "customerFinance.view",
      requestedCapability: "CUSTOMER_FINANCE",
      packageType: "ECO",
    }),
  ).reasonCode,
  "PACKAGE_FEATURE_DENIED",
);
assert.equal(
  guardServerFinanceAccess(
    request({ resourceScope: { ...scope, branchId: "branch-2" } }),
  ).reasonCode,
  "SCOPE_DENIED",
);
assert.equal(
  guardServerFinanceAccess(
    request({ actorScope: { ...scope, branchId: "" } }),
  ).reasonCode,
  "MISSING_SCOPE",
);
assert.equal(
  guardServerFinanceAccess(
    request({
      authenticatedUser: {
        id: "office-1",
        role: "OFFICE",
        permissionVersion: 2,
        sessionPermissionVersion: 1,
      },
    }),
  ).reasonCode,
  "PERMISSION_VERSION_MISMATCH",
);
assert.equal(
  guardServerFinanceAccess(
    request({
      authenticatedUser: {
        id: "admin-1",
        role: "ADMIN",
        permissionVersion: 1,
        sessionPermissionVersion: 1,
        applyRoleDefaults: false,
      },
    }),
  ).allowed,
  false,
);
assert.equal(
  guardServerFinanceAccess(
    request({
      authenticatedUser: {
        id: "platform-1",
        role: "PLATFORM_SUPER_ADMIN",
        permissionVersion: 1,
        sessionPermissionVersion: 1,
      },
    }),
  ).allowed,
  false,
);
const denied = guardServerFinanceAccess(
  request({
    authenticatedUser: {
      id: "field-1",
      role: "FIELD",
      permissionVersion: 1,
      sessionPermissionVersion: 1,
    },
  }),
);
assert.equal("financialData" in denied, false);
assert.equal(
  guardServerFinanceAccess(
    request({
      requestedPermission: "customerFinance.view",
      requestedCapability: "CUSTOMER_FINANCE",
      resourceScope: { ...scope, companyId: "company-2" },
    }),
  ).allowed,
  false,
);
assert.equal(
  guardServerFinanceAccess(
    request({
      requestedPermission: "finance.payment.create",
      requestedCapability: "PAYMENT_CREATE",
    }),
  ).allowed,
  false,
);
assert.equal(guardServerFinanceAccess(request()).allowed, true);
assert.equal(
  guardServerFinanceAccess(
    request({
      requestedPermission: "customerFinance.view",
      requestedCapability: "CUSTOMER_FINANCE",
      packageType: "ECO",
    }),
  ).allowed,
  false,
);
assert.equal(
  guardServerFinanceAccess(
    request({
      requestedPermission: "customerFinance.view",
      requestedCapability: "CUSTOMER_FINANCE",
      packageType: "NORMAL",
    }),
  ).allowed,
  true,
);
assert.equal(
  guardServerFinanceAccess(
    request({
      requestedPermission: "customerFinance.view",
      requestedCapability: "CUSTOMER_FINANCE",
      packageType: "PLUS",
    }),
  ).allowed,
  true,
);

console.log("[PASS] server finance access guard (15 required scenarios)");
