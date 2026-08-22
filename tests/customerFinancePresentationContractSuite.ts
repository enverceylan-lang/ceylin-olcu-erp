import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const panel = fs.readFileSync(
  path.join(root, "src/components/finance/CustomerFinancePanel.tsx"),
  "utf8",
);

const table = fs.readFileSync(
  path.join(root, "src/components/finance/FinanceTransactionTable.tsx"),
  "utf8",
);

assert.match(table, /documentHeader\s*=\s*"Satış"/);
assert.match(table, /sourceHeader\s*=\s*"Kaynak"/);
assert.match(table, /getDocumentLabel/);
assert.match(table, /getSourceLabel/);
assert.match(table, /onDocumentClick/);

assert.match(panel, /documentHeader="Belge No"/);
assert.match(panel, /sourceHeader="İşlem Türü"/);
assert.match(panel, /SALE_PAYMENT[\s\S]*Satış Tahsilatı/);
assert.match(panel, /SALE_RETURN[\s\S]*Satış İadesi/);
assert.match(panel, /saleById\.get\(transaction\.saleId\)\?\.saleNo/);
assert.match(
  panel,
  /onDocumentClick=\{\(transaction\) => setSelectedSaleId\(transaction\.saleId\)\}/,
);

assert.match(panel, /Satış Detayı — Salt Okunur/);
assert.match(panel, /selectedSale\.items\.map/);
assert.match(panel, /selectedSale\.totalAmount/);
assert.match(panel, /selectedSale\.payments/);
assert.match(panel, /selectedSale\.remainingBalance/);
assert.match(panel, /Bu panel yalnız görüntüleme içindir/);

assert.doesNotMatch(panel, /updateSale\(/);
assert.doesNotMatch(panel, /removeSale\(/);
assert.doesNotMatch(panel, /deleteSale\(/);

console.log("[PASS] customer finance presentation + read-only sale detail");