import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  "docs/sql/20260828_finance_counterparty_payment_reversal_atomic_v1.sql",
  "utf8",
);

assert.match(
  sql,
  /create or replace function public\.persist_finance_counterparty_payment_reversal_v1\(/i,
);
assert.match(sql, /security definer/i);
assert.match(sql, /set search_path = pg_catalog,\s*public/i);
assert.match(sql, /auth\.role\(\) is distinct from 'service_role'/i);
assert.match(
  sql,
  /v_kind <> 'PAYMENT'[\s\S]*v_action <> 'REVERSE'[\s\S]*v_channel not in \('CASH','BANK'\)/i,
);
assert.match(
  sql,
  /projection_source = 'PAYMENT'[\s\S]*transaction_type <> 'REVERSAL'/i,
);
assert.match(
  sql,
  /pm\.movement_kind = 'PAYMENT'[\s\S]*pm\.source_payment_id = v_source_finance\.operation_group_id/i,
);
assert.match(
  sql,
  /'kind', 'REVERSAL'[\s\S]*'reversalOfMovementId', v_source_payable\.movement_id/i,
);
assert.match(sql, /public\.persist_finance_operation_v1\(/i);
assert.match(sql, /public\.persist_counterparty_payable_movement_v1\(/i);
assert.match(
  sql,
  /FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_SOURCE_FINANCE_AMBIGUOUS/i,
);
assert.match(
  sql,
  /FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_SOURCE_PAYABLE_AMBIGUOUS/i,
);
assert.match(
  sql,
  /FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_OUTCOME_MISMATCH/i,
);
assert.match(
  sql,
  /revoke all[\s\S]*from public,\s*anon,\s*authenticated,\s*service_role/i,
);
assert.match(sql, /grant execute[\s\S]*to service_role/i);
assert.doesNotMatch(
  sql,
  /\bdelete\s+from\s+public\.(finance_transactions|counterparty_payable_movements)/i,
);

console.log("FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_ATOMIC_SQL_CONTRACT: PAK");