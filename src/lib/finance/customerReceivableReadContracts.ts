export type CustomerReceivableOpenItemStatus =
  | "OPEN"
  | "PARTIAL"
  | "CLOSED"
  | "REVERSED";

export interface CustomerReceivableOpenItem {
  id: string;
  saleId: string;
  installmentId: string | null;
  documentNumber: string;
  sequenceNo: number;
  dueDate: string;
  originalAmount: number;
  allocatedAmount: number;
  reservedAmount: number;
  remainingAmount: number;
  status: CustomerReceivableOpenItemStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerReceivableAllocation {
  id: string;
  operationId: string;
  transactionId: string;
  openItemId: string;
  saleId: string;
  installmentId: string | null;
  amount: number;
  reversedAt: string | null;
  createdAt: string;
}

export interface CustomerReceivableTransactionMetadata {
  transactionId: string;
  paymentMethod: string | null;
  description: string | null;
  transactionDate: string;
  createdAt: string;
  status: string;
  reversedAt: string | null;
}

export interface CustomerReceivableSnapshot {
  customerId: string;
  currency: string;
  asOf: string;
  summary: {
    originalDebtTotal: number;
    allocatedCollectionTotal: number;
    reservedTotal: number;
    currentBalance: number;
    openItemCount: number;
    closedItemCount: number;
  };
  due: {
    overdueAmount: number;
    dueTodayAmount: number;
    futureAmount: number;
    totalOpenAmount: number;
  };
  openItems: CustomerReceivableOpenItem[];
  allocations: CustomerReceivableAllocation[];
  transactionMetadata: CustomerReceivableTransactionMetadata[];
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

function integer(value: unknown, code: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(code);
  }
  return value as number;
}

function array(value: unknown, code: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(code);
  return value;
}

export function parseCustomerReceivableSnapshot(
  value: unknown,
): CustomerReceivableSnapshot {
  const root = record(value, "FINANCE_CUSTOMER_RECEIVABLE_SNAPSHOT_INVALID");
  const summary = record(root.summary, "FINANCE_CUSTOMER_RECEIVABLE_SUMMARY_INVALID");
  const due = record(root.due, "FINANCE_CUSTOMER_RECEIVABLE_DUE_INVALID");
  const reconciliation = record(
    root.reconciliation,
    "FINANCE_CUSTOMER_RECEIVABLE_RECONCILIATION_INVALID",
  );

  if (reconciliation.ok !== true || reconciliation.reason !== null) {
    throw new Error("FINANCE_CUSTOMER_RECEIVABLE_RECONCILIATION_FAILED");
  }

  const openItems = array(root.openItems, "FINANCE_CUSTOMER_RECEIVABLE_OPEN_ITEMS_INVALID").map(
    (raw): CustomerReceivableOpenItem => {
      const item = record(raw, "FINANCE_CUSTOMER_RECEIVABLE_OPEN_ITEM_INVALID");
      const status = text(item.status, "FINANCE_CUSTOMER_RECEIVABLE_OPEN_ITEM_STATUS_INVALID");
      if (!["OPEN", "PARTIAL", "CLOSED", "REVERSED"].includes(status)) {
        throw new Error("FINANCE_CUSTOMER_RECEIVABLE_OPEN_ITEM_STATUS_INVALID");
      }
      return {
        id: text(item.id, "FINANCE_CUSTOMER_RECEIVABLE_OPEN_ITEM_ID_INVALID"),
        saleId: text(item.saleId, "FINANCE_CUSTOMER_RECEIVABLE_OPEN_ITEM_SALE_INVALID"),
        installmentId: nullableText(
          item.installmentId,
          "FINANCE_CUSTOMER_RECEIVABLE_OPEN_ITEM_INSTALLMENT_INVALID",
        ),
        documentNumber: text(
          item.documentNumber,
          "FINANCE_CUSTOMER_RECEIVABLE_OPEN_ITEM_DOCUMENT_INVALID",
        ),
        sequenceNo: integer(
          item.sequenceNo,
          "FINANCE_CUSTOMER_RECEIVABLE_OPEN_ITEM_SEQUENCE_INVALID",
        ),
        dueDate: text(item.dueDate, "FINANCE_CUSTOMER_RECEIVABLE_OPEN_ITEM_DUE_INVALID"),
        originalAmount: money(
          item.originalAmount,
          "FINANCE_CUSTOMER_RECEIVABLE_OPEN_ITEM_ORIGINAL_INVALID",
        ),
        allocatedAmount: money(
          item.allocatedAmount,
          "FINANCE_CUSTOMER_RECEIVABLE_OPEN_ITEM_ALLOCATED_INVALID",
        ),
        reservedAmount: money(
          item.reservedAmount,
          "FINANCE_CUSTOMER_RECEIVABLE_OPEN_ITEM_RESERVED_INVALID",
        ),
        remainingAmount: money(
          item.remainingAmount,
          "FINANCE_CUSTOMER_RECEIVABLE_OPEN_ITEM_REMAINING_INVALID",
        ),
        status: status as CustomerReceivableOpenItemStatus,
        createdAt: text(item.createdAt, "FINANCE_CUSTOMER_RECEIVABLE_OPEN_ITEM_CREATED_INVALID"),
        updatedAt: text(item.updatedAt, "FINANCE_CUSTOMER_RECEIVABLE_OPEN_ITEM_UPDATED_INVALID"),
      };
    },
  );

  const allocations = array(
    root.allocations,
    "FINANCE_CUSTOMER_RECEIVABLE_ALLOCATIONS_INVALID",
  ).map((raw): CustomerReceivableAllocation => {
    const item = record(raw, "FINANCE_CUSTOMER_RECEIVABLE_ALLOCATION_INVALID");
    return {
      id: text(item.id, "FINANCE_CUSTOMER_RECEIVABLE_ALLOCATION_ID_INVALID"),
      operationId: text(
        item.operationId,
        "FINANCE_CUSTOMER_RECEIVABLE_ALLOCATION_OPERATION_INVALID",
      ),
      transactionId: text(
        item.transactionId,
        "FINANCE_CUSTOMER_RECEIVABLE_ALLOCATION_TRANSACTION_INVALID",
      ),
      openItemId: text(
        item.openItemId,
        "FINANCE_CUSTOMER_RECEIVABLE_ALLOCATION_OPEN_ITEM_INVALID",
      ),
      saleId: text(item.saleId, "FINANCE_CUSTOMER_RECEIVABLE_ALLOCATION_SALE_INVALID"),
      installmentId: nullableText(
        item.installmentId,
        "FINANCE_CUSTOMER_RECEIVABLE_ALLOCATION_INSTALLMENT_INVALID",
      ),
      amount: money(item.amount, "FINANCE_CUSTOMER_RECEIVABLE_ALLOCATION_AMOUNT_INVALID"),
      reversedAt: nullableText(
        item.reversedAt,
        "FINANCE_CUSTOMER_RECEIVABLE_ALLOCATION_REVERSED_INVALID",
      ),
      createdAt: text(
        item.createdAt,
        "FINANCE_CUSTOMER_RECEIVABLE_ALLOCATION_CREATED_INVALID",
      ),
    };
  });

  const transactionMetadata = array(
    root.transactionMetadata,
    "FINANCE_CUSTOMER_RECEIVABLE_TRANSACTION_METADATA_INVALID",
  ).map((raw): CustomerReceivableTransactionMetadata => {
    const item = record(raw, "FINANCE_CUSTOMER_RECEIVABLE_TRANSACTION_METADATA_ROW_INVALID");
    return {
      transactionId: text(
        item.transactionId,
        "FINANCE_CUSTOMER_RECEIVABLE_TRANSACTION_ID_INVALID",
      ),
      paymentMethod: nullableText(
        item.paymentMethod,
        "FINANCE_CUSTOMER_RECEIVABLE_PAYMENT_METHOD_INVALID",
      ),
      description: nullableText(
        item.description,
        "FINANCE_CUSTOMER_RECEIVABLE_DESCRIPTION_INVALID",
      ),
      transactionDate: text(
        item.transactionDate,
        "FINANCE_CUSTOMER_RECEIVABLE_TRANSACTION_DATE_INVALID",
      ),
      createdAt: text(
        item.createdAt,
        "FINANCE_CUSTOMER_RECEIVABLE_TRANSACTION_CREATED_INVALID",
      ),
      status: text(item.status, "FINANCE_CUSTOMER_RECEIVABLE_TRANSACTION_STATUS_INVALID"),
      reversedAt: nullableText(
        item.reversedAt,
        "FINANCE_CUSTOMER_RECEIVABLE_TRANSACTION_REVERSED_INVALID",
      ),
    };
  });

  return {
    customerId: text(root.customerId, "FINANCE_CUSTOMER_RECEIVABLE_CUSTOMER_INVALID"),
    currency: text(root.currency, "FINANCE_CUSTOMER_RECEIVABLE_CURRENCY_INVALID"),
    asOf: text(root.asOf, "FINANCE_CUSTOMER_RECEIVABLE_AS_OF_INVALID"),
    summary: {
      originalDebtTotal: money(
        summary.originalDebtTotal,
        "FINANCE_CUSTOMER_RECEIVABLE_ORIGINAL_TOTAL_INVALID",
      ),
      allocatedCollectionTotal: money(
        summary.allocatedCollectionTotal,
        "FINANCE_CUSTOMER_RECEIVABLE_COLLECTION_TOTAL_INVALID",
      ),
      reservedTotal: money(
        summary.reservedTotal,
        "FINANCE_CUSTOMER_RECEIVABLE_RESERVED_TOTAL_INVALID",
      ),
      currentBalance: money(
        summary.currentBalance,
        "FINANCE_CUSTOMER_RECEIVABLE_BALANCE_INVALID",
      ),
      openItemCount: integer(
        summary.openItemCount,
        "FINANCE_CUSTOMER_RECEIVABLE_OPEN_COUNT_INVALID",
      ),
      closedItemCount: integer(
        summary.closedItemCount,
        "FINANCE_CUSTOMER_RECEIVABLE_CLOSED_COUNT_INVALID",
      ),
    },
    due: {
      overdueAmount: money(
        due.overdueAmount,
        "FINANCE_CUSTOMER_RECEIVABLE_OVERDUE_INVALID",
      ),
      dueTodayAmount: money(
        due.dueTodayAmount,
        "FINANCE_CUSTOMER_RECEIVABLE_TODAY_INVALID",
      ),
      futureAmount: money(
        due.futureAmount,
        "FINANCE_CUSTOMER_RECEIVABLE_FUTURE_INVALID",
      ),
      totalOpenAmount: money(
        due.totalOpenAmount,
        "FINANCE_CUSTOMER_RECEIVABLE_TOTAL_OPEN_INVALID",
      ),
    },
    openItems,
    allocations,
    transactionMetadata,
    reconciliation: {
      ok: true,
      reason: null,
    },
  };
}