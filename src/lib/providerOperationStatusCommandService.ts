import {
  buildAgendaEvent,
  type AgendaEvent,
  type OperationRecord,
  type OperationStatus
} from "./operationsWorkflow";
import type {
  OperationsStateData
} from "./operationsRepository";
import type {
  ProviderStatusAction
} from "./providerOperationStatusService";
import {
  decideProviderStatusTransition
} from "./providerOperationStatusService";
import type {
  ProviderWorkActor,
  ProviderWorkLinkSnapshot
} from "./providerAccountContracts";
import type {
  ProviderEarningsCurrency
} from "./providerEarningsViewService";

export interface ProviderOperationStatusAudit {
  id: string;
  operationId: string;

  previousStatus:
    OperationStatus;

  nextStatus:
    OperationStatus;

  changedByUserId:
    string;

  providerCustomerId:
    string;

  providerType:
    "TAILOR" | "INSTALLER";

  tenantId: string;
  companyId: string;
  branchId: string;
  accountingPeriodId: string;

  action:
    ProviderStatusAction;

  changedAt:
    string;

  problemDescription?:
    string;
}

export interface ProviderOperationStatusCommandRequest {
  actor:
    ProviderWorkActor;

  link?:
    ProviderWorkLinkSnapshot;

  operationId:
    string;

  action:
    ProviderStatusAction;

  occurredAt:
    string;

  problemDescription?:
    string;

  earningsCurrency?:
    ProviderEarningsCurrency;

  auditId:
    string;
}

export type ProviderOperationStatusCommandResult =
  | {
      outcome: "UPDATED";
      state:
        OperationsStateData;
      audit:
        ProviderOperationStatusAudit;
      operation:
        OperationRecord;
    }
  | {
      outcome: "REPLAY";
      state:
        OperationsStateData;
      operation:
        OperationRecord;
    }
  | {
      outcome: "NOT_FOUND";
      state:
        OperationsStateData;
    }
  | {
      outcome: "REJECTED";
      state:
        OperationsStateData;
      reason:
        string;
    };

function replaceAgendaEvent(
  events:
    readonly AgendaEvent[],
  nextEvent:
    AgendaEvent
): AgendaEvent[] {
  return [
    ...events.filter(
      event =>
        event.operationId !==
        nextEvent.operationId
    ),
    nextEvent
  ];
}

function appendProblemNote(
  operation:
    OperationRecord,
  description:
    string,
  occurredAt:
    string
): string {
  const previous =
    String(
      operation.notes || ""
    ).trim();

  const problemLine = [
    "[SORUN]",
    new Date(
      occurredAt
    ).toLocaleString("tr-TR"),
    description
  ].join(" ");

  if (!previous) {
    return problemLine;
  }

  return [
    previous,
    problemLine
  ].join("\n");
}

export function executeProviderOperationStatusCommand(
  state:
    OperationsStateData,
  request:
    ProviderOperationStatusCommandRequest
): ProviderOperationStatusCommandResult {
  const operation =
    state.operations.find(
      item =>
        item.id ===
        request.operationId
    );

  if (!operation) {
    return {
      outcome: "NOT_FOUND",
      state
    };
  }

  const decision =
    decideProviderStatusTransition({
      actor:
        request.actor,
      link:
        request.link,
      operation,
      action:
        request.action,
      problemDescription:
        request.problemDescription
    });

  if (
    decision.outcome ===
    "REPLAY"
  ) {
    return {
      outcome: "REPLAY",
      state,
      operation
    };
  }

  if (
    !decision.allowed ||
    !decision.targetStatus
  ) {
    return {
      outcome: "REJECTED",
      state,
      reason:
        decision.reason
    };
  }

  const nextStatus =
    decision.targetStatus;

  const nextOperation:
    OperationRecord = {
      ...operation,

      status:
        nextStatus,

      updatedAt:
        request.occurredAt,

      ...(nextStatus ===
      "COMPLETED"
        ? {
            completedAt:
              request.occurredAt
          }
        : {}),

      ...(request.action ===
      "REPORT_PROBLEM"
        ? {
            notes:
              appendProblemNote(
                operation,
                decision.normalizedProblemDescription ||
                  "",
                request.occurredAt
              )
          }
        : {})
  };

  const nextState:
    OperationsStateData = {
      operations:
        state.operations.map(
          item =>
            item.id ===
            nextOperation.id
              ? nextOperation
              : item
        ),

      agendaEvents:
        replaceAgendaEvent(
          state.agendaEvents,
          buildAgendaEvent(
            nextOperation
          )
        )
  };

  const stableLink =
    request.link as
      ProviderWorkLinkSnapshot;

  const audit:
    ProviderOperationStatusAudit = {
      id:
        request.auditId,

      operationId:
        operation.id,

      previousStatus:
        operation.status,

      nextStatus,

      changedByUserId:
        request.actor.userId,

      providerCustomerId:
        stableLink.providerCustomerId,

      providerType:
        stableLink.providerType,

      tenantId:
        operation.tenantId,

      companyId:
        operation.companyId,

      branchId:
        operation.branchId,

      accountingPeriodId:
        operation.accountingPeriodId,

      action:
        request.action,

      changedAt:
        request.occurredAt,

      ...(decision.normalizedProblemDescription
        ? {
            problemDescription:
              decision.normalizedProblemDescription
          }
        : {})
    };

  return {
    outcome: "UPDATED",
    state:
      nextState,
    audit,
    operation:
      nextOperation
  };
}