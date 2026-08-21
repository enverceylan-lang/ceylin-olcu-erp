-- ENVerp Tahsilat V1 - canonical receivable allocation and instrument portfolio.
-- SOURCE PATCH ONLY. Live apply requires separate explicit authorization.
-- Depends on 20260731 finance foundations, 20260813 workflow RPC and 20260814 account master.

begin;

alter table public.finance_accounts drop constraint if exists finance_accounts_type_chk;
alter table public.finance_accounts add constraint finance_accounts_type_chk check (
  account_type in (
    'CASH','BANK','POS','CUSTOMER_RECEIVABLE','CUSTOMER_PAYABLE',
    'CHEQUE_RECEIVABLE','CHEQUE_IN_COLLECTION','CHEQUE_PAYABLE',
    'NOTE_RECEIVABLE','NOTE_IN_COLLECTION','NOTE_PAYABLE','CLEARING','OTHER'
  )
);

alter table public.finance_sale_workflow_sources
  add column if not exists sale_number text null,
  add column if not exists opening_receivable_amount numeric(18,2) null,
  add column if not exists general_due_date date null,
  add column if not exists installment_plan jsonb not null default '[]'::jsonb;

-- A single card receipt may settle several sales. The POS transaction remains
-- one real card slip; sale/installment detail lives in immutable allocations.
alter table public.finance_pos_transactions_v1
  alter column sale_id drop not null,
  alter column sale_number drop not null;
alter table public.finance_pos_transactions_v1
  drop constraint if exists finance_pos_transactions_number_nonblank_chk;
alter table public.finance_pos_transactions_v1
  add constraint finance_pos_transactions_number_nonblank_chk check (
    btrim(pos_transaction_number) <> '' and btrim(payment_id) <> '' and
    btrim(customer_id) <> '' and
    ((sale_id is null and sale_number is null) or
     (btrim(sale_id) <> '' and btrim(sale_number) <> ''))
  );

create table if not exists public.finance_receivable_open_items_v1 (
  id uuid primary key,
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  customer_id text not null,
  sale_id text not null,
  installment_id text null,
  document_number text not null,
  sequence_no integer not null,
  due_date date not null,
  original_amount numeric(18,2) not null,
  allocated_amount numeric(18,2) not null default 0,
  reserved_amount numeric(18,2) not null default 0,
  currency text not null,
  status text not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_receivable_open_items_amount_ck check (
    original_amount > 0 and allocated_amount >= 0 and reserved_amount >= 0 and
    allocated_amount + reserved_amount <= original_amount
  ),
  constraint finance_receivable_open_items_status_ck check (status in ('OPEN','PARTIAL','CLOSED','REVERSED')),
  constraint finance_receivable_open_items_currency_ck check (currency ~ '^[A-Z]{3}$'),
  constraint finance_receivable_open_items_source_uk unique (
    tenant_id,company_id,branch_id,accounting_period_id,sale_id,sequence_no
  )
);

create index if not exists finance_receivable_open_items_customer_due_idx
on public.finance_receivable_open_items_v1 (
  tenant_id,company_id,branch_id,accounting_period_id,customer_id,currency,due_date,sequence_no
);

create table if not exists public.finance_collection_allocations_v1 (
  id uuid primary key,
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  operation_id uuid not null,
  transaction_id text not null,
  open_item_id uuid not null,
  sale_id text not null,
  installment_id text null,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  reversed_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint finance_collection_allocations_item_fk foreign key (open_item_id)
    references public.finance_receivable_open_items_v1(id),
  constraint finance_collection_allocations_operation_item_uk unique (
    tenant_id,company_id,branch_id,accounting_period_id,operation_id,open_item_id
  )
);

create table if not exists public.finance_instruments_v1 (
  id uuid primary key,
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  instrument_type text not null check (instrument_type in ('CHEQUE','NOTE')),
  direction text not null check (direction in ('RECEIVABLE','PAYABLE')),
  state text not null check (state in ('PORTFOLIO','ISSUED','ENDORSED','DEPOSITED','COLLECTED','PAID','RETURNED','CANCELLED')),
  customer_id text null,
  counterparty_id text null,
  instrument_number text not null,
  drawer_name text not null,
  bank_name text null,
  bank_branch text null,
  account_number text null,
  issue_date date null,
  issue_place text null,
  guarantor_name text null,
  due_date date not null,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  document_media_id text null,
  description text null,
  created_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  archived_at timestamptz null,
  constraint finance_instruments_cheque_bank_ck check (
    instrument_type <> 'CHEQUE' or btrim(coalesce(bank_name,'')) <> ''
  ),
  constraint finance_instruments_identity_uk unique (
    tenant_id,company_id,branch_id,accounting_period_id,instrument_type,instrument_number,drawer_name
  )
);

create table if not exists public.finance_instrument_events_v1 (
  id uuid primary key,
  instrument_id uuid not null references public.finance_instruments_v1(id),
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  from_state text null,
  to_state text not null,
  bank_account_id uuid null,
  counterparty_id text null,
  reason text null,
  actor_user_id text not null,
  occurred_at timestamptz not null,
  payload_hash text not null,
  constraint finance_instrument_events_state_ck check (
    to_state in ('PORTFOLIO','ISSUED','ENDORSED','DEPOSITED','COLLECTED','PAID','RETURNED','CANCELLED')
  )
);

create table if not exists public.finance_instrument_allocations_v1 (
  id uuid primary key,
  instrument_id uuid not null references public.finance_instruments_v1(id),
  open_item_id uuid not null references public.finance_receivable_open_items_v1(id),
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  sale_id text not null,
  installment_id text null,
  amount numeric(18,2) not null check (amount > 0),
  state text not null check (state in ('RESERVED','ALLOCATED','RELEASED')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint finance_instrument_allocations_item_uk unique (instrument_id,open_item_id)
);

alter table public.finance_receivable_open_items_v1 enable row level security;
alter table public.finance_receivable_open_items_v1 force row level security;
alter table public.finance_collection_allocations_v1 enable row level security;
alter table public.finance_collection_allocations_v1 force row level security;
alter table public.finance_instruments_v1 enable row level security;
alter table public.finance_instruments_v1 force row level security;
alter table public.finance_instrument_events_v1 enable row level security;
alter table public.finance_instrument_events_v1 force row level security;
alter table public.finance_instrument_allocations_v1 enable row level security;
alter table public.finance_instrument_allocations_v1 force row level security;

revoke all privileges on table public.finance_receivable_open_items_v1 from public,anon,authenticated,service_role;
revoke all privileges on table public.finance_collection_allocations_v1 from public,anon,authenticated,service_role;
revoke all privileges on table public.finance_instruments_v1 from public,anon,authenticated,service_role;
revoke all privileges on table public.finance_instrument_events_v1 from public,anon,authenticated,service_role;
revoke all privileges on table public.finance_instrument_allocations_v1 from public,anon,authenticated,service_role;
grant select,insert,update on table public.finance_receivable_open_items_v1 to service_role;
grant select,insert,update on table public.finance_collection_allocations_v1 to service_role;
grant select,insert,update on table public.finance_instruments_v1 to service_role;
grant select,insert on table public.finance_instrument_events_v1 to service_role;
grant select,insert,update on table public.finance_instrument_allocations_v1 to service_role;

create or replace function public.register_finance_sale_receivables_v1(p_source jsonb)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public
as $function$
declare
  v_tenant text := trim(coalesce(p_source->>'tenant_id',''));
  v_company text := trim(coalesce(p_source->>'company_id',''));
  v_branch text := trim(coalesce(p_source->>'branch_id',''));
  v_period text := trim(coalesce(p_source->>'accounting_period_id',''));
  v_sale text := trim(coalesce(p_source->>'sale_id',''));
  v_customer text := trim(coalesce(p_source->>'customer_id',''));
  v_currency text := upper(trim(coalesce(p_source->>'currency','')));
  v_open numeric := coalesce(nullif(p_source->>'opening_receivable_amount','')::numeric,(p_source->>'total_amount')::numeric);
  v_total numeric := (p_source->>'total_amount')::numeric;
  v_plan jsonb := coalesce(p_source->'installment_plan','[]'::jsonb);
  v_sum numeric;
  v_plan_count integer;
  v_account_count integer;
  v_item jsonb;
  v_sequence integer;
  v_amount numeric;
  v_due date;
  v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'FINANCE_SERVICE_ROLE_REQUIRED'; end if;
  if v_tenant='' or v_company='' or v_branch='' or v_period='' or v_sale='' or v_customer='' then
    raise exception 'FINANCE_RECEIVABLE_SOURCE_REQUIRED';
  end if;
  if v_open <= 0 or v_open is distinct from v_total or
     v_currency !~ '^[A-Z]{3}$' or jsonb_typeof(v_plan) <> 'array' then
    raise exception 'FINANCE_RECEIVABLE_SOURCE_INVALID';
  end if;

  select count(*),coalesce(sum((plan_item.value->>'amount')::numeric),0)
  into v_plan_count,v_sum
  from jsonb_array_elements(v_plan) as plan_item(value);
  if v_plan_count > 0 and v_sum is distinct from v_open then
    raise exception 'FINANCE_INSTALLMENT_TOTAL_MISMATCH';
  end if;

  -- Canonical customer receivable ledger bootstrap.
  -- 0 active match => create deterministic system ledger.
  -- 1 active match => preserve existing ledger.
  -- >1 active match => fail closed.
  if not exists (
    select 1
    from public.finance_accounts fa
    where fa.tenant_id = v_tenant
      and fa.company_id = v_company
      and fa.branch_id = v_branch
      and fa.accounting_period_id = v_period
      and fa.currency = v_currency
      and fa.account_type = 'CUSTOMER_RECEIVABLE'
      and fa.is_active = true
      and fa.archived_at is null
  ) then
    insert into public.finance_accounts (
      id,
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      code,
      name,
      account_type,
      currency,
      is_active,
      is_default_collection,
      is_default_payment,
      created_by,
      updated_by
    )
    values (
      md5(
        v_tenant || '|' ||
        v_company || '|' ||
        v_branch || '|' ||
        v_period || '|' ||
        v_currency || '|CUSTOMER_RECEIVABLE'
      )::uuid,
      v_tenant,
      v_company,
      v_branch,
      v_period,
      'SYS-CUSTOMER-RECEIVABLE-' || v_currency,
      'Müşteri Alacakları ' || v_currency,
      'CUSTOMER_RECEIVABLE',
      v_currency,
      true,
      false,
      false,
      p_source->>'approved_by_user_id',
      p_source->>'approved_by_user_id'
    )
    on conflict (tenant_id,company_id,branch_id,accounting_period_id,code)
    do nothing;
  end if;

  select count(*)
  into v_account_count
  from public.finance_accounts fa
  where fa.tenant_id = v_tenant
    and fa.company_id = v_company
    and fa.branch_id = v_branch
    and fa.accounting_period_id = v_period
    and fa.currency = v_currency
    and fa.account_type = 'CUSTOMER_RECEIVABLE'
    and fa.is_active = true
    and fa.archived_at is null;

  if v_account_count <> 1 then
    raise exception 'FINANCE_CUSTOMER_RECEIVABLE_ACCOUNT_NOT_UNIQUE';
  end if;
  update public.finance_sale_workflow_sources s set
    sale_number=nullif(trim(coalesce(p_source->>'sale_number','')),''),
    opening_receivable_amount=v_open,
    general_due_date=nullif(p_source->>'general_due_date','')::date,
    installment_plan=v_plan,
    updated_at=now()
  where s.tenant_id=v_tenant and s.company_id=v_company and s.branch_id=v_branch
    and s.accounting_period_id=v_period and s.sale_id=v_sale
    and (s.opening_receivable_amount is null or (
      s.opening_receivable_amount=v_open and s.installment_plan=v_plan
    ));
  if not found then raise exception 'FINANCE_RECEIVABLE_SOURCE_CONFLICT'; end if;
  if v_plan_count=0 then
    v_id := md5(v_tenant||'|'||v_company||'|'||v_branch||'|'||v_period||'|'||v_sale||'|1')::uuid;
    insert into public.finance_receivable_open_items_v1(
      id,tenant_id,company_id,branch_id,accounting_period_id,customer_id,sale_id,installment_id,
      document_number,sequence_no,due_date,original_amount,currency
    ) values (
      v_id,v_tenant,v_company,v_branch,v_period,v_customer,v_sale,null,
      coalesce(nullif(trim(p_source->>'sale_number'),''),v_sale),1,
      coalesce(nullif(p_source->>'general_due_date','')::date,(p_source->>'approved_at')::date),v_open,v_currency
    ) on conflict do nothing;
  else
    for v_item in select value from jsonb_array_elements(v_plan) loop
      v_sequence := (v_item->>'sequence')::integer;
      v_amount := (v_item->>'amount')::numeric;
      v_due := (v_item->>'due_date')::date;
      if v_sequence<=0 or v_amount<=0 or trim(coalesce(v_item->>'installment_id',''))='' then
        raise exception 'FINANCE_INSTALLMENT_INVALID';
      end if;
      v_id := md5(v_tenant||'|'||v_company||'|'||v_branch||'|'||v_period||'|'||v_sale||'|'||v_sequence::text)::uuid;
      insert into public.finance_receivable_open_items_v1(
        id,tenant_id,company_id,branch_id,accounting_period_id,customer_id,sale_id,installment_id,
        document_number,sequence_no,due_date,original_amount,currency
      ) values (
        v_id,v_tenant,v_company,v_branch,v_period,v_customer,v_sale,v_item->>'installment_id',
        coalesce(nullif(trim(p_source->>'sale_number'),''),v_sale),v_sequence,v_due,v_amount,v_currency
      ) on conflict do nothing;
    end loop;
  end if;
  select count(*),coalesce(sum(oi.original_amount),0)
  into v_sequence,v_sum
  from public.finance_receivable_open_items_v1 oi
  where oi.tenant_id=v_tenant and oi.company_id=v_company and oi.branch_id=v_branch
    and oi.accounting_period_id=v_period and oi.sale_id=v_sale
    and oi.customer_id=v_customer and oi.currency=v_currency;
  if v_sequence<>(case when v_plan_count=0 then 1 else v_plan_count end) or v_sum is distinct from v_open or
     exists (
       select 1 from public.finance_receivable_open_items_v1 oi
       where oi.tenant_id=v_tenant and oi.company_id=v_company and oi.branch_id=v_branch
         and oi.accounting_period_id=v_period and oi.sale_id=v_sale
         and (oi.customer_id<>v_customer or oi.currency<>v_currency)
     ) then
    raise exception 'FINANCE_RECEIVABLE_OPEN_ITEM_CONFLICT';
  end if;
end;
$function$;

revoke all on function public.register_finance_sale_receivables_v1(jsonb) from public,anon,authenticated;
grant execute on function public.register_finance_sale_receivables_v1(jsonb) to service_role;

-- Keep the previously audited atomic workflow as the core and wrap it so the
-- SALE_CHARGE and its receivable schedule commit or roll back together.
do $block$
begin
  if to_regprocedure('public.persist_finance_system_workflow_core_v1(text,jsonb,jsonb,jsonb)') is null then
    alter function public.persist_finance_system_workflow_v1(text,jsonb,jsonb,jsonb)
      rename to persist_finance_system_workflow_core_v1;
  end if;
end;
$block$;

create or replace function public.persist_finance_system_workflow_v1(
  p_workflow text,p_source jsonb,p_transaction jsonb,p_audit jsonb
)
returns table(outcome text,transaction_id text,reason text)
language plpgsql
security definer
set search_path=pg_catalog,public
as $function$
declare v_outcome text; v_transaction text; v_reason text;
begin
  select r.outcome,r.transaction_id,r.reason into v_outcome,v_transaction,v_reason
  from public.persist_finance_system_workflow_core_v1(p_workflow,p_source,p_transaction,p_audit) r;
  if p_workflow='SALE_APPROVAL' and v_outcome in ('CREATED','REPLAY') then
    perform public.register_finance_sale_receivables_v1(p_source);
  end if;
  return query select v_outcome,v_transaction,v_reason;
end;
$function$;

revoke all on function public.persist_finance_system_workflow_v1(text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.persist_finance_system_workflow_v1(text,jsonb,jsonb,jsonb) to service_role;

create or replace function public.persist_finance_collection_v1(
  p_command jsonb,p_actor_user_id text,p_payload_hash text
)
returns table(
  outcome text,operation_id text,transaction_ids text[],instrument_id text,
  allocations jsonb,reason text,occurred_at timestamptz
)
language plpgsql
security definer
set search_path=pg_catalog,public
as $function$
declare
  v_tenant text := trim(coalesce(p_command->>'tenantId',''));
  v_company text := trim(coalesce(p_command->>'companyId',''));
  v_branch text := trim(coalesce(p_command->>'branchId',''));
  v_period text := trim(coalesce(p_command->>'accountingPeriodId',''));
  v_operation uuid;
  v_idem text := trim(coalesce(p_command->>'idempotencyKey',''));
  v_channel text := trim(coalesce(p_command->>'channel',''));
  v_customer text := trim(coalesce(p_command->>'customerId',''));
  v_amount numeric := nullif(p_command->>'amount','')::numeric;
  v_currency text := upper(trim(coalesce(p_command->>'currency','')));
  v_description text := nullif(trim(coalesce(p_command->>'description','')),'');
  v_now timestamptz := clock_timestamp();
  v_existing public.finance_operation_requests_v1%rowtype;
  v_account uuid;
  v_operational_ledger uuid;
  v_receivable_ledger uuid;
  v_instrument_ledger uuid;
  v_account_currency text;
  v_account_name text;
  v_receivable_count integer;
  v_available numeric;
  v_remaining numeric;
  v_line numeric;
  v_tx text;
  v_instrument uuid;
  v_item public.finance_receivable_open_items_v1%rowtype;
  v_allocations jsonb := '[]'::jsonb;
  v_result jsonb;
  v_error text;
  v_pos_id uuid;
  v_pos_transaction_id uuid;
  v_pos_contract public.finance_pos_contracts_v1%rowtype;
  v_pos_rule public.finance_pos_contract_rules_v1%rowtype;
  v_contract_count integer;
  v_rule_count integer;
  v_installment_count integer;
  v_commission numeric;
  v_fixed numeric;
  v_tax numeric;
  v_additional numeric;
  v_deduction numeric;
  v_net numeric;
  v_schedule_id uuid;
  v_part_count integer;
  v_part_index integer;
  v_part_gross numeric;
  v_part_commission numeric;
  v_part_fixed numeric;
  v_part_tax numeric;
  v_part_additional numeric;
  v_part_net numeric;
  v_sum_gross numeric:=0;
  v_sum_commission numeric:=0;
  v_sum_fixed numeric:=0;
  v_sum_tax numeric:=0;
  v_sum_additional numeric:=0;
  v_sum_net numeric:=0;
  v_expected_date date;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'FINANCE_COLLECTION_SERVICE_ROLE_REQUIRED'; end if;
  begin v_operation := (p_command->>'operationId')::uuid;
  exception when others then
    return query select 'REJECT',null::text,array[]::text[],null::text,'[]'::jsonb,'FINANCE_COLLECTION_OPERATION_UUID_INVALID',v_now;
    return;
  end;
  if v_tenant='' or v_company='' or v_branch='' or v_period='' or v_idem='' or
     v_customer='' or v_amount is null or v_amount<=0 or v_currency !~ '^[A-Z]{3}$' or
     trim(coalesce(p_actor_user_id,''))='' or trim(coalesce(p_payload_hash,''))='' then
    return query select 'REJECT',v_operation::text,array[]::text[],null::text,'[]'::jsonb,'FINANCE_COLLECTION_REQUIRED_FIELD_INVALID',v_now;
    return;
  end if;

  insert into public.finance_operation_requests_v1(
    tenant_id,company_id,branch_id,accounting_period_id,idempotency_key,payload_hash,
    operation_id,outcome,actor_user_id
  ) values (
    v_tenant,v_company,v_branch,v_period,v_idem,p_payload_hash,v_operation::text,'PENDING',p_actor_user_id
  ) on conflict do nothing;
  if not found then
    select * into v_existing from public.finance_operation_requests_v1 r
    where r.tenant_id=v_tenant and r.company_id=v_company and r.branch_id=v_branch
      and r.accounting_period_id=v_period and r.idempotency_key=v_idem for update;
    if v_existing.payload_hash is distinct from p_payload_hash then
      return query select 'CONFLICT',v_existing.operation_id,array[]::text[],null::text,'[]'::jsonb,'IDEMPOTENCY_PAYLOAD_CONFLICT',v_now;
    elsif v_existing.outcome='CREATED' then
      return query select 'REPLAY',v_existing.operation_id,
        coalesce(array(select jsonb_array_elements_text(v_existing.result_json->'transactionIds')),array[]::text[]),
        v_existing.result_json->>'instrumentId',coalesce(v_existing.result_json->'allocations','[]'::jsonb),null::text,
        (v_existing.result_json->>'occurredAt')::timestamptz;
    elsif v_existing.outcome='REJECT' then
      return query select 'REJECT',v_existing.operation_id,array[]::text[],null::text,'[]'::jsonb,
        v_existing.result_json->>'reason',v_existing.completed_at;
    else
      return query select 'CONFLICT',v_existing.operation_id,array[]::text[],null::text,'[]'::jsonb,'FINANCE_COLLECTION_PENDING_CONFLICT',v_now;
    end if;
    return;
  end if;

  begin
  -- Lock all eligible items before checking the total. This is the concurrency gate.
  perform 1 from public.finance_receivable_open_items_v1 oi
  where oi.tenant_id=v_tenant and oi.company_id=v_company and oi.branch_id=v_branch
    and oi.accounting_period_id=v_period and oi.customer_id=v_customer and oi.currency=v_currency
    and oi.status in ('OPEN','PARTIAL')
  order by oi.due_date,oi.document_number,oi.sequence_no,oi.id for update;

  select coalesce(sum(original_amount-allocated_amount-reserved_amount),0)
  into v_available from public.finance_receivable_open_items_v1 oi
  where oi.tenant_id=v_tenant and oi.company_id=v_company and oi.branch_id=v_branch
    and oi.accounting_period_id=v_period and oi.customer_id=v_customer and oi.currency=v_currency
    and oi.status in ('OPEN','PARTIAL');
  if v_available < v_amount then
    update public.finance_operation_requests_v1 set outcome='REJECT',
      result_json=jsonb_build_object('reason','FINANCE_COLLECTION_EXCEEDS_OPEN_RECEIVABLE'),completed_at=v_now
    where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
      and accounting_period_id=v_period and idempotency_key=v_idem;
    return query select 'REJECT',v_operation::text,array[]::text[],null::text,'[]'::jsonb,'FINANCE_COLLECTION_EXCEEDS_OPEN_RECEIVABLE',v_now;
    return;
  end if;

  if v_channel in ('CHEQUE','NOTE') then
    begin v_instrument := coalesce(nullif(p_command#>>'{instrument,instrumentId}','')::uuid,gen_random_uuid());
    exception when others then raise exception 'FINANCE_INSTRUMENT_UUID_INVALID'; end;
    if trim(coalesce(p_command#>>'{instrument,instrumentNumber}',''))='' or
       trim(coalesce(p_command#>>'{instrument,drawerName}',''))='' or
       nullif(p_command#>>'{instrument,dueDate}','')::date is null or
       (v_channel='CHEQUE' and trim(coalesce(p_command#>>'{instrument,bankName}',''))='') then
      raise exception 'FINANCE_INSTRUMENT_REQUIRED_FIELD_INVALID';
    end if;
    insert into public.finance_instruments_v1(
      id,tenant_id,company_id,branch_id,accounting_period_id,instrument_type,direction,state,
      customer_id,instrument_number,drawer_name,bank_name,bank_branch,account_number,issue_date,
      issue_place,guarantor_name,due_date,amount,currency,document_media_id,description,
      created_by,created_at,updated_at
    ) values (
      v_instrument,v_tenant,v_company,v_branch,v_period,v_channel,'RECEIVABLE','PORTFOLIO',
      v_customer,trim(p_command#>>'{instrument,instrumentNumber}'),trim(p_command#>>'{instrument,drawerName}'),
      nullif(trim(coalesce(p_command#>>'{instrument,bankName}','')),''),
      nullif(trim(coalesce(p_command#>>'{instrument,bankBranch}','')),''),
      nullif(trim(coalesce(p_command#>>'{instrument,accountNumber}','')),''),
      nullif(p_command#>>'{instrument,issueDate}','')::date,
      nullif(trim(coalesce(p_command#>>'{instrument,issuePlace}','')),''),
      nullif(trim(coalesce(p_command#>>'{instrument,guarantorName}','')),''),
      (p_command#>>'{instrument,dueDate}')::date,v_amount,v_currency,
      nullif(trim(coalesce(p_command#>>'{instrument,documentMediaId}','')),''),
      coalesce(v_description,case when v_channel='CHEQUE' then 'Müşteri çeki ile tahsilat' else 'Müşteri senedi ile tahsilat' end),
      p_actor_user_id,v_now,v_now
    );
    insert into public.finance_instrument_events_v1(
      id,instrument_id,tenant_id,company_id,branch_id,accounting_period_id,from_state,to_state,
      actor_user_id,occurred_at,payload_hash
    ) values (gen_random_uuid(),v_instrument,v_tenant,v_company,v_branch,v_period,null,'PORTFOLIO',p_actor_user_id,v_now,p_payload_hash);

    insert into public.finance_accounts(
      id,tenant_id,company_id,branch_id,accounting_period_id,code,name,account_type,currency,
      is_active,is_default_collection,is_default_payment,created_by,updated_by
    ) values (
      md5(v_tenant||'|'||v_company||'|'||v_branch||'|'||v_period||'|'||v_currency||'|'||v_channel||'_RECEIVABLE')::uuid,
      v_tenant,v_company,v_branch,v_period,
      case when v_channel='CHEQUE' then 'SYS-CHEQUE-PORTFOLIO-' else 'SYS-NOTE-PORTFOLIO-' end||v_currency,
      case when v_channel='CHEQUE' then 'Çek Kasası ' else 'Senet Kasası ' end||v_currency,
      case when v_channel='CHEQUE' then 'CHEQUE_RECEIVABLE' else 'NOTE_RECEIVABLE' end,
      v_currency,true,false,false,p_actor_user_id,p_actor_user_id
    ) on conflict (tenant_id,company_id,branch_id,accounting_period_id,code) do nothing;
    insert into public.finance_accounts(
      id,tenant_id,company_id,branch_id,accounting_period_id,code,name,account_type,currency,
      is_active,is_default_collection,is_default_payment,created_by,updated_by
    ) values (
      md5(v_tenant||'|'||v_company||'|'||v_branch||'|'||v_period||'|'||v_currency||'|'||v_channel||'_IN_COLLECTION')::uuid,
      v_tenant,v_company,v_branch,v_period,
      case when v_channel='CHEQUE' then 'SYS-CHEQUE-COLLECTION-' else 'SYS-NOTE-COLLECTION-' end||v_currency,
      case when v_channel='CHEQUE' then 'Tahsildeki Çekler ' else 'Tahsildeki Senetler ' end||v_currency,
      case when v_channel='CHEQUE' then 'CHEQUE_IN_COLLECTION' else 'NOTE_IN_COLLECTION' end,
      v_currency,true,false,false,p_actor_user_id,p_actor_user_id
    ) on conflict (tenant_id,company_id,branch_id,accounting_period_id,code) do nothing;

    select count(*),(array_agg(fa.id order by fa.id::text))[1] into v_receivable_count,v_receivable_ledger
    from public.finance_accounts fa where fa.tenant_id=v_tenant and fa.company_id=v_company
      and fa.branch_id=v_branch and fa.accounting_period_id=v_period and fa.currency=v_currency
      and fa.account_type='CUSTOMER_RECEIVABLE' and fa.is_active and fa.archived_at is null;
    if v_receivable_count<>1 then raise exception 'FINANCE_CUSTOMER_RECEIVABLE_ACCOUNT_NOT_UNIQUE'; end if;
    select count(*),(array_agg(fa.id order by fa.id::text))[1] into v_receivable_count,v_instrument_ledger
    from public.finance_accounts fa where fa.tenant_id=v_tenant and fa.company_id=v_company
      and fa.branch_id=v_branch and fa.accounting_period_id=v_period and fa.currency=v_currency
      and fa.account_type=case when v_channel='CHEQUE' then 'CHEQUE_RECEIVABLE' else 'NOTE_RECEIVABLE' end
      and fa.is_active and fa.archived_at is null;
    if v_receivable_count<>1 then raise exception 'FINANCE_INSTRUMENT_PORTFOLIO_ACCOUNT_NOT_UNIQUE'; end if;

    v_tx:=v_operation::text;
    insert into public.finance_transactions(
      id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
      transaction_type,direction,payment_method,finance_account_id,counter_account_id,
      customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
      gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
      created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
    ) values (
      v_tx,v_tx,v_idem,v_tenant,v_company,v_branch,v_period,'COLLECTION','DEBIT',
      case when v_channel='CHEQUE' then 'CHEQUE' else 'PROMISSORY_NOTE' end,
      v_instrument_ledger::text,v_receivable_ledger::text,v_customer,null,null,v_instrument::text,
      case when v_channel='CHEQUE' then 'CHEQUE' else 'NOTE' end,
      v_amount,0,v_amount,v_currency,current_date,'POSTED',
      coalesce(v_description,case when v_channel='CHEQUE' then 'Müşteri çeki ile tahsilat' else 'Müşteri senedi ile tahsilat' end),
      p_actor_user_id,v_now,v_now,'SALE_PAYMENT',v_operation::text,'SINGLE'
    );
    insert into public.finance_transaction_audits(
      id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
      action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
    ) values ('audit:'||v_tx,v_tx,v_idem,v_tenant,v_company,v_branch,v_period,
      'POSTED',p_actor_user_id,v_customer,null,null,v_now,p_payload_hash);

    v_remaining:=v_amount;
    for v_item in select * from public.finance_receivable_open_items_v1 oi
      where oi.tenant_id=v_tenant and oi.company_id=v_company and oi.branch_id=v_branch
        and oi.accounting_period_id=v_period and oi.customer_id=v_customer and oi.currency=v_currency
        and oi.status in ('OPEN','PARTIAL') and oi.original_amount>oi.allocated_amount+oi.reserved_amount
      order by oi.due_date,oi.document_number,oi.sequence_no,oi.id
    loop
      exit when v_remaining<=0;
      v_line:=least(v_remaining,v_item.original_amount-v_item.allocated_amount-v_item.reserved_amount);
      update public.finance_receivable_open_items_v1 set allocated_amount=allocated_amount+v_line,
        updated_at=v_now,
        status=case when allocated_amount+v_line+reserved_amount=original_amount then 'CLOSED' else 'PARTIAL' end
      where id=v_item.id;
      insert into public.finance_instrument_allocations_v1(
        id,instrument_id,open_item_id,tenant_id,company_id,branch_id,accounting_period_id,
        sale_id,installment_id,amount,state,created_at,updated_at
      ) values (gen_random_uuid(),v_instrument,v_item.id,v_tenant,v_company,v_branch,v_period,
        v_item.sale_id,v_item.installment_id,v_line,'ALLOCATED',v_now,v_now);
      insert into public.finance_collection_allocations_v1(
        id,tenant_id,company_id,branch_id,accounting_period_id,operation_id,transaction_id,
        open_item_id,sale_id,installment_id,amount,currency
      ) values (gen_random_uuid(),v_tenant,v_company,v_branch,v_period,v_operation,v_tx,
        v_item.id,v_item.sale_id,v_item.installment_id,v_line,v_currency);
      v_allocations:=v_allocations||jsonb_build_array(jsonb_build_object(
        'receivableId',v_item.id,'saleId',v_item.sale_id,'installmentId',v_item.installment_id,'amount',v_line));
      v_remaining:=v_remaining-v_line;
    end loop;
    if v_remaining<>0 then raise exception 'FINANCE_INSTRUMENT_NOMINAL_ALLOCATION_MISMATCH'; end if;
    v_result:=jsonb_build_object('transactionIds',jsonb_build_array(v_tx),'instrumentId',v_instrument::text,
      'allocations',v_allocations,'occurredAt',v_now);
    update public.finance_operation_requests_v1 set outcome='CREATED',result_json=v_result,completed_at=v_now
    where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
      and accounting_period_id=v_period and idempotency_key=v_idem;
    return query select 'CREATED',v_operation::text,array[v_tx],v_instrument::text,v_allocations,null::text,v_now;
    return;
  end if;

  if v_channel='CASH' then
    begin v_account:=(p_command->>'cashAccountId')::uuid; exception when others then raise exception 'FINANCE_CASH_ACCOUNT_UUID_INVALID'; end;
    select ca.ledger_account_id,ca.currency,ca.cash_name into v_operational_ledger,v_account_currency,v_account_name
    from public.cash_accounts ca where ca.id=v_account and ca.tenant_id=v_tenant and ca.company_id=v_company
      and ca.branch_id=v_branch and ca.accounting_period_id=v_period and ca.is_active and ca.archived_at is null for update;
  elsif v_channel='BANK' then
    begin v_account:=(p_command->>'bankAccountId')::uuid; exception when others then raise exception 'FINANCE_BANK_ACCOUNT_UUID_INVALID'; end;
    select ba.ledger_account_id,ba.currency,ba.bank_name into v_operational_ledger,v_account_currency,v_account_name
    from public.bank_accounts ba where ba.id=v_account and ba.tenant_id=v_tenant and ba.company_id=v_company
      and ba.branch_id=v_branch and ba.accounting_period_id=v_period and ba.is_active and ba.archived_at is null for update;
  elsif v_channel='POS' then
    begin
      v_pos_id:=(p_command->>'posAccountId')::uuid;
      v_installment_count:=(p_command->>'installmentCount')::integer;
    exception when others then raise exception 'FINANCE_POS_COLLECTION_INPUT_INVALID'; end;
    if v_installment_count<=0 then raise exception 'FINANCE_POS_COLLECTION_INSTALLMENT_INVALID'; end if;
    select count(*) into v_contract_count from public.finance_pos_contracts_v1 c
    where c.tenant_id=v_tenant and c.company_id=v_company and c.branch_id=v_branch
      and c.accounting_period_id=v_period and c.pos_account_id=v_pos_id and c.is_active
      and c.archived_at is null and c.valid_from<=current_date
      and (c.valid_until is null or c.valid_until>=current_date);
    if v_contract_count<>1 then raise exception 'FINANCE_POS_ACTIVE_CONTRACT_NOT_UNIQUE'; end if;
    select * into v_pos_contract from public.finance_pos_contracts_v1 c
    where c.tenant_id=v_tenant and c.company_id=v_company and c.branch_id=v_branch
      and c.accounting_period_id=v_period and c.pos_account_id=v_pos_id and c.is_active
      and c.archived_at is null and c.valid_from<=current_date
      and (c.valid_until is null or c.valid_until>=current_date) for update;
    select count(*) into v_rule_count from public.finance_pos_contract_rules_v1 r
    where r.tenant_id=v_tenant and r.company_id=v_company and r.branch_id=v_branch
      and r.accounting_period_id=v_period and r.contract_id=v_pos_contract.id
      and r.pos_account_id=v_pos_id and r.installment_count=v_installment_count
      and r.is_active and r.archived_at is null;
    if v_rule_count<>1 then raise exception 'FINANCE_POS_ACTIVE_RULE_NOT_UNIQUE'; end if;
    select * into v_pos_rule from public.finance_pos_contract_rules_v1 r
    where r.tenant_id=v_tenant and r.company_id=v_company and r.branch_id=v_branch
      and r.accounting_period_id=v_period and r.contract_id=v_pos_contract.id
      and r.pos_account_id=v_pos_id and r.installment_count=v_installment_count
      and r.is_active and r.archived_at is null for update;
    select pa.currency,pa.pos_name into v_account_currency,v_account_name
    from public.pos_accounts pa where pa.id=v_pos_id and pa.tenant_id=v_tenant and pa.company_id=v_company
      and pa.branch_id=v_branch and pa.accounting_period_id=v_period and pa.is_active and pa.archived_at is null for update;
    v_operational_ledger:=v_pos_contract.clearing_ledger_account_id;
    v_pos_transaction_id:=v_operation;
  else
    raise exception 'FINANCE_COLLECTION_CHANNEL_REQUIRES_SPECIAL_AUTHORITY';
  end if;
  if not found or v_account_currency<>v_currency then raise exception 'FINANCE_COLLECTION_ACCOUNT_SCOPE_OR_CURRENCY_INVALID'; end if;

  select count(*),(array_agg(fa.id order by fa.id::text))[1] into v_receivable_count,v_receivable_ledger
  from public.finance_accounts fa where fa.tenant_id=v_tenant and fa.company_id=v_company
    and fa.branch_id=v_branch and fa.accounting_period_id=v_period and fa.currency=v_currency
    and fa.account_type='CUSTOMER_RECEIVABLE' and fa.is_active and fa.archived_at is null;
  if v_receivable_count<>1 then raise exception 'FINANCE_CUSTOMER_RECEIVABLE_ACCOUNT_NOT_UNIQUE'; end if;
  if v_channel='POS' and v_receivable_ledger<>v_pos_contract.customer_receivable_account_id then
    raise exception 'FINANCE_POS_CUSTOMER_RECEIVABLE_ACCOUNT_MISMATCH';
  end if;

  if v_description is null then
    v_description:=case when v_channel='CASH' then 'Nakit tahsilat – '||v_account_name
      when v_channel='BANK' then v_account_name||' – EFT/Havale tahsilatı'
      else 'Kredi kartı ile tahsilat – '||v_account_name end;
  end if;
  v_tx:=v_operation::text;
  insert into public.finance_transactions(
    id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
    transaction_type,direction,payment_method,finance_account_id,counter_account_id,
    customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
    gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
    created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
  ) values (
    v_tx,v_tx,v_idem,v_tenant,v_company,v_branch,v_period,'COLLECTION','DEBIT',
    case when v_channel='CASH' then 'CASH' when v_channel='BANK' then 'EFT' else 'CREDIT_CARD' end,
    v_operational_ledger::text,v_receivable_ledger::text,v_customer,null,null,v_operation::text,'SALE_PAYMENT',
    v_amount,0,v_amount,v_currency,current_date,'POSTED',v_description,p_actor_user_id,v_now,v_now,
    'SALE_PAYMENT',v_operation::text,'SINGLE'
  );
  insert into public.finance_transaction_audits(
    id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
    action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
  ) values ('audit:'||v_tx,v_tx,v_idem,v_tenant,v_company,v_branch,v_period,
    'POSTED',p_actor_user_id,v_customer,null,null,v_now,p_payload_hash);

  if v_channel='POS' then
    v_commission:=round(v_amount*v_pos_rule.commission_rate/100,2);
    v_fixed:=round(v_pos_rule.fixed_transaction_fee,2);
    v_tax:=round((v_commission+v_fixed)*v_pos_rule.tax_rate/100,2);
    v_additional:=round(v_amount*v_pos_rule.additional_fee_rate/100,2);
    v_deduction:=round(v_commission+v_fixed+v_tax+v_additional,2);
    v_net:=round(v_amount-v_deduction,2);
    if v_net<0 then raise exception 'FINANCE_POS_COLLECTION_DEDUCTION_EXCEEDS_GROSS'; end if;
    v_schedule_id:=gen_random_uuid();
    insert into public.finance_pos_transactions_v1(
      id,tenant_id,company_id,branch_id,accounting_period_id,pos_transaction_number,
      pos_account_id,bank_account_id,contract_id,rule_id,sale_id,sale_number,payment_id,customer_id,
      installment_count,working_mode,gross_amount,commission_amount,fixed_transaction_fee,tax_amount,
      additional_fee_amount,total_deduction_amount,net_amount,settled_amount,pending_amount,currency,
      transaction_date,expected_first_settlement_date,expected_final_settlement_date,
      actual_settlement_date,status,description,rule_snapshot,collection_finance_transaction_id,
      created_by,created_at,reversed_at,reversal_finance_transaction_id
    ) values (
      v_pos_transaction_id,v_tenant,v_company,v_branch,v_period,'POS-'||v_pos_transaction_id::text,
      v_pos_id,v_pos_contract.bank_account_id,v_pos_contract.id,v_pos_rule.id,null,null,
      v_operation::text,v_customer,v_pos_rule.installment_count,v_pos_rule.working_mode,
      v_amount,v_commission,v_fixed,v_tax,v_additional,v_deduction,v_net,0,v_net,v_currency,current_date,
      current_date+v_pos_rule.first_settlement_day_count,
      current_date+v_pos_rule.first_settlement_day_count+
        case when v_pos_rule.working_mode='MONTHLY_BLOCKED'
          then v_pos_rule.installment_interval_day_count*(v_pos_rule.installment_count-1) else 0 end,
      null,'PENDING_SETTLEMENT',v_description,
      jsonb_build_object(
        'ruleId',v_pos_rule.id,'posContractId',v_pos_rule.contract_id,
        'workingMode',v_pos_rule.working_mode,'installmentCount',v_pos_rule.installment_count,
        'commissionRate',v_pos_rule.commission_rate,'fixedTransactionFee',v_pos_rule.fixed_transaction_fee,
        'taxRate',v_pos_rule.tax_rate,'additionalFeeRate',v_pos_rule.additional_fee_rate,
        'firstSettlementDayCount',v_pos_rule.first_settlement_day_count,
        'installmentIntervalDayCount',v_pos_rule.installment_interval_day_count
      ),v_tx,p_actor_user_id,v_now,null,null
    );
    insert into public.finance_pos_settlement_schedules_v1(
      id,tenant_id,company_id,branch_id,accounting_period_id,transaction_id,contract_id,rule_id,
      pos_account_id,bank_account_id,working_mode,installment_count,gross_amount,total_deduction_amount,
      net_amount,settled_amount,pending_amount,currency,created_by,created_at,reversed_at
    ) values (
      v_schedule_id,v_tenant,v_company,v_branch,v_period,v_pos_transaction_id,v_pos_contract.id,v_pos_rule.id,
      v_pos_id,v_pos_contract.bank_account_id,v_pos_rule.working_mode,v_pos_rule.installment_count,
      v_amount,v_deduction,v_net,0,v_net,v_currency,p_actor_user_id,v_now,null
    );
    v_part_count:=case when v_pos_rule.working_mode='MONTHLY_BLOCKED' then v_pos_rule.installment_count else 1 end;
    for v_part_index in 1..v_part_count loop
      if v_part_index=v_part_count then
        v_part_gross:=round(v_amount-v_sum_gross,2);
        v_part_commission:=round(v_commission-v_sum_commission,2);
        v_part_fixed:=round(v_fixed-v_sum_fixed,2);
        v_part_tax:=round(v_tax-v_sum_tax,2);
        v_part_additional:=round(v_additional-v_sum_additional,2);
        v_part_net:=round(v_net-v_sum_net,2);
      else
        v_part_gross:=trunc((v_amount/v_part_count)*100)/100;
        v_part_commission:=trunc((v_commission/v_part_count)*100)/100;
        v_part_fixed:=trunc((v_fixed/v_part_count)*100)/100;
        v_part_tax:=trunc((v_tax/v_part_count)*100)/100;
        v_part_additional:=trunc((v_additional/v_part_count)*100)/100;
        v_part_net:=trunc((v_net/v_part_count)*100)/100;
      end if;
      v_expected_date:=current_date+v_pos_rule.first_settlement_day_count+
        case when v_pos_rule.working_mode='MONTHLY_BLOCKED'
          then v_pos_rule.installment_interval_day_count*(v_part_index-1) else 0 end;
      insert into public.finance_pos_settlement_lines_v1(
        id,tenant_id,company_id,branch_id,accounting_period_id,schedule_id,transaction_id,
        sequence,expected_settlement_date,actual_settlement_date,gross_amount,commission_amount,
        fixed_transaction_fee,tax_amount,additional_fee_amount,net_amount,settled_amount,
        pending_amount,status,reversed_at
      ) values (
        gen_random_uuid(),v_tenant,v_company,v_branch,v_period,v_schedule_id,v_pos_transaction_id,
        v_part_index,v_expected_date,null,v_part_gross,v_part_commission,v_part_fixed,v_part_tax,
        v_part_additional,v_part_net,0,v_part_net,'PENDING',null
      );
      v_sum_gross:=round(v_sum_gross+v_part_gross,2);
      v_sum_commission:=round(v_sum_commission+v_part_commission,2);
      v_sum_fixed:=round(v_sum_fixed+v_part_fixed,2);
      v_sum_tax:=round(v_sum_tax+v_part_tax,2);
      v_sum_additional:=round(v_sum_additional+v_part_additional,2);
      v_sum_net:=round(v_sum_net+v_part_net,2);
    end loop;
  end if;

  v_remaining:=v_amount;
  for v_item in select * from public.finance_receivable_open_items_v1 oi
    where oi.tenant_id=v_tenant and oi.company_id=v_company and oi.branch_id=v_branch
      and oi.accounting_period_id=v_period and oi.customer_id=v_customer and oi.currency=v_currency
      and oi.status in ('OPEN','PARTIAL') and oi.original_amount>oi.allocated_amount+oi.reserved_amount
    order by oi.due_date,oi.document_number,oi.sequence_no,oi.id
  loop
    exit when v_remaining<=0;
    v_line:=least(v_remaining,v_item.original_amount-v_item.allocated_amount-v_item.reserved_amount);
    update public.finance_receivable_open_items_v1 set allocated_amount=allocated_amount+v_line,updated_at=v_now,
      status=case when allocated_amount+v_line+reserved_amount=original_amount then 'CLOSED' else 'PARTIAL' end
    where id=v_item.id;
    insert into public.finance_collection_allocations_v1(
      id,tenant_id,company_id,branch_id,accounting_period_id,operation_id,transaction_id,
      open_item_id,sale_id,installment_id,amount,currency
    ) values (gen_random_uuid(),v_tenant,v_company,v_branch,v_period,v_operation,v_tx,
      v_item.id,v_item.sale_id,v_item.installment_id,v_line,v_currency);
    v_allocations:=v_allocations||jsonb_build_array(jsonb_build_object(
      'receivableId',v_item.id,'saleId',v_item.sale_id,'installmentId',v_item.installment_id,'amount',v_line));
    v_remaining:=v_remaining-v_line;
  end loop;
  v_result:=jsonb_build_object('transactionIds',jsonb_build_array(v_tx),'instrumentId',null,
    'allocations',v_allocations,'occurredAt',v_now);
  update public.finance_operation_requests_v1 set outcome='CREATED',result_json=v_result,completed_at=v_now
  where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
    and accounting_period_id=v_period and idempotency_key=v_idem;
  return query select 'CREATED',v_operation::text,array[v_tx],null::text,v_allocations,null::text,v_now;
  return;
  exception when others then
    v_error:=case when sqlerrm ~ '^FINANCE_' then sqlerrm else 'FINANCE_COLLECTION_PERSISTENCE_FAILED' end;
    update public.finance_operation_requests_v1 set outcome='REJECT',
      result_json=jsonb_build_object('reason',v_error),completed_at=clock_timestamp()
    where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
      and accounting_period_id=v_period and idempotency_key=v_idem;
    return query select 'REJECT',v_operation::text,array[]::text[],null::text,'[]'::jsonb,v_error,clock_timestamp();
    return;
  end;
end;
$function$;

revoke all on function public.persist_finance_collection_v1(jsonb,text,text) from public,anon,authenticated;
grant execute on function public.persist_finance_collection_v1(jsonb,text,text) to service_role;

create or replace function public.reverse_finance_collection_v1(
  p_command jsonb,p_actor_user_id text,p_payload_hash text
)
returns table(outcome text,operation_id text,transaction_ids text[],reason text,occurred_at timestamptz)
language plpgsql
security definer
set search_path=pg_catalog,public
as $function$
declare
  v_tenant text:=trim(coalesce(p_command->>'tenantId',''));
  v_company text:=trim(coalesce(p_command->>'companyId',''));
  v_branch text:=trim(coalesce(p_command->>'branchId',''));
  v_period text:=trim(coalesce(p_command->>'accountingPeriodId',''));
  v_operation uuid;
  v_target uuid;
  v_idem text:=trim(coalesce(p_command->>'idempotencyKey',''));
  v_reason_text text:=trim(coalesce(p_command->>'reason',''));
  v_channel text:=trim(coalesce(p_command->>'channel',''));
  v_now timestamptz:=clock_timestamp();
  v_existing public.finance_operation_requests_v1%rowtype;
  v_allocation public.finance_collection_allocations_v1%rowtype;
  v_transaction public.finance_transactions%rowtype;
  v_reversal_id text;
  v_transaction_ids text[]:=array[]::text[];
  v_count integer:=0;
  v_error text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'FINANCE_COLLECTION_SERVICE_ROLE_REQUIRED'; end if;
  begin
    v_operation:=(p_command->>'operationId')::uuid;
    v_target:=(p_command->>'reversalOfOperationId')::uuid;
  exception when others then
    return query select 'REJECT',null::text,array[]::text[],'FINANCE_COLLECTION_REVERSAL_UUID_INVALID',v_now;
    return;
  end;
  if v_tenant='' or v_company='' or v_branch='' or v_period='' or v_idem='' or
     v_reason_text='' or trim(coalesce(p_actor_user_id,''))='' or trim(coalesce(p_payload_hash,''))='' or
     v_operation=v_target or v_channel not in ('CASH','BANK','POS') then
    return query select 'REJECT',v_operation::text,array[]::text[],'FINANCE_COLLECTION_REVERSAL_REQUIRED_FIELD_INVALID',v_now;
    return;
  end if;

  insert into public.finance_operation_requests_v1(
    tenant_id,company_id,branch_id,accounting_period_id,idempotency_key,payload_hash,
    operation_id,outcome,actor_user_id
  ) values (v_tenant,v_company,v_branch,v_period,v_idem,p_payload_hash,v_operation::text,'PENDING',p_actor_user_id)
  on conflict do nothing;
  if not found then
    select * into v_existing from public.finance_operation_requests_v1 r
    where r.tenant_id=v_tenant and r.company_id=v_company and r.branch_id=v_branch
      and r.accounting_period_id=v_period and r.idempotency_key=v_idem for update;
    if v_existing.payload_hash is distinct from p_payload_hash then
      return query select 'CONFLICT',v_existing.operation_id,array[]::text[],'IDEMPOTENCY_PAYLOAD_CONFLICT',v_now;
    elsif v_existing.outcome='CREATED' then
      return query select 'REPLAY',v_existing.operation_id,
        coalesce(array(select jsonb_array_elements_text(v_existing.result_json->'transactionIds')),array[]::text[]),
        null::text,(v_existing.result_json->>'occurredAt')::timestamptz;
    elsif v_existing.outcome='REJECT' then
      return query select 'REJECT',v_existing.operation_id,array[]::text[],v_existing.result_json->>'reason',v_existing.completed_at;
    else
      return query select 'CONFLICT',v_existing.operation_id,array[]::text[],'FINANCE_COLLECTION_PENDING_CONFLICT',v_now;
    end if;
    return;
  end if;

  begin
    perform 1 from public.finance_collection_allocations_v1 a
    where a.tenant_id=v_tenant and a.company_id=v_company and a.branch_id=v_branch
      and a.accounting_period_id=v_period and a.operation_id=v_target
    order by a.open_item_id for update;
    if not found then raise exception 'FINANCE_COLLECTION_REVERSAL_ALLOCATION_NOT_FOUND'; end if;
    if exists (
      select 1 from public.finance_collection_allocations_v1 a
      where a.tenant_id=v_tenant and a.company_id=v_company and a.branch_id=v_branch
        and a.accounting_period_id=v_period and a.operation_id=v_target and a.reversed_at is not null
    ) then raise exception 'FINANCE_COLLECTION_ALREADY_REVERSED'; end if;
    if exists (
      select 1 from public.finance_transactions ft
      where ft.tenant_id=v_tenant and ft.company_id=v_company and ft.branch_id=v_branch
        and ft.accounting_period_id=v_period and ft.operation_group_id=v_target::text
        and ft.transaction_type='COLLECTION' and not (
          (v_channel='CASH' and ft.payment_method='CASH') or
          (v_channel='BANK' and ft.payment_method in ('EFT','BANK_TRANSFER')) or
          (v_channel='POS' and ft.payment_method='CREDIT_CARD')
        )
    ) then raise exception 'FINANCE_COLLECTION_REVERSAL_CHANNEL_MISMATCH'; end if;

    for v_transaction in
      select ft.* from public.finance_transactions ft
      where ft.tenant_id=v_tenant and ft.company_id=v_company and ft.branch_id=v_branch
        and ft.accounting_period_id=v_period and ft.operation_group_id=v_target::text
        and ft.transaction_type='COLLECTION'
      order by ft.transaction_id for update
    loop
      if v_transaction.status<>'POSTED' or v_transaction.reversed_at is not null then
        raise exception 'FINANCE_COLLECTION_REVERSAL_TARGET_INVALID';
      end if;
      if v_channel='POS' and not exists (
        select 1 from public.finance_pos_transactions_v1 pt
        where pt.tenant_id=v_tenant and pt.company_id=v_company and pt.branch_id=v_branch
          and pt.accounting_period_id=v_period and pt.collection_finance_transaction_id=v_transaction.transaction_id
          and pt.status='PENDING_SETTLEMENT' and pt.settled_amount=0 and pt.reversed_at is null
      ) then raise exception 'FINANCE_POS_COLLECTION_REVERSAL_STATE_INVALID'; end if;
      v_count:=v_count+1;
      v_reversal_id:=v_operation::text||':REV:'||v_count::text;
      insert into public.finance_transactions(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        transaction_type,direction,payment_method,finance_account_id,counter_account_id,
        customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
        gross_amount,commission_amount,net_amount,currency,transaction_date,value_date,due_date,
        status,description,external_reference,reversal_of_transaction_id,created_by,created_at,
        posted_at,projection_source,operation_group_id,operation_leg
      ) values (
        v_reversal_id,v_reversal_id,v_idem||':'||v_count::text,v_tenant,v_company,v_branch,v_period,
        'REVERSAL',case when v_transaction.direction='DEBIT' then 'CREDIT' else 'DEBIT' end,
        v_transaction.payment_method,v_transaction.finance_account_id,v_transaction.counter_account_id,
        v_transaction.customer_id,v_transaction.sale_id,v_transaction.counterparty_id,
        'REVERSAL:'||v_transaction.transaction_id,'MANUAL',v_transaction.gross_amount,
        v_transaction.commission_amount,v_transaction.net_amount,v_transaction.currency,current_date,
        v_transaction.value_date,v_transaction.due_date,'POSTED',v_reason_text,v_target::text,
        v_transaction.transaction_id,p_actor_user_id,v_now,v_now,'REVERSAL',v_operation::text,
        case when v_transaction.operation_leg='OUT' then 'REVERSAL_OUT'
             when v_transaction.operation_leg='IN' then 'REVERSAL_IN' else 'SINGLE' end
      );
      insert into public.finance_transaction_audits(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
      ) values ('audit:'||v_reversal_id,v_reversal_id,v_idem||':'||v_count::text,
        v_tenant,v_company,v_branch,v_period,'POSTED',p_actor_user_id,
        v_transaction.customer_id,v_transaction.sale_id,v_transaction.counterparty_id,v_now,p_payload_hash);
      update public.finance_transactions set status='REVERSED',reversed_at=v_now
      where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
        and accounting_period_id=v_period and transaction_id=v_transaction.transaction_id;
      if v_channel='POS' then
        update public.finance_pos_transactions_v1 set status='REVERSED',pending_amount=0,
          reversed_at=v_now,reversal_finance_transaction_id=v_reversal_id
        where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
          and accounting_period_id=v_period and collection_finance_transaction_id=v_transaction.transaction_id;
        update public.finance_pos_settlement_schedules_v1 set pending_amount=0,reversed_at=v_now
        where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
          and accounting_period_id=v_period and transaction_id=v_transaction.transaction_id::uuid;
        update public.finance_pos_settlement_lines_v1 set pending_amount=0,status='REVERSED',reversed_at=v_now
        where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
          and accounting_period_id=v_period and transaction_id=v_transaction.transaction_id::uuid;
      end if;
      v_transaction_ids:=array_append(v_transaction_ids,v_reversal_id);
    end loop;
    if v_count=0 then raise exception 'FINANCE_COLLECTION_REVERSAL_TRANSACTION_NOT_FOUND'; end if;

    for v_allocation in
      select a.* from public.finance_collection_allocations_v1 a
      where a.tenant_id=v_tenant and a.company_id=v_company and a.branch_id=v_branch
        and a.accounting_period_id=v_period and a.operation_id=v_target and a.reversed_at is null
      order by a.open_item_id
    loop
      update public.finance_receivable_open_items_v1 oi set
        allocated_amount=oi.allocated_amount-v_allocation.amount,
        status=case
          when oi.allocated_amount-v_allocation.amount=0 and oi.reserved_amount=0 then 'OPEN'
          else 'PARTIAL'
        end,
        updated_at=v_now
      where oi.id=v_allocation.open_item_id and oi.allocated_amount>=v_allocation.amount;
      if not found then raise exception 'FINANCE_COLLECTION_REVERSAL_OPEN_ITEM_CONFLICT'; end if;
      update public.finance_collection_allocations_v1 set reversed_at=v_now where id=v_allocation.id;
    end loop;

    update public.finance_operation_requests_v1 set outcome='CREATED',
      result_json=jsonb_build_object('transactionIds',to_jsonb(v_transaction_ids),'occurredAt',v_now),completed_at=v_now
    where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
      and accounting_period_id=v_period and idempotency_key=v_idem;
    return query select 'CREATED',v_operation::text,v_transaction_ids,null::text,v_now;
    return;
  exception when others then
    v_error:=case when sqlerrm ~ '^FINANCE_' then sqlerrm else 'FINANCE_COLLECTION_REVERSAL_PERSISTENCE_FAILED' end;
    update public.finance_operation_requests_v1 set outcome='REJECT',
      result_json=jsonb_build_object('reason',v_error),completed_at=clock_timestamp()
    where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
      and accounting_period_id=v_period and idempotency_key=v_idem;
    return query select 'REJECT',v_operation::text,array[]::text[],v_error,clock_timestamp();
    return;
  end;
end;
$function$;

revoke all on function public.reverse_finance_collection_v1(jsonb,text,text) from public,anon,authenticated;
grant execute on function public.reverse_finance_collection_v1(jsonb,text,text) to service_role;

create or replace function public.transition_finance_receivable_instrument_v1(
  p_command jsonb,p_actor_user_id text,p_payload_hash text
)
returns table(outcome text,operation_id text,transaction_ids text[],instrument_id text,reason text,occurred_at timestamptz)
language plpgsql
security definer
set search_path=pg_catalog,public
as $function$
declare
  v_tenant text:=trim(coalesce(p_command->>'tenantId',''));
  v_company text:=trim(coalesce(p_command->>'companyId',''));
  v_branch text:=trim(coalesce(p_command->>'branchId',''));
  v_period text:=trim(coalesce(p_command->>'accountingPeriodId',''));
  v_operation uuid;
  v_instrument_id uuid;
  v_bank_id uuid;
  v_deposit_bank_id uuid;
  v_idem text:=trim(coalesce(p_command->>'idempotencyKey',''));
  v_next text:=trim(coalesce(p_command->>'toState',''));
  v_claimed_from text:=trim(coalesce(p_command->>'fromState',''));
  v_type text:=trim(coalesce(p_command->>'instrumentType',''));
  v_reason_text text:=nullif(trim(coalesce(p_command->>'reason','')),'');
  v_counterparty text:=nullif(trim(coalesce(p_command->>'counterpartyId','')),'');
  v_counterparty_type text:=nullif(trim(coalesce(p_command->>'counterpartyType','')),'');
  v_now timestamptz:=clock_timestamp();
  v_existing public.finance_operation_requests_v1%rowtype;
  v_instrument public.finance_instruments_v1%rowtype;
  v_instrument_allocation public.finance_instrument_allocations_v1%rowtype;
  v_bank_ledger uuid;
  v_receivable_ledger uuid;
  v_portfolio_ledger uuid;
  v_collection_ledger uuid;
  v_payable_ledger uuid;
  v_bank_currency text;
  v_bank_name text;
  v_receivable_count integer;
  v_payable_balance numeric;
  v_payable_movement_id text;
  v_original_payable_movement_id text;
  v_allocation_sum numeric;
  v_tx text;
  v_transaction_ids text[]:=array[]::text[];
  v_error text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'FINANCE_INSTRUMENT_SERVICE_ROLE_REQUIRED'; end if;
  begin
    v_operation:=(p_command->>'operationId')::uuid;
    v_instrument_id:=(p_command->>'instrumentId')::uuid;
  exception when others then
    return query select 'REJECT',null::text,array[]::text[],null::text,'FINANCE_INSTRUMENT_TRANSITION_UUID_INVALID',v_now;
    return;
  end;
  if v_tenant='' or v_company='' or v_branch='' or v_period='' or v_idem='' or
     v_claimed_from not in ('PORTFOLIO','DEPOSITED','ENDORSED') or
     v_next not in ('DEPOSITED','ENDORSED','COLLECTED','RETURNED','CANCELLED') or v_type not in ('CHEQUE','NOTE') or
     trim(coalesce(p_actor_user_id,''))='' or trim(coalesce(p_payload_hash,''))='' then
    return query select 'REJECT',v_operation::text,array[]::text[],v_instrument_id::text,'FINANCE_INSTRUMENT_TRANSITION_REQUIRED_FIELD_INVALID',v_now;
    return;
  end if;

  insert into public.finance_operation_requests_v1(
    tenant_id,company_id,branch_id,accounting_period_id,idempotency_key,payload_hash,
    operation_id,outcome,actor_user_id
  ) values (v_tenant,v_company,v_branch,v_period,v_idem,p_payload_hash,v_operation::text,'PENDING',p_actor_user_id)
  on conflict do nothing;
  if not found then
    select * into v_existing from public.finance_operation_requests_v1 r
    where r.tenant_id=v_tenant and r.company_id=v_company and r.branch_id=v_branch
      and r.accounting_period_id=v_period and r.idempotency_key=v_idem for update;
    if v_existing.payload_hash is distinct from p_payload_hash then
      return query select 'CONFLICT',v_existing.operation_id,array[]::text[],v_instrument_id::text,'IDEMPOTENCY_PAYLOAD_CONFLICT',v_now;
    elsif v_existing.outcome='CREATED' then
      return query select 'REPLAY',v_existing.operation_id,
        coalesce(array(select jsonb_array_elements_text(v_existing.result_json->'transactionIds')),array[]::text[]),
        v_instrument_id::text,null::text,(v_existing.result_json->>'occurredAt')::timestamptz;
    elsif v_existing.outcome='REJECT' then
      return query select 'REJECT',v_existing.operation_id,array[]::text[],v_instrument_id::text,
        v_existing.result_json->>'reason',v_existing.completed_at;
    else
      return query select 'CONFLICT',v_existing.operation_id,array[]::text[],v_instrument_id::text,'FINANCE_INSTRUMENT_PENDING_CONFLICT',v_now;
    end if;
    return;
  end if;

  begin
    select * into v_instrument from public.finance_instruments_v1 i
    where i.id=v_instrument_id and i.tenant_id=v_tenant and i.company_id=v_company
      and i.branch_id=v_branch and i.accounting_period_id=v_period and i.direction='RECEIVABLE'
    for update;
    if not found then raise exception 'FINANCE_INSTRUMENT_NOT_FOUND'; end if;
    if v_instrument.instrument_type<>v_type then raise exception 'FINANCE_INSTRUMENT_TYPE_MISMATCH'; end if;
    if v_instrument.state<>v_claimed_from then raise exception 'FINANCE_INSTRUMENT_FROM_STATE_MISMATCH'; end if;
    if not (
      (v_instrument.state='PORTFOLIO' and v_next in ('DEPOSITED','ENDORSED','RETURNED','CANCELLED')) or
      (v_instrument.state='DEPOSITED' and v_next in ('COLLECTED','RETURNED')) or
      (v_instrument.state='ENDORSED' and v_next='RETURNED')
    ) then raise exception 'FINANCE_INSTRUMENT_STATE_TRANSITION_DENIED'; end if;
    if v_next in ('RETURNED','CANCELLED') and v_reason_text is null then
      raise exception 'FINANCE_INSTRUMENT_TRANSITION_REASON_REQUIRED';
    end if;
    if v_next='ENDORSED' and (v_counterparty is null or
       v_counterparty_type not in ('SUPPLIER','TAILOR','INSTALLER')) then
      raise exception 'FINANCE_INSTRUMENT_ENDORSE_COUNTERPARTY_REQUIRED';
    end if;

    if v_next in ('DEPOSITED','COLLECTED') or (v_next='RETURNED' and v_instrument.state='DEPOSITED') then
      begin v_bank_id:=(p_command->>'bankAccountId')::uuid;
      exception when others then raise exception 'FINANCE_INSTRUMENT_BANK_ACCOUNT_UUID_REQUIRED'; end;
      select ba.ledger_account_id,ba.currency,ba.bank_name into v_bank_ledger,v_bank_currency,v_bank_name
      from public.bank_accounts ba where ba.id=v_bank_id and ba.tenant_id=v_tenant and ba.company_id=v_company
        and ba.branch_id=v_branch and ba.accounting_period_id=v_period and ba.is_active and ba.archived_at is null
      for update;
      if not found or v_bank_currency<>v_instrument.currency then
        raise exception 'FINANCE_INSTRUMENT_BANK_SCOPE_OR_CURRENCY_INVALID';
      end if;
      if v_next='COLLECTED' then
        select e.bank_account_id into v_deposit_bank_id
        from public.finance_instrument_events_v1 e
        where e.instrument_id=v_instrument_id and e.tenant_id=v_tenant and e.company_id=v_company
          and e.branch_id=v_branch and e.accounting_period_id=v_period and e.to_state='DEPOSITED'
        order by e.occurred_at desc,e.id desc limit 1;
        if v_deposit_bank_id is null or v_deposit_bank_id<>v_bank_id then
          raise exception 'FINANCE_INSTRUMENT_COLLECTION_BANK_MISMATCH';
        end if;
      end if;
    end if;

    select count(*),(array_agg(fa.id order by fa.id::text))[1] into v_receivable_count,v_portfolio_ledger
    from public.finance_accounts fa where fa.tenant_id=v_tenant and fa.company_id=v_company
      and fa.branch_id=v_branch and fa.accounting_period_id=v_period and fa.currency=v_instrument.currency
      and fa.account_type=case when v_type='CHEQUE' then 'CHEQUE_RECEIVABLE' else 'NOTE_RECEIVABLE' end
      and fa.is_active and fa.archived_at is null;
    if v_receivable_count<>1 then raise exception 'FINANCE_INSTRUMENT_PORTFOLIO_ACCOUNT_NOT_UNIQUE'; end if;
    select coalesce(sum(ia.amount),0) into v_allocation_sum
    from public.finance_instrument_allocations_v1 ia
    where ia.instrument_id=v_instrument_id and ia.tenant_id=v_tenant and ia.company_id=v_company
      and ia.branch_id=v_branch and ia.accounting_period_id=v_period and ia.state='ALLOCATED';
    if v_allocation_sum is distinct from v_instrument.amount then
      raise exception 'FINANCE_INSTRUMENT_NOMINAL_ALLOCATION_MISMATCH';
    end if;

    if v_next in ('DEPOSITED','COLLECTED') then
      select count(*),(array_agg(fa.id order by fa.id::text))[1] into v_receivable_count,v_collection_ledger
      from public.finance_accounts fa where fa.tenant_id=v_tenant and fa.company_id=v_company
        and fa.branch_id=v_branch and fa.accounting_period_id=v_period and fa.currency=v_instrument.currency
        and fa.account_type=case when v_type='CHEQUE' then 'CHEQUE_IN_COLLECTION' else 'NOTE_IN_COLLECTION' end
        and fa.is_active and fa.archived_at is null;
      if v_receivable_count<>1 then raise exception 'FINANCE_INSTRUMENT_COLLECTION_ACCOUNT_NOT_UNIQUE'; end if;
    end if;

    if v_next='DEPOSITED' then
      v_tx:=v_operation::text;
      insert into public.finance_transactions(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        transaction_type,direction,payment_method,finance_account_id,counter_account_id,
        customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
        gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
        created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
      ) values (v_tx,v_tx,v_idem,v_tenant,v_company,v_branch,v_period,'TRANSFER','DEBIT',
        case when v_type='CHEQUE' then 'CHEQUE' else 'PROMISSORY_NOTE' end,
        v_collection_ledger::text,v_portfolio_ledger::text,v_instrument.customer_id,null,null,
        v_instrument.id::text,case when v_type='CHEQUE' then 'CHEQUE' else 'NOTE' end,
        v_instrument.amount,0,v_instrument.amount,v_instrument.currency,current_date,'POSTED',
        v_bank_name||' – tahsile verilen '||case when v_type='CHEQUE' then 'çek' else 'senet' end,
        p_actor_user_id,v_now,v_now,'MANUAL',v_operation::text,'OUT');
      insert into public.finance_transaction_audits(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
      ) values ('audit:'||v_tx,v_tx,v_idem,v_tenant,v_company,v_branch,v_period,'POSTED',
        p_actor_user_id,v_instrument.customer_id,null,null,v_now,p_payload_hash);
      v_transaction_ids:=array_append(v_transaction_ids,v_tx);
    end if;

    if v_next='COLLECTED' then
      v_tx:=v_operation::text;
      insert into public.finance_transactions(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        transaction_type,direction,payment_method,finance_account_id,counter_account_id,
        customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
        gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
        created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
      ) values (
        v_tx,v_tx,v_idem,v_tenant,v_company,v_branch,v_period,'TRANSFER','DEBIT',
        case when v_instrument.instrument_type='CHEQUE' then 'CHEQUE' else 'PROMISSORY_NOTE' end,
        v_bank_ledger::text,v_collection_ledger::text,v_instrument.customer_id,null,null,
        v_instrument.id::text,case when v_instrument.instrument_type='CHEQUE' then 'CHEQUE' else 'NOTE' end,
        v_instrument.amount,0,v_instrument.amount,v_instrument.currency,current_date,'POSTED',
        v_bank_name||' – '||case when v_instrument.instrument_type='CHEQUE' then 'çek tahsilatı' else 'senet tahsilatı' end,
        p_actor_user_id,v_now,v_now,'TRANSFER',v_operation::text,'IN'
      );
      insert into public.finance_transaction_audits(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
      ) values ('audit:'||v_tx,v_tx,v_idem,v_tenant,v_company,v_branch,v_period,'POSTED',
        p_actor_user_id,v_instrument.customer_id,null,null,v_now,p_payload_hash);

      v_transaction_ids:=array_append(v_transaction_ids,v_tx);
    elsif v_next='ENDORSED' then
      perform 1 from public.counterparty_payable_movements pm
      where pm.tenant_id=v_tenant and pm.company_id=v_company and pm.branch_id=v_branch
        and pm.accounting_period_id=v_period and pm.counterparty_customer_id=v_counterparty
        and pm.counterparty_type=v_counterparty_type and pm.currency=v_instrument.currency
      order by pm.occurred_at,pm.movement_id for update;
      select coalesce(sum(case
        when pm.movement_kind='ACCRUAL' then pm.amount
        when pm.movement_kind='PAYMENT' then -pm.amount
        when original.movement_kind='ACCRUAL' then -pm.amount
        when original.movement_kind='PAYMENT' then pm.amount
        else 0 end),0)
      into v_payable_balance
      from public.counterparty_payable_movements pm
      left join public.counterparty_payable_movements original
        on original.movement_id=pm.reversal_of_movement_id
      where pm.tenant_id=v_tenant and pm.company_id=v_company and pm.branch_id=v_branch
        and pm.accounting_period_id=v_period and pm.counterparty_customer_id=v_counterparty
        and pm.counterparty_type=v_counterparty_type and pm.currency=v_instrument.currency;
      if v_payable_balance<v_instrument.amount then
        raise exception 'FINANCE_INSTRUMENT_ENDORSE_EXCEEDS_COUNTERPARTY_PAYABLE';
      end if;
      select count(*),(array_agg(fa.id order by fa.id::text))[1] into v_receivable_count,v_payable_ledger
      from public.finance_accounts fa where fa.tenant_id=v_tenant and fa.company_id=v_company
        and fa.branch_id=v_branch and fa.accounting_period_id=v_period and fa.currency=v_instrument.currency
        and fa.account_type='CUSTOMER_PAYABLE' and fa.is_active and fa.archived_at is null;
      if v_receivable_count<>1 then raise exception 'FINANCE_COUNTERPARTY_PAYABLE_ACCOUNT_NOT_UNIQUE'; end if;
      v_payable_movement_id:='instrument-payment:'||v_operation::text;
      insert into public.counterparty_payable_movements(
        movement_id,tenant_id,company_id,branch_id,accounting_period_id,idempotency_key,
        counterparty_customer_id,counterparty_type,movement_kind,amount,currency,
        occurred_at,recorded_at,source_document_id,operation_id,source_payment_id,note,created_by_user_id
      ) values (v_payable_movement_id,v_tenant,v_company,v_branch,v_period,v_idem||':payable',
        v_counterparty,v_counterparty_type,'PAYMENT',v_instrument.amount,v_instrument.currency,
        v_now,v_now,v_instrument.id::text,v_operation::text,v_instrument.id::text,
        'Ciro edilen '||case when v_type='CHEQUE' then 'çek' else 'senet' end,p_actor_user_id);
      insert into public.counterparty_payable_audits(
        movement_id,tenant_id,company_id,branch_id,accounting_period_id,actor_user_id,action,occurred_at,payload
      ) values (v_payable_movement_id,v_tenant,v_company,v_branch,v_period,p_actor_user_id,'CREATE',v_now,
        jsonb_build_object('instrumentId',v_instrument.id,'payloadHash',p_payload_hash));
      v_tx:=v_operation::text;
      insert into public.finance_transactions(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        transaction_type,direction,payment_method,finance_account_id,counter_account_id,
        customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
        gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
        created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
      ) values (v_tx,v_tx,v_idem,v_tenant,v_company,v_branch,v_period,'PAYMENT','DEBIT',
        case when v_type='CHEQUE' then 'CHEQUE' else 'PROMISSORY_NOTE' end,
        v_payable_ledger::text,v_portfolio_ledger::text,null,null,v_counterparty,v_instrument.id::text,
        case when v_type='CHEQUE' then 'CHEQUE' else 'NOTE' end,v_instrument.amount,0,v_instrument.amount,
        v_instrument.currency,current_date,'POSTED','Ciro ile borç kapama',p_actor_user_id,v_now,v_now,
        'MANUAL',v_operation::text,'SINGLE');
      insert into public.finance_transaction_audits(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
      ) values ('audit:'||v_tx,v_tx,v_idem,v_tenant,v_company,v_branch,v_period,'POSTED',
        p_actor_user_id,null,null,v_counterparty,v_now,p_payload_hash);
      v_transaction_ids:=array_append(v_transaction_ids,v_tx);
    elsif v_next in ('RETURNED','CANCELLED') then
      select count(*),(array_agg(fa.id order by fa.id::text))[1] into v_receivable_count,v_receivable_ledger
      from public.finance_accounts fa where fa.tenant_id=v_tenant and fa.company_id=v_company
        and fa.branch_id=v_branch and fa.accounting_period_id=v_period and fa.currency=v_instrument.currency
        and fa.account_type='CUSTOMER_RECEIVABLE' and fa.is_active and fa.archived_at is null;
      if v_receivable_count<>1 then raise exception 'FINANCE_CUSTOMER_RECEIVABLE_ACCOUNT_NOT_UNIQUE'; end if;
      if v_instrument.state='ENDORSED' then
        select count(*),(array_agg(fa.id order by fa.id::text))[1] into v_receivable_count,v_payable_ledger
        from public.finance_accounts fa where fa.tenant_id=v_tenant and fa.company_id=v_company
          and fa.branch_id=v_branch and fa.accounting_period_id=v_period and fa.currency=v_instrument.currency
          and fa.account_type='CUSTOMER_PAYABLE' and fa.is_active and fa.archived_at is null;
        if v_receivable_count<>1 then raise exception 'FINANCE_COUNTERPARTY_PAYABLE_ACCOUNT_NOT_UNIQUE'; end if;
        select pm.movement_id into v_original_payable_movement_id
        from public.counterparty_payable_movements pm
        where pm.tenant_id=v_tenant and pm.company_id=v_company and pm.branch_id=v_branch
          and pm.accounting_period_id=v_period and pm.source_document_id=v_instrument.id::text
          and pm.movement_kind='PAYMENT'
        order by pm.created_at desc limit 1 for update;
        if not found then raise exception 'FINANCE_INSTRUMENT_ENDORSE_PAYMENT_NOT_FOUND'; end if;
        v_payable_movement_id:='instrument-payment-reversal:'||v_operation::text;
        insert into public.counterparty_payable_movements(
          movement_id,tenant_id,company_id,branch_id,accounting_period_id,idempotency_key,
          counterparty_customer_id,counterparty_type,movement_kind,amount,currency,
          occurred_at,recorded_at,source_document_id,operation_id,source_payment_id,
          reversal_of_movement_id,note,created_by_user_id
        ) select v_payable_movement_id,v_tenant,v_company,v_branch,v_period,v_idem||':payable-reversal',
          pm.counterparty_customer_id,pm.counterparty_type,'REVERSAL',pm.amount,pm.currency,
          v_now,v_now,v_instrument.id::text,v_operation::text,v_instrument.id::text,pm.movement_id,
          'Ciro edilen evrak iade/karşılıksız ters kaydı',p_actor_user_id
        from public.counterparty_payable_movements pm where pm.movement_id=v_original_payable_movement_id;
        insert into public.counterparty_payable_audits(
          movement_id,tenant_id,company_id,branch_id,accounting_period_id,actor_user_id,action,occurred_at,payload
        ) values (v_payable_movement_id,v_tenant,v_company,v_branch,v_period,p_actor_user_id,'CREATE',v_now,
          jsonb_build_object('instrumentId',v_instrument.id,'payloadHash',p_payload_hash,'reversal',true));

        v_tx:=v_operation::text||':endorse-reversal';
        insert into public.finance_transactions(
          id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
          transaction_type,direction,payment_method,finance_account_id,counter_account_id,
          customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
          gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
          created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
        ) values (v_tx,v_tx,v_idem||':endorse-reversal',v_tenant,v_company,v_branch,v_period,'REVERSAL','DEBIT',
          case when v_type='CHEQUE' then 'CHEQUE' else 'PROMISSORY_NOTE' end,
          v_portfolio_ledger::text,v_payable_ledger::text,null,null,v_instrument.counterparty_id,
          v_instrument.id::text,case when v_type='CHEQUE' then 'CHEQUE' else 'NOTE' end,
          v_instrument.amount,0,v_instrument.amount,v_instrument.currency,current_date,'POSTED',
          'Ciro iade/karşılıksız ters kaydı',p_actor_user_id,v_now,v_now,'REVERSAL',v_operation::text,'REVERSAL_OUT');
        insert into public.finance_transaction_audits(
          id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
          action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
        ) values ('audit:'||v_tx,v_tx,v_idem||':endorse-reversal',v_tenant,v_company,v_branch,v_period,
          'POSTED',p_actor_user_id,null,null,v_instrument.counterparty_id,v_now,p_payload_hash);
        v_transaction_ids:=array_append(v_transaction_ids,v_tx);
      end if;
      for v_instrument_allocation in
        select ia.* from public.finance_instrument_allocations_v1 ia
        where ia.instrument_id=v_instrument_id and ia.tenant_id=v_tenant and ia.company_id=v_company
          and ia.branch_id=v_branch and ia.accounting_period_id=v_period and ia.state='ALLOCATED'
        order by ia.open_item_id for update
      loop
        update public.finance_receivable_open_items_v1 oi set
          allocated_amount=oi.allocated_amount-v_instrument_allocation.amount,
          status=case when oi.allocated_amount-v_instrument_allocation.amount=0 and oi.reserved_amount=0
            then 'OPEN' else 'PARTIAL' end,updated_at=v_now
        where oi.id=v_instrument_allocation.open_item_id and oi.allocated_amount>=v_instrument_allocation.amount;
        if not found then raise exception 'FINANCE_INSTRUMENT_RELEASE_CONFLICT'; end if;
        update public.finance_instrument_allocations_v1 set state='RELEASED',updated_at=v_now
        where id=v_instrument_allocation.id;
        update public.finance_collection_allocations_v1 ca set reversed_at=v_now
        where ca.open_item_id=v_instrument_allocation.open_item_id and ca.reversed_at is null
          and ca.transaction_id in (
            select ft.transaction_id from public.finance_transactions ft
            where ft.tenant_id=v_tenant and ft.company_id=v_company and ft.branch_id=v_branch
              and ft.accounting_period_id=v_period and ft.source_document_id=v_instrument.id::text
              and ft.transaction_type='COLLECTION'
          );
      end loop;
      v_tx:=v_operation::text||':customer-return';
      insert into public.finance_transactions(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        transaction_type,direction,payment_method,finance_account_id,counter_account_id,
        customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
        gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
        created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
      ) values (v_tx,v_tx,v_idem||':customer-return',v_tenant,v_company,v_branch,v_period,'REVERSAL','DEBIT',
        case when v_type='CHEQUE' then 'CHEQUE' else 'PROMISSORY_NOTE' end,
        v_receivable_ledger::text,
        case when v_instrument.state='DEPOSITED' then v_collection_ledger::text else v_portfolio_ledger::text end,
        v_instrument.customer_id,null,v_instrument.counterparty_id,v_instrument.id::text,
        case when v_type='CHEQUE' then 'CHEQUE' else 'NOTE' end,v_instrument.amount,0,v_instrument.amount,
        v_instrument.currency,current_date,'POSTED',coalesce(v_reason_text,'Evrak iade/iptal ters kaydı'),
        p_actor_user_id,v_now,v_now,'MANUAL',v_operation::text,'REVERSAL_IN');
      insert into public.finance_transaction_audits(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
      ) values ('audit:'||v_tx,v_tx,v_idem||':customer-return',v_tenant,v_company,v_branch,v_period,
        'POSTED',p_actor_user_id,v_instrument.customer_id,null,v_instrument.counterparty_id,v_now,p_payload_hash);
      v_transaction_ids:=array_append(v_transaction_ids,v_tx);
    end if;

    update public.finance_instruments_v1 set state=v_next,
      counterparty_id=case when v_next='ENDORSED' then v_counterparty else counterparty_id end,
      updated_at=v_now where id=v_instrument_id;
    insert into public.finance_instrument_events_v1(
      id,instrument_id,tenant_id,company_id,branch_id,accounting_period_id,from_state,to_state,
      bank_account_id,counterparty_id,reason,actor_user_id,occurred_at,payload_hash
    ) values (gen_random_uuid(),v_instrument_id,v_tenant,v_company,v_branch,v_period,
      v_instrument.state,v_next,v_bank_id,v_counterparty,v_reason_text,p_actor_user_id,v_now,p_payload_hash);
    update public.finance_operation_requests_v1 set outcome='CREATED',
      result_json=jsonb_build_object('transactionIds',to_jsonb(v_transaction_ids),'instrumentId',v_instrument_id::text,'occurredAt',v_now),
      completed_at=v_now
    where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
      and accounting_period_id=v_period and idempotency_key=v_idem;
    return query select 'CREATED',v_operation::text,v_transaction_ids,v_instrument_id::text,null::text,v_now;
    return;
  exception when others then
    v_error:=case when sqlerrm ~ '^FINANCE_' then sqlerrm else 'FINANCE_INSTRUMENT_TRANSITION_PERSISTENCE_FAILED' end;
    update public.finance_operation_requests_v1 set outcome='REJECT',
      result_json=jsonb_build_object('reason',v_error),completed_at=clock_timestamp()
    where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
      and accounting_period_id=v_period and idempotency_key=v_idem;
    return query select 'REJECT',v_operation::text,array[]::text[],v_instrument_id::text,v_error,clock_timestamp();
    return;
  end;
end;
$function$;

revoke all on function public.transition_finance_receivable_instrument_v1(jsonb,text,text) from public,anon,authenticated;
grant execute on function public.transition_finance_receivable_instrument_v1(jsonb,text,text) to service_role;

commit;
