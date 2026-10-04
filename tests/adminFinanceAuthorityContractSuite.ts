import assert from "node:assert/strict";
import {
  normalizeUser,
} from "../src/store/useAuthStore";
import {
  FINANCE_PERMISSION_ORDER,
} from "../src/lib/finance/financeRoleDefaults";

function assertHasAllFinancePermissions(
  permissions: readonly string[] | undefined,
  label: string,
): void {
  const values = new Set(permissions || []);

  for (const permission of FINANCE_PERMISSION_ORDER) {
    assert.equal(
      values.has(permission),
      true,
      `${label} must include ${permission}`,
    );
  }
}

const adminWithLegacyModulePermissions = normalizeUser({
  id: "admin-finance-authority",
  username: "admin",
  role: "ADMIN",
  isActive: true,
  permissions: ["dashboard", "cariler", "ayarlar"],
});

assertHasAllFinancePermissions(
  adminWithLegacyModulePermissions.permissions,
  "ADMIN",
);

assert.equal(
  adminWithLegacyModulePermissions.permissions?.includes("dashboard"),
  true,
  "ADMIN legacy module permissions must be preserved",
);

const companyAdminWithLegacyModulePermissions = normalizeUser({
  id: "company-admin-finance-authority",
  username: "company-admin",
  role: "COMPANY_ADMIN",
  isActive: true,
  permissions: ["dashboard", "cariler"],
});

assertHasAllFinancePermissions(
  companyAdminWithLegacyModulePermissions.permissions,
  "COMPANY_ADMIN",
);

const officeWithExplicitPermissions = normalizeUser({
  id: "office-finance-authority",
  username: "office",
  role: "OFFICE",
  isActive: true,
  permissions: ["dashboard", "finance.cash.collection.create"],
});

assert.equal(
  officeWithExplicitPermissions.permissions?.includes(
    "finance.cash.collection.create",
  ),
  true,
  "non-admin explicit finance permission must be preserved",
);

assert.equal(
  officeWithExplicitPermissions.permissions?.includes(
    "finance.account.manage",
  ),
  false,
  "non-admin must not inherit ADMIN finance authority",
);

console.log(
  "[PASS] adminFinanceAuthorityContractSuite: ADMIN full finance authority normalization",
);