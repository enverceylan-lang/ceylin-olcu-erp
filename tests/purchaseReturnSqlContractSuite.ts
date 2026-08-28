import assert from "node:assert/strict";
import fs from "node:fs";

const sql =
  fs.readFileSync(
    "docs/sql/20260828_purchase_return_authority_v1.sql",
    "utf8",
  );

for (const pattern of [
  /create table if not exists public\.purchase_returns_v1/,
  /create table if not exists public\.purchase_return_lines_v1/,
  /source_type in \([\s\S]*'SUPPLIER_RECEIPT'[\s\S]*'PURCHASE_RETURN'/,
  /enforce_stock_movement_source_v2/,
  /'PURCHASE_RETURN'[\s\S]*'OUT'/,
  /PURCHASE_RETURN_OVER_RETURN/,
  /PURCHASE_RETURN_INSUFFICIENT_STOCK/,
  /persist_counterparty_payable_movement_v1/,
  /'kind',[\s\S]*'REVERSAL'/,
  /'reversalOfMovementId',[\s\S]*v_document[\s\S]*\.payable_movement_id/,
  /for update/,
  /security definer/,
  /set search_path = pg_catalog, public/,
  /grant execute on function[\s\S]*persist_purchase_return_authority_v1[\s\S]*to service_role/,
]) {
  assert.match(
    sql,
    pattern,
  );
}

assert.doesNotMatch(
  sql,
  /delete\s+from\s+public\.(purchase|stock|counterparty)/i,
);

assert.doesNotMatch(
  sql,
  /update\s+public\.supplier_receipts_v1[\s\S]*status\s*=\s*'REVERSED'/i,
);

console.log(
  "purchaseReturnSqlContractSuite: PASS",
);
