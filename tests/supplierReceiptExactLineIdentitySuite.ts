import assert from "node:assert/strict";
import fs from "node:fs";

const server = fs.readFileSync(
  "src/lib/supplierReceiptStockServerContract.ts",
  "utf8"
);
const sql = fs.readFileSync(
  "docs/sql/20260825_supplier_receipt_stock_authority_v1.sql",
  "utf8"
);
const ui = fs.readFileSync(
  "src/components/operations/MaterialCutDecisionPanel.tsx",
  "utf8"
);

assert.match(server, /supplierOrderLineId: string/);
assert.match(sql, /p_command->>'supplierOrderLineId'/);
assert.match(sql, /and l\.supplier_order_line_id=v_line_id/);
assert.match(ui, /supplierOrderLineId/);
assert.match(ui, /readCentralSupplierReceiptLines/);

console.log("supplierReceiptExactLineIdentitySuite: PASS");
