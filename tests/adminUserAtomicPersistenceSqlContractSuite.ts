import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync(
  "docs/sql/20260812_user_management_atomic_rpc_v1.sql",
  "utf8",
);

const route = fs.readFileSync(
  "src/app/api/admin/users/update/route.ts",
  "utf8",
);

assert.match(
  sql,
  /CREATE TABLE IF NOT EXISTS public\.erp_user_management_audits/,
);
assert.match(
  sql,
  /CREATE OR REPLACE FUNCTION public\.manage_company_user_v1/,
);
assert.match(sql, /LANGUAGE plpgsql[\s\S]*SECURITY DEFINER/);
assert.match(sql, /SET search_path = public, pg_temp/);

assert.match(
  sql,
  /scope\.user_scope_id = p_actor_user_scope_id[\s\S]*scope\.user_id = p_actor_user_id[\s\S]*scope\.tenant_id = p_tenant_id[\s\S]*scope\.company_id = p_company_id[\s\S]*scope\.is_active = TRUE/,
);

assert.match(
  sql,
  /FROM public\.erp_user_scopes AS s[\s\S]*s\.user_id = v_target_id[\s\S]*s\.tenant_id = p_tenant_id[\s\S]*s\.company_id = p_company_id[\s\S]*s\.is_active = TRUE/,
);

assert.match(
  sql,
  /ERP_USER_MGMT_FORBIDDEN:SELF_PRIVILEGED_FIELDS/,
);
assert.match(sql, /ERP_USER_MGMT_FORBIDDEN:PROFILE_LOCKED/);
assert.match(sql, /ERP_USER_MGMT_CONFLICT:USERNAME/);

assert.match(
  sql,
  /INSERT INTO public\.users[\s\S]*INSERT INTO public\.erp_user_scopes/,
);
assert.match(
  sql,
  /UPDATE public\.users[\s\S]*UPDATE public\.erp_user_scopes/,
);
assert.match(
  sql,
  /INSERT INTO public\.erp_user_management_audits/,
);

assert.match(
  sql,
  /changed_fields TEXT\[\][\s\S]*passwordChanged/,
);
assert.doesNotMatch(
  sql,
  /erp_user_management_audits[\s\S]{0,800}(before_snapshot|after_snapshot|password_hash|password_value)/i,
);

assert.match(
  sql,
  /BEFORE DELETE ON public\.erp_user_management_audits[\s\S]*prevent_erp_user_management_audit_delete/,
);
assert.match(
  sql,
  /ALTER TABLE public\.erp_user_management_audits[\s\S]*ENABLE ROW LEVEL SECURITY/,
);
assert.doesNotMatch(
  sql,
  /ALTER TABLE public\.erp_user_management_audits[\s\S]*FORCE ROW LEVEL SECURITY/,
);
assert.match(
  sql,
  /auth\.role\(\) IS DISTINCT FROM 'service_role'[\s\S]*ERP_USER_MGMT_FORBIDDEN:SERVICE_ROLE_REQUIRED/,
);
assert.match(
  sql,
  /REVOKE ALL[\s\S]*manage_company_user_v1[\s\S]*FROM PUBLIC, anon, authenticated/,
);
assert.match(
  sql,
  /GRANT EXECUTE[\s\S]*manage_company_user_v1[\s\S]*TO service_role/,
);

assert.match(
  route,
  /\.rpc\([\s\S]*"manage_company_user_v1"/,
);
assert.match(
  route,
  /p_actor_user_scope_id:\s*companySession\.session\.userScopeId/,
);
assert.match(
  route,
  /p_tenant_id:\s*companySession\.session\.tenantId/,
);
assert.match(
  route,
  /p_company_id:\s*companySession\.session\.companyId/,
);

assert.doesNotMatch(route, /\.upsert\(userRecord\)/);
assert.doesNotMatch(route, /User create scope rollback failed/);
assert.doesNotMatch(route, /USER_SCOPE_CREATE_FAILED/);
assert.doesNotMatch(route, /USER_SCOPE_USERNAME_UPDATE_FAILED/);

console.log(
  "[PASS] admin user atomic persistence SQL/route contract",
);