export interface SaleStockIdentityCandidate {
  productType: string;
  isActive: boolean;
  stockId?: string;
}

function normalizeProductType(
  value: string | undefined
): string {
  return String(value || "")
    .trim()
    .toLocaleUpperCase("tr-TR");
}

export function resolveSaleStockItemId(
  selectedProducts:
    SaleStockIdentityCandidate[] |
    undefined,
  selectedProductType:
    string | undefined
): string | undefined {
  const active =
    (selectedProducts || [])
      .filter(
        product =>
          product.isActive &&
          Boolean(
            product.stockId?.trim()
          )
      );

  if (active.length === 0) {
    return undefined;
  }

  const wanted =
    normalizeProductType(
      selectedProductType
    );

  if (wanted) {
    const exact =
      active.find(
        product =>
          normalizeProductType(
            product.productType
          ) === wanted
      );

    if (exact?.stockId?.trim()) {
      return exact.stockId.trim();
    }
  }

  if (active.length === 1) {
    return active[0].stockId?.trim() ||
      undefined;
  }

  return undefined;
}