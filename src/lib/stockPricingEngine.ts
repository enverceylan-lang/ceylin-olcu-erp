export interface StockCostLotInput {
  stockItemId: string;
  onHandMeters: number;
  unusableMeters?: number;
  purchaseUnitCost?: number;
  receivedAt?: string;
}

export interface StockSalePriceInput {
  stockItemId: string;
  unitPrice: number;
  quantity: number;
  occurredAt: string;
}

export interface StockPurchaseSummary {
  quantity: number;
  averageUnitCost: number | null;
  lastUnitCost: number | null;
}

export interface StockSaleSummary {
  quantity: number;
  averageUnitPrice: number | null;
  lastUnitPrice: number | null;
}

export interface SuggestedSalePriceInput {
  averagePurchaseCost: number | null;
  serviceCost?: number;
  overheadAmount?: number;
  financeCost?: number;
  otherDirectCost?: number;
  targetProfitRate?: number;
}

export interface SuggestedSalePriceResult {
  baseCost: number | null;
  suggestedSalePrice: number | null;
}

const EPSILON = 0.000001;

function finiteNonNegative(
  value: unknown,
): number | null {
  const numeric = Number(value);

  if (
    !Number.isFinite(numeric) ||
    numeric < 0
  ) {
    return null;
  }

  return numeric;
}

function roundMoney(value: number): number {
  return (
    Math.round(
      (value + Number.EPSILON) * 100,
    ) / 100
  );
}

export function calculateCurrentStockAveragePurchasePrice(
  lots: StockCostLotInput[],
  stockItemId: string,
): StockPurchaseSummary {
  let totalQuantity = 0;
  let totalCost = 0;
  let lastUnitCost: number | null = null;
  let lastTimestamp = Number.NEGATIVE_INFINITY;

  for (const lot of lots) {
    if (lot.stockItemId !== stockItemId) {
      continue;
    }

    const onHand =
      finiteNonNegative(lot.onHandMeters);
    const unusable =
      finiteNonNegative(
        lot.unusableMeters ?? 0,
      ) ?? 0;

    if (onHand === null) {
      continue;
    }

    const remainingQuantity = Math.max(
      0,
      onHand - unusable,
    );

    if (remainingQuantity <= EPSILON) {
      continue;
    }

    const unitCost = finiteNonNegative(
      lot.purchaseUnitCost,
    );

    if (unitCost === null) {
      return {
        quantity: roundMoney(
          totalQuantity + remainingQuantity,
        ),
        averageUnitCost: null,
        lastUnitCost: null,
      };
    }

    totalQuantity += remainingQuantity;
    totalCost +=
      remainingQuantity * unitCost;

    const timestamp = lot.receivedAt
      ? new Date(lot.receivedAt).getTime()
      : Number.NaN;

    if (
      Number.isFinite(timestamp) &&
      timestamp >= lastTimestamp
    ) {
      lastTimestamp = timestamp;
      lastUnitCost = unitCost;
    }
  }

  if (totalQuantity <= EPSILON) {
    return {
      quantity: 0,
      averageUnitCost: null,
      lastUnitCost: null,
    };
  }

  return {
    quantity: roundMoney(totalQuantity),
    averageUnitCost: roundMoney(
      totalCost / totalQuantity,
    ),
    lastUnitCost,
  };
}

export function calculateSalePriceSummary(
  sales: StockSalePriceInput[],
  stockItemId: string,
): StockSaleSummary {
  const matching = sales
    .filter(item => {
      if (
        item.stockItemId !== stockItemId
      ) {
        return false;
      }

      const quantity =
        finiteNonNegative(item.quantity);
      const unitPrice =
        finiteNonNegative(item.unitPrice);

      return (
        quantity !== null &&
        quantity > EPSILON &&
        unitPrice !== null
      );
    })
    .sort(
      (left, right) =>
        new Date(left.occurredAt).getTime() -
        new Date(right.occurredAt).getTime(),
    );

  if (matching.length === 0) {
    return {
      quantity: 0,
      averageUnitPrice: null,
      lastUnitPrice: null,
    };
  }

  const totalQuantity = matching.reduce(
    (sum, item) =>
      sum + item.quantity,
    0,
  );

  const totalRevenue = matching.reduce(
    (sum, item) =>
      sum +
      item.quantity * item.unitPrice,
    0,
  );

  return {
    quantity: roundMoney(totalQuantity),
    averageUnitPrice:
      totalQuantity > EPSILON
        ? roundMoney(
            totalRevenue / totalQuantity,
          )
        : null,
    lastUnitPrice:
      matching[
        matching.length - 1
      ]?.unitPrice ?? null,
  };
}

export function calculateSuggestedSalePrice(
  input: SuggestedSalePriceInput,
): SuggestedSalePriceResult {
  const purchaseCost =
    finiteNonNegative(
      input.averagePurchaseCost,
    );

  if (purchaseCost === null) {
    return {
      baseCost: null,
      suggestedSalePrice: null,
    };
  }

  const serviceCost =
    finiteNonNegative(
      input.serviceCost ?? 0,
    ) ?? 0;

  const overheadAmount =
    finiteNonNegative(
      input.overheadAmount ?? 0,
    ) ?? 0;

  const financeCost =
    finiteNonNegative(
      input.financeCost ?? 0,
    ) ?? 0;

  const otherDirectCost =
    finiteNonNegative(
      input.otherDirectCost ?? 0,
    ) ?? 0;

  const targetProfitRate =
    finiteNonNegative(
      input.targetProfitRate ?? 0,
    ) ?? 0;

  const baseCost = roundMoney(
    purchaseCost +
      serviceCost +
      overheadAmount +
      financeCost +
      otherDirectCost,
  );

  return {
    baseCost,
    suggestedSalePrice: roundMoney(
      baseCost *
        (1 + targetProfitRate / 100),
    ),
  };
}