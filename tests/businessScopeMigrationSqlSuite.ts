import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSql = (name: string) =>
  readFileSync(resolve(process.cwd(), "docs/sql", name), "utf8");

const migration = readSql("20260726_business_scope_v1_migration.sql");
const verification = readSql("20260726_business_scope_v1_verify.sql");
const rollback = readSql("20260726_business_scope_v1_rollback.sql");
const compatibility = readSql(
  "20260726_business_scope_v1_compatibility_unlock.sql"
);
const compatibilityVerify = readSql(
  "20260726_business_scope_v1_compatibility_verify.sql"
);

const tables = [
  "customers",
  "customers_light",
  "draft_changes",
  "field_tasks",
  "measurements",
  "openings",
  "rooms",
  "measurement_changes",
  "measurement_jobs",
];

for (const table of tables) {
  assert.match(migration, new RegExp(`'${table}'`));
  assert.match(verification, new RegExp(`\\('${table}'\\)`));
  assert.match(rollback, new RegExp(`'${table}'`));
  assert.match(compatibility, new RegExp(`'${table}'`));
  assert.match(compatibilityVerify, new RegExp(`\\('${table}'\\)`));
}

assert.match(migration, /BEGIN;/);
assert.match(migration, /COMMIT;/);
assert.match(migration, /distinct_scope_count <> 1/);
assert.match(migration, /ADD COLUMN IF NOT EXISTS tenant_id uuid/);
assert.match(migration, /FOREIGN KEY \(tenant_id, company_id, branch_id\)/);
assert.match(migration, /accounting_period_id/);
assert.match(migration, /NOT VALID/);
assert.match(migration, /VALIDATE CONSTRAINT/);
assert.doesNotMatch(migration, /SET NOT NULL/);
assert.match(migration, /CREATE INDEX IF NOT EXISTS/);
assert.doesNotMatch(migration, /sales_sync_records/);
assert.doesNotMatch(migration, /stock_items/);
assert.doesNotMatch(migration, /production_orders/);

assert.match(verification, /valid_column_count = 4/);
assert.match(verification, /valid_fk_count = 2/);
assert.match(verification, /scope_index_count = 1/);
assert.match(verification, /AS passed/);

assert.match(rollback, /BEGIN;/);
assert.match(rollback, /DROP CONSTRAINT IF EXISTS/);
assert.match(rollback, /DROP INDEX IF EXISTS/);
assert.match(rollback, /DROP COLUMN IF EXISTS/);
assert.match(rollback, /COMMIT;/);

assert.match(compatibility, /DROP NOT NULL/);
assert.doesNotMatch(compatibility, /DROP COLUMN/);
assert.doesNotMatch(compatibility, /\bUPDATE\b/);
assert.match(compatibilityVerify, /compatible_nullable_count = 4/);
assert.match(compatibilityVerify, /valid_fk_count = 2/);

console.log("[PASS] business scope migration SQL contract");
