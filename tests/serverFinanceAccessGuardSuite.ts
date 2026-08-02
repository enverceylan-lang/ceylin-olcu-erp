import assert from "node:assert/strict";
import {
  guardServerFinanceChannelAccess,
  guardServerFinanceAccess,
  type ServerFinanceChannelAccessGuardInput,
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
    packageType: "PRO",
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
      packageType: "PRO",
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

function channelRequest(
  overrides: Partial<ServerFinanceChannelAccessGuardInput> = {},
): ServerFinanceChannelAccessGuardInput {
  return {
    authenticatedUser: {
      id: "office-1",
      role: "OFFICE",
      permissionVersion: 1,
      sessionPermissionVersion: 1,
    },
    channel: "CASH",
    operation: "COLLECTION",
    direction: "CREATE",
    requestedPermission: "finance.cash.collection.create",
    packageType: "PRO",
    actorScope: scope,
    resourceScope: scope,
    customerId: "customer-1",
    ...overrides,
  };
}

assert.equal(guardServerFinanceChannelAccess(channelRequest()).allowed, true);
assert.equal(
  guardServerFinanceChannelAccess(
    channelRequest({
      operation: "PAYMENT",
      requestedPermission: "finance.cash.payment.create",
    }),
  ).allowed,
  false,
);
assert.equal(
  guardServerFinanceChannelAccess(
    channelRequest({
      channel: "BANK",
      requestedPermission: "finance.bank.collection.create",
    }),
  ).allowed,
  true,
);
assert.equal(
  guardServerFinanceChannelAccess(
    channelRequest({
      channel: "BANK",
      operation: "PAYMENT",
      requestedPermission: "finance.bank.payment.create",
    }),
  ).allowed,
  false,
);
assert.equal(
  guardServerFinanceChannelAccess(
    channelRequest({
      channel: "POS",
      requestedPermission: "finance.pos.collection.create",
    }),
  ).allowed,
  true,
);
assert.equal(
  guardServerFinanceChannelAccess(
    channelRequest({
      channel: "POS",
      operation: "REFUND",
      requestedPermission: "finance.pos.refund.create",
    }),
  ).allowed,
  false,
);
assert.equal(
  guardServerFinanceChannelAccess(
    channelRequest({
      resourceScope: { ...scope, branchId: "branch-2" },
    }),
  ).allowed,
  false,
);
assert.equal(
  guardServerFinanceChannelAccess(
    channelRequest({ packageType: "ECO" }),
  ).reasonCode,
  "PACKAGE_FEATURE_DENIED",
);
assert.equal(
  guardServerFinanceChannelAccess(
    channelRequest({
      authenticatedUser: {
        id: "field-1",
        role: "FIELD",
        storedPermissions: ["finance.collection.create"],
        permissionVersion: 1,
        sessionPermissionVersion: 1,
      },
    }),
  ).allowed,
  false,
);
assert.equal(
  guardServerFinanceChannelAccess(
    channelRequest({
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
  guardServerFinanceChannelAccess(
    channelRequest({
      authenticatedUser: {
        id: "platform-1",
        role: "PLATFORM_SUPER_ADMIN",
        financePermissionGrants: ["finance.cash.collection.create"],
        permissionVersion: 1,
        sessionPermissionVersion: 1,
      },
    }),
  ).allowed,
  false,
);
const channelDenied = guardServerFinanceChannelAccess(
  channelRequest({
    authenticatedUser: {
      id: "field-1",
      role: "FIELD",
      permissionVersion: 1,
      sessionPermissionVersion: 1,
    },
  }),
);
assert.equal("financialData" in channelDenied, false);
for (const resourceScope of [
  { ...scope, tenantId: "tenant-2" },
  { ...scope, companyId: "company-2" },
  { ...scope, branchId: "branch-2" },
  { ...scope, accountingPeriodId: "period-2" },
]) {
  assert.equal(
    guardServerFinanceChannelAccess(
      channelRequest({ resourceScope }),
    ).allowed,
    false,
  );
}

console.log("[PASS] server finance access guard (Aşama 5 + 16 channel scenarios)");
