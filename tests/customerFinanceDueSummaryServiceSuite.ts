import assert from "node:assert/strict";

import type {
  FinanceTransaction
} from "../src/lib/finance/financeContracts";

import {
  calculateCustomerFinanceDueSummary
} from "../src/lib/finance/customerFinanceDueSummaryService";

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
  calculateCustomerFinanceDueSummary(
    [
      transaction(),

      transaction({
        id: "charge-2",
        transactionId:
          "charge-2",
        idempotencyKey:
          "charge-2",

        saleId: "sale-2",
        sourceDocumentId:
          "sale-2",

        grossAmount: 600,
        netAmount: 600,

        transactionDate:
          "2026-07-10",
        valueDate:
          "2026-07-10",
        dueDate:
          "2026-07-31",

        createdAt:
          "2026-07-10T09:00:00.000Z",
        postedAt:
          "2026-07-10T09:00:00.000Z"
      }),

      transaction({
        id: "charge-3",
        transactionId:
          "charge-3",
        idempotencyKey:
          "charge-3",

        saleId: "sale-3",
        sourceDocumentId:
          "sale-3",

        grossAmount: 500,
        netAmount: 500,

        transactionDate:
          "2026-07-15",
        valueDate:
          "2026-07-15",
        dueDate:
          "2026-08-15",

        createdAt:
          "2026-07-15T09:00:00.000Z",
        postedAt:
          "2026-07-15T09:00:00.000Z"
      }),

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

        grossAmount: 1200,
        netAmount: 1200,

        transactionDate:
          "2026-07-25",
        valueDate:
          "2026-07-25",
        dueDate: null,

        createdAt:
          "2026-07-25T09:00:00.000Z",
        postedAt:
          "2026-07-25T09:00:00.000Z",

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
    "Expected due summary."
  );
}

assert.deepEqual(
  result.summary.lines.map(
    line => ({
      saleId: line.saleId,
      remaining:
        line.remainingAmount,
      bucket: line.bucket
    })
  ),
  [
    {
      saleId: "sale-2",
      remaining: 400,
      bucket: "BUGUN"
    },
    {
      saleId: "sale-3",
      remaining: 500,
      bucket: "GELECEK"
    }
  ]
);

assert.equal(
  result.summary.overdueAmount,
  0
);

assert.equal(
  result.summary.dueTodayAmount,
  400
);

assert.equal(
  result.summary.futureAmount,
  500
);

assert.equal(
  result.summary.totalOpenAmount,
  900
);

const overdue =
  calculateCustomerFinanceDueSummary(
    [
      transaction({
        netAmount: 300,
        grossAmount: 300
      })
    ],

    scope,
    "customer-1",
    "TRY",
    "2026-07-31"
  );

assert.equal(
  overdue.outcome,
  "CALCULATED"
);

if (
  overdue.outcome ===
  "CALCULATED"
) {
  assert.equal(
    overdue.summary.overdueAmount,
    300
  );
}

const excessCredit =
  calculateCustomerFinanceDueSummary(
    [
      transaction({
        grossAmount: 100,
        netAmount: 100
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

        grossAmount: 200,
        netAmount: 200,

        transactionDate:
          "2026-07-02",
        valueDate:
          "2026-07-02",
        dueDate: null,

        createdAt:
          "2026-07-02T09:00:00.000Z",
        postedAt:
          "2026-07-02T09:00:00.000Z",

        projectionSource:
          "SALE_PAYMENT"
      })
    ],

    scope,
    "customer-1",
    "TRY",
    "2026-07-31"
  );

assert.deepEqual(
  excessCredit,
  {
    outcome: "REJECTED",
    reason:
      "CREDIT_EXCEEDS_OPEN_DEBT"
  }
);

const invalidDate =
  calculateCustomerFinanceDueSummary(
    [],
    scope,
    "customer-1",
    "TRY",
    "31.07.2026"
  );

assert.deepEqual(
  invalidDate,
  {
    outcome: "REJECTED",
    reason:
      "AS_OF_DATE_INVALID"
  }
);

console.log(
  "customerFinanceDueSummaryServiceSuite: PASS"
);