import assert from "node:assert/strict";
import {
  routeChildOperation
} from "../src/lib/operationRoutingService";
import type {
  OperationRecord
} from "../src/lib/operationsWorkflow";

const parent: OperationRecord = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",

  id: "general-operation:sale-1",
  idempotencyKey: "GENERAL:sale-1",
  kind: "GENERAL",

  sourceId: "sale-1",
  saleId: "sale-1",

  customerId: "customer-1",
  customerName: "Test Cari",
  address: "Test Adres",

  title: "Genel İş Takibi — SAT-0001",

  details: [
    "Salon — Pencere — Tül"
  ],

  scheduledAt:
    "2026-07-28T20:00:00.000Z",

  dueAt:
    "2026-07-28T20:00:00.000Z",

  status: "DRAFT",

  createdByUserId: "admin-1",

  createdAt:
    "2026-07-28T20:00:00.000Z",

  updatedAt:
    "2026-07-28T20:00:00.000Z"
};

const first =
  routeChildOperation(
    {
      operations: [parent],
      agendaEvents: []
    },
    {
      parent,
      kind: "TAILOR",
      party: {
        id: "tailor-1",
        name: "Terzi Usta"
      },
      scheduledAt:
        "2026-07-29T08:00:00.000Z",
      dueAt:
        "2026-07-30T17:00:00.000Z",
      createdByUserId: "admin-1",
      now:
        "2026-07-28T21:00:00.000Z"
    }
  );

assert.equal(
  first.outcome,
  "CREATED"
);

assert.equal(
  first.state.operations.length,
  2
);

assert.equal(
  first.state.agendaEvents.length,
  1
);

assert.equal(
  first.operation.parentOperationId,
  parent.id
);

const replay =
  routeChildOperation(
    first.state,
    {
      parent,
      kind: "TAILOR",
      party: {
        id: "tailor-1",
        name: "Terzi Usta"
      },
      scheduledAt:
        "2026-07-29T08:00:00.000Z",
      dueAt:
        "2026-07-30T17:00:00.000Z",
      createdByUserId: "admin-1",
      now:
        "2026-07-28T21:05:00.000Z"
    }
  );

assert.equal(
  replay.outcome,
  "REPLAY"
);

assert.equal(
  replay.state.operations.length,
  2
);

const installer =
  routeChildOperation(
    first.state,
    {
      parent,
      kind: "INSTALLATION",
      party: {
        id: "installer-1",
        name: "Montaj Ustası"
      },
      scheduledAt:
        "2026-08-01T08:00:00.000Z",
      dueAt:
        "2026-08-01T18:00:00.000Z",
      createdByUserId: "admin-1",
      now:
        "2026-07-28T21:10:00.000Z"
    }
  );

assert.equal(
  installer.outcome,
  "CREATED"
);

assert.equal(
  installer.state.operations.length,
  3
);

assert.equal(
  installer.state.agendaEvents.length,
  2
);

console.log(
  "OPERATION_ROUTING_STORE_TEST: PAK"
);