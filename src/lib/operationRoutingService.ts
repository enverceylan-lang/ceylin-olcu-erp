import type {
  AgendaEvent,
  OperationKind,
  OperationParty,
  OperationRecord
} from "./operationsWorkflow";
import {
  buildAgendaEvent
} from "./operationsWorkflow";
import {
  erpScopeMatches
} from "./erpScope";

export interface RouteChildOperationInput {
  parent: OperationRecord;
  kind: Exclude<
    OperationKind,
    "GENERAL"
  >;
  party?: OperationParty;
  supplierName?: string;
  supplierPhone?: string;
  scheduledAt: string;
  dueAt: string;
  notes?: string;
  createdByUserId: string;
  now: string;
}

export interface ChildOperationState {
  operations: OperationRecord[];
  agendaEvents: AgendaEvent[];
}

export type RouteChildOperationResult =
  | {
      outcome: "CREATED";
      state: ChildOperationState;
      operation: OperationRecord;
    }
  | {
      outcome: "REPLAY";
      state: ChildOperationState;
      operation: OperationRecord;
    }
  | {
      outcome: "REJECTED";
      state: ChildOperationState;
      reason:
        | "PARENT_MUST_BE_GENERAL"
        | "PARTY_REQUIRED"
        | "SUPPLIER_REQUIRED"
        | "INVALID_DATE_RANGE"
        | "ACTOR_REQUIRED";
    };

function createStableChildId(
  parentId: string,
  kind: Exclude<
    OperationKind,
    "GENERAL"
  >,
  partyId: string
): string {
  return [
    "child-operation",
    parentId,
    kind,
    partyId
  ].join(":");
}

function titleForKind(
  kind: Exclude<
    OperationKind,
    "GENERAL"
  >,
  parent: OperationRecord
): string {
  if (kind === "TAILOR") {
    return `Terzi İş Emri — ${parent.title}`;
  }

  if (kind === "SUPPLIER") {
    return `Tedarikçi Siparişi — ${parent.title}`;
  }

  return `Montaj İş Emri — ${parent.title}`;
}

function resolveParty(
  input: RouteChildOperationInput
): OperationParty | undefined {
  if (input.kind !== "SUPPLIER") {
    return input.party;
  }

  if (input.party) {
    return input.party;
  }

  const supplierName =
    input.supplierName?.trim() || "";

  if (!supplierName) {
    return undefined;
  }

  return {
    id:
      `supplier:${supplierName.toLocaleLowerCase("tr-TR")}`,
    name: supplierName,
    phone:
      input.supplierPhone?.trim() ||
      undefined
  };
}

export function routeChildOperation(
  state: ChildOperationState,
  input: RouteChildOperationInput
): RouteChildOperationResult {
  if (input.parent.kind !== "GENERAL") {
    return {
      outcome: "REJECTED",
      state,
      reason: "PARENT_MUST_BE_GENERAL"
    };
  }

  if (!input.createdByUserId.trim()) {
    return {
      outcome: "REJECTED",
      state,
      reason: "ACTOR_REQUIRED"
    };
  }

  const scheduledAt =
    new Date(input.scheduledAt);

  const dueAt =
    new Date(input.dueAt);

  if (
    Number.isNaN(scheduledAt.getTime()) ||
    Number.isNaN(dueAt.getTime()) ||
    dueAt.getTime() <
      scheduledAt.getTime()
  ) {
    return {
      outcome: "REJECTED",
      state,
      reason: "INVALID_DATE_RANGE"
    };
  }

  const party = resolveParty(input);

  if (
    input.kind === "SUPPLIER" &&
    !party
  ) {
    return {
      outcome: "REJECTED",
      state,
      reason: "SUPPLIER_REQUIRED"
    };
  }

  if (
    input.kind !== "SUPPLIER" &&
    !party
  ) {
    return {
      outcome: "REJECTED",
      state,
      reason: "PARTY_REQUIRED"
    };
  }

  const stableParty = party as OperationParty;

  const id =
    createStableChildId(
      input.parent.id,
      input.kind,
      stableParty.id
    );

  const idempotencyKey = [
    input.kind,
    input.parent.id,
    stableParty.id
  ].join(":");

  const existing =
    state.operations.find(
      operation =>
        operation.parentOperationId ===
          input.parent.id &&
        operation.kind === input.kind &&
        operation.party?.id ===
          stableParty.id &&
        operation.status !==
          "CANCELLED" &&
        erpScopeMatches(
          operation,
          input.parent
        )
    );

  if (existing) {
    return {
      outcome: "REPLAY",
      state,
      operation: existing
    };
  }

  const operation: OperationRecord = {
    tenantId:
      input.parent.tenantId,
    companyId:
      input.parent.companyId,
    branchId:
      input.parent.branchId,
    accountingPeriodId:
      input.parent.accountingPeriodId,

    id,
    idempotencyKey,

    kind: input.kind,

    sourceId:
      input.parent.sourceId,

    saleId:
      input.parent.saleId,

    parentOperationId:
      input.parent.id,

    customerId:
      input.parent.customerId,

    customerName:
      input.parent.customerName,

    address:
      input.parent.address,

    title:
      titleForKind(
        input.kind,
        input.parent
      ),

    details: [
      ...input.parent.details
    ],

    party: stableParty,

    scheduledAt:
      scheduledAt.toISOString(),

    dueAt:
      dueAt.toISOString(),

    status: "ASSIGNED",

    notes:
      input.notes?.trim() ||
      `Ana işten yönlendirildi: ${input.parent.id}`,

    createdByUserId:
      input.createdByUserId,

    createdAt:
      input.now,

    updatedAt:
      input.now
  };

  const agenda =
    buildAgendaEvent(operation);

  return {
    outcome: "CREATED",
    operation,
    state: {
      operations: [
        ...state.operations,
        operation
      ],
      agendaEvents: [
        ...state.agendaEvents.filter(
          event =>
            event.operationId !==
            operation.id
        ),
        agenda
      ]
    }
  };
}