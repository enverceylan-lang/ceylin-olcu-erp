import "fake-indexeddb/auto";

import type {
  FinanceJournalPosting
} from "@/lib/finance/financeJournalContracts";
import {
  executeInterBankTransfer,
  executeManualBankOperation,
  postLocalBankOperationAtomically
} from "@/lib/finance/bankOperationExecutionService";
import {
  localFinanceJournalDb
} from "@/lib/finance/localFinanceJournalDb";
import type {
  InterBankTransferCommand,
  ManualBankOperationCommand
} from "@/lib/finance/manualBankOperationContracts";
import {
  createManualBankOperationPlan
} from "@/lib/finance/manualBankOperationService";

function assertEqual<T>(
  actual: T,
  expected: T,
  message: string
): void {
  if (actual !== expected) {
    throw new Error(
      message +
        " | expected=" +
        String(expected) +
        " actual=" +
        String(actual)
    );
  }
}

async function assertRejects(
  action: () => Promise<unknown>,
  expectedMessage: string,
  message: string
): Promise<void> {
  let actualMessage = "";

  try {
    await action();
  } catch (error) {
    actualMessage =
      error instanceof Error
        ? error.message
        : String(error);
  }

  if (actualMessage !== expectedMessage) {
    throw new Error(
      message +
        " | expected=" +
        expectedMessage +
        " actual=" +
        actualMessage
    );
  }
}

function manualCommand(
  overrides: Partial<ManualBankOperationCommand> = {}
): ManualBankOperationCommand {
  const base: ManualBankOperationCommand = {
    tenantId: "tenant-1",
    companyId: "company-1",
    branchId: "branch-1",
    accountingPeriodId: "period-2026",

    transactionId: "manual-transaction-1",
    idempotencyKey: "manual-operation-1",

    channel: "EFT",
    direction: "IN",

    bankAccountId: "bank-account-1",
    bankLedgerAccountId: "ledger-bank-1",
    counterpartyLedgerAccountId:
      "ledger-customer-1",

    amount: 1500,
    currency: "TRY",

    transactionDate: "2026-07-28",

    movementId: "manual-movement-1",
    movementNumber: "BNK-MAN-0001",

    journalEntryId: "manual-journal-1",
    journalNumber: "FIS-MAN-0001",

    sourceDocumentId: "manual-source-1",
    sourceDocumentNumber: "MAN-0001",

    firstJournalLineId: "manual-line-1",
    secondJournalLineId: "manual-line-2",

    customerId: "customer-1",
    supplierId: null,

    description: "Manuel EFT tahsilatı",

    grantedPermissions: [
      "BANK_EFT_IN"
    ],

    createdBy: "admin",
    createdAt: "2026-07-28T10:00:00.000Z"
  };

  return {
    ...base,
    ...overrides
  };
}

function transferCommand(
  overrides: Partial<InterBankTransferCommand> = {}
): InterBankTransferCommand {
  const base: InterBankTransferCommand = {
    tenantId: "tenant-1",
    companyId: "company-1",
    branchId: "branch-1",
    accountingPeriodId: "period-2026",

    transactionId: "transfer-transaction-1",
    idempotencyKey: "transfer-operation-1",

    sourceBankAccountId:
      "bank-account-source",

    sourceBankLedgerAccountId:
      "ledger-bank-source",

    destinationBankAccountId:
      "bank-account-destination",

    destinationBankLedgerAccountId:
      "ledger-bank-destination",

    amount: 2500,
    currency: "TRY",

    transactionDate: "2026-07-28",

    sourceMovementId:
      "transfer-movement-out",

    sourceMovementNumber:
      "BNK-VIR-C-0001",

    destinationMovementId:
      "transfer-movement-in",

    destinationMovementNumber:
      "BNK-VIR-G-0001",

    journalEntryId:
      "transfer-journal-1",

    journalNumber:
      "FIS-VIR-0001",

    sourceDocumentId:
      "transfer-source-1",

    sourceDocumentNumber:
      "VIR-0001",

    debitJournalLineId:
      "transfer-line-1",

    creditJournalLineId:
      "transfer-line-2",

    description:
      "Bankalar arası virman",

    createdBy: "admin",
    createdAt: "2026-07-28T11:00:00.000Z"
  };

  return {
    ...base,
    ...overrides
  };
}

async function runSuite(): Promise<void> {
  await localFinanceJournalDb.delete();
  await localFinanceJournalDb.open();

  const manualCreated =
    await executeManualBankOperation(
      manualCommand()
    );

  assertEqual(
    manualCreated.status,
    "CREATED",
    "Manuel banka işlemi oluşturulmadı"
  );

  assertEqual(
    await localFinanceJournalDb
      .bankMovements
      .count(),
    1,
    "Manuel işlem banka hareketi sayısı yanlış"
  );

  assertEqual(
    await localFinanceJournalDb
      .entries
      .count(),
    1,
    "Manuel işlem fiş sayısı yanlış"
  );

  assertEqual(
    await localFinanceJournalDb
      .lines
      .count(),
    2,
    "Manuel işlem fiş satırı sayısı yanlış"
  );

  const manualReplay =
    await executeManualBankOperation(
      manualCommand()
    );

  assertEqual(
    manualReplay.status,
    "REPLAY",
    "Manuel işlem replay olarak tanınmadı"
  );

  assertEqual(
    await localFinanceJournalDb
      .bankMovements
      .count(),
    1,
    "Manuel replay mükerrer banka hareketi oluşturdu"
  );

  const transferCreated =
    await executeInterBankTransfer(
      transferCommand()
    );

  assertEqual(
    transferCreated.status,
    "CREATED",
    "Virman işlemi oluşturulmadı"
  );

  assertEqual(
    transferCreated.bankMovementIds.length,
    2,
    "Virman iki banka hareketi üretmedi"
  );

  assertEqual(
    await localFinanceJournalDb
      .bankMovements
      .count(),
    3,
    "Virman sonrası toplam banka hareketi sayısı yanlış"
  );

  assertEqual(
    await localFinanceJournalDb
      .entries
      .count(),
    2,
    "Virman sonrası toplam fiş sayısı yanlış"
  );

  assertEqual(
    await localFinanceJournalDb
      .lines
      .count(),
    4,
    "Virman sonrası toplam fiş satırı sayısı yanlış"
  );

  const transferReplay =
    await executeInterBankTransfer(
      transferCommand()
    );

  assertEqual(
    transferReplay.status,
    "REPLAY",
    "Virman replay olarak tanınmadı"
  );

  assertEqual(
    await localFinanceJournalDb
      .bankMovements
      .count(),
    3,
    "Virman replay mükerrer hareket oluşturdu"
  );

  await assertRejects(
    () =>
      executeManualBankOperation(
        manualCommand({
          transactionId:
            "manual-transaction-conflict",

          movementId:
            "manual-movement-conflict",

          journalEntryId:
            "manual-journal-conflict",

          firstJournalLineId:
            "manual-conflict-line-1",

          secondJournalLineId:
            "manual-conflict-line-2"
        })
      ),
    "BANK_OPERATION_IDEMPOTENCY_CONFLICT",
    "Idempotency çakışması reddedilmedi"
  );

  const rollbackCommand =
    manualCommand({
      transactionId: "rollback-transaction",
      idempotencyKey: "rollback-operation",

      movementId: "rollback-movement",
      movementNumber: "BNK-RBK-0001",

      journalEntryId: "rollback-journal",
      journalNumber: "FIS-RBK-0001",

      sourceDocumentId: "rollback-source",
      sourceDocumentNumber: "RBK-0001",

      firstJournalLineId: "rollback-line",
      secondJournalLineId: "rollback-line"
    });

  const rollbackPlan =
    createManualBankOperationPlan(
      rollbackCommand
    );

  const invalidPosting: FinanceJournalPosting = {
    ...rollbackPlan.journalPosting,
    lines: [
      rollbackPlan.journalPosting.lines[0],
      {
        ...rollbackPlan.journalPosting.lines[1],
        id:
          rollbackPlan.journalPosting
            .lines[0].id
      }
    ]
  };

  const bankCountBeforeRollback =
    await localFinanceJournalDb
      .bankMovements
      .count();

  const entryCountBeforeRollback =
    await localFinanceJournalDb
      .entries
      .count();

  const lineCountBeforeRollback =
    await localFinanceJournalDb
      .lines
      .count();

  await assertRejects(
    () =>
      postLocalBankOperationAtomically(
        [rollbackPlan.bankMovement],
        invalidPosting
      ),
    "BANK_OPERATION_JOURNAL_LINE_ID_DUPLICATE",
    "Mükerrer fiş satırı reddedilmedi"
  );

  assertEqual(
    await localFinanceJournalDb
      .bankMovements
      .count(),
    bankCountBeforeRollback,
    "Rollback testinde banka hareketi sızdı"
  );

  assertEqual(
    await localFinanceJournalDb
      .entries
      .count(),
    entryCountBeforeRollback,
    "Rollback testinde finans fişi sızdı"
  );

  assertEqual(
    await localFinanceJournalDb
      .lines
      .count(),
    lineCountBeforeRollback,
    "Rollback testinde fiş satırı sızdı"
  );

  await localFinanceJournalDb.delete();

  console.log(
    "BANK_OPERATION_EXECUTION_ATOMIC_TEST: PAK"
  );
}

runSuite().catch(async error => {
  console.error(error);

  try {
    await localFinanceJournalDb.delete();
  } catch {
    // Test temizliği ana hatayı gölgelememelidir.
  }

  process.exitCode = 1;
});
