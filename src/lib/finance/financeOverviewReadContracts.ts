import type { ErpScope } from "@/lib/erpScope";

export type FinanceOverviewDirection = "DEBIT" | "CREDIT";

export interface FinanceOverviewRecentTransaction {
  transactionId: string;
  transactionType: string;
  direction: FinanceOverviewDirection;
  paymentMethod: string | null;
  financeAccountId: string | null;
  counterAccountId: string | null;
  customerId: string | null;
  saleId: string | null;
  sourceDocumentId: string;
  sourceDocumentType: string;
  netAmount: number;
  currency: string;
  transactionDate: string;
  description: string | null;
  createdAt: string;
}

export interface FinanceOverviewSnapshot {
  scope: ErpScope;
  currency: string;
  asOf: string;
  receivables: {
    originalDebtTotal: number;
    allocatedCollectionTotal: number;
    reservedTotal: number;
    openBalance: number;
    unallocatedCreditTotal: number;
    customerNetPosition: number;
    openItemCount: number;
  };
  due: {
    overdueAmount: number;
    dueTodayAmount: number;
    futureAmount: number;
    totalOpenAmount: number;
  };
  payables: {
    accrualTotal: number;
    paymentTotal: number;
    balance: number;
  };
  liquidity: {
    cashBalance: number;
    bankBalance: number;
    posPendingAmount: number;
  };
  recentTransactions: FinanceOverviewRecentTransaction[];
  reconciliation: {
    ok: true;
    reason: null;
  };
}

function record(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(code);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, code: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(code);
  }
  return value;
}

function nullableText(value: unknown, code: string): string | null {
  if (value === null) return null;
  return text(value, code);
}

function money(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(code);
  }
  return value;
}

function signedMoney(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(code);
  }
  return value;
}

function integer(value: unknown, code: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(code);
  }
  return value as number;
}

function isoDateOrTime(value: unknown, code: string): string {
  const raw = text(value, code);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(code);
  }
  return raw;
}

function direction(value: unknown): FinanceOverviewDirection {
  if (value !== "DEBIT" && value !== "CREDIT") {
    throw new Error("FINANCE_OVERVIEW_TRANSACTION_DIRECTION_INVALID");
  }
  return value;
}

export function parseFinanceOverviewSnapshot(
  value: unknown,
): FinanceOverviewSnapshot {
  const root = record(value, "FINANCE_OVERVIEW_SNAPSHOT_INVALID");
  const scope = record(root.scope, "FINANCE_OVERVIEW_SCOPE_INVALID");
  const receivables = record(
    root.receivables,
    "FINANCE_OVERVIEW_RECEIVABLES_INVALID",
  );
  const due = record(root.due, "FINANCE_OVERVIEW_DUE_INVALID");
  const payables = record(root.payables, "FINANCE_OVERVIEW_PAYABLES_INVALID");
  const liquidity = record(root.liquidity, "FINANCE_OVERVIEW_LIQUIDITY_INVALID");
  const reconciliation = record(
    root.reconciliation,
    "FINANCE_OVERVIEW_RECONCILIATION_INVALID",
  );

  if (reconciliation.ok !== true || reconciliation.reason !== null) {
    throw new Error("FINANCE_OVERVIEW_RECONCILIATION_FAILED");
  }

  const currency = text(root.currency, "FINANCE_OVERVIEW_CURRENCY_INVALID");
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("FINANCE_OVERVIEW_CURRENCY_INVALID");
  }

  if (!Array.isArray(root.recentTransactions)) {
    throw new Error("FINANCE_OVERVIEW_RECENT_TRANSACTIONS_INVALID");
  }

  return {
    scope: {
      tenantId: text(scope.tenantId, "FINANCE_OVERVIEW_SCOPE_INVALID"),
      companyId: text(scope.companyId, "FINANCE_OVERVIEW_SCOPE_INVALID"),
      branchId: text(scope.branchId, "FINANCE_OVERVIEW_SCOPE_INVALID"),
      accountingPeriodId: text(
        scope.accountingPeriodId,
        "FINANCE_OVERVIEW_SCOPE_INVALID",
      ),
    },
    currency,
    asOf: isoDateOrTime(root.asOf, "FINANCE_OVERVIEW_AS_OF_INVALID"),
    receivables: {
      originalDebtTotal: money(
        receivables.originalDebtTotal,
        "FINANCE_OVERVIEW_RECEIVABLE_ORIGINAL_INVALID",
      ),
      allocatedCollectionTotal: money(
        receivables.allocatedCollectionTotal,
        "FINANCE_OVERVIEW_RECEIVABLE_ALLOCATED_INVALID",
      ),
      reservedTotal: money(
        receivables.reservedTotal,
        "FINANCE_OVERVIEW_RECEIVABLE_RESERVED_INVALID",
      ),
      openBalance: money(
        receivables.openBalance,
        "FINANCE_OVERVIEW_RECEIVABLE_OPEN_INVALID",
      ),
      unallocatedCreditTotal: money(
        receivables.unallocatedCreditTotal,
        "FINANCE_OVERVIEW_RECEIVABLE_CREDIT_INVALID",
      ),
      customerNetPosition: signedMoney(
        receivables.customerNetPosition,
        "FINANCE_OVERVIEW_RECEIVABLE_NET_INVALID",
      ),
      openItemCount: integer(
        receivables.openItemCount,
        "FINANCE_OVERVIEW_RECEIVABLE_COUNT_INVALID",
      ),
    },
    due: {
      overdueAmount: money(
        due.overdueAmount,
        "FINANCE_OVERVIEW_DUE_OVERDUE_INVALID",
      ),
      dueTodayAmount: money(
        due.dueTodayAmount,
        "FINANCE_OVERVIEW_DUE_TODAY_INVALID",
      ),
      futureAmount: money(
        due.futureAmount,
        "FINANCE_OVERVIEW_DUE_FUTURE_INVALID",
      ),
      totalOpenAmount: money(
        due.totalOpenAmount,
        "FINANCE_OVERVIEW_DUE_TOTAL_INVALID",
      ),
    },
    payables: {
      accrualTotal: money(
        payables.accrualTotal,
        "FINANCE_OVERVIEW_PAYABLE_ACCRUAL_INVALID",
      ),
      paymentTotal: money(
        payables.paymentTotal,
        "FINANCE_OVERVIEW_PAYABLE_PAYMENT_INVALID",
      ),
      balance: signedMoney(
        payables.balance,
        "FINANCE_OVERVIEW_PAYABLE_BALANCE_INVALID",
      ),
    },
    liquidity: {
      cashBalance: signedMoney(
        liquidity.cashBalance,
        "FINANCE_OVERVIEW_CASH_BALANCE_INVALID",
      ),
      bankBalance: signedMoney(
        liquidity.bankBalance,
        "FINANCE_OVERVIEW_BANK_BALANCE_INVALID",
      ),
      posPendingAmount: money(
        liquidity.posPendingAmount,
        "FINANCE_OVERVIEW_POS_PENDING_INVALID",
      ),
    },
    recentTransactions: root.recentTransactions.map((entry) => {
      const row = record(entry, "FINANCE_OVERVIEW_TRANSACTION_INVALID");
      const rowCurrency = text(
        row.currency,
        "FINANCE_OVERVIEW_TRANSACTION_CURRENCY_INVALID",
      );
      if (rowCurrency !== currency) {
        throw new Error("FINANCE_OVERVIEW_TRANSACTION_CURRENCY_MISMATCH");
      }

      return {
        transactionId: text(
          row.transactionId,
          "FINANCE_OVERVIEW_TRANSACTION_ID_INVALID",
        ),
        transactionType: text(
          row.transactionType,
          "FINANCE_OVERVIEW_TRANSACTION_TYPE_INVALID",
        ),
        direction: direction(row.direction),
        paymentMethod: nullableText(
          row.paymentMethod,
          "FINANCE_OVERVIEW_TRANSACTION_PAYMENT_METHOD_INVALID",
        ),
        financeAccountId: nullableText(
          row.financeAccountId,
          "FINANCE_OVERVIEW_TRANSACTION_ACCOUNT_INVALID",
        ),
        counterAccountId: nullableText(
          row.counterAccountId,
          "FINANCE_OVERVIEW_TRANSACTION_COUNTER_ACCOUNT_INVALID",
        ),
        customerId: nullableText(
          row.customerId,
          "FINANCE_OVERVIEW_TRANSACTION_CUSTOMER_INVALID",
        ),
        saleId: nullableText(
          row.saleId,
          "FINANCE_OVERVIEW_TRANSACTION_SALE_INVALID",
        ),
        sourceDocumentId: text(
          row.sourceDocumentId,
          "FINANCE_OVERVIEW_TRANSACTION_SOURCE_INVALID",
        ),
        sourceDocumentType: text(
          row.sourceDocumentType,
          "FINANCE_OVERVIEW_TRANSACTION_SOURCE_TYPE_INVALID",
        ),
        netAmount: money(
          row.netAmount,
          "FINANCE_OVERVIEW_TRANSACTION_AMOUNT_INVALID",
        ),
        currency: rowCurrency,
        transactionDate: text(
          row.transactionDate,
          "FINANCE_OVERVIEW_TRANSACTION_DATE_INVALID",
        ),
        description: nullableText(
          row.description,
          "FINANCE_OVERVIEW_TRANSACTION_DESCRIPTION_INVALID",
        ),
        createdAt: isoDateOrTime(
          row.createdAt,
          "FINANCE_OVERVIEW_TRANSACTION_CREATED_AT_INVALID",
        ),
      };
    }),
    reconciliation: {
      ok: true,
      reason: null,
    },
  };
}
