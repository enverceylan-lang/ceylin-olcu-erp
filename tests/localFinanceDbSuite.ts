import "fake-indexeddb/auto";

import assert from "node:assert/strict";

import type {
  FinanceTransaction
} from "../src/lib/finance/financeContracts";
import {
  appendLocalFinanceTransaction,
  listLocalFinanceAudits,
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
    idempotencyKey: "sale:sale-1:payment:payment-1",
    transactionType: "COLLECTION",
    direction: "CREDIT",
    paymentMethod: "CASH",
    financeAccountId: null,
    counterAccountId: null,
    customerId: "customer-1",
    saleId: "sale-1",
    sourceDocumentId: "payment-1",
    sourceDocumentType: "SALE_PAYMENT",
    grossAmount: 250,
    commissionAmount: 0,
    netAmount: 250,
    currency: "TRY",
    transactionDate: "2026-07-27",
    valueDate: "2026-07-27",
    dueDate: null,
    status: "POSTED",
    description: "Satış tahsilatı",
    externalReference: null,
    reversalOfTransactionId: null,
    createdBy: "office-1",
    createdAt: "2026-07-27T17:30:00.000Z",
    postedAt: "2026-07-27T17:30:00.000Z",
    reversedAt: null,
    archivedAt: null,
    projectionSource: "SALE_PAYMENT"
  };

  return {
    ...base,
    ...overrides
  } as FinanceTransaction;
}
async function run(): Promise<void> {
  await localFinanceDb.delete();
  await localFinanceDb.open();

  const first = await appendLocalFinanceTransaction(
    transaction()
  );

  assert.equal(first.outcome, "CREATED");

  const replay = await appendLocalFinanceTransaction(
    transaction()
  );

  assert.equal(replay.outcome, "REPLAY");

  const transactions =
    await listLocalFinanceTransactions(
      scope,
      "customer-1",
      "sale-1"
    );

  assert.equal(transactions.length, 1);

  const audits =
    await listLocalFinanceAudits(
      scope,
      "finance-1"
    );

  assert.equal(audits.length, 1);
  assert.equal(audits[0].transactionId, "finance-1");

  await assert.rejects(
    () =>
      appendLocalFinanceTransaction(
        transaction({
          id: "finance-conflict",
          transactionId: "finance-conflict",
          netAmount: 300,
          grossAmount: 300
        })
      ),
    /FINANCE_IDEMPOTENCY_CONFLICT/
  );

  const secondScope = {
    ...scope,
    companyId: "company-2"
  };

  const secondCompany =
    await appendLocalFinanceTransaction(
      transaction({
        ...secondScope,
        id: "finance-company-2",
        transactionId: "finance-company-2"
      })
    );

  assert.equal(secondCompany.outcome, "CREATED");

  const companyOneTransactions =
    await listLocalFinanceTransactions(scope);

  const companyTwoTransactions =
    await listLocalFinanceTransactions(secondScope);

  assert.equal(companyOneTransactions.length, 1);
  assert.equal(companyTwoTransactions.length, 1);

  console.log("[PASS] local finance db");
}

run().catch(error => {
  console.error("[FAIL] local finance db", error);
  process.exitCode = 1;
});
