import type { ErpScope } from "@/lib/erpScope";

export type PosAccountKind =
  | "PHYSICAL"
  | "VIRTUAL"
  | "MOBILE"
  | "PAYMENT_LINK";


export type PosTransactionStatus =
  | "AUTHORIZED"
  | "PENDING_SETTLEMENT"
  | "PARTIALLY_SETTLED"
  | "SETTLED"
  | "REFUNDED"
  | "CANCELLED"
  | "REVERSED";

export interface PosAccount extends ErpScope {
  id: string;
  posCode: string;
  posName: string;
  bankAccountId: string;
  kind: PosAccountKind;
  merchantNumber: string | null;
  terminalNumber: string | null;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}


export interface PosContractRuleSnapshot {
  ruleId: string;
  posContractId: string;
  workingMode: PosWorkingMode;
  installmentCount: number;

  commissionRate: number;
  fixedTransactionFee: number;
  taxRate: number;
  additionalFeeRate: number;

  firstSettlementDayCount: number;
  installmentIntervalDayCount: number;
}
export interface PosTransaction extends ErpScope {
  id: string;
  posTransactionNumber: string;
  posAccountId: string;
  bankAccountId: string;
  posContractId: string;
  posContractRuleId: string;

  saleId: string;
  saleNumber: string;
  paymentId: string;
  customerId: string;

  installmentCount: number;
  workingMode: PosWorkingMode;

  grossAmount: number;
  commissionAmount: number;
  taxAmount: number;
  additionalFeeAmount: number;
  totalDeductionAmount: number;
  netAmount: number;

  currency: string;

  transactionDate: string;
  expectedFirstSettlementDate: string;
  expectedFinalSettlementDate: string;
  actualSettlementDate: string | null;

  settledAmount: number;
  pendingAmount: number;

  status: PosTransactionStatus;
  description: string | null;

  createdBy: string;
  createdAt: string;

  ruleSnapshot: PosContractRuleSnapshot;

  reversedAt: string | null;
  reversalOfPosTransactionId: string | null;
}

export interface PosSettlement extends ErpScope {
  id: string;
  settlementNumber: string;
  posTransactionId: string;
  posAccountId: string;
  bankAccountId: string;

  grossAmount: number;
  commissionAmount: number;
  taxAmount: number;
  additionalFeeAmount: number;
  netAmount: number;

  expectedFirstSettlementDate: string;
  expectedFinalSettlementDate: string;
  actualSettlementDate: string;

  bankMovementId: string;
  currency: string;

  createdBy: string;
  createdAt: string;
}

export interface PosReportSummary {
  grossPosAmount: number;
  commissionAmount: number;
  taxAmount: number;
  additionalFeeAmount: number;
  totalDeductionAmount: number;
  netExpectedAmount: number;
  settledAmount: number;
  pendingAmount: number;
  refundedAmount: number;
}

export type PosWorkingMode =
  | "ADVANCE_NET"
  | "MONTHLY_BLOCKED"
  | "BLOCKED_FIXED_DAY"
  | "MANUAL";

export interface PosContract extends ErpScope {
  id: string;
  contractNumber: string;
  contractName: string;

  bankAccountId: string;
  posAccountId: string;

  workingMode: PosWorkingMode;

  monthlyFixedFeeEnabled: boolean;
  monthlyFixedFeeAmount: number;

  currency: string;
  validFrom: string;
  validUntil: string | null;

  isActive: boolean;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface PosContractRule extends ErpScope {
  id: string;
  posContractId: string;
  posAccountId: string;

  installmentCount: number;
  workingMode: PosWorkingMode;

  commissionRate: number;
  fixedTransactionFee: number;
  taxRate: number;
  additionalFeeRate: number;

  firstSettlementDayCount: number;
  installmentIntervalDayCount: number;

  isActive: boolean;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface PosMonthlyFee extends ErpScope {
  id: string;
  feeNumber: string;

  posContractId: string;
  posAccountId: string;
  bankAccountId: string;

  year: number;
  month: number;

  grossAmount: number;
  taxAmount: number;
  netAmount: number;

  currency: string;
  dueDate: string;
  paidAt: string | null;

  bankMovementId: string | null;

  status:
    | "PLANNED"
    | "DUE"
    | "PAID"
    | "CANCELLED"
    | "REVERSED";

  createdBy: string;
  createdAt: string;
  reversedAt: string | null;
}

export interface PosSettlementScheduleLine
  extends ErpScope {
  id: string;
  scheduleId: string;

  sequence: number;

  expectedSettlementDate: string;
  actualSettlementDate: string | null;

  grossAmount: number;
  commissionAmount: number;
  taxAmount: number;
  additionalFeeAmount: number;
  netAmount: number;

  settledAmount: number;
  pendingAmount: number;

  bankMovementId: string | null;

  status:
    | "PENDING"
    | "PARTIALLY_SETTLED"
    | "SETTLED"
    | "CANCELLED"
    | "REVERSED";
}

export interface PosSettlementSchedule
  extends ErpScope {
  id: string;
  scheduleNumber: string;

  posTransactionId: string;
  posContractId: string;
  posContractRuleId: string;

  posAccountId: string;
  bankAccountId: string;

  workingMode: PosWorkingMode;
  installmentCount: number;

  grossAmount: number;
  totalDeductionAmount: number;
  netAmount: number;

  settledAmount: number;
  pendingAmount: number;

  currency: string;

  createdBy: string;
  createdAt: string;

  lines: PosSettlementScheduleLine[];
}
