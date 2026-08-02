import assert from "node:assert/strict";
import {
  resolveShadowErpContext,
  type PackageLicenseRow,
  type UserScopeRow,
} from "../src/lib/serverErpContext";

const now = new Date("2026-07-26T12:00:00.000Z");
const scopeRow: UserScopeRow = {
  tenant_id: "tenant-uuid",
  company_id: "company-uuid",
  branch_id: "branch-uuid",
  accounting_period_id: "period-uuid",
  is_default: true,
  is_active: true,
};
const licenseRow: PackageLicenseRow = {
  package_code: "PLUS",
  starts_at: "2026-01-01T00:00:00.000Z",
  ends_at: null,
  is_active: true,
  feature_overrides: {},
};

assert.deepEqual(
  resolveShadowErpContext({
    scopeRow: null,
    licenseRow: null,
    now,
  }),
  { ready: false, reason: "USER_SCOPE_NOT_FOUND" }
);

assert.deepEqual(
  resolveShadowErpContext({
    scopeRow: { ...scopeRow, branch_id: "" },
    licenseRow,
    now,
  }),
  { ready: false, reason: "USER_SCOPE_INVALID" }
);

assert.deepEqual(
  resolveShadowErpContext({
    scopeRow,
    licenseRow: null,
    now,
  }),
  { ready: false, reason: "LICENSE_NOT_FOUND" }
);

assert.deepEqual(
  resolveShadowErpContext({
    scopeRow,
    licenseRow: {
      ...licenseRow,
      package_code: "UNKNOWN",
    },
    now,
  }),
  { ready: false, reason: "LICENSE_INVALID" }
);

assert.deepEqual(
  resolveShadowErpContext({
    scopeRow,
    licenseRow: {
      ...licenseRow,
      ends_at: "2026-07-25T23:59:59.000Z",
    },
    now,
  }),
  { ready: false, reason: "LICENSE_INVALID" }
);

assert.deepEqual(
  resolveShadowErpContext({
    scopeRow,
    licenseRow,
    now,
  }),
  {
    ready: true,
    scope: {
      tenantId: "tenant-uuid",
      companyId: "company-uuid",
      branchId: "branch-uuid",
      accountingPeriodId: "period-uuid",
    },
    package: "PLUS",
    featureOverrides: {},
  }
);

assert.deepEqual(
  resolveShadowErpContext({
    scopeRow: { ...scopeRow, is_default: false },
    licenseRow,
    now,
    requireDefault: false,
  }),
  {
    ready: true,
    scope: {
      tenantId: "tenant-uuid",
      companyId: "company-uuid",
      branchId: "branch-uuid",
      accountingPeriodId: "period-uuid",
    },
    package: "PLUS",
    featureOverrides: {},
  }
);


assert.deepEqual(
  resolveShadowErpContext({
    scopeRow,
    licenseRow: {
      ...licenseRow,
      package_code: "NORMAL",
    },
    now,
  }),
  {
    ready: true,
    scope: {
      tenantId: "tenant-uuid",
      companyId: "company-uuid",
      branchId: "branch-uuid",
      accountingPeriodId: "period-uuid",
    },
    package: "PRO",
    featureOverrides: {},
  }
);
console.log("[PASS] server ERP shadow context");
