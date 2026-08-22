import assert from "node:assert/strict";
import fs from "node:fs";

import {
  isExternalSaleStockAllowed,
  isStockAllowedForMeasuredSaleItem,
} from "../src/lib/saleStockSelectionPolicy";

const base = {
  id: "stock-1",
  stockCode: "X",
  name: "X",
  category: "Tül",
  unit: "Metre",
  cashPrice: 100,
  installmentPrice: 100,
  dealerPrice: 100,
  productKind: "PHYSICAL" as const,
};

assert.equal(
  isStockAllowedForMeasuredSaleItem(
    base,
    { measurementId: "m1", productType: "TUL" },
  ),
  true,
);

assert.equal(
  isStockAllowedForMeasuredSaleItem(
    { ...base, category: "Stor", unit: "m²" },
    { measurementId: "m1", productType: "TUL" },
  ),
  false,
);

assert.equal(
  isExternalSaleStockAllowed({
    ...base,
    category: "Hazır Stor",
    unit: "Adet",
  }),
  true,
);

assert.equal(
  isExternalSaleStockAllowed({
    ...base,
    category: "Stor",
    unit: "m²",
  }),
  false,
);

assert.equal(
  isExternalSaleStockAllowed({
    ...base,
    category: "Tül",
    unit: "Metre",
  }),
  false,
);

const picker = fs.readFileSync(
  "src/components/stock/StockItemPicker.tsx",
  "utf8",
);
const sale = fs.readFileSync(
  "src/app/satis/[id]/page.tsx",
  "utf8",
);
const cari = fs.readFileSync(
  "src/app/cariler/[id]/page.tsx",
  "utf8",
);
const adapter = fs.readFileSync(
  "src/lib/salesAdapter.ts",
  "utf8",
);

assert.match(picker, /filterProduct\?:/);
assert.match(picker, /excludedBarcodeMatch/);
assert.match(sale, /Satışa Hazırlığı Gör/);
assert.match(sale, /\+ Harici Ürün \/ Stok Ekle/);
assert.match(sale, /isStockAllowedForMeasuredSaleItem/);
assert.match(sale, /isExternalSaleStockAllowed/);
assert.match(cari, /returnSaleId/);
assert.match(cari, /openPreparation/);
assert.match(
  adapter,
  /sale\.status === 'TASLAK'[\s\S]*sale\.status === 'TEKLİF'/,
);

console.log("PAK_SALE_PREPARATION_STOCK_UX_CLOSURE_V2");
