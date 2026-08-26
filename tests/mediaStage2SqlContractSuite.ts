import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sql = fs.readFileSync(
  path.join(root, "docs/sql/20260815_media_stage2_e2e_v1.sql"),
  "utf8",
);

const must = [
  /security\s+definer/i,
  /auth\.role\(\)\s+is\s+distinct\s+from\s+'service_role'/i,
  /erp_user_scopes/i,
  /user_scope_id\s*=\s*p_actor_user_scope_id/i,
  /tenant_id\s*=\s*p_tenant_id/i,
  /company_id\s*=\s*p_company_id/i,
  /branch_id\s*=\s*p_branch_id/i,
  /accounting_period_id\s*=\s*p_accounting_period_id/i,
  /prepare_media_upload_v1/i,
  /finalize_media_upload_v1/i,
  /list_entity_media_v1/i,
  /archive_entity_media_link_v1/i,
  /restore_entity_media_link_v1/i,
  /replace_entity_media_v1/i,
  /ENVERP_MEDIA_IDEMPOTENCY_CONFLICT/i,
  /expected_mime_type\s*<>\s*'image\/webp'/i,
  /4194304/,
  /LINK_SUPERSEDED/i,
  /status\s*=\s*'ARCHIVED'/i,
  /grant\s+execute[\s\S]*to\s+service_role/i,
];

for (const pattern of must) {
  assert.match(sql, pattern);
}

assert.doesNotMatch(sql, /\bdelete\s+from\s+public\.media_/i);
assert.doesNotMatch(sql, /\btruncate\s+public\.media_/i);
assert.doesNotMatch(sql, /\balter\s+table\s+storage\./i);
assert.doesNotMatch(sql, /\binsert\s+into\s+storage\./i);

console.log("PASS mediaStage2SqlContractSuite");
