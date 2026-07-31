import type {
  ErpScope
} from "@/lib/erpScope";

import type {
  FinanceTransaction
} from "@/lib/finance/financeContracts";

import {
  calculateCustomerFinanceSummary,
  type CustomerFinanceSummary,
  type CustomerFinanceSummaryRejectReason
} from "@/lib/finance/customerFinanceSummaryService";

import {
  calculateCustomerFinanceStatement,
  type CustomerFinanceStatement
} from "@/lib/finance/customerFinanceStatementService";

import {
  calculateCustomerFinanceDueSummary,
  type CustomerFinanceDueSummary
} from "@/lib/finance/customerFinanceDueSummaryService";

export type CustomerFinanceDashboardRiskLevel =
  | "TEMIZ"
  | "IZLE"
  | "RISKLI";

export interface CustomerFinanceDashboard {
  customerId: string;
  currency: string;
  asOfDate: string;

  summary: CustomerFinanceSummary;
  statement: CustomerFinanceStatement;
  due: CustomerFinanceDueSummary;

  riskLevel:
    CustomerFinanceDashboardRiskLevel;

  hasOverdueDebt: boolean;
  hasDueTodayDebt: boolean;
  hasFutureDebt: boolean;
}

export type CustomerFinanceDashboardRejectReason =
  | CustomerFinanceSummaryRejectReason
  | "AS_OF_DATE_INVALID"
  | "SALE_CHARGE_SALE_ID_REQUIRED"
  | "CREDIT_EXCEEDS_OPEN_DEBT"
  | "SUMMARY_STATEMENT_MISMATCH"
  | "SUMMARY_DUE_MISMATCH";

export type CustomerFinanceDashboardResult =
  | {
      outcome: "CALCULATED";
      dashboard:
        CustomerFinanceDashboard;
    }
  | {
      outcome: "REJECTED";
      reason:
        CustomerFinanceDashboardRejectReason;
    };

function riskLevelFor(
  overdueAmount: number,
  dueTodayAmount: number
): CustomerFinanceDashboardRiskLevel {
  if (overdueAmount > 0) {
    return "RISKLI";
  }

  if (dueTodayAmount > 0) {
    return "IZLE";
  }

  return "TEMIZ";
}

export function calculateCustomerFinanceDashboard(
  transactions:
    readonly FinanceTransaction[],
  scope: ErpScope,
  customerId: string,
  currency: string,
  asOfDate: string
): CustomerFinanceDashboardResult {
  const summaryResult =
    calculateCustomerFinanceSummary(
      transactions,
      scope,
      customerId,
      currency
    );

  if (
    summaryResult.outcome ===
    "REJECTED"
  ) {
    return summaryResult;
  }

  const statementResult =
    calculateCustomerFinanceStatement(
      transactions,
      scope,
      customerId,
      currency
    );

  if (
    statementResult.outcome ===
    "REJECTED"
  ) {
    return statementResult;
  }

  const dueResult =
    calculateCustomerFinanceDueSummary(
      transactions,
      scope,
      customerId,
      currency,
      asOfDate
    );

  if (
    dueResult.outcome ===
    "REJECTED"
  ) {
    return dueResult;
  }

  if (
    summaryResult.summary.balance !==
      statementResult.statement
        .closingBalance
  ) {
    return {
      outcome: "REJECTED",
      reason:
        "SUMMARY_STATEMENT_MISMATCH"
    };
  }

  if (
    summaryResult.summary.balance !==
      dueResult.summary.totalOpenAmount
  ) {
    return {
      outcome: "REJECTED",
      reason:
        "SUMMARY_DUE_MISMATCH"
    };
  }

  const overdueAmount =
    dueResult.summary.overdueAmount;

  const dueTodayAmount =
    dueResult.summary.dueTodayAmount;

  const futureAmount =
    dueResult.summary.futureAmount;

  return {
    outcome: "CALCULATED",

    dashboard: {
      customerId:
        summaryResult.summary.customerId,

      currency:
        summaryResult.summary.currency,

      asOfDate,

      summary:
        summaryResult.summary,

      statement:
        statementResult.statement,

      due:
        dueResult.summary,

      riskLevel:
        riskLevelFor(
          overdueAmount,
          dueTodayAmount
        ),

      hasOverdueDebt:
        overdueAmount > 0,

      hasDueTodayDebt:
        dueTodayAmount > 0,

      hasFutureDebt:
        futureAmount > 0
    }
  };
}