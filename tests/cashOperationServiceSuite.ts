import type {
  CashOperationCommand
} from "@/lib/finance/cashFinanceContracts";
import {
  createCashOperationPlan
} from "@/lib/finance/cashOperationService";

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

function assertThrows(
  action: () => unknown,
  expectedMessage: string,
  message: string
): void {
  let actualMessage = "";

  try {
    action();
  } catch (error) {
    actualMessage =
      error instanceof Error
        ? error.message
        : String(error);
  }

  assertEqual(
    actualMessage,
    expectedMessage,
    message
  );
}

function command(
  overrides: Partial<CashOperationCommand> = {}
): CashOperationCommand {
  const base: CashOperationCommand = {
    tenantId: "tenant-1",
    companyId: "company-1",
    branchId: "branch-1",
    accountingPeriodId: "period-2026",

    transactionId: "cash-transaction-1",
    idempotencyKey: "cash-operation-1",

    direction: "IN",

    cashAccountId: "cash-account-1",
    cashLedgerAccountId: "ledger-cash-1",
    counterpartyLedgerAccountId: "ledger-customer-1",

    amount: 1500.5,
    currency: "TRY",
    transactionDate: "2026-07-28",

    movementId: "cash-movement-1",
    movementNumber: "KSA-HRK-0001",

    journalEntryId: "cash-journal-1",
    journalNumber: "FIS-KSA-0001",

    firstJournalLineId: "cash-line-1",
    secondJournalLineId: "cash-line-2",

    sourceDocumentType: "CUSTOMER_COLLECTION",
    sourceDocumentId: "collection-1",
    sourceDocumentNumber: "TAH-0001",

    customerId: "customer-1",
    supplierId: null,
    saleId: "sale-1",
    installmentId: "installment-1",

    description: "Müşteri nakit tahsilatı",

    grantedPermissions: [
      "CASH_IN"
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
  const collection =
    createCashOperationPlan(
      command()
    );

  assertEqual(
    collection.requiredPermission,
    "CASH_IN",
    "Tahsilat yetkisi yanlış"
  );

  assertEqual(
    collection.cashMovement.direction,
    "IN",
    "Tahsilat yönü yanlış"
  );

  assertEqual(
    collection.cashMovement.amount,
    1500.5,
    "Tahsilat tutarı yanlış"
  );

  assertEqual(
    collection.cashMovement.customerId,
    "customer-1",
    "Tahsilat cari bağlantısı yanlış"
  );

  assertEqual(
    collection.cashMovement.saleId,
    "sale-1",
    "Tahsilat satış bağlantısı yanlış"
  );

  assertEqual(
    collection.cashMovement.installmentId,
    "installment-1",
    "Tahsilat taksit bağlantısı yanlış"
  );

  assertEqual(
    collection.journalPosting.entry.sourceDocumentType,
    "SALE_PAYMENT",
    "Tahsilat fişi belge tipi yanlış"
  );

  assertEqual(
    collection.journalPosting.lines[0]?.debitAmount,
    1500.5,
    "Tahsilatta kasa borçlandırılmalı"
  );

  assertEqual(
    collection.journalPosting.lines[1]?.creditAmount,
    1500.5,
    "Tahsilatta cari karşı hesap alacaklandırılmalı"
  );

  const collectionDebit =
    collection.journalPosting.lines.reduce(
      (total, line) =>
        total + line.debitAmount,
      0
    );

  const collectionCredit =
    collection.journalPosting.lines.reduce(
      (total, line) =>
        total + line.creditAmount,
      0
    );

  assertEqual(
    collectionDebit,
    collectionCredit,
    "Tahsilat fişi dengeli değil"
  );

  const payment =
    createCashOperationPlan(
      command({
        transactionId: "cash-transaction-2",
        idempotencyKey: "cash-operation-2",

        direction: "OUT",
        amount: 800,

        movementId: "cash-movement-2",
        movementNumber: "KSA-HRK-0002",

        journalEntryId: "cash-journal-2",
        journalNumber: "FIS-KSA-0002",

        firstJournalLineId: "cash-line-3",
        secondJournalLineId: "cash-line-4",

        sourceDocumentType: "SUPPLIER_PAYMENT",
        sourceDocumentId: "supplier-payment-1",
        sourceDocumentNumber: "ODE-0001",

        customerId: null,
        supplierId: "supplier-1",
        saleId: null,
        installmentId: null,

        description: "Tedarikçiye nakit ödeme",

        grantedPermissions: [
          "CASH_OUT"
        ]
      })
    );

  assertEqual(
    payment.requiredPermission,
    "CASH_OUT",
    "Ödeme yetkisi yanlış"
  );

  assertEqual(
    payment.cashMovement.direction,
    "OUT",
    "Ödeme yönü yanlış"
  );

  assertEqual(
    payment.journalPosting.entry.sourceDocumentType,
    "EXPENSE",
    "Tedarikçi ödeme fişi belge tipi yanlış"
  );

  assertEqual(
    payment.journalPosting.lines[0]?.creditAmount,
    800,
    "Ödemede kasa alacaklandırılmalı"
  );

  assertEqual(
    payment.journalPosting.lines[1]?.debitAmount,
    800,
    "Ödemede karşı hesap borçlandırılmalı"
  );

  const paymentDebit =
    payment.journalPosting.lines.reduce(
      (total, line) =>
        total + line.debitAmount,
      0
    );

  const paymentCredit =
    payment.journalPosting.lines.reduce(
      (total, line) =>
        total + line.creditAmount,
      0
    );

  assertEqual(
    paymentDebit,
    paymentCredit,
    "Ödeme fişi dengeli değil"
  );

  assertThrows(
    () =>
      createCashOperationPlan(
        command({
          grantedPermissions: []
        })
      ),
    "CASH_OPERATION_PERMISSION_DENIED:CASH_IN",
    "Yetkisiz tahsilat reddedilmedi"
  );

  assertThrows(
    () =>
      createCashOperationPlan(
        command({
          amount: 0
        })
      ),
    "CASH_OPERATION_AMOUNT_INVALID",
    "Sıfır tutar reddedilmedi"
  );

  assertThrows(
    () =>
      createCashOperationPlan(
        command({
          transactionDate: "2026-02-30"
        })
      ),
    "CASH_OPERATION_DATE_INVALID",
    "Geçersiz tarih reddedilmedi"
  );

  assertThrows(
    () =>
      createCashOperationPlan(
        command({
          cashLedgerAccountId:
            "ledger-customer-1"
        })
      ),
    "CASH_OPERATION_LEDGER_ACCOUNTS_MUST_DIFFER",
    "Aynı muhasebe hesabı reddedilmedi"
  );

  assertThrows(
    () =>
      createCashOperationPlan(
        command({
          customerId: null
        })
      ),
    "CASH_OPERATION_CUSTOMER_REQUIRED",
    "Carisiz müşteri tahsilatı reddedilmedi"
  );

  assertThrows(
    () =>
      createCashOperationPlan(
        command({
          direction: "OUT",
          sourceDocumentType: "SUPPLIER_PAYMENT",
          customerId: null,
          supplierId: null,
          grantedPermissions: [
            "CASH_OUT"
          ]
        })
      ),
    "CASH_OPERATION_SUPPLIER_REQUIRED",
    "Tedarikçisiz ödeme reddedilmedi"
  );

  console.log(
    "CASH_OPERATION_SERVICE_TEST: PAK"
  );
}

runSuite();
