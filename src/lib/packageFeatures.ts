export type ErpPackage = "ECO" | "NORMAL" | "PLUS";

export type ErpFeature =
  | "measurement"
  | "sales"
  | "basicFinance"
  | "customerFinance"
  | "stockTracking"
  | "stockLots"
  | "storeCutOrders"
  | "supplierOrders"
  | "advancedCutOptimization"
  | "tailorWorkOrders"
  | "tailorPayroll"
  | "installerTasks"
  | "installerPayroll"
  | "multiBranch"
  | "multiWarehouse"
  | "capacityPlanning"
  | "operations"
  | "agenda"
  | "operationPdf"
  | "operationWhatsApp";

export type PackageFeatureMap = Record<ErpFeature, boolean>;

const ECO_FEATURES: PackageFeatureMap = {
  measurement: true,
  sales: true,
  basicFinance: true,
  customerFinance: false,
  stockTracking: false,
  stockLots: false,
  storeCutOrders: false,
  supplierOrders: false,
  advancedCutOptimization: false,
  tailorWorkOrders: true,
  tailorPayroll: false,
  installerTasks: true,
  installerPayroll: false,
  multiBranch: false,
  multiWarehouse: false,
  capacityPlanning: false,
  operations: false,
  agenda: false,
  operationPdf: false,
  operationWhatsApp: false,
};

const NORMAL_FEATURES: PackageFeatureMap = {
  ...ECO_FEATURES,
  customerFinance: true,
  stockTracking: true,
  stockLots: true,
  storeCutOrders: true,
  supplierOrders: true,
  tailorPayroll: true,
  installerPayroll: true,
  operations: true,
  agenda: true,
  operationPdf: true,
  operationWhatsApp: true,
};

const PLUS_FEATURES: PackageFeatureMap = {
  ...NORMAL_FEATURES,
  advancedCutOptimization: true,
  multiBranch: true,
  multiWarehouse: true,
  capacityPlanning: true,
};

export const PACKAGE_FEATURES: Record<ErpPackage, PackageFeatureMap> = {
  ECO: ECO_FEATURES,
  NORMAL: NORMAL_FEATURES,
  PLUS: PLUS_FEATURES,
};

export type ErpRecordScope = ErpScope;

export interface FeatureAccessRequest {
  package: ErpPackage;
  feature: ErpFeature;
  roleAllows: boolean;
  userAllows?: boolean;
  actorScope?: ErpRecordScope;
  recordScope?: ErpRecordScope;
  ownershipRequired?: boolean;
  actorUserId?: string;
  ownerUserId?: string;
  assignedUserId?: string;
}

export type FeatureAccessDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "PACKAGE_LICENSE_DENIED"
        | "ROLE_DENIED"
        | "USER_DENIED"
        | "SCOPE_DENIED"
        | "OWNERSHIP_DENIED";
    };

export function hasPackageFeature(
  erpPackage: ErpPackage,
  feature: ErpFeature
): boolean {
  return PACKAGE_FEATURES[erpPackage][feature];
}

export function recordScopeMatches(
  actorScope: ErpRecordScope,
  recordScope: ErpRecordScope
): boolean {
  return erpScopeMatches(actorScope, recordScope);
}

export function decideFeatureAccess(
  request: FeatureAccessRequest
): FeatureAccessDecision {
  if (!hasPackageFeature(request.package, request.feature)) {
    return { allowed: false, reason: "PACKAGE_LICENSE_DENIED" };
  }
  if (!request.roleAllows) {
    return { allowed: false, reason: "ROLE_DENIED" };
  }
  if (request.userAllows === false) {
    return { allowed: false, reason: "USER_DENIED" };
  }
  if (
    request.recordScope &&
    (!request.actorScope ||
      !recordScopeMatches(request.actorScope, request.recordScope))
  ) {
    return { allowed: false, reason: "SCOPE_DENIED" };
  }
  if (
    request.ownershipRequired &&
    (!request.actorUserId ||
      (request.actorUserId !== request.ownerUserId &&
        request.actorUserId !== request.assignedUserId))
  ) {
    return { allowed: false, reason: "OWNERSHIP_DENIED" };
  }
  return { allowed: true };
}

export type ErpPackageInput =
  | ErpPackage
  | "STANDARD";

export function normalizeErpPackage(
  value: string | null | undefined
): ErpPackage | null {
  const normalized =
    value?.trim().toUpperCase();

  if (normalized === "STANDARD") {
    return "NORMAL";
  }

  if (
    normalized === "ECO" ||
    normalized === "NORMAL" ||
    normalized === "PLUS"
  ) {
    return normalized;
  }

  return null;
}

export function getPackageDisplayLabel(
  value: string | null | undefined
): "ECO" | "STANDARD" | "PLUS" | "PAKET TANIMSIZ" {
  const normalized =
    normalizeErpPackage(value);

  if (normalized === "NORMAL") {
    return "STANDARD";
  }

  if (normalized === "ECO") {
    return "ECO";
  }

  if (normalized === "PLUS") {
    return "PLUS";
  }

  return "PAKET TANIMSIZ";
}

export function packageInputHasFeature(
  packageValue: string | null | undefined,
  feature: ErpFeature
): boolean {
  const normalized =
    normalizeErpPackage(packageValue);

  if (!normalized) {
    return false;
  }

  return hasPackageFeature(
    normalized,
    feature
  );
}
import {
  erpScopeMatches,
  type ErpScope,
} from "./erpScope";
