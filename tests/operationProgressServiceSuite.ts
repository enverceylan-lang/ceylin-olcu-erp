import assert from "node:assert/strict";
import {
  buildOperationProgressSummary,
  listChildOperations
} from "../src/lib/operationProgressService";
import type {
  OperationRecord
} from "../src/lib/operationsWorkflow";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

const parent: OperationRecord = {
  ...scope,

  id: "general-operation:sale-1",
  idempotencyKey: "GENERAL:sale-1",
  kind: "GENERAL",

  sourceId: "sale-1",
  saleId: "sale-1",

  customerId: "customer-1",
  customerName: "Test Cari",

  title: "Genel İş Takibi — SAT-1",
  details: ["Salon — Tül"],

  scheduledAt:
    "2026-07-29T08:00:00.000Z",

  dueAt:
    "2026-07-29T08:00:00.000Z",

  status: "DRAFT",

  createdByUserId: "admin-1",
  createdAt:
    "2026-07-29T08:00:00.000Z",
  updatedAt:
    "2026-07-29T08:00:00.000Z"
};

function child(
  id: string,
  status: OperationRecord["status"],
  kind: Exclude<
    OperationRecord["kind"],
    "GENERAL"
  >
): OperationRecord {
  return {
    ...scope,

    id,
    idempotencyKey: id,
    kind,

    sourceId: parent.sourceId,
    saleId: parent.saleId,
    parentOperationId: parent.id,

    customerId: parent.customerId,
    customerName: parent.customerName,

    title: id,
    details: [...parent.details],

    scheduledAt:
      "2026-07-29T09:00:00.000Z",

    dueAt:
      "2026-07-30T17:00:00.000Z",

    status,

    createdByUserId: "admin-1",
    createdAt:
      "2026-07-29T08:00:00.000Z",
    updatedAt:
      "2026-07-29T08:00:00.000Z"
  };
}

const operations: OperationRecord[] = [
  parent,
  child(
    "tailor-1",
    "COMPLETED",
    "TAILOR"
  ),
  child(
    "supplier-1",
    "IN_PROGRESS",
    "SUPPLIER"
  ),
  child(
    "installation-1",
    "PROBLEM",
    "INSTALLATION"
  ),
  {
    ...child(
      "other-sale-child",
      "COMPLETED",
      "TAILOR"
    ),
    saleId: "sale-2",
    parentOperationId:
      "general-operation:sale-2"
  }
];

const children =
  listChildOperations(
    parent,
    operations
  );

assert.equal(
  children.length,
  3
);

const summary =
  buildOperationProgressSummary(
    parent,
    operations
  );

assert.equal(
  summary.total,
  3
);

assert.equal(
  summary.completed,
  1
);

assert.equal(
  summary.problem,
  1
);

assert.equal(
  summary.active,
  2
);

assert.equal(
  summary.progressPercent,
  33
);

assert.equal(
  summary.children.some(
    operation =>
      operation.id ===
      "other-sale-child"
  ),
  false
);

console.log(
  "OPERATION_PROGRESS_SERVICE_TEST: PAK"
);