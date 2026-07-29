import type {
  CashOperationCommand,
  CashOperationPermission
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

function command(
  direction: CashOperationCommand["direction"],
  permissions: readonly CashOperationPermission[]
): CashOperationCommand {
  const isIncoming =
    direction === "IN";

  return {
    tenantId: "tenant-a",
    companyId: "company-a",
    branchId: "branch-a",
    accountingPeriodId: "period-a",

    transactionId:
      isIncoming
        ? "cash-in-transaction"
        : "cash-out-transaction",

    idempotencyKey:
      isIncoming
        ? "cash-in-key"
        : "cash-out-key",

    direction,

    cashAccountId: "cash-account-a",
    cashLedgerAccountId: "ledger-cash-a",
    counterpartyLedgerAccountId:
      isIncoming
        ? "ledger-customer-a"
        : "ledger-supplier-a",

    amount: 100,
    currency: "TRY",
    transactionDate: "2026-07-28",

    movementId:
      isIncoming
        ? "cash-in-movement"
        : "cash-out-movement",

    movementNumber:
      isIncoming
        ? "KSA-IN-0001"
        : "KSA-OUT-0001",

    journalEntryId:
      isIncoming
        ? "cash-in-journal"
        : "cash-out-journal",

    journalNumber:
      isIncoming
        ? "FIS-IN-0001"
        : "FIS-OUT-0001",

    firstJournalLineId:
      isIncoming
        ? "cash-in-line-1"
        : "cash-out-line-1",

    secondJournalLineId:
      isIncoming
        ? "cash-in-line-2"
        : "cash-out-line-2",

    sourceDocumentType:
      isIncoming
        ? "CUSTOMER_COLLECTION"
        : "SUPPLIER_PAYMENT",

    sourceDocumentId:
      isIncoming
        ? "collection-a"
        : "payment-a",

    sourceDocumentNumber:
      isIncoming
        ? "TAH-0001"
        : "ODE-0001",

    customerId:
      isIncoming
        ? "customer-a"
        : null,

    supplierId:
      isIncoming
        ? null
        : "supplier-a",

    saleId:
      isIncoming
        ? "sale-a"
        : null,

    installmentId:
      isIncoming
        ? "installment-a"
        : null,

    grantedPermissions:
      permissions,

    createdBy: "admin-a",
    createdAt:
      "2026-07-28T10:00:00.000Z"
  };
}

function deniedMessage(
  action: () => unknown
): string {
  try {
    action();
  } catch (error) {
    return error instanceof Error
      ? error.message
      : String(error);
  }

  return "";
}

function runSuite(): void {
  const incoming =
    createCashOperationPlan(
      command(
        "IN",
        ["CASH_IN"]
      )
    );

  assertEqual(
    incoming.requiredPermission,
    "CASH_IN",
    "Nakit giriş yetkisi yanlış"
  );

  assertEqual(
    incoming.cashMovement.tenantId,
    "tenant-a",
    "Tenant kapsamı korunmadı"
  );

  assertEqual(
    incoming.cashMovement.companyId,
    "company-a",
    "Şirket kapsamı korunmadı"
  );

  assertEqual(
    incoming.cashMovement.branchId,
    "branch-a",
    "Şube kapsamı korunmadı"
  );

  assertEqual(
    incoming.cashMovement.accountingPeriodId,
    "period-a",
    "Dönem kapsamı korunmadı"
  );

  const outgoing =
    createCashOperationPlan(
      command(
        "OUT",
        ["CASH_OUT"]
      )
    );

  assertEqual(
    outgoing.requiredPermission,
    "CASH_OUT",
    "Nakit çıkış yetkisi yanlış"
  );

  assertEqual(
    deniedMessage(
      () =>
        createCashOperationPlan(
          command(
            "IN",
            ["CASH_OUT"]
          )
        )
    ),
    "CASH_OPERATION_PERMISSION_DENIED:CASH_IN",
    "Çıkış yetkisiyle giriş yapılabildi"
  );

  assertEqual(
    deniedMessage(
      () =>
        createCashOperationPlan(
          command(
            "OUT",
            ["CASH_IN"]
          )
        )
    ),
    "CASH_OPERATION_PERMISSION_DENIED:CASH_OUT",
    "Giriş yetkisiyle çıkış yapılabildi"
  );

  assertEqual(
    incoming.cashMovement.currency,
    incoming.journalPosting.entry.currency,
    "Hareket ve fiş para birimi farklı"
  );

  assertEqual(
    incoming.cashMovement.sourceDocumentId,
    incoming.journalPosting.entry.sourceDocumentId,
    "Hareket ve fiş kaynak belgesi farklı"
  );

  assertEqual(
    incoming.cashMovement.transactionId,
    incoming.journalPosting.entry.transactionId,
    "Hareket ve fiş transaction kimliği farklı"
  );

  assertEqual(
    incoming.cashMovement.idempotencyKey,
    incoming.journalPosting.entry.idempotencyKey,
    "Hareket ve fiş idempotency anahtarı farklı"
  );

  console.log(
    "CASH_FINANCE_PERMISSION_ISOLATION_TEST: PAK"
  );
}

runSuite();
