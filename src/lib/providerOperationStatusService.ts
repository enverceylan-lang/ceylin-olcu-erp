import type {
  OperationRecord,
  OperationStatus
} from "./operationsWorkflow";
import type {
  ProviderWorkActor,
  ProviderWorkLinkSnapshot
} from "./providerAccountContracts";
import {
  decideProviderWorkVisibility
} from "./providerWorkVisibilityPolicy";

export type ProviderStatusAction =
  | "ACCEPT"
  | "START"
  | "REPORT_PROBLEM"
  | "RESUME"
  | "REPORT_COMPLETED";

export type ProviderStatusDecisionReason =
  | "ALLOWED"
  | "REPLAY"
  | "OPERATION_NOT_VISIBLE"
  | "TRANSITION_NOT_ALLOWED"
  | "PROBLEM_DESCRIPTION_REQUIRED"
  | "OPERATION_CANCELLED"
  | "OPERATION_COMPLETED";

export interface ProviderStatusTransitionRequest {
  actor: ProviderWorkActor;

  link?:
    ProviderWorkLinkSnapshot;

  operation:
    OperationRecord;

  action:
    ProviderStatusAction;

  problemDescription?:
    string;
}

export interface ProviderStatusTransitionDecision {
  allowed: boolean;

  outcome:
    | "ALLOWED"
    | "REJECTED"
    | "REPLAY";

  reason:
    ProviderStatusDecisionReason;

  previousStatus:
    OperationStatus;

  targetStatus:
    OperationStatus | null;

  normalizedProblemDescription?:
    string;
}

const ACTION_TARGETS: Record<
  ProviderStatusAction,
  OperationStatus
> = {
  ACCEPT: "ACCEPTED",
  START: "IN_PROGRESS",
  REPORT_PROBLEM: "PROBLEM",
  RESUME: "IN_PROGRESS",
  REPORT_COMPLETED: "COMPLETED"
};

function isAllowedTransition(
  previousStatus:
    OperationStatus,
  action:
    ProviderStatusAction
): boolean {
  if (
    action === "ACCEPT"
  ) {
    return (
      previousStatus === "ASSIGNED" ||
      previousStatus === "SENT"
    );
  }

  if (
    action === "START"
  ) {
    return (
      previousStatus === "ACCEPTED"
    );
  }

  if (
    action === "REPORT_PROBLEM"
  ) {
    return (
      previousStatus === "IN_PROGRESS"
    );
  }

  if (
    action === "RESUME"
  ) {
    return (
      previousStatus === "PROBLEM"
    );
  }

  if (
    action === "REPORT_COMPLETED"
  ) {
    return (
      previousStatus === "IN_PROGRESS"
    );
  }

  return false;
}

export function getProviderStatusActionLabel(
  action:
    ProviderStatusAction,
  providerType?:
    "TAILOR" | "INSTALLER"
): string {
  if (action === "ACCEPT") {
    return "İşi Kabul Et";
  }

  if (action === "START") {
    return providerType === "TAILOR"
      ? "Planlamaya Başla"
      : "İşe Başla";
  }

  if (
    action === "REPORT_PROBLEM"
  ) {
    return "Sorun Bildir";
  }

  if (action === "RESUME") {
    return "İşe Devam Et";
  }

  return "Tamamlandı Bildir";
}

export function listProviderStatusActions(
  status:
    OperationStatus
): ProviderStatusAction[] {
  if (
    status === "ASSIGNED" ||
    status === "SENT"
  ) {
    return ["ACCEPT"];
  }

  if (status === "ACCEPTED") {
    return ["START"];
  }

  if (
    status === "IN_PROGRESS"
  ) {
    return [
      "REPORT_PROBLEM",
      "REPORT_COMPLETED"
    ];
  }

  if (status === "PROBLEM") {
    return ["RESUME"];
  }

  return [];
}

export function decideProviderStatusTransition(
  request:
    ProviderStatusTransitionRequest
): ProviderStatusTransitionDecision {
  const previousStatus =
    request.operation.status;

  const targetStatus =
    ACTION_TARGETS[
      request.action
    ];

  const visibility =
    decideProviderWorkVisibility(
      request.actor,
      request.operation,
      request.link
    );

  if (!visibility.visible) {
    return {
      allowed: false,
      outcome: "REJECTED",
      reason:
        "OPERATION_NOT_VISIBLE",
      previousStatus,
      targetStatus
    };
  }

  if (
    previousStatus ===
    "CANCELLED"
  ) {
    return {
      allowed: false,
      outcome: "REJECTED",
      reason:
        "OPERATION_CANCELLED",
      previousStatus,
      targetStatus
    };
  }

  if (
    previousStatus ===
    "COMPLETED"
  ) {
    if (
      targetStatus ===
      "COMPLETED"
    ) {
      return {
        allowed: false,
        outcome: "REPLAY",
        reason: "REPLAY",
        previousStatus,
        targetStatus
      };
    }

    return {
      allowed: false,
      outcome: "REJECTED",
      reason:
        "OPERATION_COMPLETED",
      previousStatus,
      targetStatus
    };
  }

  if (
    previousStatus ===
    targetStatus
  ) {
    return {
      allowed: false,
      outcome: "REPLAY",
      reason: "REPLAY",
      previousStatus,
      targetStatus
    };
  }

  if (
    !isAllowedTransition(
      previousStatus,
      request.action
    )
  ) {
    return {
      allowed: false,
      outcome: "REJECTED",
      reason:
        "TRANSITION_NOT_ALLOWED",
      previousStatus,
      targetStatus
    };
  }

  if (
    request.action ===
    "REPORT_PROBLEM"
  ) {
    const description =
      String(
        request.problemDescription ||
        ""
      ).trim();

    if (!description) {
      return {
        allowed: false,
        outcome: "REJECTED",
        reason:
          "PROBLEM_DESCRIPTION_REQUIRED",
        previousStatus,
        targetStatus
      };
    }

    return {
      allowed: true,
      outcome: "ALLOWED",
      reason: "ALLOWED",
      previousStatus,
      targetStatus,
      normalizedProblemDescription:
        description
    };
  }

  return {
    allowed: true,
    outcome: "ALLOWED",
    reason: "ALLOWED",
    previousStatus,
    targetStatus
  };
}