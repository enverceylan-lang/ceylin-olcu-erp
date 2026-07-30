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

async function main(): Promise<void> {
  await runSuccessTest();
  await runRejectTest();
  await runProjectionErrorTest();

  console.log(
    "salesFinanceOutboxExecutorSuite: PASS"
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});