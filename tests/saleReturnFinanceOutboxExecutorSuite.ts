import assert from "node:assert/strict";

import type {
  FinanceTransaction
} from "../src/lib/finance/financeContracts";

import type {
  FinanceCommandResult
} from "../src/lib/finance/financeCommandService";

import {
  executeSaleReturnFinanceOutboxRecord,
  type SaleReturnFinanceOutboxExecutorDependencies
} from "../src/lib/finance/saleReturnFinanceOutboxExecutor";

import type {
  SaleReturnFinanceOutboxRecord
} from "../src/lib/localSaleReturnsDb";

const baseRecord:
  SaleReturnFinanceOutboxRecord = {
    tenantId: "tenant-1",
    companyId: "company-1",
    branchId: "branch-1",
    accountingPeriodId: "period-1",

    id:
      "sale-return-finance-outbox:return-1",
    saleReturnId:
      "return-1",
    saleId:
      "sale-1",
    customerId:
      "customer-1",

    saleReturnSnapshot: {
      tenantId: "tenant-1",
      companyId: "company-1",
      branchId: "branch-1",
      accountingPeriodId:
        "period-1",

      id: "return-1",
      saleId: "sale-1",
      customerId:
        "customer-1",
      status: "ONAYLANDI",
      actorUserId:
        "user-1",

      amount: 400,
      currency: "TRY",
      reason:
        "Müşteri vazgeçti",

      occurredAt:
        "2026-07-31T01:40:00.000Z",

      idempotencyKey:
        "sale-return:sale-1:001",

      createdAt:
        "2026-07-31T01:40:00.000Z",

      updatedAt:
        "2026-07-31T01:45:00.000Z"
    },

    status: "PENDING",
    retryCount: 0,

    createdAt:
      "2026-07-31T01:45:00.000Z",

    updatedAt:
      "2026-07-31T01:45:00.000Z"
  };

function dependencies(
  financeResult:
    FinanceCommandResult
): {
  value:
    SaleReturnFinanceOutboxExecutorDependencies;
  writes:
    SaleReturnFinanceOutboxRecord[];
  transactions:
    FinanceTransaction[];
} {
  const writes:
    SaleReturnFinanceOutboxRecord[] = [];

  const transactions:
    FinanceTransaction[] = [];

  let timeIndex = 0;

  const times = [
    "2026-07-31T01:46:00.000Z",
    "2026-07-31T01:47:00.000Z",
    "2026-07-31T01:48:00.000Z"
  ];

  return {
    writes,
    transactions,

    value: {
      async executeFinanceCommand(
        transaction
      ) {
        transactions.push(
          transaction
        );

        return financeResult;
      },

      async updateSaleReturnFinanceOutbox(
        record
      ) {
        writes.push({
          ...record
        });
      },

      now() {
        const value =
          times[
            Math.min(
              timeIndex,
              times.length - 1
            )
          ];

        timeIndex++;

        return value;
      }
    }
  };
}

async function run():
Promise<void> {
  const createdFinance:
    FinanceCommandResult = {
    outcome: "CREATED",

    transaction: {
      tenantId: "tenant-1",
      companyId: "company-1",
      branchId: "branch-1",
      accountingPeriodId:
        "period-1",

      id:
        "sale-return-finance:return-1",
      transactionId:
        "sale-return-finance:return-1",
      idempotencyKey:
        "sale-return:return-1:finance",

      transactionType:
        "REFUND",
      direction: "CREDIT",

      paymentMethod: null,
      financeAccountId: null,
      counterAccountId: null,

      customerId:
        "customer-1",
      saleId: "sale-1",

      sourceDocumentId:
        "return-1",
      sourceDocumentType:
        "SALE_RETURN",

      grossAmount: 400,
      commissionAmount: 0,
      netAmount: 400,

      currency: "TRY",
      transactionDate:
        "2026-07-31",
      valueDate:
        "2026-07-31",
      dueDate: null,

      status: "POSTED",
      description:
        "Satış iadesi",
      externalReference: null,
      reversalOfTransactionId:
        null,

      createdBy: "user-1",
      createdAt:
        "2026-07-31T01:45:00.000Z",
      postedAt:
        "2026-07-31T01:45:00.000Z",

      reversedAt: null,
      archivedAt: null,

      projectionSource:
        "SALE_RETURN"
    }
  };

  const createdDeps =
    dependencies(createdFinance);

  const createdResult =
    await executeSaleReturnFinanceOutboxRecord(
      baseRecord,
      createdDeps.value
    );

  assert.equal(
    createdResult.outcome,
    "SYNCED"
  );

  if (
    createdResult.outcome !==
    "SYNCED"
  ) {
    throw new Error(
      "Expected SYNCED result."
    );
  }

  assert.equal(
    createdResult.financeOutcome,
    "CREATED"
  );

  assert.equal(
    createdDeps.transactions.length,
    1
  );

  const createdTransaction =
    createdDeps.transactions[0];

  assert.equal(
    createdTransaction.transactionType,
    "REFUND"
  );

  assert.equal(
    createdTransaction.direction,
    "CREDIT"
  );

  assert.equal(
    createdTransaction
      .sourceDocumentType,
    "SALE_RETURN"
  );

  assert.equal(
    createdTransaction
      .sourceDocumentId,
    "return-1"
  );

  assert.equal(
    createdTransaction
      .idempotencyKey,
    "sale-return:return-1:finance"
  );

  assert.equal(
    createdTransaction.netAmount,
    400
  );

  assert.equal(
    createdDeps.writes[0].status,
    "PROCESSING"
  );

  assert.equal(
    createdDeps.writes.at(-1)?.status,
    "SYNCED"
  );

  const replayFinance:
    FinanceCommandResult = {
    outcome: "REPLAY",
    transaction:
      createdFinance.transaction
  };

  const replayDeps =
    dependencies(replayFinance);

  const replayResult =
    await executeSaleReturnFinanceOutboxRecord(
      {
        ...baseRecord,
        status: "ERROR",
        retryCount: 1,
        lastError:
          "Önceki geçici hata"
      },
      replayDeps.value
    );

  assert.equal(
    replayResult.outcome,
    "SYNCED"
  );

  if (
    replayResult.outcome !==
    "SYNCED"
  ) {
    throw new Error(
      "Expected replay SYNCED result."
    );
  }

  assert.equal(
    replayResult.financeOutcome,
    "REPLAY"
  );

  assert.equal(
    replayDeps.writes.at(-1)?.status,
    "SYNCED"
  );

  const rejectDeps =
    dependencies({
      outcome: "REJECT",
      reason: "OVERPAYMENT"
    });

  const rejectResult =
    await executeSaleReturnFinanceOutboxRecord(
      baseRecord,
      rejectDeps.value
    );

  assert.equal(
    rejectResult.outcome,
    "ERROR"
  );

  if (
    rejectResult.outcome !==
    "ERROR"
  ) {
    throw new Error(
      "Expected ERROR result."
    );
  }

  assert.equal(
    rejectResult.reason,
    "FINANCE_COMMAND_REJECTED:OVERPAYMENT"
  );

  assert.equal(
    rejectResult.record.retryCount,
    1
  );

  assert.equal(
    rejectResult.record.status,
    "ERROR"
  );

  const invalidStatusDeps =
    dependencies(createdFinance);

  const invalidStatusResult =
    await executeSaleReturnFinanceOutboxRecord(
      {
        ...baseRecord,

        saleReturnSnapshot: {
          ...baseRecord
            .saleReturnSnapshot,

          status: "BAŞLATILDI"
        }
      },
      invalidStatusDeps.value
    );

  assert.equal(
    invalidStatusResult.outcome,
    "ERROR"
  );

  if (
    invalidStatusResult.outcome !==
    "ERROR"
  ) {
    throw new Error(
      "Expected unapproved return ERROR."
    );
  }

  assert.equal(
    invalidStatusResult.reason,
    "SALE_RETURN_NOT_APPROVED"
  );

  assert.equal(
    invalidStatusDeps
      .transactions.length,
    0
  );

  console.log(
    "saleReturnFinanceOutboxExecutorSuite: PASS"
  );
}

run().catch(
  error => {
    console.error(error);
    process.exitCode = 1;
  }
);