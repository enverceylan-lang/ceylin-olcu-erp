import type { FinanceOperationScope } from "@/lib/finance/financeOperationsContracts";

export type CollectionChannel = "CASH" | "BANK" | "POS" | "CHEQUE" | "NOTE";

export interface CollectionInstrumentDetails {
  instrumentNumber: string;
  dueDate: string;
  drawerName: string;
  bankName?: string | null;
  bankBranch?: string | null;
  accountNumber?: string | null;
  issueDate?: string | null;
  issuePlace?: string | null;
  guarantorName?: string | null;
  documentMediaId?: string | null;
}

export interface CreateCollectionCommand extends FinanceOperationScope {
  operationId: string;
  idempotencyKey: string;
  channel: CollectionChannel;
  customerId: string;
  amount: number;
  currency: string;
  cashAccountId?: string | null;
  bankAccountId?: string | null;
  posAccountId?: string | null;
  installmentCount?: number | null;
  description?: string | null;
  instrument?: CollectionInstrumentDetails | null;
}

export interface CollectionAllocation {
  receivableId: string;
  saleId: string;
  installmentId: string | null;
  amount: number;
}

export interface CollectionResult {
  outcome: "CREATED" | "REPLAY" | "CONFLICT" | "REJECT";
  operationId: string | null;
  transactionIds: string[];
  instrumentId: string | null;
  allocations: CollectionAllocation[];
  reason: string | null;
  occurredAt: string | null;
}

export interface ReverseCollectionCommand extends FinanceOperationScope {
  operationId: string;
  idempotencyKey: string;
  reversalOfOperationId: string;
  channel: "CASH" | "BANK" | "POS";
  reason: string;
}

export interface TransitionReceivableInstrumentCommand extends FinanceOperationScope {
  operationId: string;
  idempotencyKey: string;
  instrumentId: string;
  instrumentType: "CHEQUE" | "NOTE";
  fromState: "PORTFOLIO" | "DEPOSITED" | "ENDORSED";
  toState: "DEPOSITED" | "ENDORSED" | "COLLECTED" | "RETURNED" | "CANCELLED";
  bankAccountId?: string | null;
  counterpartyId?: string | null;
  counterpartyType?: "SUPPLIER" | "TAILOR" | "INSTALLER" | null;
  reason?: string | null;
}
