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

for (const table of [
  "erp_access_channels",
  "erp_license_channel_access",
  "erp_user_scope_channel_access",
]) {
  assert.match(
    sql,
    new RegExp(
      `public\\.${table}`,
    ),
  );
}

for (const channel of [
  "WEB",
  "MOBILE",
  "DESKTOP",
]) {
  assert.match(
    sql,
    new RegExp(`'${channel}'`),
  );
}

assert.match(
  sql,
  /initialize_provisioned_company_channel_access_v1/,
);

assert.match(
  sql,
  /PERFORM\s+public\.initialize_provisioned_company_channel_access_v1/,
);

assert.match(
  sql,
  /Existing records retain current access until enforcement rollout/i,
);

assert.match(
  sql,
  /New provisioned companies are MOBILE-first and WEB-by-permission/i,
);

assert.match(
  sql,
  /ENABLE ROW LEVEL SECURITY/,
);

assert.match(
  sql,
  /FORCE ROW LEVEL SECURITY/,
);

assert.match(
  sql,
  /REVOKE ALL PRIVILEGES[\s\S]*PUBLIC, anon, authenticated/,
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
  "CHANNEL_ACCESS_SQL_CONTRACT_TEST: PAK",
);