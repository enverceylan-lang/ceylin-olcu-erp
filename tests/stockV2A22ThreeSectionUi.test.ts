import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const page = fs.readFileSync(
  path.join(root, "src/app/stok/page.tsx"),
  "utf8",
);

const markers =
  page.match(/data-stock-v2-section=/g) ?? [];

assert.equal(
  markers.length,
  3,
  "Stok kartı kullanıcı için tam 3 ana zihinsel bölüm göstermelidir.",
);

assert.match(page, /1\. ÜRÜN/);
assert.match(page, /2\. FİYAT & TEDARİK/);
assert.match(page, /3\. ÜRÜN SEÇENEKLERİ/);

assert.doesNotMatch(
  page,
  />\s*Genel Bilgiler\s*</,
);
assert.doesNotMatch(
  page,
  />\s*Operasyon \/ Fiyatlandırma\s*</,
);

assert.match(page, /Tedarikçi/);
assert.match(page, /value=\{form\.targetProfitRate\}/);
assert.match(page, /value=\{form\.overheadRate\}/);
assert.match(page, /StockV2BottomFinishPanel/);
assert.match(page, /Etek Modeli \/ Etek Lazer/);

assert.match(page, /Alış Referans Fiyatları/);
assert.match(page, /Satış Referans Fiyatları/);
assert.match(page, /Sistem Fiyat Göstergeleri/);

assert.match(page, /requiresSewing/);
assert.match(page, /requiresInstallation/);
assert.match(page, /sewingServiceStockItemId/);
assert.match(page, /installationServiceStockItemId/);

assert.doesNotMatch(
  page,
  /jumboEnabled|jumboThresholdCm|jumboPricingMode/,
  "Stok V2 sade UI patch'i Jumbo davranışını stok ekranına taşımamalıdır.",
);

console.log("PAK_STOCK_V2_A2_2_THREE_SECTION_UI");