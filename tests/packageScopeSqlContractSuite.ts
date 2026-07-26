import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sqlPath = resolve(
  process.cwd(),
  "docs/sql/20260726_package_scope_foundation_v1.sql"
);
const sql = readFileSync(sqlPath, "utf8");

assert.match(sql, /DURUM:\s*TASLAK/i);
assert.match(sql, /CANLI SUPABASE['’]?E UYGULANMAYACAKTIR/i);

for (const table of [
  "erp_tenants",
  "erp_companies",
  "erp_branches",
  "erp_accounting_periods",
  "erp_package_licenses",
  "erp_user_scopes",
]) {
  assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
  assert.match(
    sql,
    new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`)
  );
}

assert.match(sql, /package_code IN \('ECO', 'NORMAL', 'PLUS'\)/);
assert.match(sql, /ON DELETE RESTRICT/g);
assert.doesNotMatch(sql, /\bDROP\s+(TABLE|COLUMN|SCHEMA|DATABASE)\b/i);
assert.doesNotMatch(sql, /\bTRUNCATE\b/i);
assert.doesNotMatch(sql, /\bDELETE\s+FROM\b/i);
assert.doesNotMatch(sql, /\bALTER\s+TABLE\s+public\.(customers|rooms|openings|measurements|sales)\b/i);

console.log("[PASS] package scope SQL remains safe unapplied draft");
