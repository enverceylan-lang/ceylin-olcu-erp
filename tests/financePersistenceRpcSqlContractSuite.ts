import assert from "node:assert/strict";

import {
  readFileSync
} from "node:fs";

import {
  resolve
} from "node:path";

const sql =
  readFileSync(
    resolve(
      process.cwd(),
      "docs/sql/20260731_finance_persistence_rpc_v1.sql"
    ),
    "utf8"
  );

assert.match(
  sql,
  /DURUM:\s*TASLAK/i
);

assert.match(
  sql,
  /CANLI SUPABASE['’]?E UYGULANMAYACAKTIR/i
);

assert.match(
  sql,
  /create or replace function public\.persist_finance_transaction_v1\s*\(\s*p_transaction jsonb,\s*p_audit jsonb\s*\)/i
);

assert.match(
  sql,
  /language plpgsql/i
);

assert.match(
  sql,
  /security definer/i
);

assert.match(
  sql,
  /set search_path = public, pg_temp/i
);

assert.match(
  sql,
  /FINANCE_SCOPE_REQUIRED/i
);

assert.match(
  sql,
  /FINANCE_AUDIT_TRANSACTION_MISMATCH/i
);

assert.match(
  sql,
  /FINANCE_AUDIT_MISSING/i
);

assert.match(
  sql,
  /IDEMPOTENCY_PAYLOAD_CONFLICT/i
);

assert.match(
  sql,
  /SOURCE_DOCUMENT_CONFLICT/i
);

assert.match(
  sql,
  /for update/i
);

assert.match(
  sql,
  /insert into public\.finance_transactions/i
);

assert.match(
  sql,
  /insert into public\.finance_transaction_audits/i
);

assert.match(
  sql,
  /'CREATED'::text/i
);

assert.match(
  sql,
  /'REPLAY'::text/i
);

assert.match(
  sql,
  /'CONFLICT'::text/i
);

assert.match(
  sql,
  /revoke all\s+on function public\.persist_finance_transaction_v1\(jsonb, jsonb\)\s+from public, anon, authenticated/i
);

assert.match(
  sql,
  /grant execute\s+on function public\.persist_finance_transaction_v1\(jsonb, jsonb\)\s+to service_role/i
);

assert.doesNotMatch(
  sql,
  /delete from/i
);

assert.doesNotMatch(
  sql,
  /truncate/i
);

assert.doesNotMatch(
  sql,
  /drop table/i
);

console.log(
  "financePersistenceRpcSqlContractSuite: PASS"
);