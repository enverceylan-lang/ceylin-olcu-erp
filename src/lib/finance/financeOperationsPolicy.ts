import type {
  FinanceOperationAction,
  FinanceOperationChannel,
  FinanceOperationCommand,
  FinanceOperationKind
} from "@/lib/finance/financeOperationsContracts";

export interface FinanceOperationPolicyResult {
  ok: boolean;
  reason: string | null;
}

const COLLECTION_CHANNELS = new Set<FinanceOperationChannel>([
  "CASH",
  "BANK",
  "POS",
  "CHEQUE",
  "NOTE"
]);

const PAYMENT_CHANNELS = new Set<FinanceOperationChannel>([
  "CASH",
  "BANK",
  "CHEQUE",
  "NOTE"
]);

function required(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function isFinanceOperationCombinationAllowed(
  kind: FinanceOperationKind,
  channel: FinanceOperationChannel,
  action: FinanceOperationAction
): boolean {
  if (action === "REVERSE") {
    return kind !== "TRANSFER" || channel === "TRANSFER";
  }

  if (kind === "COLLECTION") return COLLECTION_CHANNELS.has(channel);
  if (kind === "PAYMENT") return PAYMENT_CHANNELS.has(channel);
  if (kind === "TRANSFER") return channel === "TRANSFER";
  if (kind === "REFUND") return channel === "POS";
  if (kind === "REVERSAL") return false;
  return false;
}

export function validateFinanceOperationCommand(
  command: FinanceOperationCommand
): FinanceOperationPolicyResult {
  if (
    !required(command.tenantId) ||
    !required(command.companyId) ||
    !required(command.branchId) ||
    !required(command.accountingPeriodId)
  ) {
    return { ok: false, reason: "FINANCE_OPERATION_SCOPE_REQUIRED" };
  }

  if (!required(command.operationId) || !required(command.idempotencyKey)) {
    return { ok: false, reason: "FINANCE_OPERATION_IDEMPOTENCY_REQUIRED" };
  }

  if (!Number.isFinite(command.amount) || command.amount <= 0) {
    return { ok: false, reason: "FINANCE_OPERATION_AMOUNT_INVALID" };
  }

  if (!required(command.currency) || !required(command.occurredAt)) {
    return { ok: false, reason: "FINANCE_OPERATION_CURRENCY_DATE_REQUIRED" };
  }

  if (
    !isFinanceOperationCombinationAllowed(
      command.kind,
      command.channel,
      command.action
    )
  ) {
    return { ok: false, reason: "FINANCE_OPERATION_CHANNEL_KIND_DENIED" };
  }

  if (
    command.kind === "COLLECTION" &&
    !required(command.source.customerId)
  ) {
    return { ok: false, reason: "FINANCE_COLLECTION_CUSTOMER_REQUIRED" };
  }

  if (
    command.kind === "PAYMENT" &&
    !required(command.source.counterpartyId)
  ) {
    return { ok: false, reason: "FINANCE_PAYMENT_COUNTERPARTY_REQUIRED" };
  }

  if (
    command.action === "REVERSE" &&
    !required(command.reversalOfTransactionId)
  ) {
    return { ok: false, reason: "FINANCE_REVERSAL_TARGET_REQUIRED" };
  }

  if (
    command.channel === "CASH" &&
    !required(command.accounts.cashAccountId)
  ) {
    return { ok: false, reason: "FINANCE_CASH_ACCOUNT_REQUIRED" };
  }

  if (
    command.channel === "BANK" &&
    !required(command.accounts.bankAccountId)
  ) {
    return { ok: false, reason: "FINANCE_BANK_ACCOUNT_REQUIRED" };
  }

  if (
    command.channel === "POS" &&
    !required(command.accounts.posAccountId)
  ) {
    return { ok: false, reason: "FINANCE_POS_ACCOUNT_REQUIRED" };
  }

  return { ok: true, reason: null };
}