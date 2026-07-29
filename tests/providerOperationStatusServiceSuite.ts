import assert from "node:assert/strict";
import type {
  OperationRecord
} from "../src/lib/operationsWorkflow";
import type {
  ProviderWorkActor,
  ProviderWorkLinkSnapshot
} from "../src/lib/providerAccountContracts";
import {
  decideProviderStatusTransition,
  listProviderStatusActions
} from "../src/lib/providerOperationStatusService";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

const tailorActor:
  ProviderWorkActor = {
    ...scope,
    userId: "user-tailor-1",
    role: "TAILOR"
  };

const tailorLink:
  ProviderWorkLinkSnapshot = {
    userId: "user-tailor-1",
    providerCustomerId:
      "cari-tailor-1",
    providerType: "TAILOR"
  };

const installerActor:
  ProviderWorkActor = {
    ...scope,
    userId: "user-installer-1",
    role: "INSTALLER"
  };

const installerLink:
  ProviderWorkLinkSnapshot = {
    userId: "user-installer-1",
    providerCustomerId:
      "cari-installer-1",
    providerType: "INSTALLER"
  };

function buildOperation(
  overrides:
    Partial<OperationRecord> = {}
): OperationRecord {
  return {
    ...scope,

    id: "operation-1",
    idempotencyKey:
      "TAILOR:sale-1:cari-tailor-1",

    kind: "TAILOR",
    sourceId: "sale-1",
    saleId: "sale-1",

    customerId: "customer-1",
    customerName:
      "Örnek Müşteri",
    address:
      "Örnek Adres",

    title:
      "Terzi İş Ataması",

    details: [
      "Salon — Tül"
    ],

    party: {
      id: "cari-tailor-1",
      name: "Örnek Terzi"
    },

    scheduledAt:
      "2026-07-29T08:00:00.000Z",

    dueAt:
      "2026-07-30T17:00:00.000Z",

    status: "SENT",

    createdByUserId:
      "admin-1",

    createdAt:
      "2026-07-29T07:00:00.000Z",

    updatedAt:
      "2026-07-29T07:00:00.000Z",

    ...overrides
  };
}

const accept =
  decideProviderStatusTransition({
    actor: tailorActor,
    link: tailorLink,
    operation:
      buildOperation({
        status: "SENT"
      }),
    action: "ACCEPT"
  });

assert.equal(
  accept.allowed,
  true
);

assert.equal(
  accept.targetStatus,
  "ACCEPTED"
);

const acceptAssigned =
  decideProviderStatusTransition({
    actor: tailorActor,
    link: tailorLink,
    operation:
      buildOperation({
        status: "ASSIGNED"
      }),
    action: "ACCEPT"
  });

assert.equal(
  acceptAssigned.allowed,
  true
);

const start =
  decideProviderStatusTransition({
    actor: tailorActor,
    link: tailorLink,
    operation:
      buildOperation({
        status: "ACCEPTED"
      }),
    action: "START"
  });

assert.equal(
  start.targetStatus,
  "IN_PROGRESS"
);

const emptyProblem =
  decideProviderStatusTransition({
    actor: tailorActor,
    link: tailorLink,
    operation:
      buildOperation({
        status: "IN_PROGRESS"
      }),
    action: "REPORT_PROBLEM",
    problemDescription: "   "
  });

assert.equal(
  emptyProblem.allowed,
  false
);

assert.equal(
  emptyProblem.reason,
  "PROBLEM_DESCRIPTION_REQUIRED"
);

const problem =
  decideProviderStatusTransition({
    actor: tailorActor,
    link: tailorLink,
    operation:
      buildOperation({
        status: "IN_PROGRESS"
      }),
    action: "REPORT_PROBLEM",
    problemDescription:
      "Kumaşta üretim hatası var."
  });

assert.equal(
  problem.allowed,
  true
);

assert.equal(
  problem.targetStatus,
  "PROBLEM"
);

assert.equal(
  problem.normalizedProblemDescription,
  "Kumaşta üretim hatası var."
);

const resume =
  decideProviderStatusTransition({
    actor: tailorActor,
    link: tailorLink,
    operation:
      buildOperation({
        status: "PROBLEM"
      }),
    action: "RESUME"
  });

assert.equal(
  resume.targetStatus,
  "IN_PROGRESS"
);

const complete =
  decideProviderStatusTransition({
    actor: tailorActor,
    link: tailorLink,
    operation:
      buildOperation({
        status: "IN_PROGRESS"
      }),
    action:
      "REPORT_COMPLETED"
  });

assert.equal(
  complete.targetStatus,
  "COMPLETED"
);

const directComplete =
  decideProviderStatusTransition({
    actor: tailorActor,
    link: tailorLink,
    operation:
      buildOperation({
        status: "SENT"
      }),
    action:
      "REPORT_COMPLETED"
  });

assert.equal(
  directComplete.allowed,
  false
);

assert.equal(
  directComplete.reason,
  "TRANSITION_NOT_ALLOWED"
);

const completedReplay =
  decideProviderStatusTransition({
    actor: tailorActor,
    link: tailorLink,
    operation:
      buildOperation({
        status: "COMPLETED"
      }),
    action:
      "REPORT_COMPLETED"
  });

assert.equal(
  completedReplay.outcome,
  "REPLAY"
);

const cancelled =
  decideProviderStatusTransition({
    actor: tailorActor,
    link: tailorLink,
    operation:
      buildOperation({
        status: "CANCELLED"
      }),
    action: "ACCEPT"
  });

assert.equal(
  cancelled.reason,
  "OPERATION_CANCELLED"
);

const otherTailor =
  decideProviderStatusTransition({
    actor: tailorActor,
    link: tailorLink,
    operation:
      buildOperation({
        party: {
          id: "cari-tailor-2",
          name: "Başka Terzi"
        }
      }),
    action: "ACCEPT"
  });

assert.equal(
  otherTailor.allowed,
  false
);

assert.equal(
  otherTailor.reason,
  "OPERATION_NOT_VISIBLE"
);

const wrongKind =
  decideProviderStatusTransition({
    actor: tailorActor,
    link: tailorLink,
    operation:
      buildOperation({
        kind: "INSTALLATION",
        party: {
          id: "cari-tailor-1",
          name: "Örnek Terzi"
        }
      }),
    action: "ACCEPT"
  });

assert.equal(
  wrongKind.allowed,
  false
);

const installerOperation =
  buildOperation({
    id: "operation-installation-1",
    idempotencyKey:
      "INSTALLATION:sale-1:cari-installer-1",
    kind: "INSTALLATION",
    party: {
      id: "cari-installer-1",
      name: "Örnek Montajcı"
    }
  });

const installerAccept =
  decideProviderStatusTransition({
    actor: installerActor,
    link: installerLink,
    operation:
      installerOperation,
    action: "ACCEPT"
  });

assert.equal(
  installerAccept.allowed,
  true
);

const wrongScope =
  decideProviderStatusTransition({
    actor: tailorActor,
    link: tailorLink,
    operation:
      buildOperation({
        companyId: "company-2"
      }),
    action: "ACCEPT"
  });

assert.equal(
  wrongScope.allowed,
  false
);

const noLink =
  decideProviderStatusTransition({
    actor: tailorActor,
    operation:
      buildOperation(),
    action: "ACCEPT"
  });

assert.equal(
  noLink.allowed,
  false
);

assert.deepEqual(
  listProviderStatusActions(
    "SENT"
  ),
  ["ACCEPT"]
);

assert.deepEqual(
  listProviderStatusActions(
    "IN_PROGRESS"
  ),
  [
    "REPORT_PROBLEM",
    "REPORT_COMPLETED"
  ]
);

assert.deepEqual(
  listProviderStatusActions(
    "COMPLETED"
  ),
  []
);

console.log(
  "PROVIDER_OPERATION_STATUS_SERVICE_TEST: PAK"
);