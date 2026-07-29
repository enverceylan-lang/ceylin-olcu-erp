import assert from "node:assert/strict";
import type {
  ProviderEarningsPendingDraft
} from "../src/lib/providerEarningsPendingDraftService";
import {
  convertProviderEarningsDraft,
  setProviderEarningsDraftAmount
} from "../src/lib/providerEarningsDraftAdminService";

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

const actor = {
  ...scope,

  userId:
    "admin-1",

  role:
    "ADMIN" as const
};

function draft(
  overrides:
    Partial<ProviderEarningsPendingDraft> = {}
): ProviderEarningsPendingDraft {
  return {
    id:
      "draft-1",

    ...scope,

    operationId:
      "operation-1",

    providerCustomerId:
      "provider-cari-1",

    providerType:
      "TAILOR",

    title:
      "Salon Tül Dikim İşi",

    currency:
      "TRY",

    estimatedAmount:
      null,

    status:
      "PENDING_AMOUNT",

    completedAt:
      "2026-07-29T12:00:00.000Z",

    createdAt:
      "2026-07-29T12:00:01.000Z",

    updatedAt:
      "2026-07-29T12:00:01.000Z",

    sourceDocumentId:
      "sale-1",

    ...overrides
  };
}

const initialDraftState = {
  drafts: [
    draft()
  ]
};

const amountResult =
  setProviderEarningsDraftAmount(
    initialDraftState,
    {
      actor,

      draftId:
        "draft-1",

      providerCustomerId:
        "provider-cari-1",

      currency:
        "TRY",

      estimatedAmount:
        1250.555,

      occurredAt:
        "2026-07-29T14:00:00.000Z"
    }
  );

assert.equal(
  amountResult.outcome,
  "UPDATED"
);

if (
  amountResult.outcome !==
  "UPDATED"
) {
  throw new Error(
    "Taslak tutarı güncellenemedi."
  );
}

assert.equal(
  amountResult.draft.status,
  "READY"
);

assert.equal(
  amountResult.draft.estimatedAmount,
  1250.56
);

assert.equal(
  amountResult.draft.providerCustomerId,
  "provider-cari-1"
);

assert.equal(
  amountResult.draft.operationId,
  "operation-1"
);

assert.equal(
  amountResult.draft.tenantId,
  "tenant-1"
);

const amountReplay =
  setProviderEarningsDraftAmount(
    amountResult.state,
    {
      actor,

      draftId:
        "draft-1",

      providerCustomerId:
        "provider-cari-1",

      currency:
        "TRY",

      estimatedAmount:
        1250.56,

      occurredAt:
        "2026-07-29T14:05:00.000Z"
    }
  );

assert.equal(
  amountReplay.outcome,
  "REPLAY"
);

assert.equal(
  amountReplay.state,
  amountResult.state
);

const wrongProvider =
  setProviderEarningsDraftAmount(
    initialDraftState,
    {
      actor,

      draftId:
        "draft-1",

      providerCustomerId:
        "provider-cari-2",

      currency:
        "TRY",

      estimatedAmount:
        1250,

      occurredAt:
        "2026-07-29T14:00:00.000Z"
    }
  );

assert.equal(
  wrongProvider.outcome,
  "REJECTED"
);

if (
  wrongProvider.outcome ===
  "REJECTED"
) {
  assert.equal(
    wrongProvider.reason,
    "PROVIDER_MISMATCH"
  );
}

const wrongCurrency =
  setProviderEarningsDraftAmount(
    initialDraftState,
    {
      actor,

      draftId:
        "draft-1",

      providerCustomerId:
        "provider-cari-1",

      currency:
        "EUR",

      estimatedAmount:
        1250,

      occurredAt:
        "2026-07-29T14:00:00.000Z"
    }
  );

assert.equal(
  wrongCurrency.outcome,
  "REJECTED"
);

if (
  wrongCurrency.outcome ===
  "REJECTED"
) {
  assert.equal(
    wrongCurrency.reason,
    "CURRENCY_MISMATCH"
  );
}

const wrongScope =
  setProviderEarningsDraftAmount(
    initialDraftState,
    {
      actor: {
        ...actor,

        companyId:
          "company-2"
      },

      draftId:
        "draft-1",

      providerCustomerId:
        "provider-cari-1",

      currency:
        "TRY",

      estimatedAmount:
        1250,

      occurredAt:
        "2026-07-29T14:00:00.000Z"
    }
  );

assert.equal(
  wrongScope.outcome,
  "REJECTED"
);

if (
  wrongScope.outcome ===
  "REJECTED"
) {
  assert.equal(
    wrongScope.reason,
    "SCOPE_MISMATCH"
  );
}

const invalidAmount =
  setProviderEarningsDraftAmount(
    initialDraftState,
    {
      actor,

      draftId:
        "draft-1",

      providerCustomerId:
        "provider-cari-1",

      currency:
        "TRY",

      estimatedAmount:
        -1,

      occurredAt:
        "2026-07-29T14:00:00.000Z"
    }
  );

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
    "INVALID_AMOUNT"
  );
}

const emptyLedgerState = {
  entries: [],
  paymentSnapshots: []
};

const converted =
  convertProviderEarningsDraft(
    amountResult.state,
    emptyLedgerState,
    {
      actor,

      draftId:
        "draft-1",

      providerCustomerId:
        "provider-cari-1",

      earningsEntryId:
        "earning-1",

      occurredAt:
        "2026-07-29T14:10:00.000Z"
    }
  );

assert.equal(
  converted.outcome,
  "CONVERTED"
);

if (
  converted.outcome !==
  "CONVERTED"
) {
  throw new Error(
    "Taslak hakedişe dönüştürülemedi."
  );
}

assert.equal(
  converted.draft.status,
  "CONVERTED"
);

assert.equal(
  converted.entry.id,
  "earning-1"
);

assert.equal(
  converted.entry.operationId,
  "operation-1"
);

assert.equal(
  converted.entry.providerCustomerId,
  "provider-cari-1"
);

assert.equal(
  converted.entry.estimatedAmount,
  1250.56
);

assert.equal(
  converted.entry.finalizedAmount,
  0
);

assert.equal(
  converted.entry.paidAmount,
  0
);

assert.equal(
  converted.entry.status,
  "ESTIMATED"
);

const replayConversion =
  convertProviderEarningsDraft(
    converted.draftState,
    converted.ledgerState,
    {
      actor,

      draftId:
        "draft-1",

      providerCustomerId:
        "provider-cari-1",

      earningsEntryId:
        "earning-different-id",

      occurredAt:
        "2026-07-29T14:15:00.000Z"
    }
  );

assert.equal(
  replayConversion.outcome,
  "REPLAY"
);

assert.equal(
  replayConversion.ledgerState,
  converted.ledgerState
);

const amountMissing =
  convertProviderEarningsDraft(
    initialDraftState,
    emptyLedgerState,
    {
      actor,

      draftId:
        "draft-1",

      providerCustomerId:
        "provider-cari-1",

      earningsEntryId:
        "earning-missing-amount",

      occurredAt:
        "2026-07-29T14:10:00.000Z"
    }
  );

assert.equal(
  amountMissing.outcome,
  "REJECTED"
);

if (
  amountMissing.outcome ===
  "REJECTED"
) {
  assert.equal(
    amountMissing.reason,
    "DRAFT_AMOUNT_REQUIRED"
  );
}

const accountingActor = {
  ...scope,

  userId:
    "accounting-1",

  role:
    "ACCOUNTING" as const
};

const accountingUpdate =
  setProviderEarningsDraftAmount(
    initialDraftState,
    {
      actor:
        accountingActor,

      draftId:
        "draft-1",

      providerCustomerId:
        "provider-cari-1",

      currency:
        "TRY",

      estimatedAmount:
        900,

      occurredAt:
        "2026-07-29T14:00:00.000Z"
    }
  );

assert.equal(
  accountingUpdate.outcome,
  "UPDATED"
);

const serialized =
  JSON.stringify(
    converted
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
  "PROVIDER_EARNINGS_DRAFT_ADMIN_SERVICE_TEST: PAK"
);