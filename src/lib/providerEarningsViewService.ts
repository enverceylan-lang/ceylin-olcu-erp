export type ProviderEarningsCurrency =
  | "TRY"
  | "USD"
  | "EUR"
  | "GBP";

export type ProviderEarningsStatus =
  | "ESTIMATED"
  | "FINALIZED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CANCELLED";

export interface ProviderEarningsScope {
  tenantId: string;
  companyId: string;
  branchId: string;
  accountingPeriodId: string;
}

export interface ProviderEarningsActor
  extends ProviderEarningsScope {
  userId: string;

  role:
    | "TAILOR"
    | "INSTALLER";
}

export interface ProviderEarningsLink {
  userId: string;

  providerCustomerId:
    string;

  providerType:
    | "TAILOR"
    | "INSTALLER";
}

export interface ProviderEarningsEntry
  extends ProviderEarningsScope {
  id: string;

  providerCustomerId:
    string;

  providerType:
    | "TAILOR"
    | "INSTALLER";

  operationId:
    string;

  sourceDocumentId?:
    string;

  title:
    string;

  occurredAt:
    string;

  currency:
    ProviderEarningsCurrency;

  estimatedAmount:
    number;

  finalizedAmount:
    number;

  paidAmount:
    number;

  status:
    ProviderEarningsStatus;
}

export interface ProviderEarningsCurrencySummary {
  currency:
    ProviderEarningsCurrency;

  estimatedAmount:
    number;

  finalizedAmount:
    number;

  paidAmount:
    number;

  remainingAmount:
    number;

  entryCount:
    number;
}

export interface ProviderEarningsViewResult {
  entries:
    ProviderEarningsEntry[];

  summaries:
    ProviderEarningsCurrencySummary[];

  entryCount:
    number;
}

function roundMoney(
  value:
    number
): number {
  return (
    Math.round(
      (value + Number.EPSILON) *
        100
    ) / 100
  );
}

function isFiniteNonNegative(
  value:
    number
): boolean {
  return (
    Number.isFinite(value) &&
    value >= 0
  );
}

function hasValidAmounts(
  entry:
    ProviderEarningsEntry
): boolean {
  if (
    !isFiniteNonNegative(
      entry.estimatedAmount
    )
  ) {
    return false;
  }

  if (
    !isFiniteNonNegative(
      entry.finalizedAmount
    )
  ) {
    return false;
  }

  if (
    !isFiniteNonNegative(
      entry.paidAmount
    )
  ) {
    return false;
  }

  if (
    entry.paidAmount >
    entry.finalizedAmount
  ) {
    return false;
  }

  return true;
}

function matchesScope(
  actor:
    ProviderEarningsActor,
  entry:
    ProviderEarningsEntry
): boolean {
  return (
    actor.tenantId ===
      entry.tenantId &&
    actor.companyId ===
      entry.companyId &&
    actor.branchId ===
      entry.branchId &&
    actor.accountingPeriodId ===
      entry.accountingPeriodId
  );
}

function matchesProvider(
  actor:
    ProviderEarningsActor,
  link:
    ProviderEarningsLink,
  entry:
    ProviderEarningsEntry
): boolean {
  if (
    link.userId !==
    actor.userId
  ) {
    return false;
  }

  if (
    link.providerType !==
    actor.role
  ) {
    return false;
  }

  if (
    entry.providerType !==
    link.providerType
  ) {
    return false;
  }

  return (
    entry.providerCustomerId ===
    link.providerCustomerId
  );
}

function buildCurrencySummary(
  currency:
    ProviderEarningsCurrency,
  entries:
    readonly ProviderEarningsEntry[]
): ProviderEarningsCurrencySummary {
  let estimatedAmount = 0;
  let finalizedAmount = 0;
  let paidAmount = 0;

  for (const entry of entries) {
    estimatedAmount +=
      entry.estimatedAmount;

    finalizedAmount +=
      entry.finalizedAmount;

    paidAmount +=
      entry.paidAmount;
  }

  const normalizedFinalized =
    roundMoney(
      finalizedAmount
    );

  const normalizedPaid =
    roundMoney(
      paidAmount
    );

  return {
    currency,

    estimatedAmount:
      roundMoney(
        estimatedAmount
      ),

    finalizedAmount:
      normalizedFinalized,

    paidAmount:
      normalizedPaid,

    remainingAmount:
      roundMoney(
        normalizedFinalized -
          normalizedPaid
      ),

    entryCount:
      entries.length
  };
}

export function listProviderEarnings(
  entries:
    readonly ProviderEarningsEntry[],
  actor:
    ProviderEarningsActor,
  link?:
    ProviderEarningsLink
): ProviderEarningsViewResult {
  if (!link) {
    return {
      entries: [],
      summaries: [],
      entryCount: 0
    };
  }

  const visibleEntries =
    entries
      .filter(entry =>
        entry.status !==
        "CANCELLED"
      )
      .filter(entry =>
        hasValidAmounts(
          entry
        )
      )
      .filter(entry =>
        matchesScope(
          actor,
          entry
        )
      )
      .filter(entry =>
        matchesProvider(
          actor,
          link,
          entry
        )
      )
      .sort((left, right) =>
        right.occurredAt.localeCompare(
          left.occurredAt
        )
      );

  const currencies =
    Array.from(
      new Set(
        visibleEntries.map(
          entry =>
            entry.currency
        )
      )
    ).sort();

  const summaries =
    currencies.map(currency =>
      buildCurrencySummary(
        currency,
        visibleEntries.filter(
          entry =>
            entry.currency ===
            currency
        )
      )
    );

  return {
    entries:
      visibleEntries,

    summaries,

    entryCount:
      visibleEntries.length
  };
}