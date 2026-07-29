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
  overrides: Partial<FinanceTransaction> = {}
): FinanceTransaction {
  const base: FinanceTransaction = {
    ...scope,
    id: "finance-1",
    transactionId: "finance-1",
    idempotencyKey: "finance-1",
    transactionType: "SALE_CHARGE",
    direction: "DEBIT",
    paymentMethod: null,
    financeAccountId: null,
    counterAccountId: null,
    customerId: "customer-1",
    saleId: "sale-1",
    sourceDocumentId: "sale-1",
    sourceDocumentType: "SALE",
    grossAmount: 1000,
    commissionAmount: 0,
    netAmount: 1000,
    currency: "TRY",
    transactionDate: "2026-07-27",
    valueDate: "2026-07-27",
    dueDate: null,
    status: "POSTED",
    description: "Satış borçlandırması",
    externalReference: null,
    reversalOfTransactionId: null,
    createdBy: "office-1",
    createdAt: "2026-07-27T18:00:00.000Z",
    postedAt: "2026-07-27T18:00:00.000Z",
    reversedAt: null,
    archivedAt: null,
    projectionSource: "SALE_CHARGE"
  };

  return {
    ...base,
    ...overrides
  } as FinanceTransaction;
}

async function run(): Promise<void> {
  await localFinanceDb.delete();
  await localFinanceDb.open();

  const charge = transaction();

  const chargeResult =
    await executeFinanceCommand(charge);

  assert.equal(chargeResult.outcome, "CREATED");

  const collection = transaction({
    id: "collection-1",
    transactionId: "collection-1",
    idempotencyKey:
      "sale:sale-1:payment:payment-1",
    transactionType: "COLLECTION",
    direction: "CREDIT",
    paymentMethod: "CASH",
    sourceDocumentId: "payment-1",
    sourceDocumentType: "SALE_PAYMENT",
    grossAmount: 250,
    netAmount: 250,
    description: "Satış tahsilatı",
    projectionSource: "SALE_PAYMENT"
  });

  const collectionResult =
    await executeFinanceCommand(collection);

  assert.equal(
    collectionResult.outcome,
    "CREATED"
  );

  const replay =
    await executeFinanceCommand(collection);

  assert.equal(replay.outcome, "REPLAY");

  const duplicate =
    await executeFinanceCommand(
      transaction({
        id: "collection-duplicate",
        transactionId:
          "collection-duplicate",
        idempotencyKey:
          "sale:sale-1:payment:duplicate-key",
        transactionType: "COLLECTION",
        direction: "CREDIT",
        paymentMethod: "CASH",
        sourceDocumentId: "payment-1",
        sourceDocumentType: "SALE_PAYMENT",
        grossAmount: 250,
        netAmount: 250,
        projectionSource: "SALE_PAYMENT"
      })
    );

  assert.deepEqual(duplicate, {
    outcome: "REJECT",
    reason: "DUPLICATE_SOURCE_DOCUMENT"
  });

  const overpayment =
    await executeFinanceCommand(
      transaction({
        id: "collection-overpayment",
        transactionId:
          "collection-overpayment",
        idempotencyKey:
          "sale:sale-1:payment:payment-2",
        transactionType: "COLLECTION",
        direction: "CREDIT",
        paymentMethod: "CASH",
        sourceDocumentId: "payment-2",
        sourceDocumentType: "SALE_PAYMENT",
        grossAmount: 800,
        netAmount: 800,
        projectionSource: "SALE_PAYMENT"
      })
    );

  assert.deepEqual(overpayment, {
    outcome: "REJECT",
    reason: "OVERPAYMENT"
  });

  const wrongDirection =
    await executeFinanceCommand(
      transaction({
        id: "wrong-direction",
        transactionId: "wrong-direction",
        idempotencyKey: "wrong-direction",
        direction: "CREDIT"
      })
    );

  assert.deepEqual(wrongDirection, {
    outcome: "REJECT",
    reason: "TYPE_DIRECTION_MISMATCH"
  });

  const secondCompany =
    await executeFinanceCommand(
      transaction({
        companyId: "company-2",
        id: "company-2-charge",
        transactionId: "company-2-charge",
        idempotencyKey: "finance-1"
      })
    );

  assert.equal(
    secondCompany.outcome,
    "CREATED"
  );

  const companyOne =
    await listLocalFinanceTransactions(scope);

  const companyTwo =
    await listLocalFinanceTransactions({
      ...scope,
      companyId: "company-2"
    });

  assert.equal(companyOne.length, 2);
  assert.equal(companyTwo.length, 1);

  console.log("[PASS] finance command service");
}

run().catch(error => {
  console.error(
    "[FAIL] finance command service",
    error
  );
  process.exitCode = 1;
});
