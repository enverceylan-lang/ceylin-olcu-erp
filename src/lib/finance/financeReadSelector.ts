import type { ErpScope } from "@/lib/erpScope";
import { erpScopeMatches } from "@/lib/erpScope";
import type { ErpPackage } from "@/lib/packageFeatures";
import type { Sale } from "@/store/salesStore";
import {
  decideFinanceAccess,
  type FinanceAccessDecision,
  type FinanceCapability,
  type FinancePermission,
} from "./financeAccessPolicy";
import type {
  FinanceTransaction,
  SaleFinanceProjectionIssue,
  SaleFinanceProjectionResult,
} from "./financeContracts";
import { projectSaleFinance } from "./saleFinanceProjection";

export interface FinanceReadSelectorInput {
  scope: ErpScope;
  packageType: ErpPackage;
  permissions: readonly FinancePermission[];
  requestedCapability: FinanceCapability;
  sales?: readonly Sale[];
  projectionResults?: readonly SaleFinanceProjectionResult[];
  customerId?: string;
  saleId?: string;
  projectionAt: string;
  currency: string;
}

export interface FinanceReadAppliedFilters {
  scope: ErpScope;
  customerId: string | null;
  saleId: string | null;
}

export interface FinanceReadSummary {
  debitTotal: number;
  creditTotal: number;
  balance: number;
  transactionCount: number;
  issueCount: number;
}

export interface FinanceReadIssue {
  code:
    | SaleFinanceProjectionIssue["code"]
    | "ACCESS_DENIED"
    | "SCOPE_MISMATCH"
    | "DUPLICATE_TRANSACTION_ID";
  severity: "ERROR" | "WARNING";
  message: string;
  saleId: string | null;
  paymentId: string | null;
  expected: number | string | null;
  actual: number | string | null;
}

export interface FinanceReadSelectorResult {
  transactions: FinanceTransaction[];
  issues: FinanceReadIssue[];
  summary: FinanceReadSummary;
  accessDecision: FinanceAccessDecision;
  appliedFilters: FinanceReadAppliedFilters;
  excludedCount: number;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function emptySummary(issueCount: number): FinanceReadSummary {
  return {
    debitTotal: 0,
    creditTotal: 0,
    balance: 0,
    transactionCount: 0,
    issueCount,
  };
}

function selectorIssue(
  code: Extract<
    FinanceReadIssue["code"],
    "ACCESS_DENIED" | "SCOPE_MISMATCH" | "DUPLICATE_TRANSACTION_ID"
  >,
  message: string,
  actual: string | null = null,
): FinanceReadIssue {
  return {
    code,
    severity: "ERROR",
    message,
    saleId: null,
    paymentId: null,
    expected: null,
    actual,
  };
}

export function selectFinanceReadModel(
  input: FinanceReadSelectorInput,
): FinanceReadSelectorResult {
  const appliedFilters: FinanceReadAppliedFilters = {
    scope: { ...input.scope },
    customerId: input.customerId || null,
    saleId: input.saleId || null,
  };
  const accessDecision = decideFinanceAccess({
    packageType: input.packageType,
    permissions: input.permissions,
    scope: input.scope,
    requestedCapability: input.requestedCapability,
    financeContext: {
      scope: input.scope,
      customerId: input.customerId,
      saleId: input.saleId,
    },
  });

  if (!accessDecision.allowed) {
    const issues = [
      selectorIssue(
        "ACCESS_DENIED",
        `Finans erişimi reddedildi: ${accessDecision.reasonCode}`,
        accessDecision.reasonCode,
      ),
    ];
    return {
      transactions: [],
      issues,
      summary: emptySummary(issues.length),
      accessDecision,
      appliedFilters,
      excludedCount: 0,
    };
  }

  const generatedProjections = (input.sales || []).map((sale) =>
    projectSaleFinance({
      sale,
      scope: input.scope,
      currency: input.currency,
      projectionAt: input.projectionAt,
    }),
  );
  const projections = [
    ...generatedProjections,
    ...(input.projectionResults || []),
  ];
  const transactions: FinanceTransaction[] = [];
  const issues: FinanceReadIssue[] = [];
  let excludedCount = 0;

  for (const projection of projections) {
    if (!erpScopeMatches(input.scope, projection.scope)) {
      excludedCount += projection.transactions.length;
      issues.push(
        selectorIssue(
          "SCOPE_MISMATCH",
          "Kapsam dışı projection sonucu filtrelendi.",
        ),
      );
      continue;
    }

    const customerMatches =
      !input.customerId || projection.customerId === input.customerId;
    const saleMatches = !input.saleId || projection.saleId === input.saleId;
    if (!customerMatches || !saleMatches) {
      excludedCount += projection.transactions.length;
      continue;
    }

    for (const transaction of projection.transactions) {
      if (!erpScopeMatches(input.scope, transaction)) {
        excludedCount += 1;
        issues.push(
          selectorIssue(
            "SCOPE_MISMATCH",
            "Kapsam dışı finans hareketi filtrelendi.",
          ),
        );
        continue;
      }
      if (
        (input.customerId && transaction.customerId !== input.customerId) ||
        (input.saleId && transaction.saleId !== input.saleId)
      ) {
        excludedCount += 1;
        continue;
      }
      transactions.push(transaction);
    }
    issues.push(...projection.issues);
  }

  const transactionIds = new Set<string>();
  for (const transaction of transactions) {
    if (transactionIds.has(transaction.id)) {
      issues.push(
        selectorIssue(
          "DUPLICATE_TRANSACTION_ID",
          "Aynı transaction id birden fazla kez bulundu; hareketler birleştirilmedi.",
          transaction.id,
        ),
      );
    }
    transactionIds.add(transaction.id);
  }

  const debitTotal = roundMoney(
    transactions
      .filter((transaction) => transaction.direction === "DEBIT")
      .reduce((total, transaction) => total + transaction.netAmount, 0),
  );
  const creditTotal = roundMoney(
    transactions
      .filter((transaction) => transaction.direction === "CREDIT")
      .reduce((total, transaction) => total + transaction.netAmount, 0),
  );

  return {
    transactions,
    issues,
    summary: {
      debitTotal,
      creditTotal,
      balance: roundMoney(debitTotal - creditTotal),
      transactionCount: transactions.length,
      issueCount: issues.length,
    },
    accessDecision,
    appliedFilters,
    excludedCount,
  };
}
