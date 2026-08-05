import assert from "node:assert/strict";
import fs from "node:fs";

const sql =
  fs.readFileSync(
    "docs/sql/20260805_support_foundation_v1.sql",
    "utf8",
  );

const contracts =
  fs.readFileSync(
    "src/lib/support/supportMutationContracts.ts",
    "utf8",
  );

const companyMessageRoute =
  fs.readFileSync(
    "src/app/api/support/tickets/[ticketId]/messages/route.ts",
    "utf8",
  );

const platformMessageRoute =
  fs.readFileSync(
    "src/app/api/platform/support/tickets/[ticketId]/messages/route.ts",
    "utf8",
  );

const platformStatusRoute =
  fs.readFileSync(
    "src/app/api/platform/support/tickets/[ticketId]/status/route.ts",
    "utf8",
  );

assert.match(
  sql,
  /CREATE OR REPLACE FUNCTION public\.add_erp_company_support_message_v1/,
);

assert.match(
  sql,
  /CREATE OR REPLACE FUNCTION public\.add_erp_platform_support_message_v1/,
);

assert.match(
  sql,
  /CREATE OR REPLACE FUNCTION public\.transition_erp_support_ticket_status_v1/,
);

assert.match(
  sql,
  /add_erp_company_support_message_v1[\s\S]*erp_user_scopes[\s\S]*user_scope_id[\s\S]*tenant_id[\s\S]*company_id/,
);

assert.match(
  sql,
  /transition_erp_support_ticket_status_v1[\s\S]*FOR UPDATE[\s\S]*UPDATE public\.erp_support_tickets[\s\S]*INSERT INTO public\.erp_support_status_audits/,
);

assert.match(
  sql,
  /v_from_status = 'CLOSED'[\s\S]*CLOSED_IS_FINAL/,
);

assert.match(
  sql,
  /REVOKE ALL[\s\S]*add_erp_company_support_message_v1[\s\S]*FROM PUBLIC, anon, authenticated/,
);

assert.match(
  sql,
  /REVOKE ALL[\s\S]*add_erp_platform_support_message_v1[\s\S]*FROM PUBLIC, anon, authenticated/,
);

assert.match(
  sql,
  /REVOKE ALL[\s\S]*transition_erp_support_ticket_status_v1[\s\S]*FROM PUBLIC, anon, authenticated/,
);

assert.match(
  contracts,
  /parseSupportMessageCreateInput/,
);

assert.match(
  contracts,
  /parseSupportStatusTransitionInput/,
);

assert.match(
  companyMessageRoute,
  /requireCompanySession[\s\S]*"WEB"/,
);

assert.match(
  companyMessageRoute,
  /\.rpc\([\s\S]*"add_erp_company_support_message_v1"/,
);

assert.doesNotMatch(
  companyMessageRoute,
  /\.from\("erp_support_messages"\)[\s\S]*\.insert\(/,
);

assert.match(
  platformMessageRoute,
  /requirePlatformSuperAdmin/,
);

assert.match(
  platformMessageRoute,
  /\.rpc\([\s\S]*"add_erp_platform_support_message_v1"/,
);

assert.doesNotMatch(
  platformMessageRoute,
  /\.from\("erp_support_messages"\)[\s\S]*\.insert\(/,
);

assert.match(
  platformStatusRoute,
  /requirePlatformSuperAdmin/,
);

assert.match(
  platformStatusRoute,
  /\.rpc\([\s\S]*"transition_erp_support_ticket_status_v1"/,
);

assert.doesNotMatch(
  platformStatusRoute,
  /\.from\("erp_support_tickets"\)[\s\S]*\.update\(/,
);

console.log(
  "SUPPORT_MESSAGE_STATUS_CONTRACT_SUITE: PAK",
);