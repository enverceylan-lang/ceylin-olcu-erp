import type { ErpScope } from "./erpScope";
import type { OperationRecord } from "./operationsWorkflow";

export type InstallationScheduleConflictDecision =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      reason:
        | "SCHEDULE_CONFLICT"
        | "INVALID_EXISTING_SCHEDULE";
      conflictingOperationId: string;
    };

export interface InstallationScheduleConflictRequest
  extends ErpScope {
  partyId: string;
  scheduledAt: string;
  dueAt: string;
}

function sameScope(
  left: ErpScope,
  right: ErpScope
): boolean {
  return (
    left.tenantId === right.tenantId &&
    left.companyId === right.companyId &&
    left.branchId === right.branchId &&
    left.accountingPeriodId ===
      right.accountingPeriodId
  );
}

function isBlockingStatus(
  operation: OperationRecord
): boolean {
  return (
    operation.status !== "COMPLETED" &&
    operation.status !== "CANCELLED"
  );
}

export function decideInstallationScheduleConflict(
  request: InstallationScheduleConflictRequest,
  operations: readonly OperationRecord[]
): InstallationScheduleConflictDecision {
  const requestedStart =
    new Date(request.scheduledAt).getTime();

  const requestedEnd =
    new Date(request.dueAt).getTime();

  for (const operation of operations) {
    if (
      operation.kind !== "INSTALLATION" ||
      !isBlockingStatus(operation) ||
      !sameScope(operation, request) ||
      operation.party?.id !== request.partyId
    ) {
      continue;
    }

    const existingStart =
      new Date(operation.scheduledAt).getTime();

    const existingEnd =
      new Date(operation.dueAt).getTime();

    if (
      Number.isNaN(existingStart) ||
      Number.isNaN(existingEnd) ||
      existingEnd < existingStart
    ) {
      return {
        allowed: false,
        reason: "INVALID_EXISTING_SCHEDULE",
        conflictingOperationId: operation.id
      };
    }

    const overlaps =
      requestedStart < existingEnd &&
      existingStart < requestedEnd;

    if (overlaps) {
      return {
        allowed: false,
        reason: "SCHEDULE_CONFLICT",
        conflictingOperationId: operation.id
      };
    }
  }

  return {
    allowed: true
  };
}