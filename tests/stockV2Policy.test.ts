import test from "node:test";
import assert from "node:assert/strict";
import { buildStockV2Profile, validateStockV2BottomFinishSelection } from "../src/lib/stock/stockV2Policy";
import type { StockV2BottomFinishOption, StockV2Scope } from "../src/lib/stock/stockV2Contracts";

const scope: StockV2Scope = { tenantId: "tenant-1", companyId: "company-1", branchId: "branch-1", accountingPeriodId: "period-1" };
const stamp = "2026-08-23T00:00:00.000Z";

test("dikimlik tekstil canonical olarak metre yurur", () => {
  const profile = buildStockV2Profile({ id: "p1", productId: "stock-1", scope, family: "TUL", createdAt: stamp, updatedAt: stamp });
  assert.equal(profile.canonicalUnit, "mt");
  assert.equal(profile.measurementBehavior, "TEXTILE_METER");
  assert.equal(profile.bottomFinishEnabled, false);
});

test("stor canonical olarak m2 ve EN-BOY ile yurur", () => {
  const profile = buildStockV2Profile({ id: "p2", productId: "stock-2", scope, family: "STOR", createdAt: stamp, updatedAt: stamp });
  assert.equal(profile.canonicalUnit, "m2");
  assert.equal(profile.measurementBehavior, "MECHANICAL_WIDTH_HEIGHT");
  assert.equal(profile.bottomFinishEnabled, true);
});

test("aksesuar canonical olarak adet yurur", () => {
  const profile = buildStockV2Profile({ id: "p3", productId: "stock-3", scope, family: "AKSESUAR", createdAt: stamp, updatedAt: stamp });
  assert.equal(profile.canonicalUnit, "adet");
  assert.equal(profile.measurementBehavior, "PIECE");
});

test("Etek Modeli secimi Etek Lazer kaydina baglanamaz", () => {
  const profile = buildStockV2Profile({ id: "p4", productId: "stock-4", scope, family: "STOR", createdAt: stamp, updatedAt: stamp });
  const lazer: StockV2BottomFinishOption = { id: "lz-1", productId: "stock-4", scope, kind: "HEM_LASER", code: "LZ 01", name: "Etek Lazer 01", pricingBasis: "WIDTH_METER", purchaseUnitPrice: 250, saleUnitPrice: 400, purchaseVatRate: 20, saleVatRate: 20, isActive: true, createdAt: stamp, updatedAt: stamp };
  assert.throws(() => validateStockV2BottomFinishSelection({ kind: "HEM_MODEL", optionId: lazer.id }, profile, [lazer]), /STOCK_V2_FINISH_KIND_MISMATCH/);
});

test("Etek Modeli tul ailesine uygulanamaz", () => {
  const profile = buildStockV2Profile({ id: "p5", productId: "stock-5", scope, family: "TUL", createdAt: stamp, updatedAt: stamp });
  const etek: StockV2BottomFinishOption = { id: "st-1", productId: "stock-5", scope, kind: "HEM_MODEL", code: "ST 01", name: "Etek Modeli 01", pricingBasis: "WIDTH_METER", purchaseUnitPrice: 50, saleUnitPrice: 90, isActive: true, createdAt: stamp, updatedAt: stamp };
  assert.throws(() => validateStockV2BottomFinishSelection({ kind: "HEM_MODEL", optionId: etek.id }, profile, [etek]), /STOCK_V2_FINISH_SELECTION_NOT_ALLOWED/);
});