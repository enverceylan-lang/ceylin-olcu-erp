import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(
    process.cwd(),
    "docs/sql/20260726_business_scope_v1_preflight.sql"
  ),
  "utf8"
);
const executable = source
  .replace(/--.*$/gm, "")
  .replace(/\/\*[\s\S]*?\*\//g, "");

for (const table of [
  "customers",
  "rooms",
  "openings",
  "measurements",
  "field_tasks",
  "sales_sync_records",
  "sale_sync_payments",
  "stock_items",
  "production_orders",
  "customer_finance_entries",
]) {
  assert.match(source, new RegExp(`'${table}'`));
}

for (const scopeColumn of [
  "tenant_id",
  "company_id",
  "branch_id",
  "accounting_period_id",
]) {
  assert.match(source, new RegExp(`'${scopeColumn}'`));
}

assert.match(source, /PARTIAL_SCOPE_COLLISION/);
assert.match(source, /NOT_INSTALLED/);
assert.match(source, /NEEDS_SCOPE/);
assert.match(source, /SCOPE_PRESENT/);
assert.match(source, /ORDER BY category, domain_name, object_name/);
assert.doesNotMatch(
  executable,
  /\b(ALTER|UPDATE|INSERT|DELETE|TRUNCATE|DROP|CREATE|GRANT|REVOKE)\b/i
);

console.log("[PASS] business scope preflight SQL is read-only");
