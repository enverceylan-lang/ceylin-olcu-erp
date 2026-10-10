import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(
  resolve(process.cwd(), "docs/sql/20260928_finance_opening_balance_authority_v1.sql"),
  "utf8",
);

assert.match(sql, /alter column sale_id drop not null/i);
assert.match(sql, /add column if not exists source_type text/i);
assert.match(sql, /add column if not exists source_document_id text/i);
assert.match(sql, /source_type='SALE'[\s\S]*source_document_id=sale_id/i);
assert.match(sql, /source_type in \('SALE','OPENING_BALANCE'\)/i);
assert.match(sql, /source_type='OPENING_BALANCE'[\s\S]*sale_id is null/i);
assert.match(sql, /source_type,source_document_id,sequence_no/i);
assert.match(sql, /finance_collection_allocations_v1[\s\S]*alter column sale_id drop not null/i);
assert.match(sql, /finance_instrument_allocations_v1[\s\S]*alter column sale_id drop not null/i);
assert.match(sql, /counterparty_type in \('CUSTOMER','SUPPLIER','TAILOR','INSTALLER'\)/i);
assert.match(sql, /v_counterparty_type not in \('CUSTOMER','SUPPLIER','TAILOR','INSTALLER'\)/i);
assert.match(sql, /v_movement_type not in \('CUSTOMER','SUPPLIER','TAILOR','INSTALLER'\)/i);
assert.match(sql, /FINANCE_CUSTOMER_PAYMENT_EXCEEDS_PAYABLE/i);
assert.match(sql, /create or replace function public\.persist_finance_opening_balance_v1\s*\(/i);
assert.match(sql, /FINANCE_OPENING_BALANCE_STABLE_IDENTITY_REQUIRED/i);
assert.match(sql, /FINANCE_OPENING_BALANCE_CUSTOMER_SCOPE_INVALID/i);
assert.match(sql, /finance_operation_requests_v1/i);
assert.match(sql, /IDEMPOTENCY_PAYLOAD_CONFLICT/i);
assert.match(sql, /FINANCE_OPENING_BALANCE_SOURCE_DOCUMENT_CONFLICT/i);
assert.match(sql, /v_customer,null,'OPENING_BALANCE',v_source_id/i);
assert.match(sql, /v_customer,'CUSTOMER','ACCRUAL'/i);
assert.match(sql, /'sourceType', source_type/i);
assert.match(sql, /'sourceDocumentId', source_document_id/i);
assert.match(sql, /projection_source in \([\s\S]*'OPENING_BALANCE'/i);
assert.match(sql, /grant execute[\s\S]*persist_finance_opening_balance_v1\(jsonb,text,text\)[\s\S]*to service_role/i);
assert.doesNotMatch(sql, /\bdelete\s+from\b/i);

console.log("FINANCE_OPENING_BALANCE_SQL_CONTRACT: PAK");
