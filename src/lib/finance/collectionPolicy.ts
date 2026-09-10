import type {
  CollectionChannel,
  CreateCollectionCommand
} from "@/lib/finance/collectionContracts";
import type {
  ReverseCollectionCommand,
  TransitionReceivableInstrumentCommand
} from "@/lib/finance/collectionContracts";

export interface CollectionPolicyDecision {
  ok: boolean;
  reason: string | null;
}

function required(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function uuid(value: unknown): boolean {
  return required(value) && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
}

function accountForChannel(command: CreateCollectionCommand): unknown {
  if (command.channel === "CASH") return command.cashAccountId;
  if (command.channel === "BANK") return command.bankAccountId;
  if (command.channel === "POS") return command.posAccountId;
  return null;
}

function validDateOnly(value: unknown): boolean {
  if (!required(value) || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  return Number.isFinite(Date.parse(`${String(value)}T00:00:00.000Z`));
}

export function defaultCollectionDescription(
  channel: CollectionChannel,
  accountName?: string | null
): string {
  const name = accountName?.trim();
  if (channel === "CASH") return name ? `Nakit tahsilat – ${name}` : "Nakit tahsilat";
  if (channel === "BANK") return name ? `${name} – EFT/Havale tahsilatı` : "EFT/Havale tahsilatı";
  if (channel === "POS") return name ? `Kredi kartı ile tahsilat – ${name}` : "Kredi kartı ile tahsilat";
  if (channel === "CHEQUE") return "Müşteri çeki ile tahsilat";
  return "Müşteri senedi ile tahsilat";
}

export function validateCreateCollectionCommand(
  command: CreateCollectionCommand
): CollectionPolicyDecision {
  if (
    !required(command.tenantId) || !required(command.companyId) ||
    !required(command.branchId) || !required(command.accountingPeriodId)
  ) return { ok: false, reason: "FINANCE_COLLECTION_SCOPE_REQUIRED" };

  if (!uuid(command.operationId) || !uuid(command.idempotencyKey)) {
    return { ok: false, reason: "FINANCE_COLLECTION_IDEMPOTENCY_UUID_REQUIRED" };
  }
  if (!required(command.customerId)) {
    return { ok: false, reason: "FINANCE_COLLECTION_CUSTOMER_REQUIRED" };
  }
  if (!Number.isFinite(command.amount) || command.amount <= 0) {
    return { ok: false, reason: "FINANCE_COLLECTION_AMOUNT_INVALID" };
  }
  if (!/^[A-Z]{3}$/.test(command.currency.trim().toUpperCase())) {
    return { ok: false, reason: "FINANCE_COLLECTION_CURRENCY_INVALID" };
  }

  if (["CASH", "BANK", "POS"].includes(command.channel) && !uuid(accountForChannel(command))) {
    return { ok: false, reason: `FINANCE_COLLECTION_${command.channel}_ACCOUNT_UUID_REQUIRED` };
  }
  if (command.channel === "POS" &&
      (!Number.isInteger(command.installmentCount) || Number(command.installmentCount) <= 0)) {
    return { ok: false, reason: "FINANCE_COLLECTION_POS_INSTALLMENT_COUNT_INVALID" };
  }

  if (command.channel === "CHEQUE" || command.channel === "NOTE") {
    const instrument = command.instrument;
    if (!instrument) return { ok: false, reason: "FINANCE_COLLECTION_INSTRUMENT_REQUIRED" };
    if (!required(instrument.instrumentNumber) || !required(instrument.drawerName)) {
      return { ok: false, reason: "FINANCE_COLLECTION_INSTRUMENT_IDENTITY_REQUIRED" };
    }
    if (!validDateOnly(instrument.dueDate)) {
      return { ok: false, reason: "FINANCE_COLLECTION_INSTRUMENT_DUE_DATE_INVALID" };
    }
    if (command.channel === "CHEQUE" && !required(instrument.bankName)) {
      return { ok: false, reason: "FINANCE_COLLECTION_CHEQUE_BANK_REQUIRED" };
    }
  } else if (command.instrument) {
    return { ok: false, reason: "FINANCE_COLLECTION_INSTRUMENT_CHANNEL_MISMATCH" };
  }

  return { ok: true, reason: null };
}

export function validateReverseCollectionCommand(
  command: ReverseCollectionCommand
): CollectionPolicyDecision {
  if (!required(command.tenantId) || !required(command.companyId) ||
      !required(command.branchId) || !required(command.accountingPeriodId)) {
    return { ok: false, reason: "FINANCE_COLLECTION_SCOPE_REQUIRED" };
  }
  if (!uuid(command.operationId) || !uuid(command.idempotencyKey) ||
      !uuid(command.reversalOfOperationId) || command.operationId === command.reversalOfOperationId) {
    return { ok: false, reason: "FINANCE_COLLECTION_REVERSAL_UUID_INVALID" };
  }
  if (!["CASH", "BANK", "POS"].includes(command.channel)) {
    return { ok: false, reason: "FINANCE_COLLECTION_REVERSAL_CHANNEL_INVALID" };
  }
  if (!required(command.reason)) {
    return { ok: false, reason: "FINANCE_COLLECTION_REVERSAL_REASON_REQUIRED" };
  }
  return { ok: true, reason: null };
}

export function validateTransitionReceivableInstrumentCommand(
  command: TransitionReceivableInstrumentCommand
): CollectionPolicyDecision {
  if (!required(command.tenantId) || !required(command.companyId) ||
      !required(command.branchId) || !required(command.accountingPeriodId)) {
    return { ok: false, reason: "FINANCE_INSTRUMENT_SCOPE_REQUIRED" };
  }
  if (!uuid(command.operationId) || !uuid(command.idempotencyKey) || !uuid(command.instrumentId)) {
    return { ok: false, reason: "FINANCE_INSTRUMENT_TRANSITION_UUID_INVALID" };
  }
  if (!["PORTFOLIO", "DEPOSITED", "ENDORSED"].includes(command.fromState)) {
    return { ok: false, reason: "FINANCE_INSTRUMENT_FROM_STATE_REQUIRED" };
  }
  if (!["CHEQUE", "NOTE"].includes(command.instrumentType) ||
      !["DEPOSITED", "ENDORSED", "COLLECTED", "RETURNED", "CANCELLED"].includes(command.toState)) {
    return { ok: false, reason: "FINANCE_INSTRUMENT_TRANSITION_INVALID" };
  }
  if (["DEPOSITED", "COLLECTED"].includes(command.toState) && !uuid(command.bankAccountId)) {
    return { ok: false, reason: "FINANCE_INSTRUMENT_BANK_ACCOUNT_UUID_REQUIRED" };
  }
  if (command.toState === "ENDORSED" && (!required(command.counterpartyId) ||
      !["SUPPLIER", "TAILOR", "INSTALLER"].includes(command.counterpartyType || ""))) {
    return { ok: false, reason: "FINANCE_INSTRUMENT_ENDORSE_COUNTERPARTY_REQUIRED" };
  }
  if (["RETURNED", "CANCELLED"].includes(command.toState) && !required(command.reason)) {
    return { ok: false, reason: "FINANCE_INSTRUMENT_TRANSITION_REASON_REQUIRED" };
  }
  return { ok: true, reason: null };
}
