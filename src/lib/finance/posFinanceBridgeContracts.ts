import type {
  BankMovement
} from "@/lib/finance/bankingContracts";
import type {
  FinanceJournalPosting
} from "@/lib/finance/financeJournalContracts";
import type {
  PosMonthlyFee,
  PosSettlementSchedule,
  PosTransaction
} from "@/lib/finance/posContracts";
import type {
  PosOperationContext
} from "@/lib/finance/posOperationsContracts";

export interface PosFinanceAccountIds {
  posClearingAccountId: string;
  bankAccountLedgerId: string;
  posCommissionExpenseAccountId: string;
  posMonthlyFeeExpenseAccountId: string;
  posTaxExpenseAccountId: string;
  customerReceivableAccountId: string;
}

export interface PosFinanceDocumentIds {
  bankMovementId: string;
  bankMovementNumber: string;

  journalEntryId: string;
  journalNo: string;
}

export interface CreatePosSettlementFinanceCommand {
  context: PosOperationContext;

  transaction: PosTransaction;
  schedule: PosSettlementSchedule;

  settlementId: string;
  settlementNumber: string;
  scheduleLineId: string;

  settlementAmount: number;
  settlementDate: string;

  documents: PosFinanceDocumentIds;
  accounts: PosFinanceAccountIds;

  description: string | null;
}

export interface CreatePosSettlementFinanceResult {
  bankMovement: BankMovement;
  journalPosting: FinanceJournalPosting;

  grossSettlementAmount: number;
  commissionAmount: number;
  taxAmount: number;
  additionalFeeAmount: number;
  bankNetAmount: number;
}

export interface CreatePosMonthlyFeeFinanceCommand {
  context: PosOperationContext;

  fee: PosMonthlyFee;

  documents: PosFinanceDocumentIds;
  accounts: PosFinanceAccountIds;

  paymentDate: string;
  description: string | null;
}

export interface CreatePosMonthlyFeeFinanceResult {
  bankMovement: BankMovement;
  journalPosting: FinanceJournalPosting;

  expenseAmount: number;
  taxAmount: number;
  bankOutflowAmount: number;
}

export interface CreatePosRefundFinanceCommand {
  context: PosOperationContext;

  originalTransaction: PosTransaction;
  refundTransaction: PosTransaction;

  documents: PosFinanceDocumentIds;
  accounts: PosFinanceAccountIds;

  refundDate: string;
  description: string | null;
}

export interface CreatePosRefundFinanceResult {
  bankMovement: BankMovement;
  journalPosting: FinanceJournalPosting;

  refundAmount: number;
  bankOutflowAmount: number;
}

export interface PosFinanceBridgeState {
  bankMovements: readonly BankMovement[];

  journalEntryIds: readonly string[];
  journalNumbers: readonly string[];

  idempotencyKeys: readonly string[];
}

export interface PosFinanceBridgeWriteResult<T> {
  value: T;

  idempotencyKey: string;
  sourceDocumentId: string;
  sourceDocumentNumber: string;
}
