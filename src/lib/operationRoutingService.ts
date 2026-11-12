import type {
  AgendaEvent,
  OperationKind,
  OperationParty,
  OperationPriority,
  OperationRecord
} from "./operationsWorkflow";
import {
  buildAgendaEvent
} from "./operationsWorkflow";
import {
  erpScopeMatches
} from "./erpScope";
import {
  decideInstallationScheduleConflict
} from "./installationScheduleConflictGuard";

export interface RouteChildOperationInput {
  parent: OperationRecord;
  kind: Exclude<
    OperationKind,
    "GENERAL"
  >;
  party?: OperationParty;
  fulfillmentMode?: "STORE_PICKUP";
  fulfillmentLineId?: string;
  fulfillmentLineLabel?: string;
  supplierName?: string;
  supplierPhone?: string;
  scheduledAt: string;
  dueAt: string;
  priority?: OperationPriority;
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
        | "INSTALLATION_ADDRESS_REQUIRED"
        | "INVALID_FULFILLMENT_MODE"
        | "STORE_PICKUP_ALREADY_COMPLETED"
        | "STORE_PICKUP_NOT_READY"
        | "FULFILLMENT_LINE_REQUIRED"
        | "SUPPLIER_REQUIRED"
        | "INVALID_DATE_RANGE"
        | "SCHEDULE_CONFLICT"
        | "INVALID_EXISTING_SCHEDULE"
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

  const pickup = input.fulfillmentMode === "STORE_PICKUP";
  if (pickup && (input.kind !== "INSTALLATION" || input.party)) {
    return { outcome: "REJECTED", state, reason: "INVALID_FULFILLMENT_MODE" };
  }

  if (input.kind === "INSTALLATION" && !pickup && !input.parent.address?.trim()) {
    return { outcome: "REJECTED", state, reason: "INSTALLATION_ADDRESS_REQUIRED" };
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
    !pickup &&
    !party
  ) {
    return {
      outcome: "REJECTED",
      state,
      reason: "PARTY_REQUIRED"
    };
  }

  const assignmentKey = pickup ? "store-pickup" : party!.id;

  if (
    input.kind === "TAILOR" &&
    party?.assignmentType === "EXTERNAL" &&
    !party.providerCustomerId?.trim()
  ) {
    return {
      outcome: "REJECTED",
      state,
      reason: "PARTY_REQUIRED"
    };
  }

  if (
    input.kind === "INSTALLATION" &&
    party?.assignmentType === "EXTERNAL" &&
    !party.providerCustomerId?.trim()
  ) {
    return {
      outcome: "REJECTED",
      state,
      reason: "PARTY_REQUIRED"
    };
  }

  if (
    input.kind === "INSTALLATION" &&
    party?.assignmentType === "INTERNAL" &&
    !party.userId?.trim()
  ) {
    return {
      outcome: "REJECTED",
      state,
      reason: "PARTY_REQUIRED"
    };
  }

  const lineId = input.kind === "INSTALLATION" ? input.fulfillmentLineId : undefined;
  const identity = lineId ? `line:${encodeURIComponent(lineId)}` : assignmentKey;
  const id =
    createStableChildId(
      input.parent.id,
      input.kind,
      identity
    );

  const idempotencyKey = [
    input.kind,
    input.parent.id,
    identity
  ].join(":");

  const scopedInstallations = input.kind === "INSTALLATION"
    ? state.operations.filter(operation => operation.kind === "INSTALLATION" &&
        operation.parentOperationId === input.parent.id && operation.saleId === input.parent.saleId &&
        operation.fulfillmentLineId === lineId &&
        operation.status !== "CANCELLED" && erpScopeMatches(operation, input.parent))
    : [];
  const existingPickup = scopedInstallations.find(operation => operation.fulfillmentMode === "STORE_PICKUP");
  if (pickup) {
    const existingInstallation = existingPickup ?? scopedInstallations[0];
    if (existingInstallation) return { outcome: "REPLAY", state, operation: existingInstallation };
  } else if (existingPickup?.status === "COMPLETED") {
    return { outcome: "REJECTED", state, reason: "STORE_PICKUP_ALREADY_COMPLETED" };
  }

  const existingLine = lineId ? scopedInstallations[0] : undefined;
  if (existingLine && !existingPickup) {
    return { outcome: "REPLAY", state, operation: existingLine };
  }

  const existing =
    state.operations.find(
      operation =>
        operation.parentOperationId ===
          input.parent.id &&
        operation.kind === input.kind &&
        operation.fulfillmentLineId === lineId &&
        operation.fulfillmentMode !== "STORE_PICKUP" &&
        operation.party?.id === assignmentKey &&
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

  if (input.kind === "INSTALLATION" && !pickup) {
    const scheduleDecision =
      decideInstallationScheduleConflict(
        {
          tenantId: input.parent.tenantId,
          companyId: input.parent.companyId,
          branchId: input.parent.branchId,
          accountingPeriodId:
            input.parent.accountingPeriodId,
          partyId: assignmentKey,
          scheduledAt:
            scheduledAt.toISOString(),
          dueAt:
            dueAt.toISOString()
        },
        lineId ? state.operations.filter(operation =>
          operation.saleId !== input.parent.saleId || !operation.fulfillmentLineId ||
          operation.scheduledAt !== scheduledAt.toISOString() || operation.dueAt !== dueAt.toISOString()
        ) : state.operations
      );

    if (!scheduleDecision.allowed) {
      return {
        outcome: "REJECTED",
        state,
        reason: scheduleDecision.reason
      };
    }
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

    address: pickup ? undefined : input.parent.address,

    title: input.fulfillmentLineLabel
      ? `${input.fulfillmentLineLabel} — ${input.parent.title}`
      : pickup ? `Mağazadan Teslim — ${input.parent.title}` : titleForKind(input.kind, input.parent),
    ...(lineId ? { fulfillmentLineId: lineId } : {}),
    ...(pickup ? { fulfillmentMode: "STORE_PICKUP" as const } : {}),

    details: [
      ...input.parent.details
    ],

    party: party ?? undefined,

    scheduledAt:
      scheduledAt.toISOString(),

    dueAt:
      dueAt.toISOString(),

    status: "ASSIGNED",

    priority:
      input.priority ?? "NORMAL",

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

  const agenda = buildAgendaEvent(operation);
  const cancelledPickup: OperationRecord | undefined = existingPickup && !pickup && !lineId
    ? { ...existingPickup, status: "CANCELLED", updatedAt: input.now }
    : undefined;

  return {
    outcome: "CREATED",
    operation,
    state: {
      operations: [
        ...state.operations.flatMap(item => {
          if (lineId && item.id === operation.id && item.status === "CANCELLED" &&
              erpScopeMatches(item, operation)) return [];
          if (item !== existingPickup) return [item];
          if (lineId && !pickup) return [];
          return [cancelledPickup ?? item];
        }),
        operation
      ],
      agendaEvents: [
        ...state.agendaEvents.filter(
          event =>
            !erpScopeMatches(event, input.parent) || (event.operationId !== operation.id &&
            event.operationId !== cancelledPickup?.id)
        ),
        ...(cancelledPickup ? [buildAgendaEvent(cancelledPickup)] : []),
        agenda
      ]
    }
  };
}