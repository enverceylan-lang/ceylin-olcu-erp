import type {
  ErpScope
} from "@/lib/erpScope";
import {
  queryLocalBankMovements
} from "@/lib/finance/localBankMovementQueryService";

export interface LocalBankPortfolioSummaryQuery
  extends ErpScope {
  asOfDate?: string;
  currency?: string;
}

export interface LocalBankPortfolioAccountSummary {
  bankAccountId: string;
  currency: string;

  totalInflow: number;
  totalOutflow: number;
  balance: number;

  movementCount: number;
}

export interface LocalBankPortfolioCurrencySummary {
  currency: string;

  totalInflow: number;
  totalOutflow: number;
  balance: number;

  accountCount: number;
  movementCount: number;
}

export interface LocalBankPortfolioSummaryResult {
  asOfDate: string | null;

  accounts:
    LocalBankPortfolioAccountSummary[];

  currencies:
    LocalBankPortfolioCurrencySummary[];

  totalAccountCount: number;
  totalMovementCount: number;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
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

export async function calculateLocalBankPortfolioSummary(
  query: LocalBankPortfolioSummaryQuery
): Promise<LocalBankPortfolioSummaryResult> {
  if (query.asOfDate) {
    assertIsoDate(
      query.asOfDate,
      "BANK_PORTFOLIO_DATE_INVALID"
    );
  }

  const result =
    await queryLocalBankMovements({
      ...query,
      currency: query.currency,
      dateTo: query.asOfDate
    });

  const accountMap =
    new Map<
      string,
      LocalBankPortfolioAccountSummary
    >();

  for (const movement of result.movements) {
    const key =
      `${movement.bankAccountId}::${movement.currency}`;

    const existing =
      accountMap.get(key) ?? {
        bankAccountId:
          movement.bankAccountId,
        currency:
          movement.currency,

        totalInflow: 0,
        totalOutflow: 0,
        balance: 0,

        movementCount: 0
      };

    if (movement.direction === "IN") {
      existing.totalInflow +=
        movement.netAmount;
    }

    if (movement.direction === "OUT") {
      existing.totalOutflow +=
        movement.netAmount;
    }

    existing.movementCount += 1;

    accountMap.set(
      key,
      existing
    );
  }

  const accounts =
    Array.from(accountMap.values())
      .map(account => ({
        ...account,

        totalInflow:
          roundMoney(
            account.totalInflow
          ),

        totalOutflow:
          roundMoney(
            account.totalOutflow
          ),

        balance:
          roundMoney(
            account.totalInflow -
            account.totalOutflow
          )
      }))
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
      LocalBankPortfolioCurrencySummary
    >();

  for (const account of accounts) {
    const existing =
      currencyMap.get(account.currency) ?? {
        currency:
          account.currency,

        totalInflow: 0,
        totalOutflow: 0,
        balance: 0,

        accountCount: 0,
        movementCount: 0
      };

    existing.totalInflow +=
      account.totalInflow;

    existing.totalOutflow +=
      account.totalOutflow;

    existing.accountCount += 1;

    existing.movementCount +=
      account.movementCount;

    currencyMap.set(
      account.currency,
      existing
    );
  }

  const currencies =
    Array.from(currencyMap.values())
      .map(currency => ({
        ...currency,

        totalInflow:
          roundMoney(
            currency.totalInflow
          ),

        totalOutflow:
          roundMoney(
            currency.totalOutflow
          ),

        balance:
          roundMoney(
            currency.totalInflow -
            currency.totalOutflow
          )
      }))
      .sort(
        (left, right) =>
          left.currency.localeCompare(
            right.currency
          )
      );

  return {
    asOfDate:
      query.asOfDate ?? null,

    accounts,
    currencies,

    totalAccountCount:
      accounts.length,

    totalMovementCount:
      result.totalCount
  };
}
