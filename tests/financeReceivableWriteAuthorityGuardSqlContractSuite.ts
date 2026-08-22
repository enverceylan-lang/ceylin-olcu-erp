import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "docs/sql/20260822_finance_receivable_write_authority_guard_v1.sql",
  ),
  "utf8",
);

assert.match(
  sql,
  /persist_finance_operation_core_v1\(jsonb,text,text\)/i,
);
assert.match(
  sql,
  /v_kind='COLLECTION'[\s\S]*FINANCE_COLLECTION_CANONICAL_COMMAND_REQUIRED/i,
);
assert.match(
  sql,
  /persist_finance_operation_core_v1\(\s*p_operation,\s*p_actor_user_id,\s*p_payload_hash\s*\)/i,
);

assert.match(
  sql,
  /persist_finance_system_workflow_core_v1\(/i,
);
assert.match(
  sql,
  /p_workflow='SALE_APPROVAL'[\s\S]*register_finance_sale_receivables_v1\(p_source\)/i,
);
assert.match(
  sql,
  /p_workflow='SALE_RETURN_APPROVAL'[\s\S]*finance_receivable_open_items_v1/i,
);
assert.match(
  sql,
  /tenant_id=v_tenant[\s\S]*company_id=v_company[\s\S]*branch_id=v_branch[\s\S]*accounting_period_id=v_period[\s\S]*sale_id=v_sale[\s\S]*customer_id=v_customer[\s\S]*currency=v_currency/i,
);
assert.match(
  sql,
  /status in \('OPEN','PARTIAL'\)/i,
);
assert.match(
  sql,
  /original_amount\s*-\s*oi\.allocated_amount\s*-\s*oi\.reserved_amount/i,
);
assert.match(
  sql,
  /FINANCE_SALE_RETURN_OPEN_RECEIVABLE_ADJUSTMENT_REQUIRED/i,
);

assert.match(sql, /security definer/i);
assert.match(sql, /set search_path=pg_catalog,public/i);
assert.match(
  sql,
  /revoke all on function public\.persist_finance_operation_v1\(jsonb,text,text\)[\s\S]*from public,anon,authenticated/i,
);
assert.match(
  sql,
  /grant execute on function public\.persist_finance_operation_v1\(jsonb,text,text\)[\s\S]*to service_role/i,
);
assert.match(
  sql,
  /revoke all on function public\.persist_finance_system_workflow_v1\(text,jsonb,jsonb,jsonb\)[\s\S]*from public,anon,authenticated/i,
);
assert.match(
  sql,
  /grant execute on function public\.persist_finance_system_workflow_v1\(text,jsonb,jsonb,jsonb\)[\s\S]*to service_role/i,
);

assert.doesNotMatch(sql, /\bdelete\s+from\b/i);
assert.doesNotMatch(sql, /\btruncate\b/i);
assert.doesNotMatch(sql, /\bdrop\s+table\b/i);

console.log("[PASS] finance receivable write authority guard");