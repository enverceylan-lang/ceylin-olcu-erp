import {
  decideFinanceAccess,
  type EvaluatedFinanceScope,
  type FinanceAccessReasonCode,
  type FinanceCapability,
  type FinancePermission,
} from "./finance/financeAccessPolicy";
import {
  resolveFinancePermissions,
  type FinancePermissionResolution,
} from "./finance/financePermissionResolver";
import type { ErpPackage, ErpFeature } from "./packageFeatures";
import type { ErpScope } from "./erpScope";

export interface FinanceGuardUser {
  id: string;
  role: string;
  storedPermissions?: readonly unknown[] | null;
  financePermissionGrants?: readonly unknown[] | null;
  financePermissionDenies?: readonly unknown[] | null;
  permissionVersion: number;
  sessionPermissionVersion: number;
  applyRoleDefaults?: boolean;
}

export interface ServerFinanceAccessGuardInput {
  authenticatedUser: FinanceGuardUser | null;
  requestedPermission: FinancePermission;
  requestedCapability: FinanceCapability;
  packageType: ErpPackage;
  actorScope: ErpScope;
  resourceScope: ErpScope;
  customerId?: string;
  saleId?: string;
}

export type ServerFinanceAccessReasonCode =
  | FinanceAccessReasonCode
  | "UNAUTHENTICATED"
  | "PERMISSION_VERSION_MISMATCH"
  | "REQUIRED_PERMISSION_MISMATCH";

export interface ServerFinanceAccessGuardDecision {
  allowed: boolean;
  reasonCode: ServerFinanceAccessReasonCode;
  effectivePermissions: FinancePermission[];
  requiredPermission: FinancePermission;
  requiredFeature: ErpFeature | null;
  evaluatedScope: EvaluatedFinanceScope | null;
  permissionVersionValid: boolean;
}

function denied(
  reasonCode: ServerFinanceAccessReasonCode,
  requestedPermission: FinancePermission,
  resolution?: FinancePermissionResolution,
): ServerFinanceAccessGuardDecision {
  return {
    allowed: false,
    reasonCode,
    effectivePermissions: resolution?.effectivePermissions || [],
    requiredPermission: requestedPermission,
    requiredFeature: null,
    evaluatedScope: null,
    permissionVersionValid: resolution?.versionMatches || false,
  };
}

export function guardServerFinanceAccess(
  input: ServerFinanceAccessGuardInput,
): ServerFinanceAccessGuardDecision {
  if (!input.authenticatedUser) {
    return denied("UNAUTHENTICATED", input.requestedPermission);
  }

  const user = input.authenticatedUser;
  const resolution = resolveFinancePermissions({
    role: user.role,
    storedPermissions: user.storedPermissions,
    financePermissionGrants: user.financePermissionGrants,
    financePermissionDenies: user.financePermissionDenies,
    permissionVersion: user.permissionVersion,
    expectedPermissionVersion: user.sessionPermissionVersion,
    applyRoleDefaults: user.applyRoleDefaults,
  });

  if (!resolution.versionMatches) {
    return denied(
      "PERMISSION_VERSION_MISMATCH",
      input.requestedPermission,
      resolution,
    );
  }

  const access = decideFinanceAccess({
    packageType: input.packageType,
    permissions: resolution.effectivePermissions,
    scope: input.actorScope,
    requestedCapability: input.requestedCapability,
    financeContext: {
      scope: input.resourceScope,
      customerId: input.customerId,
      saleId: input.saleId,
    },
  });

  if (access.requiredPermission !== input.requestedPermission) {
    return {
      ...denied(
        "REQUIRED_PERMISSION_MISMATCH",
        access.requiredPermission,
        resolution,
      ),
      requiredFeature: access.requiredFeature,
      evaluatedScope: access.evaluatedScope,
      permissionVersionValid: true,
    };
  }

  return {
    allowed: access.allowed,
    reasonCode: access.reasonCode,
    effectivePermissions: resolution.effectivePermissions,
    requiredPermission: access.requiredPermission,
    requiredFeature: access.requiredFeature,
    evaluatedScope: access.evaluatedScope,
    permissionVersionValid: true,
  };
}
