import assert from "node:assert/strict";

import type {
  FinanceTransaction,
  SaleFinanceProjectionResult
} from "../src/lib/finance/financeContracts";

import {
  executeSalesFinanceOutboxRecord,
  type SalesFinanceOutboxExecutorDependencies
} from "../src/lib/finance/salesFinanceOutboxExecutor";

import type {
  SalesFinanceOutboxRecord
} from "../src/lib/localSalesDb";

import type {
  Sale
} from "../src/store/salesStore";

const scope = {
  tenantId: "tenant-test",
  companyId: "company-test",
  branchId: "branch-test",
  accountingPeriodId: "period-test"
};

const sale =
  {
    id: "sale-test",
    customerId: "customer-test",
    saleNo: "S-TEST",
    items: [],
    payments: [],
    createdAt:
      "2026-07-30T10:00:00.000Z",
    updatedAt:
      "2026-07-30T10:00:00.000Z"
  } as unknown as Sale;

const record:
  SalesFinanceOutboxRecord = {
    ...scope,
    id: "outbox-test",
    saleId: sale.id,
    saleSnapshot: sale,
    currency: "TRY",
    status: "PENDING",
    retryCount: 0,
    createdAt:
      "2026-07-30T10:00:00.000Z",
    updatedAt:
      "2026-07-30T10:00:00.000Z"
  };

const transaction =
  {
    ...scope,
    id: "finance-test",
    transactionId: "finance-test",
    idempotencyKey: "finance-test",
    customerId: sale.customerId,
    saleId: sale.id
  } as unknown as FinanceTransaction;

function projection(
  options?: {
    reconciled?: boolean;
    errorCode?: string;
  }
): SaleFinanceProjectionResult {
  const hasError =
    Boolean(options?.errorCode);

  return {
    saleId: sale.id,
    customerId: sale.customerId,
    scope,
    currency: "TRY",
    projectedAt:
      "2026-07-30T10:01:00.000Z",
    transactions:
      hasError ? [] : [transaction],
    summary: {
      saleNetTotal: 100,
      paymentTotal: 0,
      effectivePaidTotal: 0,
      legacyDownPaymentDifference: 0,
      projectedDebit: 100,
      projectedCredit: 0,
      projectedBalance: 100,
      expectedPaidTotal: 0,
      expectedRemainingBalance: 100,
      reconciled:
        options?.reconciled ?? true
    },
    issues:
      hasError
        ? [
            {
              code: "INVALID_SALE_TOTAL",
              severity: "ERROR",
              message:
                options?.errorCode ||
                "Projection error",
              saleId: sale.id,
              paymentId: null,
              expected: null,
              actual: null
            }
          ]
        : []
  };
}

async function runSuccessTest(): Promise<void> {
  const updates:
    SalesFinanceOutboxRecord[] = [];

  let clock = 0;

  const dependencies:
    SalesFinanceOutboxExecutorDependencies = {
      projectSaleFinance:
        () => projection(),

      executeFinanceCommand:
        async () => ({
          outcome: "CREATED",
          transaction
        }),

      updateSalesFinanceOutbox:
        async nextRecord => {
          updates.push(nextRecord);
        },

      now:
        () => [
          "2026-07-30T10:01:00.000Z",
          "2026-07-30T10:02:00.000Z"
        ][clock++] ||
        "2026-07-30T10:03:00.000Z"
    };

  const result =
    await executeSalesFinanceOutboxRecord(
      record,
      dependencies
    );

  assert.equal(
    result.outcome,
    "SYNCED"
  );

  assert.deepEqual(
    updates.map(item => item.status),
    ["PROCESSING", "SYNCED"]
  );

  if (result.outcome === "SYNCED") {
    assert.equal(
      result.createdCount,
      1
    );

    assert.equal(
      result.replayCount,
      0
    );
  }
}

async function runRejectTest(): Promise<void> {
  const updates:
    SalesFinanceOutboxRecord[] = [];

  const dependencies:
    SalesFinanceOutboxExecutorDependencies = {
      projectSaleFinance:
        () => projection(),

      executeFinanceCommand:
        async () => ({
          outcome: "REJECT",
          reason: "OVERPAYMENT"
        }),

      updateSalesFinanceOutbox:
        async nextRecord => {
          updates.push(nextRecord);
        },

      now:
        () =>
          "2026-07-30T11:00:00.000Z"
    };

  const result =
    await executeSalesFinanceOutboxRecord(
      record,
      dependencies
    );

  assert.equal(
    result.outcome,
    "ERROR"
  );

  assert.deepEqual(
    updates.map(item => item.status),
    ["PROCESSING", "ERROR"]
  );

  if (result.outcome === "ERROR") {
    assert.equal(
      result.record.retryCount,
      1
    );

    assert.equal(
      result.reason,
      "FINANCE_COMMAND_REJECTED:OVERPAYMENT"
    );
  }
}

async function runProjectionErrorTest():
Promise<void> {
  const updates:
    SalesFinanceOutboxRecord[] = [];

  const dependencies:
    SalesFinanceOutboxExecutorDependencies = {
      projectSaleFinance:
        () =>
          projection({
            errorCode:
              "Invalid sale total"
          }),

      executeFinanceCommand:
        async () => {
          throw new Error(
            "Finance command must not run"
          );
        },

      updateSalesFinanceOutbox:
        async nextRecord => {
          updates.push(nextRecord);
        },

      now:
        () =>
          "2026-07-30T12:00:00.000Z"
    };

  const result =
    await executeSalesFinanceOutboxRecord(
      record,
      dependencies
    );

  assert.equal(
    result.outcome,
    "ERROR"
  );

  assert.deepEqual(
    updates.map(item => item.status),
    ["PROCESSING", "ERROR"]
  );

  if (result.outcome === "ERROR") {
    assert.match(
      result.reason,
      /^PROJECTION_ERROR/
    );
  }
}

async function runPartialFailureRetryReplayTest():
Promise<void> {
  const firstTransaction:
    FinanceTransaction = {
      ...transaction,
      id: "finance-transaction-first",
      transactionId:
        "finance-transaction-first",
      idempotencyKey:
        "finance-transaction-first",
      sourceDocumentId:
        "finance-source-first"
    };

  const secondTransaction:
    FinanceTransaction = {
      ...transaction,
      id: "finance-transaction-second",
      transactionId:
        "finance-transaction-second",
      idempotencyKey:
        "finance-transaction-second",
      sourceDocumentId:
        "finance-source-second"
    };

  const updates:
    SalesFinanceOutboxRecord[] = [];

  const postedKeys =
    new Set<string>();

  let rejectSecondTransaction = true;
  let financeCommandCallCount = 0;

  const dependencies:
    SalesFinanceOutboxExecutorDependencies = {
      projectSaleFinance:
        () => ({
          ...projection(),
          transactions: [
            firstTransaction,
            secondTransaction
          ]
        }),

      executeFinanceCommand:
        async currentTransaction => {
          financeCommandCallCount++;

          if (
            currentTransaction.idempotencyKey ===
              secondTransaction.idempotencyKey &&
            rejectSecondTransaction
          ) {
            return {
              outcome: "REJECT",
              reason: "INVALID_TRANSACTION"
            };
          }

          if (
            postedKeys.has(
              currentTransaction.idempotencyKey
            )
          ) {
            return {
              outcome: "REPLAY",
              transaction: currentTransaction
            };
          }

          postedKeys.add(
            currentTransaction.idempotencyKey
          );

          return {
            outcome: "CREATED",
            transaction: currentTransaction
          };
        },

      updateSalesFinanceOutbox:
        async updatedRecord => {
          updates.push({
            ...updatedRecord
          });
        },

      now:
        (() => {
          let index = 0;

          const times = [
            "2026-07-30T13:00:00.000Z",
            "2026-07-30T13:01:00.000Z",
            "2026-07-30T13:02:00.000Z",
            "2026-07-30T13:03:00.000Z",
            "2026-07-30T13:04:00.000Z",
            "2026-07-30T13:05:00.000Z"
          ];

          return () =>
            times[index++] ||
            "2026-07-30T13:06:00.000Z";
        })()
    };

  const firstResult =
    await executeSalesFinanceOutboxRecord(
      record,
      dependencies
    );

  assert.equal(
    firstResult.outcome,
    "ERROR"
  );

  assert.equal(
    postedKeys.size,
    1
  );

  if (firstResult.outcome !== "ERROR") {
    throw new Error(
      "First execution must end with ERROR."
    );
  }

  assert.equal(
    firstResult.record.retryCount,
    1
  );

  assert.equal(
    firstResult.reason,
    "FINANCE_COMMAND_REJECTED:INVALID_TRANSACTION"
  );

  rejectSecondTransaction = false;

  const retryResult =
    await executeSalesFinanceOutboxRecord(
      firstResult.record,
      dependencies
    );

  assert.equal(
    retryResult.outcome,
    "SYNCED"
  );

  if (retryResult.outcome !== "SYNCED") {
    throw new Error(
      "Retry execution must end with SYNCED."
    );
  }

  assert.equal(
    retryResult.createdCount,
    1
  );

  assert.equal(
    retryResult.replayCount,
    1
  );

  assert.equal(
    retryResult.record.retryCount,
    1
  );

  assert.equal(
    postedKeys.size,
    2
  );

  assert.equal(
    financeCommandCallCount,
    4
  );

  assert.deepEqual(
    updates.map(item => item.status),
    [
      "PROCESSING",
      "ERROR",
      "PROCESSING",
      "SYNCED"
    ]
  );
}
async function main(): Promise<void> {
  await runSuccessTest();
  await runRejectTest();
  await runProjectionErrorTest();
  await runPartialFailureRetryReplayTest();

  console.log(
    "salesFinanceOutboxExecutorSuite: PASS"
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});