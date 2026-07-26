import type {
  ProductionItem
} from "@/store/useStore";

export type ProductionWorkflowStatus =
  | "WAITING_MATERIAL"
  | "WAITING_FACTORY"
  | "READY_FOR_CUTTING"
  | "CUT"
  | "SEWING"
  | "SEWN"
  | "IRONING"
  | "PACKAGING"
  | "READY"
  | "PROBLEM"
  | "REWORK"
  | "CANCELLED";

export type ProductionTransitionResult =
  | {
      allowed: true;
      changes: Partial<ProductionItem>;
    }
  | {
      allowed: false;
      reason:
        | "CUT_REQUIRED"
        | "SEWING_REQUIRED"
        | "IRONING_REQUIRED"
        | "PACKAGING_REQUIRED"
        | "ALREADY_COMPLETED"
        | "CANCELLED_ITEM_LOCKED"
        | "STATUS_INVALID";
    };

export interface ProductionTransitionActor {
  userId: string;
  role: string;
}

export type AuthorizedProductionTransitionResult =
  | ProductionTransitionResult
  | {
      allowed: false;
      reason:
        | "ROLE_FORBIDDEN"
        | "ASSIGNMENT_REQUIRED"
        | "STATUS_FORBIDDEN_FOR_TAILOR";
    };

const TAILOR_ALLOWED_TARGETS = new Set([
  "CUT",
  "SEWN",
  "IRONING",
  "PACKAGING",
  "READY",
  "PROBLEM",
  "REWORK",
]);

export function getAuthorizedProductionTransition(
  item: ProductionItem,
  targetStatus: string,
  actor: ProductionTransitionActor
): AuthorizedProductionTransitionResult {
  const role = actor.role.trim().toLowerCase();

  if (role === "tailor") {
    if (!item.assignedEmployeeId || item.assignedEmployeeId !== actor.userId) {
      return { allowed: false, reason: "ASSIGNMENT_REQUIRED" };
    }
    if (!TAILOR_ALLOWED_TARGETS.has(targetStatus)) {
      return {
        allowed: false,
        reason: "STATUS_FORBIDDEN_FOR_TAILOR",
      };
    }
  } else if (role !== "admin" && role !== "office") {
    return { allowed: false, reason: "ROLE_FORBIDDEN" };
  }

  return getProductionTransition(item, targetStatus);
}

export function getProductionTransition(
  item: ProductionItem,
  targetStatus: string
): ProductionTransitionResult {
  if (item.productionStatus === "CANCELLED") {
    return {
      allowed: false,
      reason: "CANCELLED_ITEM_LOCKED"
    };
  }

  switch (targetStatus as ProductionWorkflowStatus) {
    case "CUT":
      if (item.cutCompleted) {
        return {
          allowed: false,
          reason: "ALREADY_COMPLETED"
        };
      }
      return {
        allowed: true,
        changes: {
          productionStatus: "CUT",
          cutCompleted: true
        }
      };

    case "SEWN":
      if (!item.cutCompleted) {
        return {
          allowed: false,
          reason: "CUT_REQUIRED"
        };
      }
      if (item.sewingCompleted) {
        return {
          allowed: false,
          reason: "ALREADY_COMPLETED"
        };
      }
      return {
        allowed: true,
        changes: {
          productionStatus: "SEWN",
          sewingCompleted: true
        }
      };

    case "IRONING":
      if (!item.sewingCompleted) {
        return {
          allowed: false,
          reason: "SEWING_REQUIRED"
        };
      }
      if (item.ironingCompleted) {
        return {
          allowed: false,
          reason: "ALREADY_COMPLETED"
        };
      }
      return {
        allowed: true,
        changes: {
          productionStatus: "IRONING",
          ironingCompleted: true
        }
      };

    case "PACKAGING":
      if (!item.ironingCompleted) {
        return {
          allowed: false,
          reason: "IRONING_REQUIRED"
        };
      }
      if (item.packagingCompleted) {
        return {
          allowed: false,
          reason: "ALREADY_COMPLETED"
        };
      }
      return {
        allowed: true,
        changes: {
          productionStatus: "PACKAGING",
          packagingCompleted: true
        }
      };

    case "READY":
      if (!item.packagingCompleted) {
        return {
          allowed: false,
          reason: "PACKAGING_REQUIRED"
        };
      }
      if (item.productionStatus === "READY") {
        return {
          allowed: false,
          reason: "ALREADY_COMPLETED"
        };
      }
      return {
        allowed: true,
        changes: {
          productionStatus: "READY",
          cutCompleted: true,
          sewingCompleted: true,
          ironingCompleted: true,
          packagingCompleted: true
        }
      };

    case "WAITING_MATERIAL":
    case "WAITING_FACTORY":
    case "PROBLEM":
    case "REWORK":
      return {
        allowed: true,
        changes: {
          productionStatus: targetStatus
        }
      };

    default:
      return {
        allowed: false,
        reason: "STATUS_INVALID"
      };
  }
}
