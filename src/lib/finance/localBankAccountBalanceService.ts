import type {
  ErpScope
} from "@/lib/erpScope";
import {
  queryLocalBankMovements
} from "@/lib/finance/localBankMovementQueryService";

export interface LocalBankAccountBalanceQuery
  extends ErpScope {
  bankAccountId: string;
  currency: string;
  asOfDate?: string;
}

export interface LocalBankAccountBalanceResult {
  bankAccountId: string;
  currency: string;
  asOfDate: string | null;

  totalInflow: number;
  totalOutflow: number;
  balance: number;

  movementCount: number;
}

export interface LocalBankAccountDailySummaryQuery
  extends ErpScope {
  bankAccountId: string;
  currency: string;
  transactionDate: string;
}

export interface LocalBankAccountDailySummaryResult {
  bankAccountId: string;
  currency: string;
  transactionDate: string;

  openingBalance: number;

  dailyInflow: number;
  dailyOutflow: number;
  dailyNetMovement: number;

  closingBalance: number;
  dailyMovementCount: number;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertRequiredText(
  value: string,
  errorCode: string
): void {
  if (value.trim().length === 0) {
    throw new Error(errorCode);
  }
}

function assertIsoDate(
  value: string,
  errorCode: string
): void {
  const parsed =
    new Date(`${value}T00:00:00.000Z`);

  if (
    value.length !== 10 ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(errorCode);
  }
}

function previousIsoDate(value: string): string {
  const parsed =
    new Date(`${value}T00:00:00.000Z`);

  parsed.setUTCDate(
    parsed.getUTCDate() - 1
  );

  return parsed
    .toISOString()
    .slice(0, 10);
}

export async function calculateLocalBankAccountBalance(
  query: LocalBankAccountBalanceQuery
): Promise<LocalBankAccountBalanceResult> {
  assertRequiredText(
    query.bankAccountId,
    "BANK_ACCOUNT_BALANCE_ACCOUNT_REQUIRED"
  );

  assertRequiredText(
    query.currency,
    "BANK_ACCOUNT_BALANCE_CURRENCY_REQUIRED"
  );

  if (query.asOfDate) {
    assertIsoDate(
      query.asOfDate,
      "BANK_ACCOUNT_BALANCE_DATE_INVALID"
    );
  }

  const result =
    await queryLocalBankMovements({
      ...query,
      bankAccountId: query.bankAccountId,
      currency: query.currency,
      dateTo: query.asOfDate
    });

  return {
    bankAccountId: query.bankAccountId,
    currency: query.currency,
    asOfDate: query.asOfDate ?? null,

    totalInflow:
      result.summary.totalInflow,

    totalOutflow:
      result.summary.totalOutflow,

    balance:
      roundMoney(
        result.summary.totalInflow -
        result.summary.totalOutflow
      ),

    movementCount:
      result.totalCount
  };
}

export async function calculateLocalBankAccountDailySummary(
  query: LocalBankAccountDailySummaryQuery
): Promise<LocalBankAccountDailySummaryResult> {
  assertRequiredText(
    query.bankAccountId,
    "BANK_ACCOUNT_DAILY_ACCOUNT_REQUIRED"
  );

  assertRequiredText(
    query.currency,
    "BANK_ACCOUNT_DAILY_CURRENCY_REQUIRED"
  );

  assertIsoDate(
    query.transactionDate,
    "BANK_ACCOUNT_DAILY_DATE_INVALID"
  );

  const opening =
    await calculateLocalBankAccountBalance({
      ...query,
      bankAccountId: query.bankAccountId,
      currency: query.currency,
      asOfDate:
        previousIsoDate(
          query.transactionDate
        )
    });

  const daily =
    await queryLocalBankMovements({
      ...query,
      bankAccountId: query.bankAccountId,
      currency: query.currency,
      dateFrom: query.transactionDate,
      dateTo: query.transactionDate
    });

  const dailyInflow =
    daily.summary.totalInflow;

  const dailyOutflow =
    daily.summary.totalOutflow;

  const dailyNetMovement =
    roundMoney(
      dailyInflow -
      dailyOutflow
    );

  return {
    bankAccountId: query.bankAccountId,
    currency: query.currency,
    transactionDate:
      query.transactionDate,

    openingBalance:
      opening.balance,

    dailyInflow,
    dailyOutflow,
    dailyNetMovement,

    closingBalance:
      roundMoney(
        opening.balance +
        dailyNetMovement
      ),

    dailyMovementCount:
      daily.totalCount
  };
}
