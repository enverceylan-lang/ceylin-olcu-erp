import assert from "node:assert/strict";
import type {
  OperationRecord
} from "../src/lib/operationsWorkflow";
import {
  createProviderEarningsPendingDraft
} from "../src/lib/providerEarningsPendingDraftService";

const scope = {
  tenantId:
    "tenant-1",

  companyId:
    "company-1",

  branchId:
    "branch-1",

  accountingPeriodId:
    "period-1"
};

function operation(
  overrides:
    Partial<OperationRecord> = {}
): OperationRecord {
  return {
    ...scope,

    id:
      "operation-1",

    idempotencyKey:
      "TAILOR:sale-1:provider-cari-1",

    kind:
      "TAILOR",

    sourceId:
      "sale-1",

    saleId:
      "sale-1",

    customerId:
      "customer-1",

    customerName:
      "Örnek Müşteri",

    title:
      "Salon Tül Dikim İşi",

    details: [
      "Salon — Tül"
    ],

    party: {
      id:
        "provider-cari-1",

      name:
        "Örnek Terzi"
    },

    scheduledAt:
      "2026-07-29T08:00:00.000Z",

    dueAt:
      "2026-07-30T17:00:00.000Z",

    status:
      "COMPLETED",

    completedAt:
      "2026-07-29T12:00:00.000Z",

    createdByUserId:
      "admin-1",

    createdAt:
      "2026-07-29T07:00:00.000Z",

    updatedAt:
      "2026-07-29T12:00:00.000Z",

    ...overrides
  };
}

const emptyState = {
  drafts: []
};

const pending =
  createProviderEarningsPendingDraft({
    state:
      emptyState,

    operation:
      operation(),

    draftId:
      "draft-1",

    currency:
      "TRY",

    occurredAt:
      "2026-07-29T12:00:01.000Z"
  });

assert.equal(
  pending.outcome,
  "CREATED"
);

if (
  pending.outcome !==
  "CREATED"
) {
  throw new Error(
    "Bekleyen taslak oluşturulamadı."
  );
}

assert.equal(
  pending.draft.status,
  "PENDING_AMOUNT"
);

assert.equal(
  pending.draft.estimatedAmount,
  null
);

assert.equal(
  pending.draft.providerCustomerId,
  "provider-cari-1"
);

assert.equal(
  pending.draft.providerType,
  "TAILOR"
);

assert.equal(
  pending.draft.tenantId,
  "tenant-1"
);

assert.equal(
  pending.draft.companyId,
  "company-1"
);

assert.equal(
  pending.draft.branchId,
  "branch-1"
);

assert.equal(
  pending.draft.accountingPeriodId,
  "period-1"
);

const replay =
  createProviderEarningsPendingDraft({
    state:
      pending.state,

    operation:
      operation(),

    draftId:
      "draft-different-id",

    currency:
      "EUR",

    estimatedAmount:
      9999,

    occurredAt:
      "2026-07-29T13:00:00.000Z"
  });

assert.equal(
  replay.outcome,
  "REPLAY"
);

assert.equal(
  replay.state,
  pending.state
);

assert.equal(
  replay.draft.id,
  "draft-1"
);

assert.equal(
  replay.draft.currency,
  "TRY"
);

assert.equal(
  replay.draft.estimatedAmount,
  null
);

const ready =
  createProviderEarningsPendingDraft({
    state:
      emptyState,

    operation:
      operation({
        id:
          "operation-2",

        idempotencyKey:
          "TAILOR:sale-2:provider-cari-1",

        sourceId:
          "sale-2",

        saleId:
          "sale-2"
      }),

    draftId:
      "draft-2",

    currency:
      "TRY",

    estimatedAmount:
      1250.555,

    occurredAt:
      "2026-07-29T12:00:01.000Z"
  });

assert.equal(
  ready.outcome,
  "CREATED"
);

if (
  ready.outcome ===
  "CREATED"
) {
  assert.equal(
    ready.draft.status,
    "READY"
  );

  assert.equal(
    ready.draft.estimatedAmount,
    1250.56
  );
}

const installer =
  createProviderEarningsPendingDraft({
    state:
      emptyState,

    operation:
      operation({
        id:
          "operation-installation-1",

        kind:
          "INSTALLATION",

        party: {
          id:
            "installer-cari-1",

          name:
            "Örnek Montajcı"
        }
      }),

    draftId:
      "draft-installation-1",

    currency:
      "TRY",

    occurredAt:
      "2026-07-29T12:00:01.000Z"
  });

assert.equal(
  installer.outcome,
  "CREATED"
);

if (
  installer.outcome ===
  "CREATED"
) {
  assert.equal(
    installer.draft.providerType,
    "INSTALLER"
  );
}

const notCompleted =
  createProviderEarningsPendingDraft({
    state:
      emptyState,

    operation:
      operation({
        status:
          "IN_PROGRESS",

        completedAt:
          undefined
      }),

    draftId:
      "draft-not-completed",

    currency:
      "TRY",

    occurredAt:
      "2026-07-29T12:00:01.000Z"
  });

assert.equal(
  notCompleted.outcome,
  "REJECTED"
);

if (
  notCompleted.outcome ===
  "REJECTED"
) {
  assert.equal(
    notCompleted.reason,
    "OPERATION_NOT_COMPLETED"
  );
}

const unsupported =
  createProviderEarningsPendingDraft({
    state:
      emptyState,

    operation:
      operation({
        kind:
          "GENERAL"
      }),

    draftId:
      "draft-general",

    currency:
      "TRY",

    occurredAt:
      "2026-07-29T12:00:01.000Z"
  });

assert.equal(
  unsupported.outcome,
  "REJECTED"
);

if (
  unsupported.outcome ===
  "REJECTED"
) {
  assert.equal(
    unsupported.reason,
    "UNSUPPORTED_OPERATION_KIND"
  );
}

const missingProvider =
  createProviderEarningsPendingDraft({
    state:
      emptyState,

    operation:
      operation({
        party:
          undefined
      }),

    draftId:
      "draft-no-provider",

    currency:
      "TRY",

    occurredAt:
      "2026-07-29T12:00:01.000Z"
  });

assert.equal(
  missingProvider.outcome,
  "REJECTED"
);

if (
  missingProvider.outcome ===
  "REJECTED"
) {
  assert.equal(
    missingProvider.reason,
    "PROVIDER_NOT_ASSIGNED"
  );
}

const invalidAmount =
  createProviderEarningsPendingDraft({
    state:
      emptyState,

    operation:
      operation(),

    draftId:
      "draft-invalid-amount",

    currency:
      "TRY",

    estimatedAmount:
      -1,

    occurredAt:
      "2026-07-29T12:00:01.000Z"
  });

assert.equal(
  invalidAmount.outcome,
  "REJECTED"
);

if (
  invalidAmount.outcome ===
  "REJECTED"
) {
  assert.equal(
    invalidAmount.reason,
    "INVALID_ESTIMATED_AMOUNT"
  );
}

const serialized =
  JSON.stringify(
    pending
  );

assert.doesNotMatch(
  serialized,
  /password|token|hash|secret/
);

assert.doesNotMatch(
  serialized,
  /financeTransaction|paymentCommand|cashBalanceMutation/
);

console.log(
  "PROVIDER_EARNINGS_PENDING_DRAFT_TEST: PAK"
);