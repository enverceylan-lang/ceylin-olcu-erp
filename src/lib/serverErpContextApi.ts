import type { ShadowErpContextResult } from "./serverErpContext";
import {
  compareShadowFeatureAccess,
  parseShadowAccessRole,
  type ShadowFeatureComparison,
} from "./shadowFeatureAccess";
import {
  buildMeasurementPilotAccess,
  type MeasurementPilotResult,
} from "./measurementPilotAccess";

export interface ShadowAccessSummary {
  evaluatedFeatureCount: number;
  currentAllowedCount: number;
  shadowAllowedCount: number;
  differenceCount: number;
  differences: ShadowFeatureComparison[];
}

export interface ShadowErpContextApiResponse {
  status: 200 | 503;
  body:
    | {
        success: true;
        mode: "shadow";
        configured: true;
        context: Extract<ShadowErpContextResult, { ready: true }>;
        accessSummary?: ShadowAccessSummary;
        measurementPilot?: MeasurementPilotResult;
      }
    | {
        success: true;
        mode: "shadow";
        configured: false;
        reason:
          | "USER_SCOPE_NOT_FOUND"
          | "USER_SCOPE_INVALID"
          | "LICENSE_NOT_FOUND"
          | "LICENSE_INVALID";
      }
    | {
        success: false;
        mode: "shadow";
        error: "ERP_CONTEXT_READ_FAILED";
      };
}

export function buildShadowErpContextApiResponse(
  result: ShadowErpContextResult,
  authenticatedRole?: string,
  rawEnforcementMode?: string
): ShadowErpContextApiResponse {
  if (result.ready) {
    const role = authenticatedRole
      ? parseShadowAccessRole(authenticatedRole)
      : null;
    const comparisons = role
      ? compareShadowFeatureAccess({
          role,
          package: result.package,
          featureOverrides: result.featureOverrides,
        })
      : null;
    const accessSummary = comparisons
      ? {
          evaluatedFeatureCount: comparisons.length,
          currentAllowedCount: comparisons.filter(
            (item) => item.currentAllows
          ).length,
          shadowAllowedCount: comparisons.filter(
            (item) => item.shadowDecision.allowed
          ).length,
          differenceCount: comparisons.filter((item) => item.differs)
            .length,
          differences: comparisons.filter((item) => item.differs),
        }
      : undefined;
    const measurementPilot = authenticatedRole
      ? buildMeasurementPilotAccess({
          authenticatedRole,
          package: result.package,
          featureOverrides: result.featureOverrides,
          rawMode: rawEnforcementMode,
        })
      : undefined;

    return {
      status: 200,
      body: {
        success: true,
        mode: "shadow",
        configured: true,
        context: result,
        ...(accessSummary ? { accessSummary } : {}),
        ...(measurementPilot ? { measurementPilot } : {}),
      },
    };
  }

  if (result.reason === "READ_FAILED") {
    return {
      status: 503,
      body: {
        success: false,
        mode: "shadow",
        error: "ERP_CONTEXT_READ_FAILED",
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      mode: "shadow",
      configured: false,
      reason: result.reason,
    },
  };
}
