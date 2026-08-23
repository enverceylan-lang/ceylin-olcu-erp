export type StockV2ProductFamily =
  | "TUL"
  | "FON"
  | "GUNESLIK"
  | "STOR"
  | "ZEBRA"
  | "JALUZI"
  | "PLICELL"
  | "DIKEY_TUL"
  | "DIKEY_STOR"
  | "CEYIZLIK"
  | "AKSESUAR"
  | "RUSTIK"
  | "OTHER";

export type StockV2CanonicalUnit = "mt" | "m2" | "adet" | "manual";
export type StockV2MeasurementBehavior =
  | "TEXTILE_METER"
  | "MECHANICAL_WIDTH_HEIGHT"
  | "PIECE"
  | "RUSTIK_WIDTH"
  | "MANUAL";

export type StockV2BottomFinishKind = "HEM_MODEL" | "HEM_LASER";
export type StockV2BottomFinishSelection =
  | { kind: "NONE" }
  | { kind: "HEM_MODEL"; optionId: string }
  | { kind: "HEM_LASER"; optionId: string };

export type StockV2PricingBasis = "WIDTH_METER" | "AREA_M2" | "PIECE" | "FIXED";

export interface StockV2Scope {
  tenantId: string;
  companyId: string;
  branchId: string;
  accountingPeriodId: string;
}

export interface StockV2ProductProfile {
  id: string;
  productId: string;
  scope: StockV2Scope;
  family: StockV2ProductFamily;
  canonicalUnit: StockV2CanonicalUnit;
  measurementBehavior: StockV2MeasurementBehavior;
  bottomFinishEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockV2BottomFinishOption {
  id: string;
  productId: string;
  scope: StockV2Scope;
  kind: StockV2BottomFinishKind;
  code: string;
  name: string;
  pricingBasis: StockV2PricingBasis;
  purchaseUnitPrice?: number;
  saleUnitPrice?: number;
  purchaseVatRate?: number;
  saleVatRate?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}