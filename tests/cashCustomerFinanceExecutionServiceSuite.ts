import "fake-indexeddb/auto";

import type {
  CashOperationCommand,
  CustomerFinanceAllocationCommand,
  CustomerOpenItem
} from "@/lib/finance/cashFinanceContracts";
import {
  executeCashCustomerFinance
} from "@/lib/finance/cashCustomerFinanceExecutionService";
import {
  localFinanceJournalDb
} from "@/lib/finance/localFinanceJournalDb";

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

  assertEqual(
    actualMessage,
    expectedMessage,
    message
  );
}

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-2026"
};

function cashCommand(
  overrides: Partial<CashOperationCommand> = {}
): CashOperationCommand {
  const base: CashOperationCommand = {
    ...scope,

    transactionId: "cash-transaction-1",
    idempotencyKey: "cash-operation-1",

    direction: "IN",

    cashAccountId: "cash-account-1",
    cashLedgerAccountId: "ledger-cash-1",
    counterpartyLedgerAccountId:
      "ledger-customer-1",

    amount: 900,
    currency: "TRY",
    transactionDate: "2026-07-28",

    movementId: "cash-movement-1",
    movementNumber: "KSA-0001",

    journalEntryId: "cash-journal-1",
    journalNumber: "FIS-KSA-0001",

    firstJournalLineId: "cash-line-1",
    secondJournalLineId: "cash-line-2",

    sourceDocumentType:
      "CUSTOMER_COLLECTION",

    sourceDocumentId: "collection-1",
    sourceDocumentNumber: "TAH-0001",

    customerId: "customer-1",
    supplierId: null,

    saleId: "sale-1",
    installmentId: "installment-1",

    grantedPermissions: [
      "CASH_IN"
    ],

    createdBy: "admin",
    createdAt:
      "2026-07-28T10:00:00.000Z"
  };

  return {
    ...base,
    ...overrides
  };
}

function openItem(
  overrides: Partial<CustomerOpenItem> = {}
): CustomerOpenItem {
  const base: CustomerOpenItem = {
    ...scope,

    id: "open-item-1",
    customerId: "customer-1",

    saleId: "sale-1",
    installmentId: "installment-1",

    documentNumber: "SAT-0001",
    dueDate: "2026-07-10",

    currency: "TRY",
    openAmount: 500
  };

  return {
    ...base,
    ...overrides
  };
}

function allocationCommand(
  overrides:
    Partial<CustomerFinanceAllocationCommand> = {}
): CustomerFinanceAllocationCommand {
  const base: CustomerFinanceAllocationCommand = {
    ...scope,

    customerId: "customer-1",
    currency: "TRY",
    amount: 900,

    openItems: [
      openItem(),
      openItem({
        id: "open-item-2",
        saleId: "sale-2",
        installmentId: "installment-2",
        documentNumber: "SAT-0002",
        dueDate: "2026-07-20",
        openAmount: 600
      })
    ]
  };

  return {
    ...base,
    ...overrides
  };
}

async function runSuite(): Promise<void> {
  await localFinanceJournalDb.delete();
  await localFinanceJournalDb.open();

  const created =
    await executeCashCustomerFinance({
      cashOperation:
        cashCommand(),

      customerAllocation:
        allocationCommand()
    });

  assertEqual(
    created.status,
    "CREATED",
    "Kasa-cari işlemi oluşturulmadı"
  );

  assertEqual(
    created.allocationRecordIds.length,
    2,
    "Cari dağıtım kayıt sayısı yanlış"
  );

  assertEqual(
    await localFinanceJournalDb
      .cashMovements
      .count(),
    1,
    "Kasa hareketi sayısı yanlış"
  );

  assertEqual(
    await localFinanceJournalDb
      .entries
      .count(),
    1,
    "Finans fişi sayısı yanlış"
  );

  assertEqual(
    await localFinanceJournalDb
      .lines
      .count(),
    2,
    "Finans fiş satırı sayısı yanlış"
  );

  assertEqual(
    await localFinanceJournalDb
      .cashAllocations
      .count(),
    2,
    "Cari dağıtım satırı sayısı yanlış"
  );

  const replay =
    await executeCashCustomerFinance({
      cashOperation:
        cashCommand(),

      customerAllocation:
        allocationCommand()
    });

  assertEqual(
    replay.status,
    "REPLAY",
    "Aynı işlem replay olarak tanınmadı"
  );

  assertEqual(
    await localFinanceJournalDb
      .cashMovements
      .count(),
    1,
    "Replay mükerrer kasa hareketi oluşturdu"
  );

  await assertRejects(
    () =>
      executeCashCustomerFinance({
        cashOperation:
          cashCommand({
            movementId:
              "cash-movement-conflict",

            journalEntryId:
              "cash-journal-conflict",

            firstJournalLineId:
              "cash-conflict-line-1",

            secondJournalLineId:
              "cash-conflict-line-2"
          }),

        customerAllocation:
          allocationCommand()
      }),
    "CASH_FINANCE_IDEMPOTENCY_CONFLICT",
    "Idempotency çakışması reddedilmedi"
  );

  await assertRejects(
    () =>
      executeCashCustomerFinance({
        cashOperation:
          cashCommand({
            transactionId:
              "excess-transaction",

            idempotencyKey:
              "excess-operation",

            movementId:
              "excess-movement",

            journalEntryId:
              "excess-journal",

            firstJournalLineId:
              "excess-line-1",

            secondJournalLineId:
              "excess-line-2",

            sourceDocumentId:
              "excess-source",

            amount: 1500
          }),

        customerAllocation:
          allocationCommand({
            amount: 1500
          })
      }),
    "CASH_FINANCE_UNAPPLIED_AMOUNT_NOT_ALLOWED",
    "Borcu aşan tahsilat reddedilmedi"
  );

  const cashCountBeforeRollback =
    await localFinanceJournalDb
      .cashMovements
      .count();

  const entryCountBeforeRollback =
    await localFinanceJournalDb
      .entries
      .count();

  const lineCountBeforeRollback =
    await localFinanceJournalDb
      .lines
      .count();

  const allocationCountBeforeRollback =
    await localFinanceJournalDb
      .cashAllocations
      .count();

  await localFinanceJournalDb
    .cashAllocations
    .add({
      ...scope,

      id:
        "rollback-movement:allocation:open-item-1",

      cashMovementId:
        "foreign-movement",

      journalEntryId:
        "foreign-journal",

      customerId:
        "customer-1",

      openItemId:
        "foreign-open-item",

      saleId: null,
      installmentId: null,

      documentNumber:
        "FOREIGN-001",

      dueDate:
        "2026-07-01",

      allocatedAmount: 1,
      currency: "TRY",

      createdBy: "admin",
      createdAt:
        "2026-07-28T09:00:00.000Z"
    });

  const allocationCountWithConflict =
    await localFinanceJournalDb
      .cashAllocations
      .count();

  await assertRejects(
    () =>
      executeCashCustomerFinance({
        cashOperation:
          cashCommand({
            transactionId:
              "rollback-transaction",

            idempotencyKey:
              "rollback-operation",

            movementId:
              "rollback-movement",

            movementNumber:
              "KSA-RBK-0001",

            journalEntryId:
              "rollback-journal",

            journalNumber:
              "FIS-RBK-0001",

            firstJournalLineId:
              "rollback-line-1",

            secondJournalLineId:
              "rollback-line-2",

            sourceDocumentId:
              "rollback-source",

            sourceDocumentNumber:
              "RBK-0001"
          }),

        customerAllocation:
          allocationCommand()
      }),
    "CASH_FINANCE_ALLOCATION_RECORD_CONFLICT",
    "Cari dağıtım çakışması reddedilmedi"
  );

  assertEqual(
    await localFinanceJournalDb
      .cashMovements
      .count(),
    cashCountBeforeRollback,
    "Rollback sonrasında kasa hareketi sızdı"
  );

  assertEqual(
    await localFinanceJournalDb
      .entries
      .count(),
    entryCountBeforeRollback,
    "Rollback sonrasında finans fişi sızdı"
  );

  assertEqual(
    await localFinanceJournalDb
      .lines
      .count(),
    lineCountBeforeRollback,
    "Rollback sonrasında fiş satırı sızdı"
  );

  assertEqual(
    await localFinanceJournalDb
      .cashAllocations
      .count(),
    allocationCountWithConflict,
    "Rollback sonrasında dağıtım kaydı sızdı"
  );

  assertEqual(
    allocationCountWithConflict,
    allocationCountBeforeRollback + 1,
    "Rollback çakışma hazırlığı oluşmadı"
  );

  const payment =
    await executeCashCustomerFinance({
      cashOperation:
        cashCommand({
          transactionId:
            "supplier-payment-transaction",

          idempotencyKey:
            "supplier-payment-operation",

          direction: "OUT",

          movementId:
            "supplier-payment-movement",

          movementNumber:
            "KSA-ODE-0001",

          journalEntryId:
            "supplier-payment-journal",

          journalNumber:
            "FIS-ODE-0001",

          firstJournalLineId:
            "supplier-payment-line-1",

          secondJournalLineId:
            "supplier-payment-line-2",

          sourceDocumentType:
            "SUPPLIER_PAYMENT",

          sourceDocumentId:
            "supplier-payment-source",

          sourceDocumentNumber:
            "ODE-0001",

          customerId: null,
          supplierId: "supplier-1",

          saleId: null,
          installmentId: null,

          amount: 300,

          grantedPermissions: [
            "CASH_OUT"
          ]
        }),

      customerAllocation: null
    });

  assertEqual(
    payment.status,
    "CREATED",
    "Tedarikçi nakit ödemesi oluşturulmadı"
  );

  await localFinanceJournalDb.delete();

  console.log(
    "CASH_CUSTOMER_FINANCE_ATOMIC_TEST: PAK"
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
