import type {
  CashOperationCommand,
  CashOperationPermission,
  CashOperationPlan
} from "@/lib/finance/cashFinanceContracts";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertRequiredText(
  value: string,
  errorCode: string
): void {
  if (value.trim().length === 0) {
    throw new Error(errorCode);
  }
}

function assertIsoDate(
  value: string,
  errorCode: string
): void {
  const parsed =
    new Date(`${value}T00:00:00.000Z`);

  if (
    value.length !== 10 ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(errorCode);
  }
}

function requiredPermissionFor(
  command: CashOperationCommand
): CashOperationPermission {
  if (command.direction === "IN") {
    return "CASH_IN";
  }

  return "CASH_OUT";
}

export function createCashOperationPlan(
  command: CashOperationCommand
): CashOperationPlan {
  assertRequiredText(
    command.tenantId,
    "CASH_OPERATION_TENANT_REQUIRED"
  );

  assertRequiredText(
    command.companyId,
    "CASH_OPERATION_COMPANY_REQUIRED"
  );

  assertRequiredText(
    command.branchId,
    "CASH_OPERATION_BRANCH_REQUIRED"
  );

  assertRequiredText(
    command.accountingPeriodId,
    "CASH_OPERATION_PERIOD_REQUIRED"
  );

  assertRequiredText(
    command.transactionId,
    "CASH_OPERATION_TRANSACTION_REQUIRED"
  );

  assertRequiredText(
    command.idempotencyKey,
    "CASH_OPERATION_IDEMPOTENCY_REQUIRED"
  );

  assertRequiredText(
    command.cashAccountId,
    "CASH_OPERATION_ACCOUNT_REQUIRED"
  );

  assertRequiredText(
    command.cashLedgerAccountId,
    "CASH_OPERATION_LEDGER_REQUIRED"
  );

  assertRequiredText(
    command.counterpartyLedgerAccountId,
    "CASH_OPERATION_COUNTERPARTY_LEDGER_REQUIRED"
  );

  if (
    command.cashLedgerAccountId ===
    command.counterpartyLedgerAccountId
  ) {
    throw new Error(
      "CASH_OPERATION_LEDGER_ACCOUNTS_MUST_DIFFER"
    );
  }

  if (
    !Number.isFinite(command.amount) ||
    command.amount <= 0
  ) {
    throw new Error(
      "CASH_OPERATION_AMOUNT_INVALID"
    );
  }

  assertRequiredText(
    command.currency,
    "CASH_OPERATION_CURRENCY_REQUIRED"
  );

  assertIsoDate(
    command.transactionDate,
    "CASH_OPERATION_DATE_INVALID"
  );

  assertRequiredText(
    command.sourceDocumentId,
    "CASH_OPERATION_SOURCE_DOCUMENT_REQUIRED"
  );

  const requiredPermission =
    requiredPermissionFor(command);

  if (
    !command.grantedPermissions.includes(
      requiredPermission
    )
  ) {
    throw new Error(
      `CASH_OPERATION_PERMISSION_DENIED:${requiredPermission}`
    );
  }

  if (
    command.sourceDocumentType ===
      "CUSTOMER_COLLECTION" &&
    !command.customerId
  ) {
    throw new Error(
      "CASH_OPERATION_CUSTOMER_REQUIRED"
    );
  }

  if (
    command.sourceDocumentType ===
      "SUPPLIER_PAYMENT" &&
    !command.supplierId
  ) {
    throw new Error(
      "CASH_OPERATION_SUPPLIER_REQUIRED"
    );
  }

  const amount =
    roundMoney(command.amount);

  const scope = {
    tenantId: command.tenantId,
    companyId: command.companyId,
    branchId: command.branchId,
    accountingPeriodId:
      command.accountingPeriodId
  };

  const description =
    command.description ??
    (
      command.direction === "IN"
        ? "Nakit tahsilat"
        : "Nakit ödeme"
    );

  const cashDebit =
    command.direction === "IN"
      ? amount
      : 0;

  const cashCredit =
    command.direction === "OUT"
      ? amount
      : 0;

  const counterpartyDebit =
    command.direction === "OUT"
      ? amount
      : 0;

  const counterpartyCredit =
    command.direction === "IN"
      ? amount
      : 0;

  return {
    requiredPermission,

    cashMovement: {
      ...scope,

      id: command.movementId,
      movementNumber:
        command.movementNumber,

      cashAccountId:
        command.cashAccountId,

      direction:
        command.direction,

      transactionId:
        command.transactionId,

      idempotencyKey:
        command.idempotencyKey,

      sourceDocumentType:
        command.sourceDocumentType,

      sourceDocumentId:
        command.sourceDocumentId,

      sourceDocumentNumber:
        command.sourceDocumentNumber,

      customerId:
        command.customerId ?? null,

      supplierId:
        command.supplierId ?? null,

      saleId:
        command.saleId ?? null,

      installmentId:
        command.installmentId ?? null,

      amount,
      currency:
        command.currency,

      transactionDate:
        command.transactionDate,

      status: "POSTED",
      description,

      createdBy:
        command.createdBy,

      createdAt:
        command.createdAt,

      reversedAt: null,
      reversalOfMovementId: null
    },

    journalPosting: {
      entry: {
        ...scope,

        id:
          command.journalEntryId,

        journalNo:
          command.journalNumber,

        transactionId:
          command.transactionId,

        idempotencyKey:
          command.idempotencyKey,

        sourceDocumentType:
          command.sourceDocumentType ===
          "SUPPLIER_PAYMENT"
            ? "EXPENSE"
            : "SALE_PAYMENT",

        sourceDocumentId:
          command.sourceDocumentId,

        description,
        currency:
          command.currency,

        status: "POSTED",

        reversalOfJournalEntryId:
          null,

        createdBy:
          command.createdBy,

        createdAt:
          command.createdAt,

        postedAt:
          command.createdAt,

        reversedAt: null
      },

      lines: [
        {
          ...scope,

          id:
            command.firstJournalLineId,

          journalEntryId:
            command.journalEntryId,

          lineNo: 1,

          accountId:
            command.cashLedgerAccountId,

          customerId:
            command.customerId ?? null,

          supplierId:
            command.supplierId ?? null,

          chequeNoteId: null,

          description:
            `${description} kasa hesabı`,

          debitAmount:
            cashDebit,

          creditAmount:
            cashCredit,

          currency:
            command.currency
        },
        {
          ...scope,

          id:
            command.secondJournalLineId,

          journalEntryId:
            command.journalEntryId,

          lineNo: 2,

          accountId:
            command.counterpartyLedgerAccountId,

          customerId:
            command.customerId ?? null,

          supplierId:
            command.supplierId ?? null,

          chequeNoteId: null,

          description:
            `${description} karşı hesap`,

          debitAmount:
            counterpartyDebit,

          creditAmount:
            counterpartyCredit,

          currency:
            command.currency
        }
      ]
    }
  };
}
