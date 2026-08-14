import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync(
  "docs/sql/20260814_finance_account_master_foundation_v1.sql",
  "utf8",
);

for (const table of [
  "finance_accounts",
  "cash_accounts",
  "bank_accounts",
  "pos_accounts",
  "finance_account_master_operations",
]) {
  assert.match(
    sql,
    new RegExp(`create table if not exists public\\.${table}`, "i"),
  );
}

assert.match(
  sql,
  /finance_accounts_scope_id_uk[\s\S]*tenant_id[\s\S]*company_id[\s\S]*branch_id[\s\S]*accounting_period_id[\s\S]*id/i,
);
assert.match(sql, /cash_accounts_ledger_fk/i);
assert.match(sql, /bank_accounts_ledger_fk/i);
assert.match(sql, /pos_accounts_bank_fk/i);
assert.match(sql, /pos_accounts_clearing_ledger_fk/i);

assert.doesNotMatch(
  sql,
  /\bbalance\b\s+(numeric|decimal|double|real|integer|bigint)/i,
);

assert.match(sql, /enable row level security/gi);
assert.match(sql, /force row level security/gi);
assert.match(sql, /revoke delete on public\.finance_accounts from service_role/i);
assert.match(sql, /revoke delete on public\.cash_accounts from service_role/i);
assert.match(sql, /revoke delete on public\.bank_accounts from service_role/i);
assert.match(sql, /revoke delete on public\.pos_accounts from service_role/i);

assert.match(sql, /manage_finance_account_master_v1/i);
assert.match(sql, /security definer/i);
assert.match(sql, /auth\.role\(\) is distinct from 'service_role'/i);
assert.match(sql, /FINANCE_ACCOUNT_MASTER_IDEMPOTENCY_REQUIRED/i);
assert.match(sql, /payload_hash/i);
assert.match(sql, /for update/i);
assert.match(sql, /FINANCE_BANK_HAS_ACTIVE_POS/i);
assert.doesNotMatch(sql, /\bdelete\s+from\s+public\.(finance|cash|bank|pos)_accounts/i);

console.log("[PASS] Finance V1-A account master SQL foundation contract");