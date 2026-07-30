import type {
  ErpScope
} from "@/lib/erpScope";

import type {
  FinanceTransaction
} from "@/lib/finance/financeContracts";

import {
  listLocalFinanceTransactions
} from "@/lib/localFinanceDb";

import {
  startSaleReturnWorkflow,
  type SaleReturnWorkflowDependencies,
  type StartSaleReturnWorkflowResult
} from "@/lib/saleReturnWorkflowService";

import type {
  CreateSaleReturnRequest
} from "@/lib/saleReturnService";

const MONEY_EPSILON = 0.000001;

export type SaleReturnEligibilityRejectReason =
  | "FINANCE_SCOPE_MISMATCH"
  | "FINANCE_CUSTOMER_MISMATCH"
  | "FINANCE_SALE_MISMATCH"
  | "FINANCE_CURRENCY_MISMATCH"
  | "NO_POSTED_SALE_CHARGE"
  | "NO_RETURNABLE_AMOUNT"
  | "AMOUNT_EXCEEDS_FINANCE_RETURNABLE";

export interface SaleReturnFinanceEligibility {
  saleChargeTotal: number;
  refundTotal: number;
  returnableAmount: number;
  currency: string;
}

export type StartFinanceValidatedSaleReturnResult =
  | StartSaleReturnWorkflowResult
  | {
      outcome: "FINANCE_REJECTED";
      reason:
        SaleReturnEligibilityRejectReason;
      eligibility:
        SaleReturnFinanceEligibility;
    };

export interface SaleReturnFinanceEligibilityDependencies {
  listLocalFinanceTransactions(
    scope: ErpScope,
    customerId: string,
    saleId: string
  ): Promise<FinanceTransaction[]>;

  startSaleReturnWorkflow(
    request: CreateSaleReturnRequest,
    dependencies?:
      SaleReturnWorkflowDependencies
  ): Promise<
    StartSaleReturnWorkflowResult
  >;
}

const defaultDependencies:
  SaleReturnFinanceEligibilityDependencies = {
    listLocalFinanceTransactions,
    startSaleReturnWorkflow
  };

function roundMoney(
  value: number
): number {
  return Math.round(value * 100) / 100;
}

function sameScope(
  transaction: FinanceTransaction,
  scope: ErpScope
): boolean {
  return (
    transaction.tenantId ===
      scope.tenantId &&
    transaction.companyId ===
      scope.companyId &&
    transaction.branchId ===
      scope.branchId &&
    transaction.accountingPeriodId ===
      scope.accountingPeriodId
  );
}

export function calculateSaleReturnEligibility(
  transactions:
    readonly FinanceTransaction[],
  scope: ErpScope,
  customerId: string,
  saleId: string,
  currency: string
): SaleReturnFinanceEligibility {
  const normalizedCurrency =
    currency.trim().toUpperCase();

  const applicable =
    transactions.filter(
      transaction =>
        transaction.status ===
          "POSTED" &&
        transaction.archivedAt ===
          null
    );

  const saleChargeTotal =
    roundMoney(
      applicable
        .filter(
          transaction =>
            transaction.transactionType ===
              "SALE_CHARGE" &&
            transaction.direction ===
              "DEBIT" &&
            transaction.currency ===
              normalizedCurrency
        )
        .reduce(
          (total, transaction) =>
            total +
            transaction.netAmount,
          0
        )
    );

  const refundTotal =
    roundMoney(
      applicable
        .filter(
          transaction =>
            transaction.transactionType ===
              "REFUND" &&
            transaction.direction ===
              "CREDIT" &&
            transaction.sourceDocumentType ===
              "SALE_RETURN" &&
            transaction.currency ===
              normalizedCurrency
        )
        .reduce(
          (total, transaction) =>
            total +
            transaction.netAmount,
          0
        )
    );

  return {
    saleChargeTotal,
    refundTotal,

    returnableAmount:
      roundMoney(
        Math.max(
          0,
          saleChargeTotal -
            refundTotal
        )
      ),

    currency:
      normalizedCurrency
  };
}

function validateTransactions(
  transactions:
    readonly FinanceTransaction[],
  scope: ErpScope,
  customerId: string,
  saleId: string,
  currency: string,
  eligibility:
    SaleReturnFinanceEligibility
): SaleReturnEligibilityRejectReason |
null {
  const posted =
    transactions.filter(
      transaction =>
        transaction.status ===
          "POSTED" &&
        transaction.archivedAt ===
          null
    );

  if (
    posted.some(
      transaction =>
        !sameScope(
          transaction,
          scope
        )
    )
  ) {
    return "FINANCE_SCOPE_MISMATCH";
  }

  if (
    posted.some(
      transaction =>
        transaction.customerId !==
          customerId
    )
  ) {
    return "FINANCE_CUSTOMER_MISMATCH";
  }

  if (
    posted.some(
      transaction =>
        transaction.saleId !==
          saleId
    )
  ) {
    return "FINANCE_SALE_MISMATCH";
  }

  const normalizedCurrency =
    currency.trim().toUpperCase();

  if (
    posted.some(
      transaction =>
        transaction.currency !==
          normalizedCurrency
    )
  ) {
    return "FINANCE_CURRENCY_MISMATCH";
  }

  if (
    eligibility.saleChargeTotal <=
    MONEY_EPSILON
  ) {
    return "NO_POSTED_SALE_CHARGE";
  }

  if (
    eligibility.returnableAmount <=
    MONEY_EPSILON
  ) {
    return "NO_RETURNABLE_AMOUNT";
  }

  return null;
}

export async function startFinanceValidatedSaleReturn(
  request:
    Omit<
      CreateSaleReturnRequest,
      "returnableAmount"
    >,
  workflowDependencies?:
    SaleReturnWorkflowDependencies,
  dependencies:
    SaleReturnFinanceEligibilityDependencies =
      defaultDependencies
): Promise<
  StartFinanceValidatedSaleReturnResult
> {
  const scope: ErpScope = {
    tenantId:
      request.tenantId,
    companyId:
      request.companyId,
    branchId:
      request.branchId,
    accountingPeriodId:
      request.accountingPeriodId
  };

  const transactions =
    await dependencies
      .listLocalFinanceTransactions(
        scope,
        request.customerId,
        request.saleId
      );

  const eligibility =
    calculateSaleReturnEligibility(
      transactions,
      scope,
      request.customerId,
      request.saleId,
      request.currency
    );

  const financeRejectReason =
    validateTransactions(
      transactions,
      scope,
      request.customerId,
      request.saleId,
      request.currency,
      eligibility
    );

  if (financeRejectReason) {
    return {
      outcome:
        "FINANCE_REJECTED",
      reason:
        financeRejectReason,
      eligibility
    };
  }

  if (
    request.amount >
    eligibility.returnableAmount +
      MONEY_EPSILON
  ) {
    return {
      outcome:
        "FINANCE_REJECTED",
      reason:
        "AMOUNT_EXCEEDS_FINANCE_RETURNABLE",
      eligibility
    };
  }

  return dependencies
    .startSaleReturnWorkflow(
      {
        ...request,

        returnableAmount:
          eligibility.returnableAmount
      },

      workflowDependencies
    );
}