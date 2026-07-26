import type {
  SalesSyncActor,
  SalesSyncMutation
} from "@/lib/salesSyncApiContract";
import {
  canActorUseSalesSync,
  validateSalesSyncBatch
} from "@/lib/salesSyncApiContract";

export interface SalesSyncRouteDecision {
  status: 400 | 401 | 403 | 501 | 503;
  code:
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "FEATURE_DISABLED"
    | "INVALID_REQUEST"
    | "WRITE_PATH_NOT_IMPLEMENTED";
  errors?: string[];
}

export function isSalesSyncFeatureEnabled(
  value: string | undefined
): boolean {
  return value === "true";
}

export function decideSalesSyncRoute(
  actor: SalesSyncActor | null | undefined,
  featureEnabled: boolean,
  mutations: SalesSyncMutation[] | null
): SalesSyncRouteDecision {
  if (!actor) {
    return {
      status: 401,
      code: "UNAUTHORIZED"
    };
  }

  if (!canActorUseSalesSync(actor)) {
    return {
      status: 403,
      code: "FORBIDDEN"
    };
  }

  if (!featureEnabled) {
    return {
      status: 503,
      code: "FEATURE_DISABLED"
    };
  }

  if (!Array.isArray(mutations)) {
    return {
      status: 400,
      code: "INVALID_REQUEST",
      errors: ["MUTATIONS_ARRAY_REQUIRED"]
    };
  }

  const validation =
    validateSalesSyncBatch(actor, mutations);
  const errors = validation.flatMap(result =>
    result.valid ? [] : result.errors
  );

  if (errors.length > 0) {
    return {
      status: 400,
      code: "INVALID_REQUEST",
      errors: [...new Set(errors)]
    };
  }

  return {
    status: 501,
    code: "WRITE_PATH_NOT_IMPLEMENTED"
  };
}
