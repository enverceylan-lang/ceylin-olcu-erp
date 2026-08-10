import type { ErpScope } from "@/lib/erpScope";

export type ServiceProviderType =
  | "TAILOR"
  | "INSTALLER";

export type ServiceRateUnit =
  | "METER"
  | "M2"
  | "UNIT"
  | "JOB";

export interface ServiceRate
  extends ErpScope {
  id: string;

  providerCustomerId: string;
  providerType: ServiceProviderType;

  serviceStockItemId: string;
  unit: ServiceRateUnit;

  unitPrice: number;
  currency: "TRY";

  validFrom: string;
  validTo?: string | null;

  active: boolean;

  createdAt: string;
}

export interface ResolveServiceRateInput
  extends ErpScope {
  rates: ServiceRate[];
  providerCustomerId: string;
  providerType: ServiceProviderType;
  serviceStockItemId: string;
  occurredAt: string;
}

export type ResolveServiceRateResult =
  | {
      ok: true;
      rate: ServiceRate;
    }
  | {
      ok: false;
      reason:
        | "NO_MATCHING_RATE"
        | "AMBIGUOUS_RATE";
    };

function timestamp(value: string): number {
  const parsed = new Date(value).getTime();

  return Number.isFinite(parsed)
    ? parsed
    : Number.NaN;
}

function sameScope(
  rate: ErpScope,
  input: ErpScope,
): boolean {
  return (
    rate.tenantId === input.tenantId &&
    rate.companyId === input.companyId &&
    rate.branchId === input.branchId &&
    rate.accountingPeriodId ===
      input.accountingPeriodId
  );
}

export function resolveServiceRate(
  input: ResolveServiceRateInput,
): ResolveServiceRateResult {
  const occurredAt = timestamp(
    input.occurredAt,
  );

  if (!Number.isFinite(occurredAt)) {
    return {
      ok: false,
      reason: "NO_MATCHING_RATE",
    };
  }

  const matching = input.rates
    .filter(rate => {
      if (!rate.active) {
        return false;
      }

      if (!sameScope(rate, input)) {
        return false;
      }

      if (
        rate.providerCustomerId !==
        input.providerCustomerId
      ) {
        return false;
      }

      if (
        rate.providerType !==
        input.providerType
      ) {
        return false;
      }

      if (
        rate.serviceStockItemId !==
        input.serviceStockItemId
      ) {
        return false;
      }

      if (
        !Number.isFinite(rate.unitPrice) ||
        rate.unitPrice < 0
      ) {
        return false;
      }

      const from = timestamp(
        rate.validFrom,
      );

      if (
        !Number.isFinite(from) ||
        occurredAt < from
      ) {
        return false;
      }

      if (rate.validTo) {
        const to = timestamp(
          rate.validTo,
        );

        if (
          !Number.isFinite(to) ||
          occurredAt >= to
        ) {
          return false;
        }
      }

      return true;
    })
    .sort(
      (left, right) =>
        timestamp(right.validFrom) -
        timestamp(left.validFrom),
    );

  if (matching.length === 0) {
    return {
      ok: false,
      reason: "NO_MATCHING_RATE",
    };
  }

  const newestFrom = timestamp(
    matching[0].validFrom,
  );

  const samePriority = matching.filter(
    rate =>
      timestamp(rate.validFrom) ===
      newestFrom,
  );

  if (samePriority.length !== 1) {
    return {
      ok: false,
      reason: "AMBIGUOUS_RATE",
    };
  }

  return {
    ok: true,
    rate: samePriority[0],
  };
}

export function calculateServiceCost(
  rate: ServiceRate,
  quantity: number,
): number | null {
  if (
    !Number.isFinite(quantity) ||
    quantity < 0 ||
    !Number.isFinite(rate.unitPrice) ||
    rate.unitPrice < 0
  ) {
    return null;
  }

  return (
    Math.round(
      (
        quantity *
          rate.unitPrice +
        Number.EPSILON
      ) *
        100,
    ) / 100
  );
}