import assert from "node:assert/strict";
import {
  decideInstallationScheduleConflict
} from "../src/lib/installationScheduleConflictGuard";
import type {
  OperationRecord
} from "../src/lib/operationsWorkflow";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

function installation(
  patch: Partial<OperationRecord> = {}
): OperationRecord {
  return {
    ...scope,
    id: "installation-1",
    idempotencyKey: "INSTALLATION:1",
    kind: "INSTALLATION",
    sourceId: "sale-1",
    saleId: "sale-1",
    parentOperationId: "general-1",
    customerId: "customer-1",
    customerName: "Cari 1",
    title: "Montaj",
    details: [],
    party: {
      id: "internal-user:installer-1",
      userId: "installer-1",
      name: "Montajcı 1",
      assignmentType: "INTERNAL"
    },
    scheduledAt: "2026-08-11T08:00:00.000Z",
    dueAt: "2026-08-11T10:00:00.000Z",
    status: "ASSIGNED",
    createdByUserId: "admin-1",
    createdAt: "2026-08-10T20:00:00.000Z",
    updatedAt: "2026-08-10T20:00:00.000Z",
    ...patch
  };
}

const conflict =
  decideInstallationScheduleConflict(
    {
      ...scope,
      partyId: "internal-user:installer-1",
      scheduledAt: "2026-08-11T09:00:00.000Z",
      dueAt: "2026-08-11T11:00:00.000Z"
    },
    [installation()]
  );

assert.equal(conflict.allowed, false);
if (!conflict.allowed) {
  assert.equal(conflict.reason, "SCHEDULE_CONFLICT");
  assert.equal(
    conflict.conflictingOperationId,
    "installation-1"
  );
}

const touchingBoundary =
  decideInstallationScheduleConflict(
    {
      ...scope,
      partyId: "internal-user:installer-1",
      scheduledAt: "2026-08-11T10:00:00.000Z",
      dueAt: "2026-08-11T12:00:00.000Z"
    },
    [installation()]
  );

assert.equal(touchingBoundary.allowed, true);

const otherResource =
  decideInstallationScheduleConflict(
    {
      ...scope,
      partyId: "internal-user:installer-2",
      scheduledAt: "2026-08-11T09:00:00.000Z",
      dueAt: "2026-08-11T11:00:00.000Z"
    },
    [installation()]
  );

assert.equal(otherResource.allowed, true);

const otherScope =
  decideInstallationScheduleConflict(
    {
      ...scope,
      branchId: "branch-2",
      partyId: "internal-user:installer-1",
      scheduledAt: "2026-08-11T09:00:00.000Z",
      dueAt: "2026-08-11T11:00:00.000Z"
    },
    [installation()]
  );

assert.equal(otherScope.allowed, true);

const completedIgnored =
  decideInstallationScheduleConflict(
    {
      ...scope,
      partyId: "internal-user:installer-1",
      scheduledAt: "2026-08-11T09:00:00.000Z",
      dueAt: "2026-08-11T11:00:00.000Z"
    },
    [
      installation({
        status: "COMPLETED"
      })
    ]
  );

assert.equal(completedIgnored.allowed, true);

const invalidExisting =
  decideInstallationScheduleConflict(
    {
      ...scope,
      partyId: "internal-user:installer-1",
      scheduledAt: "2026-08-11T09:00:00.000Z",
      dueAt: "2026-08-11T11:00:00.000Z"
    },
    [
      installation({
        scheduledAt: "not-a-date"
      })
    ]
  );

assert.equal(invalidExisting.allowed, false);
if (!invalidExisting.allowed) {
  assert.equal(
    invalidExisting.reason,
    "INVALID_EXISTING_SCHEDULE"
  );
}

console.log(
  "[PASS] installationScheduleConflictGuardSuite"
);