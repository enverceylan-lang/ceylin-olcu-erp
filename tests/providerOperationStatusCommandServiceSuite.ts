import assert from "node:assert/strict";
import type {
  OperationRecord
} from "../src/lib/operationsWorkflow";
import type {
  OperationsStateData
} from "../src/lib/operationsRepository";
import {
  executeProviderOperationStatusCommand
} from "../src/lib/providerOperationStatusCommandService";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

function operation(
  overrides:
    Partial<OperationRecord> = {}
): OperationRecord {
  return {
    ...scope,

    id: "operation-1",
    idempotencyKey:
      "TAILOR:sale-1:cari-tailor-1",

    kind: "TAILOR",
    sourceId: "sale-1",
    saleId: "sale-1",

    customerId: "customer-1",
    customerName:
      "Örnek Müşteri",

    title:
      "Terzi İş Emri",

    details: [
      "Salon — Tül"
    ],

    party: {
      id: "cari-tailor-1",
      name: "Örnek Terzi"
    },

    scheduledAt:
      "2026-07-29T08:00:00.000Z",

    dueAt:
      "2026-07-30T17:00:00.000Z",

    status: "SENT",

    createdByUserId:
      "admin-1",

    createdAt:
      "2026-07-29T07:00:00.000Z",

    updatedAt:
      "2026-07-29T07:00:00.000Z",

    ...overrides
  };
}

function state(
  item:
    OperationRecord
): OperationsStateData {
  return {
    operations: [
      item
    ],
    agendaEvents: []
  };
}

const actor = {
  ...scope,
  userId: "user-tailor-1",
  role: "TAILOR"
};

const link = {
  userId: "user-tailor-1",
  providerCustomerId:
    "cari-tailor-1",
  providerType:
    "TAILOR" as const
};

const accepted =
  executeProviderOperationStatusCommand(
    state(
      operation()
    ),
    {
      actor,
      link,
      operationId:
        "operation-1",
      action:
        "ACCEPT",
      occurredAt:
        "2026-07-29T10:00:00.000Z",
      auditId:
        "audit-1"
    }
  );

assert.equal(
  accepted.outcome,
  "UPDATED"
);

if (
  accepted.outcome ===
  "UPDATED"
) {
  assert.equal(
    accepted.operation.status,
    "ACCEPTED"
  );

  assert.equal(
    accepted.state.agendaEvents[0].status,
    "ACCEPTED"
  );

  assert.equal(
    accepted.audit.previousStatus,
    "SENT"
  );

  assert.equal(
    accepted.audit.nextStatus,
    "ACCEPTED"
  );

  assert.equal(
    accepted.audit.providerCustomerId,
    "cari-tailor-1"
  );
}

const problem =
  executeProviderOperationStatusCommand(
    state(
      operation({
        status:
          "IN_PROGRESS",
        notes:
          "Önceki not"
      })
    ),
    {
      actor,
      link,
      operationId:
        "operation-1",
      action:
        "REPORT_PROBLEM",
      problemDescription:
        "Kumaş eksik geldi.",
      occurredAt:
        "2026-07-29T11:00:00.000Z",
      auditId:
        "audit-2"
    }
  );

assert.equal(
  problem.outcome,
  "UPDATED"
);

if (
  problem.outcome ===
  "UPDATED"
) {
  assert.equal(
    problem.operation.status,
    "PROBLEM"
  );

  assert.match(
    problem.operation.notes || "",
    /Önceki not/
  );

  assert.match(
    problem.operation.notes || "",
    /Kumaş eksik geldi/
  );

  assert.equal(
    problem.audit.problemDescription,
    "Kumaş eksik geldi."
  );
}

const completed =
  executeProviderOperationStatusCommand(
    state(
      operation({
        status:
          "IN_PROGRESS"
      })
    ),
    {
      actor,
      link,
      operationId:
        "operation-1",
      action:
        "REPORT_COMPLETED",
      occurredAt:
        "2026-07-29T12:00:00.000Z",
      auditId:
        "audit-3"
    }
  );

assert.equal(
  completed.outcome,
  "UPDATED"
);

if (
  completed.outcome ===
  "UPDATED"
) {
  assert.equal(
    completed.operation.status,
    "COMPLETED"
  );

  assert.equal(
    completed.operation.completedAt,
    "2026-07-29T12:00:00.000Z"
  );
}

const replayState =
  state(
    operation({
      status:
        "COMPLETED",
      completedAt:
        "2026-07-29T12:00:00.000Z"
    })
  );

const replay =
  executeProviderOperationStatusCommand(
    replayState,
    {
      actor,
      link,
      operationId:
        "operation-1",
      action:
        "REPORT_COMPLETED",
      occurredAt:
        "2026-07-29T13:00:00.000Z",
      auditId:
        "audit-4"
    }
  );

assert.equal(
  replay.outcome,
  "REPLAY"
);

assert.equal(
  replay.state,
  replayState
);

const forbidden =
  executeProviderOperationStatusCommand(
    state(
      operation({
        party: {
          id:
            "cari-tailor-2",
          name:
            "Başka Terzi"
        }
      })
    ),
    {
      actor,
      link,
      operationId:
        "operation-1",
      action:
        "ACCEPT",
      occurredAt:
        "2026-07-29T10:00:00.000Z",
      auditId:
        "audit-5"
    }
  );

assert.equal(
  forbidden.outcome,
  "REJECTED"
);

const noFinanceKeys =
  JSON.stringify(
    completed
  );

assert.doesNotMatch(
  noFinanceKeys,
  /financeTransaction|purchaseDocument|paymentId|cashAccount/
);

console.log(
  "PROVIDER_OPERATION_STATUS_COMMAND_TEST: PAK"
);