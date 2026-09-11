import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sql=readFileSync("docs/sql/20260911_finance_payable_instrument_authority_v1.sql","utf8");

assert.match(sql,/FINANCE_PAYABLE_INSTRUMENT_SERVICE_ROLE_REQUIRED/);
assert.match(sql,/finance_operation_requests_v1/);
assert.match(sql,/IDEMPOTENCY_PAYLOAD_CONFLICT/);
assert.match(sql,/FINANCE_PAYABLE_INSTRUMENT_PENDING_CONFLICT/);

assert.match(sql,/'PAYABLE','ISSUED'/);
assert.match(sql,/account_type='CUSTOMER_PAYABLE'/);
assert.match(sql,/CHEQUE_PAYABLE/);
assert.match(sql,/NOTE_PAYABLE/);
assert.match(sql,/FINANCE_PAYABLE_INSTRUMENT_EXCEEDS_COUNTERPARTY_PAYABLE/);
assert.match(sql,/counterparty_payable_movements[\s\S]*'PAYMENT'/);
assert.match(sql,/counterparty_payable_audits/);
assert.match(sql,/finance_transactions[\s\S]*'PAYMENT','DEBIT'/);
assert.match(sql,/PROMISSORY_NOTE/);

assert.match(sql,/v_next='PAID'/);
assert.match(sql,/bank_accounts/);
assert.match(sql,/BANK_TRANSFER/);
assert.match(sql,/finance_transactions[\s\S]*'TRANSFER','DEBIT'/);

assert.match(sql,/v_next not in\('PAID','RETURNED','CANCELLED'\)/);
assert.match(sql,/instrument-payment-reversal:/);
assert.match(sql,/reversal_of_movement_id/);
assert.match(sql,/transaction_type='PAYMENT'/);
assert.match(sql,/'REVERSAL',case when v_original_payment\.direction='DEBIT' then 'CREDIT' else 'DEBIT' end/);
assert.match(sql,/reversal_of_transaction_id/);
assert.match(sql,/set status='REVERSED',reversed_at=v_now/);

assert.match(sql,/revoke all on function public\.persist_finance_payable_instrument_v1/);
assert.match(sql,/grant execute on function public\.transition_finance_payable_instrument_v1/);

console.log("F2B_PAYABLE_INSTRUMENT_ACCOUNTING_SEMANTICS: PAK");