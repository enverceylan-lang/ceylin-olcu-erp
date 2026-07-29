import assert from "node:assert/strict";
import {
  readFileSync
} from "node:fs";
import {
  resolve
} from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "docs/sql/20260729_provider_user_link_v1.sql"
);

const verifyPath = resolve(
  process.cwd(),
  "docs/sql/20260729_provider_user_link_v1_verify.sql"
);

const migration =
  readFileSync(
    migrationPath,
    "utf8"
  );

const verify =
  readFileSync(
    verifyPath,
    "utf8"
  );

assert.match(
  migration,
  /add column if not exists "providerCustomerId" text null/i
);

assert.match(
  migration,
  /add column if not exists "providerType" text null/i
);

assert.match(
  migration,
  /users_provider_type_check/i
);

assert.match(
  migration,
  /"providerType" in \('TAILOR', 'INSTALLER'\)/i
);

assert.match(
  migration,
  /users_provider_customer_id_idx/i
);

assert.match(
  migration,
  /users_provider_type_idx/i
);

assert.match(
  migration,
  /begin;/i
);

assert.match(
  migration,
  /commit;/i
);

assert.match(
  verify,
  /invalid_provider_type_count/i
);

assert.match(
  verify,
  /invalid_role_link_count/i
);

console.log(
  "PROVIDER_USER_LINK_MIGRATION_SQL_TEST: PAK"
);