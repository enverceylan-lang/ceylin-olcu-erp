import type {
  CashMovement,
  CashMovementStatus,
  CashOperationDirection
} from "@/lib/finance/cashFinanceContracts";
import type {
  ErpScope
} from "@/lib/erpScope";
import {
  validateErpScope
} from "@/lib/erpScope";

export interface CashMovementReportQuery
  extends ErpScope {
  cashAccountId?: string;
  direction?: CashOperationDirection;
  status?: CashMovementStatus;
  currency?: string;

  sourceDocumentType?:
    CashMovement["sourceDocumentType"];
  sourceDocumentId?: string;

  customerId?: string;
  supplierId?: string;
  saleId?: string;
  installmentId?: string;

  dateFrom?: string;
  dateTo?: string;

  limit?: number;
}

export interface CashMovementReportSummary {
  postedCount: number;
  reversedCount: number;

  totalInflow: number;
  totalOutflow: number;
  netMovement: number;

  customerCollectionsIn: number;
  supplierPaymentsOut: number;
  manualCashIn: number;
  manualCashOut: number;
  cashBankTransferIn: number;
  cashBankTransferOut: number;
  openingBalanceIn: number;
  openingBalanceOut: number;
}

export interface CashMovementReportResult {
  movements: CashMovement[];
  summary: CashMovementReportSummary;
  totalCount: number;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertValidDate(
  value: string,
  errorCode: string
): void {
  const date =
    new Date(`${value}T00:00:00.000Z`);

  if (
    value.length !== 10 ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(errorCode);
  }
}

export function assertValidCashMovementReportQuery(
  query: CashMovementReportQuery
): void {
  const scopeValidation =
    validateErpScope(query);

  if (!scopeValidation.valid) {
    throw new Error(
      `CASH_MOVEMENT_QUERY_SCOPE_REQUIRED:${scopeValidation.missingFields.join(",")}`
    );
  }

  if (query.dateFrom) {
    assertValidDate(
      query.dateFrom,
      "CASH_MOVEMENT_QUERY_DATE_FROM_INVALID"
    );
  }

  if (query.dateTo) {
    assertValidDate(
      query.dateTo,
      "CASH_MOVEMENT_QUERY_DATE_TO_INVALID"
    );
  }

  if (
    query.dateFrom &&
    query.dateTo &&
    query.dateFrom > query.dateTo
  ) {
    throw new Error(
      "CASH_MOVEMENT_QUERY_DATE_RANGE_INVALID"
    );
  }

  if (
    query.limit !== undefined &&
    (
      !Number.isInteger(query.limit) ||
      query.limit <= 0 ||
      query.limit > 1000
    )
  ) {
    throw new Error(
      "CASH_MOVEMENT_QUERY_LIMIT_INVALID"
    );
  }
}

function sameScope(
  movement: CashMovement,
  query: CashMovementReportQuery
): boolean {
  return (
    movement.tenantId === query.tenantId &&
    movement.companyId === query.companyId &&
    movement.branchId === query.branchId &&
    movement.accountingPeriodId ===
      query.accountingPeriodId
  );
}

export function matchesCashMovementReportQuery(
  movement: CashMovement,
  query: CashMovementReportQuery
): boolean {
  if (!sameScope(movement, query)) {
    return false;
  }

  if (
    query.cashAccountId &&
    movement.cashAccountId !== query.cashAccountId
  ) {
    return false;
  }

  if (
    query.direction &&
    movement.direction !== query.direction
  ) {
    return false;
  }

  if (
    query.status &&
    movement.status !== query.status
  ) {
    return false;
  }

  if (
    query.currency &&
    movement.currency !== query.currency
  ) {
    return false;
  }

  if (
    query.sourceDocumentType &&
    movement.sourceDocumentType !==
      query.sourceDocumentType
  ) {
    return false;
  }

  if (
    query.sourceDocumentId &&
    movement.sourceDocumentId !==
      query.sourceDocumentId
  ) {
    return false;
  }

  if (
    query.customerId &&
    movement.customerId !== query.customerId
  ) {
    return false;
  }

  if (
    query.supplierId &&
    movement.supplierId !== query.supplierId
  ) {
    return false;
  }

  if (
    query.saleId &&
    movement.saleId !== query.saleId
  ) {
    return false;
  }

  if (
    query.installmentId &&
    movement.installmentId !==
      query.installmentId
  ) {
    return false;
  }

  if (
    query.dateFrom &&
    movement.transactionDate < query.dateFrom
  ) {
    return false;
  }

  if (
    query.dateTo &&
    movement.transactionDate > query.dateTo
  ) {
    return false;
  }

  return true;
}

export function summarizeCashMovements(
  movements: readonly CashMovement[]
): CashMovementReportSummary {
  const summary: CashMovementReportSummary = {
    postedCount: 0,
    reversedCount: 0,

    totalInflow: 0,
    totalOutflow: 0,
    netMovement: 0,

    customerCollectionsIn: 0,
    supplierPaymentsOut: 0,
    manualCashIn: 0,
    manualCashOut: 0,
    cashBankTransferIn: 0,
    cashBankTransferOut: 0,
    openingBalanceIn: 0,
    openingBalanceOut: 0
  };

  for (const movement of movements) {
    if (movement.status === "REVERSED") {
      summary.reversedCount += 1;
      continue;
    }

    summary.postedCount += 1;

    const amount = roundMoney(movement.amount);

    if (movement.direction === "IN") {
      summary.totalInflow += amount;
    }

    if (movement.direction === "OUT") {
      summary.totalOutflow += amount;
    }

    if (
      movement.sourceDocumentType ===
        "CUSTOMER_COLLECTION" &&
      movement.direction === "IN"
    ) {
      summary.customerCollectionsIn += amount;
      continue;
    }

    if (
      movement.sourceDocumentType ===
        "SUPPLIER_PAYMENT" &&
      movement.direction === "OUT"
    ) {
      summary.supplierPaymentsOut += amount;
      continue;
    }

    if (
      movement.sourceDocumentType ===
        "MANUAL_CASH" &&
      movement.direction === "IN"
    ) {
      summary.manualCashIn += amount;
      continue;
    }

    if (
      movement.sourceDocumentType ===
        "MANUAL_CASH" &&
      movement.direction === "OUT"
    ) {
      summary.manualCashOut += amount;
      continue;
    }

    if (
      movement.sourceDocumentType ===
        "CASH_BANK_TRANSFER" &&
      movement.direction === "IN"
    ) {
      summary.cashBankTransferIn += amount;
      continue;
    }

    if (
      movement.sourceDocumentType ===
        "CASH_BANK_TRANSFER" &&
      movement.direction === "OUT"
    ) {
      summary.cashBankTransferOut += amount;
      continue;
    }

    if (
      movement.sourceDocumentType ===
        "OPENING_BALANCE" &&
      movement.direction === "IN"
    ) {
      summary.openingBalanceIn += amount;
      continue;
    }

    if (
      movement.sourceDocumentType ===
        "OPENING_BALANCE" &&
      movement.direction === "OUT"
    ) {
      summary.openingBalanceOut += amount;
    }
  }

  summary.totalInflow =
    roundMoney(summary.totalInflow);
  summary.totalOutflow =
    roundMoney(summary.totalOutflow);
  summary.netMovement = roundMoney(
    summary.totalInflow - summary.totalOutflow
  );

  summary.customerCollectionsIn =
    roundMoney(summary.customerCollectionsIn);
  summary.supplierPaymentsOut =
    roundMoney(summary.supplierPaymentsOut);
  summary.manualCashIn =
    roundMoney(summary.manualCashIn);
  summary.manualCashOut =
    roundMoney(summary.manualCashOut);
  summary.cashBankTransferIn =
    roundMoney(summary.cashBankTransferIn);
  summary.cashBankTransferOut =
    roundMoney(summary.cashBankTransferOut);
  summary.openingBalanceIn =
    roundMoney(summary.openingBalanceIn);
  summary.openingBalanceOut =
    roundMoney(summary.openingBalanceOut);

  return summary;
}

export function buildCashMovementReport(
  movements: readonly CashMovement[],
  query: CashMovementReportQuery
): CashMovementReportResult {
  assertValidCashMovementReportQuery(query);

  const matched = movements
    .filter(movement =>
      matchesCashMovementReportQuery(
        movement,
        query
      )
    )
    .sort((left, right) => {
      const dateOrder =
        right.transactionDate.localeCompare(
          left.transactionDate
        );

      if (dateOrder !== 0) {
        return dateOrder;
      }

      const createdOrder =
        right.createdAt.localeCompare(
          left.createdAt
        );

      if (createdOrder !== 0) {
        return createdOrder;
      }

      return right.id.localeCompare(left.id);
    });

  const totalCount = matched.length;
  const limited =
    query.limit === undefined
      ? matched
      : matched.slice(0, query.limit);

  return {
    movements: limited,
    summary: summarizeCashMovements(matched),
    totalCount
  };
}