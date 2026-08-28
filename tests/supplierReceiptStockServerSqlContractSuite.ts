import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function main() {
  const sql =
    fs.readFileSync(
      path.join(
        process.cwd(),
        "docs/sql/20260825_supplier_receipt_stock_authority_v1.sql"
      ),
      "utf8"
    );

  const required = [
    /create table if not exists public\.supplier_receipts_v1/,
    /create table if not exists public\.stock_movements_v1/,
    /received_unit text not null check \(received_unit in \('mt','m2','adet'\)\)/,
    /direction text not null check \([\s\S]*direction in \('IN','OUT'\)/,
    /source_type in \('SUPPLIER_RECEIPT'\)/,
    /force row level security/,
    /revoke all on public\.supplier_receipts_v1[\s\S]*from public, anon, authenticated/,
    /revoke all on public\.stock_movements_v1[\s\S]*from public, anon, authenticated/,
    /create or replace function public\.persist_supplier_receipt_stock_v1/,
    /security definer/,
    /set search_path = pg_catalog, public/,
    /SUPPLIER_RECEIPT_IDEMPOTENCY_CONFLICT/,
    /SUPPLIER_RECEIPT_OVER_RECEIPT/,
    /p_command->>'supplierOrderLineId'/,
    /and l\.supplier_order_line_id=v_line_id/,
    /for update/,
    /insert into public\.supplier_receipts_v1/,
    /insert into public\.stock_movements_v1/,
    /update public\.supplier_orders_v1/,
    /grant execute on function[\s\S]*persist_supplier_receipt_stock_v1[\s\S]*to service_role/
  ];

  for (const pattern of required) {
    assert.match(sql, pattern);
  }

  assert.doesNotMatch(
    sql,
    /grant execute on function[\s\S]*persist_supplier_receipt_stock_v1[\s\S]*to (anon|authenticated)/
  );

  console.log(
    "supplierReceiptStockServerSqlContractSuite: PASS"
  );
}

main();