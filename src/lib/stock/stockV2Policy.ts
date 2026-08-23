import type {
  StockV2BottomFinishOption,
  StockV2BottomFinishSelection,
  StockV2CanonicalUnit,
  StockV2MeasurementBehavior,
  StockV2ProductFamily,
  StockV2ProductProfile,
  StockV2Scope,
} from "./stockV2Contracts";

export interface StockV2FamilyRule {
  canonicalUnit: StockV2CanonicalUnit;
  measurementBehavior: StockV2MeasurementBehavior;
  bottomFinishEnabled: boolean;
}

const FAMILY_RULES: Readonly<Partial<Record<StockV2ProductFamily, StockV2FamilyRule>>> = {
  TUL: { canonicalUnit: "mt", measurementBehavior: "TEXTILE_METER", bottomFinishEnabled: false },
  FON: { canonicalUnit: "mt", measurementBehavior: "TEXTILE_METER", bottomFinishEnabled: false },
  GUNESLIK: { canonicalUnit: "mt", measurementBehavior: "TEXTILE_METER", bottomFinishEnabled: false },
  STOR: { canonicalUnit: "m2", measurementBehavior: "MECHANICAL_WIDTH_HEIGHT", bottomFinishEnabled: true },
  ZEBRA: { canonicalUnit: "m2", measurementBehavior: "MECHANICAL_WIDTH_HEIGHT", bottomFinishEnabled: true },
  JALUZI: { canonicalUnit: "m2", measurementBehavior: "MECHANICAL_WIDTH_HEIGHT", bottomFinishEnabled: false },
  PLICELL: { canonicalUnit: "m2", measurementBehavior: "MECHANICAL_WIDTH_HEIGHT", bottomFinishEnabled: false },
  DIKEY_TUL: { canonicalUnit: "m2", measurementBehavior: "MECHANICAL_WIDTH_HEIGHT", bottomFinishEnabled: false },
  DIKEY_STOR: { canonicalUnit: "m2", measurementBehavior: "MECHANICAL_WIDTH_HEIGHT", bottomFinishEnabled: false },
  CEYIZLIK: { canonicalUnit: "adet", measurementBehavior: "PIECE", bottomFinishEnabled: false },
  AKSESUAR: { canonicalUnit: "adet", measurementBehavior: "PIECE", bottomFinishEnabled: false },
  RUSTIK: { canonicalUnit: "manual", measurementBehavior: "RUSTIK_WIDTH", bottomFinishEnabled: false },
  OTHER: { canonicalUnit: "manual", measurementBehavior: "MANUAL", bottomFinishEnabled: false },
};

function required(value: string): boolean { return value.trim().length > 0; }
function finiteNonNegative(value: number | undefined): boolean {
  return value === undefined || (Number.isFinite(value) && value >= 0);
}
function validVat(value: number | undefined): boolean {
  return value === undefined || (Number.isFinite(value) && value >= 0 && value <= 100);
}

export function stockV2ScopeKey(scope: StockV2Scope): string {
  if (!required(scope.tenantId) || !required(scope.companyId) || !required(scope.branchId) || !required(scope.accountingPeriodId)) {
    throw new Error("STOCK_V2_SCOPE_REQUIRED");
  }
  return [scope.tenantId.trim(), scope.companyId.trim(), scope.branchId.trim(), scope.accountingPeriodId.trim()].join(":");
}

export function resolveStockV2FamilyRule(family: StockV2ProductFamily): StockV2FamilyRule {
  const rule = FAMILY_RULES[family];
  if (!rule) throw new Error(`STOCK_V2_FAMILY_RULE_MISSING:${family}`);
  return rule;
}

export function buildStockV2Profile(
  input: Omit<StockV2ProductProfile, "canonicalUnit" | "measurementBehavior" | "bottomFinishEnabled">,
): StockV2ProductProfile {
  if (!required(input.id) || !required(input.productId)) throw new Error("STOCK_V2_PROFILE_IDENTITY_REQUIRED");
  stockV2ScopeKey(input.scope);
  const rule = resolveStockV2FamilyRule(input.family);
  return { ...input, canonicalUnit: rule.canonicalUnit, measurementBehavior: rule.measurementBehavior, bottomFinishEnabled: rule.bottomFinishEnabled };
}

export function validateStockV2BottomFinishOption(
  option: StockV2BottomFinishOption,
  profile: StockV2ProductProfile,
): void {
  stockV2ScopeKey(option.scope);
  if (!required(option.id) || !required(option.productId) || !required(option.code) || !required(option.name)) {
    throw new Error("STOCK_V2_FINISH_OPTION_REQUIRED");
  }
  if (option.productId !== profile.productId) throw new Error("STOCK_V2_FINISH_PRODUCT_MISMATCH");
  if (stockV2ScopeKey(option.scope) !== stockV2ScopeKey(profile.scope)) throw new Error("STOCK_V2_FINISH_SCOPE_MISMATCH");
  if (!profile.bottomFinishEnabled) throw new Error("STOCK_V2_FINISH_NOT_ALLOWED_FOR_FAMILY");
  if (!finiteNonNegative(option.purchaseUnitPrice) || !finiteNonNegative(option.saleUnitPrice)) throw new Error("STOCK_V2_FINISH_PRICE_INVALID");
  if (!validVat(option.purchaseVatRate) || !validVat(option.saleVatRate)) throw new Error("STOCK_V2_FINISH_VAT_INVALID");
}

export function validateStockV2BottomFinishSelection(
  selection: StockV2BottomFinishSelection,
  profile: StockV2ProductProfile,
  options: readonly StockV2BottomFinishOption[],
): void {
  if (selection.kind === "NONE") return;
  if (!profile.bottomFinishEnabled) throw new Error("STOCK_V2_FINISH_SELECTION_NOT_ALLOWED");
  const option = options.find(current => current.id === selection.optionId && current.productId === profile.productId && current.isActive);
  if (!option) throw new Error("STOCK_V2_FINISH_OPTION_NOT_FOUND");
  if (option.kind !== selection.kind) throw new Error("STOCK_V2_FINISH_KIND_MISMATCH");
  validateStockV2BottomFinishOption(option, profile);
}