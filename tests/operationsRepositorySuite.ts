import assert from "node:assert/strict";
import {
  listScopedAgendaEvents,
  listVisibleOperationsForUser,
  rebuildAgendaEvents,
  saveOperationRecord,
  updateOperationRecordStatus,
  type OperationsStateData
} from "../src/lib/operationsRepository";
import type {
  OperationRecord
} from "../src/lib/operationsWorkflow";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

function operation(
  overrides: Partial<OperationRecord> = {}
): OperationRecord {
  return {
    ...scope,

    id: "operation-1",
    idempotencyKey:
      "TAILOR:sale-1:tailor-1",

    kind: "TAILOR",
    sourceId: "sale-1",
    saleId: "sale-1",

    customerId: "customer-1",
    customerName: "Örnek Müşteri",
    address: "Örnek Adres",

    title: "Terzi İş Ataması",
    details: [
      "Salon — Tül — 300 × 260 cm"
    ],

    party: {
      id: "tailor-1",
      name: "Hasan Terzi",
      phone: "905551112233"
    },

    scheduledAt:
      "2026-07-28T09:00:00.000Z",
    dueAt:
      "2026-07-30T15:00:00.000Z",

    status: "ASSIGNED",

    createdByUserId: "admin-1",
    createdAt:
      "2026-07-28T08:00:00.000Z",
    updatedAt:
      "2026-07-28T08:00:00.000Z",

    ...overrides
  };
}

const empty: OperationsStateData = {
  operations: [],
  agendaEvents: []
};

const created = saveOperationRecord(
  empty,
  operation()
);

assert.equal(created.outcome, "CREATED");

if (created.outcome !== "CREATED") {
  throw new Error("EXPECTED_CREATED");
}

assert.equal(
  created.state.operations.length,
  1
);

assert.equal(
  created.state.agendaEvents.length,
  1
);

assert.equal(
  created.state.agendaEvents[0].operationId,
  "operation-1"
);

const replay = saveOperationRecord(
  created.state,
  operation()
);

assert.equal(replay.outcome, "REPLAY");

assert.equal(
  replay.state.operations.length,
  1
);

const updated =
  updateOperationRecordStatus(
    created.state,
    "operation-1",
    "IN_PROGRESS",
    {
      userId: "tailor-1",
      role: "TAILOR"
    },
    "2026-07-28T10:00:00.000Z"
  );

assert.equal(updated.outcome, "UPDATED");

if (updated.outcome !== "UPDATED") {
  throw new Error("EXPECTED_UPDATED");
}

assert.equal(
  updated.state.operations[0].status,
  "IN_PROGRESS"
);

assert.equal(
  updated.state.agendaEvents[0].status,
  "IN_PROGRESS"
);

const forbidden =
  updateOperationRecordStatus(
    created.state,
    "operation-1",
    "IN_PROGRESS",
    {
      userId: "installer-1",
      role: "INSTALLER"
    },
    "2026-07-28T10:00:00.000Z"
  );

assert.equal(
  forbidden.outcome,
  "REJECTED"
);

const secondScopeState: OperationsStateData = {
  operations: [
    ...updated.state.operations,
    operation({
      id: "operation-2",
      idempotencyKey:
        "TAILOR:sale-2:tailor-2",
      tenantId: "tenant-2",
      saleId: "sale-2",
      sourceId: "sale-2"
    })
  ],
  agendaEvents: []
};

const repaired = {
  ...secondScopeState,
  agendaEvents: rebuildAgendaEvents(
    secondScopeState.operations
  )
};

assert.equal(
  listScopedAgendaEvents(
    repaired,
    scope
  ).length,
  1
);

assert.equal(
  listVisibleOperationsForUser(
    repaired,
    scope,
    {
      userId: "tailor-1",
      role: "TAILOR"
    }
  ).length,
  1
);

assert.equal(
  listVisibleOperationsForUser(
    repaired,
    scope,
    {
      userId: "other-user",
      role: "TAILOR"
    }
  ).length,
  0
);

assert.equal(
  listVisibleOperationsForUser(
    repaired,
    scope,
    {
      userId: "admin-1",
      role: "ADMIN"
    }
  ).length,
  1
);

console.log(
  "OPERATIONS_REPOSITORY_TEST: PAK"
);