import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "docs/sql/20260726_package_scope_foundation_v2.sql"
  ),
  "utf8"
);
const rollback = readFileSync(
  resolve(
    process.cwd(),
    "docs/sql/20260726_package_scope_foundation_v2_rollback.sql"
  ),
  "utf8"
);
const seed = readFileSync(
  resolve(
    process.cwd(),
    "docs/sql/20260726_package_scope_seed_template.sql"
  ),
  "utf8"
);
const ceylinSeed = readFileSync(
  resolve(
    process.cwd(),
    "docs/sql/20260726_package_scope_seed_ceylin_v1.sql"
  ),
  "utf8"
);
const ceylinSeedVerify = readFileSync(
  resolve(
    process.cwd(),
    "docs/sql/20260726_package_scope_seed_ceylin_verify.sql"
  ),
  "utf8"
);
const preflight = readFileSync(
  resolve(
    process.cwd(),
    "docs/sql/20260726_package_scope_v2_preflight.sql"
  ),
  "utf8"
);

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
  assert.match(
    sql,
    new RegExp(
      `REVOKE ALL PRIVILEGES ON TABLE public\\.${table} FROM anon, authenticated`
    )
  );
}

assert.match(sql, /tenant_id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
assert.match(sql, /company_id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
assert.match(sql, /branch_id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
assert.match(
  sql,
  /accounting_period_id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/
);
assert.match(sql, /REFERENCES public\.users\(id\)/);
assert.match(sql, /package_code IN \('ECO', 'NORMAL', 'PLUS'\)/);
assert.match(sql, /SECURITY INVOKER/);
assert.doesNotMatch(sql, /CREATE POLICY[\s\S]+USING\s*\(true\)/i);
assert.doesNotMatch(
  sql,
  /\bALTER\s+TABLE\s+public\.(customers|rooms|openings|measurements|users)\b/i
);

assert.match(rollback, /DURUM:\s*TASLAK/i);
assert.doesNotMatch(
  rollback,
  /\bDROP TABLE IF EXISTS public\.(customers|rooms|openings|measurements|users)\b/i
);

assert.match(seed, /ONAY_BEKLIYOR/);
assert.match(seed, /RAISE EXCEPTION/);
assert.match(seed, /ON CONFLICT/);

assert.match(ceylinSeed, /DURUM:\s*ONAYLI DEĞERLERLE HAZIRLANMIŞ TASLAK/i);
assert.match(ceylinSeed, /WHERE username = 'admin'/);
assert.match(ceylinSeed, /"isActive" = TRUE/);
assert.match(ceylinSeed, /VALUES \('CEYLIN', 'CEYLİN PERDE & ÇEYİZ', TRUE\)/);
assert.match(ceylinSeed, /'CEYLIN_PERDE'/);
assert.match(ceylinSeed, /'MERKEZ'/);
assert.match(ceylinSeed, /'PLUS'/);
assert.match(ceylinSeed, /ON CONFLICT/);
assert.doesNotMatch(ceylinSeed, /\b(password|DELETE FROM|TRUNCATE)\b/i);

assert.match(ceylinSeedVerify, /SALT OKUNUR/i);
assert.match(ceylinSeedVerify, /admin_default_scope/);
assert.match(ceylinSeedVerify, /actual_count = expected_count/);
assert.doesNotMatch(
  ceylinSeedVerify,
  /\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b/i
);

assert.match(preflight, /SALT OKUNUR/i);
assert.match(preflight, /uuid_generator_available/);
assert.match(preflight, /target_table_collision/);
assert.match(preflight, /exactly_one_active_admin/);
assert.match(preflight, /service_role_users_access/);
assert.match(preflight, /anon_sensitive_users_select_closed/);
assert.doesNotMatch(
  preflight,
  /\b(INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM|ALTER|DROP|TRUNCATE|CREATE)\b/i
);

console.log("[PASS] package scope SQL V2 remains safe unapplied draft");
