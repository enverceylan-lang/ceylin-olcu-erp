import assert from "node:assert/strict";
import {
  buildOperationWhatsAppText,
  decideOperationCreation,
  decideOperationTransition,
  type OperationRecord
} from "../src/lib/operationsWorkflow";

const base: OperationRecord = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",

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
    "Salon — Tül — 300 cm × 260 cm"
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
    "2026-07-28T08:00:00.000Z"
};

const created =
  decideOperationCreation(base, []);

assert.equal(
  created.outcome,
  "CREATE"
);

if (created.outcome === "CREATE") {
  assert.equal(
    created.agenda.operationId,
    base.id
  );

  assert.equal(
    created.agenda.dueAt,
    base.dueAt
  );
}

const replay =
  decideOperationCreation(
    base,
    [base]
  );

assert.equal(
  replay.outcome,
  "REPLAY"
);

const conflict =
  decideOperationCreation(
    {
      ...base,
      dueAt:
        "2026-08-01T15:00:00.000Z"
    },
    [base]
  );

assert.deepEqual(
  conflict,
  {
    outcome: "REJECT",
    reason: "IDEMPOTENCY_CONFLICT"
  }
);

const otherScope =
  decideOperationCreation(
    {
      ...base,
      id: "operation-2",
      tenantId: "tenant-2"
    },
    [base]
  );

assert.equal(
  otherScope.outcome,
  "CREATE"
);

const duplicate =
  decideOperationCreation(
    {
      ...base,
      id: "operation-3",
      idempotencyKey: "another-key"
    },
    [base]
  );

assert.deepEqual(
  duplicate,
  {
    outcome: "REJECT",
    reason:
      "DUPLICATE_ACTIVE_OPERATION"
  }
);

const forbidden =
  decideOperationTransition(
    base,
    "IN_PROGRESS",
    {
      userId: "other-user",
      role: "TAILOR"
    },
    "2026-07-28T10:00:00.000Z"
  );

assert.equal(
  forbidden.allowed,
  false
);

const started =
  decideOperationTransition(
    base,
    "IN_PROGRESS",
    {
      userId: "tailor-1",
      role: "TAILOR"
    },
    "2026-07-28T10:00:00.000Z"
  );

assert.equal(
  started.allowed,
  true
);

if (started.allowed) {
  assert.equal(
    started.operation.status,
    "IN_PROGRESS"
  );

  assert.equal(
    started.agenda.status,
    "IN_PROGRESS"
  );
}

const completed =
  decideOperationTransition(
    {
      ...base,
      status: "IN_PROGRESS"
    },
    "COMPLETED",
    {
      userId: "tailor-1",
      role: "TAILOR"
    },
    "2026-07-30T14:00:00.000Z"
  );

assert.equal(
  completed.allowed,
  true
);

if (completed.allowed) {
  assert.equal(
    completed.operation.completedAt,
    "2026-07-30T14:00:00.000Z"
  );
}

const text =
  buildOperationWhatsAppText(base);

assert.match(
  text,
  /TERZİ İŞ EMRİ/
);

assert.match(
  text,
  /Örnek Müşteri/
);

assert.doesNotMatch(
  text,
  /undefined/
);

console.log(
  "OPERATIONS_WORKFLOW_TEST: PAK"
);