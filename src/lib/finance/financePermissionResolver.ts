import type { FinancePermission } from "./financeAccessPolicy";
import {
  FINANCE_PERMISSION_ORDER,
  getFinanceRoleDefaults,
  isFinancePermission,
} from "./financeRoleDefaults";

export const CURRENT_FINANCE_PERMISSION_VERSION = 1;
export const LEGACY_FINANCE_PERMISSION_VERSION = 0;

export interface FinancePermissionResolverInput {
  role: string | null | undefined;
  storedPermissions?: readonly unknown[] | null;
  financePermissionGrants?: readonly unknown[] | null;
  financePermissionDenies?: readonly unknown[] | null;
  permissionVersion: number;
  expectedPermissionVersion: number;
  applyRoleDefaults?: boolean;
}

export interface FinancePermissionResolution {
  effectivePermissions: FinancePermission[];
  inheritedPermissions: FinancePermission[];
  grantedPermissions: FinancePermission[];
  deniedPermissions: FinancePermission[];
  invalidPermissions: string[];
  permissionVersion: number;
  versionMatches: boolean;
  issues: string[];
}

function splitPermissions(values: readonly unknown[] | null | undefined): {
  valid: FinancePermission[];
  invalid: string[];
} {
  const valid = new Set<FinancePermission>();
  const invalid = new Set<string>();

  for (const value of values || []) {
    if (isFinancePermission(value)) {
      valid.add(value);
    } else if (typeof value === "string" && value.trim()) {
      invalid.add(value);
    }
  }

  return {
    valid: sortPermissions(valid),
    invalid: [...invalid].sort(),
  };
}

function sortPermissions(
  permissions: Iterable<FinancePermission>,
): FinancePermission[] {
  const values = new Set(permissions);
  return FINANCE_PERMISSION_ORDER.filter((permission) =>
    values.has(permission),
  );
}

export function resolveFinancePermissions(
  input: FinancePermissionResolverInput,
): FinancePermissionResolution {
  const roleIsKnown =
    getFinanceRoleDefaults(input.role).length > 0 ||
    [
      "MODERATOR",
      "FIELD",
      "TAILOR",
      "INSTALLER",
      "PLATFORM_SUPER_ADMIN",
    ].includes(String(input.role || ""));
  const applyRoleDefaults = input.applyRoleDefaults !== false;
  const inheritedPermissions = applyRoleDefaults
    ? [...getFinanceRoleDefaults(input.role)]
    : [];
  const stored = splitPermissions(input.storedPermissions);
  const grants = splitPermissions(input.financePermissionGrants);
  const denies = splitPermissions(input.financePermissionDenies);
  const grantedPermissions = sortPermissions([
    ...stored.valid,
    ...grants.valid,
  ]);
  const deniedSet = new Set(denies.valid);
  const versionMatches =
    input.permissionVersion === input.expectedPermissionVersion;
  const issues: string[] = [];

  if (!roleIsKnown) {
    issues.push("UNKNOWN_ROLE");
  }
  if (input.role === "PLATFORM_SUPER_ADMIN") {
    issues.push("PLATFORM_ROLE_FINANCE_DENIED");
  }
  if (!applyRoleDefaults) {
    issues.push("ROLE_DEFAULTS_DISABLED_FOR_LEGACY_USER");
  }
  if (stored.invalid.length || grants.invalid.length || denies.invalid.length) {
    issues.push("INVALID_PERMISSION");
  }
  if (!versionMatches) {
    issues.push("PERMISSION_VERSION_MISMATCH");
  }

  const effectivePermissions =
    versionMatches &&
    roleIsKnown &&
    input.role !== "PLATFORM_SUPER_ADMIN"
    ? sortPermissions(
        [...inheritedPermissions, ...grantedPermissions].filter(
          (permission) => !deniedSet.has(permission),
        ),
      )
    : [];

  return {
    effectivePermissions,
    inheritedPermissions: sortPermissions(inheritedPermissions),
    grantedPermissions,
    deniedPermissions: sortPermissions(deniedSet),
    invalidPermissions: [
      ...new Set([
        ...stored.invalid,
        ...grants.invalid,
        ...denies.invalid,
      ]),
    ].sort(),
    permissionVersion: input.permissionVersion,
    versionMatches,
    issues,
  };
}
