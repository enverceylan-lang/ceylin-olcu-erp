import type { FinancePermission } from "./financeAccessPolicy";
import {
  isFinancePermission,
} from "./financeRoleDefaults";
import {
  isKnownFinanceLikePermission,
} from "./financePermissionCatalog";

export type FinancePermissionUpdateResult =
  | {
      ok: true;
      permissions: string[];
      selectedFinancePermissions: FinancePermission[];
    }
  | {
      ok: false;
      code: "INVALID_PERMISSION_PAYLOAD" | "UNKNOWN_FINANCE_PERMISSION" | "PLATFORM_FINANCE_DENIED";
      invalidPermissions: string[];
    };

export function mergeSelectedFinancePermissions(input: {
  existingPermissions: readonly unknown[] | null | undefined;
  selectedFinancePermissions: unknown;
  targetRole: string;
}): FinancePermissionUpdateResult {
  if (!Array.isArray(input.selectedFinancePermissions)) {
    return {
      ok: false,
      code: "INVALID_PERMISSION_PAYLOAD",
      invalidPermissions: [],
    };
  }

  const invalidPermissions = [
    ...new Set(
      input.selectedFinancePermissions
        .filter((permission) => !isFinancePermission(permission))
        .map((permission) => String(permission)),
    ),
  ].sort();

  if (invalidPermissions.length > 0) {
    return {
      ok: false,
      code: invalidPermissions.some(isKnownFinanceLikePermission)
        ? "UNKNOWN_FINANCE_PERMISSION"
        : "INVALID_PERMISSION_PAYLOAD",
      invalidPermissions,
    };
  }

  const selectedFinancePermissions = [
    ...new Set(
      input.selectedFinancePermissions as FinancePermission[],
    ),
  ];

  if (
    input.targetRole === "PLATFORM_SUPER_ADMIN" &&
    selectedFinancePermissions.length > 0
  ) {
    return {
      ok: false,
      code: "PLATFORM_FINANCE_DENIED",
      invalidPermissions: selectedFinancePermissions,
    };
  }

  const preservedPermissions = [
    ...new Set(
      (input.existingPermissions || [])
        .filter((permission) => !isFinancePermission(permission))
        .map((permission) => String(permission)),
    ),
  ];

  return {
    ok: true,
    permissions: [
      ...preservedPermissions,
      ...selectedFinancePermissions,
    ],
    selectedFinancePermissions,
  };
}
