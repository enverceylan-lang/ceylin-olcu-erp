-- ENVerp Finance V1-A Account Master Foundation
-- Canonical boundary:
--   finance_accounts = ledger/muhasebe hesaplari
--   cash_accounts    = operasyonel kasa kimligi
--   bank_accounts    = operasyonel banka hesabi
--   pos_accounts     = operasyonel POS kimligi
-- No balance columns. Balances are derived from posted movements/journal.
-- No physical delete. Archive/inactivate only.

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,

  code text not null,
  name text not null,
  account_type text not null,
  currency text not null,

  is_active boolean not null default true,
  is_default_collection boolean not null default false,
  is_default_payment boolean not null default false,

  linked_bank_account_id uuid null,
  linked_pos_account_id uuid null,

  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,

  constraint finance_accounts_scope_nonblank_chk check (
    btrim(tenant_id) <> '' and
    btrim(company_id) <> '' and
    btrim(branch_id) <> '' and
    btrim(accounting_period_id) <> ''
  ),
  constraint finance_accounts_code_nonblank_chk check (btrim(code) <> ''),
  constraint finance_accounts_name_nonblank_chk check (btrim(name) <> ''),
  constraint finance_accounts_type_chk check (
    account_type in (
      'CASH','BANK','POS',
      'CUSTOMER_RECEIVABLE','CUSTOMER_PAYABLE',
      'CHEQUE_RECEIVABLE','CHEQUE_PAYABLE',
      'NOTE_RECEIVABLE','NOTE_PAYABLE',
      'CLEARING','OTHER'
    )
  ),
  constraint finance_accounts_currency_chk check (currency ~ '^[A-Z]{3}$'),
  constraint finance_accounts_archive_state_chk check (
    (is_active = true and archived_at is null) or
    (is_active = false and archived_at is not null)
  ),
  constraint finance_accounts_scope_code_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, code
  ),
  constraint finance_accounts_scope_id_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, id
  )
);

create table if not exists public.cash_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,

  cash_code text not null,
  cash_name text not null,
  ledger_account_id uuid not null,
  currency text not null,

  is_active boolean not null default true,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,

  constraint cash_accounts_scope_nonblank_chk check (
    btrim(tenant_id) <> '' and
    btrim(company_id) <> '' and
    btrim(branch_id) <> '' and
    btrim(accounting_period_id) <> ''
  ),
  constraint cash_accounts_code_nonblank_chk check (btrim(cash_code) <> ''),
  constraint cash_accounts_name_nonblank_chk check (btrim(cash_name) <> ''),
  constraint cash_accounts_currency_chk check (currency ~ '^[A-Z]{3}$'),
  constraint cash_accounts_archive_state_chk check (
    (is_active = true and archived_at is null) or
    (is_active = false and archived_at is not null)
  ),
  constraint cash_accounts_scope_code_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, cash_code
  ),
  constraint cash_accounts_scope_id_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint cash_accounts_ledger_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, ledger_account_id
  ) references public.finance_accounts (
    tenant_id, company_id, branch_id, accounting_period_id, id
  )
);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,

  bank_code text not null,
  bank_name text not null,
  account_name text not null,
  branch_name text null,
  iban text null,
  account_number text null,
  ledger_account_id uuid not null,
  currency text not null,

  is_active boolean not null default true,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,

  constraint bank_accounts_scope_nonblank_chk check (
    btrim(tenant_id) <> '' and
    btrim(company_id) <> '' and
    btrim(branch_id) <> '' and
    btrim(accounting_period_id) <> ''
  ),
  constraint bank_accounts_code_nonblank_chk check (btrim(bank_code) <> ''),
  constraint bank_accounts_bank_name_nonblank_chk check (btrim(bank_name) <> ''),
  constraint bank_accounts_account_name_nonblank_chk check (btrim(account_name) <> ''),
  constraint bank_accounts_currency_chk check (currency ~ '^[A-Z]{3}$'),
  constraint bank_accounts_archive_state_chk check (
    (is_active = true and archived_at is null) or
    (is_active = false and archived_at is not null)
  ),
  constraint bank_accounts_scope_code_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, bank_code
  ),
  constraint bank_accounts_scope_id_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint bank_accounts_ledger_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, ledger_account_id
  ) references public.finance_accounts (
    tenant_id, company_id, branch_id, accounting_period_id, id
  )
);

create table if not exists public.pos_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,

  pos_code text not null,
  pos_name text not null,
  bank_account_id uuid not null,
  clearing_ledger_account_id uuid not null,
  kind text not null,
  merchant_number text null,
  terminal_number text null,
  currency text not null,

  is_active boolean not null default true,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,

  constraint pos_accounts_scope_nonblank_chk check (
    btrim(tenant_id) <> '' and
    btrim(company_id) <> '' and
    btrim(branch_id) <> '' and
    btrim(accounting_period_id) <> ''
  ),
  constraint pos_accounts_code_nonblank_chk check (btrim(pos_code) <> ''),
  constraint pos_accounts_name_nonblank_chk check (btrim(pos_name) <> ''),
  constraint pos_accounts_kind_chk check (
    kind in ('PHYSICAL','VIRTUAL','MOBILE','PAYMENT_LINK')
  ),
  constraint pos_accounts_currency_chk check (currency ~ '^[A-Z]{3}$'),
  constraint pos_accounts_archive_state_chk check (
    (is_active = true and archived_at is null) or
    (is_active = false and archived_at is not null)
  ),
  constraint pos_accounts_scope_code_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, pos_code
  ),
  constraint pos_accounts_scope_id_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint pos_accounts_bank_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, bank_account_id
  ) references public.bank_accounts (
    tenant_id, company_id, branch_id, accounting_period_id, id
  ),
  constraint pos_accounts_clearing_ledger_fk foreign key (
    tenant_id, company_id, branch_id, accounting_period_id, clearing_ledger_account_id
  ) references public.finance_accounts (
    tenant_id, company_id, branch_id, accounting_period_id, id
  )
);

create table if not exists public.finance_account_master_operations (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,

  idempotency_key text not null,
  payload_hash text not null,
  action text not null,
  account_kind text not null,

  finance_account_id uuid null,
  operational_account_id uuid null,
  outcome text not null,
  actor_user_id text not null,
  created_at timestamptz not null default now(),

  constraint finance_account_master_operations_scope_nonblank_chk check (
    btrim(tenant_id) <> '' and
    btrim(company_id) <> '' and
    btrim(branch_id) <> '' and
    btrim(accounting_period_id) <> ''
  ),
  constraint finance_account_master_operations_idempotency_nonblank_chk check (
    btrim(idempotency_key) <> ''
  ),
  constraint finance_account_master_operations_payload_hash_nonblank_chk check (
    btrim(payload_hash) <> ''
  ),
  constraint finance_account_master_operations_action_chk check (
    action in ('CREATE','ARCHIVE')
  ),
  constraint finance_account_master_operations_kind_chk check (
    account_kind in ('CASH','BANK','POS')
  ),
  constraint finance_account_master_operations_scope_idempotency_uk unique (
    tenant_id, company_id, branch_id, accounting_period_id, idempotency_key
  )
);

create index if not exists finance_accounts_scope_idx
  on public.finance_accounts (tenant_id, company_id, branch_id, accounting_period_id);

create index if not exists cash_accounts_scope_idx
  on public.cash_accounts (tenant_id, company_id, branch_id, accounting_period_id);

create index if not exists bank_accounts_scope_idx
  on public.bank_accounts (tenant_id, company_id, branch_id, accounting_period_id);

create index if not exists pos_accounts_scope_idx
  on public.pos_accounts (tenant_id, company_id, branch_id, accounting_period_id);

alter table public.finance_accounts enable row level security;
alter table public.finance_accounts force row level security;
alter table public.cash_accounts enable row level security;
alter table public.cash_accounts force row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_accounts force row level security;
alter table public.pos_accounts enable row level security;
alter table public.pos_accounts force row level security;
alter table public.finance_account_master_operations enable row level security;
alter table public.finance_account_master_operations force row level security;

revoke all on public.finance_accounts from public, anon, authenticated;
revoke all on public.cash_accounts from public, anon, authenticated;
revoke all on public.bank_accounts from public, anon, authenticated;
revoke all on public.pos_accounts from public, anon, authenticated;
revoke all on public.finance_account_master_operations from public, anon, authenticated;

grant select, insert, update on public.finance_accounts to service_role;
grant select, insert, update on public.cash_accounts to service_role;
grant select, insert, update on public.bank_accounts to service_role;
grant select, insert, update on public.pos_accounts to service_role;
grant select, insert on public.finance_account_master_operations to service_role;

revoke delete on public.finance_accounts from service_role;
revoke delete on public.cash_accounts from service_role;
revoke delete on public.bank_accounts from service_role;
revoke delete on public.pos_accounts from service_role;
revoke update, delete on public.finance_account_master_operations from service_role;

create or replace function public.manage_finance_account_master_v1(
  p_action text,
  p_kind text,
  p_scope jsonb,
  p_payload jsonb,
  p_actor_user_id text,
  p_idempotency_key text,
  p_payload_hash text
)
returns table (
  outcome text,
  finance_account_id uuid,
  operational_account_id uuid,
  reason text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_action text := upper(trim(coalesce(p_action,'')));
  v_kind text := upper(trim(coalesce(p_kind,'')));
  v_tenant text := trim(coalesce(p_scope->>'tenant_id',''));
  v_company text := trim(coalesce(p_scope->>'company_id',''));
  v_branch text := trim(coalesce(p_scope->>'branch_id',''));
  v_period text := trim(coalesce(p_scope->>'accounting_period_id',''));

  v_existing_op public.finance_account_master_operations%rowtype;
  v_finance_id uuid;
  v_operational_id uuid;
  v_target_finance_id uuid;
  v_bank public.bank_accounts%rowtype;

  v_code text;
  v_name text;
  v_currency text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FINANCE_ACCOUNT_MASTER_FORBIDDEN:SERVICE_ROLE_REQUIRED';
  end if;

  if jsonb_typeof(p_scope) is distinct from 'object' or
     jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'FINANCE_ACCOUNT_MASTER_INVALID_PAYLOAD';
  end if;

  if v_tenant = '' or v_company = '' or v_branch = '' or v_period = '' then
    raise exception 'FINANCE_ACCOUNT_MASTER_SCOPE_REQUIRED';
  end if;

  if trim(coalesce(p_actor_user_id,'')) = '' then
    raise exception 'FINANCE_ACCOUNT_MASTER_ACTOR_REQUIRED';
  end if;

  if trim(coalesce(p_idempotency_key,'')) = '' then
    raise exception 'FINANCE_ACCOUNT_MASTER_IDEMPOTENCY_REQUIRED';
  end if;

  if trim(coalesce(p_payload_hash,'')) = '' then
    raise exception 'FINANCE_ACCOUNT_MASTER_PAYLOAD_HASH_REQUIRED';
  end if;

  if v_action not in ('CREATE','ARCHIVE') then
    raise exception 'FINANCE_ACCOUNT_MASTER_ACTION_UNSUPPORTED';
  end if;

  if v_kind not in ('CASH','BANK','POS') then
    raise exception 'FINANCE_ACCOUNT_MASTER_KIND_UNSUPPORTED';
  end if;

  select op.*
  into v_existing_op
  from public.finance_account_master_operations as op
  where op.tenant_id = v_tenant
    and op.company_id = v_company
    and op.branch_id = v_branch
    and op.accounting_period_id = v_period
    and op.idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_existing_op.payload_hash is distinct from p_payload_hash or
       v_existing_op.action is distinct from v_action or
       v_existing_op.account_kind is distinct from v_kind then
      return query
      select
        'CONFLICT',
        v_existing_op.finance_account_id,
        v_existing_op.operational_account_id,
        'FINANCE_ACCOUNT_MASTER_IDEMPOTENCY_CONFLICT';
      return;
    end if;

    return query
    select
      'REPLAY',
      v_existing_op.finance_account_id,
      v_existing_op.operational_account_id,
      null::text;
    return;
  end if;

  if v_action = 'CREATE' then
    v_code := trim(coalesce(p_payload->>'ledger_code',''));
    v_name := trim(coalesce(p_payload->>'ledger_name',''));
    v_currency := upper(trim(coalesce(p_payload->>'currency','')));

    if v_code = '' or v_name = '' or v_currency = '' then
      raise exception 'FINANCE_ACCOUNT_MASTER_LEDGER_FIELDS_REQUIRED';
    end if;

    insert into public.finance_accounts (
      tenant_id, company_id, branch_id, accounting_period_id,
      code, name, account_type, currency,
      is_active, is_default_collection, is_default_payment,
      created_by, updated_by
    )
    values (
      v_tenant, v_company, v_branch, v_period,
      v_code, v_name, v_kind, v_currency,
      true,
      coalesce((p_payload->>'is_default_collection')::boolean,false),
      coalesce((p_payload->>'is_default_payment')::boolean,false),
      p_actor_user_id, p_actor_user_id
    )
    returning id into v_finance_id;

    if v_kind = 'CASH' then
      if trim(coalesce(p_payload->>'cash_code','')) = '' or
         trim(coalesce(p_payload->>'cash_name','')) = '' then
        raise exception 'FINANCE_CASH_MASTER_FIELDS_REQUIRED';
      end if;

      insert into public.cash_accounts (
        tenant_id, company_id, branch_id, accounting_period_id,
        cash_code, cash_name, ledger_account_id, currency,
        created_by, updated_by
      )
      values (
        v_tenant, v_company, v_branch, v_period,
        trim(p_payload->>'cash_code'),
        trim(p_payload->>'cash_name'),
        v_finance_id,
        v_currency,
        p_actor_user_id,
        p_actor_user_id
      )
      returning id into v_operational_id;

    elsif v_kind = 'BANK' then
      if trim(coalesce(p_payload->>'bank_code','')) = '' or
         trim(coalesce(p_payload->>'bank_name','')) = '' or
         trim(coalesce(p_payload->>'account_name','')) = '' then
        raise exception 'FINANCE_BANK_MASTER_FIELDS_REQUIRED';
      end if;

      insert into public.bank_accounts (
        tenant_id, company_id, branch_id, accounting_period_id,
        bank_code, bank_name, account_name, branch_name,
        iban, account_number, ledger_account_id, currency,
        created_by, updated_by
      )
      values (
        v_tenant, v_company, v_branch, v_period,
        trim(p_payload->>'bank_code'),
        trim(p_payload->>'bank_name'),
        trim(p_payload->>'account_name'),
        nullif(trim(coalesce(p_payload->>'branch_name','')),''),
        nullif(trim(coalesce(p_payload->>'iban','')),''),
        nullif(trim(coalesce(p_payload->>'account_number','')),''),
        v_finance_id,
        v_currency,
        p_actor_user_id,
        p_actor_user_id
      )
      returning id into v_operational_id;

    else
      if trim(coalesce(p_payload->>'pos_code','')) = '' or
         trim(coalesce(p_payload->>'pos_name','')) = '' or
         trim(coalesce(p_payload->>'bank_account_id','')) = '' or
         upper(trim(coalesce(p_payload->>'kind',''))) not in (
           'PHYSICAL','VIRTUAL','MOBILE','PAYMENT_LINK'
         ) then
        raise exception 'FINANCE_POS_MASTER_FIELDS_REQUIRED';
      end if;

      begin
        v_operational_id := (p_payload->>'bank_account_id')::uuid;
      exception when others then
        raise exception 'FINANCE_POS_BANK_ACCOUNT_ID_INVALID';
      end;

      select ba.*
      into v_bank
      from public.bank_accounts as ba
      where ba.id = v_operational_id
        and ba.tenant_id = v_tenant
        and ba.company_id = v_company
        and ba.branch_id = v_branch
        and ba.accounting_period_id = v_period
        and ba.is_active = true
      for update;

      if not found then
        raise exception 'FINANCE_POS_BANK_ACCOUNT_NOT_FOUND';
      end if;

      if v_bank.currency is distinct from v_currency then
        raise exception 'FINANCE_POS_BANK_CURRENCY_MISMATCH';
      end if;

      insert into public.pos_accounts (
        tenant_id, company_id, branch_id, accounting_period_id,
        pos_code, pos_name, bank_account_id, clearing_ledger_account_id,
        kind, merchant_number, terminal_number, currency,
        created_by, updated_by
      )
      values (
        v_tenant, v_company, v_branch, v_period,
        trim(p_payload->>'pos_code'),
        trim(p_payload->>'pos_name'),
        v_bank.id,
        v_finance_id,
        upper(trim(p_payload->>'kind')),
        nullif(trim(coalesce(p_payload->>'merchant_number','')),''),
        nullif(trim(coalesce(p_payload->>'terminal_number','')),''),
        v_currency,
        p_actor_user_id,
        p_actor_user_id
      )
      returning id into v_operational_id;
    end if;

    insert into public.finance_account_master_operations (
      tenant_id, company_id, branch_id, accounting_period_id,
      idempotency_key, payload_hash, action, account_kind,
      finance_account_id, operational_account_id,
      outcome, actor_user_id
    )
    values (
      v_tenant, v_company, v_branch, v_period,
      p_idempotency_key, p_payload_hash, v_action, v_kind,
      v_finance_id, v_operational_id,
      'CREATED', p_actor_user_id
    );

    return query select 'CREATED', v_finance_id, v_operational_id, null::text;
    return;
  end if;

  begin
    v_operational_id := (p_payload->>'operational_account_id')::uuid;
  exception when others then
    raise exception 'FINANCE_ACCOUNT_MASTER_OPERATIONAL_ID_REQUIRED';
  end;

  if v_kind = 'CASH' then
    select ca.ledger_account_id
    into v_target_finance_id
    from public.cash_accounts as ca
    where ca.id = v_operational_id
      and ca.tenant_id = v_tenant
      and ca.company_id = v_company
      and ca.branch_id = v_branch
      and ca.accounting_period_id = v_period
    for update;

    if not found then
      return query select 'REJECT', null::uuid, v_operational_id, 'FINANCE_CASH_ACCOUNT_NOT_FOUND';
      return;
    end if;

    update public.cash_accounts as ca
    set is_active = false,
        archived_at = coalesce(ca.archived_at, now()),
        updated_at = now(),
        updated_by = p_actor_user_id
    where ca.id = v_operational_id
      and ca.tenant_id = v_tenant
      and ca.company_id = v_company
      and ca.branch_id = v_branch
      and ca.accounting_period_id = v_period;

  elsif v_kind = 'BANK' then
    select ba.ledger_account_id
    into v_target_finance_id
    from public.bank_accounts as ba
    where ba.id = v_operational_id
      and ba.tenant_id = v_tenant
      and ba.company_id = v_company
      and ba.branch_id = v_branch
      and ba.accounting_period_id = v_period
    for update;

    if not found then
      return query select 'REJECT', null::uuid, v_operational_id, 'FINANCE_BANK_ACCOUNT_NOT_FOUND';
      return;
    end if;

    if exists (
      select 1
      from public.pos_accounts as pa
      where pa.tenant_id = v_tenant
        and pa.company_id = v_company
        and pa.branch_id = v_branch
        and pa.accounting_period_id = v_period
        and pa.bank_account_id = v_operational_id
        and pa.is_active = true
    ) then
      return query select 'REJECT', null::uuid, v_operational_id, 'FINANCE_BANK_HAS_ACTIVE_POS';
      return;
    end if;

    update public.bank_accounts as ba
    set is_active = false,
        archived_at = coalesce(ba.archived_at, now()),
        updated_at = now(),
        updated_by = p_actor_user_id
    where ba.id = v_operational_id
      and ba.tenant_id = v_tenant
      and ba.company_id = v_company
      and ba.branch_id = v_branch
      and ba.accounting_period_id = v_period;

  else
    select pa.clearing_ledger_account_id
    into v_target_finance_id
    from public.pos_accounts as pa
    where pa.id = v_operational_id
      and pa.tenant_id = v_tenant
      and pa.company_id = v_company
      and pa.branch_id = v_branch
      and pa.accounting_period_id = v_period
    for update;

    if not found then
      return query select 'REJECT', null::uuid, v_operational_id, 'FINANCE_POS_ACCOUNT_NOT_FOUND';
      return;
    end if;

    update public.pos_accounts as pa
    set is_active = false,
        archived_at = coalesce(pa.archived_at, now()),
        updated_at = now(),
        updated_by = p_actor_user_id
    where pa.id = v_operational_id
      and pa.tenant_id = v_tenant
      and pa.company_id = v_company
      and pa.branch_id = v_branch
      and pa.accounting_period_id = v_period;
  end if;

  update public.finance_accounts as fa
  set is_active = false,
      archived_at = coalesce(fa.archived_at, now()),
      updated_at = now(),
      updated_by = p_actor_user_id
  where fa.id = v_target_finance_id
    and fa.tenant_id = v_tenant
    and fa.company_id = v_company
    and fa.branch_id = v_branch
    and fa.accounting_period_id = v_period;

  insert into public.finance_account_master_operations (
    tenant_id, company_id, branch_id, accounting_period_id,
    idempotency_key, payload_hash, action, account_kind,
    finance_account_id, operational_account_id,
    outcome, actor_user_id
  )
  values (
    v_tenant, v_company, v_branch, v_period,
    p_idempotency_key, p_payload_hash, v_action, v_kind,
    v_target_finance_id, v_operational_id,
    'ARCHIVED', p_actor_user_id
  );

  return query select 'ARCHIVED', v_target_finance_id, v_operational_id, null::text;

exception
  when unique_violation then
    return query select 'CONFLICT', v_finance_id, v_operational_id, 'FINANCE_ACCOUNT_MASTER_UNIQUE_CONFLICT';
end;
$$;

revoke all on function public.manage_finance_account_master_v1(
  text,text,jsonb,jsonb,text,text,text
) from public, anon, authenticated;

grant execute on function public.manage_finance_account_master_v1(
  text,text,jsonb,jsonb,text,text,text
) to service_role;