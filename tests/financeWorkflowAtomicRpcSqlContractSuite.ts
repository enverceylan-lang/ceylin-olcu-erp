import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const sql = fs.readFileSync(
  path.join(
    process.cwd(),
    "docs/sql/20260813_finance_workflow_atomic_rpc_v1.sql"
  ),
  "utf8"
);

assert.match(
  sql,
  /create or replace function public\.persist_finance_system_workflow_v1/i
);
assert.match(sql, /security definer/i);
assert.match(sql, /set search_path = public, pg_temp/i);
assert.match(
  sql,
  /auth\.role\(\)\s+is distinct from\s+'service_role'/i
);
assert.match(sql, /finance_sale_workflow_sources/i);
assert.match(sql, /finance_sale_return_workflow_sources/i);
assert.match(sql, /persist_finance_transaction_v1/i);
assert.match(sql, /for update/i);
assert.match(
  sql,
  /ENVERP_FINANCE_WORKFLOW_CONFLICT_ROLLBACK/i
);
assert.match(
  sql,
  /if v_outcome = 'CONFLICT' then[\s\S]*raise exception/i
);
assert.match(
  sql,
  /revoke all[\s\S]*persist_finance_system_workflow_v1[\s\S]*from public, anon, authenticated/i
);
assert.match(
  sql,
  /grant execute[\s\S]*persist_finance_system_workflow_v1[\s\S]*to service_role/i
);
assert.doesNotMatch(sql, /delete from/i);

console.log(
  "financeWorkflowAtomicRpcSqlContractSuite: PASS"
);

/* ENVERP V4 immutable workflow source contract */
assert.match(
  sql,
  /finance_sale_workflow_sources[\s\S]*on\s+conflict[\s\S]*do\s+nothing/i
);

assert.match(
  sql,
  /finance_sale_return_workflow_sources[\s\S]*on\s+conflict[\s\S]*do\s+nothing/i
);

assert.doesNotMatch(
  sql,
  /finance_sale_workflow_sources[\s\S]{0,2500}do\s+update/i
);

assert.doesNotMatch(
  sql,
  /finance_sale_return_workflow_sources[\s\S]{0,2500}do\s+update/i
);

assert.match(
  sql,
  /finance_sale_workflow_sources\s+as\s+fsws[\s\S]*for\s+update/i
);

assert.match(
  sql,
  /finance_sale_return_workflow_sources\s+as\s+fsrws[\s\S]*for\s+update/i
);