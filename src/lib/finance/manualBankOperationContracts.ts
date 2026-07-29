import type {
  BankMovement,
  BankMovementDirection,
  BankMovementType
} from "@/lib/finance/bankingContracts";
import type {
  FinanceJournalPosting
} from "@/lib/finance/financeJournalContracts";
import type {
  ErpScope
} from "@/lib/erpScope";

export type ManualBankOperationChannel =
  | "EFT"
  | "HAVALE"
  | "FAST";

export type ManualBankOperationPermission =
  | "BANK_EFT_IN"
  | "BANK_EFT_OUT"
  | "BANK_HAVALE_IN"
  | "BANK_HAVALE_OUT"
  | "BANK_FAST_IN"
  | "BANK_FAST_OUT";

export interface ManualBankOperationCommand
  extends ErpScope {
  transactionId: string;
  idempotencyKey: string;

  channel: ManualBankOperationChannel;
  direction: BankMovementDirection;

  bankAccountId: string;
  bankLedgerAccountId: string;
  counterpartyLedgerAccountId: string;

  amount: number;
  currency: string;

  transactionDate: string;
  valueDate?: string | null;

  movementId: string;
  movementNumber: string;

  journalEntryId: string;
  journalNumber: string;

  sourceDocumentId: string;
  sourceDocumentNumber: string;

  firstJournalLineId: string;
  secondJournalLineId: string;

  customerId?: string | null;
  supplierId?: string | null;

  description?: string | null;
  externalReference?: string | null;

  grantedPermissions:
    readonly ManualBankOperationPermission[];

  createdBy: string;
  createdAt: string;
}

export interface ManualBankOperationPlan {
  requiredPermission:
    ManualBankOperationPermission;

  movementType:
    BankMovementType;

  bankMovement:
    BankMovement;

  journalPosting:
    FinanceJournalPosting;
}

export interface InterBankTransferCommand
  extends ErpScope {
  transactionId: string;
  idempotencyKey: string;

  sourceBankAccountId: string;
  sourceBankLedgerAccountId: string;

  destinationBankAccountId: string;
  destinationBankLedgerAccountId: string;

  amount: number;
  currency: string;

  transactionDate: string;
  valueDate?: string | null;

  sourceMovementId: string;
  sourceMovementNumber: string;

  destinationMovementId: string;
  destinationMovementNumber: string;

  journalEntryId: string;
  journalNumber: string;

  sourceDocumentId: string;
  sourceDocumentNumber: string;

  debitJournalLineId: string;
  creditJournalLineId: string;

  description?: string | null;

  createdBy: string;
  createdAt: string;
}

export interface InterBankTransferPlan {
  sourceMovement:
    BankMovement;

  destinationMovement:
    BankMovement;

  journalPosting:
    FinanceJournalPosting;
}
