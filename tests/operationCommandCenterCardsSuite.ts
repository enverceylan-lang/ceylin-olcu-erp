import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOperationTimeline,
  deriveOperationReadiness,
  deriveOperationRisk
} from "../src/lib/operationCommandCenterView";
import type {
  OperationRecord
} from "../src/lib/operationsWorkflow";

function operation(
  patch: Partial<OperationRecord> = {}
): OperationRecord {
  return {
    tenantId: "tenant-1",
    companyId: "company-1",
    branchId: "branch-1",
    accountingPeriodId: "period-1",
    id: "operation-1",
    idempotencyKey: "operation-1",
    kind: "INSTALLATION",
    sourceId: "sale-1",
    saleId: "sale-1",
    customerId: "customer-1",
    customerName: "Test Cari",
    title: "Montaj işi",
    details: ["Salon"],
    party: {
      id: "internal-user:installer-1",
      userId: "installer-1",
      name: "Montajcı",
      assignmentType: "INTERNAL"
    },
    scheduledAt: "2026-08-06T08:00:00.000Z",
    dueAt: "2026-08-07T08:00:00.000Z",
    status: "IN_PROGRESS",
    priority: "NORMAL",
    createdByUserId: "admin-1",
    createdAt: "2026-08-05T08:00:00.000Z",
    updatedAt: "2026-08-06T09:00:00.000Z",
    ...patch
  };
}

test(
  "readiness marks problem operation as blocked",
  () => {
    const result =
      deriveOperationReadiness(
        operation({
          status: "PROBLEM"
        })
      );

    assert.equal(
      result.code,
      "BLOCKED"
    );
  }
);

test(
  "readiness never invents assignment for unassigned installation",
  () => {
    const result =
      deriveOperationReadiness(
        operation({
          status: "DRAFT",
          party: undefined
        })
      );

    assert.equal(
      result.code,
      "BLOCKED"
    );

    assert.match(
      result.message,
      /atan/i
    );
  }
);

test(
  "risk derives overdue operation from real dueAt",
  () => {
    const result =
      deriveOperationRisk(
        operation({
          dueAt:
            "2026-08-05T08:00:00.000Z"
        }),
        new Date(
          "2026-08-06T08:00:00.000Z"
        )
      );

    assert.equal(
      result.level,
      "HIGH"
    );

    assert.ok(
      result.reasons.some(
        item =>
          item.code === "OVERDUE"
      )
    );
  }
);

test(
  "timeline contains only timestamps that really exist",
  () => {
    const result =
      buildOperationTimeline(
        operation({
          sentAt:
            "2026-08-05T10:00:00.000Z",
          updatedAt:
            "2026-08-06T09:00:00.000Z",
          completedAt: undefined
        })
      );

    assert.deepEqual(
      result.map(item => item.code),
      [
        "CREATED",
        "SENT",
        "UPDATED"
      ]
    );
  }
);

test(
  "completed timestamp becomes final truthful timeline event",
  () => {
    const result =
      buildOperationTimeline(
        operation({
          status: "COMPLETED",
          updatedAt:
            "2026-08-06T11:00:00.000Z",
          completedAt:
            "2026-08-06T11:00:00.000Z"
        })
      );

    assert.equal(
      result.at(-1)?.code,
      "COMPLETED"
    );
  }
);