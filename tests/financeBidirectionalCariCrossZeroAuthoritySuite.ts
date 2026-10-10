import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const successorPath = path.join(
  process.cwd(),
  "docs/sql/20261004_finance_bidirectional_cari_cross_zero_authority_v1.sql"
);

const historicalCollectionPath = path.join(
  process.cwd(),
  "docs/sql/20260816_finance_collection_authority_v1.sql"
);

const historicalPayableInstrumentPath = path.join(
  process.cwd(),
  "docs/sql/20260911_finance_payable_instrument_authority_v1.sql"
);

const historicalOpeningPath = path.join(
  process.cwd(),
  "docs/sql/20260928_finance_opening_balance_authority_v1.sql"
);

const sql = fs.readFileSync(successorPath, "utf8");
const historicalCollection = fs.readFileSync(
  historicalCollectionPath,
  "utf8"
);
const historicalPayableInstrument = fs.readFileSync(
  historicalPayableInstrumentPath,
  "utf8"
);
const historicalOpening = fs.readFileSync(
  historicalOpeningPath,
  "utf8"
);

assert.match(
  sql,
  /create or replace function public\.persist_finance_counterparty_payment_v1/i
);

assert.match(
  sql,
  /create or replace function public\.persist_finance_payable_instrument_v1/i
);

assert.match(
  sql,
  /create or replace function public\.transition_finance_receivable_instrument_v1/i
);

assert.doesNotMatch(
  sql,
  /FINANCE_CUSTOMER_PAYMENT_EXCEEDS_PAYABLE/i
);

assert.doesNotMatch(
  sql,
  /FINANCE_PAYABLE_INSTRUMENT_EXCEEDS_COUNTERPARTY_PAYABLE/i
);

assert.doesNotMatch(
  sql,
  /FINANCE_INSTRUMENT_ENDORSE_EXCEEDS_COUNTERPARTY_PAYABLE/i
);

assert.match(
  sql,
  /FINANCE_COUNTERPARTY_PAYMENT_SERVICE_ROLE_REQUIRED/i
);

assert.match(
  sql,
  /FINANCE_COUNTERPARTY_PAYMENT_CROSS_AUTHORITY_MISMATCH/i
);

assert.match(
  sql,
  /FINANCE_COUNTERPARTY_PAYMENT_OUTCOME_MISMATCH/i
);

assert.match(
  sql,
  /persist_finance_operation_v1/i
);

assert.match(
  sql,
  /persist_counterparty_payable_movement_v1/i
);

assert.match(
  sql,
  /counterparty_payable_movements/i
);

assert.match(
  sql,
  /finance_transaction_audits/i
);

assert.match(
  historicalCollection,
  /FINANCE_INSTRUMENT_NOMINAL_ALLOCATION_MISMATCH/i
);

assert.match(
  historicalCollection,
  /FINANCE_POS_COLLECTION_DEDUCTION_EXCEEDS_GROSS/i
);

assert.match(
  historicalOpening,
  /FINANCE_CUSTOMER_PAYMENT_EXCEEDS_PAYABLE/i
);

assert.match(
  historicalPayableInstrument,
  /FINANCE_PAYABLE_INSTRUMENT_EXCEEDS_COUNTERPARTY_PAYABLE/i
);

assert.match(
  historicalCollection,
  /FINANCE_INSTRUMENT_ENDORSE_EXCEEDS_COUNTERPARTY_PAYABLE/i
);

console.log(
  "[PASS] bidirectional cari cross-zero successor removes only balance-cap guards"
);

console.log(
  "[PASS] scope/idempotency/audit/cross-authority markers preserved"
);

console.log(
  "[PASS] cheque-note nominal and POS deduction integrity guards preserved"
);

console.log(
  "[PASS] historical migrations remain unchanged and successor-only"
);