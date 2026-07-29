import "fake-indexeddb/auto";

import assert from "node:assert/strict";

import type {
  FinanceAccount
} from "../src/lib/finance/financeContracts";
import type {
  FinanceJournalPosting
} from "../src/lib/finance/financeJournalContracts";
import {
  listLocalFinanceJournalEntries,
  listLocalFinanceJournalLines,
  localFinanceJournalDb,
  postLocalFinanceJournal,
  saveLocalFinanceAccount
} from "../src/lib/finance/localFinanceJournalDb";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

function account(
  overrides: Partial<FinanceAccount> = {}
): FinanceAccount {
  const base: FinanceAccount = {
    ...scope,
    id: "account-customer",
    code: "120.01",
    name: "Müşteri Alacakları",
    type: "CUSTOMER_RECEIVABLE",
    currency: "TRY",
    isActive: true,
    isDefaultCollection: false,
    isDefaultPayment: false,
    linkedBankAccountId: null,
    linkedPosAccountId: null,
    createdAt: "2026-07-27T19:00:00.000Z",
    updatedAt: "2026-07-27T19:00:00.000Z",
    archivedAt: null
  };

  return {
    ...base,
    ...overrides
  } as FinanceAccount;
}

function cashCollectionPosting(
  overrides: Partial<FinanceJournalPosting> = {}
): FinanceJournalPosting {
  const base: FinanceJournalPosting = {
    entry: {
      ...scope,
      id: "journal-1",
      journalNo: "FIS-000001",
      transactionId: "collection-1",
      idempotencyKey:
        "journal:sale-1:payment-1",
      sourceDocumentType: "SALE_PAYMENT",
      sourceDocumentId: "payment-1",
      description: "Nakit satış tahsilatı",
      currency: "TRY",
      status: "POSTED",
      reversalOfJournalEntryId: null,
      createdBy: "office-1",
      createdAt: "2026-07-27T19:00:00.000Z",
      postedAt: "2026-07-27T19:00:00.000Z",
      reversedAt: null
    },
    lines: [
      {
        ...scope,
        id: "journal-line-1",
        journalEntryId: "journal-1",
        lineNo: 1,
        accountId: "account-cash",
        customerId: null,
        supplierId: null,
        chequeNoteId: null,
        description: "Kasa borç",
        debitAmount: 250,
        creditAmount: 0,
        currency: "TRY"
      },
      {
        ...scope,
        id: "journal-line-2",
        journalEntryId: "journal-1",
        lineNo: 2,
        accountId: "account-customer",
        customerId: "customer-1",
        supplierId: null,
        chequeNoteId: null,
        description: "Müşteri alacağı kapanışı",
        debitAmount: 0,
        creditAmount: 250,
        currency: "TRY"
      }
    ]
  };

  return {
    ...base,
    ...overrides
  } as FinanceJournalPosting;
}

async function run(): Promise<void> {
  await localFinanceJournalDb.delete();
  await localFinanceJournalDb.open();

  await saveLocalFinanceAccount(account());

  await saveLocalFinanceAccount(
    account({
      id: "account-cash",
      code: "100.01",
      name: "Merkez Kasa",
      type: "CASH",
      isDefaultCollection: true
    })
  );

  const posting = cashCollectionPosting();

  const created =
    await postLocalFinanceJournal(posting);

  assert.equal(created.outcome, "CREATED");

  const replay =
    await postLocalFinanceJournal(posting);

  assert.equal(replay.outcome, "REPLAY");

  const entries =
    await listLocalFinanceJournalEntries(scope);

  const lines =
    await listLocalFinanceJournalLines(
      scope,
      "journal-1"
    );

  assert.equal(entries.length, 1);
  assert.equal(lines.length, 2);

  await assert.rejects(
    () =>
      postLocalFinanceJournal(
        cashCollectionPosting({
          entry: {
            ...posting.entry,
            id: "journal-unbalanced",
            journalNo: "FIS-000002",
            transactionId: "unbalanced",
            idempotencyKey: "unbalanced"
          },
          lines: [
            {
              ...posting.lines[0],
              id: "unbalanced-line-1",
              journalEntryId: "journal-unbalanced",
              debitAmount: 300
            },
            {
              ...posting.lines[1],
              id: "unbalanced-line-2",
              journalEntryId: "journal-unbalanced",
              creditAmount: 250
            }
          ]
        })
      ),
    /FINANCE_JOURNAL_UNBALANCED/
  );

  await saveLocalFinanceAccount(
    account({
      companyId: "company-2",
      id: "company-2-cash",
      code: "100.02",
      name: "Diğer Şirket Kasa",
      type: "CASH"
    })
  );

  await assert.rejects(
    () =>
      postLocalFinanceJournal(
        cashCollectionPosting({
          entry: {
            ...posting.entry,
            id: "journal-scope-error",
            journalNo: "FIS-000003",
            transactionId: "scope-error",
            idempotencyKey: "scope-error"
          },
          lines: [
            {
              ...posting.lines[0],
              id: "scope-error-line-1",
              journalEntryId: "journal-scope-error",
              accountId: "company-2-cash"
            },
            {
              ...posting.lines[1],
              id: "scope-error-line-2",
              journalEntryId: "journal-scope-error"
            }
          ]
        })
      ),
    /FINANCE_JOURNAL_ACCOUNT_SCOPE_MISMATCH/
  );

  console.log("[PASS] finance journal db");
}

run().catch(error => {
  console.error("[FAIL] finance journal db", error);
  process.exitCode = 1;
});
