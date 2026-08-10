import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  ServiceRate,
} from "@/lib/serviceRateEngine";

export type ServiceRateRejectReason =
  | "REQUIRED_FIELD_MISSING"
  | "INVALID_PRICE"
  | "INVALID_DATE_RANGE"
  | "ID_CONFLICT";

export type AddServiceRateResult =
  | {
      outcome: "CREATED";
      rate: ServiceRate;
    }
  | {
      outcome: "REPLAY";
      rate: ServiceRate;
    }
  | {
      outcome: "REJECTED";
      reason:
        | "REQUIRED_FIELD_MISSING"
        | "INVALID_PRICE"
        | "INVALID_DATE_RANGE"
        | "ID_CONFLICT";
    };

interface ServiceRateState {
  rates: ServiceRate[];

  addRate(
    rate: ServiceRate,
  ): AddServiceRateResult;

  replaceSnapshot(
    rates: ServiceRate[],
  ): void;
}

function nonBlank(
  value: string,
): boolean {
  return value.trim().length > 0;
}

function sameRate(
  left: ServiceRate,
  right: ServiceRate,
): boolean {
  return (
    left.id === right.id &&
    left.tenantId === right.tenantId &&
    left.companyId === right.companyId &&
    left.branchId === right.branchId &&
    left.accountingPeriodId ===
      right.accountingPeriodId &&
    left.providerCustomerId ===
      right.providerCustomerId &&
    left.providerType ===
      right.providerType &&
    left.serviceStockItemId ===
      right.serviceStockItemId &&
    left.unit === right.unit &&
    left.unitPrice === right.unitPrice &&
    left.currency === right.currency &&
    left.validFrom === right.validFrom &&
    (left.validTo ?? null) ===
      (right.validTo ?? null) &&
    left.active === right.active &&
    left.createdAt === right.createdAt
  );
}

function validateRate(
  rate: ServiceRate,
):
  | ServiceRateRejectReason
  | null {
  const required = [
    rate.id,
    rate.tenantId,
    rate.companyId,
    rate.branchId,
    rate.accountingPeriodId,
    rate.providerCustomerId,
    rate.serviceStockItemId,
    rate.validFrom,
    rate.createdAt,
  ];

  if (
    required.some(
      value => !nonBlank(value),
    )
  ) {
    return "REQUIRED_FIELD_MISSING";
  }

  if (
    !Number.isFinite(rate.unitPrice) ||
    rate.unitPrice < 0
  ) {
    return "INVALID_PRICE";
  }

  const from =
    new Date(rate.validFrom).getTime();

  if (!Number.isFinite(from)) {
    return "INVALID_DATE_RANGE";
  }

  if (rate.validTo) {
    const to =
      new Date(rate.validTo).getTime();

    if (
      !Number.isFinite(to) ||
      to <= from
    ) {
      return "INVALID_DATE_RANGE";
    }
  }

  return null;
}

export const useServiceRateStore =
  create<ServiceRateState>()(
    persist(
      (set, get) => ({
        rates: [],

        addRate: rate => {
          const validation =
            validateRate(rate);

          if (validation) {
            return {
              outcome: "REJECTED",
              reason: validation,
            };
          }

          const existing =
            get().rates.find(
              item =>
                item.id === rate.id,
            );

          if (existing) {
            if (
              sameRate(
                existing,
                rate,
              )
            ) {
              return {
                outcome: "REPLAY",
                rate: existing,
              };
            }

            return {
              outcome: "REJECTED",
              reason: "ID_CONFLICT",
            };
          }

          set({
            rates: [
              ...get().rates,
              rate,
            ],
          });

          return {
            outcome: "CREATED",
            rate,
          };
        },

        replaceSnapshot: rates => {
          set({ rates });
        },
      }),
      {
        name:
          "enverp-service-rate-history-v1",
        partialize: state => ({
          rates: state.rates,
        }),
      },
    ),
  );