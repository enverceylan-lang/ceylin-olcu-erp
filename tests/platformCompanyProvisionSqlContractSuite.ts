import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";

const sql =
  readFileSync(
    resolve(
      process.cwd(),
      "docs/sql/20260801_platform_company_provision_v1.sql",
    ),
    "utf8",
  );

assert.match(
  sql,
  /SECURITY DEFINER/,
);

assert.match(
  sql,
  /SET search_path = public, pg_temp/,
);

assert.match(
  sql,
  /provision_platform_company_v1/,
);

for (const table of [
  "erp_tenants",
  "erp_companies",
  "erp_branches",
  "erp_accounting_periods",
  "erp_package_licenses",
  "users",
  "erp_user_scopes",
  "erp_platform_provision_audits",
]) {
  assert.match(
    sql,
    new RegExp(
      `public\\.${table}`,
    ),
  );
}

assert.match(
  sql,
  /'COMPANY_ADMIN'/,
);

assert.match(
  sql,
  /provision_platform_company_v1\s*\(\s*p_request JSONB,\s*p_actor_user_id TEXT\s*\)/,
);

assert.match(
  sql,
  /p_request \? 'changed_by_user_id'/,
);

assert.match(
  sql,
  /auth\.role\(\)[\s\S]*service_role/,
);

assert.match(
  sql,
  /COALESCE\(\s*p_actor_user_id/,
);

assert.doesNotMatch(
  sql,
  /p_request ->> 'changed_by_user_id'/,
);

assert.match(
  sql,
  /provision_platform_company_v1\(JSONB, TEXT\)/,
);
assert.match(
  sql,
  /'PLATFORM_SUPER_ADMIN'/,
);

assert.match(
  sql,
  /branch_limit/,
);

assert.match(
  sql,
  /user_limit/,
);

assert.match(
  sql,
  /feature_overrides/,
);

assert.match(
  sql,
  /company_slug/,
);

assert.match(
  sql,
  /erp_company_slug_unique/,
);

assert.match(
  sql,
  /REVOKE ALL[\s\S]*PUBLIC, anon, authenticated/,
);

assert.match(
  sql,
  /GRANT EXECUTE[\s\S]*service_role/,
);

assert.doesNotMatch(
  sql,
  /\bDROP\s+(TABLE|SCHEMA|DATABASE)\b/i,
);

assert.doesNotMatch(
  sql,
  /\bTRUNCATE\b/i,
);

assert.doesNotMatch(
  sql,
  /\bDELETE\s+FROM\b/i,
);

console.log(
  "PLATFORM_COMPANY_PROVISION_SQL_CONTRACT_TEST: PAK",
);