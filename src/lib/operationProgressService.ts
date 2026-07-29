import type {
  OperationRecord,
  OperationStatus
} from "./operationsWorkflow";
import {
  erpScopeMatches
} from "./erpScope";

export interface OperationProgressSummary {
  parentOperationId: string;
  total: number;
  completed: number;
  active: number;
  problem: number;
  cancelled: number;
  progressPercent: number;
  hasChildren: boolean;
  children: OperationRecord[];
}

function isActiveStatus(
  status: OperationStatus
): boolean {
  return (
    status !== "COMPLETED" &&
    status !== "CANCELLED"
  );
}

export function listChildOperations(
  parent: OperationRecord,
  operations: readonly OperationRecord[]
): OperationRecord[] {
  return operations
    .filter(
      operation =>
        operation.parentOperationId ===
          parent.id &&
        operation.saleId ===
          parent.saleId &&
        operation.kind !== "GENERAL" &&
        erpScopeMatches(
          operation,
          parent
        )
    )
    .sort(
      (left, right) =>
        left.dueAt.localeCompare(
          right.dueAt
        )
    );
}

export function buildOperationProgressSummary(
  parent: OperationRecord,
  operations: readonly OperationRecord[]
): OperationProgressSummary {
  const children =
    listChildOperations(
      parent,
      operations
    );

  const completed =
    children.filter(
      operation =>
        operation.status === "COMPLETED"
    ).length;

  const problem =
    children.filter(
      operation =>
        operation.status === "PROBLEM"
    ).length;

  const cancelled =
    children.filter(
      operation =>
        operation.status === "CANCELLED"
    ).length;

  const active =
    children.filter(
      operation =>
        isActiveStatus(
          operation.status
        )
    ).length;

  const countableTotal =
    children.length - cancelled;

  const progressPercent =
    countableTotal <= 0
      ? 0
      : Math.round(
          completed /
            countableTotal *
            100
        );

  return {
    parentOperationId:
      parent.id,

    total:
      children.length,

    completed,
    active,
    problem,
    cancelled,
    progressPercent,
    hasChildren:
      children.length > 0,
    children
  };
}