import type {
  BankMovement,
  BankMovementDirection,
  BankMovementReportSummary,
  BankMovementStatus,
  BankMovementType
} from "@/lib/finance/bankingContracts";
import {
  localFinanceJournalDb
} from "@/lib/finance/localFinanceJournalDb";
import type {
  ErpScope
} from "@/lib/erpScope";
import {
  validateErpScope
} from "@/lib/erpScope";

export interface LocalBankMovementQuery
  extends ErpScope {
  bankAccountId?: string;
  movementType?: BankMovementType;
  direction?: BankMovementDirection;
  status?: BankMovementStatus;
  currency?: string;

  sourceDocumentId?: string;
  customerId?: string;

  dateFrom?: string;
  dateTo?: string;

  limit?: number;
}

export interface LocalBankMovementQueryResult {
  movements: BankMovement[];
  summary: BankMovementReportSummary;
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

function assertValidQuery(
  query: LocalBankMovementQuery
): void {
  const scopeValidation =
    validateErpScope(query);

  if (!scopeValidation.valid) {
    throw new Error(
      `BANK_MOVEMENT_QUERY_SCOPE_REQUIRED:${scopeValidation.missingFields.join(",")}`
    );
  }

  if (query.dateFrom) {
    assertValidDate(
      query.dateFrom,
      "BANK_MOVEMENT_QUERY_DATE_FROM_INVALID"
    );
  }

  if (query.dateTo) {
    assertValidDate(
      query.dateTo,
      "BANK_MOVEMENT_QUERY_DATE_TO_INVALID"
    );
  }

  if (
    query.dateFrom &&
    query.dateTo &&
    query.dateFrom > query.dateTo
  ) {
    throw new Error(
      "BANK_MOVEMENT_QUERY_DATE_RANGE_INVALID"
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
      "BANK_MOVEMENT_QUERY_LIMIT_INVALID"
    );
  }
}

function matchesQuery(
  movement: BankMovement,
  query: LocalBankMovementQuery
): boolean {
  if (
    query.bankAccountId &&
    movement.bankAccountId !==
      query.bankAccountId
  ) {
    return false;
  }

  if (
    query.movementType &&
    movement.movementType !==
      query.movementType
  ) {
    return false;
  }

  if (
    query.direction &&
    movement.direction !==
      query.direction
  ) {
    return false;
  }

  if (
    query.status &&
    movement.status !==
      query.status
  ) {
    return false;
  }

  if (
    query.currency &&
    movement.currency !==
      query.currency
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
    movement.customerId !==
      query.customerId
  ) {
    return false;
  }

  if (
    query.dateFrom &&
    movement.transactionDate <
      query.dateFrom
  ) {
    return false;
  }

  if (
    query.dateTo &&
    movement.transactionDate >
      query.dateTo
  ) {
    return false;
  }

  return true;
}

export function summarizeBankMovements(
  movements: readonly BankMovement[]
): BankMovementReportSummary {
  const summary: BankMovementReportSummary = {
    totalInflow: 0,
    totalOutflow: 0,
    netMovement: 0,

    eftIn: 0,
    eftOut: 0,

    havaleIn: 0,
    havaleOut: 0,

    fastIn: 0,
    fastOut: 0,

    posSettlementIn: 0,
    posCommissionOut: 0,

    bankFeesOut: 0,
    otherIn: 0,
    otherOut: 0
  };

  for (const movement of movements) {
    const amount =
      roundMoney(movement.netAmount);

    if (movement.direction === "IN") {
      summary.totalInflow += amount;
    }

    if (movement.direction === "OUT") {
      summary.totalOutflow += amount;
    }

    if (
      movement.movementType ===
        "POS_SETTLEMENT" &&
      movement.direction === "IN"
    ) {
      summary.posSettlementIn += amount;
      continue;
    }

    if (
      movement.movementType ===
        "POS_COMMISSION" &&
      movement.direction === "OUT"
    ) {
      summary.posCommissionOut += amount;
      continue;
    }

    if (
      movement.movementType === "EFT_IN"
    ) {
      summary.eftIn += amount;
      continue;
    }

    if (
      movement.movementType === "EFT_OUT"
    ) {
      summary.eftOut += amount;
      continue;
    }

    if (
      movement.movementType === "HAVALE_IN"
    ) {
      summary.havaleIn += amount;
      continue;
    }

    if (
      movement.movementType === "HAVALE_OUT"
    ) {
      summary.havaleOut += amount;
      continue;
    }

    if (
      movement.movementType === "FAST_IN"
    ) {
      summary.fastIn += amount;
      continue;
    }

    if (
      movement.movementType === "FAST_OUT"
    ) {
      summary.fastOut += amount;
      continue;
    }

    if (
      movement.movementType === "BANK_FEE" &&
      movement.direction === "OUT"
    ) {
      summary.bankFeesOut += amount;
      continue;
    }

    if (movement.direction === "IN") {
      summary.otherIn += amount;
    }

    if (movement.direction === "OUT") {
      summary.otherOut += amount;
    }
  }

  summary.totalInflow =
    roundMoney(summary.totalInflow);

  summary.totalOutflow =
    roundMoney(summary.totalOutflow);

  summary.netMovement =
    roundMoney(
      summary.totalInflow -
      summary.totalOutflow
    );

  summary.eftIn =
    roundMoney(summary.eftIn);
  summary.eftOut =
    roundMoney(summary.eftOut);

  summary.havaleIn =
    roundMoney(summary.havaleIn);
  summary.havaleOut =
    roundMoney(summary.havaleOut);

  summary.fastIn =
    roundMoney(summary.fastIn);
  summary.fastOut =
    roundMoney(summary.fastOut);

  summary.posSettlementIn =
    roundMoney(summary.posSettlementIn);

  summary.posCommissionOut =
    roundMoney(summary.posCommissionOut);

  summary.bankFeesOut =
    roundMoney(summary.bankFeesOut);

  summary.otherIn =
    roundMoney(summary.otherIn);
  summary.otherOut =
    roundMoney(summary.otherOut);

  return summary;
}

export async function queryLocalBankMovements(
  query: LocalBankMovementQuery
): Promise<LocalBankMovementQueryResult> {
  assertValidQuery(query);

  const scopedMovements =
    await localFinanceJournalDb
      .bankMovements
      .where(
        "[tenantId+companyId+branchId+accountingPeriodId]"
      )
      .equals([
        query.tenantId,
        query.companyId,
        query.branchId,
        query.accountingPeriodId
      ])
      .toArray();

  const filtered =
    scopedMovements
      .filter(
        movement =>
          matchesQuery(movement, query)
      )
      .sort(
        (left, right) =>
          right.transactionDate.localeCompare(
            left.transactionDate
          ) ||
          right.createdAt.localeCompare(
            left.createdAt
          )
      );

  const totalCount = filtered.length;

  const movements =
    query.limit === undefined
      ? filtered
      : filtered.slice(0, query.limit);

  return {
    movements,
    summary:
      summarizeBankMovements(filtered),
    totalCount
  };
}
