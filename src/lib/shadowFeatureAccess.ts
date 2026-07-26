import {
  decideFeatureAccess,
  type ErpFeature,
  type ErpPackage,
  type FeatureAccessDecision,
} from "./packageFeatures";

export type ShadowAccessRole =
  | "ADMIN"
  | "MODERATOR"
  | "OFFICE"
  | "FIELD"
  | "TAILOR"
  | "INSTALLER"
  | "ACCOUNTING";

export type ShadowAccessRoleInput =
  | ShadowAccessRole
  | "SALES"
  | "MEASUREMENT"
  | "PRODUCTION"
  | "INSTALLATION";

export interface ShadowFeatureComparison {
  feature: ErpFeature;
  currentAllows: boolean;
  shadowDecision: FeatureAccessDecision;
  differs: boolean;
}

export const ERP_FEATURES: readonly ErpFeature[] = [
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

export function normalizeShadowAccessRole(
  role: ShadowAccessRoleInput
): ShadowAccessRole {
  if (role === "SALES") return "OFFICE";
  if (role === "MEASUREMENT") return "FIELD";
  if (role === "PRODUCTION") return "TAILOR";
  if (role === "INSTALLATION") return "INSTALLER";
  return role;
}

export function parseShadowAccessRole(
  role: string
): ShadowAccessRoleInput | null {
  const normalized = role.trim().toUpperCase();
  const supportedRoles: readonly string[] = [
    "ADMIN",
    "MODERATOR",
    "OFFICE",
    "SALES",
    "FIELD",
    "MEASUREMENT",
    "TAILOR",
    "PRODUCTION",
    "INSTALLER",
    "INSTALLATION",
    "ACCOUNTING",
  ];

  return supportedRoles.includes(normalized)
    ? (normalized as ShadowAccessRoleInput)
    : null;
}

export function currentRoleAllowsFeature(
  roleInput: ShadowAccessRoleInput,
  feature: ErpFeature
): boolean {
  const role = normalizeShadowAccessRole(roleInput);

  if (role === "ADMIN" || role === "MODERATOR") return true;

  if (role === "OFFICE") {
    return (
      feature === "measurement" ||
      feature === "sales" ||
      feature === "basicFinance" ||
      feature === "customerFinance"
    );
  }

  if (role === "FIELD") {
    return feature === "measurement";
  }

  if (role === "TAILOR") {
    return feature === "tailorWorkOrders";
  }

  if (role === "INSTALLER") {
    return feature === "installerTasks";
  }

  if (role === "ACCOUNTING") {
    return feature === "basicFinance" || feature === "customerFinance";
  }

  return false;
}

function readFeatureOverride(
  overrides: Record<string, unknown>,
  feature: ErpFeature
): boolean | undefined {
  const value = overrides[feature];
  return typeof value === "boolean" ? value : undefined;
}

export function compareShadowFeatureAccess(input: {
  role: ShadowAccessRoleInput;
  package: ErpPackage;
  featureOverrides?: Record<string, unknown>;
}): ShadowFeatureComparison[] {
  const overrides = input.featureOverrides ?? {};

  return ERP_FEATURES.map((feature) => {
    const currentAllows = currentRoleAllowsFeature(input.role, feature);
    const shadowDecision = decideFeatureAccess({
      package: input.package,
      feature,
      roleAllows: currentAllows,
      userAllows: readFeatureOverride(overrides, feature),
    });

    return {
      feature,
      currentAllows,
      shadowDecision,
      differs: currentAllows !== shadowDecision.allowed,
    };
  });
}
