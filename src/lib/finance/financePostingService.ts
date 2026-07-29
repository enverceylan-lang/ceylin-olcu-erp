import type { ErpScope } from "@/lib/erpScope";
import type {
  FinancePaymentMethod
} from "@/lib/finance/financeContracts";
import type {
  FinanceJournalPosting
} from "@/lib/finance/financeJournalContracts";
import {
  postLocalFinanceJournal
} from "@/lib/finance/localFinanceJournalDb";

export type CollectionPostingChannel =
  | "CASH"
  | "POS"
  | "BANK";

export interface CollectionPostingAccountIds {
  customerReceivableAccountId: string;
  cashAccountId?: string;
  posAccountId?: string;
  bankAccountId?: string;
}

export interface CreateCollectionPostingCommand
  extends ErpScope {
  journalEntryId: string;
  journalNo: string;
  transactionId: string;
  idempotencyKey: string;
  paymentId: string;
  saleId: string;
  customerId: string;
  amount: number;
  currency: string;
  channel: CollectionPostingChannel;
  paymentMethod: FinancePaymentMethod;
  accounts: CollectionPostingAccountIds;
  description: string | null;
  createdBy: string;
  occurredAt: string;
}

function requiredAccountId(
  command: CreateCollectionPostingCommand
): string {
  if (command.channel === "CASH") {
    return command.accounts.cashAccountId?.trim() || "";
  }

  if (command.channel === "POS") {
    return command.accounts.posAccountId?.trim() || "";
  }

  return command.accounts.bankAccountId?.trim() || "";
}

function expectedPaymentMethods(
  channel: CollectionPostingChannel
): FinancePaymentMethod[] {
  if (channel === "CASH") {
    return ["CASH"];
  }

  if (channel === "POS") {
    return ["CREDIT_CARD"];
  }

  return ["EFT", "BANK_TRANSFER"];
}

function channelAccountDescription(
  channel: CollectionPostingChannel
): string {
  if (channel === "CASH") {
    return "Kasa tahsilatı";
  }

  if (channel === "POS") {
    return "POS tahsilatı";
  }

  return "Banka tahsilatı";
}

function assertValidCommand(
  command: CreateCollectionPostingCommand
): void {
  const requiredText = [
    command.tenantId,
    command.companyId,
    command.branchId,
    command.accountingPeriodId,
    command.journalEntryId,
    command.journalNo,
    command.transactionId,
    command.idempotencyKey,
    command.paymentId,
    command.saleId,
    command.customerId,
    command.currency,
    command.accounts.customerReceivableAccountId,
    command.createdBy,
    command.occurredAt
  ];

  if (requiredText.some(value => value.trim().length === 0)) {
    throw new Error(
      "FINANCE_COLLECTION_POSTING_REQUIRED_FIELD_MISSING"
    );
  }

  if (
    !Number.isFinite(command.amount) ||
    command.amount <= 0
  ) {
    throw new Error(
      "FINANCE_COLLECTION_POSTING_AMOUNT_INVALID"
    );
  }

  if (!requiredAccountId(command)) {
    throw new Error(
      "FINANCE_COLLECTION_POSTING_CHANNEL_ACCOUNT_REQUIRED"
    );
  }

  if (
    !expectedPaymentMethods(command.channel).includes(
      command.paymentMethod
    )
  ) {
    throw new Error(
      "FINANCE_COLLECTION_POSTING_PAYMENT_METHOD_MISMATCH"
    );
  }
}

export function createCollectionJournalPosting(
  command: CreateCollectionPostingCommand
): FinanceJournalPosting {
  assertValidCommand(command);

  const channelAccountId =
    requiredAccountId(command);

  const scope = {
    tenantId: command.tenantId,
    companyId: command.companyId,
    branchId: command.branchId,
    accountingPeriodId:
      command.accountingPeriodId
  };

  return {
    entry: {
      ...scope,
      id: command.journalEntryId,
      journalNo: command.journalNo,
      transactionId: command.transactionId,
      idempotencyKey: command.idempotencyKey,
      sourceDocumentType: "SALE_PAYMENT",
      sourceDocumentId: command.paymentId,
      description:
        command.description ||
        channelAccountDescription(command.channel),
      currency: command.currency,
      status: "POSTED",
      reversalOfJournalEntryId: null,
      createdBy: command.createdBy,
      createdAt: command.occurredAt,
      postedAt: command.occurredAt,
      reversedAt: null
    },
    lines: [
      {
        ...scope,
        id: `${command.journalEntryId}:1`,
        journalEntryId: command.journalEntryId,
        lineNo: 1,
        accountId: channelAccountId,
        customerId: null,
        supplierId: null,
        chequeNoteId: null,
        description:
          `${channelAccountDescription(command.channel)} — borç`,
        debitAmount: command.amount,
        creditAmount: 0,
        currency: command.currency
      },
      {
        ...scope,
        id: `${command.journalEntryId}:2`,
        journalEntryId: command.journalEntryId,
        lineNo: 2,
        accountId:
          command.accounts.customerReceivableAccountId,
        customerId: command.customerId,
        supplierId: null,
        chequeNoteId: null,
        description:
          `Satış ${command.saleId} müşteri alacağı — alacak`,
        debitAmount: 0,
        creditAmount: command.amount,
        currency: command.currency
      }
    ]
  };
}

export async function postCollectionJournal(
  command: CreateCollectionPostingCommand
) {
  const posting =
    createCollectionJournalPosting(command);

  return postLocalFinanceJournal(posting);
}
