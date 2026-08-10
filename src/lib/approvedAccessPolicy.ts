import type { ErpFeature } from "./packageFeatures";
import {
  ERP_FEATURES,
  normalizeShadowAccessRole,
  type ShadowAccessRole,
  type ShadowAccessRoleInput,
} from "./shadowFeatureAccess";

export const ACCESS_POLICY_APPROVAL = {
  status: "APPROVED",
  approvedAt: "2026-07-26",
  pendingDecisionCount: 0,
} as const;

export type ScopeAccessMode =
  | "MANAGE_ALL"
  | "SELECT_ASSIGNED"
  | "DEFAULT_ONLY";

export interface ApprovedRoleCapabilities {
  features: readonly ErpFeature[];
  scopeAccess: ScopeAccessMode;
  canManageSystemSettings: boolean;
  canManagePackageLicense: boolean;
  canEditPayrollRules: boolean;
  canViewOwnPayroll: boolean;
  assignmentRequiredForOperationalTasks: boolean;
}

const ALL_FEATURES = [...ERP_FEATURES];

const OFFICE_FEATURES: readonly ErpFeature[] = [
  "measurement",
  "sales",
  "basicFinance",
  "customerFinance",
  "stockTracking",
  "stockLots",
  "storeCutOrders",
  "supplierOrders",
  "advancedCutOptimization",
  "tailorWorkOrders",
  "tailorPayroll",
  "installerTasks",
  "installerPayroll",
  "multiBranch",
  "multiWarehouse",
  "capacityPlanning",
];

export const APPROVED_ROLE_CAPABILITIES: Record<
  ShadowAccessRole,
  ApprovedRoleCapabilities
> = {
  ADMIN: {
    features: ALL_FEATURES,
    scopeAccess: "MANAGE_ALL",
    canManageSystemSettings: true,
    canManagePackageLicense: true,
    canEditPayrollRules: true,
    canViewOwnPayroll: true,
    assignmentRequiredForOperationalTasks: false,
  },
  MODERATOR: {
    features: ALL_FEATURES,
    scopeAccess: "SELECT_ASSIGNED",
    canManageSystemSettings: false,
    canManagePackageLicense: false,
    canEditPayrollRules: false,
    canViewOwnPayroll: false,
    assignmentRequiredForOperationalTasks: false,
  },
  OFFICE: {
    features: OFFICE_FEATURES,
    scopeAccess: "SELECT_ASSIGNED",
    canManageSystemSettings: false,
    canManagePackageLicense: false,
    canEditPayrollRules: false,
    canViewOwnPayroll: false,
    assignmentRequiredForOperationalTasks: false,
  },
  FIELD: {
    features: ["measurement"],
    scopeAccess: "DEFAULT_ONLY",
    canManageSystemSettings: false,
    canManagePackageLicense: false,
    canEditPayrollRules: false,
    canViewOwnPayroll: false,
    assignmentRequiredForOperationalTasks: true,
  },
  TAILOR: {
    features: ["tailorWorkOrders", "tailorPayroll"],
    scopeAccess: "DEFAULT_ONLY",
    canManageSystemSettings: false,
    canManagePackageLicense: false,
    canEditPayrollRules: false,
    canViewOwnPayroll: true,
    assignmentRequiredForOperationalTasks: true,
  },
  INSTALLER: {
    features: ["installerTasks", "installerPayroll"],
    scopeAccess: "DEFAULT_ONLY",
    canManageSystemSettings: false,
    canManagePackageLicense: false,
    canEditPayrollRules: false,
    canViewOwnPayroll: true,
    assignmentRequiredForOperationalTasks: true,
  },
  ACCOUNTING: {
    features: ["basicFinance", "customerFinance"],
    scopeAccess: "DEFAULT_ONLY",
    canManageSystemSettings: false,
    canManagePackageLicense: false,
    canEditPayrollRules: false,
    canViewOwnPayroll: false,
    assignmentRequiredForOperationalTasks: false,
  },
};

export function approvedRoleAllowsFeature(
  roleInput: ShadowAccessRoleInput,
  feature: ErpFeature
): boolean {
  const role = normalizeShadowAccessRole(roleInput);
  return APPROVED_ROLE_CAPABILITIES[role].features.includes(feature);
}

export function getApprovedRoleCapabilities(
  roleInput: ShadowAccessRoleInput
): ApprovedRoleCapabilities {
  return APPROVED_ROLE_CAPABILITIES[
    normalizeShadowAccessRole(roleInput)
  ];
}
