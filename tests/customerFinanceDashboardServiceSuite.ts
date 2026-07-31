import assert from "node:assert/strict";

import type {
  FinanceTransaction
} from "../src/lib/finance/financeContracts";

import {
  calculateCustomerFinanceDashboard
} from "../src/lib/finance/customerFinanceDashboardService";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId:
    "period-1"
};

function transaction(
  overrides:
    Partial<FinanceTransaction> = {}
): FinanceTransaction {
  const base:
    FinanceTransaction = {
      ...scope,

      id: "charge-1",
      transactionId:
        "charge-1",
      idempotencyKey:
        "charge-1",

      transactionType:
        "SALE_CHARGE",
      direction: "DEBIT",

      paymentMethod: null,
      financeAccountId: null,
      counterAccountId: null,

      customerId:
        "customer-1",
      saleId:
        "sale-1",

      sourceDocumentId:
        "sale-1",
      sourceDocumentType:
        "SALE",

      grossAmount: 1000,
      commissionAmount: 0,
      netAmount: 1000,

      currency: "TRY",

      transactionDate:
        "2026-07-01",
      valueDate:
        "2026-07-01",
      dueDate:
        "2026-07-20",

      status: "POSTED",

      description: null,
      externalReference: null,
      reversalOfTransactionId:
        null,

      createdBy:
        "admin-1",
      createdAt:
        "2026-07-01T09:00:00.000Z",
      postedAt:
        "2026-07-01T09:00:00.000Z",

      reversedAt: null,
      archivedAt: null,

      projectionSource:
        "SALE_CHARGE"
    };

  return {
    ...base,
    ...overrides
  };
}

const result =
  calculateCustomerFinanceDashboard(
    [
      transaction(),

      transaction({
        id: "collection-1",
        transactionId:
          "collection-1",
        idempotencyKey:
          "collection-1",

        transactionType:
          "COLLECTION",
        direction: "CREDIT",

        sourceDocumentId:
          "payment-1",
        sourceDocumentType:
          "SALE_PAYMENT",

        grossAmount: 400,
        netAmount: 400,

        transactionDate:
          "2026-07-10",
        valueDate:
          "2026-07-10",
        dueDate: null,

        createdAt:
          "2026-07-10T09:00:00.000Z",
        postedAt:
          "2026-07-10T09:00:00.000Z",

        projectionSource:
          "SALE_PAYMENT"
      })
    ],

    scope,
    "customer-1",
    "TRY",
    "2026-07-31"
  );

assert.equal(
  result.outcome,
  "CALCULATED"
);

if (
  result.outcome !==
  "CALCULATED"
) {
  throw new Error(
    "Expected dashboard."
  );
}

assert.equal(
  result.dashboard.summary.balance,
  600
);

assert.equal(
  result.dashboard.statement
    .closingBalance,
  600
);

assert.equal(
  result.dashboard.due.totalOpenAmount,
  600
);

assert.equal(
  result.dashboard.due.overdueAmount,
  600
);

assert.equal(
  result.dashboard.riskLevel,
  "RISKLI"
);

assert.equal(
  result.dashboard.hasOverdueDebt,
  true
);

assert.equal(
  result.dashboard.hasDueTodayDebt,
  false
);

assert.equal(
  result.dashboard.hasFutureDebt,
  false
);

const watch =
  calculateCustomerFinanceDashboard(
    [
      transaction({
        dueDate:
          "2026-07-31",
        grossAmount: 300,
        netAmount: 300
      })
    ],

    scope,
    "customer-1",
    "TRY",
    "2026-07-31"
  );

assert.equal(
  watch.outcome,
  "CALCULATED"
);

if (
  watch.outcome ===
  "CALCULATED"
) {
  assert.equal(
    watch.dashboard.riskLevel,
    "IZLE"
  );

  assert.equal(
    watch.dashboard
      .hasDueTodayDebt,
    true
  );
}

const clean =
  calculateCustomerFinanceDashboard(
    [
      transaction({
        dueDate:
          "2026-08-15",
        grossAmount: 250,
        netAmount: 250
      })
    ],

    scope,
    "customer-1",
    "TRY",
    "2026-07-31"
  );

assert.equal(
  clean.outcome,
  "CALCULATED"
);

if (
  clean.outcome ===
  "CALCULATED"
) {
  assert.equal(
    clean.dashboard.riskLevel,
    "TEMIZ"
  );

  assert.equal(
    clean.dashboard.hasFutureDebt,
    true
  );
}

const scopeMismatch =
  calculateCustomerFinanceDashboard(
    [
      transaction({
        branchId:
          "other-branch"
      })
    ],

    scope,
    "customer-1",
    "TRY",
    "2026-07-31"
  );

assert.deepEqual(
  scopeMismatch,
  {
    outcome: "REJECTED",
    reason:
      "FINANCE_SCOPE_MISMATCH"
  }
);

console.log(
  "customerFinanceDashboardServiceSuite: PASS"
);