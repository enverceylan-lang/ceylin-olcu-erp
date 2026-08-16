import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const sql = fs.readFileSync(
  path.join(process.cwd(), "docs/sql/20260816_finance_pos_server_authority_v1.sql"),
  "utf8"
);

for (const table of [
  "finance_pos_contracts_v1",
  "finance_pos_contract_rules_v1",
  "finance_pos_transactions_v1",
  "finance_pos_settlement_schedules_v1",
  "finance_pos_settlement_lines_v1",
  "finance_pos_settlements_v1",
  "finance_pos_monthly_fees_v1"
]) {
  assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, "i"));
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  assert.match(sql, new RegExp(`alter table public\\.${table} force row level security`, "i"));
}

assert.match(
  sql,
  /create or replace function public\.persist_finance_pos_authority_v1\s*\(\s*p_operation jsonb,\s*p_actor_user_id text,\s*p_payload_hash text\s*\)/i
);
assert.match(sql, /security definer/i);
assert.match(sql, /set search_path = pg_catalog, public/i);
assert.match(sql, /auth\.role\(\) is distinct from 'service_role'/i);
assert.match(sql, /finance_operation_requests_v1/i);
assert.match(sql, /IDEMPOTENCY_PAYLOAD_CONFLICT/i);
assert.match(sql, /FINANCE_OPERATION_PENDING_CONFLICT/i);
assert.match(sql, /elsif v_action='POST_COLLECTION'/i);
assert.match(sql, /elsif v_action='SETTLE_TRANSACTION'/i);
assert.match(sql, /elsif v_action='POST_MONTHLY_FEE'/i);
assert.match(sql, /elsif v_action='REFUND_TRANSACTION'/i);
assert.match(sql, /elsif v_action='REVERSE_TRANSACTION'/i);
assert.match(sql, /elsif v_action='ARCHIVE_CONTRACT'/i);
assert.match(sql, /elsif v_action='ARCHIVE_RULE'/i);
assert.match(sql, /fixed_transaction_fee/i);
assert.match(sql, /finance_transactions_operation_leg_ck/i);
assert.match(sql, /POS_SETTLEMENT_BANK/);
assert.match(sql, /POS_COLLECTION_REVERSAL/);
assert.match(sql, /FINANCE_POS_COLLECTION_CANONICAL_SALE_SOURCE_REQUIRED/i);
assert.match(sql, /transaction_type='SALE_CHARGE'/i);
assert.match(sql, /FINANCE_POS_CONTRACT_SCOPE_CONFLICT/i);
assert.match(sql, /FINANCE_POS_RULE_SCOPE_CONFLICT/i);
assert.match(sql, /FINANCE_POS_PARTIAL_REFUND_NOT_SUPPORTED_V1/i);
assert.match(sql, /FINANCE_POS_REVERSAL_SETTLED_OR_INVALID_STATE/i);
assert.match(sql, /POS_SETTLEMENT_COMMISSION/i);
assert.match(sql, /insert into public\.finance_transactions/i);
assert.match(sql, /insert into public\.finance_transaction_audits/i);
assert.match(sql, /for update/i);
assert.match(
  sql,
  /revoke all on function public\.persist_finance_pos_authority_v1\(jsonb,text,text\)\s*from public, anon, authenticated/i
);
assert.match(
  sql,
  /grant execute on function public\.persist_finance_pos_authority_v1\(jsonb,text,text\)\s*to service_role/i
);
assert.doesNotMatch(sql, /\bdelete\s+from\s+public\.finance_/i);

console.log("[PASS] pos server authority sql contract");
