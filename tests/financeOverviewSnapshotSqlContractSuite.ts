import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(
  resolve(process.cwd(), "docs/sql/20260825_finance_overview_snapshot_v1.sql"),
  "utf8",
);

assert.match(sql, /read_finance_overview_snapshot_v1\(jsonb,text\)/i);
assert.match(sql, /security definer/i);
assert.match(sql, /set search_path = pg_catalog,\s*public/i);
assert.match(sql, /auth\.role\(\)\s+is distinct from\s+'service_role'/i);

for (const scope of [
  "tenant_id = v_tenant",
  "company_id = v_company",
  "branch_id = v_branch",
  "accounting_period_id = v_period",
  "currency = v_currency",
]) {
  assert.match(sql, new RegExp(scope.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
}

assert.match(sql, /finance_receivable_open_items_v1/i);
assert.match(sql, /finance_collection_allocations_v1/i);
assert.match(sql, /counterparty_payable_movements/i);
assert.match(sql, /finance_transactions/i);
assert.match(sql, /finance_accounts/i);
assert.match(sql, /finance_pos_transactions_v1/i);

assert.match(sql, /status = 'POSTED'[\s\S]*reversed_at is null/i);
assert.match(sql, /account_type in \('CASH','BANK'\)/i);
assert.match(sql, /direction = 'DEBIT' then net_amount/i);
assert.match(sql, /direction = 'CREDIT' then -net_amount/i);

assert.match(
  sql,
  /status in \('PENDING_SETTLEMENT','PARTIALLY_SETTLED'\)/i,
);
assert.match(
  sql,
  /sum\(pt\.pending_amount\)/i,
);

assert.match(
  sql,
  /movement_kind in \('ACCRUAL','PAYMENT'\)[\s\S]*not exists[\s\S]*movement_kind = 'REVERSAL'[\s\S]*reversal_of_movement_id = m\.movement_id/i,
);

const body = sql.split("as $function$")[1]?.split("$function$;")[0] || "";
assert.doesNotMatch(body, /\binsert\s+into\b/i);
assert.doesNotMatch(body, /\bupdate\s+/i);
assert.doesNotMatch(body, /\bdelete\s+from\b/i);
assert.doesNotMatch(body, /\bfor\s+update\b/i);

assert.match(
  sql,
  /revoke all[\s\S]*read_finance_overview_snapshot_v1\(jsonb,text\)[\s\S]*from public,\s*anon,\s*authenticated,\s*service_role/i,
);
assert.match(
  sql,
  /grant execute[\s\S]*read_finance_overview_snapshot_v1\(jsonb,text\)[\s\S]*to service_role/i,
);

console.log("[PASS] F3 overview SQL is read-only, scoped and fail-closed");
console.log("[PASS] F3 cash-bank ledger semantics are reversal-aware");
console.log("[PASS] F3 POS pending is not double-counted into bank");
console.log("[PASS] F3 payable reversal excludes reversed source movements");
