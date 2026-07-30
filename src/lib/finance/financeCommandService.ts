import type { ErpScope } from "@/lib/erpScope";
import {
  appendLocalFinanceTransaction,
  listLocalFinanceTransactions,
  type LocalFinanceWriteResult
} from "@/lib/localFinanceDb";
import type {
  FinanceTransaction
} from "@/lib/finance/financeContracts";

const MONEY_EPSILON = 0.000001;

export type FinanceCommandRejectReason =
  | "UNSUPPORTED_TRANSACTION_TYPE"
  | "TYPE_DIRECTION_MISMATCH"
  | "DUPLICATE_SOURCE_DOCUMENT"
  | "OVERPAYMENT"
  | "IDEMPOTENCY_CONFLICT"
  | "AUDIT_MISSING"
  | "INVALID_TRANSACTION";

export type FinanceCommandResult =
  | {
      outcome: "CREATED";
      transaction: FinanceTransaction;
    }
  | {
      outcome: "REPLAY";
      transaction: FinanceTransaction;
    }
  | {
      outcome: "REJECT";
      reason: FinanceCommandRejectReason;
    };

function getScope(
  transaction: FinanceTransaction
): ErpScope {
  return {
    tenantId: transaction.tenantId,
    companyId: transaction.companyId,
    branchId: transaction.branchId,
    accountingPeriodId:
      transaction.accountingPeriodId
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function expectedDirection(
  transaction: FinanceTransaction
): "DEBIT" | "CREDIT" | null {
  if (transaction.transactionType === "SALE_CHARGE") {
    return "DEBIT";
  }

  if (transaction.transactionType === "COLLECTION") {
    return "CREDIT";
  }

  if (transaction.transactionType === "REFUND") {
    return "CREDIT";
  }

  return null;
}

function calculateOpenBalance(
  transactions: FinanceTransaction[]
): number {
  const posted = transactions.filter(
    transaction =>
      transaction.status === "POSTED" &&
      transaction.archivedAt === null
  );

  const debit = posted
    .filter(transaction => transaction.direction === "DEBIT")
    .reduce(
      (total, transaction) =>
        total + transaction.netAmount,
      0
    );

  const credit = posted
    .filter(transaction => transaction.direction === "CREDIT")
    .reduce(
      (total, transaction) =>
        total + transaction.netAmount,
      0
    );

  return roundMoney(debit - credit);
}

function mapWriteResult(
  result: LocalFinanceWriteResult
): FinanceCommandResult {
  if (result.outcome === "CREATED") {
    return {
      outcome: "CREATED",
      transaction: result.transaction
    };
  }

  return {
    outcome: "REPLAY",
    transaction: result.transaction
  };
}

function mapWriteError(
  error: unknown
): FinanceCommandResult {
  const message =
    error instanceof Error ? error.message : "";

  if (message === "FINANCE_IDEMPOTENCY_CONFLICT") {
    return {
      outcome: "REJECT",
      reason: "IDEMPOTENCY_CONFLICT"
    };
  }

  if (message === "FINANCE_AUDIT_MISSING") {
    return {
      outcome: "REJECT",
      reason: "AUDIT_MISSING"
    };
  }

  return {
    outcome: "REJECT",
    reason: "INVALID_TRANSACTION"
  };
}

export async function executeFinanceCommand(
  transaction: FinanceTransaction
): Promise<FinanceCommandResult> {
  const direction =
    expectedDirection(transaction);

  if (!direction) {
    return {
      outcome: "REJECT",
      reason: "UNSUPPORTED_TRANSACTION_TYPE"
    };
  }

  if (transaction.direction !== direction) {
    return {
      outcome: "REJECT",
      reason: "TYPE_DIRECTION_MISMATCH"
    };
  }

  const existing =
    await listLocalFinanceTransactions(
      getScope(transaction),
      transaction.customerId,
      transaction.saleId
    );

  const replayCandidate = existing.find(
    item =>
      item.idempotencyKey ===
      transaction.idempotencyKey
  );

  if (replayCandidate) {
    try {
      return mapWriteResult(
        await appendLocalFinanceTransaction(
          transaction
        )
      );
    } catch (error) {
      return mapWriteError(error);
    }
  }

  if (
    transaction.transactionType === "COLLECTION" &&
    transaction.sourceDocumentType === "SALE_PAYMENT"
  ) {
    const duplicateSourceDocument =
      existing.some(
        item =>
          item.transactionType === "COLLECTION" &&
          item.sourceDocumentType === "SALE_PAYMENT" &&
          item.sourceDocumentId ===
            transaction.sourceDocumentId &&
          item.status === "POSTED" &&
          item.archivedAt === null
      );

    if (duplicateSourceDocument) {
      return {
        outcome: "REJECT",
        reason: "DUPLICATE_SOURCE_DOCUMENT"
      };
    }

    const openBalance =
      calculateOpenBalance(existing);

    if (
      transaction.netAmount >
      openBalance + MONEY_EPSILON
    ) {
      return {
        outcome: "REJECT",
        reason: "OVERPAYMENT"
      };
    }
  }

  if (
    transaction.transactionType === "REFUND"
  ) {
    if (
      transaction.sourceDocumentType !==
        "SALE_RETURN" ||
      transaction.projectionSource !==
        "SALE_RETURN"
    ) {
      return {
        outcome: "REJECT",
        reason: "INVALID_TRANSACTION"
      };
    }

    const duplicateReturnDocument =
      existing.some(
        item =>
          item.transactionType === "REFUND" &&
          item.sourceDocumentType ===
            "SALE_RETURN" &&
          item.sourceDocumentId ===
            transaction.sourceDocumentId &&
          item.status === "POSTED" &&
          item.archivedAt === null
      );

    if (duplicateReturnDocument) {
      return {
        outcome: "REJECT",
        reason:
          "DUPLICATE_SOURCE_DOCUMENT"
      };
    }

    const postedSaleChargeTotal =
      roundMoney(
        existing
          .filter(
            item =>
              item.transactionType ===
                "SALE_CHARGE" &&
              item.direction === "DEBIT" &&
              item.status === "POSTED" &&
              item.archivedAt === null
          )
          .reduce(
            (total, item) =>
              total + item.netAmount,
            0
          )
      );

    const postedRefundTotal =
      roundMoney(
        existing
          .filter(
            item =>
              item.transactionType ===
                "REFUND" &&
              item.direction === "CREDIT" &&
              item.sourceDocumentType ===
                "SALE_RETURN" &&
              item.status === "POSTED" &&
              item.archivedAt === null
          )
          .reduce(
            (total, item) =>
              total + item.netAmount,
            0
          )
      );

    const remainingReturnableAmount =
      roundMoney(
        postedSaleChargeTotal -
        postedRefundTotal
      );

    if (
      transaction.netAmount >
      remainingReturnableAmount +
        MONEY_EPSILON
    ) {
      return {
        outcome: "REJECT",
        reason: "OVERPAYMENT"
      };
    }
  }

  try {
    return mapWriteResult(
      await appendLocalFinanceTransaction(
        transaction
      )
    );
  } catch (error) {
    return mapWriteError(error);
  }
}
