import type { FinancePaymentMethod } from "@/lib/finance/financeContracts";

export type FinanceOperationKind =
  | "COLLECTION"
  | "PAYMENT"
  | "TRANSFER"
  | "REVERSAL"
  | "REFUND";

export type FinanceOperationChannel =
  | "CASH"
  | "BANK"
  | "POS"
  | "CHEQUE"
  | "NOTE"
  | "TRANSFER";

export type FinanceOperationAction = "CREATE" | "REVERSE";

export type FinanceInstrumentType = "CHEQUE" | "NOTE";
export type FinanceInstrumentDirection = "RECEIVABLE" | "PAYABLE";

export type FinanceInstrumentState =
  | "PORTFOLIO"
  | "ISSUED"
  | "ENDORSED"
  | "DEPOSITED"
  | "COLLECTED"
  | "PAID"
  | "RETURNED"
  | "CANCELLED";

export interface FinanceOperationScope {
  tenantId: string;
  companyId: string;
  branchId: string;
  accountingPeriodId: string;
}

export interface FinanceOperationAccountRefs {
  financeAccountId?: string | null;
  cashAccountId?: string | null;
  bankAccountId?: string | null;
  posAccountId?: string | null;
  counterAccountId?: string | null;
  sourceBankAccountId?: string | null;
  destinationBankAccountId?: string | null;
}

export interface FinanceOperationSourceRefs {
  customerId?: string | null;
  counterpartyId?: string | null;
  saleId?: string | null;
  sourceDocumentId?: string | null;
  sourceDocumentType?: string | null;
}

export interface FinanceOperationCommand extends FinanceOperationScope {
  operationId: string;
  idempotencyKey: string;
  kind: FinanceOperationKind;
  channel: FinanceOperationChannel;
  action: FinanceOperationAction;
  amount: number;
  currency: string;
  paymentMethod: FinancePaymentMethod;
  accounts: FinanceOperationAccountRefs;
  source: FinanceOperationSourceRefs;
  occurredAt: string;
  description?: string | null;
  reversalOfTransactionId?: string | null;
}

export interface FinanceMovementQuery extends FinanceOperationScope {
  dateFrom?: string | null;
  dateTo?: string | null;
  type?: FinanceOperationKind | null;
  channel?: FinanceOperationChannel | null;
  accountId?: string | null;
  currency?: string | null;
  customerId?: string | null;
  counterpartyId?: string | null;
  saleId?: string | null;
  sourceDocumentId?: string | null;
  cursor?: string | null;
  limit?: number;
}

export interface FinanceInstrumentCommand extends FinanceOperationScope {
  instrumentId: string;
  idempotencyKey: string;
  type: FinanceInstrumentType;
  direction: FinanceInstrumentDirection;
  state: FinanceInstrumentState;
  amount: number;
  currency: string;
  counterpartyId: string;
  ledgerAccountId: string;
  sourceDocumentId?: string | null;
  occurredAt: string;
}