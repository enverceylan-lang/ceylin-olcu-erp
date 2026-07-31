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
  /v_constraint_name text;/i
);

assert.match(
  sql,
  /get stacked diagnostics\s+v_constraint_name\s*=\s*constraint_name\s*;/i
);

assert.match(
  sql,
  /when 'finance_transactions_pk' then\s+'TRANSACTION_ID_CONFLICT'/i
);

assert.match(
  sql,
  /when 'finance_transactions_transaction_id_uq' then\s+'TRANSACTION_ID_CONFLICT'/i
);

assert.match(
  sql,
  /when 'finance_transactions_idempotency_uq' then\s+'IDEMPOTENCY_PAYLOAD_CONFLICT'/i
);

assert.match(
  sql,
  /when 'finance_transactions_source_document_uq' then\s+'SOURCE_DOCUMENT_CONFLICT'/i
);

assert.match(
  sql,
  /when 'finance_transaction_audits_pk' then\s+'TRANSACTION_ID_CONFLICT'/i
);

assert.match(
  sql,
  /when 'finance_transaction_audits_event_uq' then\s+'TRANSACTION_ID_CONFLICT'/i
);

assert.match(
  sql,
  /if v_conflict_reason is null then\s+raise\s*;/i
);

assert.doesNotMatch(
  sql,
  /when unique_violation then\s+return query\s+select\s+'CONFLICT'::text,\s+v_transaction_id,\s+'SOURCE_DOCUMENT_CONFLICT'::text/i
);

assert.match(
  sql,
  /revoke all\s+on function public\.persist_finance_transaction_v1\(jsonb, jsonb\)\s+from public, anon, authenticated;/i
);

assert.match(
  sql,
  /grant execute\s+on function public\.persist_finance_transaction_v1\(jsonb, jsonb\)\s+to service_role;/i
);

console.log(
  "financePersistenceRpcConflictClassificationSuite: PASS"
);