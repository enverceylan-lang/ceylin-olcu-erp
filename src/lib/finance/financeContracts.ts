import type { ErpScope } from "@/lib/erpScope";

export type FinanceAccountType =
  | "CASH"
  | "BANK"
  | "POS"
  | "CUSTOMER_RECEIVABLE"
  | "CUSTOMER_PAYABLE"
  | "CHEQUE_RECEIVABLE"
  | "CHEQUE_PAYABLE"
  | "NOTE_RECEIVABLE"
  | "NOTE_PAYABLE"
  | "CLEARING"
  | "OTHER";

export type FinanceTransactionType =
  | "SALE_CHARGE"
  | "COLLECTION"
  | "PAYMENT"
  | "TRANSFER"
  | "REVERSAL"
  | "REFUND"
  | "ADJUSTMENT";

export type FinanceTransactionDirection = "DEBIT" | "CREDIT";

export type FinancePaymentMethod =
  | "GENERIC"
  | "CASH"
  | "CREDIT_CARD"
  | "EFT"
  | "BANK_TRANSFER"
  | "CHEQUE"
  | "PROMISSORY_NOTE"
  | "OTHER";

export type FinanceTransactionStatus =
  | "DRAFT"
  | "PENDING"
  | "POSTED"
  | "SETTLED"
  | "FAILED"
  | "CANCELLED"
  | "REVERSED";

export type FinanceSourceDocumentType =
  | "SALE"
  | "SALE_PAYMENT"
  | "SALE_RETURN"
  | "LEGACY_DOWN_PAYMENT"
  | "EXPENSE"
  | "CHEQUE"
  | "NOTE"
  | "POS_SETTLEMENT"
  | "OPENING_BALANCE"
  | "MANUAL";

export type FinanceProjectionSource =
  | "SALE_CHARGE"
  | "SALE_PAYMENT"
  | "SALE_RETURN"
  | "LEGACY_DOWN_PAYMENT";

export interface FinanceAccount extends ErpScope {
  id: string;
  code: string;
  name: string;
  type: FinanceAccountType;
  currency: string;
  isActive: boolean;
  isDefaultCollection: boolean;
  isDefaultPayment: boolean;
  linkedBankAccountId: string | null;
  linkedPosAccountId: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface FinanceTransaction extends ErpScope {
  id: string;
  transactionId: string;
  idempotencyKey: string;
  transactionType: FinanceTransactionType;
  direction: FinanceTransactionDirection;
  paymentMethod: FinancePaymentMethod | null;
  financeAccountId: string | null;
  counterAccountId: string | null;
  customerId: string;
  saleId: string;
  sourceDocumentId: string;
  sourceDocumentType: FinanceSourceDocumentType;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  currency: string;
  transactionDate: string;
  valueDate: string | null;
  dueDate: string | null;
  status: FinanceTransactionStatus;
  description: string | null;
  externalReference: string | null;
  reversalOfTransactionId: string | null;
  createdBy: string;
  createdAt: string;
  postedAt: string | null;
  reversedAt: string | null;
  archivedAt: string | null;
  projectionSource: FinanceProjectionSource;
}

export interface SaleFinanceProjectionIssue {
  code:
    | "MISSING_SCOPE"
    | "MISSING_CUSTOMER_ID"
    | "MISSING_SALE_ID"
    | "INVALID_CURRENCY"
    | "INVALID_PROJECTION_TIME"
    | "INVALID_SALE_TOTAL"
    | "MISSING_PAYMENT_ID"
    | "INVALID_PAYMENT_AMOUNT"
    | "PAYMENT_ID_CONFLICT"
    | "DUPLICATE_PAYMENT_ID"
    | "DEBIT_RECONCILIATION_MISMATCH"
    | "CREDIT_RECONCILIATION_MISMATCH"
    | "BALANCE_RECONCILIATION_MISMATCH"
    | "SALE_REMAINING_BALANCE_DRIFT";
  severity: "ERROR" | "WARNING";
  message: string;
  saleId: string | null;
  paymentId: string | null;
  expected: number | string | null;
  actual: number | string | null;
}

export interface SaleFinanceProjectionSummary {
  saleNetTotal: number;
  paymentTotal: number;
  effectivePaidTotal: number;
  legacyDownPaymentDifference: number;
  projectedDebit: number;
  projectedCredit: number;
  projectedBalance: number;
  expectedPaidTotal: number;
  expectedRemainingBalance: number;
  reconciled: boolean;
}

export interface SaleFinanceProjectionResult {
  saleId: string;
  customerId: string;
  scope: ErpScope;
  currency: string;
  projectedAt: string;
  transactions: FinanceTransaction[];
  summary: SaleFinanceProjectionSummary;
  issues: SaleFinanceProjectionIssue[];
}
