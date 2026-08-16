-- ENVerp Finance POS Server Authority V1
-- SOURCE PATCH ONLY. NO LIVE APPLY WITHOUT SEPARATE EXPLICIT AUTHORIZATION.
-- Canonical finance movements remain public.finance_transactions + public.finance_transaction_audits.
-- Existing TS POS domain remains pricing/lifecycle contract; this migration persists that model server-side.
-- No physical delete. Reversal only. All writes are service-role RPC and exact scope checked.

begin;

alter table public.finance_transactions
  drop constraint if exists finance_transactions_operation_leg_ck;

alter table public.finance_transactions
  add constraint finance_transactions_operation_leg_ck check (
    operation_leg is null or operation_leg in (
      'SINGLE','OUT','IN','REVERSAL_OUT','REVERSAL_IN',
      'POS_COLLECTION','POS_SETTLEMENT_BANK','POS_SETTLEMENT_COMMISSION',
      'POS_SETTLEMENT_TAX','POS_SETTLEMENT_ADDITIONAL',
      'POS_MONTHLY_FEE','POS_MONTHLY_FEE_TAX','POS_REFUND','POS_COLLECTION_REVERSAL'
    )
  );

create table if not exists public.finance_pos_contracts_v1 (
  id uuid primary key,
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  contract_number text not null,
  contract_name text not null,
  pos_account_id uuid not null,
  bank_account_id uuid not null,
  clearing_ledger_account_id uuid not null,
  customer_receivable_account_id uuid not null,
  commission_expense_account_id uuid not null,
  tax_expense_account_id uuid not null,
  monthly_fee_expense_account_id uuid not null,
  working_mode text not null,
  monthly_fixed_fee_enabled boolean not null default false,
  monthly_fixed_fee_amount numeric(18,2) not null default 0,
  monthly_fee_tax_rate numeric(9,4) not null default 0,
  currency text not null,
  valid_from date not null,
  valid_until date null,
  is_active boolean not null default true,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  constraint finance_pos_contracts_scope_nonblank_chk check (
    btrim(tenant_id) <> '' and btrim(company_id) <> '' and
    btrim(branch_id) <> '' and btrim(accounting_period_id) <> ''
  ),
  constraint finance_pos_contracts_name_nonblank_chk check (
    btrim(contract_number) <> '' and btrim(contract_name) <> ''
  ),
  constraint finance_pos_contracts_working_mode_chk check (
    working_mode in ('ADVANCE_NET','MONTHLY_BLOCKED','BLOCKED_FIXED_DAY','MANUAL')
  ),
  constraint finance_pos_contracts_currency_chk check (currency ~ '^[A-Z]{3}$'),
  constraint finance_pos_contracts_fee_chk check (
    monthly_fixed_fee_amount >= 0 and monthly_fee_tax_rate >= 0
  ),
  constraint finance_pos_contracts_fee_state_chk check (
    monthly_fixed_fee_enabled = true or monthly_fixed_fee_amount = 0
  ),
  constraint finance_pos_contracts_date_chk check (
    valid_until is null or valid_until >= valid_from
  ),
  constraint finance_pos_contracts_archive_chk check (
    (is_active = true and archived_at is null) or
    (is_active = false and archived_at is not null)
  ),
  constraint finance_pos_contracts_scope_id_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint finance_pos_contracts_scope_number_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, contract_number
  ),
  constraint finance_pos_contracts_pos_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, pos_account_id
  ) references public.pos_accounts (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint finance_pos_contracts_bank_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, bank_account_id
  ) references public.bank_accounts (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint finance_pos_contracts_clearing_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, clearing_ledger_account_id
  ) references public.finance_accounts (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint finance_pos_contracts_customer_receivable_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, customer_receivable_account_id
  ) references public.finance_accounts (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint finance_pos_contracts_commission_expense_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, commission_expense_account_id
  ) references public.finance_accounts (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint finance_pos_contracts_tax_expense_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, tax_expense_account_id
  ) references public.finance_accounts (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint finance_pos_contracts_monthly_expense_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, monthly_fee_expense_account_id
  ) references public.finance_accounts (
    tenant_id, company_id, branch_id, accounting_period_id, id
  )
);

create table if not exists public.finance_pos_contract_rules_v1 (
  id uuid primary key,
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  contract_id uuid not null,
  pos_account_id uuid not null,
  installment_count integer not null,
  working_mode text not null,
  commission_rate numeric(9,4) not null default 0,
  fixed_transaction_fee numeric(18,2) not null default 0,
  tax_rate numeric(9,4) not null default 0,
  additional_fee_rate numeric(9,4) not null default 0,
  first_settlement_day_count integer not null default 0,
  installment_interval_day_count integer not null default 0,
  is_active boolean not null default true,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  constraint finance_pos_rules_scope_nonblank_chk check (
    btrim(tenant_id) <> '' and btrim(company_id) <> '' and
    btrim(branch_id) <> '' and btrim(accounting_period_id) <> ''
  ),
  constraint finance_pos_rules_installment_chk check (installment_count > 0),
  constraint finance_pos_rules_working_mode_chk check (
    working_mode in ('ADVANCE_NET','MONTHLY_BLOCKED','BLOCKED_FIXED_DAY','MANUAL')
  ),
  constraint finance_pos_rules_rates_chk check (
    commission_rate >= 0 and fixed_transaction_fee >= 0 and tax_rate >= 0 and
    additional_fee_rate >= 0 and first_settlement_day_count >= 0 and
    installment_interval_day_count >= 0
  ),
  constraint finance_pos_rules_interval_chk check (
    working_mode <> 'MONTHLY_BLOCKED' or installment_interval_day_count > 0
  ),
  constraint finance_pos_rules_archive_chk check (
    (is_active = true and archived_at is null) or
    (is_active = false and archived_at is not null)
  ),
  constraint finance_pos_rules_scope_id_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint finance_pos_rules_contract_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, contract_id
  ) references public.finance_pos_contracts_v1 (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint finance_pos_rules_pos_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, pos_account_id
  ) references public.pos_accounts (
    tenant_id, company_id, branch_id, accounting_period_id, id
  )
);

create unique index if not exists finance_pos_rules_active_installment_uk
on public.finance_pos_contract_rules_v1 (
  tenant_id, company_id, branch_id, accounting_period_id, contract_id, installment_count
)
where is_active = true and archived_at is null;

create table if not exists public.finance_pos_transactions_v1 (
  id uuid primary key,
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  pos_transaction_number text not null,
  pos_account_id uuid not null,
  bank_account_id uuid not null,
  contract_id uuid not null,
  rule_id uuid not null,
  sale_id text not null,
  sale_number text not null,
  payment_id text not null,
  customer_id text not null,
  installment_count integer not null,
  working_mode text not null,
  gross_amount numeric(18,2) not null,
  commission_amount numeric(18,2) not null,
  fixed_transaction_fee numeric(18,2) not null,
  tax_amount numeric(18,2) not null,
  additional_fee_amount numeric(18,2) not null,
  total_deduction_amount numeric(18,2) not null,
  net_amount numeric(18,2) not null,
  settled_amount numeric(18,2) not null default 0,
  pending_amount numeric(18,2) not null,
  currency text not null,
  transaction_date date not null,
  expected_first_settlement_date date not null,
  expected_final_settlement_date date not null,
  actual_settlement_date date null,
  status text not null,
  description text null,
  rule_snapshot jsonb not null,
  collection_finance_transaction_id text not null,
  created_by text not null,
  created_at timestamptz not null,
  reversed_at timestamptz null,
  reversal_finance_transaction_id text null,
  constraint finance_pos_transactions_scope_nonblank_chk check (
    btrim(tenant_id) <> '' and btrim(company_id) <> '' and
    btrim(branch_id) <> '' and btrim(accounting_period_id) <> ''
  ),
  constraint finance_pos_transactions_number_nonblank_chk check (
    btrim(pos_transaction_number) <> '' and btrim(payment_id) <> '' and
    btrim(customer_id) <> '' and btrim(sale_id) <> ''
  ),
  constraint finance_pos_transactions_amount_chk check (
    gross_amount > 0 and commission_amount >= 0 and fixed_transaction_fee >= 0 and
    tax_amount >= 0 and additional_fee_amount >= 0 and total_deduction_amount >= 0 and
    net_amount >= 0 and settled_amount >= 0 and pending_amount >= 0 and (
      (status <> 'REVERSED' and settled_amount + pending_amount = net_amount) or
      (status = 'REVERSED' and pending_amount = 0)
    )
  ),
  constraint finance_pos_transactions_currency_chk check (currency ~ '^[A-Z]{3}$'),
  constraint finance_pos_transactions_status_chk check (
    status in ('PENDING_SETTLEMENT','PARTIALLY_SETTLED','SETTLED','REFUNDED','REVERSED')
  ),
  constraint finance_pos_transactions_scope_id_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint finance_pos_transactions_scope_number_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, pos_transaction_number
  ),
  constraint finance_pos_transactions_contract_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, contract_id
  ) references public.finance_pos_contracts_v1 (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint finance_pos_transactions_rule_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, rule_id
  ) references public.finance_pos_contract_rules_v1 (
    tenant_id, company_id, branch_id, accounting_period_id, id
  )
);

create unique index if not exists finance_pos_transactions_active_payment_uk
on public.finance_pos_transactions_v1 (
  tenant_id, company_id, branch_id, accounting_period_id, payment_id
)
where status <> 'REVERSED';

create table if not exists public.finance_pos_settlement_schedules_v1 (
  id uuid primary key,
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  transaction_id uuid not null,
  contract_id uuid not null,
  rule_id uuid not null,
  pos_account_id uuid not null,
  bank_account_id uuid not null,
  working_mode text not null,
  installment_count integer not null,
  gross_amount numeric(18,2) not null,
  total_deduction_amount numeric(18,2) not null,
  net_amount numeric(18,2) not null,
  settled_amount numeric(18,2) not null default 0,
  pending_amount numeric(18,2) not null,
  currency text not null,
  created_by text not null,
  created_at timestamptz not null,
  reversed_at timestamptz null,
  constraint finance_pos_schedules_amount_chk check (
    gross_amount > 0 and total_deduction_amount >= 0 and net_amount >= 0 and
    settled_amount >= 0 and pending_amount >= 0 and (
      (reversed_at is null and settled_amount + pending_amount = net_amount) or
      (reversed_at is not null and pending_amount = 0)
    )
  ),
  constraint finance_pos_schedules_scope_id_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint finance_pos_schedules_transaction_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, transaction_id
  ),
  constraint finance_pos_schedules_transaction_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, transaction_id
  ) references public.finance_pos_transactions_v1 (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint finance_pos_schedules_contract_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, contract_id
  ) references public.finance_pos_contracts_v1 (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint finance_pos_schedules_rule_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, rule_id
  ) references public.finance_pos_contract_rules_v1 (
    tenant_id, company_id, branch_id, accounting_period_id, id
  )
);

create table if not exists public.finance_pos_settlement_lines_v1 (
  id uuid primary key,
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  schedule_id uuid not null,
  transaction_id uuid not null,
  sequence integer not null,
  expected_settlement_date date not null,
  actual_settlement_date date null,
  gross_amount numeric(18,2) not null,
  commission_amount numeric(18,2) not null,
  fixed_transaction_fee numeric(18,2) not null,
  tax_amount numeric(18,2) not null,
  additional_fee_amount numeric(18,2) not null,
  net_amount numeric(18,2) not null,
  settled_amount numeric(18,2) not null default 0,
  pending_amount numeric(18,2) not null,
  status text not null,
  reversed_at timestamptz null,
  constraint finance_pos_lines_sequence_chk check (sequence > 0),
  constraint finance_pos_lines_amount_chk check (
    gross_amount >= 0 and commission_amount >= 0 and fixed_transaction_fee >= 0 and
    tax_amount >= 0 and additional_fee_amount >= 0 and net_amount >= 0 and
    settled_amount >= 0 and pending_amount >= 0 and (
      (status <> 'REVERSED' and settled_amount + pending_amount = net_amount) or
      (status = 'REVERSED' and pending_amount = 0)
    )
  ),
  constraint finance_pos_lines_status_chk check (
    status in ('PENDING','PARTIALLY_SETTLED','SETTLED','REVERSED')
  ),
  constraint finance_pos_lines_scope_id_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint finance_pos_lines_schedule_sequence_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, schedule_id, sequence
  ),
  constraint finance_pos_lines_schedule_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, schedule_id
  ) references public.finance_pos_settlement_schedules_v1 (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint finance_pos_lines_transaction_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, transaction_id
  ) references public.finance_pos_transactions_v1 (
    tenant_id, company_id, branch_id, accounting_period_id, id
  )
);

create table if not exists public.finance_pos_settlements_v1 (
  id uuid primary key,
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  settlement_number text not null,
  transaction_id uuid not null,
  schedule_line_id uuid not null,
  net_amount numeric(18,2) not null,
  commission_amount numeric(18,2) not null,
  fixed_transaction_fee numeric(18,2) not null,
  tax_amount numeric(18,2) not null,
  additional_fee_amount numeric(18,2) not null,
  clearing_amount numeric(18,2) not null,
  settlement_date date not null,
  bank_finance_transaction_id text not null,
  commission_finance_transaction_id text null,
  tax_finance_transaction_id text null,
  additional_fee_finance_transaction_id text null,
  created_by text not null,
  created_at timestamptz not null,
  reversed_at timestamptz null,
  constraint finance_pos_settlements_amount_chk check (
    net_amount > 0 and commission_amount >= 0 and fixed_transaction_fee >= 0 and
    tax_amount >= 0 and additional_fee_amount >= 0 and clearing_amount > 0
  ),
  constraint finance_pos_settlements_scope_id_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint finance_pos_settlements_scope_number_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, settlement_number
  ),
  constraint finance_pos_settlements_transaction_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, transaction_id
  ) references public.finance_pos_transactions_v1 (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint finance_pos_settlements_line_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, schedule_line_id
  ) references public.finance_pos_settlement_lines_v1 (
    tenant_id, company_id, branch_id, accounting_period_id, id
  )
);

create table if not exists public.finance_pos_monthly_fees_v1 (
  id uuid primary key,
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  fee_number text not null,
  contract_id uuid not null,
  year integer not null,
  month integer not null,
  gross_amount numeric(18,2) not null,
  tax_amount numeric(18,2) not null,
  net_amount numeric(18,2) not null,
  currency text not null,
  payment_date date not null,
  fee_finance_transaction_id text not null,
  tax_finance_transaction_id text null,
  status text not null,
  created_by text not null,
  created_at timestamptz not null,
  reversed_at timestamptz null,
  constraint finance_pos_monthly_fees_month_chk check (month between 1 and 12),
  constraint finance_pos_monthly_fees_year_chk check (year between 2000 and 2200),
  constraint finance_pos_monthly_fees_amount_chk check (
    gross_amount >= 0 and tax_amount >= 0 and net_amount = gross_amount + tax_amount
  ),
  constraint finance_pos_monthly_fees_status_chk check (status in ('PAID','REVERSED')),
  constraint finance_pos_monthly_fees_scope_id_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint finance_pos_monthly_fees_period_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, contract_id, year, month
  ),
  constraint finance_pos_monthly_fees_contract_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, contract_id
  ) references public.finance_pos_contracts_v1 (
    tenant_id, company_id, branch_id, accounting_period_id, id
  )
);

alter table public.finance_pos_contracts_v1 enable row level security;
alter table public.finance_pos_contracts_v1 force row level security;
alter table public.finance_pos_contract_rules_v1 enable row level security;
alter table public.finance_pos_contract_rules_v1 force row level security;
alter table public.finance_pos_transactions_v1 enable row level security;
alter table public.finance_pos_transactions_v1 force row level security;
alter table public.finance_pos_settlement_schedules_v1 enable row level security;
alter table public.finance_pos_settlement_schedules_v1 force row level security;
alter table public.finance_pos_settlement_lines_v1 enable row level security;
alter table public.finance_pos_settlement_lines_v1 force row level security;
alter table public.finance_pos_settlements_v1 enable row level security;
alter table public.finance_pos_settlements_v1 force row level security;
alter table public.finance_pos_monthly_fees_v1 enable row level security;
alter table public.finance_pos_monthly_fees_v1 force row level security;

revoke all on table public.finance_pos_contracts_v1 from public, anon, authenticated;
revoke all on table public.finance_pos_contract_rules_v1 from public, anon, authenticated;
revoke all on table public.finance_pos_transactions_v1 from public, anon, authenticated;
revoke all on table public.finance_pos_settlement_schedules_v1 from public, anon, authenticated;
revoke all on table public.finance_pos_settlement_lines_v1 from public, anon, authenticated;
revoke all on table public.finance_pos_settlements_v1 from public, anon, authenticated;
revoke all on table public.finance_pos_monthly_fees_v1 from public, anon, authenticated;

grant select on table public.finance_pos_contracts_v1 to service_role;
grant select on table public.finance_pos_contract_rules_v1 to service_role;
grant select on table public.finance_pos_transactions_v1 to service_role;
grant select on table public.finance_pos_settlement_schedules_v1 to service_role;
grant select on table public.finance_pos_settlement_lines_v1 to service_role;
grant select on table public.finance_pos_settlements_v1 to service_role;
grant select on table public.finance_pos_monthly_fees_v1 to service_role;

create or replace function public.persist_finance_pos_authority_v1(
  p_operation jsonb,
  p_actor_user_id text,
  p_payload_hash text
)
returns table(
  outcome text,
  operation_id text,
  transaction_ids text[],
  reason text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_tenant text := trim(coalesce(p_operation->>'tenantId',''));
  v_company text := trim(coalesce(p_operation->>'companyId',''));
  v_branch text := trim(coalesce(p_operation->>'branchId',''));
  v_period text := trim(coalesce(p_operation->>'accountingPeriodId',''));
  v_operation_id text := trim(coalesce(p_operation->>'operationId',''));
  v_idem text := trim(coalesce(p_operation->>'idempotencyKey',''));
  v_action text := trim(coalesce(p_operation->>'action',''));
  v_occurred_at timestamptz := nullif(p_operation->>'occurredAt','')::timestamptz;
  v_existing public.finance_operation_requests_v1%rowtype;
  v_reject_reason text := null;
  v_tx_ids text[] := array[]::text[];

  v_contract_id uuid;
  v_rule_id uuid;
  v_pos_id uuid;
  v_bank_id uuid;
  v_clearing_id uuid;
  v_customer_receivable_id uuid;
  v_commission_expense_id uuid;
  v_tax_expense_id uuid;
  v_monthly_expense_id uuid;
  v_currency text;
  v_account_currency text;
  v_working_mode text;

  v_transaction_id uuid;
  v_schedule_id uuid;
  v_line_id uuid;
  v_settlement_id uuid;
  v_monthly_fee_id uuid;
  v_refund_id uuid;
  v_reversal_id uuid;

  v_contract public.finance_pos_contracts_v1%rowtype;
  v_rule public.finance_pos_contract_rules_v1%rowtype;
  v_pos_tx public.finance_pos_transactions_v1%rowtype;
  v_line public.finance_pos_settlement_lines_v1%rowtype;

  v_gross numeric;
  v_commission numeric;
  v_fixed numeric;
  v_tax numeric;
  v_additional numeric;
  v_deduction numeric;
  v_net numeric;
  v_amount numeric;
  v_ratio numeric;
  v_clearing numeric;

  v_part_count integer;
  v_i integer;
  v_part_gross numeric;
  v_part_commission numeric;
  v_part_fixed numeric;
  v_part_tax numeric;
  v_part_additional numeric;
  v_part_net numeric;
  v_sum_gross numeric := 0;
  v_sum_commission numeric := 0;
  v_sum_fixed numeric := 0;
  v_sum_tax numeric := 0;
  v_sum_additional numeric := 0;
  v_sum_net numeric := 0;
  v_expected_date date;

  v_prior_commission numeric;
  v_prior_fixed numeric;
  v_prior_tax numeric;
  v_prior_additional numeric;
  v_component numeric;
  v_finance_id text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FINANCE_POS_SERVICE_ROLE_REQUIRED';
  end if;

  if p_operation is null or jsonb_typeof(p_operation) <> 'object' then
    return query select 'REJECT', null::text, null::text[], 'FINANCE_POS_PAYLOAD_REQUIRED';
    return;
  end if;

  if v_tenant = '' or v_company = '' or v_branch = '' or v_period = '' or
     v_operation_id = '' or v_idem = '' or trim(coalesce(p_payload_hash,'')) = '' or
     trim(coalesce(p_actor_user_id,'')) = '' or v_occurred_at is null then
    return query select 'REJECT', v_operation_id, null::text[], 'FINANCE_POS_REQUIRED_FIELD_MISSING';
    return;
  end if;

  insert into public.finance_operation_requests_v1 (
    tenant_id, company_id, branch_id, accounting_period_id,
    idempotency_key, payload_hash, operation_id, outcome, actor_user_id
  )
  values (
    v_tenant, v_company, v_branch, v_period,
    v_idem, p_payload_hash, v_operation_id, 'PENDING', p_actor_user_id
  )
  on conflict do nothing;

  if not found then
    select *
    into v_existing
    from public.finance_operation_requests_v1 r
    where r.tenant_id=v_tenant and r.company_id=v_company and
          r.branch_id=v_branch and r.accounting_period_id=v_period and
          r.idempotency_key=v_idem
    for update;

    if v_existing.payload_hash is distinct from p_payload_hash then
      return query select 'CONFLICT', v_existing.operation_id, null::text[], 'IDEMPOTENCY_PAYLOAD_CONFLICT';
      return;
    end if;

    if v_existing.outcome='CREATED' then
      return query select
        'REPLAY',
        v_existing.operation_id,
        coalesce(array(select jsonb_array_elements_text(v_existing.result_json->'transactionIds')), array[]::text[]),
        null::text;
      return;
    end if;

    if v_existing.outcome='REJECT' then
      return query select 'REJECT',v_existing.operation_id,null::text[],v_existing.result_json->>'reason';
      return;
    end if;

    return query select 'CONFLICT',v_existing.operation_id,null::text[],'FINANCE_OPERATION_PENDING_CONFLICT';
    return;
  end if;

  <<pos_body>>
  begin
    if v_action='UPSERT_CONTRACT' then
      begin
        v_contract_id := nullif(p_operation#>>'{contract,contractId}','')::uuid;
        v_pos_id := nullif(p_operation#>>'{contract,posAccountId}','')::uuid;
        v_customer_receivable_id := nullif(p_operation#>>'{contract,accounts,customerReceivableAccountId}','')::uuid;
        v_commission_expense_id := nullif(p_operation#>>'{contract,accounts,commissionExpenseAccountId}','')::uuid;
        v_tax_expense_id := nullif(p_operation#>>'{contract,accounts,taxExpenseAccountId}','')::uuid;
        v_monthly_expense_id := nullif(p_operation#>>'{contract,accounts,monthlyFeeExpenseAccountId}','')::uuid;
      exception when others then
        v_reject_reason := 'FINANCE_POS_CONTRACT_UUID_INVALID';
        exit pos_body;
      end;

      select pa.bank_account_id, pa.clearing_ledger_account_id, pa.currency
      into v_bank_id, v_clearing_id, v_account_currency
      from public.pos_accounts pa
      where pa.id=v_pos_id and pa.tenant_id=v_tenant and pa.company_id=v_company and
            pa.branch_id=v_branch and pa.accounting_period_id=v_period and
            pa.is_active=true and pa.archived_at is null
      for update;

      v_currency := upper(trim(coalesce(p_operation#>>'{contract,currency}','')));
      if not found or v_currency<>v_account_currency then
        v_reject_reason := 'FINANCE_POS_CONTRACT_POS_SCOPE_OR_CURRENCY_INVALID';
        exit pos_body;
      end if;

      if not exists (
        select 1 from public.finance_accounts fa
        where fa.id=v_customer_receivable_id and fa.tenant_id=v_tenant and fa.company_id=v_company and
              fa.branch_id=v_branch and fa.accounting_period_id=v_period and fa.is_active=true and
              fa.archived_at is null and fa.currency=v_currency and fa.account_type='CUSTOMER_RECEIVABLE'
      ) or not exists (
        select 1 from public.finance_accounts fa
        where fa.id=v_commission_expense_id and fa.tenant_id=v_tenant and fa.company_id=v_company and
              fa.branch_id=v_branch and fa.accounting_period_id=v_period and fa.is_active=true and
              fa.archived_at is null and fa.currency=v_currency and fa.account_type='OTHER'
      ) or not exists (
        select 1 from public.finance_accounts fa
        where fa.id=v_tax_expense_id and fa.tenant_id=v_tenant and fa.company_id=v_company and
              fa.branch_id=v_branch and fa.accounting_period_id=v_period and fa.is_active=true and
              fa.archived_at is null and fa.currency=v_currency and fa.account_type='OTHER'
      ) or not exists (
        select 1 from public.finance_accounts fa
        where fa.id=v_monthly_expense_id and fa.tenant_id=v_tenant and fa.company_id=v_company and
              fa.branch_id=v_branch and fa.accounting_period_id=v_period and fa.is_active=true and
              fa.archived_at is null and fa.currency=v_currency and fa.account_type='OTHER'
      ) then
        v_reject_reason := 'FINANCE_POS_CONTRACT_LEDGER_ACCOUNT_INVALID';
        exit pos_body;
      end if;

      if exists (
        select 1
        from public.finance_pos_contracts_v1 c
        where c.tenant_id=v_tenant and c.company_id=v_company and c.branch_id=v_branch and
              c.accounting_period_id=v_period and c.pos_account_id=v_pos_id and
              c.is_active=true and c.archived_at is null and c.id<>v_contract_id and
              daterange(c.valid_from,coalesce(c.valid_until,'infinity'::date),'[]') &&
              daterange(
                (p_operation#>>'{contract,validFrom}')::date,
                coalesce(nullif(p_operation#>>'{contract,validUntil}','')::date,'infinity'::date),
                '[]'
              )
      ) then
        v_reject_reason := 'FINANCE_POS_CONTRACT_DATE_OVERLAP';
        exit pos_body;
      end if;

      insert into public.finance_pos_contracts_v1 (
        id,tenant_id,company_id,branch_id,accounting_period_id,
        contract_number,contract_name,pos_account_id,bank_account_id,clearing_ledger_account_id,
        customer_receivable_account_id,commission_expense_account_id,tax_expense_account_id,
        monthly_fee_expense_account_id,working_mode,monthly_fixed_fee_enabled,
        monthly_fixed_fee_amount,monthly_fee_tax_rate,currency,valid_from,valid_until,
        is_active,created_by,updated_by,created_at,updated_at,archived_at
      ) values (
        v_contract_id,v_tenant,v_company,v_branch,v_period,
        trim(p_operation#>>'{contract,contractNumber}'),trim(p_operation#>>'{contract,contractName}'),
        v_pos_id,v_bank_id,v_clearing_id,v_customer_receivable_id,v_commission_expense_id,
        v_tax_expense_id,v_monthly_expense_id,p_operation#>>'{contract,workingMode}',
        coalesce((p_operation#>>'{contract,monthlyFixedFeeEnabled}')::boolean,false),
        coalesce((p_operation#>>'{contract,monthlyFixedFeeAmount}')::numeric,0),
        coalesce((p_operation#>>'{contract,monthlyFeeTaxRate}')::numeric,0),
        v_currency,(p_operation#>>'{contract,validFrom}')::date,
        nullif(p_operation#>>'{contract,validUntil}','')::date,
        true,p_actor_user_id,p_actor_user_id,v_occurred_at,v_occurred_at,null
      )
      on conflict (id) do update set
        contract_number=excluded.contract_number,
        contract_name=excluded.contract_name,
        pos_account_id=excluded.pos_account_id,
        bank_account_id=excluded.bank_account_id,
        clearing_ledger_account_id=excluded.clearing_ledger_account_id,
        customer_receivable_account_id=excluded.customer_receivable_account_id,
        commission_expense_account_id=excluded.commission_expense_account_id,
        tax_expense_account_id=excluded.tax_expense_account_id,
        monthly_fee_expense_account_id=excluded.monthly_fee_expense_account_id,
        working_mode=excluded.working_mode,
        monthly_fixed_fee_enabled=excluded.monthly_fixed_fee_enabled,
        monthly_fixed_fee_amount=excluded.monthly_fixed_fee_amount,
        monthly_fee_tax_rate=excluded.monthly_fee_tax_rate,
        currency=excluded.currency,
        valid_from=excluded.valid_from,
        valid_until=excluded.valid_until,
        is_active=true,
        archived_at=null,
        updated_by=p_actor_user_id,
        updated_at=v_occurred_at
      where finance_pos_contracts_v1.tenant_id=v_tenant and
            finance_pos_contracts_v1.company_id=v_company and
            finance_pos_contracts_v1.branch_id=v_branch and
            finance_pos_contracts_v1.accounting_period_id=v_period;

      if not found then
        v_reject_reason := 'FINANCE_POS_CONTRACT_SCOPE_CONFLICT';
        exit pos_body;
      end if;

    elsif v_action='UPSERT_RULE' then
      begin
        v_rule_id := nullif(p_operation#>>'{rule,ruleId}','')::uuid;
        v_contract_id := nullif(p_operation#>>'{rule,contractId}','')::uuid;
        v_pos_id := nullif(p_operation#>>'{rule,posAccountId}','')::uuid;
      exception when others then
        v_reject_reason := 'FINANCE_POS_RULE_UUID_INVALID';
        exit pos_body;
      end;

      select * into v_contract
      from public.finance_pos_contracts_v1 c
      where c.id=v_contract_id and c.tenant_id=v_tenant and c.company_id=v_company and
            c.branch_id=v_branch and c.accounting_period_id=v_period and
            c.is_active=true and c.archived_at is null
      for update;

      if not found or v_contract.pos_account_id<>v_pos_id then
        v_reject_reason := 'FINANCE_POS_RULE_CONTRACT_SCOPE_INVALID';
        exit pos_body;
      end if;

      insert into public.finance_pos_contract_rules_v1 (
        id,tenant_id,company_id,branch_id,accounting_period_id,
        contract_id,pos_account_id,installment_count,working_mode,
        commission_rate,fixed_transaction_fee,tax_rate,additional_fee_rate,
        first_settlement_day_count,installment_interval_day_count,
        is_active,created_by,updated_by,created_at,updated_at,archived_at
      ) values (
        v_rule_id,v_tenant,v_company,v_branch,v_period,v_contract_id,v_pos_id,
        (p_operation#>>'{rule,installmentCount}')::integer,
        p_operation#>>'{rule,workingMode}',
        (p_operation#>>'{rule,commissionRate}')::numeric,
        (p_operation#>>'{rule,fixedTransactionFee}')::numeric,
        (p_operation#>>'{rule,taxRate}')::numeric,
        (p_operation#>>'{rule,additionalFeeRate}')::numeric,
        (p_operation#>>'{rule,firstSettlementDayCount}')::integer,
        (p_operation#>>'{rule,installmentIntervalDayCount}')::integer,
        true,p_actor_user_id,p_actor_user_id,v_occurred_at,v_occurred_at,null
      )
      on conflict (id) do update set
        contract_id=excluded.contract_id,
        pos_account_id=excluded.pos_account_id,
        installment_count=excluded.installment_count,
        working_mode=excluded.working_mode,
        commission_rate=excluded.commission_rate,
        fixed_transaction_fee=excluded.fixed_transaction_fee,
        tax_rate=excluded.tax_rate,
        additional_fee_rate=excluded.additional_fee_rate,
        first_settlement_day_count=excluded.first_settlement_day_count,
        installment_interval_day_count=excluded.installment_interval_day_count,
        is_active=true,
        archived_at=null,
        updated_by=p_actor_user_id,
        updated_at=v_occurred_at
      where finance_pos_contract_rules_v1.tenant_id=v_tenant and
            finance_pos_contract_rules_v1.company_id=v_company and
            finance_pos_contract_rules_v1.branch_id=v_branch and
            finance_pos_contract_rules_v1.accounting_period_id=v_period;

      if not found then
        v_reject_reason := 'FINANCE_POS_RULE_SCOPE_CONFLICT';
        exit pos_body;
      end if;

    elsif v_action='ARCHIVE_CONTRACT' then
      begin
        v_contract_id := nullif(p_operation#>>'{archive,id}','')::uuid;
      exception when others then
        v_reject_reason := 'FINANCE_POS_ARCHIVE_CONTRACT_UUID_INVALID';
        exit pos_body;
      end;

      select * into v_contract
      from public.finance_pos_contracts_v1 c
      where c.id=v_contract_id and c.tenant_id=v_tenant and c.company_id=v_company and
            c.branch_id=v_branch and c.accounting_period_id=v_period
      for update;

      if not found then
        v_reject_reason := 'FINANCE_POS_ARCHIVE_CONTRACT_NOT_FOUND';
        exit pos_body;
      end if;

      update public.finance_pos_contracts_v1
      set is_active=false,
          archived_at=coalesce(archived_at,v_occurred_at),
          updated_by=p_actor_user_id,
          updated_at=v_occurred_at
      where id=v_contract_id and tenant_id=v_tenant and company_id=v_company and
            branch_id=v_branch and accounting_period_id=v_period;

      update public.finance_pos_contract_rules_v1
      set is_active=false,
          archived_at=coalesce(archived_at,v_occurred_at),
          updated_by=p_actor_user_id,
          updated_at=v_occurred_at
      where contract_id=v_contract_id and tenant_id=v_tenant and company_id=v_company and
            branch_id=v_branch and accounting_period_id=v_period and is_active=true;

    elsif v_action='ARCHIVE_RULE' then
      begin
        v_rule_id := nullif(p_operation#>>'{archive,id}','')::uuid;
      exception when others then
        v_reject_reason := 'FINANCE_POS_ARCHIVE_RULE_UUID_INVALID';
        exit pos_body;
      end;

      select * into v_rule
      from public.finance_pos_contract_rules_v1 r
      where r.id=v_rule_id and r.tenant_id=v_tenant and r.company_id=v_company and
            r.branch_id=v_branch and r.accounting_period_id=v_period
      for update;

      if not found then
        v_reject_reason := 'FINANCE_POS_ARCHIVE_RULE_NOT_FOUND';
        exit pos_body;
      end if;

      update public.finance_pos_contract_rules_v1
      set is_active=false,
          archived_at=coalesce(archived_at,v_occurred_at),
          updated_by=p_actor_user_id,
          updated_at=v_occurred_at
      where id=v_rule_id and tenant_id=v_tenant and company_id=v_company and
            branch_id=v_branch and accounting_period_id=v_period;

    elsif v_action='POST_COLLECTION' then
      begin
        v_transaction_id := nullif(p_operation#>>'{collection,transactionId}','')::uuid;
        v_contract_id := nullif(p_operation#>>'{collection,contractId}','')::uuid;
        v_rule_id := nullif(p_operation#>>'{collection,ruleId}','')::uuid;
        v_pos_id := nullif(p_operation#>>'{collection,posAccountId}','')::uuid;
      exception when others then
        v_reject_reason := 'FINANCE_POS_COLLECTION_UUID_INVALID';
        exit pos_body;
      end;

      select * into v_contract
      from public.finance_pos_contracts_v1 c
      where c.id=v_contract_id and c.tenant_id=v_tenant and c.company_id=v_company and
            c.branch_id=v_branch and c.accounting_period_id=v_period and
            c.pos_account_id=v_pos_id and c.is_active=true and c.archived_at is null
      for update;

      if not found then
        v_reject_reason := 'FINANCE_POS_COLLECTION_CONTRACT_NOT_FOUND';
        exit pos_body;
      end if;

      select * into v_rule
      from public.finance_pos_contract_rules_v1 r
      where r.id=v_rule_id and r.tenant_id=v_tenant and r.company_id=v_company and
            r.branch_id=v_branch and r.accounting_period_id=v_period and
            r.contract_id=v_contract_id and r.pos_account_id=v_pos_id and
            r.is_active=true and r.archived_at is null
      for update;

      if not found then
        v_reject_reason := 'FINANCE_POS_COLLECTION_RULE_NOT_FOUND';
        exit pos_body;
      end if;

      v_gross := (p_operation#>>'{collection,grossAmount}')::numeric;
      v_currency := upper(p_operation#>>'{collection,currency}');

      if v_gross<=0 or v_currency<>v_contract.currency or
         (p_operation#>>'{collection,installmentCount}')::integer<>v_rule.installment_count or
         (p_operation#>>'{collection,transactionDate}')::date < v_contract.valid_from or
         (v_contract.valid_until is not null and
          (p_operation#>>'{collection,transactionDate}')::date > v_contract.valid_until) then
        v_reject_reason := 'FINANCE_POS_COLLECTION_CONTRACT_RULE_MISMATCH';
        exit pos_body;
      end if;

      if not exists (
        select 1
        from public.finance_transactions ft
        where ft.tenant_id=v_tenant and ft.company_id=v_company and
              ft.branch_id=v_branch and ft.accounting_period_id=v_period and
              ft.transaction_type='SALE_CHARGE' and ft.status='POSTED' and
              ft.sale_id=p_operation#>>'{collection,saleId}' and
              ft.customer_id=p_operation#>>'{collection,customerId}' and
              ft.reversed_at is null
      ) then
        v_reject_reason := 'FINANCE_POS_COLLECTION_CANONICAL_SALE_SOURCE_REQUIRED';
        exit pos_body;
      end if;

      v_commission := round(v_gross*v_rule.commission_rate/100,2);
      v_fixed := round(v_rule.fixed_transaction_fee,2);
      v_tax := round((v_commission+v_fixed)*v_rule.tax_rate/100,2);
      v_additional := round(v_gross*v_rule.additional_fee_rate/100,2);
      v_deduction := round(v_commission+v_fixed+v_tax+v_additional,2);
      v_net := round(v_gross-v_deduction,2);

      if v_net<0 then
        v_reject_reason := 'FINANCE_POS_COLLECTION_DEDUCTION_EXCEEDS_GROSS';
        exit pos_body;
      end if;

      v_schedule_id := gen_random_uuid();

      insert into public.finance_transactions (
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        transaction_type,direction,payment_method,finance_account_id,counter_account_id,
        customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
        gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
        created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
      ) values (
        v_transaction_id::text,v_transaction_id::text,v_idem,v_tenant,v_company,v_branch,v_period,
        'COLLECTION','DEBIT','CREDIT_CARD',v_contract.clearing_ledger_account_id::text,
        v_contract.customer_receivable_account_id::text,
        p_operation#>>'{collection,customerId}',p_operation#>>'{collection,saleId}',null,
        p_operation#>>'{collection,paymentId}','SALE_PAYMENT',
        v_gross,0,v_gross,v_currency,(p_operation#>>'{collection,transactionDate}')::date,
        'POSTED',nullif(p_operation#>>'{collection,description}',''),
        p_actor_user_id,v_occurred_at,v_occurred_at,'SALE_PAYMENT',v_operation_id,'POS_COLLECTION'
      );

      insert into public.finance_transaction_audits (
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
      ) values (
        'audit:'||v_transaction_id::text,v_transaction_id::text,v_idem,
        v_tenant,v_company,v_branch,v_period,'POSTED',p_actor_user_id,
        p_operation#>>'{collection,customerId}',p_operation#>>'{collection,saleId}',null,
        v_occurred_at,p_payload_hash
      );

      insert into public.finance_pos_transactions_v1 (
        id,tenant_id,company_id,branch_id,accounting_period_id,pos_transaction_number,
        pos_account_id,bank_account_id,contract_id,rule_id,sale_id,sale_number,payment_id,customer_id,
        installment_count,working_mode,gross_amount,commission_amount,fixed_transaction_fee,tax_amount,
        additional_fee_amount,total_deduction_amount,net_amount,settled_amount,pending_amount,currency,
        transaction_date,expected_first_settlement_date,expected_final_settlement_date,
        actual_settlement_date,status,description,rule_snapshot,collection_finance_transaction_id,
        created_by,created_at,reversed_at,reversal_finance_transaction_id
      ) values (
        v_transaction_id,v_tenant,v_company,v_branch,v_period,
        trim(p_operation#>>'{collection,posTransactionNumber}'),v_pos_id,v_contract.bank_account_id,
        v_contract_id,v_rule_id,p_operation#>>'{collection,saleId}',
        p_operation#>>'{collection,saleNumber}',p_operation#>>'{collection,paymentId}',
        p_operation#>>'{collection,customerId}',v_rule.installment_count,v_rule.working_mode,
        v_gross,v_commission,v_fixed,v_tax,v_additional,v_deduction,v_net,0,v_net,v_currency,
        (p_operation#>>'{collection,transactionDate}')::date,
        (p_operation#>>'{collection,transactionDate}')::date + v_rule.first_settlement_day_count,
        (p_operation#>>'{collection,transactionDate}')::date +
          v_rule.first_settlement_day_count +
          case when v_rule.working_mode='MONTHLY_BLOCKED'
               then v_rule.installment_interval_day_count*(v_rule.installment_count-1)
               else 0 end,
        null,'PENDING_SETTLEMENT',nullif(p_operation#>>'{collection,description}',''),
        jsonb_build_object(
          'ruleId',v_rule.id,'posContractId',v_rule.contract_id,'workingMode',v_rule.working_mode,
          'installmentCount',v_rule.installment_count,'commissionRate',v_rule.commission_rate,
          'fixedTransactionFee',v_rule.fixed_transaction_fee,'taxRate',v_rule.tax_rate,
          'additionalFeeRate',v_rule.additional_fee_rate,
          'firstSettlementDayCount',v_rule.first_settlement_day_count,
          'installmentIntervalDayCount',v_rule.installment_interval_day_count
        ),
        v_transaction_id::text,p_actor_user_id,v_occurred_at,null,null
      );

      insert into public.finance_pos_settlement_schedules_v1 (
        id,tenant_id,company_id,branch_id,accounting_period_id,transaction_id,contract_id,rule_id,
        pos_account_id,bank_account_id,working_mode,installment_count,gross_amount,
        total_deduction_amount,net_amount,settled_amount,pending_amount,currency,created_by,created_at,reversed_at
      ) values (
        v_schedule_id,v_tenant,v_company,v_branch,v_period,v_transaction_id,v_contract_id,v_rule_id,
        v_pos_id,v_contract.bank_account_id,v_rule.working_mode,v_rule.installment_count,
        v_gross,v_deduction,v_net,0,v_net,v_currency,p_actor_user_id,v_occurred_at,null
      );

      v_part_count := case when v_rule.working_mode='MONTHLY_BLOCKED' then v_rule.installment_count else 1 end;

      for v_i in 1..v_part_count loop
        if v_i=v_part_count then
          v_part_gross := round(v_gross-v_sum_gross,2);
          v_part_commission := round(v_commission-v_sum_commission,2);
          v_part_fixed := round(v_fixed-v_sum_fixed,2);
          v_part_tax := round(v_tax-v_sum_tax,2);
          v_part_additional := round(v_additional-v_sum_additional,2);
          v_part_net := round(v_net-v_sum_net,2);
        else
          v_part_gross := trunc((v_gross/v_part_count)*100)/100;
          v_part_commission := trunc((v_commission/v_part_count)*100)/100;
          v_part_fixed := trunc((v_fixed/v_part_count)*100)/100;
          v_part_tax := trunc((v_tax/v_part_count)*100)/100;
          v_part_additional := trunc((v_additional/v_part_count)*100)/100;
          v_part_net := trunc((v_net/v_part_count)*100)/100;
        end if;

        v_expected_date := (p_operation#>>'{collection,transactionDate}')::date +
          v_rule.first_settlement_day_count +
          case when v_rule.working_mode='MONTHLY_BLOCKED'
               then v_rule.installment_interval_day_count*(v_i-1)
               else 0 end;

        insert into public.finance_pos_settlement_lines_v1 (
          id,tenant_id,company_id,branch_id,accounting_period_id,schedule_id,transaction_id,
          sequence,expected_settlement_date,actual_settlement_date,gross_amount,commission_amount,
          fixed_transaction_fee,tax_amount,additional_fee_amount,net_amount,settled_amount,
          pending_amount,status,reversed_at
        ) values (
          gen_random_uuid(),v_tenant,v_company,v_branch,v_period,v_schedule_id,v_transaction_id,
          v_i,v_expected_date,null,v_part_gross,v_part_commission,v_part_fixed,v_part_tax,
          v_part_additional,v_part_net,0,v_part_net,'PENDING',null
        );

        v_sum_gross := round(v_sum_gross+v_part_gross,2);
        v_sum_commission := round(v_sum_commission+v_part_commission,2);
        v_sum_fixed := round(v_sum_fixed+v_part_fixed,2);
        v_sum_tax := round(v_sum_tax+v_part_tax,2);
        v_sum_additional := round(v_sum_additional+v_part_additional,2);
        v_sum_net := round(v_sum_net+v_part_net,2);
      end loop;

      v_tx_ids := array_append(v_tx_ids,v_transaction_id::text);

    elsif v_action='SETTLE_TRANSACTION' then
      begin
        v_transaction_id := nullif(p_operation#>>'{settlement,transactionId}','')::uuid;
        v_line_id := nullif(p_operation#>>'{settlement,scheduleLineId}','')::uuid;
        v_settlement_id := nullif(p_operation#>>'{settlement,settlementId}','')::uuid;
      exception when others then
        v_reject_reason := 'FINANCE_POS_SETTLEMENT_UUID_INVALID';
        exit pos_body;
      end;

      select * into v_pos_tx
      from public.finance_pos_transactions_v1 t
      where t.id=v_transaction_id and t.tenant_id=v_tenant and t.company_id=v_company and
            t.branch_id=v_branch and t.accounting_period_id=v_period
      for update;

      if not found or v_pos_tx.status not in ('PENDING_SETTLEMENT','PARTIALLY_SETTLED') then
        v_reject_reason := 'FINANCE_POS_TRANSACTION_NOT_SETTLEABLE';
        exit pos_body;
      end if;

      select * into v_line
      from public.finance_pos_settlement_lines_v1 l
      where l.id=v_line_id and l.transaction_id=v_transaction_id and
            l.tenant_id=v_tenant and l.company_id=v_company and l.branch_id=v_branch and
            l.accounting_period_id=v_period
      for update;

      if not found or v_line.status not in ('PENDING','PARTIALLY_SETTLED') then
        v_reject_reason := 'FINANCE_POS_SETTLEMENT_LINE_NOT_SETTLEABLE';
        exit pos_body;
      end if;

      v_amount := (p_operation#>>'{settlement,amount}')::numeric;
      if v_amount<=0 or v_amount>v_line.pending_amount or v_line.net_amount<=0 then
        v_reject_reason := 'FINANCE_POS_SETTLEMENT_AMOUNT_INVALID';
        exit pos_body;
      end if;

      select * into v_contract
      from public.finance_pos_contracts_v1 c
      where c.id=v_pos_tx.contract_id and c.tenant_id=v_tenant and c.company_id=v_company and
            c.branch_id=v_branch and c.accounting_period_id=v_period
      for update;

      if not found then
        v_reject_reason := 'FINANCE_POS_SETTLEMENT_CONTRACT_NOT_FOUND';
        exit pos_body;
      end if;

      if not exists (
        select 1 from public.finance_accounts fa
        where fa.id=v_contract.clearing_ledger_account_id and fa.tenant_id=v_tenant and
              fa.company_id=v_company and fa.branch_id=v_branch and fa.accounting_period_id=v_period and
              fa.is_active=true and fa.archived_at is null and fa.currency=v_pos_tx.currency
      ) or not exists (
        select 1 from public.finance_accounts fa
        where fa.id=v_contract.commission_expense_account_id and fa.tenant_id=v_tenant and
              fa.company_id=v_company and fa.branch_id=v_branch and fa.accounting_period_id=v_period and
              fa.is_active=true and fa.archived_at is null and fa.currency=v_pos_tx.currency
      ) or not exists (
        select 1 from public.finance_accounts fa
        where fa.id=v_contract.tax_expense_account_id and fa.tenant_id=v_tenant and
              fa.company_id=v_company and fa.branch_id=v_branch and fa.accounting_period_id=v_period and
              fa.is_active=true and fa.archived_at is null and fa.currency=v_pos_tx.currency
      ) then
        v_reject_reason := 'FINANCE_POS_SETTLEMENT_LEDGER_INVALID';
        exit pos_body;
      end if;

      select ba.ledger_account_id,ba.currency into v_bank_id,v_account_currency
      from public.bank_accounts ba
      where ba.id=v_pos_tx.bank_account_id and ba.tenant_id=v_tenant and ba.company_id=v_company and
            ba.branch_id=v_branch and ba.accounting_period_id=v_period and
            ba.is_active=true and ba.archived_at is null
      for update;

      if not found or v_account_currency<>v_pos_tx.currency then
        v_reject_reason := 'FINANCE_POS_SETTLEMENT_BANK_INVALID';
        exit pos_body;
      end if;

      select
        coalesce(sum(s.commission_amount),0),
        coalesce(sum(s.fixed_transaction_fee),0),
        coalesce(sum(s.tax_amount),0),
        coalesce(sum(s.additional_fee_amount),0)
      into v_prior_commission,v_prior_fixed,v_prior_tax,v_prior_additional
      from public.finance_pos_settlements_v1 s
      where s.tenant_id=v_tenant and s.company_id=v_company and s.branch_id=v_branch and
            s.accounting_period_id=v_period and s.schedule_line_id=v_line_id and s.reversed_at is null;

      if v_amount=v_line.pending_amount then
        v_commission := round(v_line.commission_amount-v_prior_commission,2);
        v_fixed := round(v_line.fixed_transaction_fee-v_prior_fixed,2);
        v_tax := round(v_line.tax_amount-v_prior_tax,2);
        v_additional := round(v_line.additional_fee_amount-v_prior_additional,2);
      else
        v_ratio := v_amount/v_line.net_amount;
        v_commission := round(v_line.commission_amount*v_ratio,2);
        v_fixed := round(v_line.fixed_transaction_fee*v_ratio,2);
        v_tax := round(v_line.tax_amount*v_ratio,2);
        v_additional := round(v_line.additional_fee_amount*v_ratio,2);
      end if;

      v_clearing := round(v_amount+v_commission+v_fixed+v_tax+v_additional,2);

      v_finance_id := v_operation_id||':BANK';
      insert into public.finance_transactions (
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        transaction_type,direction,payment_method,finance_account_id,counter_account_id,
        customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
        gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
        created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
      ) values (
        v_finance_id,v_finance_id,v_idem||':BANK',v_tenant,v_company,v_branch,v_period,
        'TRANSFER','DEBIT','BANK_TRANSFER',v_bank_id::text,v_contract.clearing_ledger_account_id::text,
        v_pos_tx.customer_id,v_pos_tx.sale_id,null,v_settlement_id::text,'POS_SETTLEMENT',
        v_amount,0,v_amount,v_pos_tx.currency,(p_operation#>>'{settlement,settlementDate}')::date,
        'POSTED',nullif(p_operation#>>'{settlement,description}',''),
        p_actor_user_id,v_occurred_at,v_occurred_at,'PAYMENT',v_operation_id,'POS_SETTLEMENT_BANK'
      );
      insert into public.finance_transaction_audits (
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
      ) values (
        'audit:'||v_finance_id,v_finance_id,v_idem||':BANK',v_tenant,v_company,v_branch,v_period,
        'POSTED',p_actor_user_id,v_pos_tx.customer_id,v_pos_tx.sale_id,null,v_occurred_at,p_payload_hash
      );
      v_tx_ids := array_append(v_tx_ids,v_finance_id);

      v_component := round(v_commission+v_fixed,2);
      if v_component>0 then
        v_finance_id := v_operation_id||':COMMISSION';
        insert into public.finance_transactions (
          id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
          transaction_type,direction,payment_method,finance_account_id,counter_account_id,
          customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
          gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
          created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
        ) values (
          v_finance_id,v_finance_id,v_idem||':COMMISSION',v_tenant,v_company,v_branch,v_period,
          'PAYMENT','DEBIT','CREDIT_CARD',v_contract.commission_expense_account_id::text,
          v_contract.clearing_ledger_account_id::text,v_pos_tx.customer_id,v_pos_tx.sale_id,null,
          v_settlement_id::text,'POS_SETTLEMENT',v_component,v_component,v_component,
          v_pos_tx.currency,(p_operation#>>'{settlement,settlementDate}')::date,'POSTED',
          'POS komisyon ve sabit işlem gideri',p_actor_user_id,v_occurred_at,v_occurred_at,
          'PAYMENT',v_operation_id,'POS_SETTLEMENT_COMMISSION'
        );
        insert into public.finance_transaction_audits (
          id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
          action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
        ) values (
          'audit:'||v_finance_id,v_finance_id,v_idem||':COMMISSION',
          v_tenant,v_company,v_branch,v_period,'POSTED',p_actor_user_id,
          v_pos_tx.customer_id,v_pos_tx.sale_id,null,v_occurred_at,p_payload_hash
        );
        v_tx_ids := array_append(v_tx_ids,v_finance_id);
      end if;

      if v_tax>0 then
        v_finance_id := v_operation_id||':TAX';
        insert into public.finance_transactions (
          id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
          transaction_type,direction,payment_method,finance_account_id,counter_account_id,
          customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
          gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
          created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
        ) values (
          v_finance_id,v_finance_id,v_idem||':TAX',v_tenant,v_company,v_branch,v_period,
          'PAYMENT','DEBIT','CREDIT_CARD',v_contract.tax_expense_account_id::text,
          v_contract.clearing_ledger_account_id::text,v_pos_tx.customer_id,v_pos_tx.sale_id,null,
          v_settlement_id::text,'POS_SETTLEMENT',v_tax,0,v_tax,v_pos_tx.currency,
          (p_operation#>>'{settlement,settlementDate}')::date,'POSTED','POS komisyon vergisi',
          p_actor_user_id,v_occurred_at,v_occurred_at,'PAYMENT',v_operation_id,'POS_SETTLEMENT_TAX'
        );
        insert into public.finance_transaction_audits (
          id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
          action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
        ) values (
          'audit:'||v_finance_id,v_finance_id,v_idem||':TAX',
          v_tenant,v_company,v_branch,v_period,'POSTED',p_actor_user_id,
          v_pos_tx.customer_id,v_pos_tx.sale_id,null,v_occurred_at,p_payload_hash
        );
        v_tx_ids := array_append(v_tx_ids,v_finance_id);
      end if;

      if v_additional>0 then
        v_finance_id := v_operation_id||':ADDITIONAL';
        insert into public.finance_transactions (
          id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
          transaction_type,direction,payment_method,finance_account_id,counter_account_id,
          customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
          gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
          created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
        ) values (
          v_finance_id,v_finance_id,v_idem||':ADDITIONAL',v_tenant,v_company,v_branch,v_period,
          'PAYMENT','DEBIT','CREDIT_CARD',v_contract.commission_expense_account_id::text,
          v_contract.clearing_ledger_account_id::text,v_pos_tx.customer_id,v_pos_tx.sale_id,null,
          v_settlement_id::text,'POS_SETTLEMENT',v_additional,0,v_additional,v_pos_tx.currency,
          (p_operation#>>'{settlement,settlementDate}')::date,'POSTED','POS ek kesinti gideri',
          p_actor_user_id,v_occurred_at,v_occurred_at,'PAYMENT',v_operation_id,'POS_SETTLEMENT_ADDITIONAL'
        );
        insert into public.finance_transaction_audits (
          id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
          action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
        ) values (
          'audit:'||v_finance_id,v_finance_id,v_idem||':ADDITIONAL',
          v_tenant,v_company,v_branch,v_period,'POSTED',p_actor_user_id,
          v_pos_tx.customer_id,v_pos_tx.sale_id,null,v_occurred_at,p_payload_hash
        );
        v_tx_ids := array_append(v_tx_ids,v_finance_id);
      end if;

      insert into public.finance_pos_settlements_v1 (
        id,tenant_id,company_id,branch_id,accounting_period_id,settlement_number,
        transaction_id,schedule_line_id,net_amount,commission_amount,fixed_transaction_fee,
        tax_amount,additional_fee_amount,clearing_amount,settlement_date,
        bank_finance_transaction_id,commission_finance_transaction_id,
        tax_finance_transaction_id,additional_fee_finance_transaction_id,
        created_by,created_at,reversed_at
      ) values (
        v_settlement_id,v_tenant,v_company,v_branch,v_period,
        trim(p_operation#>>'{settlement,settlementNumber}'),v_transaction_id,v_line_id,
        v_amount,v_commission,v_fixed,v_tax,v_additional,v_clearing,
        (p_operation#>>'{settlement,settlementDate}')::date,
        v_operation_id||':BANK',
        case when round(v_commission+v_fixed,2)>0 then v_operation_id||':COMMISSION' else null end,
        case when v_tax>0 then v_operation_id||':TAX' else null end,
        case when v_additional>0 then v_operation_id||':ADDITIONAL' else null end,
        p_actor_user_id,v_occurred_at,null
      );

      update public.finance_pos_settlement_lines_v1
      set settled_amount=round(settled_amount+v_amount,2),
          pending_amount=round(pending_amount-v_amount,2),
          actual_settlement_date=case when round(pending_amount-v_amount,2)=0
                                      then (p_operation#>>'{settlement,settlementDate}')::date
                                      else actual_settlement_date end,
          status=case when round(pending_amount-v_amount,2)=0 then 'SETTLED' else 'PARTIALLY_SETTLED' end
      where id=v_line_id and tenant_id=v_tenant and company_id=v_company and
            branch_id=v_branch and accounting_period_id=v_period;

      update public.finance_pos_settlement_schedules_v1
      set settled_amount=round(settled_amount+v_amount,2),
          pending_amount=round(pending_amount-v_amount,2)
      where transaction_id=v_transaction_id and tenant_id=v_tenant and company_id=v_company and
            branch_id=v_branch and accounting_period_id=v_period;

      update public.finance_pos_transactions_v1
      set settled_amount=round(settled_amount+v_amount,2),
          pending_amount=round(pending_amount-v_amount,2),
          actual_settlement_date=case when round(pending_amount-v_amount,2)=0
                                      then (p_operation#>>'{settlement,settlementDate}')::date
                                      else actual_settlement_date end,
          status=case when round(pending_amount-v_amount,2)=0 then 'SETTLED' else 'PARTIALLY_SETTLED' end
      where id=v_transaction_id and tenant_id=v_tenant and company_id=v_company and
            branch_id=v_branch and accounting_period_id=v_period;

    elsif v_action='POST_MONTHLY_FEE' then
      begin
        v_monthly_fee_id := nullif(p_operation#>>'{monthlyFee,monthlyFeeId}','')::uuid;
        v_contract_id := nullif(p_operation#>>'{monthlyFee,contractId}','')::uuid;
      exception when others then
        v_reject_reason := 'FINANCE_POS_MONTHLY_FEE_UUID_INVALID';
        exit pos_body;
      end;

      select * into v_contract
      from public.finance_pos_contracts_v1 c
      where c.id=v_contract_id and c.tenant_id=v_tenant and c.company_id=v_company and
            c.branch_id=v_branch and c.accounting_period_id=v_period and
            c.is_active=true and c.archived_at is null
      for update;

      if not found or not v_contract.monthly_fixed_fee_enabled or v_contract.monthly_fixed_fee_amount<=0 then
        v_reject_reason := 'FINANCE_POS_MONTHLY_FEE_CONTRACT_INVALID';
        exit pos_body;
      end if;

      if not exists (
        select 1 from public.finance_accounts fa
        where fa.id=v_contract.monthly_fee_expense_account_id and fa.tenant_id=v_tenant and
              fa.company_id=v_company and fa.branch_id=v_branch and fa.accounting_period_id=v_period and
              fa.is_active=true and fa.archived_at is null and fa.currency=v_contract.currency
      ) or not exists (
        select 1 from public.finance_accounts fa
        where fa.id=v_contract.tax_expense_account_id and fa.tenant_id=v_tenant and
              fa.company_id=v_company and fa.branch_id=v_branch and fa.accounting_period_id=v_period and
              fa.is_active=true and fa.archived_at is null and fa.currency=v_contract.currency
      ) then
        v_reject_reason := 'FINANCE_POS_MONTHLY_FEE_LEDGER_INVALID';
        exit pos_body;
      end if;

      select ba.ledger_account_id,ba.currency into v_bank_id,v_account_currency
      from public.bank_accounts ba
      where ba.id=v_contract.bank_account_id and ba.tenant_id=v_tenant and ba.company_id=v_company and
            ba.branch_id=v_branch and ba.accounting_period_id=v_period and
            ba.is_active=true and ba.archived_at is null
      for update;

      if not found or v_account_currency<>v_contract.currency then
        v_reject_reason := 'FINANCE_POS_MONTHLY_FEE_BANK_INVALID';
        exit pos_body;
      end if;

      v_gross := round(v_contract.monthly_fixed_fee_amount,2);
      v_tax := round(v_gross*v_contract.monthly_fee_tax_rate/100,2);
      v_net := round(v_gross+v_tax,2);

      v_finance_id := v_operation_id||':FEE';
      insert into public.finance_transactions (
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        transaction_type,direction,payment_method,finance_account_id,counter_account_id,
        customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
        gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
        created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
      ) values (
        v_finance_id,v_finance_id,v_idem||':FEE',v_tenant,v_company,v_branch,v_period,
        'PAYMENT','CREDIT','BANK_TRANSFER',v_bank_id::text,v_contract.monthly_fee_expense_account_id::text,
        null,null,null,v_monthly_fee_id::text,'EXPENSE',v_gross,0,v_gross,v_contract.currency,
        (p_operation#>>'{monthlyFee,paymentDate}')::date,'POSTED',
        coalesce(nullif(p_operation#>>'{monthlyFee,description}',''),'Aylık POS kullanım gideri'),
        p_actor_user_id,v_occurred_at,v_occurred_at,'PAYMENT',v_operation_id,'POS_MONTHLY_FEE'
      );
      insert into public.finance_transaction_audits (
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
      ) values (
        'audit:'||v_finance_id,v_finance_id,v_idem||':FEE',v_tenant,v_company,v_branch,v_period,
        'POSTED',p_actor_user_id,null,null,null,v_occurred_at,p_payload_hash
      );
      v_tx_ids := array_append(v_tx_ids,v_finance_id);

      if v_tax>0 then
        v_finance_id := v_operation_id||':TAX';
        insert into public.finance_transactions (
          id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
          transaction_type,direction,payment_method,finance_account_id,counter_account_id,
          customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
          gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
          created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
        ) values (
          v_finance_id,v_finance_id,v_idem||':TAX',v_tenant,v_company,v_branch,v_period,
          'PAYMENT','CREDIT','BANK_TRANSFER',v_bank_id::text,v_contract.tax_expense_account_id::text,
          null,null,null,v_monthly_fee_id::text,'EXPENSE',v_tax,0,v_tax,v_contract.currency,
          (p_operation#>>'{monthlyFee,paymentDate}')::date,'POSTED','Aylık POS gideri vergisi',
          p_actor_user_id,v_occurred_at,v_occurred_at,'PAYMENT',v_operation_id,'POS_MONTHLY_FEE_TAX'
        );
        insert into public.finance_transaction_audits (
          id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
          action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
        ) values (
          'audit:'||v_finance_id,v_finance_id,v_idem||':TAX',v_tenant,v_company,v_branch,v_period,
          'POSTED',p_actor_user_id,null,null,null,v_occurred_at,p_payload_hash
        );
        v_tx_ids := array_append(v_tx_ids,v_finance_id);
      end if;

      insert into public.finance_pos_monthly_fees_v1 (
        id,tenant_id,company_id,branch_id,accounting_period_id,fee_number,contract_id,year,month,
        gross_amount,tax_amount,net_amount,currency,payment_date,fee_finance_transaction_id,
        tax_finance_transaction_id,status,created_by,created_at,reversed_at
      ) values (
        v_monthly_fee_id,v_tenant,v_company,v_branch,v_period,
        trim(p_operation#>>'{monthlyFee,feeNumber}'),v_contract_id,
        (p_operation#>>'{monthlyFee,year}')::integer,(p_operation#>>'{monthlyFee,month}')::integer,
        v_gross,v_tax,v_net,v_contract.currency,(p_operation#>>'{monthlyFee,paymentDate}')::date,
        v_operation_id||':FEE',case when v_tax>0 then v_operation_id||':TAX' else null end,
        'PAID',p_actor_user_id,v_occurred_at,null
      );

    elsif v_action='REFUND_TRANSACTION' then
      begin
        v_transaction_id := nullif(p_operation#>>'{refund,originalTransactionId}','')::uuid;
        v_refund_id := nullif(p_operation#>>'{refund,refundTransactionId}','')::uuid;
      exception when others then
        v_reject_reason := 'FINANCE_POS_REFUND_UUID_INVALID';
        exit pos_body;
      end;

      select * into v_pos_tx
      from public.finance_pos_transactions_v1 t
      where t.id=v_transaction_id and t.tenant_id=v_tenant and t.company_id=v_company and
            t.branch_id=v_branch and t.accounting_period_id=v_period
      for update;

      if not found or v_pos_tx.status<>'SETTLED' then
        v_reject_reason := 'FINANCE_POS_REFUND_REQUIRES_FULL_SETTLEMENT';
        exit pos_body;
      end if;

      v_amount := (p_operation#>>'{refund,refundAmount}')::numeric;
      if round(v_amount,2)<>round(v_pos_tx.gross_amount,2) then
        v_reject_reason := 'FINANCE_POS_PARTIAL_REFUND_NOT_SUPPORTED_V1';
        exit pos_body;
      end if;

      select * into v_contract
      from public.finance_pos_contracts_v1 c
      where c.id=v_pos_tx.contract_id and c.tenant_id=v_tenant and c.company_id=v_company and
            c.branch_id=v_branch and c.accounting_period_id=v_period
      for update;

      if not found or not exists (
        select 1 from public.finance_accounts fa
        where fa.id=v_contract.customer_receivable_account_id and fa.tenant_id=v_tenant and
              fa.company_id=v_company and fa.branch_id=v_branch and fa.accounting_period_id=v_period and
              fa.is_active=true and fa.archived_at is null and fa.currency=v_pos_tx.currency
      ) then
        v_reject_reason := 'FINANCE_POS_REFUND_LEDGER_INVALID';
        exit pos_body;
      end if;

      select ba.ledger_account_id,ba.currency into v_bank_id,v_account_currency
      from public.bank_accounts ba
      where ba.id=v_pos_tx.bank_account_id and ba.tenant_id=v_tenant and ba.company_id=v_company and
            ba.branch_id=v_branch and ba.accounting_period_id=v_period and
            ba.is_active=true and ba.archived_at is null
      for update;

      if not found or v_account_currency<>v_pos_tx.currency then
        v_reject_reason := 'FINANCE_POS_REFUND_BANK_INVALID';
        exit pos_body;
      end if;

      v_finance_id := v_refund_id::text;
      insert into public.finance_transactions (
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        transaction_type,direction,payment_method,finance_account_id,counter_account_id,
        customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
        gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
        created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
      ) values (
        v_finance_id,v_finance_id,v_idem,v_tenant,v_company,v_branch,v_period,
        'REFUND','CREDIT','CREDIT_CARD',v_bank_id::text,v_contract.customer_receivable_account_id::text,
        v_pos_tx.customer_id,v_pos_tx.sale_id,null,v_refund_id::text,'SALE_RETURN',
        v_amount,0,v_amount,v_pos_tx.currency,(p_operation#>>'{refund,refundDate}')::date,'POSTED',
        nullif(p_operation#>>'{refund,description}',''),p_actor_user_id,v_occurred_at,v_occurred_at,
        'SALE_RETURN',v_operation_id,'POS_REFUND'
      );
      insert into public.finance_transaction_audits (
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
      ) values (
        'audit:'||v_finance_id,v_finance_id,v_idem,v_tenant,v_company,v_branch,v_period,
        'POSTED',p_actor_user_id,v_pos_tx.customer_id,v_pos_tx.sale_id,null,v_occurred_at,p_payload_hash
      );
      v_tx_ids := array_append(v_tx_ids,v_finance_id);

      update public.finance_pos_transactions_v1
      set status='REFUNDED'
      where id=v_transaction_id and tenant_id=v_tenant and company_id=v_company and
            branch_id=v_branch and accounting_period_id=v_period;

    elsif v_action='REVERSE_TRANSACTION' then
      begin
        v_transaction_id := nullif(p_operation#>>'{reversal,transactionId}','')::uuid;
        v_reversal_id := nullif(p_operation#>>'{reversal,reversalTransactionId}','')::uuid;
      exception when others then
        v_reject_reason := 'FINANCE_POS_REVERSAL_UUID_INVALID';
        exit pos_body;
      end;

      select * into v_pos_tx
      from public.finance_pos_transactions_v1 t
      where t.id=v_transaction_id and t.tenant_id=v_tenant and t.company_id=v_company and
            t.branch_id=v_branch and t.accounting_period_id=v_period
      for update;

      if not found or v_pos_tx.status<>'PENDING_SETTLEMENT' or v_pos_tx.settled_amount<>0 then
        v_reject_reason := 'FINANCE_POS_REVERSAL_SETTLED_OR_INVALID_STATE';
        exit pos_body;
      end if;

      select * into v_contract
      from public.finance_pos_contracts_v1 c
      where c.id=v_pos_tx.contract_id and c.tenant_id=v_tenant and c.company_id=v_company and
            c.branch_id=v_branch and c.accounting_period_id=v_period
      for update;

      if not found or not exists (
        select 1 from public.finance_accounts fa
        where fa.id=v_contract.clearing_ledger_account_id and fa.tenant_id=v_tenant and
              fa.company_id=v_company and fa.branch_id=v_branch and fa.accounting_period_id=v_period and
              fa.is_active=true and fa.archived_at is null and fa.currency=v_pos_tx.currency
      ) or not exists (
        select 1 from public.finance_accounts fa
        where fa.id=v_contract.customer_receivable_account_id and fa.tenant_id=v_tenant and
              fa.company_id=v_company and fa.branch_id=v_branch and fa.accounting_period_id=v_period and
              fa.is_active=true and fa.archived_at is null and fa.currency=v_pos_tx.currency
      ) then
        v_reject_reason := 'FINANCE_POS_REVERSAL_LEDGER_INVALID';
        exit pos_body;
      end if;

      v_finance_id := v_reversal_id::text;
      insert into public.finance_transactions (
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        transaction_type,direction,payment_method,finance_account_id,counter_account_id,
        customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
        gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
        created_by,created_at,posted_at,projection_source,reversal_of_transaction_id,
        operation_group_id,operation_leg
      ) values (
        v_finance_id,v_finance_id,v_idem,v_tenant,v_company,v_branch,v_period,
        'REVERSAL','CREDIT','CREDIT_CARD',v_contract.clearing_ledger_account_id::text,
        v_contract.customer_receivable_account_id::text,v_pos_tx.customer_id,v_pos_tx.sale_id,null,
        v_transaction_id::text,'SALE_PAYMENT',v_pos_tx.gross_amount,0,v_pos_tx.gross_amount,
        v_pos_tx.currency,(p_operation#>>'{reversal,occurredAt}')::timestamptz::date,'POSTED',
        p_operation#>>'{reversal,reversalReason}',p_actor_user_id,
        (p_operation#>>'{reversal,occurredAt}')::timestamptz,
        (p_operation#>>'{reversal,occurredAt}')::timestamptz,
        'SALE_PAYMENT',v_pos_tx.collection_finance_transaction_id,v_operation_id,'POS_COLLECTION_REVERSAL'
      );
      insert into public.finance_transaction_audits (
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
      ) values (
        'audit:'||v_finance_id,v_finance_id,v_idem,v_tenant,v_company,v_branch,v_period,
        'POSTED',p_actor_user_id,v_pos_tx.customer_id,v_pos_tx.sale_id,null,
        (p_operation#>>'{reversal,occurredAt}')::timestamptz,p_payload_hash
      );
      v_tx_ids := array_append(v_tx_ids,v_finance_id);

      update public.finance_pos_transactions_v1
      set status='REVERSED',
          reversed_at=(p_operation#>>'{reversal,occurredAt}')::timestamptz,
          reversal_finance_transaction_id=v_finance_id,
          pending_amount=0
      where id=v_transaction_id and tenant_id=v_tenant and company_id=v_company and
            branch_id=v_branch and accounting_period_id=v_period;

      update public.finance_pos_settlement_schedules_v1
      set pending_amount=0,
          reversed_at=(p_operation#>>'{reversal,occurredAt}')::timestamptz
      where transaction_id=v_transaction_id and tenant_id=v_tenant and company_id=v_company and
            branch_id=v_branch and accounting_period_id=v_period;

      update public.finance_pos_settlement_lines_v1
      set pending_amount=0,status='REVERSED',
          reversed_at=(p_operation#>>'{reversal,occurredAt}')::timestamptz
      where transaction_id=v_transaction_id and tenant_id=v_tenant and company_id=v_company and
            branch_id=v_branch and accounting_period_id=v_period;

    else
      v_reject_reason := 'FINANCE_POS_ACTION_UNSUPPORTED';
      exit pos_body;
    end if;
  end pos_body;

  if v_reject_reason is not null then
    update public.finance_operation_requests_v1
    set outcome='REJECT',
        result_json=jsonb_build_object('reason',v_reject_reason),
        completed_at=now()
    where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch and
          accounting_period_id=v_period and idempotency_key=v_idem;

    return query select 'REJECT',v_operation_id,null::text[],v_reject_reason;
    return;
  end if;

  update public.finance_operation_requests_v1
  set outcome='CREATED',
      result_json=jsonb_build_object('transactionIds',to_jsonb(v_tx_ids)),
      completed_at=now()
  where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch and
        accounting_period_id=v_period and idempotency_key=v_idem;

  return query select
    case when v_action in ('UPSERT_CONTRACT','UPSERT_RULE','ARCHIVE_CONTRACT','ARCHIVE_RULE') then 'UPDATED' else 'CREATED' end,
    v_operation_id,v_tx_ids,null::text;

exception
  when unique_violation then
    raise;
end;
$function$;

revoke all on function public.persist_finance_pos_authority_v1(jsonb,text,text)
from public, anon, authenticated;

grant execute on function public.persist_finance_pos_authority_v1(jsonb,text,text)
to service_role;

commit;
