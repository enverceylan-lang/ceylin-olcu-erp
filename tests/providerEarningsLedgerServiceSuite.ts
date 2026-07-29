import assert from "node:assert/strict";
import {
  createEstimatedProviderEarning,
  finalizeProviderEarning,
  registerProviderPaymentSnapshot,
  type ProviderEarningsLedgerState
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

const created =
  createEstimatedProviderEarning(
    emptyState,
    {
      ...scope,

      id:
        "earning-1",

      operationId:
        "operation-1",

      providerCustomerId:
        "provider-cari-1",

      providerType:
        "TAILOR",

      title:
        "Salon Tül Dikim İşi",

      occurredAt:
        "2026-07-29T10:00:00.000Z",

      currency:
        "TRY",

      estimatedAmount:
        1500,

      sourceDocumentId:
        "sale-1"
    }
  );

assert.equal(
  created.outcome,
  "CREATED"
);

if (
  created.outcome !==
  "CREATED"
) {
  throw new Error(
    "Tahmini hakediş oluşturulamadı."
  );
}

assert.equal(
  created.entry.status,
  "ESTIMATED"
);

assert.equal(
  created.entry.finalizedAmount,
  0
);

assert.equal(
  created.entry.paidAmount,
  0
);

const replayCreate =
  createEstimatedProviderEarning(
    created.state,
    {
      ...scope,

      id:
        "earning-different-id",

      operationId:
        "operation-1",

      providerCustomerId:
        "provider-cari-1",

      providerType:
        "TAILOR",

      title:
        "Tekrar Kayıt",

      occurredAt:
        "2026-07-29T11:00:00.000Z",

      currency:
        "TRY",

      estimatedAmount:
        9999
    }
  );

assert.equal(
  replayCreate.outcome,
  "REPLAY"
);

assert.equal(
  replayCreate.state,
  created.state
);

const finalized =
  finalizeProviderEarning(
    created.state,
    {
      ...scope,

      entryId:
        "earning-1",

      providerCustomerId:
        "provider-cari-1",

      finalizedAmount:
        1200,

      finalizedAt:
        "2026-07-29T12:00:00.000Z",

      finalizedByUserId:
        "admin-1"
    }
  );

assert.equal(
  finalized.outcome,
  "UPDATED"
);

if (
  finalized.outcome !==
  "UPDATED"
) {
  throw new Error(
    "Hakediş kesinleştirilemedi."
  );
}

assert.equal(
  finalized.entry.finalizedAmount,
  1200
);

assert.equal(
  finalized.entry.status,
  "FINALIZED"
);

const replayFinalize =
  finalizeProviderEarning(
    finalized.state,
    {
      ...scope,

      entryId:
        "earning-1",

      providerCustomerId:
        "provider-cari-1",

      finalizedAmount:
        1200,

      finalizedAt:
        "2026-07-29T12:30:00.000Z",

      finalizedByUserId:
        "admin-1"
    }
  );

assert.equal(
  replayFinalize.outcome,
  "REPLAY"
);

assert.equal(
  replayFinalize.state,
  finalized.state
);

const changedFinalize =
  finalizeProviderEarning(
    finalized.state,
    {
      ...scope,

      entryId:
        "earning-1",

      providerCustomerId:
        "provider-cari-1",

      finalizedAmount:
        1300,

      finalizedAt:
        "2026-07-29T13:00:00.000Z",

      finalizedByUserId:
        "admin-1"
    }
  );

assert.equal(
  changedFinalize.outcome,
  "REJECTED"
);

if (
  changedFinalize.outcome ===
  "REJECTED"
) {
  assert.equal(
    changedFinalize.reason,
    "ALREADY_FINALIZED"
  );
}

const firstPayment =
  registerProviderPaymentSnapshot(
    finalized.state,
    {
      ...scope,

      id:
        "snapshot-1",

      earningsEntryId:
        "earning-1",

      providerCustomerId:
        "provider-cari-1",

      providerType:
        "TAILOR",

      sourcePaymentId:
        "payment-1",

      currency:
        "TRY",

      amount:
        400,

      paidAt:
        "2026-07-29T13:00:00.000Z",

      recordedAt:
        "2026-07-29T13:01:00.000Z"
    }
  );

assert.equal(
  firstPayment.outcome,
  "UPDATED"
);

if (
  firstPayment.outcome !==
  "UPDATED"
) {
  throw new Error(
    "İlk ödeme görünümü oluşmadı."
  );
}

assert.equal(
  firstPayment.entry.paidAmount,
  400
);

assert.equal(
  firstPayment.entry.status,
  "PARTIALLY_PAID"
);

const replayPayment =
  registerProviderPaymentSnapshot(
    firstPayment.state,
    {
      ...scope,

      id:
        "snapshot-replay",

      earningsEntryId:
        "earning-1",

      providerCustomerId:
        "provider-cari-1",

      providerType:
        "TAILOR",

      sourcePaymentId:
        "payment-1",

      currency:
        "TRY",

      amount:
        400,

      paidAt:
        "2026-07-29T13:00:00.000Z",

      recordedAt:
        "2026-07-29T13:05:00.000Z"
    }
  );

assert.equal(
  replayPayment.outcome,
  "REPLAY"
);

assert.equal(
  replayPayment.state,
  firstPayment.state
);

const completedPayment =
  registerProviderPaymentSnapshot(
    firstPayment.state,
    {
      ...scope,

      id:
        "snapshot-2",

      earningsEntryId:
        "earning-1",

      providerCustomerId:
        "provider-cari-1",

      providerType:
        "TAILOR",

      sourcePaymentId:
        "payment-2",

      currency:
        "TRY",

      amount:
        800,

      paidAt:
        "2026-07-29T14:00:00.000Z",

      recordedAt:
        "2026-07-29T14:01:00.000Z"
    }
  );

assert.equal(
  completedPayment.outcome,
  "UPDATED"
);

if (
  completedPayment.outcome !==
  "UPDATED"
) {
  throw new Error(
    "Tam ödeme görünümü oluşmadı."
  );
}

assert.equal(
  completedPayment.entry.paidAmount,
  1200
);

assert.equal(
  completedPayment.entry.status,
  "PAID"
);

const overpayment =
  registerProviderPaymentSnapshot(
    firstPayment.state,
    {
      ...scope,

      id:
        "snapshot-overpayment",

      earningsEntryId:
        "earning-1",

      providerCustomerId:
        "provider-cari-1",

      providerType:
        "TAILOR",

      sourcePaymentId:
        "payment-over",

      currency:
        "TRY",

      amount:
        801,

      paidAt:
        "2026-07-29T14:00:00.000Z",

      recordedAt:
        "2026-07-29T14:01:00.000Z"
    }
  );

assert.equal(
  overpayment.outcome,
  "REJECTED"
);

if (
  overpayment.outcome ===
  "REJECTED"
) {
  assert.equal(
    overpayment.reason,
    "PAYMENT_EXCEEDS_FINALIZED_AMOUNT"
  );
}

const wrongCurrency =
  registerProviderPaymentSnapshot(
    finalized.state,
    {
      ...scope,

      id:
        "snapshot-wrong-currency",

      earningsEntryId:
        "earning-1",

      providerCustomerId:
        "provider-cari-1",

      providerType:
        "TAILOR",

      sourcePaymentId:
        "payment-eur",

      currency:
        "EUR",

      amount:
        100,

      paidAt:
        "2026-07-29T14:00:00.000Z",

      recordedAt:
        "2026-07-29T14:01:00.000Z"
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

const wrongProvider =
  finalizeProviderEarning(
    created.state,
    {
      ...scope,

      entryId:
        "earning-1",

      providerCustomerId:
        "provider-cari-2",

      finalizedAmount:
        1200,

      finalizedAt:
        "2026-07-29T12:00:00.000Z",

      finalizedByUserId:
        "admin-1"
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

const wrongCompany =
  finalizeProviderEarning(
    created.state,
    {
      ...scope,

      companyId:
        "company-2",

      entryId:
        "earning-1",

      providerCustomerId:
        "provider-cari-1",

      finalizedAmount:
        1200,

      finalizedAt:
        "2026-07-29T12:00:00.000Z",

      finalizedByUserId:
        "admin-1"
    }
  );

assert.equal(
  wrongCompany.outcome,
  "REJECTED"
);

if (
  wrongCompany.outcome ===
  "REJECTED"
) {
  assert.equal(
    wrongCompany.reason,
    "SCOPE_MISMATCH"
  );
}

const serialized =
  JSON.stringify(
    completedPayment
  );

assert.doesNotMatch(
  serialized,
  /password|token|hash|secret/
);

assert.doesNotMatch(
  serialized,
  /cashBalanceMutation|financeTransactionCreate|paymentCommand/
);

console.log(
  "PROVIDER_EARNINGS_LEDGER_SERVICE_TEST: PAK"
);