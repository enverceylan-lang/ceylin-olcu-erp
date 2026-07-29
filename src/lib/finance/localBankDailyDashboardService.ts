import type {
  ErpScope
} from "@/lib/erpScope";
import {
  queryLocalBankMovements
} from "@/lib/finance/localBankMovementQueryService";

export interface LocalBankDailyDashboardQuery
  extends ErpScope {
  transactionDate: string;
  currency?: string;
  bankAccountId?: string;
}

export interface LocalBankDailyDashboardAccount {
  bankAccountId: string;
  currency: string;

  openingBalance: number;

  dailyInflow: number;
  dailyOutflow: number;
  dailyNetMovement: number;

  closingBalance: number;

  openingMovementCount: number;
  dailyMovementCount: number;
}

export interface LocalBankDailyDashboardCurrency {
  currency: string;

  openingBalance: number;

  dailyInflow: number;
  dailyOutflow: number;
  dailyNetMovement: number;

  closingBalance: number;

  accountCount: number;
  dailyMovementCount: number;
}

export interface LocalBankDailyDashboardResult {
  transactionDate: string;

  accounts:
    LocalBankDailyDashboardAccount[];

  currencies:
    LocalBankDailyDashboardCurrency[];

  totalAccountCount: number;
  totalDailyMovementCount: number;
}

interface MutableAccountSummary {
  bankAccountId: string;
  currency: string;

  openingInflow: number;
  openingOutflow: number;

  dailyInflow: number;
  dailyOutflow: number;

  openingMovementCount: number;
  dailyMovementCount: number;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertIsoDate(value: string): void {
  const parsed =
    new Date(`${value}T00:00:00.000Z`);

  if (
    value.length !== 10 ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(
      "BANK_DAILY_DASHBOARD_DATE_INVALID"
    );
  }
}

export async function calculateLocalBankDailyDashboard(
  query: LocalBankDailyDashboardQuery
): Promise<LocalBankDailyDashboardResult> {
  assertIsoDate(query.transactionDate);

  const result =
    await queryLocalBankMovements({
      ...query,
      bankAccountId:
        query.bankAccountId,
      currency:
        query.currency,
      dateTo:
        query.transactionDate
    });

  const accountMap =
    new Map<string, MutableAccountSummary>();

  for (const movement of result.movements) {
    const key =
      `${movement.bankAccountId}::${movement.currency}`;

    const summary =
      accountMap.get(key) ?? {
        bankAccountId:
          movement.bankAccountId,
        currency:
          movement.currency,

        openingInflow: 0,
        openingOutflow: 0,

        dailyInflow: 0,
        dailyOutflow: 0,

        openingMovementCount: 0,
        dailyMovementCount: 0
      };

    const isDailyMovement =
      movement.transactionDate ===
      query.transactionDate;

    if (!isDailyMovement) {
      if (movement.direction === "IN") {
        summary.openingInflow +=
          movement.netAmount;
      }

      if (movement.direction === "OUT") {
        summary.openingOutflow +=
          movement.netAmount;
      }

      summary.openingMovementCount += 1;
    }

    if (isDailyMovement) {
      if (movement.direction === "IN") {
        summary.dailyInflow +=
          movement.netAmount;
      }

      if (movement.direction === "OUT") {
        summary.dailyOutflow +=
          movement.netAmount;
      }

      summary.dailyMovementCount += 1;
    }

    accountMap.set(key, summary);
  }

  const accounts =
    Array.from(accountMap.values())
      .map(summary => {
        const openingBalance =
          roundMoney(
            summary.openingInflow -
            summary.openingOutflow
          );

        const dailyInflow =
          roundMoney(summary.dailyInflow);

        const dailyOutflow =
          roundMoney(summary.dailyOutflow);

        const dailyNetMovement =
          roundMoney(
            dailyInflow -
            dailyOutflow
          );

        return {
          bankAccountId:
            summary.bankAccountId,
          currency:
            summary.currency,

          openingBalance,

          dailyInflow,
          dailyOutflow,
          dailyNetMovement,

          closingBalance:
            roundMoney(
              openingBalance +
              dailyNetMovement
            ),

          openingMovementCount:
            summary.openingMovementCount,

          dailyMovementCount:
            summary.dailyMovementCount
        };
      })
      .sort(
        (left, right) =>
          left.currency.localeCompare(
            right.currency
          ) ||
          left.bankAccountId.localeCompare(
            right.bankAccountId
          )
      );

  const currencyMap =
    new Map<
      string,
      LocalBankDailyDashboardCurrency
    >();

  for (const account of accounts) {
    const summary =
      currencyMap.get(account.currency) ?? {
        currency:
          account.currency,

        openingBalance: 0,

        dailyInflow: 0,
        dailyOutflow: 0,
        dailyNetMovement: 0,

        closingBalance: 0,

        accountCount: 0,
        dailyMovementCount: 0
      };

    summary.openingBalance +=
      account.openingBalance;

    summary.dailyInflow +=
      account.dailyInflow;

    summary.dailyOutflow +=
      account.dailyOutflow;

    summary.dailyNetMovement +=
      account.dailyNetMovement;

    summary.closingBalance +=
      account.closingBalance;

    summary.accountCount += 1;

    summary.dailyMovementCount +=
      account.dailyMovementCount;

    currencyMap.set(
      account.currency,
      summary
    );
  }

  const currencies =
    Array.from(currencyMap.values())
      .map(summary => ({
        ...summary,

        openingBalance:
          roundMoney(
            summary.openingBalance
          ),

        dailyInflow:
          roundMoney(
            summary.dailyInflow
          ),

        dailyOutflow:
          roundMoney(
            summary.dailyOutflow
          ),

        dailyNetMovement:
          roundMoney(
            summary.dailyNetMovement
          ),

        closingBalance:
          roundMoney(
            summary.closingBalance
          )
      }))
      .sort(
        (left, right) =>
          left.currency.localeCompare(
            right.currency
          )
      );

  return {
    transactionDate:
      query.transactionDate,

    accounts,
    currencies,

    totalAccountCount:
      accounts.length,

    totalDailyMovementCount:
      accounts.reduce(
        (total, account) =>
          total +
          account.dailyMovementCount,
        0
      )
  };
}
