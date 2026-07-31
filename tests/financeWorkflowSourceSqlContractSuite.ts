import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(
    process.cwd(),
    "docs/sql/20260731_finance_workflow_source_foundation_v1.sql"
  ),
  "utf8"
);

assert.match(source, /finance_sale_workflow_sources/i);
assert.match(source, /finance_sale_return_workflow_sources/i);

for (const column of [
  "tenant_id",
  "company_id",
  "branch_id",
  "accounting_period_id",
  "sale_id",
  "customer_id",
  "status",
  "total_amount",
  "approved_by_user_id",
  "sale_return_id",
  "amount",
  "actor_user_id",
  "payload_hash"
]) {
  assert.match(source, new RegExp(`\\b${column}\\b`, "i"));
}

assert.match(source, /status\s*=\s*'ONAYLANDI'/i);
assert.match(source, /total_amount\s*>\s*0/i);
assert.match(source, /amount\s*>\s*0/i);
assert.match(source, /enable row level security/i);
assert.match(source, /force row level security/i);
assert.match(source, /revoke all[\s\S]*anon, authenticated/i);
assert.match(source, /grant select, insert, update[\s\S]*service_role/i);
assert.match(source, /revoke delete[\s\S]*service_role/i);

assert.doesNotMatch(source, /grant\s+delete/i);
assert.doesNotMatch(source, /on delete cascade/i);
assert.doesNotMatch(source, /drop table/i);

console.log("financeWorkflowSourceSqlContractSuite: PASS");