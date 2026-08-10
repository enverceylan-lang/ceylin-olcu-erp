import assert from "node:assert/strict";
import test from "node:test";

import {
  routeInstallationAfterTailorCompletion
} from "../src/lib/tailorCompletionInstallationCoordinator";
import type {
  OperationRecord
} from "../src/lib/operationsWorkflow";

const baseOperation: OperationRecord = {
  tenantId: "tenant-a",
  companyId: "company-a",
  branchId: "branch-a",
  accountingPeriodId: "period-a",
  id: "tailor-op-1",
  idempotencyKey: "TAILOR:tailor-op-1",
  kind: "TAILOR",
  sourceId: "sale-1",
  saleId: "sale-1",
  customerId: "customer-1",
  customerName: "Customer",
  title: "Tailor",
  details: [],
  scheduledAt: "2026-08-08T08:00:00.000Z",
  dueAt: "2026-08-08T12:00:00.000Z",
  status: "COMPLETED",
  createdByUserId: "admin-1",
  createdAt: "2026-08-08T07:00:00.000Z",
  updatedAt: "2026-08-08T10:00:00.000Z",
  completedAt: "2026-08-08T10:00:00.000Z"
};

test(
  "non-tailor operation fails closed before installation routing",
  () => {
    const result =
      routeInstallationAfterTailorCompletion({
        operation: {
          ...baseOperation,
          kind: "GENERAL"
        },
        actorUserId: "admin-1",
        now: "2026-08-08T10:01:00.000Z"
      });

    assert.deepEqual(
      result,
      {
        outcome: "REJECTED",
        reason: "NOT_TAILOR"
      }
    );
  }
);

test(
  "incomplete tailor fails closed before installation routing",
  () => {
    const result =
      routeInstallationAfterTailorCompletion({
        operation: {
          ...baseOperation,
          status: "IN_PROGRESS",
          completedAt: undefined
        },
        actorUserId: "admin-1",
        now: "2026-08-08T10:01:00.000Z"
      });

    assert.deepEqual(
      result,
      {
        outcome: "REJECTED",
        reason: "NOT_COMPLETED"
      }
    );
  }
);

console.log(
  "TAILOR_COMPLETION_INSTALLATION_COORDINATOR_TEST: PAK"
);