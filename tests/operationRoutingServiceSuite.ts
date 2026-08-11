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
  customerName: "Ahmet Yılmaz",
  address: "İstanbul",

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

const emptyState = {
  operations: [parent],
  agendaEvents: []
};

const tailor =
  routeChildOperation(
    emptyState,
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
  tailor.outcome,
  "CREATED"
);

assert.equal(
  tailor.operation.kind,
  "TAILOR"
);

assert.equal(
  tailor.operation.parentOperationId,
  parent.id
);

assert.equal(
  tailor.state.operations.length,
  2
);

assert.equal(
  tailor.state.agendaEvents.length,
  1
);

const tailorReplay =
  routeChildOperation(
    tailor.state,
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
  tailorReplay.outcome,
  "REPLAY"
);

assert.equal(
  tailorReplay.state.operations.length,
  2
);

const supplier =
  routeChildOperation(
    tailor.state,
    {
      parent,
      kind: "SUPPLIER",
      supplierName:
        "Örnek Mekanik Perde",
      supplierPhone:
        "05000000000",
      scheduledAt:
        "2026-07-29T09:00:00.000Z",
      dueAt:
        "2026-08-01T17:00:00.000Z",
      createdByUserId: "admin-1",
      now:
        "2026-07-28T21:10:00.000Z"
    }
  );

assert.equal(
  supplier.outcome,
  "CREATED"
);

assert.equal(
  supplier.operation.kind,
  "SUPPLIER"
);

assert.equal(
  supplier.operation.parentOperationId,
  parent.id
);

const firstInstallation =
  routeChildOperation(
    {
      operations: [parent],
      agendaEvents: []
    },
    {
      parent,
      kind: "INSTALLATION",
      party: {
        id: "internal-user:installer-1",
        userId: "installer-1",
        name: "Montaj Ustası",
        assignmentType: "INTERNAL"
      },
      scheduledAt:
        "2026-08-02T08:00:00.000Z",
      dueAt:
        "2026-08-02T12:00:00.000Z",
      createdByUserId: "admin-1",
      now:
        "2026-07-28T21:12:00.000Z"
    }
  );

assert.equal(
  firstInstallation.outcome,
  "CREATED"
);

if (firstInstallation.outcome !== "CREATED") {
  throw new Error(
    "First installation must be created"
  );
}

const secondParent: OperationRecord = {
  ...parent,
  id: "general-operation:sale-2",
  idempotencyKey: "GENERAL:sale-2",
  sourceId: "sale-2",
  saleId: "sale-2",
  customerId: "customer-2",
  customerName: "Ayşe Yılmaz"
};

const installationConflict =
  routeChildOperation(
    {
      operations: [
        secondParent,
        firstInstallation.operation
      ],
      agendaEvents:
        firstInstallation.state.agendaEvents
    },
    {
      parent: secondParent,
      kind: "INSTALLATION",
      party: {
        id: "internal-user:installer-1",
        userId: "installer-1",
        name: "Montaj Ustası",
        assignmentType: "INTERNAL"
      },
      scheduledAt:
        "2026-08-02T10:00:00.000Z",
      dueAt:
        "2026-08-02T14:00:00.000Z",
      createdByUserId: "admin-1",
      now:
        "2026-07-28T21:13:00.000Z"
    }
  );

assert.equal(
  installationConflict.outcome,
  "REJECTED"
);

if (installationConflict.outcome === "REJECTED") {
  assert.equal(
    installationConflict.reason,
    "SCHEDULE_CONFLICT"
  );
}

const installationBoundary =
  routeChildOperation(
    {
      operations: [
        secondParent,
        firstInstallation.operation
      ],
      agendaEvents:
        firstInstallation.state.agendaEvents
    },
    {
      parent: secondParent,
      kind: "INSTALLATION",
      party: {
        id: "internal-user:installer-1",
        userId: "installer-1",
        name: "Montaj Ustası",
        assignmentType: "INTERNAL"
      },
      scheduledAt:
        "2026-08-02T12:00:00.000Z",
      dueAt:
        "2026-08-02T16:00:00.000Z",
      createdByUserId: "admin-1",
      now:
        "2026-07-28T21:14:00.000Z"
    }
  );

assert.equal(
  installationBoundary.outcome,
  "CREATED"
);

const invalidParent =
  routeChildOperation(
    tailor.state,
    {
      parent: tailor.operation,
      kind: "INSTALLATION",
      party: {
        id: "installer-1",
        name: "Montaj Ustası"
      },
      scheduledAt:
        "2026-07-29T09:00:00.000Z",
      dueAt:
        "2026-07-29T18:00:00.000Z",
      createdByUserId: "admin-1",
      now:
        "2026-07-28T21:15:00.000Z"
    }
  );

assert.equal(
  invalidParent.outcome,
  "REJECTED"
);

assert.equal(
  invalidParent.reason,
  "PARENT_MUST_BE_GENERAL"
);

console.log(
  "OPERATION_ROUTING_SERVICE_TEST: PAK"
);