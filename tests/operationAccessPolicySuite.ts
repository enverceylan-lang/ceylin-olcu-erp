import assert from "node:assert/strict";
import {
  canAdvanceOperation,
  canCreateOperation,
  canViewAgendaEvent,
  canViewOperation
} from "../src/lib/operationAccessPolicy";
import {
  buildAgendaEvent,
  type OperationRecord
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

    title: "Terzi İş Emri",
    details: ["Salon — Tül"],

    party: {
      id: "tailor-1",
      name: "Hasan Terzi"
    },

    scheduledAt:
      "2026-07-28T09:00:00.000Z",

    dueAt:
      "2026-07-30T17:00:00.000Z",

    status: "ASSIGNED",

    createdByUserId: "admin-1",
    createdAt:
      "2026-07-28T08:00:00.000Z",

    updatedAt:
      "2026-07-28T08:00:00.000Z",

    ...overrides
  };
}

assert.equal(
  canCreateOperation({
    userId: "admin-1",
    role: "ADMIN"
  }),
  true
);

assert.equal(
  canCreateOperation({
    userId: "office-1",
    role: "OFFICE"
  }),
  true
);

assert.equal(
  canCreateOperation({
    userId: "tailor-1",
    role: "TAILOR"
  }),
  false
);

assert.equal(
  canCreateOperation({
    userId: "field-1",
    role: "FIELD"
  }),
  false
);

const tailorOperation = operation();

assert.equal(
  canViewOperation(
    tailorOperation,
    scope,
    {
      userId: "tailor-1",
      role: "TAILOR"
    }
  ),
  true
);

assert.equal(
  canViewOperation(
    tailorOperation,
    scope,
    {
      userId: "tailor-2",
      role: "TAILOR"
    }
  ),
  false
);

assert.equal(
  canViewOperation(
    tailorOperation,
    scope,
    {
      userId: "installer-1",
      role: "INSTALLER"
    }
  ),
  false
);

const installation =
  operation({
    id: "installation-1",
    idempotencyKey:
      "INSTALLATION:sale-1:installer-1",
    kind: "INSTALLATION",
    party: {
      id: "installer-1",
      name: "Ali Montaj"
    }
  });

assert.equal(
  canViewOperation(
    installation,
    scope,
    {
      userId: "installer-1",
      role: "INSTALLER"
    }
  ),
  true
);

assert.equal(
  canViewOperation(
    installation,
    {
      ...scope,
      branchId: "branch-2"
    },
    {
      userId: "installer-1",
      role: "INSTALLER"
    }
  ),
  false
);

assert.equal(
  canAdvanceOperation(
    tailorOperation,
    {
      userId: "tailor-1",
      role: "PRODUCTION"
    }
  ),
  true
);

assert.equal(
  canAdvanceOperation(
    tailorOperation,
    {
      userId: "other-user",
      role: "TAILOR"
    }
  ),
  false
);

const agenda =
  buildAgendaEvent(
    tailorOperation
  );

assert.equal(
  canViewAgendaEvent(
    agenda,
    tailorOperation,
    scope,
    {
      userId: "tailor-1",
      role: "TAILOR"
    }
  ),
  true
);

assert.equal(
  canViewAgendaEvent(
    agenda,
    undefined,
    scope,
    {
      userId: "admin-1",
      role: "ADMIN"
    }
  ),
  false
);

console.log(
  "OPERATION_ACCESS_POLICY_TEST: PAK"
);