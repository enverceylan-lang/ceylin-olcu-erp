import assert from "node:assert/strict";
import fs from "node:fs";

const report = fs.readFileSync(
  "src/components/reports/MeasurementVisualReport.tsx",
  "utf8",
);

const sales = fs.readFileSync(
  "src/lib/salesAdapter.ts",
  "utf8",
);

const cari = fs.readFileSync(
  "src/app/cariler/[id]/page.tsx",
  "utf8",
);

assert.match(
  report,
  /\(m\.openingId \|\| m\.windowId\) === win\.id/,
);

assert.match(
  report,
  /window\.isSecureContext[\s\S]*shareNavigator\.canShare/,
);

assert.match(
  sales,
  /w\.id === \(m\.openingId \|\| m\.windowId\)/,
);

assert.match(
  sales,
  /targetSaleId\?: string/,
);

assert.match(
  sales,
  /TARGET_SALE_NOT_FOUND_OR_NOT_EDITABLE/,
);

assert.match(
  cari,
  /if \(returnSaleId\)[\s\S]*?scope,\s*returnSaleId\s*\)[\s\S]*?router\.push\(`\/satis\/\$\{returnSaleId\}`\)/,
);

console.log(
  "PAK_MEASUREMENT_PDF_WHATSAPP_SALE_BRIDGE_REGRESSION_V4"
);
