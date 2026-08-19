import type { SaleItem } from "@/store/salesStore";
import { erpScopeMatches, validateErpScope, type ErpScope } from "@/lib/erpScope";

export interface CanonicalSaleLineSourceV1 {
  sourceSaleItemId: string;
  sourceMeasurementIds: string[];
  sourceType: "MEASUREMENT" | "MANUAL";
  stockItemId: string | null;
  roomName: string;
  windowName: string;
  productType: string;
  productGroup: string;
  quantity: number;
  metricSize: number;
  metricUnit: "m2" | "mt" | "adet";
  unitPrice: number;
  discount: number;
  rowTotal: number;
  note: string | null;
}

export interface PersistSaleLineSourceRequestV1 extends ErpScope {
  saleId: string;
  customerId: string;
  currency: string;
  saleTotal: number;
  lines: CanonicalSaleLineSourceV1[];
}

const clean = (value: unknown): string => String(value ?? "").trim();

function positive(value: number, code: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(code);
  return value;
}

function nonNegative(value: number, code: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(code);
  return value;
}

function measurementIds(value: string | undefined): string[] {
  return [...new Set(clean(value).split(",").map(x => x.trim()).filter(Boolean))];
}

export function projectCanonicalSaleLineSourceV1(item: SaleItem): CanonicalSaleLineSourceV1 {
  const sourceSaleItemId = clean(item.id);
  if (!sourceSaleItemId) throw new Error("SALE_LINE_SOURCE_ITEM_ID_REQUIRED");

  const sourceMeasurementIds = measurementIds(item.measurementId);
  const sourceType = sourceMeasurementIds.length > 0 ? "MEASUREMENT" : "MANUAL";
  const stockItemId = clean(item.stockItemId) || null;

  if (sourceType === "MEASUREMENT" && !stockItemId) {
    throw new Error("SALE_LINE_SOURCE_MEASUREMENT_STOCK_REQUIRED");
  }

  const productType = clean(item.productType);
  const productGroup = clean(item.productGroup);
  if (!productType || !productGroup) throw new Error("SALE_LINE_SOURCE_PRODUCT_REQUIRED");

  return {
    sourceSaleItemId,
    sourceMeasurementIds,
    sourceType,
    stockItemId,
    roomName: clean(item.roomName),
    windowName: clean(item.windowName),
    productType,
    productGroup,
    quantity: positive(item.quantity, "SALE_LINE_SOURCE_QUANTITY_INVALID"),
    metricSize: positive(item.metricSize, "SALE_LINE_SOURCE_METRIC_SIZE_INVALID"),
    metricUnit: item.metricUnit,
    unitPrice: nonNegative(item.unitPrice, "SALE_LINE_SOURCE_UNIT_PRICE_INVALID"),
    discount: nonNegative(item.discount, "SALE_LINE_SOURCE_DISCOUNT_INVALID"),
    rowTotal: nonNegative(item.rowTotal, "SALE_LINE_SOURCE_ROW_TOTAL_INVALID"),
    note: clean(item.note) || null
  };
}

export function assertPersistSaleLineSourceRequestV1(
  input: PersistSaleLineSourceRequestV1,
  serverScope: ErpScope
): void {
  if (!validateErpScope(serverScope).valid) throw new Error("SALE_LINE_SOURCE_SERVER_SCOPE_INVALID");
  if (!validateErpScope(input).valid) throw new Error("SALE_LINE_SOURCE_REQUEST_SCOPE_INVALID");
  if (!erpScopeMatches(input, serverScope)) throw new Error("SALE_LINE_SOURCE_SCOPE_MISMATCH");
  if (!clean(input.saleId) || !clean(input.customerId)) throw new Error("SALE_LINE_SOURCE_BINDING_REQUIRED");
  if (!/^[A-Z]{3}$/.test(clean(input.currency))) throw new Error("SALE_LINE_SOURCE_CURRENCY_INVALID");
  positive(input.saleTotal, "SALE_LINE_SOURCE_TOTAL_INVALID");
  if (!Array.isArray(input.lines) || input.lines.length === 0) throw new Error("SALE_LINE_SOURCE_LINES_REQUIRED");

  const ids = new Set<string>();
  for (const line of input.lines) {
    const id = clean(line.sourceSaleItemId);
    if (!id) throw new Error("SALE_LINE_SOURCE_ITEM_ID_REQUIRED");
    if (ids.has(id)) throw new Error("SALE_LINE_SOURCE_ITEM_ID_DUPLICATE");
    ids.add(id);
    if (line.sourceType === "MEASUREMENT" && !clean(line.stockItemId)) {
      throw new Error("SALE_LINE_SOURCE_MEASUREMENT_STOCK_REQUIRED");
    }
    positive(line.quantity, "SALE_LINE_SOURCE_QUANTITY_INVALID");
    positive(line.metricSize, "SALE_LINE_SOURCE_METRIC_SIZE_INVALID");
    nonNegative(line.unitPrice, "SALE_LINE_SOURCE_UNIT_PRICE_INVALID");
    nonNegative(line.discount, "SALE_LINE_SOURCE_DISCOUNT_INVALID");
    nonNegative(line.rowTotal, "SALE_LINE_SOURCE_ROW_TOTAL_INVALID");
  }
}
