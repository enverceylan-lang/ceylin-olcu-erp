import type {
  ErpScope
} from "@/lib/erpScope";

import type {
  FinanceTransaction
} from "@/lib/finance/financeContracts";

import {
  calculateCustomerFinanceSummary,
  type CustomerFinanceSummaryRejectReason
} from "@/lib/finance/customerFinanceSummaryService";

export type CustomerFinanceDueBucket =
  | "VADESIZ"
  | "GECIKMIS"
  | "BUGUN"
  | "GELECEK";

export interface CustomerFinanceDueLine {
  transactionId: string;
  saleId: string | null;
  sourceDocumentId: string;
  dueDate: string | null;
  remainingAmount: number;
  bucket: CustomerFinanceDueBucket;
}

export interface CustomerFinanceDueSummary {
  customerId: string;
  currency: string;
  asOfDate: string;

  undatedAmount: number;
  overdueAmount: number;
  dueTodayAmount: number;
  futureAmount: number;
  totalOpenAmount: number;

  lines: CustomerFinanceDueLine[];
}

export type CustomerFinanceDueSummaryResult =
  | {
      outcome: "CALCULATED";
      summary:
        CustomerFinanceDueSummary;
    }
  | {
      outcome: "REJECTED";
      reason:
        | CustomerFinanceSummaryRejectReason
        | "AS_OF_DATE_INVALID"
        | "SALE_CHARGE_SALE_ID_REQUIRED"
        | "CREDIT_EXCEEDS_OPEN_DEBT";
    };

interface OpenDebit {
  transactionId: string;
  saleId: string | null;
  sourceDocumentId: string;
  dueDate: string | null;
  remainingAmount: number;
}

function roundMoney(
  value: number
): number {
  return Math.round(value * 100) / 100;
}

function isIsoDate(
  value: string
): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  );
}

function compareTransactions(
  left: FinanceTransaction,
  right: FinanceTransaction
): number {
  const dateCompare =
    left.transactionDate.localeCompare(
      right.transactionDate
    );

  if (dateCompare !== 0) {
    return dateCompare;
  }

  const createdCompare =
    left.createdAt.localeCompare(
      right.createdAt
    );

  if (createdCompare !== 0) {
    return createdCompare;
  }

  return left.transactionId.localeCompare(
    right.transactionId
  );
}

function bucketFor(
  dueDate: string | null,
  asOfDate: string
): CustomerFinanceDueBucket {
  if (dueDate === null) {
    return "VADESIZ";
  }

  if (dueDate < asOfDate) {
    return "GECIKMIS";
  }

  if (dueDate === asOfDate) {
    return "BUGUN";
  }

  return "GELECEK";
}

export function calculateCustomerFinanceDueSummary(
  transactions:
    readonly FinanceTransaction[],
  scope: ErpScope,
  customerId: string,
  currency: string,
  asOfDate: string
): CustomerFinanceDueSummaryResult {
  if (!isIsoDate(asOfDate)) {
    return {
      outcome: "REJECTED",
      reason: "AS_OF_DATE_INVALID"
    };
  }

  const validation =
    calculateCustomerFinanceSummary(
      transactions,
      scope,
      customerId,
      currency
    );

  if (
    validation.outcome ===
    "REJECTED"
  ) {
    return validation;
  }

  const activePostedTransactions =
    transactions
      .filter(
        transaction =>
          transaction.status ===
            "POSTED" &&
          transaction.archivedAt ===
            null &&
          transaction.reversedAt ===
            null
      )
      .slice()
      .sort(compareTransactions);

  const openDebits:
    OpenDebit[] = [];

  for (
    const transaction of
    activePostedTransactions
  ) {
    if (
      transaction.direction ===
      "DEBIT"
    ) {
      if (
        transaction.transactionType ===
          "SALE_CHARGE" &&
        transaction.saleId === null
      ) {
        return {
          outcome: "REJECTED",
          reason:
            "SALE_CHARGE_SALE_ID_REQUIRED"
        };
      }

      openDebits.push({
        transactionId:
          transaction.transactionId,

        saleId:
          transaction.saleId,

        sourceDocumentId:
          transaction.sourceDocumentId,

        dueDate:
          transaction.dueDate,

        remainingAmount:
          roundMoney(
            transaction.netAmount
          )
      });

      continue;
    }

    let creditRemaining =
      roundMoney(
        transaction.netAmount
      );

    for (
      const openDebit of
      openDebits
    ) {
      if (creditRemaining <= 0) {
        break;
      }

      if (
        openDebit.remainingAmount <= 0
      ) {
        continue;
      }

      const appliedAmount =
        Math.min(
          openDebit.remainingAmount,
          creditRemaining
        );

      openDebit.remainingAmount =
        roundMoney(
          openDebit.remainingAmount -
            appliedAmount
        );

      creditRemaining =
        roundMoney(
          creditRemaining -
            appliedAmount
        );
    }

    if (creditRemaining > 0) {
      return {
        outcome: "REJECTED",
        reason:
          "CREDIT_EXCEEDS_OPEN_DEBT"
      };
    }
  }

  const lines =
    openDebits
      .filter(
        debit =>
          debit.remainingAmount > 0
      )
      .map(
        debit => ({
          transactionId:
            debit.transactionId,

          saleId:
            debit.saleId,

          sourceDocumentId:
            debit.sourceDocumentId,

          dueDate:
            debit.dueDate,

          remainingAmount:
            debit.remainingAmount,

          bucket:
            bucketFor(
              debit.dueDate,
              asOfDate
            )
        })
      );

  let undatedAmount = 0;
  let overdueAmount = 0;
  let dueTodayAmount = 0;
  let futureAmount = 0;

  for (const line of lines) {
    if (line.bucket === "VADESIZ") {
      undatedAmount +=
        line.remainingAmount;
    }
    else if (
      line.bucket === "GECIKMIS"
    ) {
      overdueAmount +=
        line.remainingAmount;
    }
    else if (
      line.bucket === "BUGUN"
    ) {
      dueTodayAmount +=
        line.remainingAmount;
    }
    else {
      futureAmount +=
        line.remainingAmount;
    }
  }

  const totalOpenAmount =
    roundMoney(
      undatedAmount +
      overdueAmount +
      dueTodayAmount +
      futureAmount
    );

  return {
    outcome: "CALCULATED",

    summary: {
      customerId:
        validation.summary.customerId,

      currency:
        validation.summary.currency,

      asOfDate,

      undatedAmount:
        roundMoney(
          undatedAmount
        ),

      overdueAmount:
        roundMoney(
          overdueAmount
        ),

      dueTodayAmount:
        roundMoney(
          dueTodayAmount
        ),

      futureAmount:
        roundMoney(
          futureAmount
        ),

      totalOpenAmount,

      lines
    }
  };
}