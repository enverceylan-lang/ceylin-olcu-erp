import assert from "node:assert/strict";
import {
  decideOperationCreation,
  decideOperationTransition,
  type OperationRecord
} from "../src/lib/operationsWorkflow";
import {
  canViewOperation
} from "../src/lib/operationAccessPolicy";
import {
  listVisibleOperationsForUser
} from "../src/lib/operationsRepository";
import {
  decideProviderWorkVisibility
} from "../src/lib/providerWorkVisibilityPolicy";
import {
  createProviderEarningsPendingDraft
} from "../src/lib/providerEarningsPendingDraftService";

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
    id: "operation-tailor-1",
    idempotencyKey:
      "TAILOR:operation-main-1:cari-tailor-1",
    kind: "TAILOR",
    sourceId: "sale-1",
    saleId: "sale-1",
    parentOperationId: "operation-main-1",
    customerId: "customer-1",
    customerName: "Müşteri",
    title: "Terzi işi",
    details: ["Tül dikimi"],
    party: {
      id: "cari-tailor-1",
      userId: "user-tailor-1",
      name: "Terzi 1",
      assignmentType: "EXTERNAL",
      providerCustomerId: "cari-tailor-1"
    },
    scheduledAt:
      "2026-08-03T08:00:00.000Z",
    dueAt:
      "2026-08-05T17:00:00.000Z",
    status: "ASSIGNED",
    createdByUserId: "admin-1",
    createdAt:
      "2026-08-03T07:00:00.000Z",
    updatedAt:
      "2026-08-03T07:00:00.000Z",
    ...overrides
  };
}

const created =
  decideOperationCreation(
    operation(),
    []
  );

assert.equal(
  created.outcome,
  "CREATE"
);

console.log(
  "[PASS] providerOperationRequiresDualIdentityAndAcceptsValidParty"
);

const missingUserIdentity =
  decideOperationCreation(
    operation({
      party: {
        id: "cari-tailor-1",
        name: "Terzi 1"
      }
    }),
    []
  );

assert.equal(
  missingUserIdentity.outcome,
  "REJECT"
);

console.log(
  "[PASS] providerOperationFailsClosedWithoutAssignedUserId"
);

assert.equal(
  canViewOperation(
    operation(),
    scope,
    {
      userId: "user-tailor-1",
      role: "TAILOR"
    }
  ),
  true
);

assert.equal(
  canViewOperation(
    operation(),
    scope,
    {
      userId: "user-tailor-2",
      role: "TAILOR"
    }
  ),
  false
);

console.log(
  "[PASS] operationAccessUsesPartyUserId"
);

const visible =
  listVisibleOperationsForUser(
    {
      operations: [operation()],
      agendaEvents: []
    },
    scope,
    {
      userId: "user-tailor-1",
      role: "TAILOR"
    }
  );

assert.equal(
  visible.length,
  1
);

console.log(
  "[PASS] repositoryVisibilityUsesPartyUserId"
);

const transition =
  decideOperationTransition(
    operation({
      status: "ACCEPTED"
    }),
    "IN_PROGRESS",
    {
      userId: "user-tailor-1",
      role: "TAILOR"
    },
    "2026-08-03T09:00:00.000Z"
  );

assert.equal(
  transition.allowed,
  true
);

console.log(
  "[PASS] workflowAssignmentUsesPartyUserId"
);

const providerVisibility =
  decideProviderWorkVisibility(
    {
      ...scope,
      userId: "user-tailor-1",
      role: "TAILOR"
    },
    operation(),
    {
      userId: "user-tailor-1",
      providerCustomerId:
        "cari-tailor-1",
      providerType: "TAILOR"
    }
  );

assert.equal(
  providerVisibility.visible,
  true
);

console.log(
  "[PASS] providerPortalVisibilityUsesPartyProviderCustomerId"
);

const completed =
  operation({
    status: "COMPLETED",
    completedAt:
      "2026-08-03T10:00:00.000Z"
  });

const draft =
  createProviderEarningsPendingDraft({
    state: {
      drafts: []
    },
    operation: completed,
    draftId:
      "provider-earning-draft:operation-tailor-1",
    currency: "TRY",
    occurredAt:
      "2026-08-03T10:00:00.000Z"
  });

assert.equal(
  draft.outcome,
  "CREATED"
);

if (draft.outcome === "CREATED") {
  assert.equal(
    draft.draft.providerCustomerId,
    "cari-tailor-1"
  );
}

console.log(
  "[PASS] earningsUsesProviderCustomerIdNotUserId"
);

console.log(
  "[PASS] providerOperationIdentityContractSuite completed"
);