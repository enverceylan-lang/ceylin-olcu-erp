import type {
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
  overrides: Partial<ManualBankOperationCommand> = {}
): ManualBankOperationCommand {
  const base: ManualBankOperationCommand = {
    tenantId: "tenant-1",
    companyId: "company-1",
    branchId: "branch-1",
    accountingPeriodId: "period-2026",

    transactionId: "transaction-1",
    idempotencyKey: "manual-bank-operation-1",

    channel: "EFT",
    direction: "IN",

    bankAccountId: "bank-account-1",
    bankLedgerAccountId: "ledger-bank-1",
    counterpartyLedgerAccountId: "ledger-customer-1",

    amount: 1250.5,
    currency: "TRY",

    transactionDate: "2026-07-28",
    valueDate: "2026-07-29",

    movementId: "bank-movement-1",
    movementNumber: "BNK-HRK-0001",

    journalEntryId: "journal-entry-1",
    journalNumber: "FIS-BNK-0001",

    sourceDocumentId: "manual-document-1",
    sourceDocumentNumber: "MB-0001",

    firstJournalLineId: "journal-line-1",
    secondJournalLineId: "journal-line-2",

    customerId: "customer-1",
    supplierId: null,

    description: "Müşteri EFT tahsilatı",
    externalReference: "BANK-REF-1",

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

function runSuite(): void {
  const incoming =
    createManualBankOperationPlan(
      command()
    );

  assertEqual(
    incoming.requiredPermission,
    "BANK_EFT_IN",
    "EFT giriş yetkisi yanlış"
  );

  assertEqual(
    incoming.movementType,
    "EFT_IN",
    "EFT giriş hareket tipi yanlış"
  );

  assertEqual(
    incoming.bankMovement.direction,
    "IN",
    "EFT giriş hareket yönü yanlış"
  );

  assertEqual(
    incoming.bankMovement.netAmount,
    1250.5,
    "EFT giriş net tutarı yanlış"
  );

  assertEqual(
    incoming.bankMovement.bankAccountId,
    "bank-account-1",
    "Banka hesabı korunmadı"
  );

  assertEqual(
    incoming.bankMovement.companyId,
    "company-1",
    "Şirket kapsamı korunmadı"
  );

  assertEqual(
    incoming.bankMovement.currency,
    "TRY",
    "Para birimi korunmadı"
  );

  assertEqual(
    incoming.journalPosting.lines.length,
    2,
    "Manuel banka fişi iki satır olmalı"
  );

  assertEqual(
    incoming.journalPosting.lines[0]?.accountId,
    "ledger-bank-1",
    "Giriş işleminde ilk satır banka hesabı olmalı"
  );

  assertEqual(
    incoming.journalPosting.lines[0]?.debitAmount,
    1250.5,
    "Giriş işleminde banka borçlandırılmalı"
  );

  assertEqual(
    incoming.journalPosting.lines[0]?.creditAmount,
    0,
    "Giriş işleminde banka alacağı sıfır olmalı"
  );

  assertEqual(
    incoming.journalPosting.lines[1]?.accountId,
    "ledger-customer-1",
    "Giriş işleminde karşı hesap yanlış"
  );

  assertEqual(
    incoming.journalPosting.lines[1]?.debitAmount,
    0,
    "Giriş işleminde karşı hesap borcu sıfır olmalı"
  );

  assertEqual(
    incoming.journalPosting.lines[1]?.creditAmount,
    1250.5,
    "Giriş işleminde karşı hesap alacaklandırılmalı"
  );

  const incomingDebit =
    incoming.journalPosting.lines.reduce(
      (total, line) =>
        total + line.debitAmount,
      0
    );

  const incomingCredit =
    incoming.journalPosting.lines.reduce(
      (total, line) =>
        total + line.creditAmount,
      0
    );

  assertEqual(
    incomingDebit,
    incomingCredit,
    "EFT giriş fişi dengeli değil"
  );

  const outgoing =
    createManualBankOperationPlan(
      command({
        transactionId: "transaction-2",
        idempotencyKey:
          "manual-bank-operation-2",

        channel: "FAST",
        direction: "OUT",

        amount: 750,

        movementId: "bank-movement-2",
        movementNumber: "BNK-HRK-0002",

        journalEntryId: "journal-entry-2",
        journalNumber: "FIS-BNK-0002",

        sourceDocumentId: "manual-document-2",
        sourceDocumentNumber: "MB-0002",

        firstJournalLineId: "journal-line-3",
        secondJournalLineId: "journal-line-4",

        customerId: null,
        supplierId: "supplier-1",

        description: "Tedarikçiye FAST ödeme",

        grantedPermissions: [
          "BANK_FAST_OUT"
        ]
      })
    );

  assertEqual(
    outgoing.requiredPermission,
    "BANK_FAST_OUT",
    "FAST çıkış yetkisi yanlış"
  );

  assertEqual(
    outgoing.movementType,
    "FAST_OUT",
    "FAST çıkış hareket tipi yanlış"
  );

  assertEqual(
    outgoing.bankMovement.direction,
    "OUT",
    "FAST çıkış yönü yanlış"
  );

  assertEqual(
    outgoing.journalPosting.lines[0]?.creditAmount,
    750,
    "Çıkış işleminde banka alacaklandırılmalı"
  );

  assertEqual(
    outgoing.journalPosting.lines[1]?.debitAmount,
    750,
    "Çıkış işleminde karşı hesap borçlandırılmalı"
  );

  const outgoingDebit =
    outgoing.journalPosting.lines.reduce(
      (total, line) =>
        total + line.debitAmount,
      0
    );

  const outgoingCredit =
    outgoing.journalPosting.lines.reduce(
      (total, line) =>
        total + line.creditAmount,
      0
    );

  assertEqual(
    outgoingDebit,
    outgoingCredit,
    "FAST çıkış fişi dengeli değil"
  );

  assertThrows(
    () =>
      createManualBankOperationPlan(
        command({
          grantedPermissions: []
        })
      ),
    "MANUAL_BANK_OPERATION_PERMISSION_DENIED:BANK_EFT_IN",
    "Yetkisiz EFT girişi reddedilmedi"
  );

  assertThrows(
    () =>
      createManualBankOperationPlan(
        command({
          amount: 0
        })
      ),
    "MANUAL_BANK_OPERATION_AMOUNT_INVALID",
    "Sıfır tutar reddedilmedi"
  );

  assertThrows(
    () =>
      createManualBankOperationPlan(
        command({
          amount: -1
        })
      ),
    "MANUAL_BANK_OPERATION_AMOUNT_INVALID",
    "Negatif tutar reddedilmedi"
  );

  assertThrows(
    () =>
      createManualBankOperationPlan(
        command({
          transactionDate: "2026-02-30"
        })
      ),
    "MANUAL_BANK_OPERATION_DATE_INVALID",
    "Geçersiz tarih reddedilmedi"
  );

  assertThrows(
    () =>
      createManualBankOperationPlan(
        command({
          counterpartyLedgerAccountId:
            "ledger-bank-1"
        })
      ),
    "MANUAL_BANK_OPERATION_LEDGER_ACCOUNTS_MUST_DIFFER",
    "Aynı muhasebe hesabı reddedilmedi"
  );

  assertThrows(
    () =>
      createManualBankOperationPlan(
        command({
          idempotencyKey: " "
        })
      ),
    "MANUAL_BANK_OPERATION_IDEMPOTENCY_REQUIRED",
    "Boş idempotency anahtarı reddedilmedi"
  );

  console.log(
    "MANUAL_BANK_OPERATION_SERVICE_TEST: PAK"
  );
}

runSuite();
