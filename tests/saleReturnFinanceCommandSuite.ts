import "fake-indexeddb/auto";

import assert from "node:assert/strict";

import type {
  FinanceTransaction
} from "../src/lib/finance/financeContracts";

import {
  executeFinanceCommand
} from "../src/lib/finance/financeCommandService";

import {
  listLocalFinanceTransactions,
  localFinanceDb
} from "../src/lib/localFinanceDb";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

function transaction(
  overrides:
    Partial<FinanceTransaction> = {}
): FinanceTransaction {
  const base:
    FinanceTransaction = {
      ...scope,

      id: "sale-charge-1",
      transactionId:
        "sale-charge-1",
      idempotencyKey:
        "sale:sale-1:charge",

      transactionType:
        "SALE_CHARGE",
      direction: "DEBIT",

      paymentMethod: null,
      financeAccountId: null,
      counterAccountId: null,

      customerId:
        "customer-1",
      saleId: "sale-1",

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
      description:
        "Satış borçlandırması",
      externalReference: null,
      reversalOfTransactionId:
        null,

      createdBy: "admin-1",
      createdAt:
        "2026-07-31T01:40:00.000Z",
      postedAt:
        "2026-07-31T01:40:00.000Z",
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

async function run():
Promise<void> {
  await localFinanceDb.delete();
  await localFinanceDb.open();

  const charge =
    await executeFinanceCommand(
      transaction()
    );

  assert.equal(
    charge.outcome,
    "CREATED"
  );

  const refund =
    await executeFinanceCommand(
      transaction({
        id: "sale-return-finance-1",
        transactionId:
          "sale-return-finance-1",
        idempotencyKey:
          "sale-return:return-1:finance",

        transactionType:
          "REFUND",
        direction: "CREDIT",

        sourceDocumentId:
          "return-1",
        sourceDocumentType:
          "SALE_RETURN",

        grossAmount: 400,
        netAmount: 400,

        description:
          "Satış iadesi",
        projectionSource:
          "SALE_RETURN"
      })
    );

  assert.equal(
    refund.outcome,
    "CREATED"
  );

  const replay =
    await executeFinanceCommand(
      transaction({
        id: "sale-return-finance-1",
        transactionId:
          "sale-return-finance-1",
        idempotencyKey:
          "sale-return:return-1:finance",

        transactionType:
          "REFUND",
        direction: "CREDIT",

        sourceDocumentId:
          "return-1",
        sourceDocumentType:
          "SALE_RETURN",

        grossAmount: 400,
        netAmount: 400,

        description:
          "Satış iadesi",
        projectionSource:
          "SALE_RETURN"
      })
    );

  assert.equal(
    replay.outcome,
    "REPLAY"
  );

  const duplicateDocument =
    await executeFinanceCommand(
      transaction({
        id: "sale-return-finance-2",
        transactionId:
          "sale-return-finance-2",
        idempotencyKey:
          "sale-return:return-1:other-key",

        transactionType:
          "REFUND",
        direction: "CREDIT",

        sourceDocumentId:
          "return-1",
        sourceDocumentType:
          "SALE_RETURN",

        grossAmount: 400,
        netAmount: 400,

        projectionSource:
          "SALE_RETURN"
      })
    );

  assert.deepEqual(
    duplicateDocument,
    {
      outcome: "REJECT",
      reason:
        "DUPLICATE_SOURCE_DOCUMENT"
    }
  );

  const wrongDirection =
    await executeFinanceCommand(
      transaction({
        id: "return-wrong-direction",
        transactionId:
          "return-wrong-direction",
        idempotencyKey:
          "return-wrong-direction",

        transactionType:
          "REFUND",
        direction: "DEBIT",

        sourceDocumentId:
          "return-wrong-direction",
        sourceDocumentType:
          "SALE_RETURN",

        grossAmount: 100,
        netAmount: 100,

        projectionSource:
          "SALE_RETURN"
      })
    );

  assert.deepEqual(
    wrongDirection,
    {
      outcome: "REJECT",
      reason:
        "TYPE_DIRECTION_MISMATCH"
    }
  );

  const wrongSource =
    await executeFinanceCommand(
      transaction({
        id: "return-wrong-source",
        transactionId:
          "return-wrong-source",
        idempotencyKey:
          "return-wrong-source",

        transactionType:
          "REFUND",
        direction: "CREDIT",

        sourceDocumentId:
          "return-wrong-source",
        sourceDocumentType:
          "SALE",

        grossAmount: 100,
        netAmount: 100,

        projectionSource:
          "SALE_RETURN"
      })
    );

  assert.deepEqual(
    wrongSource,
    {
      outcome: "REJECT",
      reason:
        "INVALID_TRANSACTION"
    }
  );

  const excessiveRefund =
    await executeFinanceCommand(
      transaction({
        id: "sale-return-finance-3",
        transactionId:
          "sale-return-finance-3",
        idempotencyKey:
          "sale-return:return-2:finance",

        transactionType:
          "REFUND",
        direction: "CREDIT",

        sourceDocumentId:
          "return-2",
        sourceDocumentType:
          "SALE_RETURN",

        grossAmount: 601,
        netAmount: 601,

        projectionSource:
          "SALE_RETURN"
      })
    );

  assert.deepEqual(
    excessiveRefund,
    {
      outcome: "REJECT",
      reason: "OVERPAYMENT"
    }
  );

  const remainingRefund =
    await executeFinanceCommand(
      transaction({
        id: "sale-return-finance-4",
        transactionId:
          "sale-return-finance-4",
        idempotencyKey:
          "sale-return:return-3:finance",

        transactionType:
          "REFUND",
        direction: "CREDIT",

        sourceDocumentId:
          "return-3",
        sourceDocumentType:
          "SALE_RETURN",

        grossAmount: 600,
        netAmount: 600,

        projectionSource:
          "SALE_RETURN"
      })
    );

  assert.equal(
    remainingRefund.outcome,
    "CREATED"
  );

  const transactions =
    await listLocalFinanceTransactions(
      scope,
      "customer-1",
      "sale-1"
    );

  assert.equal(
    transactions.length,
    3
  );

  assert.equal(
    transactions.filter(
      item =>
        item.transactionType ===
        "REFUND"
    ).length,
    2
  );

  await localFinanceDb.delete();

  console.log(
    "saleReturnFinanceCommandSuite: PASS"
  );
}

run().catch(
  async error => {
    console.error(error);

    try {
      await localFinanceDb.delete();
    } catch {
      // Test temizliği ana hatayı gölgelememelidir.
    }

    process.exitCode = 1;
  }
);