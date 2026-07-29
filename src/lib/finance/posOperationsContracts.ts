import type {
  PosContract,
  PosContractRule,
  PosMonthlyFee,
  PosSettlementSchedule,
  PosTransaction
} from "@/lib/finance/posContracts";

export type PosOperationType =
  | "CREATE_TRANSACTION"
  | "SETTLE_TRANSACTION"
  | "CREATE_MONTHLY_FEE"
  | "PAY_MONTHLY_FEE"
  | "REFUND_TRANSACTION"
  | "REVERSE_OPERATION";

export type PosOperationStatus =
  | "PENDING"
  | "COMPLETED"
  | "CANCELLED"
  | "REVERSED";

export interface PosOperationContext {
  tenantId: string;
  companyId: string;
  branchId: string;
  accountingPeriodId: string;

  userId: string;
  operationDate: string;
  idempotencyKey: string;
}

export interface CreatePosTransactionCommand {
  context: PosOperationContext;

  id: string;
  posTransactionNumber: string;

  contract: PosContract;
  rule: PosContractRule;

  saleId: string;
  saleNumber: string;
  paymentId: string;
  customerId: string;

  grossAmount: number;
  installmentCount: number;
  transactionDate: string;

  currency: string;
  description: string | null;
}

export interface CreatePosTransactionResult {
  transaction: PosTransaction;
  settlementSchedule: PosSettlementSchedule;
}

export interface SettlePosTransactionCommand {
  context: PosOperationContext;

  transaction: PosTransaction;
  schedule: PosSettlementSchedule;

  scheduleLineId: string;
  settlementId: string;
  settlementNumber: string;

  amount: number;
  actualSettlementDate: string;
  bankMovementId: string;
}

export interface SettlePosTransactionResult {
  transaction: PosTransaction;
  settlementSchedule: PosSettlementSchedule;

  settledAmount: number;
  remainingPendingAmount: number;
}

export interface CreatePosMonthlyFeeCommand {
  context: PosOperationContext;

  id: string;
  feeNumber: string;

  contract: PosContract;

  year: number;
  month: number;

  taxRate: number;
  dueDate: string;

  existingFees: readonly PosMonthlyFee[];
}

export interface PayPosMonthlyFeeCommand {
  context: PosOperationContext;

  fee: PosMonthlyFee;
  paidAt: string;
  bankMovementId: string;
}

export interface RefundPosTransactionCommand {
  context: PosOperationContext;

  originalTransaction: PosTransaction;

  refundTransactionId: string;
  refundTransactionNumber: string;

  refundAmount: number;
  refundDate: string;

  bankMovementId: string | null;
  description: string | null;
}

export interface RefundPosTransactionResult {
  originalTransaction: PosTransaction;
  refundTransaction: PosTransaction;
}

export interface ReversePosOperationCommand {
  context: PosOperationContext;

  operationType: PosOperationType;
  sourceOperationId: string;
  reversalOperationId: string;

  reversalReason: string;
}

export interface PosOperationAudit {
  id: string;

  tenantId: string;
  companyId: string;
  branchId: string;
  accountingPeriodId: string;

  operationType: PosOperationType;
  operationStatus: PosOperationStatus;

  sourceOperationId: string;
  idempotencyKey: string;

  userId: string;
  operationDate: string;

  description: string | null;
  reversalOfAuditId: string | null;
}

export interface PosOperationState {
  transactions: readonly PosTransaction[];
  settlementSchedules: readonly PosSettlementSchedule[];
  monthlyFees: readonly PosMonthlyFee[];
  audits: readonly PosOperationAudit[];
}
