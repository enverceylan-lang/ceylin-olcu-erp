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

export interface ProviderMyWorkQuery {
  actor: ProviderWorkActor;
  link?: ProviderWorkLinkSnapshot;

  statuses?: OperationStatus[];
  includeCompleted?: boolean;
}

export interface ProviderMyWorkSummary {
  total: number;
  waiting: number;
  active: number;
  problem: number;
  completed: number;
  overdue: number;
}

export interface ProviderMyWorkResult {
  operations: OperationRecord[];
  summary:
    ProviderMyWorkSummary;
}

function isWaitingStatus(
  status: OperationStatus
): boolean {
  return (
    status === "DRAFT" ||
    status === "ASSIGNED" ||
    status === "SENT" ||
    status === "ACCEPTED"
  );
}

function isActiveStatus(
  status: OperationStatus
): boolean {
  return (
    status === "IN_PROGRESS"
  );
}

function isClosedStatus(
  status: OperationStatus
): boolean {
  return (
    status === "COMPLETED" ||
    status === "CANCELLED"
  );
}

export function listProviderMyWork(
  operations:
    readonly OperationRecord[],
  query:
    ProviderMyWorkQuery,
  referenceNow:
    string
): ProviderMyWorkResult {
  const now =
    new Date(referenceNow);

  const nowTime =
    Number.isNaN(
      now.getTime()
    )
      ? 0
      : now.getTime();

  const filtered =
    operations
      .filter(operation => {
        const decision =
          decideProviderWorkVisibility(
            query.actor,
            operation,
            query.link
          );

        if (!decision.visible) {
          return false;
        }

        if (
          query.statuses &&
          query.statuses.length > 0 &&
          !query.statuses.includes(
            operation.status
          )
        ) {
          return false;
        }

        if (
          !query.includeCompleted &&
          isClosedStatus(
            operation.status
          )
        ) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        const dueCompare =
          left.dueAt.localeCompare(
            right.dueAt
          );

        if (dueCompare !== 0) {
          return dueCompare;
        }

        return left.createdAt.localeCompare(
          right.createdAt
        );
      });

  const summary:
    ProviderMyWorkSummary = {
      total:
        filtered.length,

      waiting:
        filtered.filter(
          operation =>
            isWaitingStatus(
              operation.status
            )
        ).length,

      active:
        filtered.filter(
          operation =>
            isActiveStatus(
              operation.status
            )
        ).length,

      problem:
        filtered.filter(
          operation =>
            operation.status ===
            "PROBLEM"
        ).length,

      completed:
        filtered.filter(
          operation =>
            operation.status ===
            "COMPLETED"
        ).length,

      overdue:
        filtered.filter(operation => {
          if (
            isClosedStatus(
              operation.status
            )
          ) {
            return false;
          }

          const dueTime =
            new Date(
              operation.dueAt
            ).getTime();

          return (
            !Number.isNaN(dueTime) &&
            nowTime > 0 &&
            dueTime < nowTime
          );
        }).length
    };

  return {
    operations:
      filtered,

    summary
  };
}