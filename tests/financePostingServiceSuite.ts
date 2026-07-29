import "fake-indexeddb/auto";

import assert from "node:assert/strict";

import type {
  FinanceAccount
} from "../src/lib/finance/financeContracts";
import {
  createCollectionJournalPosting,
  postCollectionJournal,
  type CreateCollectionPostingCommand
} from "../src/lib/finance/financePostingService";
import {
  listLocalFinanceJournalEntries,
  listLocalFinanceJournalLines,
  localFinanceJournalDb,
  saveLocalFinanceAccount
} from "../src/lib/finance/localFinanceJournalDb";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

function account(
  id: string,
  code: string,
  name: string,
  type: FinanceAccount["type"]
): FinanceAccount {
  return {
    ...scope,
    id,
    code,
    name,
    type,
    currency: "TRY",
    isActive: true,
    isDefaultCollection: false,
    isDefaultPayment: false,
    linkedBankAccountId: null,
    linkedPosAccountId: null,
    createdAt: "2026-07-27T20:00:00.000Z",
    updatedAt: "2026-07-27T20:00:00.000Z",
    archivedAt: null
  };
}

function command(
  overrides: Partial<CreateCollectionPostingCommand> = {}
): CreateCollectionPostingCommand {
  const base: CreateCollectionPostingCommand = {
    ...scope,
    journalEntryId: "journal-cash-1",
    journalNo: "FIS-2026-000001",
    transactionId: "transaction-cash-1",
    idempotencyKey:
      "journal:sale-1:payment-cash-1",
    paymentId: "payment-cash-1",
    saleId: "sale-1",
    customerId: "customer-1",
    amount: 250,
    currency: "TRY",
    channel: "CASH",
    paymentMethod: "CASH",
    accounts: {
      customerReceivableAccountId:
        "account-customer",
      cashAccountId: "account-cash",
      posAccountId: "account-pos",
      bankAccountId: "account-bank"
    },
    description: null,
    createdBy: "office-1",
    occurredAt: "2026-07-27T20:00:00.000Z"
  };

  return {
    ...base,
    ...overrides
  };
}

async function run(): Promise<void> {
  await localFinanceJournalDb.delete();
  await localFinanceJournalDb.open();

  await saveLocalFinanceAccount(
    account(
      "account-customer",
      "120.01",
      "Müşteri Alacakları",
      "CUSTOMER_RECEIVABLE"
    )
  );

  await saveLocalFinanceAccount(
    account(
      "account-cash",
      "100.01",
      "Merkez Kasa",
      "CASH"
    )
  );

  await saveLocalFinanceAccount(
    account(
      "account-pos",
      "108.01",
      "POS Alacakları",
      "POS"
    )
  );

  await saveLocalFinanceAccount(
    account(
      "account-bank",
      "102.01",
      "Banka",
      "BANK"
    )
  );

  const cashPosting =
    createCollectionJournalPosting(command());

  assert.equal(
    cashPosting.lines[0].accountId,
    "account-cash"
  );

  assert.equal(
    cashPosting.lines[0].debitAmount,
    250
  );

  assert.equal(
    cashPosting.lines[1].creditAmount,
    250
  );

  const cashResult =
    await postCollectionJournal(command());

  assert.equal(cashResult.outcome, "CREATED");

  const cashReplay =
    await postCollectionJournal(command());

  assert.equal(cashReplay.outcome, "REPLAY");

  const posCommand = command({
    journalEntryId: "journal-pos-1",
    journalNo: "FIS-2026-000002",
    transactionId: "transaction-pos-1",
    idempotencyKey:
      "journal:sale-1:payment-pos-1",
    paymentId: "payment-pos-1",
    channel: "POS",
    paymentMethod: "CREDIT_CARD"
  });

  const posPosting =
    createCollectionJournalPosting(posCommand);

  assert.equal(
    posPosting.lines[0].accountId,
    "account-pos"
  );

  const posResult =
    await postCollectionJournal(posCommand);

  assert.equal(posResult.outcome, "CREATED");

  const bankCommand = command({
    journalEntryId: "journal-bank-1",
    journalNo: "FIS-2026-000003",
    transactionId: "transaction-bank-1",
    idempotencyKey:
      "journal:sale-1:payment-bank-1",
    paymentId: "payment-bank-1",
    channel: "BANK",
    paymentMethod: "EFT"
  });

  const bankPosting =
    createCollectionJournalPosting(bankCommand);

  assert.equal(
    bankPosting.lines[0].accountId,
    "account-bank"
  );

  const bankResult =
    await postCollectionJournal(bankCommand);

  assert.equal(bankResult.outcome, "CREATED");

  assert.throws(
    () =>
      createCollectionJournalPosting(
        command({
          channel: "POS",
          paymentMethod: "CASH"
        })
      ),
    /FINANCE_COLLECTION_POSTING_PAYMENT_METHOD_MISMATCH/
  );

  assert.throws(
    () =>
      createCollectionJournalPosting(
        command({
          accounts: {
            customerReceivableAccountId:
              "account-customer"
          }
        })
      ),
    /FINANCE_COLLECTION_POSTING_CHANNEL_ACCOUNT_REQUIRED/
  );

  const entries =
    await listLocalFinanceJournalEntries(scope);

  const cashLines =
    await listLocalFinanceJournalLines(
      scope,
      "journal-cash-1"
    );

  assert.equal(entries.length, 3);
  assert.equal(cashLines.length, 2);

  console.log(
    "[PASS] finance posting service"
  );
}

run().catch(error => {
  console.error(
    "[FAIL] finance posting service",
    error
  );
  process.exitCode = 1;
});
