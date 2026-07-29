import assert from "node:assert/strict";
import type {
  OperationRecord
} from "../src/lib/operationsWorkflow";
import {
  createEstimatedEarningFromCompletedOperation
} from "../src/lib/providerCompletionEarningsBridge";
import type {
  ProviderEarningsLedgerState
} from "../src/lib/providerEarningsLedgerService";

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

const emptyState:
  ProviderEarningsLedgerState = {
    entries: [],
    paymentSnapshots: []
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

const created =
  createEstimatedEarningFromCompletedOperation({
    state:
      emptyState,

    operation:
      operation(),

    earningsEntryId:
      "earning-1",

    currency:
      "TRY",

    estimatedAmount:
      1500
  });

assert.equal(
  created.outcome,
  "CREATED"
);

if (
  created.outcome !==
  "CREATED"
) {
  throw new Error(
    "Hakediş taslağı oluşturulamadı."
  );
}

assert.equal(
  created.entry.operationId,
  "operation-1"
);

assert.equal(
  created.entry.providerCustomerId,
  "provider-cari-1"
);

assert.equal(
  created.entry.providerType,
  "TAILOR"
);

assert.equal(
  created.entry.status,
  "ESTIMATED"
);

assert.equal(
  created.entry.estimatedAmount,
  1500
);

assert.equal(
  created.entry.finalizedAmount,
  0
);

assert.equal(
  created.entry.paidAmount,
  0
);

assert.equal(
  created.entry.currency,
  "TRY"
);

assert.equal(
  created.entry.tenantId,
  "tenant-1"
);

assert.equal(
  created.entry.companyId,
  "company-1"
);

assert.equal(
  created.entry.branchId,
  "branch-1"
);

assert.equal(
  created.entry.accountingPeriodId,
  "period-1"
);

const replay =
  createEstimatedEarningFromCompletedOperation({
    state:
      created.state,

    operation:
      operation(),

    earningsEntryId:
      "earning-different-id",

    currency:
      "TRY",

    estimatedAmount:
      9999
  });

assert.equal(
  replay.outcome,
  "REPLAY"
);

assert.equal(
  replay.state,
  created.state
);

const installerCreated =
  createEstimatedEarningFromCompletedOperation({
    state:
      emptyState,

    operation:
      operation({
        id:
          "operation-installation-1",

        idempotencyKey:
          "INSTALLATION:sale-1:installer-cari-1",

        kind:
          "INSTALLATION",

        party: {
          id:
            "installer-cari-1",

          name:
            "Örnek Montajcı"
        }
      }),

    earningsEntryId:
      "earning-installation-1",

    currency:
      "TRY",

    estimatedAmount:
      750
  });

assert.equal(
  installerCreated.outcome,
  "CREATED"
);

if (
  installerCreated.outcome ===
  "CREATED"
) {
  assert.equal(
    installerCreated.entry.providerType,
    "INSTALLER"
  );
}

const notCompleted =
  createEstimatedEarningFromCompletedOperation({
    state:
      emptyState,

    operation:
      operation({
        status:
          "IN_PROGRESS",

        completedAt:
          undefined
      }),

    earningsEntryId:
      "earning-not-completed",

    currency:
      "TRY",

    estimatedAmount:
      1000
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

const unsupportedKind =
  createEstimatedEarningFromCompletedOperation({
    state:
      emptyState,

    operation:
      operation({
        kind:
          "GENERAL"
      }),

    earningsEntryId:
      "earning-general",

    currency:
      "TRY",

    estimatedAmount:
      1000
  });

assert.equal(
  unsupportedKind.outcome,
  "REJECTED"
);

if (
  unsupportedKind.outcome ===
  "REJECTED"
) {
  assert.equal(
    unsupportedKind.reason,
    "UNSUPPORTED_OPERATION_KIND"
  );
}

const missingProvider =
  createEstimatedEarningFromCompletedOperation({
    state:
      emptyState,

    operation:
      operation({
        party:
          undefined
      }),

    earningsEntryId:
      "earning-no-provider",

    currency:
      "TRY",

    estimatedAmount:
      1000
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
  createEstimatedEarningFromCompletedOperation({
    state:
      emptyState,

    operation:
      operation(),

    earningsEntryId:
      "earning-invalid-amount",

    currency:
      "TRY",

    estimatedAmount:
      -1
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

const missingCompletedAt =
  createEstimatedEarningFromCompletedOperation({
    state:
      emptyState,

    operation:
      operation({
        completedAt:
          undefined
      }),

    earningsEntryId:
      "earning-no-completed-at",

    currency:
      "TRY",

    estimatedAmount:
      1000
  });

assert.equal(
  missingCompletedAt.outcome,
  "REJECTED"
);

if (
  missingCompletedAt.outcome ===
  "REJECTED"
) {
  assert.equal(
    missingCompletedAt.reason,
    "INVALID_COMPLETED_AT"
  );
}

const differentCurrency =
  createEstimatedEarningFromCompletedOperation({
    state:
      emptyState,

    operation:
      operation(),

    earningsEntryId:
      "earning-eur",

    currency:
      "EUR",

    estimatedAmount:
      100
  });

assert.equal(
  differentCurrency.outcome,
  "CREATED"
);

if (
  differentCurrency.outcome ===
  "CREATED"
) {
  assert.equal(
    differentCurrency.entry.currency,
    "EUR"
  );
}

const serialized =
  JSON.stringify(
    created
  );

assert.doesNotMatch(
  serialized,
  /password|token|hash|secret/
);

assert.doesNotMatch(
  serialized,
  /financeTransaction|cashMutation|paymentCommand|purchaseDocument/
);

console.log(
  "PROVIDER_COMPLETION_EARNINGS_BRIDGE_TEST: PAK"
);