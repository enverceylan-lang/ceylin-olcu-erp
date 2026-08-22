import assert from "node:assert/strict";
import fs from "node:fs";

const picker = fs.readFileSync(
  "src/components/stock/StockItemPicker.tsx",
  "utf8",
);
const sale = fs.readFileSync(
  "src/app/satis/[id]/page.tsx",
  "utf8",
);
const adapter = fs.readFileSync(
  "src/lib/salesAdapter.ts",
  "utf8",
);

assert.match(
  picker,
  /className="fixed inset-0 z-\[90\]/,
  "Stock picker must open as a modal overlay.",
);

assert.doesNotMatch(
  picker,
  /absolute left-0 top-full/,
  "Legacy inline dropdown must be removed.",
);

assert.match(
  picker,
  /role="dialog"/,
);

assert.match(
  picker,
  /aria-modal="true"/,
);

assert.match(
  picker,
  /event\.key === "Escape"/,
);

assert.match(
  picker,
  /onRequestClose\?:/,
);

assert.match(
  picker,
  /autoOpen\?:/,
);

assert.match(
  picker,
  /hideTrigger\?:/,
);

assert.match(
  picker,
  /BarcodeScannerButton/,
);

assert.match(
  picker,
  /filterProduct\?:/,
);

assert.match(
  picker,
  /excludedBarcodeMatch/,
);

assert.match(
  sale,
  /pickerTitle=\{`\$\{item\.productType \|\| item\.productGroup \|\| "Ürün"\} Stok Seç`\}/,
);

assert.match(
  sale,
  /pickerTitle="Harici Ürün \/ Stok Seç"/,
);

assert.match(
  sale,
  /className="fixed inset-x-0 bottom-0 z-\[70\]/,
  "Mobile bottom action bar must remain reachable.",
);

assert.match(
  sale,
  /\+ Satır Ekle/,
);

assert.match(
  sale,
  /\+ Harici Ürün \/ Stok Ekle/,
);

assert.match(
  sale,
  /sale\.status === "TASLAK"[\s\S]*sale\.status === "TEKLİF"/,
  "Bottom edit actions must stay limited to editable sale states.",
);

assert.match(
  sale,
  /isStockAllowedForMeasuredSaleItem/,
);

assert.match(
  sale,
  /isExternalSaleStockAllowed/,
);

assert.match(
  sale,
  /returnSaleId/,
);

assert.match(
  sale,
  /Satışa Hazırlığı Gör/,
);

assert.match(
  sale,
  /Satışı Onayla/,
);

assert.match(
  adapter,
  /const manualItems:\s*SaleItem\[\]\s*=[\s\S]*!item\.measurementId/,
  "Manual/adet rows must still survive measurement refresh.",
);

assert.match(
  adapter,
  /const refreshedAutomaticItems:\s*SaleItem\[\][\s\S]*Boolean\(item\.measurementId\)/,
  "Measurement rows must keep their automatic refresh path.",
);

console.log(
  "PAK_SALE_STOCK_PICKER_MOBILE_ACTION_CLOSURE",
);