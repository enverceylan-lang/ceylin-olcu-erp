import {
  approvedRoleAllowsFeature,
  getApprovedRoleCapabilities,
} from "./approvedAccessPolicy";
import type { ErpScope } from "./erpScope";
import {
  decideFeatureAccess,
  type ErpPackage,
} from "./packageFeatures";
import {
  decideRolloutAccess,
  resolvePackageEnforcementMode,
  type RolloutAccessDecision,
} from "./packageEnforcementRollout";
import {
  currentRoleAllowsFeature,
  parseShadowAccessRole,
} from "./shadowFeatureAccess";

export type MeasurementRecordPilotDecision =
  | {
      configured: true;
      mode: "shadow" | "pilot" | "full";
      decision: RolloutAccessDecision;
    }
  | {
      configured: false;
      mode: "shadow" | "pilot" | "full";
      reason: "UNSUPPORTED_ROLE";
    };

export function decideMeasurementRecordPilotAccess(input: {
  authenticatedRole: string;
  package: ErpPackage;
  rawMode?: string;
  featureOverrides?: Record<string, unknown>;
  actorScope?: ErpScope;
  recordScope?: ErpScope;
  actorUserId?: string;
  ownerUserId?: string;
  assignedUserId?: string;
}): MeasurementRecordPilotDecision {
  const mode = resolvePackageEnforcementMode(input.rawMode);
  const role = parseShadowAccessRole(input.authenticatedRole);

  if (!role) {
    return {
      configured: false,
      mode,
      reason: "UNSUPPORTED_ROLE",
    };
  }

  const capabilities = getApprovedRoleCapabilities(role);
  const rawOverride = input.featureOverrides?.measurement;
  const packageDecision = decideFeatureAccess({
    package: input.package,
    feature: "measurement",
    roleAllows: approvedRoleAllowsFeature(role, "measurement"),
    userAllows:
      typeof rawOverride === "boolean" ? rawOverride : undefined,
    actorScope: input.actorScope,
    recordScope: input.recordScope,
    ownershipRequired:
      capabilities.assignmentRequiredForOperationalTasks,
    actorUserId: input.actorUserId,
    ownerUserId: input.ownerUserId,
    assignedUserId: input.assignedUserId,
  });

  return {
    configured: true,
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
