import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const page = fs.readFileSync(
  path.join(process.cwd(), "src/app/stok/page.tsx"),
  "utf8",
);

const tableStart = page.indexOf("<thead");
const tableEnd = page.indexOf("</tbody>", tableStart);
assert.ok(tableStart >= 0 && tableEnd > tableStart);

const table = page.slice(tableStart, tableEnd);

assert.match(
  table,
  /\{canViewPurchasePrice && \([\s\S]*Ort\. Alış/,
);
assert.match(
  table,
  /\{canViewPurchasePrice && \([\s\S]*Son Alış/,
);
assert.match(
  table,
  /\{canViewSalePrice && \([\s\S]*Ort\. Satış/,
);
assert.match(
  table,
  /\{canViewSalePrice && \([\s\S]*Önerilen Satış/,
);

assert.match(
  table,
  /\{canViewPurchasePrice && \([\s\S]*averagePurchase/,
);
assert.match(
  table,
  /\{canViewPurchasePrice && \([\s\S]*lastPurchase/,
);
assert.match(
  table,
  /\{canViewSalePrice && \([\s\S]*averageSale/,
);
assert.match(
  table,
  /\{canViewSalePrice && \([\s\S]*suggestedSalePrice/,
);

assert.match(
  page,
  /colSpan=\{6 \+ \(canViewPurchasePrice \? 2 : 0\) \+ \(canViewSalePrice \? 2 : 0\)\}/,
);

assert.match(
  page,
  /disabled=\{!canEditStock\}/,
);

console.log(
  "PAK_STOCK_V2_A2_4_TABLE_PRICE_PERMISSION_CLOSURE",
);