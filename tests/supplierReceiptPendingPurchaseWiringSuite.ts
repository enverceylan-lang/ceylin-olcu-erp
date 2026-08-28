import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ui = fs.readFileSync(
  path.join(process.cwd(), "src/components/operations/MaterialCutDecisionPanel.tsx"),
  "utf8"
);

assert.doesNotMatch(ui, /registerSupplierReceiptPayable/);
assert.match(ui, /\.createPurchaseDocument\(\{/);
assert.match(ui, /idempotencyKey:\s*`PENDING_PURCHASE:\$\{request\.id\}`/);
assert.match(ui, /supplierReceiptId:\s*request\.id/);
assert.match(ui, /unitPrice:\s*null/);
assert.match(ui, /taxRate:\s*null/);
assert.match(ui, /taxIncluded:\s*null/);
assert.match(ui, /Finansal borç oluşturulmadı/);

console.log("supplierReceiptPendingPurchaseWiringSuite: PASS");
