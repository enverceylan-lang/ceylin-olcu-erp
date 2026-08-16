import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(
  resolve("docs/sql/20260815_finance_operations_v1_server_persistence.sql"),
  "utf8"
);

assert.match(sql, /alter column customer_id drop not null/i);
assert.match(sql, /alter column sale_id drop not null/i);
assert.match(sql, /counterparty_id text null/i);
assert.match(sql, /operation_group_id text null/i);
assert.match(sql, /finance_operation_requests_v1/i);
assert.match(sql, /persist_finance_operation_v1/i);
assert.match(sql, /security definer/i);
assert.match(sql, /set search_path = pg_catalog, public/i);
assert.match(sql, /auth\.role\(\) is distinct from 'service_role'/i);
assert.match(sql, /for update/i);
assert.match(sql, /order by ba\.id[\s\S]*for update/i);
assert.match(sql, /FINANCE_TRANSFER_SOURCE_BANK_INACTIVE_OR_MISSING/i);
assert.match(sql, /FINANCE_REVERSAL_TARGET_INVALID/i);
assert.match(sql, /revoke delete[\s\S]*finance_operation_requests_v1/i);
assert.doesNotMatch(sql, /delete from/i);

console.log("[PASS] Finance Operations SQL bridge contract");