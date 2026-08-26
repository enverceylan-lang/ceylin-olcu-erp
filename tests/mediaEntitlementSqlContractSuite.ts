import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const sql = fs.readFileSync(
  path.join(
    root,
    "docs/sql/20260817_media_entitlement_authority_v1.sql",
  ),
  "utf8",
);

const must = [
  /create\s+table[\s\S]*erp_platform_feature_switches/i,
  /create\s+table[\s\S]*erp_company_feature_entitlements/i,
  /create\s+table[\s\S]*erp_feature_entitlement_audits/i,
  /primary\s+key\s*\(\s*tenant_id\s*,\s*company_id\s*,\s*feature_code\s*\)/i,
  /foreign\s+key\s*\(\s*tenant_id\s*,\s*company_id\s*\)/i,
  /references\s+public\.erp_companies\s*\(\s*tenant_id\s*,\s*company_id\s*\)/i,
  /feature_code[\s\S]*MEDIA/i,
  /enable\s+row\s+level\s+security/i,
  /force\s+row\s+level\s+security/i,
  /set_platform_feature_switch_v1/i,
  /set_company_feature_entitlement_v1/i,
  /security\s+definer/i,
  /set\s+search_path\s*=\s*public\s*,\s*pg_temp/i,
  /PLATFORM_SUPER_ADMIN/i,
  /"isActive"\s*=\s*TRUE/i,
  /revoke\s+all[\s\S]*from\s+PUBLIC\s*,\s*anon\s*,\s*authenticated/i,
  /grant\s+select[\s\S]*erp_platform_feature_switches[\s\S]*to\s+service_role/i,
  /grant\s+select[\s\S]*erp_company_feature_entitlements[\s\S]*to\s+service_role/i,
  /MEDIA_ENTITLEMENT_PREFLIGHT_USERS_ID_TYPE/i,
  /MEDIA_ENTITLEMENT_PREFLIGHT_RPC_NAME_COLLISION/i,
  /MEDIA_ENTITLEMENT_PREFLIGHT_INDEX_NAME_COLLISION/i,
  /v_users_id_type\s+IS\s+DISTINCT\s+FROM\s+'text'/i,
  /p\.proname\s+IN/i,
  /grant\s+execute[\s\S]*to\s+service_role/i,
];

for (const pattern of must) {
  assert.match(sql, pattern);
}

assert.doesNotMatch(
  sql,
  /update\s+public\.erp_package_licenses/i,
);
assert.doesNotMatch(
  sql,
  /delete\s+from\s+public\.erp_platform_feature_switches/i,
);
assert.doesNotMatch(
  sql,
  /delete\s+from\s+public\.erp_company_feature_entitlements/i,
);
assert.doesNotMatch(
  sql,
  /grant\s+execute[\s\S]*to\s+(?:anon|authenticated)/i,
);
assert.doesNotMatch(
  sql,
  /grant\s+(?:insert|update|delete|truncate|references|trigger)[\s\S]*erp_(?:platform_feature_switches|company_feature_entitlements)/i,
);

assert.match(sql, /^\s*BEGIN\s*;/i);
assert.match(sql, /COMMIT\s*;\s*$/i);
assert.equal((sql.match(/^\s*BEGIN\s*;\s*$/gim) ?? []).length, 1);
assert.equal((sql.match(/^\s*COMMIT\s*;\s*$/gim) ?? []).length, 1);
console.log("PASS mediaEntitlementSqlContractSuite");
const aclHardeningSql = fs.readFileSync(
  path.join(
    root,
    "docs/sql/20260818_media_entitlement_service_role_acl_hardening_v1.sql",
  ),
  "utf8",
);

const aclHardeningMust = [
  /BEGIN\s*;/i,
  /REVOKE\s+ALL\s+PRIVILEGES[\s\S]*erp_platform_feature_switches[\s\S]*FROM\s+service_role/i,
  /REVOKE\s+ALL\s+PRIVILEGES[\s\S]*erp_company_feature_entitlements[\s\S]*FROM\s+service_role/i,
  /REVOKE\s+ALL\s+PRIVILEGES[\s\S]*erp_feature_entitlement_audits[\s\S]*FROM\s+service_role/i,
  /GRANT\s+SELECT[\s\S]*erp_platform_feature_switches[\s\S]*TO\s+service_role/i,
  /GRANT\s+SELECT[\s\S]*erp_company_feature_entitlements[\s\S]*TO\s+service_role/i,
  /privilege_type\s*=\s*'SELECT'/i,
  /privilege_type\s+IN\s*\([\s\S]*'INSERT'[\s\S]*'UPDATE'[\s\S]*'DELETE'[\s\S]*'TRUNCATE'[\s\S]*'REFERENCES'[\s\S]*'TRIGGER'/i,
  /v_total\s*<>\s*2/i,
  /v_expected_select\s*<>\s*2/i,
  /v_audit_direct\s*<>\s*0/i,
  /v_direct_dml\s*<>\s*0/i,
  /COMMIT\s*;/i,
];

for (const pattern of aclHardeningMust) {
  assert.match(aclHardeningSql, pattern);
}
