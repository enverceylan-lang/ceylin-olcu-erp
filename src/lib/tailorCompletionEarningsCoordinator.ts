import {
  calculateServiceCost,
  resolveServiceRate,
  type ServiceRate,
  type ServiceRateUnit
} from "@/lib/serviceRateEngine";
import type {
  OperationRecord
} from "@/lib/operationsWorkflow";
import type {
  Product
} from "@/store/useStore";
import type {
  Sale,
  SaleItem
} from "@/store/salesStore";

export type TailorCompletionEarningsCalculation =
  | {
      ok: true;
      amount: number;
    }
  | {
      ok: false;
      reason:
        | "NOT_TAILOR"
        | "NOT_COMPLETED"
        | "PROVIDER_NOT_ASSIGNED"
        | "SALE_NOT_FOUND"
        | "NO_SEWING_ITEMS"
        | "PRODUCT_NOT_FOUND"
        | "SEWING_SERVICE_NOT_LINKED"
        | "RATE_NOT_FOUND"
        | "RATE_AMBIGUOUS"
        | "UNIT_MISMATCH"
        | "INVALID_QUANTITY";
    };

function positive(
  value: unknown
): number {
  const parsed =
    Number(value);

  return (
    Number.isFinite(parsed) &&
    parsed > 0
  )
    ? parsed
    : 0;
}

function flatten(
  sale: Sale
): SaleItem[] {
  const items:
    SaleItem[] = [];

  for (
    const item of sale.items
  ) {
    if (
      Array.isArray(
        item.productionBreakdown
      ) &&
      item.productionBreakdown.length > 0
    ) {
      items.push(
        ...item.productionBreakdown
      );
    } else {
      items.push(item);
    }
  }

  return items;
}

function quantityForRate(
  item:
    SaleItem,
  unit:
    ServiceRateUnit
): number | null {
  if (
    unit ===
    "JOB"
  ) {
    return 1;
  }

  if (
    unit ===
    "METER"
  ) {
    const fabric =
      positive(
        item.fabricMeters
      );

    if (fabric > 0) {
      return fabric;
    }

    if (
      item.metricUnit !==
      "mt"
    ) {
      return null;
    }

    const metric =
      positive(
        item.metricSize
      );

    return metric > 0
      ? metric
      : null;
  }

  if (
    unit ===
    "M2"
  ) {
    if (
      item.metricUnit !==
      "m2"
    ) {
      return null;
    }

    const metric =
      positive(
        item.metricSize
      );

    return metric > 0
      ? metric
      : null;
  }

  if (
    unit ===
    "UNIT"
  ) {
    if (
      item.metricUnit ===
      "adet"
    ) {
      const metric =
        positive(
          item.metricSize
        );

      if (metric > 0) {
        return metric;
      }
    }

    const quantity =
      positive(
        item.quantity
      );

    return quantity > 0
      ? quantity
      : null;
  }

  return null;
}

export function calculateTailorCompletionEarnings(
  input: {
    operation:
      OperationRecord;
    sale:
      Sale | undefined;
    products:
      Product[];
    rates:
      ServiceRate[];
  }
): TailorCompletionEarningsCalculation {
  const {
    operation,
    sale,
    products,
    rates
  } = input;

  if (
    operation.kind !==
    "TAILOR"
  ) {
    return {
      ok: false,
      reason:
        "NOT_TAILOR"
    };
  }

  if (
    operation.status !==
      "COMPLETED" ||
    !operation.completedAt
  ) {
    return {
      ok: false,
      reason:
        "NOT_COMPLETED"
    };
  }

  const providerCustomerId =
    operation.party
      ?.providerCustomerId
      ?.trim();

  if (!providerCustomerId) {
    return {
      ok: false,
      reason:
        "PROVIDER_NOT_ASSIGNED"
    };
  }

  if (!sale) {
    return {
      ok: false,
      reason:
        "SALE_NOT_FOUND"
    };
  }

  const sewingItems =
    flatten(sale)
      .filter(
        item => {
          const product =
            products.find(
              candidate =>
                candidate.id ===
                item.stockItemId
            );

          return (
            product
              ?.requiresSewing ===
            true
          );
        }
      );

  if (
    sewingItems.length ===
    0
  ) {
    return {
      ok: false,
      reason:
        "NO_SEWING_ITEMS"
    };
  }

  let total = 0;

  for (
    const item of sewingItems
  ) {
    const product =
      products.find(
        candidate =>
          candidate.id ===
          item.stockItemId
      );

    if (!product) {
      return {
        ok: false,
        reason:
          "PRODUCT_NOT_FOUND"
      };
    }

    const serviceStockItemId =
      String(
        product
          .sewingServiceStockItemId ||
        ""
      ).trim();

    if (!serviceStockItemId) {
      return {
        ok: false,
        reason:
          "SEWING_SERVICE_NOT_LINKED"
      };
    }

    const rate =
      resolveServiceRate({
        tenantId:
          operation.tenantId,
        companyId:
          operation.companyId,
        branchId:
          operation.branchId,
        accountingPeriodId:
          operation
            .accountingPeriodId,
        rates,
        providerCustomerId,
        providerType:
          "TAILOR",
        serviceStockItemId,
        occurredAt:
          operation.completedAt
      });

    if (!rate.ok) {
      return {
        ok: false,
        reason:
          rate.reason ===
          "AMBIGUOUS_RATE"
            ? "RATE_AMBIGUOUS"
            : "RATE_NOT_FOUND"
      };
    }

    const quantity =
      quantityForRate(
        item,
        rate.rate.unit
      );

    if (quantity === null) {
      return {
        ok: false,
        reason:
          (
            rate.rate.unit ===
              "METER" ||
            rate.rate.unit ===
              "M2"
          )
            ? "UNIT_MISMATCH"
            : "INVALID_QUANTITY"
      };
    }

    const cost =
      calculateServiceCost(
        rate.rate,
        quantity
      );

    if (cost === null) {
      return {
        ok: false,
        reason:
          "INVALID_QUANTITY"
      };
    }

    total += cost;
  }

  return {
    ok: true,
    amount:
      Math.round(
        (
          total +
          Number.EPSILON
        ) *
        100
      ) / 100
  };
}
