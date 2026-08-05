import assert from "node:assert/strict";
import fs from "node:fs";

const sql =
  fs.readFileSync(
    "docs/sql/20260805_support_foundation_v1.sql",
    "utf8",
  );

const companyRoute =
  fs.readFileSync(
    "src/app/api/support/tickets/route.ts",
    "utf8",
  );

const platformRoute =
  fs.readFileSync(
    "src/app/api/platform/support/tickets/route.ts",
    "utf8",
  );

const contracts =
  fs.readFileSync(
    "src/lib/support/supportContracts.ts",
    "utf8",
  );

assert.match(
  sql,
  /CREATE TABLE IF NOT EXISTS public\.erp_support_tickets/,
);
assert.match(
  sql,
  /CREATE TABLE IF NOT EXISTS public\.erp_support_messages/,
);
assert.match(
  sql,
  /CREATE TABLE IF NOT EXISTS public\.erp_support_status_audits/,
);

assert.match(
  sql,
  /FOREIGN KEY \(tenant_id, company_id\)[\s\S]*REFERENCES public\.erp_companies\(tenant_id, company_id\)/,
);

assert.match(
  sql,
  /ENABLE ROW LEVEL SECURITY/,
);
assert.match(
  sql,
  /REVOKE ALL PRIVILEGES[\s\S]*FROM PUBLIC, anon, authenticated/,
);
assert.match(
  sql,
  /ERP_SUPPORT_PHYSICAL_DELETE_FORBIDDEN/,
);

assert.match(
  companyRoute,
  /requireCompanySession\([\s\S]*request,[\s\S]*"WEB"/,
);
assert.match(
  companyRoute,
  /\.eq\("tenant_id", tenantId\)/,
);
assert.match(
  companyRoute,
  /\.eq\("company_id", companyId\)/,
);
assert.match(
  companyRoute,
  /p_actor_user_id:[\s\S]*actor\.id/,
);
assert.match(
  sql,
  /VALUES \([\s\S]*'NEW'[\s\S]*\)[\s\S]*RETURNING ticket_id/,
);

assert.match(
  platformRoute,
  /requirePlatformSuperAdmin/,
);
assert.doesNotMatch(
  platformRoute,
  /requireCompanySession/,
);

assert.match(
  contracts,
  /"TECHNICAL"/,
);
assert.match(
  contracts,
  /"DEVELOPMENT_SUGGESTION"/,
);
assert.match(
  contracts,
  /"SECURITY"/,
);
assert.match(
  contracts,
  /"BILLING_LICENSE"/,
);

assert.match(
  sql,
  /erp_user_scope_identity_company_uq/,
);
assert.match(
  sql,
  /CONSTRAINT erp_support_ticket_user_scope_fk[\s\S]*REFERENCES public\.erp_user_scopes/,
);
assert.match(
  sql,
  /CREATE OR REPLACE FUNCTION public\.create_erp_support_ticket_v1/,
);
assert.match(
  sql,
  /SECURITY DEFINER/,
);
assert.match(
  sql,
  /auth\.role\(\)[\s\S]*service_role/,
);
assert.match(
  sql,
  /INSERT INTO public\.erp_support_tickets[\s\S]*INSERT INTO public\.erp_support_status_audits/,
);
assert.match(
  sql,
  /FORCE ROW LEVEL SECURITY/,
);
assert.match(
  companyRoute,
  /\.rpc\([\s\S]*"create_erp_support_ticket_v1"/,
);
assert.doesNotMatch(
  companyRoute,
  /\.from\("erp_support_tickets"\)[\s\S]*\.insert\(/,
);
assert.doesNotMatch(
  companyRoute,
  /ticketCreated:\s*true/,
);

console.log(
  "SUPPORT_FOUNDATION_CONTRACT_SUITE: PAK",
);