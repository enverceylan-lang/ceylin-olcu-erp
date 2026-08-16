import type { ErpScope } from "@/lib/erpScope";
import type { PosWorkingMode } from "@/lib/finance/posContracts";

export type PosServerAuthorityAction =
  | "UPSERT_CONTRACT"
  | "UPSERT_RULE"
  | "ARCHIVE_CONTRACT"
  | "ARCHIVE_RULE"
  | "POST_COLLECTION"
  | "SETTLE_TRANSACTION"
  | "POST_MONTHLY_FEE"
  | "REFUND_TRANSACTION"
  | "REVERSE_TRANSACTION";

export interface PosServerAuthorityAccountRefs {
  customerReceivableAccountId?: string | null;
  commissionExpenseAccountId?: string | null;
  taxExpenseAccountId?: string | null;
  monthlyFeeExpenseAccountId?: string | null;
}

export interface PosServerContractInput {
  contractId: string;
  contractNumber: string;
  contractName: string;
  posAccountId: string;
  workingMode: PosWorkingMode;
  monthlyFixedFeeEnabled: boolean;
  monthlyFixedFeeAmount: number;
  monthlyFeeTaxRate: number;
  currency: string;
  validFrom: string;
  validUntil?: string | null;
  accounts: PosServerAuthorityAccountRefs;
}

export interface PosServerRuleInput {
  ruleId: string;
  contractId: string;
  posAccountId: string;
  installmentCount: number;
  workingMode: PosWorkingMode;
  commissionRate: number;
  fixedTransactionFee: number;
  taxRate: number;
  additionalFeeRate: number;
  firstSettlementDayCount: number;
  installmentIntervalDayCount: number;
}

export interface PosServerArchiveInput {
  id: string;
  reason: string;
}

export interface PosServerCollectionInput {
  transactionId: string;
  posTransactionNumber: string;
  contractId: string;
  ruleId: string;
  posAccountId: string;
  saleId: string;
  saleNumber: string;
  paymentId: string;
  customerId: string;
  grossAmount: number;
  installmentCount: number;
  transactionDate: string;
  currency: string;
  description?: string | null;
}

export interface PosServerSettlementInput {
  transactionId: string;
  scheduleLineId: string;
  settlementId: string;
  settlementNumber: string;
  amount: number;
  settlementDate: string;
  description?: string | null;
}

export interface PosServerMonthlyFeeInput {
  monthlyFeeId: string;
  feeNumber: string;
  contractId: string;
  year: number;
  month: number;
  paymentDate: string;
  description?: string | null;
}

export interface PosServerRefundInput {
  originalTransactionId: string;
  refundTransactionId: string;
  refundTransactionNumber: string;
  refundAmount: number;
  refundDate: string;
  description?: string | null;
}

export interface PosServerReversalInput {
  transactionId: string;
  reversalTransactionId: string;
  reversalReason: string;
  occurredAt: string;
}

export interface PosServerAuthorityCommand extends ErpScope {
  operationId: string;
  idempotencyKey: string;
  action: PosServerAuthorityAction;
  occurredAt: string;
  contract?: PosServerContractInput;
  rule?: PosServerRuleInput;
  archive?: PosServerArchiveInput;
  collection?: PosServerCollectionInput;
  settlement?: PosServerSettlementInput;
  monthlyFee?: PosServerMonthlyFeeInput;
  refund?: PosServerRefundInput;
  reversal?: PosServerReversalInput;
}

export type PosServerAuthorityGuard = { mode: "ADMIN" };

export type PosServerAuthorityDecision =
  | {
      allowed: true;
      command: PosServerAuthorityCommand;
      guard: PosServerAuthorityGuard;
    }
  | {
      allowed: false;
      status: 400 | 403;
      code: string;
    };
