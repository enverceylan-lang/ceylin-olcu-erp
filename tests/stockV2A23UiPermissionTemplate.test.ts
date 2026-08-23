import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const page = fs.readFileSync(
  path.join(root, "src/app/stok/page.tsx"),
  "utf8",
);

assert.match(page, /useAuthStore/);
assert.match(page, /hasStockPermission/);
assert.match(page, /stock\.view_physical/);
assert.match(page, /stock\.view_service/);
assert.match(page, /stock\.view_purchase_price/);
assert.match(page, /stock\.view_sale_price/);
assert.match(page, /stock\.create/);
assert.match(page, /stock\.edit/);
assert.match(page, /stock\.excel_export/);

assert.match(page, /Fiziksel Ürünler/);
assert.match(page, /Hizmet Kartları/);
assert.match(page, /effectiveKind !== listKind/);

assert.match(page, /Yeni stok kartı açma yetkiniz yok/);
assert.match(page, /Stok kartı düzenleme yetkiniz yok/);

assert.match(page, /downloadStockExcelTemplate/);
assert.match(page, /Excel Şablonu/);

assert.match(
  page,
  /\{canViewPurchasePrice && \([\s\S]*Alış Referans Fiyatları/,
);
assert.match(
  page,
  /\{canViewSalePrice && \([\s\S]*Satış Referans Fiyatları/,
);

assert.match(page, /saleVatRate:\s*""/);
assert.doesNotMatch(
  page,
  /jumboEnabled|jumboThresholdCm|jumboPricingMode/,
);

console.log(
  "PAK_STOCK_V2_A2_3_UI_PERMISSION_TEMPLATE",
);