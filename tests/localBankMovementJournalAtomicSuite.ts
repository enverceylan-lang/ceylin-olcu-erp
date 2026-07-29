import "fake-indexeddb/auto";

import assert from "node:assert/strict";

import type {
  BankMovement
} from "../src/lib/finance/bankingContracts";
import type {
  FinanceAccount
} from "../src/lib/finance/financeContracts";
import type {
  FinanceJournalPosting
} from "../src/lib/finance/financeJournalContracts";
import {
  localFinanceJournalDb,
  postLocalBankMovementAndJournal,
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
  name: string
): FinanceAccount {
  return {
    ...scope,

    id,
    code,
    name,

    type: "CASH",
    currency: "TRY",
    isActive: true,

    isDefaultCollection: false,
    isDefaultPayment: false,

    linkedBankAccountId: null,
    linkedPosAccountId: null,

    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:00.000Z",
    archivedAt: null
  };
}

function bankMovement(
  overrides: Partial<BankMovement> = {}
): BankMovement {
  const base: BankMovement = {
    ...scope,

    id: "bank-movement-1",
    movementNumber: "BNK-HRK-0001",
    bankAccountId: "bank-account-1",

    movementType: "POS_SETTLEMENT",
    direction: "IN",

    sourceModule: "POS",
    sourceDocumentType: "POS_SETTLEMENT",
    sourceDocumentId: "settlement-1",
    sourceDocumentNumber: "POS-GEC-0001",

    customerId: "customer-1",
    supplierId: null,
    tailorId: null,
    installerId: null,

    grossAmount: 10000,
    feeAmount: 300,
    netAmount: 9700,
    currency: "TRY",

    transactionDate: "2026-07-28",
    valueDate: "2026-07-28",
    settlementDate: "2026-07-28",

    status: "SETTLED",
    description: "POS banka geçişi",
    externalReference: null,

    createdBy: "admin",
    createdAt: "2026-07-28T00:10:00.000Z",

    reversedAt: null,
    reversalOfMovementId: null
  };

  return {
    ...base,
    ...overrides
  };
}

function posting(
  overrides: Partial<FinanceJournalPosting> = {}
): FinanceJournalPosting {
  const base: FinanceJournalPosting = {
    entry: {
      ...scope,

      id: "journal-1",
      journalNo: "FIS-POS-0001",
      transactionId: "settlement-1",
      idempotencyKey: "atomic-pos-settlement-1",

      sourceDocumentType: "POS_SETTLEMENT",
      sourceDocumentId: "settlement-1",

      description: "POS settlement fişi",
      currency: "TRY",
      status: "POSTED",

      reversalOfJournalEntryId: null,

      createdBy: "admin",
      createdAt: "2026-07-28T00:10:00.000Z",
      postedAt: "2026-07-28T00:10:00.000Z",
      reversedAt: null
    },

    lines: [
      {
        ...scope,

        id: "journal-1:1",
        journalEntryId: "journal-1",
        lineNo: 1,

        accountId: "account-bank",
        customerId: null,
        supplierId: null,
        chequeNoteId: null,

        description: "Banka girişi",
        debitAmount: 9700,
        creditAmount: 0,
        currency: "TRY"
      },
      {
        ...scope,

        id: "journal-1:2",
        journalEntryId: "journal-1",
        lineNo: 2,

        accountId: "account-expense",
        customerId: null,
        supplierId: null,
        chequeNoteId: null,

        description: "POS komisyon gideri",
        debitAmount: 300,
        creditAmount: 0,
        currency: "TRY"
      },
      {
        ...scope,

        id: "journal-1:3",
        journalEntryId: "journal-1",
        lineNo: 3,

        accountId: "account-pos-clearing",
        customerId: null,
        supplierId: null,
        chequeNoteId: null,

        description: "POS bekleyen hesabı çıkışı",
        debitAmount: 0,
        creditAmount: 10000,
        currency: "TRY"
      }
    ]
  };

  return {
    ...base,
    ...overrides
  };
}

async function counts(): Promise<{
  bankMovements: number;
  entries: number;
  lines: number;
}> {
  return {
    bankMovements:
      await localFinanceJournalDb.bankMovements.count(),
    entries:
      await localFinanceJournalDb.entries.count(),
    lines:
      await localFinanceJournalDb.lines.count()
  };
}

async function run(): Promise<void> {
  await localFinanceJournalDb.delete();
  await localFinanceJournalDb.open();

  await saveLocalFinanceAccount(
    account(
      "account-bank",
      "102.01",
      "POS Bağlı Banka"
    )
  );

  await saveLocalFinanceAccount(
    account(
      "account-expense",
      "780.01",
      "POS Komisyon Gideri"
    )
  );

  await saveLocalFinanceAccount(
    account(
      "account-pos-clearing",
      "108.01",
      "POS Bekleyen Hesabı"
    )
  );

  /*
   * BankMovement ve journal entry yazıldıktan sonra
   * bulkAdd aşamasında mükerrer satır kimliği hatası
   * oluşturulur. Transaction tamamen geri alınmalıdır.
   */
  const rollbackPosting = posting({
    entry: {
      ...posting().entry,
      id: "journal-rollback",
      journalNo: "FIS-ROLLBACK",
      transactionId: "settlement-rollback",
      idempotencyKey: "atomic-rollback",
      sourceDocumentId: "settlement-rollback"
    },
    lines: [
      {
        ...posting().lines[0],
        id: "journal-rollback:duplicate",
        journalEntryId: "journal-rollback"
      },
      {
        ...posting().lines[1],
        id: "journal-rollback:duplicate",
        journalEntryId: "journal-rollback"
      },
      {
        ...posting().lines[2],
        id: "journal-rollback:3",
        journalEntryId: "journal-rollback"
      }
    ]
  });

  await assert.rejects(
    () =>
      postLocalBankMovementAndJournal(
        bankMovement({
          id: "bank-movement-rollback",
          movementNumber: "BNK-ROLLBACK",
          sourceDocumentId:
            "settlement-rollback",
          sourceDocumentNumber:
            "POS-ROLLBACK"
        }),
        rollbackPosting
      )
  );

  assert.deepEqual(
    await counts(),
    {
      bankMovements: 0,
      entries: 0,
      lines: 0
    }
  );

  const movement = bankMovement();
  const validPosting = posting();

  const created =
    await postLocalBankMovementAndJournal(
      movement,
      validPosting
    );

  assert.equal(
    created.outcome,
    "CREATED"
  );

  assert.deepEqual(
    await counts(),
    {
      bankMovements: 1,
      entries: 1,
      lines: 3
    }
  );

  const replay =
    await postLocalBankMovementAndJournal(
      movement,
      validPosting
    );

  assert.equal(
    replay.outcome,
    "REPLAY"
  );

  assert.deepEqual(
    await counts(),
    {
      bankMovements: 1,
      entries: 1,
      lines: 3
    }
  );

  await assert.rejects(
    () =>
      postLocalBankMovementAndJournal(
        {
          ...movement,
          netAmount: 9600
        },
        validPosting
      ),
    /BANK_MOVEMENT_IDEMPOTENCY_CONFLICT/
  );

  assert.deepEqual(
    await counts(),
    {
      bankMovements: 1,
      entries: 1,
      lines: 3
    }
  );

  await assert.rejects(
    () =>
      postLocalBankMovementAndJournal(
        {
          ...movement,

          id: "bank-movement-company-2",
          movementNumber: "BNK-COMPANY-2",

          companyId: "company-2",
          sourceDocumentId:
            "settlement-company-2",
          sourceDocumentNumber:
            "POS-COMPANY-2"
        },
        {
          ...validPosting,

          entry: {
            ...validPosting.entry,

            id: "journal-company-2",
            journalNo: "FIS-COMPANY-2",
            transactionId:
              "settlement-company-2",
            idempotencyKey:
              "atomic-company-2",
            sourceDocumentId:
              "settlement-company-2"
          },

          lines: validPosting.lines.map(
            (line, index) => ({
              ...line,

              id:
                `journal-company-2:${index + 1}`,
              journalEntryId:
                "journal-company-2"
            })
          )
        }
      ),
    /BANK_MOVEMENT_JOURNAL_SCOPE_MISMATCH/
  );

  assert.deepEqual(
    await counts(),
    {
      bankMovements: 1,
      entries: 1,
      lines: 3
    }
  );

  console.log(
    "[PASS] local bank movement journal atomic lifecycle"
  );

  await localFinanceJournalDb.close();
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
