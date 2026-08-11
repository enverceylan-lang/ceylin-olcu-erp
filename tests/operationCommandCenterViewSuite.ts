import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOperationCommandCenterSummary,
  deriveOperationAttention,
  matchesOperationSearch,
  resolveNextAllowedOperationStatus
} from "../src/lib/operationCommandCenterView";
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
  input: Partial<OperationRecord>
): OperationRecord {
  return {
    ...scope,
    id: "op-1",
    idempotencyKey: "idem-1",
    kind: "TAILOR",
    sourceId: "sale-1",
    saleId: "sale-1",
    customerId: "customer-1",
    createdByUserId: "admin-1",
    title: "Salon perde dikimi",
    customerName: "Ayşe Yılmaz",
    details: ["Tül", "Fon"],
    scheduledAt:
      "2026-08-06T08:00:00.000Z",
    dueAt:
      "2026-08-07T08:00:00.000Z",
    status: "ASSIGNED",
    createdAt:
      "2026-08-06T07:00:00.000Z",
    updatedAt:
      "2026-08-06T07:00:00.000Z",
    ...input
  };
}

test("search matches customer, party and details", () => {
  const item = operation({
    party: {
      id: "provider-1",
      name: "Mehmet Terzi",
      assignmentType: "EXTERNAL",
      providerCustomerId:
        "provider-1"
    }
  });

  assert.equal(
    matchesOperationSearch(
      item,
      "ayşe"
    ),
    true
  );
  assert.equal(
    matchesOperationSearch(
      item,
      "mehmet"
    ),
    true
  );
  assert.equal(
    matchesOperationSearch(
      item,
      "fon"
    ),
    true
  );
  assert.equal(
    matchesOperationSearch(
      item,
      "bulunmaz"
    ),
    false
  );
});

test("attention reasons are structured and deterministic", () => {
  const reasons =
    deriveOperationAttention(
      operation({
        dueAt:
          "2026-08-06T09:00:00.000Z",
        priority: "URGENT",
        status: "PROBLEM"
      }),
      new Date(
        "2026-08-06T10:00:00.000Z"
      )
    );

  assert.deepEqual(
    reasons.map(item => item.code),
    [
      "OVERDUE",
      "PROBLEM",
      "URGENT"
    ]
  );
});

test("summary derives command-center counts without mutating domain state", () => {
  const now =
    new Date(
      "2026-08-06T10:00:00.000Z"
    );

  const result =
    buildOperationCommandCenterSummary(
      [
        operation({
          id: "late",
          dueAt:
            "2026-08-06T09:00:00.000Z"
        }),
        operation({
          id: "soon",
          dueAt:
            "2026-08-07T08:00:00.000Z"
        }),
        operation({
          id: "problem",
          status: "PROBLEM",
          dueAt:
            "2026-08-08T08:00:00.000Z"
        }),
        operation({
          id: "done",
          status: "COMPLETED",
          dueAt:
            "2026-08-05T08:00:00.000Z"
        })
      ],
      now
    );

  assert.deepEqual(
    result,
    {
      total: 4,
      active: 3,
      critical: 2,
      dueSoon: 1,
      problem: 1,
      completed: 1
    }
  );
});

test("next status is resolved by the domain transition engine, not a UI transition table", () => {
  const result =
    resolveNextAllowedOperationStatus(
      operation({
        status: "CANCELLED"
      }),
      {
        userId: "admin-1",
        role: "ADMIN"
      },
      "2026-08-06T10:00:00.000Z"
    );

  assert.equal(
    result,
    null
  );
});