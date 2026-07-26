import { approvedRoleAllowsFeature } from "./approvedAccessPolicy";
import {
  decideFeatureAccess,
  type ErpPackage,
} from "./packageFeatures";
import {
  decideRolloutAccess,
  resolvePackageEnforcementMode,
  type PackageEnforcementMode,
  type RolloutAccessDecision,
} from "./packageEnforcementRollout";
import {
  currentRoleAllowsFeature,
  parseShadowAccessRole,
} from "./shadowFeatureAccess";

export type MeasurementPilotResult =
  | {
      configured: true;
      feature: "measurement";
      mode: PackageEnforcementMode;
      decision: RolloutAccessDecision;
    }
  | {
      configured: false;
      feature: "measurement";
      mode: PackageEnforcementMode;
      reason: "UNSUPPORTED_ROLE";
    };

export function buildMeasurementPilotAccess(input: {
  authenticatedRole: string;
  package: ErpPackage;
  featureOverrides?: Record<string, unknown>;
  rawMode?: string;
}): MeasurementPilotResult {
  const mode = resolvePackageEnforcementMode(input.rawMode);
  const role = parseShadowAccessRole(input.authenticatedRole);

  if (!role) {
    return {
      configured: false,
      feature: "measurement",
      mode,
      reason: "UNSUPPORTED_ROLE",
    };
  }

  const override = input.featureOverrides?.measurement;
  const packageDecision = decideFeatureAccess({
    package: input.package,
    feature: "measurement",
    roleAllows: approvedRoleAllowsFeature(role, "measurement"),
    userAllows: typeof override === "boolean" ? override : undefined,
  });

  return {
    configured: true,
    feature: "measurement",
    mode,
    decision: decideRolloutAccess({
      mode,
      feature: "measurement",
      pilotFeatures: ["measurement"],
      currentAllows: currentRoleAllowsFeature(role, "measurement"),
      packageDecision,
      businessDecisionsResolved: true,
    }),
  };
}
