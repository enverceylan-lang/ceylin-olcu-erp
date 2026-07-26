import type {
  ErpFeature,
  FeatureAccessDecision,
} from "./packageFeatures";

export type PackageEnforcementMode = "shadow" | "pilot" | "full";

export type RolloutDecisionReason =
  | "SHADOW_MODE_CURRENT_ACCESS"
  | "NOT_IN_PILOT_CURRENT_ACCESS"
  | "PENDING_BUSINESS_DECISIONS_CURRENT_ACCESS"
  | "PACKAGE_ENGINE_DECISION";

export interface RolloutAccessDecision {
  allowed: boolean;
  source: "current" | "package-engine";
  reason: RolloutDecisionReason;
}

export function resolvePackageEnforcementMode(
  rawValue: string | undefined
): PackageEnforcementMode {
  const normalized = String(rawValue || "")
    .trim()
    .toLowerCase();

  if (normalized === "pilot") return "pilot";
  if (normalized === "full") return "full";
  return "shadow";
}

export function decideRolloutAccess(input: {
  mode: PackageEnforcementMode;
  feature: ErpFeature;
  pilotFeatures: readonly ErpFeature[];
  currentAllows: boolean;
  packageDecision: FeatureAccessDecision;
  businessDecisionsResolved: boolean;
}): RolloutAccessDecision {
  if (input.mode === "shadow") {
    return {
      allowed: input.currentAllows,
      source: "current",
      reason: "SHADOW_MODE_CURRENT_ACCESS",
    };
  }

  if (
    input.mode === "pilot" &&
    !input.pilotFeatures.includes(input.feature)
  ) {
    return {
      allowed: input.currentAllows,
      source: "current",
      reason: "NOT_IN_PILOT_CURRENT_ACCESS",
    };
  }

  if (!input.businessDecisionsResolved) {
    return {
      allowed: input.currentAllows,
      source: "current",
      reason: "PENDING_BUSINESS_DECISIONS_CURRENT_ACCESS",
    };
  }

  return {
    allowed: input.packageDecision.allowed,
    source: "package-engine",
    reason: "PACKAGE_ENGINE_DECISION",
  };
}
