import type { ErpScope } from "@/lib/erpScope";
import type { FinanceTransaction, FinanceTransactionType } from "@/lib/finance/financeContracts";
import {
  calculateCustomerFinanceSummary,
  type CustomerFinanceSummary
} from "@/lib/finance/customerFinanceSummaryService";

export type CustomerFinanceStatementRejectReason =
  | "SCOPE_REQUIRED"
  | "CUSTOMER_ID_REQUIRED"
  | "CURRENCY_INVALID"
  | "FINANCE_SCOPE_MISMATCH"
  | "FINANCE_CUSTOMER_MISMATCH"
  | "FINANCE_CURRENCY_MISMATCH"
  | "FINANCE_AMOUNT_INVALID";

export interface CustomerFinanceStatementLine {
  transactionId: string;
  transactionType: FinanceTransactionType;
  transactionDate: string;
  description: string | null;
  sourceDocumentId: string;
  sourceDocumentType: FinanceTransaction["sourceDocumentType"];
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
  createdAt: string;
}

export interface CustomerFinanceStatement {
  customerId: string;
  currency: string;
  openingBalance: number;
  closingBalance: number;
  lines: CustomerFinanceStatementLine[];
  summary: CustomerFinanceSummary;
}

export type CustomerFinanceStatementResult =
  | { outcome: "CALCULATED"; statement: CustomerFinanceStatement }
  | { outcome: "REJECTED"; reason: CustomerFinanceStatementRejectReason };

function compareTransactions(left: FinanceTransaction, right: FinanceTransaction): number {
  const dateCompare = left.transactionDate.localeCompare(right.transactionDate);
  if (dateCompare !== 0) return dateCompare;

  const createdCompare = left.createdAt.localeCompare(right.createdAt);
  if (createdCompare !== 0) return createdCompare;

  return left.transactionId.localeCompare(right.transactionId);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateCustomerFinanceStatement(
  transactions: readonly FinanceTransaction[],
  scope: ErpScope,
  customerId: string,
  currency: string
): CustomerFinanceStatementResult {
  const summaryResult = calculateCustomerFinanceSummary(
    transactions,
    scope,
    customerId,
    currency
  );

  if (summaryResult.outcome === "REJECTED") return summaryResult;

  const activePostedTransactions = transactions
    .filter(
      transaction =>
        transaction.status === "POSTED" &&
        transaction.archivedAt === null &&
        transaction.reversedAt === null
    )
    .slice()
    .sort(compareTransactions);

  let runningBalance = 0;

  const lines = activePostedTransactions.map(transaction => {
    const debitAmount = transaction.direction === "DEBIT" ? transaction.netAmount : 0;
    const creditAmount = transaction.direction === "CREDIT" ? transaction.netAmount : 0;

    runningBalance = roundMoney(runningBalance + debitAmount - creditAmount);

    return {
      transactionId: transaction.transactionId,
      transactionType: transaction.transactionType,
      transactionDate: transaction.transactionDate,
      description: transaction.description,
      sourceDocumentId: transaction.sourceDocumentId,
      sourceDocumentType: transaction.sourceDocumentType,
      debitAmount: roundMoney(debitAmount),
      creditAmount: roundMoney(creditAmount),
      runningBalance,
      createdAt: transaction.createdAt
    };
  });

  return {
    outcome: "CALCULATED",
    statement: {
      customerId: summaryResult.summary.customerId,
      currency: summaryResult.summary.currency,
      openingBalance: 0,
      closingBalance: summaryResult.summary.balance,
      lines,
      summary: summaryResult.summary
    }
  };
}