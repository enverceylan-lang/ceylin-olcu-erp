import {
  erpScopeMatches,
  validateErpScope,
  type ErpScope
} from "@/lib/erpScope";

import type {
  FinanceTransaction
} from "@/lib/finance/financeContracts";

export interface ApprovedSaleSource extends ErpScope {
  id: string;
  customerId: string;
  status: string;
  totalAmount: number;
  approvedByUserId: string;
}

export interface ApprovedSaleReturnSource extends ErpScope {
  id: string;
  saleId: string;
  customerId: string;
  status: string;
  amount: number;
  actorUserId: string;
}

export interface FinanceSystemWorkflowSourceRepository {
  loadApprovedSale(
    scope: ErpScope,
    saleId: string
  ): Promise<ApprovedSaleSource | null>;

  loadApprovedSaleReturn(
    scope: ErpScope,
    saleReturnId: string
  ): Promise<ApprovedSaleReturnSource | null>;
}

export type FinanceSystemWorkflowSourceVerificationResult =
  | { verified: true }
  | {
      verified: false;
      reason:
        | "INVALID_SCOPE"
        | "SOURCE_NOT_FOUND"
        | "SOURCE_STATUS_INVALID"
        | "SOURCE_SCOPE_MISMATCH"
        | "SOURCE_CUSTOMER_MISMATCH"
        | "SOURCE_SALE_MISMATCH"
        | "SOURCE_AMOUNT_MISMATCH"
        | "SOURCE_ACTOR_MISMATCH";
    };

const MONEY_EPSILON = 0.000001;

function sameAmount(left: number, right: number): boolean {
  return (
    Number.isFinite(left) &&
    Number.isFinite(right) &&
    Math.abs(left - right) <= MONEY_EPSILON
  );
}

function getScope(value: ErpScope): ErpScope {
  return {
    tenantId: value.tenantId,
    companyId: value.companyId,
    branchId: value.branchId,
    accountingPeriodId: value.accountingPeriodId
  };
}

export async function verifyFinanceSystemWorkflowSource(
  transaction: FinanceTransaction,
  workflow: "SALE_APPROVAL" | "SALE_RETURN_APPROVAL",
  repository: FinanceSystemWorkflowSourceRepository
): Promise<FinanceSystemWorkflowSourceVerificationResult> {
  const scope = getScope(transaction);

  if (!validateErpScope(scope).valid) {
    return { verified: false, reason: "INVALID_SCOPE" };
  }

  if (workflow === "SALE_APPROVAL") {
    const sale = await repository.loadApprovedSale(
      scope,
      transaction.saleId
    );

    if (!sale) return { verified: false, reason: "SOURCE_NOT_FOUND" };
    if (sale.status !== "ONAYLANDI") {
      return { verified: false, reason: "SOURCE_STATUS_INVALID" };
    }
    if (!erpScopeMatches(scope, getScope(sale))) {
      return { verified: false, reason: "SOURCE_SCOPE_MISMATCH" };
    }
    if (sale.customerId !== transaction.customerId) {
      return { verified: false, reason: "SOURCE_CUSTOMER_MISMATCH" };
    }
    if (!sameAmount(sale.totalAmount, transaction.netAmount)) {
      return { verified: false, reason: "SOURCE_AMOUNT_MISMATCH" };
    }
    if (sale.approvedByUserId !== transaction.createdBy) {
      return { verified: false, reason: "SOURCE_ACTOR_MISMATCH" };
    }

    return { verified: true };
  }

  const saleReturn = await repository.loadApprovedSaleReturn(
    scope,
    transaction.sourceDocumentId
  );

  if (!saleReturn) return { verified: false, reason: "SOURCE_NOT_FOUND" };
  if (saleReturn.status !== "ONAYLANDI") {
    return { verified: false, reason: "SOURCE_STATUS_INVALID" };
  }
  if (!erpScopeMatches(scope, getScope(saleReturn))) {
    return { verified: false, reason: "SOURCE_SCOPE_MISMATCH" };
  }
  if (saleReturn.saleId !== transaction.saleId) {
    return { verified: false, reason: "SOURCE_SALE_MISMATCH" };
  }
  if (saleReturn.customerId !== transaction.customerId) {
    return { verified: false, reason: "SOURCE_CUSTOMER_MISMATCH" };
  }
  if (!sameAmount(saleReturn.amount, transaction.netAmount)) {
    return { verified: false, reason: "SOURCE_AMOUNT_MISMATCH" };
  }
  if (saleReturn.actorUserId !== transaction.createdBy) {
    return { verified: false, reason: "SOURCE_ACTOR_MISMATCH" };
  }

  return { verified: true };
}