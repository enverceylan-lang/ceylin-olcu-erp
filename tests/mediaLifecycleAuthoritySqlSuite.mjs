import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync(
  "docs/sql/20260828_media_lifecycle_authority_v1.sql",
  "utf8",
);

assert.match(
  sql,
  /create or replace function public\.enverp_media_validate_target_scope_v3\(\)/i,
);

assert.match(
  sql,
  /ENVERP_MEDIA_TARGET_SCOPE_MISMATCH/,
);

assert.match(
  sql,
  /v_exact_exists/,
);

assert.match(
  sql,
  /v_any_exists/,
);

assert.match(
  sql,
  /from public\.customers/i,
);

assert.match(
  sql,
  /from public\.rooms/i,
);

assert.match(
  sql,
  /from public\.openings/i,
);

assert.match(
  sql,
  /from public\.measurements/i,
);

assert.match(
  sql,
  /c\.tenant_id = new\.tenant_id/i,
);

assert.match(
  sql,
  /m\.company_id = new\.company_id/i,
);

assert.doesNotMatch(
  sql,
  /measurement_changes/i,
);

assert.match(
  sql,
  /if v_any_exists and not v_exact_exists then/i,
);

console.log(
  "PAK_MEDIA_LIFECYCLE_AUTHORITY_SQL_SCOPE_V1",
);