import assert from "node:assert/strict";

import type {
  FinanceTransaction
} from "../src/lib/finance/financeContracts";

import {
  calculateSaleReturnEligibility,
  startFinanceValidatedSaleReturn,
  type SaleReturnFinanceEligibilityDependencies
} from "../src/lib/saleReturnFinanceEligibilityService";

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
        "2026-07-31T02:20:00.000Z",
      postedAt:
        "2026-07-31T02:20:00.000Z",

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

const transactions:
  FinanceTransaction[] = [
    transaction(),

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

      grossAmount: 250,
      netAmount: 250,

      projectionSource:
        "SALE_RETURN"
    })
  ];

const eligibility =
  calculateSaleReturnEligibility(
    transactions,
    scope,
    "customer-1",
    "sale-1",
    "TRY"
  );

assert.deepEqual(
  eligibility,
  {
    saleChargeTotal: 1000,
    refundTotal: 250,
    returnableAmount: 750,
    currency: "TRY"
  }
);

function dependencies(
  sourceTransactions:
    FinanceTransaction[]
): {
  value:
    SaleReturnFinanceEligibilityDependencies;

  capturedReturnableAmounts:
    number[];
} {
  const capturedReturnableAmounts:
    number[] = [];

  return {
    capturedReturnableAmounts,

    value: {
      async listLocalFinanceTransactions() {
        return sourceTransactions;
      },

      async startSaleReturnWorkflow(
        request
      ) {
        capturedReturnableAmounts.push(
          request.returnableAmount
        );

        return {
          outcome: "CREATED",

          saleReturn: {
            ...scope,

            id: "return-2",
            saleId:
              request.saleId,
            customerId:
              request.customerId,

            status:
              "BAŞLATILDI",

            actorUserId:
              request.actorUserId,

            amount:
              request.amount,
            currency:
              request.currency,

            reason:
              request.reason ?? null,

            occurredAt:
              request.occurredAt,

            idempotencyKey:
              request.idempotencyKey,

            createdAt:
              request.occurredAt,
            updatedAt:
              request.occurredAt
          }
        };
      }
    }
  };
}

async function run():
Promise<void> {
  const validDependencies =
    dependencies(transactions);

  const created =
    await startFinanceValidatedSaleReturn(
      {
        ...scope,

        saleId:
          "sale-1",
        customerId:
          "customer-1",
        saleStatus:
          "ONAYLANDI",

        actorUserId:
          "admin-1",

        amount: 500,
        currency: "TRY",

        reason:
          "Kısmi iade",

        occurredAt:
          "2026-07-31T02:30:00.000Z",

        idempotencyKey:
          "sale-return:sale-1:002"
      },

      undefined,
      validDependencies.value
    );

  assert.equal(
    created.outcome,
    "CREATED"
  );

  assert.deepEqual(
    validDependencies
      .capturedReturnableAmounts,
    [750]
  );

  const excessiveDependencies =
    dependencies(transactions);

  const excessive =
    await startFinanceValidatedSaleReturn(
      {
        ...scope,

        saleId:
          "sale-1",
        customerId:
          "customer-1",
        saleStatus:
          "ONAYLANDI",

        actorUserId:
          "admin-1",

        amount: 751,
        currency: "TRY",

        occurredAt:
          "2026-07-31T02:31:00.000Z",

        idempotencyKey:
          "sale-return:sale-1:003"
      },

      undefined,
      excessiveDependencies.value
    );

  assert.deepEqual(
    excessive,
    {
      outcome:
        "FINANCE_REJECTED",

      reason:
        "AMOUNT_EXCEEDS_FINANCE_RETURNABLE",

      eligibility: {
        saleChargeTotal: 1000,
        refundTotal: 250,
        returnableAmount: 750,
        currency: "TRY"
      }
    }
  );

  assert.equal(
    excessiveDependencies
      .capturedReturnableAmounts
      .length,
    0
  );

  const noChargeDependencies =
    dependencies([]);

  const noCharge =
    await startFinanceValidatedSaleReturn(
      {
        ...scope,

        saleId:
          "sale-1",
        customerId:
          "customer-1",
        saleStatus:
          "ONAYLANDI",

        actorUserId:
          "admin-1",

        amount: 100,
        currency: "TRY",

        occurredAt:
          "2026-07-31T02:32:00.000Z",

        idempotencyKey:
          "sale-return:sale-1:004"
      },

      undefined,
      noChargeDependencies.value
    );

  assert.equal(
    noCharge.outcome,
    "FINANCE_REJECTED"
  );

  if (
    noCharge.outcome ===
    "FINANCE_REJECTED"
  ) {
    assert.equal(
      noCharge.reason,
      "NO_POSTED_SALE_CHARGE"
    );
  }

  const scopeMismatchDependencies =
    dependencies([
      transaction({
        branchId:
          "other-branch"
      })
    ]);

  const scopeMismatch =
    await startFinanceValidatedSaleReturn(
      {
        ...scope,

        saleId:
          "sale-1",
        customerId:
          "customer-1",
        saleStatus:
          "ONAYLANDI",

        actorUserId:
          "admin-1",

        amount: 100,
        currency: "TRY",

        occurredAt:
          "2026-07-31T02:33:00.000Z",

        idempotencyKey:
          "sale-return:sale-1:005"
      },

      undefined,
      scopeMismatchDependencies.value
    );

  assert.equal(
    scopeMismatch.outcome,
    "FINANCE_REJECTED"
  );

  if (
    scopeMismatch.outcome ===
    "FINANCE_REJECTED"
  ) {
    assert.equal(
      scopeMismatch.reason,
      "FINANCE_SCOPE_MISMATCH"
    );
  }

  console.log(
    "saleReturnFinanceEligibilityServiceSuite: PASS"
  );
}

run().catch(
  error => {
    console.error(error);
    process.exitCode = 1;
  }
);