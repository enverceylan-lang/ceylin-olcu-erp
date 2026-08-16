import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(
  resolve("docs/sql/20260815_finance_operations_v1_server_persistence.sql"),
  "utf8"
);

assert.match(sql, /v_reject_reason text := null;/);
assert.match(sql, /<<operation_body>>[\s\S]*begin/);
assert.match(
  sql,
  /if v_reject_reason is not null then[\s\S]*set outcome='REJECT'[\s\S]*completed_at=now\(\)[\s\S]*return query select 'REJECT'/
);

const directPostReservationRejects = [
  "FINANCE_REVERSAL_TARGET_REQUIRED",
  "FINANCE_TRANSFER_SOURCE_BANK_INACTIVE_OR_MISSING",
  "FINANCE_TRANSFER_CURRENCY_OR_DESTINATION_INVALID",
  "FINANCE_COLLECTION_CUSTOMER_REQUIRED",
  "FINANCE_PAYMENT_COUNTERPARTY_REQUIRED",
  "FINANCE_OPERATION_CHANNEL_UNSUPPORTED",
  "FINANCE_OPERATION_ACCOUNT_INACTIVE_SCOPE_OR_CURRENCY",
  "FINANCE_COUNTER_LEDGER_INVALID",
  "FINANCE_OPERATION_NOT_IMPLEMENTED"
];

for (const reason of directPostReservationRejects) {
  assert.match(
    sql,
    new RegExp(`v_reject_reason := '${reason}';[\\s\\S]{0,100}exit operation_body;`)
  );
}

assert.match(
  sql,
  /exception[\s\S]*when unique_violation then[\s\S]*raise;[\s\S]*end;/
);
assert.doesNotMatch(
  sql,
  /when unique_violation then[\s\S]{0,200}return query select 'CONFLICT'/
);

console.log("[PASS] Finance Operations terminal idempotency state machine");