import assert from "node:assert/strict";
import type {
  OperationRecord
} from "../src/lib/operationsWorkflow";
import {
  decideProviderWorkVisibility
} from "../src/lib/providerWorkVisibilityPolicy";
import {
  listProviderMyWork
} from "../src/lib/providerMyWorkService";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

function operation(
  id: string,
  kind:
    OperationRecord["kind"],
  partyId: string,
  status:
    OperationRecord["status"],
  dueAt:
    string
): OperationRecord {
  return {
    ...scope,

    id,
    idempotencyKey: id,

    kind,

    sourceId: "sale-1",
    saleId: "sale-1",

    parentOperationId:
      "general-operation:sale-1",

    customerId:
      "customer-1",

    customerName:
      "Test Müşteri",

    title: id,

    details: [
      "Salon — Tül"
    ],

    party: {
      id: partyId,
      name: partyId
    },

    scheduledAt:
      "2026-07-29T08:00:00.000Z",

    dueAt,

    status,

    createdByUserId:
      "admin-1",

    createdAt:
      "2026-07-29T08:00:00.000Z",

    updatedAt:
      "2026-07-29T08:00:00.000Z"
  };
}

const tailorActor = {
  ...scope,
  userId: "tailor-user-1",
  role: "TAILOR"
};

const tailorLink = {
  userId: "tailor-user-1",
  providerCustomerId:
    "tailor-cari-1",
  providerType:
    "TAILOR" as const
};

const ownTailorWork =
  operation(
    "tailor-own",
    "TAILOR",
    "tailor-cari-1",
    "IN_PROGRESS",
    "2026-07-28T17:00:00.000Z"
  );

const anotherTailorWork =
  operation(
    "tailor-other",
    "TAILOR",
    "tailor-cari-2",
    "ASSIGNED",
    "2026-07-30T17:00:00.000Z"
  );

const installerWork =
  operation(
    "installer-own",
    "INSTALLATION",
    "installer-cari-1",
    "ASSIGNED",
    "2026-07-30T17:00:00.000Z"
  );

const completedOwnWork =
  operation(
    "tailor-completed",
    "TAILOR",
    "tailor-cari-1",
    "COMPLETED",
    "2026-07-27T17:00:00.000Z"
  );

const ownDecision =
  decideProviderWorkVisibility(
    tailorActor,
    ownTailorWork,
    tailorLink
  );

assert.equal(
  ownDecision.visible,
  true
);

assert.equal(
  ownDecision.reason,
  "VISIBLE_AS_PROVIDER"
);

const otherDecision =
  decideProviderWorkVisibility(
    tailorActor,
    anotherTailorWork,
    tailorLink
  );

assert.equal(
  otherDecision.visible,
  false
);

assert.equal(
  otherDecision.reason,
  "OPERATION_PARTY_MISMATCH"
);

const wrongKindDecision =
  decideProviderWorkVisibility(
    tailorActor,
    installerWork,
    tailorLink
  );

assert.equal(
  wrongKindDecision.visible,
  false
);

assert.equal(
  wrongKindDecision.reason,
  "PROVIDER_TYPE_MISMATCH"
);

const missingLinkDecision =
  decideProviderWorkVisibility(
    tailorActor,
    ownTailorWork
  );

assert.equal(
  missingLinkDecision.visible,
  false
);

assert.equal(
  missingLinkDecision.reason,
  "PROVIDER_LINK_REQUIRED"
);

const myWork =
  listProviderMyWork(
    [
      ownTailorWork,
      anotherTailorWork,
      installerWork,
      completedOwnWork
    ],
    {
      actor:
        tailorActor,

      link:
        tailorLink,

      includeCompleted:
        false
    },
    "2026-07-29T12:00:00.000Z"
  );

assert.equal(
  myWork.operations.length,
  1
);

assert.equal(
  myWork.operations[0].id,
  "tailor-own"
);

assert.equal(
  myWork.summary.total,
  1
);

assert.equal(
  myWork.summary.active,
  1
);

assert.equal(
  myWork.summary.overdue,
  1
);

const withCompleted =
  listProviderMyWork(
    [
      ownTailorWork,
      completedOwnWork
    ],
    {
      actor:
        tailorActor,

      link:
        tailorLink,

      includeCompleted:
        true
    },
    "2026-07-29T12:00:00.000Z"
  );

assert.equal(
  withCompleted.operations.length,
  2
);

assert.equal(
  withCompleted.summary.completed,
  1
);

const adminResult =
  listProviderMyWork(
    [
      ownTailorWork,
      anotherTailorWork,
      installerWork
    ],
    {
      actor: {
        ...scope,
        userId:
          "admin-1",
        role:
          "ADMIN"
      },

      includeCompleted:
        true
    },
    "2026-07-29T12:00:00.000Z"
  );

assert.equal(
  adminResult.operations.length,
  3
);

console.log(
  "PROVIDER_MY_WORK_SERVICE_TEST: PAK"
);