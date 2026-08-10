import {
  calculateServiceCost,
  resolveServiceRate,
  type ServiceRateUnit
} from "@/lib/serviceRateEngine";
import {
  createEstimatedEarningFromCompletedOperation
} from "@/lib/providerCompletionEarningsBridge";
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
import type {
  ServiceRate
} from "@/lib/serviceRateEngine";
import type {
  ProviderEarningsLedgerState
} from "@/lib/providerEarningsLedgerService";

export type InstallationCompletionEarningsResult =
  | {
      outcome:
        "INTERNAL_NO_EARNINGS";
      amount:
        0;
    }
  | {
      outcome:
        "CREATED" |
        "REPLAY";
      amount:
        number;
      entryId:
        string;
    }
  | {
      outcome:
        "REJECTED";
      reason:
        | "NOT_INSTALLATION"
        | "NOT_COMPLETED"
        | "NOT_EXTERNAL_INSTALLER"
        | "SALE_NOT_FOUND"
        | "NO_INSTALLABLE_ITEMS"
        | "PRODUCT_NOT_FOUND"
        | "INSTALLATION_SERVICE_NOT_LINKED"
        | "RATE_NOT_FOUND"
        | "RATE_AMBIGUOUS"
        | "UNIT_MISMATCH"
        | "INVALID_QUANTITY"
        | "EARNINGS_BRIDGE_REJECTED";
    };

function positiveNumber(
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

function resolveQuantity(
  item: SaleItem,
  unit: ServiceRateUnit
): number | null {
  if (unit === "JOB") {
    return 1;
  }

  if (unit === "M2") {
    if (item.metricUnit !== "m2") {
      return null;
    }

    const value =
      positiveNumber(
        item.metricSize
      );

    return value > 0
      ? value
      : null;
  }

  if (unit === "METER") {
    if (item.metricUnit !== "mt") {
      return null;
    }

    const value =
      positiveNumber(
        item.metricSize
      );

    return value > 0
      ? value
      : null;
  }

  if (unit === "UNIT") {
    if (item.metricUnit === "adet") {
      const metric =
        positiveNumber(
          item.metricSize
        );

      if (metric > 0) {
        return metric;
      }
    }

    const quantity =
      positiveNumber(
        item.quantity
      );

    return quantity > 0
      ? quantity
      : null;
  }

  return null;
}

function flattenSaleItems(
  sale: Sale
): SaleItem[] {
  const result:
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
      result.push(
        ...item.productionBreakdown
      );
      continue;
    }

    result.push(item);
  }

  return result;
}

export function calculateInstallationEarningsAmount(
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
):
  | {
      ok: true;
      amount: number;
    }
  | {
      ok: false;
      reason:
        Exclude<
          InstallationCompletionEarningsResult,
          {
            outcome:
              "INTERNAL_NO_EARNINGS" |
              "CREATED" |
              "REPLAY";
          }
        >["reason"];
    } {
  const {
    operation,
    sale,
    products,
    rates
  } = input;

  if (
    operation.kind !==
    "INSTALLATION"
  ) {
    return {
      ok: false,
      reason:
        "NOT_INSTALLATION"
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

  if (
    operation.party
      ?.assignmentType ===
    "INTERNAL"
  ) {
    return {
      ok: true,
      amount: 0
    };
  }

  if (
    operation.party
      ?.assignmentType !==
      "EXTERNAL" ||
    !operation.party
      .providerCustomerId
  ) {
    return {
      ok: false,
      reason:
        "NOT_EXTERNAL_INSTALLER"
    };
  }

  if (!sale) {
    return {
      ok: false,
      reason:
        "SALE_NOT_FOUND"
    };
  }

  const installableItems =
    flattenSaleItems(sale)
      .filter(item => {
        const product =
          products.find(
            candidate =>
              candidate.id ===
              item.stockItemId
          );

        return (
          product
            ?.requiresInstallation ===
          true
        );
      });

  if (
    installableItems.length ===
    0
  ) {
    return {
      ok: false,
      reason:
        "NO_INSTALLABLE_ITEMS"
    };
  }

  let total = 0;

  for (
    const item of installableItems
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
          .installationServiceStockItemId ||
        ""
      ).trim();

    if (
      !serviceStockItemId
    ) {
      return {
        ok: false,
        reason:
          "INSTALLATION_SERVICE_NOT_LINKED"
      };
    }

    const rateResult =
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
        providerCustomerId:
          operation.party
            .providerCustomerId,
        providerType:
          "INSTALLER",
        serviceStockItemId,
        occurredAt:
          operation.completedAt
      });

    if (!rateResult.ok) {
      return {
        ok: false,
        reason:
          rateResult.reason ===
          "AMBIGUOUS_RATE"
            ? "RATE_AMBIGUOUS"
            : "RATE_NOT_FOUND"
      };
    }

    const quantity =
      resolveQuantity(
        item,
        rateResult.rate.unit
      );

    if (quantity === null) {
      return {
        ok: false,
        reason:
          (
            rateResult.rate.unit ===
              "M2" ||
            rateResult.rate.unit ===
              "METER"
          )
            ? "UNIT_MISMATCH"
            : "INVALID_QUANTITY"
      };
    }

    const cost =
      calculateServiceCost(
        rateResult.rate,
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

export function createAutomaticInstallationEarning(
  input: {
    operation:
      OperationRecord;
    sale:
      Sale | undefined;
    products:
      Product[];
    rates:
      ServiceRate[];
    ledger:
      ProviderEarningsLedgerState;
  }
): InstallationCompletionEarningsResult {
  const {
    operation
  } = input;

  if (
    operation.party
      ?.assignmentType ===
    "INTERNAL"
  ) {
    return {
      outcome:
        "INTERNAL_NO_EARNINGS",
      amount: 0
    };
  }

  const calculated =
    calculateInstallationEarningsAmount(
      input
    );

  if (!calculated.ok) {
    return {
      outcome:
        "REJECTED",
      reason:
        calculated.reason
    };
  }

  const entryId =
    [
      "provider-earning",
      operation.id
    ].join(":");

  const result =
    createEstimatedEarningFromCompletedOperation({
      state:
        input.ledger,
      operation,
      earningsEntryId:
        entryId,
      currency:
        "TRY",
      estimatedAmount:
        calculated.amount
    });

  if (
    result.outcome ===
    "REJECTED" ||
    result.outcome ===
    "NOT_FOUND"
  ) {
    return {
      outcome:
        "REJECTED",
      reason:
        "EARNINGS_BRIDGE_REJECTED"
    };
  }

  return {
    outcome:
      result.outcome ===
      "REPLAY"
        ? "REPLAY"
        : "CREATED",
    amount:
      calculated.amount,
    entryId
  };
}