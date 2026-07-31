import assert from "node:assert/strict";

import type {
  FinanceTransaction
} from "../src/lib/finance/financeContracts";

import {
  calculateCustomerFinanceSummary
} from "../src/lib/finance/customerFinanceSummaryService";

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

      id: "transaction-1",
      transactionId:
        "transaction-1",
      idempotencyKey:
        "transaction-1",

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
        "2026-07-31",
      valueDate:
        "2026-07-31",
      dueDate: null,

      status: "POSTED",

      description: null,
      externalReference: null,
      reversalOfTransactionId:
        null,

      createdBy:
        "admin-1",
      createdAt:
        "2026-07-31T09:20:00.000Z",
      postedAt:
        "2026-07-31T09:20:00.000Z",

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
  calculateCustomerFinanceSummary(
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

        projectionSource:
          "SALE_PAYMENT"
      }),

      transaction({
        id: "refund-1",
        transactionId:
          "refund-1",
        idempotencyKey:
          "refund-1",

        transactionType:
          "REFUND",
        direction: "CREDIT",

        sourceDocumentId:
          "return-1",
        sourceDocumentType:
          "SALE_RETURN",

        grossAmount: 100,
        netAmount: 100,

        projectionSource:
          "SALE_RETURN"
      }),

      transaction({
        id: "archived-1",
        transactionId:
          "archived-1",
        idempotencyKey:
          "archived-1",

        transactionType:
          "SALE_CHARGE",
        direction: "DEBIT",

        grossAmount: 9000,
        netAmount: 9000,

        archivedAt:
          "2026-07-31T09:30:00.000Z"
      })
    ],

    scope,
    "customer-1",
    "TRY"
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
    "Expected calculated summary."
  );
}

assert.deepEqual(
  result.summary,
  {
    customerId:
      "customer-1",

    currency: "TRY",

    debitTotal: 1000,
    creditTotal: 500,
    balance: 500,

    saleChargeTotal: 1000,
    collectionTotal: 400,
    refundTotal: 100,

    otherDebitTotal: 0,
    otherCreditTotal: 0,

    postedTransactionCount: 3,
    position: "BORCLU"
  }
);

const customerCredit =
  calculateCustomerFinanceSummary(
    [
      transaction({
        grossAmount: 500,
        netAmount: 500
      }),

      transaction({
        id: "collection-2",
        transactionId:
          "collection-2",
        idempotencyKey:
          "collection-2",

        transactionType:
          "COLLECTION",
        direction: "CREDIT",

        sourceDocumentId:
          "payment-2",
        sourceDocumentType:
          "SALE_PAYMENT",

        grossAmount: 700,
        netAmount: 700,

        projectionSource:
          "SALE_PAYMENT"
      })
    ],

    scope,
    "customer-1",
    "TRY"
  );

assert.equal(
  customerCredit.outcome,
  "CALCULATED"
);

if (
  customerCredit.outcome ===
  "CALCULATED"
) {
  assert.equal(
    customerCredit.summary.balance,
    -200
  );

  assert.equal(
    customerCredit.summary.position,
    "ALACAKLI"
  );
}

const scopeMismatch =
  calculateCustomerFinanceSummary(
    [
      transaction({
        branchId:
          "other-branch"
      })
    ],

    scope,
    "customer-1",
    "TRY"
  );

assert.deepEqual(
  scopeMismatch,
  {
    outcome: "REJECTED",
    reason:
      "FINANCE_SCOPE_MISMATCH"
  }
);

const customerMismatch =
  calculateCustomerFinanceSummary(
    [
      transaction({
        customerId:
          "other-customer"
      })
    ],

    scope,
    "customer-1",
    "TRY"
  );

assert.deepEqual(
  customerMismatch,
  {
    outcome: "REJECTED",
    reason:
      "FINANCE_CUSTOMER_MISMATCH"
  }
);

const currencyMismatch =
  calculateCustomerFinanceSummary(
    [
      transaction({
        currency: "USD"
      })
    ],

    scope,
    "customer-1",
    "TRY"
  );

assert.deepEqual(
  currencyMismatch,
  {
    outcome: "REJECTED",
    reason:
      "FINANCE_CURRENCY_MISMATCH"
  }
);

const closed =
  calculateCustomerFinanceSummary(
    [],
    scope,
    "customer-1",
    "TRY"
  );

assert.equal(
  closed.outcome,
  "CALCULATED"
);

if (
  closed.outcome ===
  "CALCULATED"
) {
  assert.equal(
    closed.summary.balance,
    0
  );

  assert.equal(
    closed.summary.position,
    "KAPALI"
  );
}

console.log(
  "customerFinanceSummaryServiceSuite: PASS"
);