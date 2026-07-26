import type { ErpScope } from "./erpScope";

export type FinanceDirection = "DEBIT" | "CREDIT";
export type FinanceTransactionType =
  | "SALE_CHARGE"
  | "PAYMENT_RECEIPT"
  | "DISCOUNT"
  | "REVERSAL";
export type FinanceTransactionStatus = "POSTED" | "REVERSED";

export interface CustomerFinanceTransaction extends ErpScope {
  id: string;
  idempotencyKey: string;
  customerId: string;
  saleId?: string;
  paymentId?: string;
  type: FinanceTransactionType;
  direction: FinanceDirection;
  amount: number;
  status: FinanceTransactionStatus;
  reversesTransactionId?: string;
  description?: string;
  createdByUserId: string;
  createdAt: string;
}

export interface CustomerFinanceAudit {
  id: string;
  transactionId: string;
  action: "POSTED";
  actorUserId: string;
  occurredAt: string;
  customerId: string;
  saleId?: string;
  previousStatus: null;
  nextStatus: "POSTED";
}

export interface CustomerFinanceSummary {
  debitTotal: number;
  creditTotal: number;
  balance: number;
}

export type CustomerFinanceDecision =
  | {
      outcome: "CREATE";
      transaction: CustomerFinanceTransaction;
      audit: CustomerFinanceAudit;
    }
  | {
      outcome: "REPLAY";
      transaction: CustomerFinanceTransaction;
    }
  | {
      outcome: "REJECT";
      reason:
        | "INVALID_REQUEST"
        | "TYPE_DIRECTION_MISMATCH"
        | "IDEMPOTENCY_CONFLICT"
        | "DUPLICATE_PAYMENT"
        | "OVERPAYMENT"
        | "REVERSAL_TARGET_NOT_FOUND"
        | "REVERSAL_SCOPE_MISMATCH"
        | "ALREADY_REVERSED";
    };

const EPSILON = 0.000001;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function sameScope(
  left: ErpScope,
  right: ErpScope
): boolean {
  return (
    left.tenantId === right.tenantId &&
    left.companyId === right.companyId &&
    left.branchId === right.branchId &&
    left.accountingPeriodId === right.accountingPeriodId
  );
}

function samePayload(
  left: CustomerFinanceTransaction,
  right: CustomerFinanceTransaction
): boolean {
  return (
    left.id === right.id &&
    left.customerId === right.customerId &&
    left.saleId === right.saleId &&
    left.paymentId === right.paymentId &&
    left.type === right.type &&
    left.direction === right.direction &&
    roundMoney(left.amount) === roundMoney(right.amount) &&
    left.reversesTransactionId === right.reversesTransactionId &&
    sameScope(left, right)
  );
}

export function summarizeCustomerFinance(
  transactions: CustomerFinanceTransaction[],
  customerId: string,
  saleId?: string
): CustomerFinanceSummary {
  const applicable = transactions.filter(
    (transaction) =>
      transaction.customerId === customerId &&
      transaction.status === "POSTED" &&
      (saleId === undefined || transaction.saleId === saleId)
  );
  const debitTotal = roundMoney(
    applicable
      .filter((transaction) => transaction.direction === "DEBIT")
      .reduce((total, transaction) => total + transaction.amount, 0)
  );
  const creditTotal = roundMoney(
    applicable
      .filter((transaction) => transaction.direction === "CREDIT")
      .reduce((total, transaction) => total + transaction.amount, 0)
  );
  return {
    debitTotal,
    creditTotal,
    balance: roundMoney(debitTotal - creditTotal),
  };
}

export function decideCustomerFinanceTransaction(
  request: CustomerFinanceTransaction,
  existing: CustomerFinanceTransaction[]
): CustomerFinanceDecision {
  const requiredText = [
    request.id,
    request.idempotencyKey,
    request.customerId,
    request.type,
    request.direction,
    request.createdByUserId,
    request.createdAt,
    request.tenantId,
    request.companyId,
    request.branchId,
    request.accountingPeriodId,
  ];
  if (
    requiredText.some((value) => value.trim().length === 0) ||
    !Number.isFinite(request.amount) ||
    request.amount <= 0 ||
    request.status !== "POSTED"
  ) {
    return { outcome: "REJECT", reason: "INVALID_REQUEST" };
  }

  const expectedDirection: Partial<
    Record<FinanceTransactionType, FinanceDirection>
  > = {
    SALE_CHARGE: "DEBIT",
    PAYMENT_RECEIPT: "CREDIT",
    DISCOUNT: "CREDIT",
  };
  if (
    expectedDirection[request.type] &&
    expectedDirection[request.type] !== request.direction
  ) {
    return { outcome: "REJECT", reason: "TYPE_DIRECTION_MISMATCH" };
  }

  const replay = existing.find(
    (transaction) =>
      transaction.idempotencyKey === request.idempotencyKey &&
      sameScope(transaction, request)
  );
  if (replay) {
    return samePayload(request, replay)
      ? { outcome: "REPLAY", transaction: replay }
      : { outcome: "REJECT", reason: "IDEMPOTENCY_CONFLICT" };
  }

  if (
    request.type === "PAYMENT_RECEIPT" &&
    request.paymentId &&
    existing.some(
      (transaction) =>
        transaction.paymentId === request.paymentId &&
        transaction.status === "POSTED" &&
        sameScope(transaction, request)
    )
  ) {
    return { outcome: "REJECT", reason: "DUPLICATE_PAYMENT" };
  }

  if (request.type === "PAYMENT_RECEIPT" && request.saleId) {
    const openBalance = summarizeCustomerFinance(
      existing,
      request.customerId,
      request.saleId
    ).balance;
    if (request.amount > openBalance + EPSILON) {
      return { outcome: "REJECT", reason: "OVERPAYMENT" };
    }
  }

  if (request.type === "REVERSAL") {
    const target = existing.find(
      (transaction) => transaction.id === request.reversesTransactionId
    );
    if (!target) {
      return { outcome: "REJECT", reason: "REVERSAL_TARGET_NOT_FOUND" };
    }
    if (
      !sameScope(target, request) ||
      target.customerId !== request.customerId ||
      target.saleId !== request.saleId ||
      target.direction === request.direction ||
      Math.abs(target.amount - request.amount) > EPSILON
    ) {
      return { outcome: "REJECT", reason: "REVERSAL_SCOPE_MISMATCH" };
    }
    if (
      existing.some(
        (transaction) =>
          transaction.type === "REVERSAL" &&
          transaction.reversesTransactionId === target.id &&
          transaction.status === "POSTED"
      )
    ) {
      return { outcome: "REJECT", reason: "ALREADY_REVERSED" };
    }
  }

  return {
    outcome: "CREATE",
    transaction: {
      ...request,
      amount: roundMoney(request.amount),
    },
    audit: {
      id: `audit-${request.id}`,
      transactionId: request.id,
      action: "POSTED",
      actorUserId: request.createdByUserId,
      occurredAt: request.createdAt,
      customerId: request.customerId,
      saleId: request.saleId,
      previousStatus: null,
      nextStatus: "POSTED",
    },
  };
}
