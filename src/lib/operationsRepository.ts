import type { ErpScope } from "./erpScope";
import {
  buildAgendaEvent,
  decideOperationCreation,
  decideOperationTransition,
  type AgendaEvent,
  type OperationRecord,
  type OperationStatus
} from "./operationsWorkflow";

export interface OperationsStateData {
  operations: OperationRecord[];
  agendaEvents: AgendaEvent[];
}

export interface OperationActor {
  userId: string;
  role: string;
}

export type SaveOperationResult =
  | {
      outcome: "CREATED";
      state: OperationsStateData;
      operation: OperationRecord;
    }
  | {
      outcome: "REPLAY";
      state: OperationsStateData;
      operation: OperationRecord;
    }
  | {
      outcome: "REJECTED";
      state: OperationsStateData;
      reason:
        | "INVALID_REQUEST"
        | "IDEMPOTENCY_CONFLICT"
        | "DUPLICATE_ACTIVE_OPERATION";
    };

export type UpdateOperationStatusResult =
  | {
      outcome: "UPDATED";
      state: OperationsStateData;
      operation: OperationRecord;
    }
  | {
      outcome: "NOT_FOUND";
      state: OperationsStateData;
    }
  | {
      outcome: "REJECTED";
      state: OperationsStateData;
      reason:
        | "ROLE_FORBIDDEN"
        | "ASSIGNMENT_REQUIRED"
        | "INVALID_TRANSITION"
        | "TERMINAL_STATUS_LOCKED";
    };

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

function replaceAgendaEvent(
  events: readonly AgendaEvent[],
  nextEvent: AgendaEvent
): AgendaEvent[] {
  return [
    ...events.filter(
      event => event.operationId !== nextEvent.operationId
    ),
    nextEvent
  ];
}

export function saveOperationRecord(
  state: OperationsStateData,
  request: OperationRecord
): SaveOperationResult {
  const decision = decideOperationCreation(
    request,
    state.operations
  );

  if (decision.outcome === "REJECT") {
    return {
      outcome: "REJECTED",
      state,
      reason: decision.reason
    };
  }

  if (decision.outcome === "REPLAY") {
    return {
      outcome: "REPLAY",
      state,
      operation: decision.operation
    };
  }

  return {
    outcome: "CREATED",
    operation: decision.operation,
    state: {
      operations: [
        ...state.operations,
        decision.operation
      ],
      agendaEvents: replaceAgendaEvent(
        state.agendaEvents,
        decision.agenda
      )
    }
  };
}

export function updateOperationRecordStatus(
  state: OperationsStateData,
  operationId: string,
  target: OperationStatus,
  actor: OperationActor,
  occurredAt: string
): UpdateOperationStatusResult {
  const current = state.operations.find(
    operation => operation.id === operationId
  );

  if (!current) {
    return {
      outcome: "NOT_FOUND",
      state
    };
  }

  const decision = decideOperationTransition(
    current,
    target,
    actor,
    occurredAt
  );

  if (!decision.allowed) {
    return {
      outcome: "REJECTED",
      state,
      reason: decision.reason
    };
  }

  return {
    outcome: "UPDATED",
    operation: decision.operation,
    state: {
      operations: state.operations.map(
        operation =>
          operation.id === operationId
            ? decision.operation
            : operation
      ),
      agendaEvents: replaceAgendaEvent(
        state.agendaEvents,
        decision.agenda
      )
    }
  };
}

export function rebuildAgendaEvents(
  operations: readonly OperationRecord[]
): AgendaEvent[] {
  return operations.map(buildAgendaEvent);
}

export function listScopedOperations(
  state: OperationsStateData,
  scope: ErpScope
): OperationRecord[] {
  return state.operations
    .filter(operation => sameScope(operation, scope))
    .sort((left, right) =>
      left.dueAt.localeCompare(right.dueAt)
    );
}

export function listScopedAgendaEvents(
  state: OperationsStateData,
  scope: ErpScope
): AgendaEvent[] {
  return state.agendaEvents
    .filter(event => sameScope(event, scope))
    .sort((left, right) =>
      left.startsAt.localeCompare(right.startsAt)
    );
}

export function listVisibleOperationsForUser(
  state: OperationsStateData,
  scope: ErpScope,
  actor: OperationActor
): OperationRecord[] {
  const role = actor.role.trim().toUpperCase();

  const manager =
    role === "COMPANY_ADMIN" ||
    role === "ADMIN" ||
    role === "OFFICE" ||
    role === "MODERATOR";

  return listScopedOperations(state, scope).filter(
    operation =>
      manager ||
      operation.party?.id === actor.userId
  );
}