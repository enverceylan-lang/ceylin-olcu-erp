import type {
  BankMovementDirection,
  BankMovementType
} from "@/lib/finance/bankingContracts";
import type {
  ManualBankOperationChannel,
  ManualBankOperationCommand,
  ManualBankOperationPermission,
  ManualBankOperationPlan
} from "@/lib/finance/manualBankOperationContracts";

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

function assertPositiveAmount(value: number): void {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(
      "MANUAL_BANK_OPERATION_AMOUNT_INVALID"
    );
  }
}

function assertIsoDate(value: string): void {
  const parsed =
    new Date(`${value}T00:00:00.000Z`);

  if (
    value.length !== 10 ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(
      "MANUAL_BANK_OPERATION_DATE_INVALID"
    );
  }
}

function movementTypeFor(
  channel: ManualBankOperationChannel,
  direction: BankMovementDirection
): BankMovementType {
  if (
    channel === "EFT" &&
    direction === "IN"
  ) {
    return "EFT_IN";
  }

  if (
    channel === "EFT" &&
    direction === "OUT"
  ) {
    return "EFT_OUT";
  }

  if (
    channel === "HAVALE" &&
    direction === "IN"
  ) {
    return "HAVALE_IN";
  }

  if (
    channel === "HAVALE" &&
    direction === "OUT"
  ) {
    return "HAVALE_OUT";
  }

  if (
    channel === "FAST" &&
    direction === "IN"
  ) {
    return "FAST_IN";
  }

  if (
    channel === "FAST" &&
    direction === "OUT"
  ) {
    return "FAST_OUT";
  }

  throw new Error(
    "MANUAL_BANK_OPERATION_CHANNEL_DIRECTION_INVALID"
  );
}

function permissionFor(
  channel: ManualBankOperationChannel,
  direction: BankMovementDirection
): ManualBankOperationPermission {
  if (
    channel === "EFT" &&
    direction === "IN"
  ) {
    return "BANK_EFT_IN";
  }

  if (
    channel === "EFT" &&
    direction === "OUT"
  ) {
    return "BANK_EFT_OUT";
  }

  if (
    channel === "HAVALE" &&
    direction === "IN"
  ) {
    return "BANK_HAVALE_IN";
  }

  if (
    channel === "HAVALE" &&
    direction === "OUT"
  ) {
    return "BANK_HAVALE_OUT";
  }

  if (
    channel === "FAST" &&
    direction === "IN"
  ) {
    return "BANK_FAST_IN";
  }

  if (
    channel === "FAST" &&
    direction === "OUT"
  ) {
    return "BANK_FAST_OUT";
  }

  throw new Error(
    "MANUAL_BANK_OPERATION_PERMISSION_INVALID"
  );
}

export function createManualBankOperationPlan(
  command: ManualBankOperationCommand
): ManualBankOperationPlan {
  assertRequiredText(
    command.tenantId,
    "MANUAL_BANK_OPERATION_TENANT_REQUIRED"
  );

  assertRequiredText(
    command.companyId,
    "MANUAL_BANK_OPERATION_COMPANY_REQUIRED"
  );

  assertRequiredText(
    command.branchId,
    "MANUAL_BANK_OPERATION_BRANCH_REQUIRED"
  );

  assertRequiredText(
    command.accountingPeriodId,
    "MANUAL_BANK_OPERATION_PERIOD_REQUIRED"
  );

  assertRequiredText(
    command.transactionId,
    "MANUAL_BANK_OPERATION_TRANSACTION_REQUIRED"
  );

  assertRequiredText(
    command.idempotencyKey,
    "MANUAL_BANK_OPERATION_IDEMPOTENCY_REQUIRED"
  );

  assertRequiredText(
    command.bankAccountId,
    "MANUAL_BANK_OPERATION_BANK_ACCOUNT_REQUIRED"
  );

  assertRequiredText(
    command.bankLedgerAccountId,
    "MANUAL_BANK_OPERATION_BANK_LEDGER_REQUIRED"
  );

  assertRequiredText(
    command.counterpartyLedgerAccountId,
    "MANUAL_BANK_OPERATION_COUNTERPARTY_LEDGER_REQUIRED"
  );

  if (
    command.bankLedgerAccountId ===
    command.counterpartyLedgerAccountId
  ) {
    throw new Error(
      "MANUAL_BANK_OPERATION_LEDGER_ACCOUNTS_MUST_DIFFER"
    );
  }

  assertRequiredText(
    command.currency,
    "MANUAL_BANK_OPERATION_CURRENCY_REQUIRED"
  );

  assertPositiveAmount(command.amount);
  assertIsoDate(command.transactionDate);

  const amount =
    roundMoney(command.amount);

  const requiredPermission =
    permissionFor(
      command.channel,
      command.direction
    );

  if (
    !command.grantedPermissions.includes(
      requiredPermission
    )
  ) {
    throw new Error(
      `MANUAL_BANK_OPERATION_PERMISSION_DENIED:${requiredPermission}`
    );
  }

  const movementType =
    movementTypeFor(
      command.channel,
      command.direction
    );

  const scope = {
    tenantId: command.tenantId,
    companyId: command.companyId,
    branchId: command.branchId,
    accountingPeriodId:
      command.accountingPeriodId
  };

  const description =
    command.description ??
    `${command.channel} ${command.direction}`;

  const bankDebitAmount =
    command.direction === "IN"
      ? amount
      : 0;

  const bankCreditAmount =
    command.direction === "OUT"
      ? amount
      : 0;

  const counterpartyDebitAmount =
    command.direction === "OUT"
      ? amount
      : 0;

  const counterpartyCreditAmount =
    command.direction === "IN"
      ? amount
      : 0;

  return {
    requiredPermission,
    movementType,

    bankMovement: {
      ...scope,

      id: command.movementId,
      movementNumber:
        command.movementNumber,

      bankAccountId:
        command.bankAccountId,

      movementType,
      direction:
        command.direction,

      sourceModule: "MANUAL",
      sourceDocumentType:
        "MANUAL_BANK_OPERATION",

      sourceDocumentId:
        command.sourceDocumentId,

      sourceDocumentNumber:
        command.sourceDocumentNumber,

      customerId:
        command.customerId ?? null,

      supplierId:
        command.supplierId ?? null,

      tailorId: null,
      installerId: null,

      grossAmount: amount,
      feeAmount: 0,
      netAmount: amount,

      currency:
        command.currency,

      transactionDate:
        command.transactionDate,

      valueDate:
        command.valueDate ??
        command.transactionDate,

      settlementDate:
        command.transactionDate,

      status: "SETTLED",
      description,

      externalReference:
        command.externalReference ?? null,

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
          "MANUAL",

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
            command.bankLedgerAccountId,

          customerId:
            command.customerId ?? null,

          supplierId:
            command.supplierId ?? null,

          chequeNoteId: null,

          description:
            `${description} banka hesabı`,

          debitAmount:
            bankDebitAmount,

          creditAmount:
            bankCreditAmount,

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
            counterpartyDebitAmount,

          creditAmount:
            counterpartyCreditAmount,

          currency:
            command.currency
        }
      ]
    }
  };
}
