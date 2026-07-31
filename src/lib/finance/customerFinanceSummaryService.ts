import type {
  ErpScope
} from "@/lib/erpScope";

import type {
  FinanceTransaction
} from "@/lib/finance/financeContracts";

const MONEY_EPSILON = 0.000001;

export type CustomerFinancePosition =
  | "BORCLU"
  | "ALACAKLI"
  | "KAPALI";

export type CustomerFinanceSummaryRejectReason =
  | "SCOPE_REQUIRED"
  | "CUSTOMER_ID_REQUIRED"
  | "CURRENCY_INVALID"
  | "FINANCE_SCOPE_MISMATCH"
  | "FINANCE_CUSTOMER_MISMATCH"
  | "FINANCE_CURRENCY_MISMATCH"
  | "FINANCE_AMOUNT_INVALID";

export interface CustomerFinanceSummary {
  customerId: string;
  currency: string;

  debitTotal: number;
  creditTotal: number;
  balance: number;

  saleChargeTotal: number;
  collectionTotal: number;
  refundTotal: number;
  otherDebitTotal: number;
  otherCreditTotal: number;

  postedTransactionCount: number;
  position: CustomerFinancePosition;
}

export type CustomerFinanceSummaryResult =
  | {
      outcome: "CALCULATED";
      summary: CustomerFinanceSummary;
    }
  | {
      outcome: "REJECTED";
      reason:
        CustomerFinanceSummaryRejectReason;
    };

function hasText(
  value: string
): boolean {
  return value.trim().length > 0;
}

function isValidScope(
  scope: ErpScope
): boolean {
  return (
    hasText(scope.tenantId) &&
    hasText(scope.companyId) &&
    hasText(scope.branchId) &&
    hasText(
      scope.accountingPeriodId
    )
  );
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

function roundMoney(
  value: number
): number {
  return Math.round(
    value * 100
  ) / 100;
}

function positionFor(
  balance: number
): CustomerFinancePosition {
  if (balance > MONEY_EPSILON) {
    return "BORCLU";
  }

  if (balance < -MONEY_EPSILON) {
    return "ALACAKLI";
  }

  return "KAPALI";
}

export function calculateCustomerFinanceSummary(
  transactions:
    readonly FinanceTransaction[],
  scope: ErpScope,
  customerId: string,
  currency: string
): CustomerFinanceSummaryResult {
  if (!isValidScope(scope)) {
    return {
      outcome: "REJECTED",
      reason: "SCOPE_REQUIRED"
    };
  }

  const normalizedCustomerId =
    customerId.trim();

  if (
    normalizedCustomerId.length ===
    0
  ) {
    return {
      outcome: "REJECTED",
      reason:
        "CUSTOMER_ID_REQUIRED"
    };
  }

  const normalizedCurrency =
    currency.trim().toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(
      normalizedCurrency
    )
  ) {
    return {
      outcome: "REJECTED",
      reason:
        "CURRENCY_INVALID"
    };
  }

  const activePostedTransactions =
    transactions.filter(
      transaction =>
        transaction.status ===
          "POSTED" &&
        transaction.archivedAt ===
          null &&
        transaction.reversedAt ===
          null
    );

  if (
    activePostedTransactions.some(
      transaction =>
        !sameScope(
          transaction,
          scope
        )
    )
  ) {
    return {
      outcome: "REJECTED",
      reason:
        "FINANCE_SCOPE_MISMATCH"
    };
  }

  if (
    activePostedTransactions.some(
      transaction =>
        transaction.customerId !==
          normalizedCustomerId
    )
  ) {
    return {
      outcome: "REJECTED",
      reason:
        "FINANCE_CUSTOMER_MISMATCH"
    };
  }

  if (
    activePostedTransactions.some(
      transaction =>
        transaction.currency !==
          normalizedCurrency
    )
  ) {
    return {
      outcome: "REJECTED",
      reason:
        "FINANCE_CURRENCY_MISMATCH"
    };
  }

  if (
    activePostedTransactions.some(
      transaction =>
        !Number.isFinite(
          transaction.netAmount
        ) ||
        transaction.netAmount <= 0
    )
  ) {
    return {
      outcome: "REJECTED",
      reason:
        "FINANCE_AMOUNT_INVALID"
    };
  }

  let debitTotal = 0;
  let creditTotal = 0;

  let saleChargeTotal = 0;
  let collectionTotal = 0;
  let refundTotal = 0;

  let otherDebitTotal = 0;
  let otherCreditTotal = 0;

  for (
    const transaction of
    activePostedTransactions
  ) {
    const amount =
      transaction.netAmount;

    if (
      transaction.direction ===
      "DEBIT"
    ) {
      debitTotal += amount;

      if (
        transaction.transactionType ===
        "SALE_CHARGE"
      ) {
        saleChargeTotal += amount;
      }
      else {
        otherDebitTotal += amount;
      }

      continue;
    }

    creditTotal += amount;

    if (
      transaction.transactionType ===
      "COLLECTION"
    ) {
      collectionTotal += amount;
    }
    else if (
      transaction.transactionType ===
      "REFUND"
    ) {
      refundTotal += amount;
    }
    else {
      otherCreditTotal += amount;
    }
  }

  debitTotal =
    roundMoney(debitTotal);

  creditTotal =
    roundMoney(creditTotal);

  const balance =
    roundMoney(
      debitTotal -
      creditTotal
    );

  return {
    outcome: "CALCULATED",

    summary: {
      customerId:
        normalizedCustomerId,

      currency:
        normalizedCurrency,

      debitTotal,
      creditTotal,
      balance,

      saleChargeTotal:
        roundMoney(
          saleChargeTotal
        ),

      collectionTotal:
        roundMoney(
          collectionTotal
        ),

      refundTotal:
        roundMoney(
          refundTotal
        ),

      otherDebitTotal:
        roundMoney(
          otherDebitTotal
        ),

      otherCreditTotal:
        roundMoney(
          otherCreditTotal
        ),

      postedTransactionCount:
        activePostedTransactions.length,

      position:
        positionFor(balance)
    }
  };
}