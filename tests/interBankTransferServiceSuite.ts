import type {
  InterBankTransferCommand
} from "@/lib/finance/manualBankOperationContracts";
import {
  createInterBankTransferPlan
} from "@/lib/finance/interBankTransferService";

function assertEqual<T>(
  actual: T,
  expected: T,
  message: string
): void {
  if (actual !== expected) {
    throw new Error(
      `${message} | expected=${String(expected)} actual=${String(actual)}`
    );
  }
}

function assertThrows(
  action: () => unknown,
  expectedMessage: string,
  message: string
): void {
  let thrownMessage = "";

  try {
    action();
  } catch (error) {
    thrownMessage =
      error instanceof Error
        ? error.message
        : String(error);
  }

  if (thrownMessage !== expectedMessage) {
    throw new Error(
      `${message} | expected=${expectedMessage} actual=${thrownMessage}`
    );
  }
}

function command(
  overrides: Partial<InterBankTransferCommand> = {}
): InterBankTransferCommand {
  const base: InterBankTransferCommand = {
    tenantId: "tenant-1",
    companyId: "company-1",
    branchId: "branch-1",
    accountingPeriodId: "period-2026",

    transactionId: "transfer-transaction-1",
    idempotencyKey: "inter-bank-transfer-1",

    sourceBankAccountId:
      "bank-account-source",

    sourceBankLedgerAccountId:
      "ledger-bank-source",

    destinationBankAccountId:
      "bank-account-destination",

    destinationBankLedgerAccountId:
      "ledger-bank-destination",

    amount: 2500.75,
    currency: "TRY",

    transactionDate: "2026-07-28",
    valueDate: "2026-07-29",

    sourceMovementId:
      "movement-transfer-out",

    sourceMovementNumber:
      "BNK-VIR-C-0001",

    destinationMovementId:
      "movement-transfer-in",

    destinationMovementNumber:
      "BNK-VIR-G-0001",

    journalEntryId:
      "journal-transfer-1",

    journalNumber:
      "FIS-VIR-0001",

    sourceDocumentId:
      "transfer-document-1",

    sourceDocumentNumber:
      "VIR-0001",

    debitJournalLineId:
      "journal-transfer-line-1",

    creditJournalLineId:
      "journal-transfer-line-2",

    description:
      "Bankalar arası TRY virman",

    createdBy: "admin",
    createdAt: "2026-07-28T11:00:00.000Z"
  };

  return {
    ...base,
    ...overrides
  };
}

function runSuite(): void {
  const plan =
    createInterBankTransferPlan(
      command()
    );

  assertEqual(
    plan.sourceMovement.movementType,
    "INTERNAL_TRANSFER_OUT",
    "Kaynak virman hareket tipi yanlış"
  );

  assertEqual(
    plan.sourceMovement.direction,
    "OUT",
    "Kaynak virman yönü yanlış"
  );

  assertEqual(
    plan.sourceMovement.bankAccountId,
    "bank-account-source",
    "Kaynak banka hesabı yanlış"
  );

  assertEqual(
    plan.destinationMovement.movementType,
    "INTERNAL_TRANSFER_IN",
    "Hedef virman hareket tipi yanlış"
  );

  assertEqual(
    plan.destinationMovement.direction,
    "IN",
    "Hedef virman yönü yanlış"
  );

  assertEqual(
    plan.destinationMovement.bankAccountId,
    "bank-account-destination",
    "Hedef banka hesabı yanlış"
  );

  assertEqual(
    plan.sourceMovement.externalReference,
    "transfer-transaction-1",
    "Kaynak hareket transaction bağlantısı yanlış"
  );

  assertEqual(
    plan.destinationMovement.externalReference,
    "transfer-transaction-1",
    "Hedef hareket transaction bağlantısı yanlış"
  );

  assertEqual(
    plan.sourceMovement.netAmount,
    2500.75,
    "Kaynak hareket tutarı yanlış"
  );

  assertEqual(
    plan.destinationMovement.netAmount,
    2500.75,
    "Hedef hareket tutarı yanlış"
  );

  assertEqual(
    plan.sourceMovement.companyId,
    "company-1",
    "Kaynak hareket şirket kapsamı yanlış"
  );

  assertEqual(
    plan.destinationMovement.companyId,
    "company-1",
    "Hedef hareket şirket kapsamı yanlış"
  );

  assertEqual(
    plan.journalPosting.entry.transactionId,
    "transfer-transaction-1",
    "Virman fişi transaction kimliği yanlış"
  );

  assertEqual(
    plan.journalPosting.entry.idempotencyKey,
    "inter-bank-transfer-1",
    "Virman fişi idempotency anahtarı yanlış"
  );

  assertEqual(
    plan.journalPosting.lines.length,
    2,
    "Virman fişi iki satır olmalı"
  );

  assertEqual(
    plan.journalPosting.lines[0]?.accountId,
    "ledger-bank-destination",
    "Virman borç satırı hedef banka olmalı"
  );

  assertEqual(
    plan.journalPosting.lines[0]?.debitAmount,
    2500.75,
    "Hedef banka borç tutarı yanlış"
  );

  assertEqual(
    plan.journalPosting.lines[1]?.accountId,
    "ledger-bank-source",
    "Virman alacak satırı kaynak banka olmalı"
  );

  assertEqual(
    plan.journalPosting.lines[1]?.creditAmount,
    2500.75,
    "Kaynak banka alacak tutarı yanlış"
  );

  const totalDebit =
    plan.journalPosting.lines.reduce(
      (total, line) =>
        total + line.debitAmount,
      0
    );

  const totalCredit =
    plan.journalPosting.lines.reduce(
      (total, line) =>
        total + line.creditAmount,
      0
    );

  assertEqual(
    totalDebit,
    totalCredit,
    "Virman finans fişi dengeli değil"
  );

  assertThrows(
    () =>
      createInterBankTransferPlan(
        command({
          destinationBankAccountId:
            "bank-account-source"
        })
      ),
    "INTER_BANK_TRANSFER_BANK_ACCOUNTS_MUST_DIFFER",
    "Aynı banka hesabına virman reddedilmedi"
  );

  assertThrows(
    () =>
      createInterBankTransferPlan(
        command({
          destinationBankLedgerAccountId:
            "ledger-bank-source"
        })
      ),
    "INTER_BANK_TRANSFER_LEDGER_ACCOUNTS_MUST_DIFFER",
    "Aynı muhasebe hesabına virman reddedilmedi"
  );

  assertThrows(
    () =>
      createInterBankTransferPlan(
        command({
          amount: 0
        })
      ),
    "INTER_BANK_TRANSFER_AMOUNT_INVALID",
    "Sıfır virman tutarı reddedilmedi"
  );

  assertThrows(
    () =>
      createInterBankTransferPlan(
        command({
          amount: Number.NaN
        })
      ),
    "INTER_BANK_TRANSFER_AMOUNT_INVALID",
    "Geçersiz virman tutarı reddedilmedi"
  );

  assertThrows(
    () =>
      createInterBankTransferPlan(
        command({
          transactionDate: "2026-13-01"
        })
      ),
    "INTER_BANK_TRANSFER_DATE_INVALID",
    "Geçersiz virman tarihi reddedilmedi"
  );

  assertThrows(
    () =>
      createInterBankTransferPlan(
        command({
          transactionId: " "
        })
      ),
    "INTER_BANK_TRANSFER_TRANSACTION_REQUIRED",
    "Boş virman transaction kimliği reddedilmedi"
  );

  assertThrows(
    () =>
      createInterBankTransferPlan(
        command({
          currency: " "
        })
      ),
    "INTER_BANK_TRANSFER_CURRENCY_REQUIRED",
    "Boş para birimi reddedilmedi"
  );

  console.log(
    "INTER_BANK_TRANSFER_SERVICE_TEST: PAK"
  );
}

runSuite();
