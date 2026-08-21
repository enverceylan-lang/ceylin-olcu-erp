import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  "docs/sql/20260816_finance_collection_authority_v1.sql",
  "utf8"
);

for (const table of [
  "finance_receivable_open_items_v1",
  "finance_collection_allocations_v1",
  "finance_instruments_v1",
  "finance_instrument_events_v1",
  "finance_instrument_allocations_v1"
]) {
  assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, "i"));
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  assert.match(sql, new RegExp(`alter table public\\.${table} force row level security`, "i"));
  assert.match(
    sql,
    new RegExp(
      `revoke all privileges on table public\\.${table} from public,anon,authenticated,service_role`,
      "i",
    ),
  );
}


assert.match(
  sql,
  /grant select,insert,update on table public\.finance_receivable_open_items_v1 to service_role/i,
);
assert.match(
  sql,
  /grant select,insert,update on table public\.finance_collection_allocations_v1 to service_role/i,
);
assert.match(
  sql,
  /grant select,insert,update on table public\.finance_instruments_v1 to service_role/i,
);
assert.match(
  sql,
  /grant select,insert on table public\.finance_instrument_events_v1 to service_role/i,
);
assert.match(
  sql,
  /grant select,insert,update on table public\.finance_instrument_allocations_v1 to service_role/i,
);
assert.match(sql, /opening_receivable_amount/i);
const uuidMinHits = sql.match(/min\s*\(\s*fa\.id\s*\)/gi) ?? [];
assert.equal(
  uuidMinHits.length,
  0,
  "UUID aggregate regression: min(fa.id) must remain absent",
);

const uuidAtomicSelectionHits =
  sql.match(/\(array_agg\(fa\.id order by fa\.id::text\)\)\[1\]/gi) ?? [];
assert.equal(
  uuidAtomicSelectionHits.length,
  8,
  "UUID account selection must use exactly eight count + deterministic array_agg selections",
);
assert.match(
  sql,
  /SYS-CUSTOMER-RECEIVABLE-/i,
  "sale receivable registration must bootstrap canonical CUSTOMER_RECEIVABLE ledger",
);
assert.match(
  sql,
  /account_type\s*=\s*'CUSTOMER_RECEIVABLE'[\s\S]*select count\(\*\)[\s\S]*into v_account_count[\s\S]*if v_account_count <> 1/i,
  "CUSTOMER_RECEIVABLE ledger cardinality must fail closed unless exactly one",
);
assert.match(
  sql,
  /v_currency \|\| '\|CUSTOMER_RECEIVABLE'[\s\S]*\)::uuid/i,
  "canonical CUSTOMER_RECEIVABLE ledger id must be deterministic by exact scope and currency",
);
assert.match(
  sql,
  /on conflict \(tenant_id,company_id,branch_id,accounting_period_id,code\)[\s\S]*do nothing/i,
  "canonical CUSTOMER_RECEIVABLE bootstrap must be idempotent under exact scoped code uniqueness",
);
assert.match(sql, /FINANCE_INSTALLMENT_TOTAL_MISMATCH/i);
assert.match(sql, /v_open is distinct from v_total/i);
assert.match(sql, /persist_finance_system_workflow_core_v1/i);
assert.match(sql, /register_finance_sale_receivables_v1\(p_source\)/i);
assert.match(sql, /persist_finance_collection_v1/i);
assert.match(sql, /reverse_finance_collection_v1/i);
assert.match(sql, /transition_finance_receivable_instrument_v1/i);
assert.match(sql, /order by oi\.due_date,oi\.document_number,oi\.sequence_no,oi\.id for update/i);
assert.match(sql, /FINANCE_COLLECTION_EXCEEDS_OPEN_RECEIVABLE/i);
assert.match(sql, /FINANCE_INSTRUMENT_NOMINAL_ALLOCATION_MISMATCH/i);
assert.match(sql, /fa\.account_type=case when v_channel='CHEQUE' then 'CHEQUE_RECEIVABLE' else 'NOTE_RECEIVABLE' end/i);
const instrumentReceipt = sql.split("if v_channel in ('CHEQUE','NOTE') then")[1]?.split("if v_channel='CASH' then")[0] || "";
assert.match(instrumentReceipt, /allocated_amount=allocated_amount\+v_line/i);
assert.match(instrumentReceipt, /v_line,'ALLOCATED'/i);
assert.match(instrumentReceipt, /insert into public\.finance_collection_allocations_v1/i);
assert.doesNotMatch(instrumentReceipt, /reserved_amount=reserved_amount\+v_line/i);
assert.match(sql, /FINANCE_COLLECTION_ALREADY_REVERSED/i);
assert.match(sql, /FINANCE_COLLECTION_REVERSAL_CHANNEL_MISMATCH/i);
assert.match(sql, /FINANCE_POS_ACTIVE_CONTRACT_NOT_UNIQUE/i);
assert.match(sql, /FINANCE_POS_ACTIVE_RULE_NOT_UNIQUE/i);
assert.match(sql, /sale_id drop not null/i);
assert.match(sql, /v_channel='POS' and v_receivable_ledger<>v_pos_contract\.customer_receivable_account_id/i);
assert.match(sql, /FINANCE_POS_COLLECTION_REVERSAL_STATE_INVALID/i);
assert.match(sql, /FINANCE_INSTRUMENT_STATE_TRANSITION_DENIED/i);
assert.match(sql, /FINANCE_INSTRUMENT_TYPE_MISMATCH/i);
const instrumentTransition = sql.split("create or replace function public.transition_finance_receivable_instrument_v1")[1] || "";
assert.match(instrumentTransition, /CHEQUE_IN_COLLECTION/i);
assert.match(instrumentTransition, /NOTE_IN_COLLECTION/i);
assert.match(instrumentTransition, /v_bank_ledger::text,v_collection_ledger::text/i);
assert.match(instrumentTransition, /FINANCE_INSTRUMENT_ENDORSE_EXCEEDS_COUNTERPARTY_PAYABLE/i);
assert.match(instrumentTransition, /FINANCE_INSTRUMENT_COLLECTION_BANK_MISMATCH/i);
assert.match(instrumentTransition, /FINANCE_INSTRUMENT_FROM_STATE_MISMATCH/i);
assert.match(instrumentTransition, /counterparty_type,movement_kind,amount/i);
assert.match(instrumentTransition, /v_counterparty,v_counterparty_type,'PAYMENT'/i);
assert.match(instrumentTransition, /pm\.counterparty_customer_id,pm\.counterparty_type,'REVERSAL'/i);
assert.match(instrumentTransition, /ia\.state='ALLOCATED'/i);
assert.doesNotMatch(instrumentTransition, /state='RESERVED'/i);
assert.match(instrumentTransition, /'REVERSAL_IN'/i);
assert.match(instrumentTransition, /'REVERSAL_OUT'/i);
assert.match(instrumentTransition, /v_operation::text,'OUT'/i);
assert.match(instrumentTransition, /v_operation::text,'IN'/i);
assert.doesNotMatch(instrumentTransition, /'ENDORSE_REVERSAL'|'CUSTOMER_RETURN'/i);
assert.match(sql, /clock_timestamp\(\)/i);
assert.match(sql, /auth\.role\(\) is distinct from 'service_role'/i);
assert.doesNotMatch(sql, /grant\s+(?:all|insert|update|delete)[\s\S]{0,80}\b(?:anon|authenticated)\b/i);

console.log("[PASS] finance collection authority SQL contract");
