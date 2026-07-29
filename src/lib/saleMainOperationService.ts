import type { ErpScope } from "./erpScope";
import { erpScopeMatches } from "./erpScope";
import {
  buildAgendaEvent,
  type AgendaEvent,
  type OperationRecord
} from "./operationsWorkflow";
import {
  buildOperationDetailFromSaleItem,
  type OperationCustomer
} from "./operationSalesBinding";
import type { Sale } from "@/store/salesStore";

export interface BuildMainOperationInput {
  scope: ErpScope;
  sale: Sale;
  customer: OperationCustomer;
  createdByUserId: string;
}

export interface MainOperationState {
  operations: OperationRecord[];
  agendaEvents: AgendaEvent[];
}

export type SyncMainOperationResult =
  | {
      outcome: "CREATED";
      state: MainOperationState;
      operation: OperationRecord;
    }
  | {
      outcome: "UPDATED";
      state: MainOperationState;
      operation: OperationRecord;
    }
  | {
      outcome: "UNCHANGED";
      state: MainOperationState;
      operation: OperationRecord;
    }
  | {
      outcome: "REJECTED";
      state: MainOperationState;
      reason:
        | "SALE_ITEMS_REQUIRED"
        | "ACTOR_REQUIRED"
        | "CUSTOMER_REQUIRED";
    };

function replaceAgendaEvent(
  events: AgendaEvent[],
  nextEvent: AgendaEvent
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

function sameDetails(
  left: string[],
  right: string[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (value, index) =>
        value === right[index]
    )
  );
}

export function buildMainOperationFromSale(
  input: BuildMainOperationInput
): OperationRecord {
  const details =
    input.sale.items.map(
      buildOperationDetailFromSaleItem
    );

  if (details.length === 0) {
    throw new Error(
      "MAIN_OPERATION_SALE_ITEMS_REQUIRED"
    );
  }

  if (
    !input.createdByUserId.trim()
  ) {
    throw new Error(
      "MAIN_OPERATION_ACTOR_REQUIRED"
    );
  }

  if (
    !input.customer.id.trim() ||
    !input.customer.name.trim()
  ) {
    throw new Error(
      "MAIN_OPERATION_CUSTOMER_REQUIRED"
    );
  }

  const stableTime =
    new Date(
      input.sale.createdAt
    ).toISOString();

  return {
    ...input.scope,

    id:
      `general-operation:${input.sale.id}`,

    idempotencyKey:
      `GENERAL:${input.sale.id}`,

    kind: "GENERAL",

    sourceId: input.sale.id,
    saleId: input.sale.id,

    customerId:
      input.customer.id,

    customerName:
      input.customer.name,

    address:
      input.customer.address,

    title:
      `Genel İş Takibi — ${input.sale.saleNo}`,

    details,

    scheduledAt: stableTime,
    dueAt: stableTime,

    status: "DRAFT",

    notes:
      "Satış kaydından otomatik oluşturuldu.",

    createdByUserId:
      input.createdByUserId,

    createdAt: stableTime,
    updatedAt:
      input.sale.updatedAt
  };
}

export function syncMainOperationFromSale(
  state: MainOperationState,
  input: BuildMainOperationInput
): SyncMainOperationResult {
  if (input.sale.items.length === 0) {
    return {
      outcome: "REJECTED",
      state,
      reason: "SALE_ITEMS_REQUIRED"
    };
  }

  if (!input.createdByUserId.trim()) {
    return {
      outcome: "REJECTED",
      state,
      reason: "ACTOR_REQUIRED"
    };
  }

  if (
    !input.customer.id.trim() ||
    !input.customer.name.trim()
  ) {
    return {
      outcome: "REJECTED",
      state,
      reason: "CUSTOMER_REQUIRED"
    };
  }

  const request =
    buildMainOperationFromSale(input);

  const existing =
    state.operations.find(
      operation =>
        operation.kind === "GENERAL" &&
        operation.saleId ===
          input.sale.id &&
        operation.status !==
          "CANCELLED" &&
        erpScopeMatches(
          operation,
          input.scope
        )
    );

  if (!existing) {
    return {
      outcome: "CREATED",
      operation: request,
      state: {
        operations: [
          ...state.operations,
          request
        ],
        agendaEvents:
          replaceAgendaEvent(
            state.agendaEvents,
            buildAgendaEvent(request)
          )
      }
    };
  }

  const updated: OperationRecord = {
    ...existing,

    customerId:
      request.customerId,

    customerName:
      request.customerName,

    address:
      request.address,

    title:
      request.title,

    details:
      request.details,

    updatedAt:
      input.sale.updatedAt
  };

  if (
    existing.customerId ===
      updated.customerId &&
    existing.customerName ===
      updated.customerName &&
    existing.address ===
      updated.address &&
    existing.title ===
      updated.title &&
    sameDetails(
      existing.details,
      updated.details
    )
  ) {
    return {
      outcome: "UNCHANGED",
      operation: existing,
      state
    };
  }

  return {
    outcome: "UPDATED",
    operation: updated,
    state: {
      operations:
        state.operations.map(
          operation =>
            operation.id ===
              existing.id
              ? updated
              : operation
        ),

      agendaEvents:
        replaceAgendaEvent(
          state.agendaEvents,
          buildAgendaEvent(updated)
        )
    }
  };
}