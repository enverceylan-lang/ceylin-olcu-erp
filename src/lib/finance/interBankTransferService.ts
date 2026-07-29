import type {
  InterBankTransferCommand,
  InterBankTransferPlan
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

function assertIsoDate(value: string): void {
  const parsed =
    new Date(`${value}T00:00:00.000Z`);

  if (
    value.length !== 10 ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(
      "INTER_BANK_TRANSFER_DATE_INVALID"
    );
  }
}

export function createInterBankTransferPlan(
  command: InterBankTransferCommand
): InterBankTransferPlan {
  assertRequiredText(
    command.tenantId,
    "INTER_BANK_TRANSFER_TENANT_REQUIRED"
  );

  assertRequiredText(
    command.companyId,
    "INTER_BANK_TRANSFER_COMPANY_REQUIRED"
  );

  assertRequiredText(
    command.branchId,
    "INTER_BANK_TRANSFER_BRANCH_REQUIRED"
  );

  assertRequiredText(
    command.accountingPeriodId,
    "INTER_BANK_TRANSFER_PERIOD_REQUIRED"
  );

  assertRequiredText(
    command.transactionId,
    "INTER_BANK_TRANSFER_TRANSACTION_REQUIRED"
  );

  assertRequiredText(
    command.idempotencyKey,
    "INTER_BANK_TRANSFER_IDEMPOTENCY_REQUIRED"
  );

  assertRequiredText(
    command.sourceBankAccountId,
    "INTER_BANK_TRANSFER_SOURCE_BANK_REQUIRED"
  );

  assertRequiredText(
    command.destinationBankAccountId,
    "INTER_BANK_TRANSFER_DESTINATION_BANK_REQUIRED"
  );

  if (
    command.sourceBankAccountId ===
    command.destinationBankAccountId
  ) {
    throw new Error(
      "INTER_BANK_TRANSFER_BANK_ACCOUNTS_MUST_DIFFER"
    );
  }

  if (
    command.sourceBankLedgerAccountId ===
    command.destinationBankLedgerAccountId
  ) {
    throw new Error(
      "INTER_BANK_TRANSFER_LEDGER_ACCOUNTS_MUST_DIFFER"
    );
  }

  if (
    !Number.isFinite(command.amount) ||
    command.amount <= 0
  ) {
    throw new Error(
      "INTER_BANK_TRANSFER_AMOUNT_INVALID"
    );
  }

  assertRequiredText(
    command.currency,
    "INTER_BANK_TRANSFER_CURRENCY_REQUIRED"
  );

  assertIsoDate(command.transactionDate);

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
    "Bankalar arası virman";

  const commonMovement = {
    ...scope,

    sourceModule: "FINANCE" as const,
    sourceDocumentType:
      "INTER_BANK_TRANSFER",

    sourceDocumentId:
      command.sourceDocumentId,

    sourceDocumentNumber:
      command.sourceDocumentNumber,

    customerId: null,
    supplierId: null,
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

    status: "SETTLED" as const,
    description,
    externalReference:
      command.transactionId,

    createdBy:
      command.createdBy,

    createdAt:
      command.createdAt,

    reversedAt: null,
    reversalOfMovementId: null
  };

  return {
    sourceMovement: {
      ...commonMovement,

      id:
        command.sourceMovementId,

      movementNumber:
        command.sourceMovementNumber,

      bankAccountId:
        command.sourceBankAccountId,

      movementType:
        "INTERNAL_TRANSFER_OUT",

      direction: "OUT"
    },

    destinationMovement: {
      ...commonMovement,

      id:
        command.destinationMovementId,

      movementNumber:
        command.destinationMovementNumber,

      bankAccountId:
        command.destinationBankAccountId,

      movementType:
        "INTERNAL_TRANSFER_IN",

      direction: "IN"
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
            command.debitJournalLineId,

          journalEntryId:
            command.journalEntryId,

          lineNo: 1,

          accountId:
            command.destinationBankLedgerAccountId,

          customerId: null,
          supplierId: null,
          chequeNoteId: null,

          description:
            `${description} hedef banka`,

          debitAmount: amount,
          creditAmount: 0,

          currency:
            command.currency
        },
        {
          ...scope,

          id:
            command.creditJournalLineId,

          journalEntryId:
            command.journalEntryId,

          lineNo: 2,

          accountId:
            command.sourceBankLedgerAccountId,

          customerId: null,
          supplierId: null,
          chequeNoteId: null,

          description:
            `${description} kaynak banka`,

          debitAmount: 0,
          creditAmount: amount,

          currency:
            command.currency
        }
      ]
    }
  };
}
