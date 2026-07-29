import type {
  FinanceJournalPosting
} from "@/lib/finance/financeJournalContracts";
import type {
  ErpScope
} from "@/lib/erpScope";

export type CashOperationDirection =
  | "IN"
  | "OUT";

export type CashOperationPermission =
  | "CASH_IN"
  | "CASH_OUT";

export type CashMovementStatus =
  | "POSTED"
  | "REVERSED";

export interface CashMovement
  extends ErpScope {
  id: string;
  movementNumber: string;

  cashAccountId: string;
  direction: CashOperationDirection;

  transactionId: string;
  idempotencyKey: string;

  sourceDocumentType:
    | "CUSTOMER_COLLECTION"
    | "SUPPLIER_PAYMENT"
    | "MANUAL_CASH"
    | "CASH_BANK_TRANSFER"
    | "OPENING_BALANCE";

  sourceDocumentId: string;
  sourceDocumentNumber: string;

  customerId: string | null;
  supplierId: string | null;
  saleId: string | null;
  installmentId: string | null;

  amount: number;
  currency: string;
  transactionDate: string;

  status: CashMovementStatus;

  description: string | null;

  createdBy: string;
  createdAt: string;

  reversedAt: string | null;
  reversalOfMovementId: string | null;
}

export interface CashOperationCommand
  extends ErpScope {
  transactionId: string;
  idempotencyKey: string;

  direction: CashOperationDirection;

  cashAccountId: string;
  cashLedgerAccountId: string;
  counterpartyLedgerAccountId: string;

  amount: number;
  currency: string;
  transactionDate: string;

  movementId: string;
  movementNumber: string;

  journalEntryId: string;
  journalNumber: string;

  firstJournalLineId: string;
  secondJournalLineId: string;

  sourceDocumentType:
    CashMovement["sourceDocumentType"];

  sourceDocumentId: string;
  sourceDocumentNumber: string;

  customerId?: string | null;
  supplierId?: string | null;
  saleId?: string | null;
  installmentId?: string | null;

  description?: string | null;

  grantedPermissions:
    readonly CashOperationPermission[];

  createdBy: string;
  createdAt: string;
}

export interface CashOperationPlan {
  requiredPermission:
    CashOperationPermission;

  cashMovement:
    CashMovement;

  journalPosting:
    FinanceJournalPosting;
}

export interface CustomerOpenItem
  extends ErpScope {
  id: string;
  customerId: string;

  saleId: string | null;
  installmentId: string | null;

  documentNumber: string;
  dueDate: string;

  currency: string;
  openAmount: number;
}

export interface CustomerFinanceAllocationCommand
  extends ErpScope {
  customerId: string;
  currency: string;
  amount: number;

  preferredOpenItemId?: string | null;

  openItems:
    readonly CustomerOpenItem[];
}

export interface CustomerFinanceAllocationLine {
  openItemId: string;

  saleId: string | null;
  installmentId: string | null;

  documentNumber: string;
  dueDate: string;

  allocatedAmount: number;
  remainingOpenAmount: number;
}

export interface CustomerFinanceAllocationPlan {
  customerId: string;
  currency: string;

  requestedAmount: number;
  allocatedAmount: number;
  unappliedAmount: number;

  lines:
    CustomerFinanceAllocationLine[];
}
