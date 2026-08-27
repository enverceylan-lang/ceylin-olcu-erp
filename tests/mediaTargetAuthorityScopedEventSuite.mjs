import fs from "node:fs";
import assert from "node:assert/strict";

const route = fs.readFileSync(
  "src/app/api/sync/media/route.ts",
  "utf8",
);

const sql = fs.readFileSync(
  "docs/sql/20260827_media_target_authority_scoped_event_v1.sql",
  "utf8",
);

// ------------------------------------------------------
// FAIL-CLOSED SERVER BOUNDARY REMAINS
// ------------------------------------------------------

assert.equal(
  (route.match(/MEDIA_TARGET_FORBIDDEN/g) || []).length,
  2,
);

// ------------------------------------------------------
// MEASUREMENT REMAINS CANONICAL + EXACT SCOPE
// ------------------------------------------------------

assert.match(
  route,
  /if \(targetType === "MEASUREMENT"\)/,
);

assert.match(
  route,
  /\.from\("measurements"\)/,
);

assert.match(
  route,
  /\.select\("id,measuredById"\)/,
);

assert.match(
  route,
  /data\.measuredById/,
);

assert.match(
  route,
  /operation !== "UPLOAD"/,
);

for (const token of [
  '.eq("tenant_id", scope.tenant_id)',
  '.eq("company_id", scope.company_id)',
  '.eq("branch_id", scope.branch_id)',
]) {
  assert.ok(route.includes(token), token);
}

assert.match(
  route,
  /\.eq\(\s*"accounting_period_id",\s*scope\.accounting_period_id,\s*\)/s,
);

// ------------------------------------------------------
// CUSTOMER / ROOM / OPENING:
// CANONICAL FIRST, SCOPED EVENT FALLBACK SECOND
// ------------------------------------------------------

assert.match(
  route,
  /\.from\(table\)/,
);

assert.match(
  route,
  /\.from\("measurement_changes"\)/,
);

assert.match(
  route,
  /\.eq\("entity_type", targetType\)/,
);

assert.match(
  route,
  /\.eq\("entity_id", targetId\)/,
);

assert.match(
  route,
  /if \(!isAdmin\(context\)\) return false;/,
);

// No blind local target acceptance.
assert.doesNotMatch(
  route,
  /if \(!isAdmin\(context\)\) return false;\s*return true;/,
);

// ------------------------------------------------------
// SQL PARITY
// ------------------------------------------------------

assert.match(
  sql,
  /create or replace function public\.enverp_media_validate_target_scope_v3\(\)/,
);

for (const entity of [
  "CUSTOMER",
  "ROOM",
  "OPENING",
]) {
  assert.match(
    sql,
    new RegExp(
      `mc\\.entity_type = '${entity}'`,
    ),
  );
}

assert.match(
  sql,
  /from public\.measurement_changes mc/,
);

assert.match(
  sql,
  /mc\.entity_id = new\.target_id/,
);

assert.match(
  sql,
  /mc\.tenant_id = new\.tenant_id/,
);

assert.match(
  sql,
  /mc\.company_id = new\.company_id/,
);

assert.match(
  sql,
  /mc\.branch_id = new\.branch_id/,
);

assert.match(
  sql,
  /mc\.accounting_period_id = new\.accounting_period_id/,
);

// MEASUREMENT must NOT use measurement_changes fallback.
const measurementSection =
  sql.split(
    "elsif new.target_type = 'MEASUREMENT' then",
  )[1]?.split(
    "else",
  )[0] || "";

assert.match(
  measurementSection,
  /from public\.measurements m/,
);

assert.doesNotMatch(
  measurementSection,
  /measurement_changes/,
);

assert.match(
  sql,
  /ENVERP_MEDIA_TARGET_SCOPE_MISMATCH_OR_NOT_FOUND/,
);

// No live execution instruction hidden in source.
assert.doesNotMatch(
  sql,
  /drop table/i,
);

console.log(
  "PAK_MEDIA_TARGET_AUTHORITY_SCOPED_EVENT_V1",
);