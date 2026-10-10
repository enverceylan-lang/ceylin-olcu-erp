-- ENVERP Finance Opening Balance Authority V1
-- SOURCE ONLY. Live SQL requires separate explicit approval.
-- Successor migration: historical migrations are intentionally unchanged.

begin;

do $preflight$
begin
  if to_regclass('public.finance_receivable_open_items_v1') is null
     or to_regclass('public.finance_collection_allocations_v1') is null
     or to_regclass('public.finance_instrument_allocations_v1') is null
     or to_regclass('public.finance_transactions') is null
     or to_regclass('public.finance_transaction_audits') is null
     or to_regclass('public.finance_accounts') is null
     or to_regclass('public.finance_operation_requests_v1') is null
     or to_regclass('public.counterparty_payable_movements') is null
     or to_regclass('public.counterparty_payable_audits') is null
     or to_regclass('public.customers') is null then
    raise exception 'FINANCE_OPENING_BALANCE_PREFLIGHT_RELATION_MISSING';
  end if;
end
$preflight$;

alter table public.finance_receivable_open_items_v1
  alter column sale_id drop not null,
  add column if not exists source_type text,
  add column if not exists source_document_id text;

update public.finance_receivable_open_items_v1
set source_type='SALE',
    source_document_id=sale_id
where source_type is null
   or source_document_id is null;

do $identity_backfill$
begin
  if exists (
    select 1
    from public.finance_receivable_open_items_v1
    where source_type is null
       or source_document_id is null
       or btrim(source_document_id)=''
  ) then
    raise exception 'FINANCE_OPENING_BALANCE_RECEIVABLE_IDENTITY_BACKFILL_FAILED';
  end if;
end
$identity_backfill$;

alter table public.finance_receivable_open_items_v1
  alter column source_type set not null,
  alter column source_document_id set not null;

alter table public.finance_receivable_open_items_v1
  drop constraint if exists finance_receivable_open_items_source_uk,
  drop constraint if exists finance_receivable_open_items_source_type_ck,
  drop constraint if exists finance_receivable_open_items_source_shape_ck;

drop index if exists public.finance_receivable_open_items_source_uk;
drop index if exists public.finance_receivable_open_items_canonical_source_uk;

alter table public.finance_receivable_open_items_v1
  add constraint finance_receivable_open_items_source_type_ck
    check (source_type in ('SALE','OPENING_BALANCE')),
  add constraint finance_receivable_open_items_source_shape_ck
    check (
      (
        source_type='SALE'
        and sale_id is not null
        and btrim(sale_id)<>''
        and source_document_id=sale_id
      )
      or
      (
        source_type='OPENING_BALANCE'
        and sale_id is null
        and btrim(source_document_id)<>''
      )
    );

create unique index finance_receivable_open_items_canonical_source_uk
on public.finance_receivable_open_items_v1(
  tenant_id,company_id,branch_id,accounting_period_id,
  source_type,source_document_id,sequence_no
);

alter table public.finance_collection_allocations_v1
  alter column sale_id drop not null;

alter table public.finance_instrument_allocations_v1
  alter column sale_id drop not null;

alter table public.counterparty_payable_movements
  drop constraint if exists counterparty_payable_counterparty_type_chk;

alter table public.counterparty_payable_movements
  add constraint counterparty_payable_counterparty_type_chk
  check (counterparty_type in ('CUSTOMER','SUPPLIER','TAILOR','INSTALLER'));

alter table public.finance_transactions
  drop constraint if exists finance_transactions_projection_source_ck;

alter table public.finance_transactions
  add constraint finance_transactions_projection_source_ck
  check (
    projection_source in (
      'SALE_CHARGE','SALE_PAYMENT','SALE_RETURN','LEGACY_DOWN_PAYMENT',
      'MANUAL','PAYMENT','TRANSFER','REVERSAL','OPENING_BALANCE'
    )
  );


-- ENVerp Counterparty Payable Persistence RPC V1
-- Atomic movement + audit write with deterministic replay/conflict semantics.

create or replace function public.persist_counterparty_payable_movement_v1(
  p_movement jsonb,
  p_audit jsonb
)
returns table (
  outcome text,
  movement_id text,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.counterparty_payable_movements%rowtype;
  v_scope_ok boolean;
  v_same_payload boolean;
  v_movement_id text;
  v_idempotency_key text;
  v_tenant_id text;
  v_company_id text;
  v_branch_id text;
  v_accounting_period_id text;
  v_counterparty_customer_id text;
  v_counterparty_type text;
  v_kind text;
  v_amount numeric(18,2);
  v_currency text;
  v_occurred_at timestamptz;
  v_recorded_at timestamptz;
  v_created_by_user_id text;
begin
  v_movement_id := nullif(trim(p_movement->>'movementId'), '');
  v_idempotency_key := nullif(trim(p_movement->>'idempotencyKey'), '');
  v_tenant_id := nullif(trim(p_movement->>'tenantId'), '');
  v_company_id := nullif(trim(p_movement->>'companyId'), '');
  v_branch_id := nullif(trim(p_movement->>'branchId'), '');
  v_accounting_period_id := nullif(trim(p_movement->>'accountingPeriodId'), '');
  v_counterparty_customer_id := nullif(trim(p_movement->>'counterpartyCustomerId'), '');
  v_counterparty_type := nullif(trim(p_movement->>'counterpartyType'), '');
  v_kind := nullif(trim(p_movement->>'kind'), '');
  v_amount := nullif(p_movement->>'amount', '')::numeric(18,2);
  v_currency := nullif(trim(p_movement->>'currency'), '');
  v_occurred_at := nullif(p_movement->>'occurredAt', '')::timestamptz;
  v_recorded_at := nullif(p_movement->>'recordedAt', '')::timestamptz;
  v_created_by_user_id := nullif(trim(p_audit->>'actorUserId'), '');

  v_scope_ok :=
    v_tenant_id is not null and
    v_company_id is not null and
    v_branch_id is not null and
    v_accounting_period_id is not null;

  if not v_scope_ok then
    raise exception 'COUNTERPARTY_PAYABLE_SCOPE_REQUIRED';
  end if;

  if
    v_movement_id is null or
    v_idempotency_key is null or
    v_counterparty_customer_id is null or
    v_counterparty_type not in ('CUSTOMER','SUPPLIER','TAILOR','INSTALLER') or
    v_kind not in ('ACCRUAL','PAYMENT','REVERSAL') or
    v_amount is null or
    v_amount <= 0 or
    v_currency <> 'TRY' or
    v_occurred_at is null or
    v_recorded_at is null or
    v_created_by_user_id is null
  then
    raise exception 'COUNTERPARTY_PAYABLE_INVALID_REQUEST';
  end if;

  select *
    into v_existing
    from public.counterparty_payable_movements
   where tenant_id = v_tenant_id
     and company_id = v_company_id
     and branch_id = v_branch_id
     and accounting_period_id = v_accounting_period_id
     and idempotency_key = v_idempotency_key
   limit 1;

  if found then
    v_same_payload :=
      v_existing.movement_id = v_movement_id and
      v_existing.counterparty_customer_id = v_counterparty_customer_id and
      v_existing.counterparty_type = v_counterparty_type and
      v_existing.movement_kind = v_kind and
      v_existing.amount = v_amount and
      v_existing.currency = v_currency and
      v_existing.occurred_at = v_occurred_at and
      coalesce(v_existing.source_document_id, '') =
        coalesce(p_movement->>'sourceDocumentId', '') and
      coalesce(v_existing.operation_id, '') =
        coalesce(p_movement->>'operationId', '') and
      coalesce(v_existing.provider_earnings_entry_id, '') =
        coalesce(p_movement->>'providerEarningsEntryId', '') and
      coalesce(v_existing.source_payment_id, '') =
        coalesce(p_movement->>'sourcePaymentId', '') and
      coalesce(v_existing.reversal_of_movement_id, '') =
        coalesce(p_movement->>'reversalOfMovementId', '');

    if v_same_payload then
      insert into public.counterparty_payable_audits (
        movement_id,
        tenant_id,
        company_id,
        branch_id,
        accounting_period_id,
        actor_user_id,
        action,
        occurred_at,
        payload
      )
      values (
        v_existing.movement_id,
        v_existing.tenant_id,
        v_existing.company_id,
        v_existing.branch_id,
        v_existing.accounting_period_id,
        v_created_by_user_id,
        'REPLAY',
        now(),
        p_audit
      );

      return query
        select
          'REPLAY'::text,
          v_existing.movement_id,
          null::text;

      return;
    end if;

    return query
      select
        'CONFLICT'::text,
        v_existing.movement_id,
        'IDEMPOTENCY_PAYLOAD_CONFLICT'::text;

    return;
  end if;

  if exists (
    select 1
      from public.counterparty_payable_movements
     where movement_id = v_movement_id
  ) then
    return query
      select
        'CONFLICT'::text,
        v_movement_id,
        'MOVEMENT_ID_CONFLICT'::text;

    return;
  end if;

  insert into public.counterparty_payable_movements (
    movement_id,
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    idempotency_key,
    counterparty_customer_id,
    counterparty_type,
    movement_kind,
    amount,
    currency,
    occurred_at,
    recorded_at,
    source_document_id,
    operation_id,
    provider_earnings_entry_id,
    source_payment_id,
    reversal_of_movement_id,
    note,
    created_by_user_id
  )
  values (
    v_movement_id,
    v_tenant_id,
    v_company_id,
    v_branch_id,
    v_accounting_period_id,
    v_idempotency_key,
    v_counterparty_customer_id,
    v_counterparty_type,
    v_kind,
    v_amount,
    v_currency,
    v_occurred_at,
    v_recorded_at,
    nullif(trim(p_movement->>'sourceDocumentId'), ''),
    nullif(trim(p_movement->>'operationId'), ''),
    nullif(trim(p_movement->>'providerEarningsEntryId'), ''),
    nullif(trim(p_movement->>'sourcePaymentId'), ''),
    nullif(trim(p_movement->>'reversalOfMovementId'), ''),
    nullif(p_movement->>'note', ''),
    v_created_by_user_id
  );

  insert into public.counterparty_payable_audits (
    movement_id,
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    actor_user_id,
    action,
    occurred_at,
    payload
  )
  values (
    v_movement_id,
    v_tenant_id,
    v_company_id,
    v_branch_id,
    v_accounting_period_id,
    v_created_by_user_id,
    'CREATE',
    now(),
    p_audit
  );

  return query
    select
      'CREATED'::text,
      v_movement_id,
      null::text;
end;
$$;

revoke all
  on function public.persist_counterparty_payable_movement_v1(jsonb, jsonb)
  from public;

grant execute
  on function public.persist_counterparty_payable_movement_v1(jsonb, jsonb)
  to service_role;

-- ENVerp Finance F2 - Atomic Counterparty Payment V1
-- SOURCE ONLY. Live apply requires separate live-SQL authority approval.
--
-- Purpose:
--   CASH/BANK PAYMENT must update the canonical cash/bank ledger and the
--   counterparty payable movement in one PostgreSQL transaction.
--
-- Existing canonical authorities reused:
--   public.persist_finance_operation_v1(jsonb,text,text)
--   public.persist_counterparty_payable_movement_v1(jsonb,jsonb)
--
-- No direct balance mutation. No physical delete. No fallback.


create or replace function public.persist_finance_counterparty_payment_v1(
  p_operation jsonb,
  p_movement jsonb,
  p_audit jsonb,
  p_actor_user_id text,
  p_payload_hash text
)
returns table(
  outcome text,
  operation_id text,
  transaction_ids text[],
  movement_id text,
  reason text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_tenant text := nullif(btrim(coalesce(p_operation->>'tenantId','')), '');
  v_company text := nullif(btrim(coalesce(p_operation->>'companyId','')), '');
  v_branch text := nullif(btrim(coalesce(p_operation->>'branchId','')), '');
  v_period text := nullif(btrim(coalesce(p_operation->>'accountingPeriodId','')), '');
  v_operation_id text := nullif(btrim(coalesce(p_operation->>'operationId','')), '');
  v_idem text := nullif(btrim(coalesce(p_operation->>'idempotencyKey','')), '');
  v_channel text := nullif(btrim(coalesce(p_operation->>'channel','')), '');
  v_kind text := nullif(btrim(coalesce(p_operation->>'kind','')), '');
  v_action text := nullif(btrim(coalesce(p_operation->>'action','')), '');
  v_currency text := upper(btrim(coalesce(p_operation->>'currency','')));
  v_amount numeric(18,2) := nullif(p_operation->>'amount','')::numeric(18,2);
  v_counterparty text := nullif(btrim(coalesce(p_operation#>>'{source,counterpartyId}','')), '');
  v_source_document text := nullif(btrim(coalesce(p_operation#>>'{source,sourceDocumentId}','')), '');

  v_movement_id text := nullif(btrim(coalesce(p_movement->>'movementId','')), '');
  v_movement_idem text := nullif(btrim(coalesce(p_movement->>'idempotencyKey','')), '');
  v_movement_counterparty text := nullif(btrim(coalesce(p_movement->>'counterpartyCustomerId','')), '');
  v_movement_type text := nullif(btrim(coalesce(p_movement->>'counterpartyType','')), '');
  v_movement_kind text := nullif(btrim(coalesce(p_movement->>'kind','')), '');
  v_movement_currency text := upper(btrim(coalesce(p_movement->>'currency','')));
  v_movement_amount numeric(18,2) := nullif(p_movement->>'amount','')::numeric(18,2);
  v_movement_source_document text := nullif(btrim(coalesce(p_movement->>'sourceDocumentId','')), '');
  v_movement_operation text := nullif(btrim(coalesce(p_movement->>'operationId','')), '');
  v_source_payment text := nullif(btrim(coalesce(p_movement->>'sourcePaymentId','')), '');

  v_control_code text;
  v_control_id uuid;
  v_control_count integer;
  v_customer_payable_balance numeric(18,2);

  v_operation jsonb;

  v_finance_outcome text;
  v_finance_operation_id text;
  v_finance_transaction_ids text[];
  v_finance_reason text;

  v_payable_outcome text;
  v_payable_movement_id text;
  v_payable_reason text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_SERVICE_ROLE_REQUIRED';
  end if;

  if p_operation is null
     or jsonb_typeof(p_operation) <> 'object'
     or p_movement is null
     or jsonb_typeof(p_movement) <> 'object'
     or p_audit is null
     or jsonb_typeof(p_audit) <> 'object' then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_PAYLOAD_REQUIRED';
  end if;

  if v_tenant is null
     or v_company is null
     or v_branch is null
     or v_period is null
     or v_operation_id is null
     or v_idem is null
     or v_counterparty is null
     or v_source_document is null
     or v_currency !~ '^[A-Z]{3}$'
     or v_amount is null
     or v_amount <= 0 then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_OPERATION_INVALID';
  end if;

  if v_kind <> 'PAYMENT'
     or v_action <> 'CREATE'
     or v_channel not in ('CASH','BANK') then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_KIND_CHANNEL_FORBIDDEN';
  end if;

  if v_movement_id is null
     or v_movement_idem is null
     or v_movement_counterparty is null
     or v_movement_type not in ('CUSTOMER','SUPPLIER','TAILOR','INSTALLER')
     or v_movement_kind <> 'PAYMENT'
     or v_movement_currency !~ '^[A-Z]{3}$'
     or v_movement_amount is null
     or v_movement_amount <= 0
     or v_movement_source_document is null
     or v_movement_operation is null
     or v_source_payment is null then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_MOVEMENT_INVALID';
  end if;

  if v_movement_type = 'CUSTOMER' then
    with effective_payable as (
      select pm.movement_kind, pm.amount
      from public.counterparty_payable_movements pm
      where pm.tenant_id = v_tenant
        and pm.company_id = v_company
        and pm.branch_id = v_branch
        and pm.accounting_period_id = v_period
        and pm.counterparty_customer_id = v_movement_counterparty
        and pm.counterparty_type = 'CUSTOMER'
        and pm.currency = v_movement_currency
        and pm.movement_kind in ('ACCRUAL','PAYMENT')
        and not exists (
          select 1
          from public.counterparty_payable_movements r
          where r.tenant_id = pm.tenant_id
            and r.company_id = pm.company_id
            and r.branch_id = pm.branch_id
            and r.accounting_period_id = pm.accounting_period_id
            and r.movement_kind = 'REVERSAL'
            and r.reversal_of_movement_id = pm.movement_id
        )
    )
    select coalesce(sum(
      case
        when movement_kind = 'ACCRUAL' then amount
        when movement_kind = 'PAYMENT' then -amount
        else 0
      end
    ), 0)::numeric(18,2)
    into v_customer_payable_balance
    from effective_payable;

    if v_customer_payable_balance < v_movement_amount then
      raise exception 'FINANCE_CUSTOMER_PAYMENT_EXCEEDS_PAYABLE';
    end if;
  end if;

  if nullif(btrim(coalesce(p_actor_user_id,'')), '') is null
     or nullif(btrim(coalesce(p_payload_hash,'')), '') is null
     or nullif(btrim(coalesce(p_audit->>'actorUserId','')), '') is distinct from
        nullif(btrim(coalesce(p_actor_user_id,'')), '') then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_AUDIT_INVALID';
  end if;

  if nullif(btrim(coalesce(p_movement->>'tenantId','')), '') is distinct from v_tenant
     or nullif(btrim(coalesce(p_movement->>'companyId','')), '') is distinct from v_company
     or nullif(btrim(coalesce(p_movement->>'branchId','')), '') is distinct from v_branch
     or nullif(btrim(coalesce(p_movement->>'accountingPeriodId','')), '') is distinct from v_period
     or v_movement_counterparty is distinct from v_counterparty
     or v_movement_currency is distinct from v_currency
     or v_movement_amount is distinct from v_amount
     or v_movement_source_document is distinct from v_source_document
     or v_movement_operation is distinct from v_operation_id
     or v_source_payment is distinct from v_operation_id
     or v_movement_id is distinct from (v_operation_id || ':PAYABLE')
     or v_movement_idem is distinct from (v_idem || ':PAYABLE') then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_CROSS_AUTHORITY_MISMATCH';
  end if;

  -- Dedicated scoped control account. Existing account taxonomy already permits
  -- CLEARING. This does not represent a user cash/bank account and carries no
  -- mutable balance column; balances remain derived from posted movements.
  v_control_code := 'SYS-COUNTERPARTY-PAYABLE-' || v_currency;
  v_control_id := md5(
    v_tenant || '|' ||
    v_company || '|' ||
    v_branch || '|' ||
    v_period || '|' ||
    v_control_code
  )::uuid;

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
    v_control_id,
    v_tenant,
    v_company,
    v_branch,
    v_period,
    v_control_code,
    'Counterparty Payable Control',
    'CLEARING',
    v_currency,
    true,
    false,
    false,
    p_actor_user_id,
    p_actor_user_id
  )
  on conflict (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    code
  )
  do nothing;

  select count(*), min(fa.id)
    into v_control_count, v_control_id
  from public.finance_accounts fa
  where fa.tenant_id = v_tenant
    and fa.company_id = v_company
    and fa.branch_id = v_branch
    and fa.accounting_period_id = v_period
    and fa.code = v_control_code
    and fa.account_type = 'CLEARING'
    and fa.currency = v_currency
    and fa.is_active = true
    and fa.archived_at is null;

  if v_control_count <> 1 or v_control_id is null then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_CONTROL_ACCOUNT_INVALID';
  end if;

  v_operation := jsonb_set(
    p_operation,
    '{accounts,counterAccountId}',
    to_jsonb(v_control_id::text),
    true
  );

  select
    f.outcome,
    f.operation_id,
    f.transaction_ids,
    f.reason
  into
    v_finance_outcome,
    v_finance_operation_id,
    v_finance_transaction_ids,
    v_finance_reason
  from public.persist_finance_operation_v1(
    v_operation,
    p_actor_user_id,
    p_payload_hash
  ) f;

  if v_finance_outcome in ('REJECT','CONFLICT') then
    return query
    select
      v_finance_outcome,
      v_finance_operation_id,
      v_finance_transaction_ids,
      null::text,
      v_finance_reason;
    return;
  end if;

  if v_finance_outcome not in ('CREATED','REPLAY') then
    raise exception
      'FINANCE_COUNTERPARTY_PAYMENT_FINANCE_OUTCOME_INVALID:%',
      v_finance_outcome;
  end if;

  select
    p.outcome,
    p.movement_id,
    p.reason
  into
    v_payable_outcome,
    v_payable_movement_id,
    v_payable_reason
  from public.persist_counterparty_payable_movement_v1(
    p_movement,
    p_audit
  ) p;

  if v_payable_outcome not in ('CREATED','REPLAY') then
    -- Critical: exception, not a normal return. If the finance ledger was
    -- created in this invocation, PostgreSQL rolls it back with this function.
    raise exception
      'FINANCE_COUNTERPARTY_PAYMENT_PAYABLE_FAILED:%:%',
      coalesce(v_payable_outcome,'NULL'),
      coalesce(v_payable_reason,'NULL');
  end if;

  if v_finance_outcome is distinct from v_payable_outcome then
    -- Fail closed on split historical/replay state. Never silently heal one
    -- authority while the other authority is already in a different state.
    raise exception
      'FINANCE_COUNTERPARTY_PAYMENT_OUTCOME_MISMATCH:FINANCE=%:PAYABLE=%',
      v_finance_outcome,
      v_payable_outcome;
  end if;

  if v_finance_operation_id is distinct from v_operation_id
     or v_payable_movement_id is distinct from v_movement_id then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_IDENTITY_MISMATCH';
  end if;

  return query
  select
    v_finance_outcome,
    v_finance_operation_id,
    v_finance_transaction_ids,
    v_payable_movement_id,
    null::text;
end;
$function$;

alter function public.persist_finance_counterparty_payment_v1(
  jsonb,jsonb,jsonb,text,text
)
owner to postgres;

revoke all
  on function public.persist_finance_counterparty_payment_v1(
    jsonb,jsonb,jsonb,text,text
  )
  from public, anon, authenticated, service_role;

grant execute
  on function public.persist_finance_counterparty_payment_v1(
    jsonb,jsonb,jsonb,text,text
  )
  to service_role;

create or replace function public.read_finance_customer_receivable_snapshot_v1(
  p_scope jsonb,
  p_customer_id text,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_tenant text := trim(coalesce(p_scope->>'tenantId',''));
  v_company text := trim(coalesce(p_scope->>'companyId',''));
  v_branch text := trim(coalesce(p_scope->>'branchId',''));
  v_period text := trim(coalesce(p_scope->>'accountingPeriodId',''));
  v_customer text := trim(coalesce(p_customer_id,''));
  v_currency text := upper(trim(coalesce(p_currency,'')));
  v_result jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FINANCE_CUSTOMER_RECEIVABLE_READ_SERVICE_ROLE_REQUIRED';
  end if;

  if jsonb_typeof(coalesce(p_scope,'null'::jsonb)) is distinct from 'object' or
     v_tenant = '' or v_company = '' or v_branch = '' or v_period = '' or
     v_customer = '' or v_currency !~ '^[A-Z]{3}$' then
    raise exception 'FINANCE_CUSTOMER_RECEIVABLE_READ_INPUT_INVALID';
  end if;

  with
  scoped_open_items as (
    select
      oi.id,
      oi.sale_id,
      oi.source_type,
      oi.source_document_id,
      oi.installment_id,
      oi.document_number,
      oi.sequence_no,
      oi.due_date,
      oi.original_amount,
      oi.allocated_amount,
      oi.reserved_amount,
      oi.currency,
      oi.status,
      oi.created_at,
      oi.updated_at,
      (oi.original_amount - oi.allocated_amount - oi.reserved_amount) as remaining_amount
    from public.finance_receivable_open_items_v1 oi
    where oi.tenant_id = v_tenant
      and oi.company_id = v_company
      and oi.branch_id = v_branch
      and oi.accounting_period_id = v_period
      and oi.customer_id = v_customer
      and oi.currency = v_currency
  ),
  scoped_allocations as (
    select
      ca.id,
      ca.operation_id,
      ca.transaction_id,
      ca.open_item_id,
      ca.sale_id,
      ca.installment_id,
      ca.amount,
      ca.currency,
      ca.reversed_at,
      ca.created_at
    from public.finance_collection_allocations_v1 ca
    join scoped_open_items oi on oi.id = ca.open_item_id
    where ca.tenant_id = v_tenant
      and ca.company_id = v_company
      and ca.branch_id = v_branch
      and ca.accounting_period_id = v_period
      and ca.currency = v_currency
  ),
  scoped_transactions as (
    select
      ft.transaction_id,
      ft.payment_method,
      ft.description,
      ft.transaction_date,
      ft.created_at,
      ft.status,
      ft.reversed_at,
      ft.transaction_type,
      ft.net_amount
    from public.finance_transactions ft
    where ft.tenant_id = v_tenant
      and ft.company_id = v_company
      and ft.branch_id = v_branch
      and ft.accounting_period_id = v_period
      and ft.customer_id = v_customer
      and ft.currency = v_currency
      and (
        ft.transaction_type = 'COLLECTION'
        or exists (
          select 1
          from scoped_allocations ca
          where ca.transaction_id = ft.transaction_id
        )
      )
  ),
  open_metrics as (
    select
      coalesce(sum(case when status <> 'REVERSED' then original_amount else 0 end),0::numeric) as original_debt_total,
      coalesce(sum(case when status <> 'REVERSED' then reserved_amount else 0 end),0::numeric) as reserved_total,
      coalesce(sum(case when status in ('OPEN','PARTIAL') then remaining_amount else 0 end),0::numeric) as current_balance,
      coalesce(sum(case when status <> 'REVERSED' then allocated_amount else 0 end),0::numeric) as allocated_amount_total,
      count(*) filter (where status in ('OPEN','PARTIAL'))::integer as open_item_count,
      count(*) filter (where status = 'CLOSED')::integer as closed_item_count,
      count(*) filter (
        where allocated_amount < 0 or reserved_amount < 0 or
              allocated_amount + reserved_amount > original_amount or
              remaining_amount < 0
      )::integer as invalid_item_count
    from scoped_open_items
  ),
  allocation_metrics as (
    select
      coalesce(sum(amount) filter (where reversed_at is null),0::numeric) as active_allocation_total,
      count(*) filter (where amount <= 0)::integer as invalid_allocation_count
    from scoped_allocations
  ),
  transaction_metrics as (
    select
      coalesce(sum(net_amount) filter (
        where transaction_type = 'COLLECTION'
          and status = 'POSTED'
          and reversed_at is null
      ),0::numeric) as active_collection_total,
      count(*) filter (
        where transaction_type = 'COLLECTION'
          and status = 'POSTED'
          and reversed_at is null
          and net_amount <= 0
      )::integer as invalid_collection_count
    from scoped_transactions
  ),
  due_metrics as (
    select
      coalesce(sum(remaining_amount) filter (
        where status in ('OPEN','PARTIAL') and due_date < current_date
      ),0::numeric) as overdue_amount,
      coalesce(sum(remaining_amount) filter (
        where status in ('OPEN','PARTIAL') and due_date = current_date
      ),0::numeric) as due_today_amount,
      coalesce(sum(remaining_amount) filter (
        where status in ('OPEN','PARTIAL') and due_date > current_date
      ),0::numeric) as future_amount,
      coalesce(sum(remaining_amount) filter (
        where status in ('OPEN','PARTIAL')
      ),0::numeric) as total_open_amount
    from scoped_open_items
  ),
  metadata_integrity as (
    select count(*)::integer as missing_metadata_count
    from scoped_allocations ca
    left join scoped_transactions ft on ft.transaction_id = ca.transaction_id
    where ca.reversed_at is null and ft.transaction_id is null
  ),
  open_items_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'saleId', sale_id,
          'sourceType', source_type,
          'sourceDocumentId', source_document_id,
          'installmentId', installment_id,
          'documentNumber', document_number,
          'sequenceNo', sequence_no,
          'dueDate', due_date,
          'originalAmount', original_amount,
          'allocatedAmount', allocated_amount,
          'reservedAmount', reserved_amount,
          'remainingAmount', remaining_amount,
          'status', status,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        order by due_date, document_number, sequence_no, id
      ),
      '[]'::jsonb
    ) as value
    from scoped_open_items
  ),
  allocations_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'operationId', operation_id,
          'transactionId', transaction_id,
          'openItemId', open_item_id,
          'saleId', sale_id,
          'installmentId', installment_id,
          'amount', amount,
          'reversedAt', reversed_at,
          'createdAt', created_at
        )
        order by created_at, id
      ),
      '[]'::jsonb
    ) as value
    from scoped_allocations
  ),
  transactions_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'transactionId', transaction_id,
          'paymentMethod', payment_method,
          'description', description,
          'transactionDate', transaction_date,
          'createdAt', created_at,
          'status', status,
          'reversedAt', reversed_at,
          'transactionType', transaction_type,
          'netAmount', net_amount
        )
        order by transaction_date, created_at, transaction_id
      ),
      '[]'::jsonb
    ) as value
    from scoped_transactions
  )
  select jsonb_build_object(
    'customerId', v_customer,
    'currency', v_currency,
    'asOf', current_date,
    'summary', jsonb_build_object(
      'originalDebtTotal', om.original_debt_total,
      'allocatedCollectionTotal', am.active_allocation_total,
      'unallocatedCreditTotal',
        greatest(tm.active_collection_total - am.active_allocation_total,0::numeric),
      'reservedTotal', om.reserved_total,
      'currentBalance',
        om.current_balance -
        greatest(tm.active_collection_total - am.active_allocation_total,0::numeric),
      'openItemCount', om.open_item_count,
      'closedItemCount', om.closed_item_count
    ),
    'due', jsonb_build_object(
      'overdueAmount', dm.overdue_amount,
      'dueTodayAmount', dm.due_today_amount,
      'futureAmount', dm.future_amount,
      'totalOpenAmount', dm.total_open_amount
    ),
    'openItems', oij.value,
    'allocations', aj.value,
    'transactionMetadata', tj.value,
    'reconciliation', jsonb_build_object(
      'ok',
        om.invalid_item_count = 0 and
        am.invalid_allocation_count = 0 and
        tm.invalid_collection_count = 0 and
        mi.missing_metadata_count = 0 and
        om.allocated_amount_total is not distinct from am.active_allocation_total and
        tm.active_collection_total >= am.active_allocation_total and
        dm.total_open_amount is not distinct from om.current_balance,
      'reason',
        case
          when om.invalid_item_count <> 0 then 'OPEN_ITEM_AMOUNT_INTEGRITY_FAILED'
          when am.invalid_allocation_count <> 0 then 'ALLOCATION_AMOUNT_INTEGRITY_FAILED'
          when tm.invalid_collection_count <> 0 then 'COLLECTION_AMOUNT_INTEGRITY_FAILED'
          when mi.missing_metadata_count <> 0 then 'ALLOCATION_TRANSACTION_METADATA_MISSING'
          when om.allocated_amount_total is distinct from am.active_allocation_total then 'ALLOCATED_TOTAL_MISMATCH'
          when tm.active_collection_total < am.active_allocation_total then 'COLLECTION_TOTAL_BELOW_ALLOCATION'
          when dm.total_open_amount is distinct from om.current_balance then 'DUE_OPEN_BALANCE_MISMATCH'
          else null
        end
    )
  )
  into v_result
  from open_metrics om
  cross join allocation_metrics am
  cross join transaction_metrics tm
  cross join due_metrics dm
  cross join metadata_integrity mi
  cross join open_items_json oij
  cross join allocations_json aj
  cross join transactions_json tj;

  if coalesce((v_result#>>'{reconciliation,ok}')::boolean,false) is not true then
    raise exception 'FINANCE_CUSTOMER_RECEIVABLE_READ_RECONCILIATION_FAILED';
  end if;

  return v_result;
end;
$function$;

revoke all on function public.read_finance_customer_receivable_snapshot_v1(jsonb,text,text)
from public, anon, authenticated;

grant execute on function public.read_finance_customer_receivable_snapshot_v1(jsonb,text,text)
to service_role;

create or replace function public.persist_finance_opening_balance_v1(
  p_command jsonb,
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
  v_tenant text := nullif(btrim(coalesce(p_command->>'tenantId','')), '');
  v_company text := nullif(btrim(coalesce(p_command->>'companyId','')), '');
  v_branch text := nullif(btrim(coalesce(p_command->>'branchId','')), '');
  v_period text := nullif(btrim(coalesce(p_command->>'accountingPeriodId','')), '');
  v_operation_id text := nullif(btrim(coalesce(p_command->>'operationId','')), '');
  v_idem text := nullif(btrim(coalesce(p_command->>'idempotencyKey','')), '');
  v_customer text := nullif(btrim(coalesce(p_command->>'customerId','')), '');
  v_direction text := upper(btrim(coalesce(p_command->>'direction','')));
  v_amount numeric := nullif(p_command->>'amount','')::numeric;
  v_currency text := upper(btrim(coalesce(p_command->>'currency','')));
  v_opening_date date := nullif(p_command->>'openingDate','')::date;
  v_due_date date := nullif(p_command->>'dueDate','')::date;
  v_source_id text := nullif(btrim(coalesce(p_command->>'sourceDocumentId','')), '');
  v_source_type text := upper(btrim(coalesce(p_command->>'sourceDocumentType','')));
  v_description text := nullif(btrim(coalesce(p_command->>'description','')), '');
  v_existing public.finance_operation_requests_v1%rowtype;
  v_customer_count integer;
  v_source_count integer;
  v_receivable_account uuid;
  v_payable_account uuid;
  v_clearing_account uuid;
  v_account_count integer;
  v_tx_id text;
  v_open_item_id uuid;
  v_payable_movement_id text;
  v_tx_ids text[] := array[]::text[];
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FINANCE_OPENING_BALANCE_SERVICE_ROLE_REQUIRED';
  end if;

  if p_command is null or jsonb_typeof(p_command) <> 'object' then
    return query select 'REJECT', null::text, array[]::text[], 'FINANCE_OPENING_BALANCE_PAYLOAD_REQUIRED';
    return;
  end if;

  if v_tenant is null or v_company is null or v_branch is null or v_period is null
     or v_operation_id is null or v_idem is null or v_customer is null
     or v_direction not in ('RECEIVABLE','PAYABLE')
     or v_amount is null or v_amount <= 0 or round(v_amount,2) <> v_amount
     or v_currency !~ '^[A-Z]{3}$'
     or v_opening_date is null
     or v_source_id is null
     or v_source_type <> 'OPENING_BALANCE'
     or nullif(btrim(coalesce(p_actor_user_id,'')), '') is null
     or nullif(btrim(coalesce(p_payload_hash,'')), '') is null then
    return query select 'REJECT', v_operation_id, array[]::text[], 'FINANCE_OPENING_BALANCE_REQUIRED_FIELD_INVALID';
    return;
  end if;

  if v_direction = 'PAYABLE' and v_currency <> 'TRY' then
    return query select 'REJECT', v_operation_id, array[]::text[], 'FINANCE_OPENING_PAYABLE_CURRENCY_UNSUPPORTED';
    return;
  end if;

  if v_operation_id is distinct from ('OPENING_BALANCE:' || v_source_id)
     or v_idem is distinct from ('OPENING_BALANCE:' || v_source_id) then
    return query select 'REJECT', v_operation_id, array[]::text[], 'FINANCE_OPENING_BALANCE_STABLE_IDENTITY_REQUIRED';
    return;
  end if;

  select count(*)
  into v_customer_count
  from public.customers c
  where c.id = v_customer
    and c.tenant_id = v_tenant
    and c.company_id = v_company
    and c.branch_id = v_branch
    and c.accounting_period_id = v_period
    and coalesce(c."isDeleted", false) = false;

  if v_customer_count <> 1 then
    return query select 'REJECT', v_operation_id, array[]::text[], 'FINANCE_OPENING_BALANCE_CUSTOMER_SCOPE_INVALID';
    return;
  end if;

  insert into public.finance_operation_requests_v1(
    tenant_id,company_id,branch_id,accounting_period_id,
    idempotency_key,payload_hash,operation_id,outcome,actor_user_id
  )
  values (
    v_tenant,v_company,v_branch,v_period,
    v_idem,p_payload_hash,v_operation_id,'PENDING',p_actor_user_id
  )
  on conflict do nothing;

  if not found then
    select *
    into v_existing
    from public.finance_operation_requests_v1 r
    where r.tenant_id=v_tenant
      and r.company_id=v_company
      and r.branch_id=v_branch
      and r.accounting_period_id=v_period
      and r.idempotency_key=v_idem
    for update;

    if v_existing.payload_hash is distinct from p_payload_hash then
      return query select 'CONFLICT',v_existing.operation_id,array[]::text[],'IDEMPOTENCY_PAYLOAD_CONFLICT';
      return;
    elsif v_existing.outcome='CREATED' then
      return query select
        'REPLAY',
        v_existing.operation_id,
        coalesce(array(select jsonb_array_elements_text(v_existing.result_json->'transactionIds')),array[]::text[]),
        null::text;
      return;
    elsif v_existing.outcome='REJECT' then
      return query select 'REJECT',v_existing.operation_id,array[]::text[],v_existing.result_json->>'reason';
      return;
    else
      return query select 'CONFLICT',v_existing.operation_id,array[]::text[],'FINANCE_OPENING_BALANCE_PENDING_CONFLICT';
      return;
    end if;
  end if;

  select count(*)
  into v_source_count
  from public.finance_transactions ft
  where ft.tenant_id=v_tenant
    and ft.company_id=v_company
    and ft.branch_id=v_branch
    and ft.accounting_period_id=v_period
    and ft.source_document_type='OPENING_BALANCE'
    and ft.source_document_id=v_source_id
    and ft.transaction_type='ADJUSTMENT'
    and coalesce(ft.operation_leg,'SINGLE')='SINGLE';

  if v_source_count <> 0 then
    update public.finance_operation_requests_v1
    set outcome='REJECT',
        result_json=jsonb_build_object('reason','FINANCE_OPENING_BALANCE_SOURCE_DOCUMENT_CONFLICT'),
        completed_at=now()
    where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
      and accounting_period_id=v_period and idempotency_key=v_idem;

    return query select 'REJECT',v_operation_id,array[]::text[],'FINANCE_OPENING_BALANCE_SOURCE_DOCUMENT_CONFLICT';
    return;
  end if;

  insert into public.finance_accounts(
    id,tenant_id,company_id,branch_id,accounting_period_id,
    code,name,account_type,currency,is_active,
    is_default_collection,is_default_payment,created_by,updated_by
  )
  values
  (
    md5(v_tenant||'|'||v_company||'|'||v_branch||'|'||v_period||'|SYS-CUSTOMER-RECEIVABLE-'||v_currency)::uuid,
    v_tenant,v_company,v_branch,v_period,
    'SYS-CUSTOMER-RECEIVABLE-'||v_currency,'Customer Receivable Control',
    'CUSTOMER_RECEIVABLE',v_currency,true,false,false,p_actor_user_id,p_actor_user_id
  ),
  (
    md5(v_tenant||'|'||v_company||'|'||v_branch||'|'||v_period||'|SYS-CUSTOMER-PAYABLE-'||v_currency)::uuid,
    v_tenant,v_company,v_branch,v_period,
    'SYS-CUSTOMER-PAYABLE-'||v_currency,'Customer Payable Control',
    'CUSTOMER_PAYABLE',v_currency,true,false,false,p_actor_user_id,p_actor_user_id
  ),
  (
    md5(v_tenant||'|'||v_company||'|'||v_branch||'|'||v_period||'|SYS-OPENING-BALANCE-CLEARING-'||v_currency)::uuid,
    v_tenant,v_company,v_branch,v_period,
    'SYS-OPENING-BALANCE-CLEARING-'||v_currency,'Opening Balance Clearing',
    'CLEARING',v_currency,true,false,false,p_actor_user_id,p_actor_user_id
  )
  on conflict (tenant_id,company_id,branch_id,accounting_period_id,code)
  do nothing;

  select count(*), min(fa.id)
  into v_account_count, v_receivable_account
  from public.finance_accounts fa
  where fa.tenant_id=v_tenant and fa.company_id=v_company
    and fa.branch_id=v_branch and fa.accounting_period_id=v_period
    and fa.code='SYS-CUSTOMER-RECEIVABLE-'||v_currency
    and fa.account_type='CUSTOMER_RECEIVABLE'
    and fa.currency=v_currency and fa.is_active=true and fa.archived_at is null;
  if v_account_count<>1 or v_receivable_account is null then
    raise exception 'FINANCE_OPENING_RECEIVABLE_ACCOUNT_NOT_UNIQUE';
  end if;

  select count(*), min(fa.id)
  into v_account_count, v_payable_account
  from public.finance_accounts fa
  where fa.tenant_id=v_tenant and fa.company_id=v_company
    and fa.branch_id=v_branch and fa.accounting_period_id=v_period
    and fa.code='SYS-CUSTOMER-PAYABLE-'||v_currency
    and fa.account_type='CUSTOMER_PAYABLE'
    and fa.currency=v_currency and fa.is_active=true and fa.archived_at is null;
  if v_account_count<>1 or v_payable_account is null then
    raise exception 'FINANCE_OPENING_PAYABLE_ACCOUNT_NOT_UNIQUE';
  end if;

  select count(*), min(fa.id)
  into v_account_count, v_clearing_account
  from public.finance_accounts fa
  where fa.tenant_id=v_tenant and fa.company_id=v_company
    and fa.branch_id=v_branch and fa.accounting_period_id=v_period
    and fa.code='SYS-OPENING-BALANCE-CLEARING-'||v_currency
    and fa.account_type='CLEARING'
    and fa.currency=v_currency and fa.is_active=true and fa.archived_at is null;
  if v_account_count<>1 or v_clearing_account is null then
    raise exception 'FINANCE_OPENING_BALANCE_CLEARING_ACCOUNT_NOT_UNIQUE';
  end if;

  v_tx_id := v_operation_id;

  insert into public.finance_transactions(
    id,transaction_id,idempotency_key,
    tenant_id,company_id,branch_id,accounting_period_id,
    transaction_type,direction,payment_method,
    finance_account_id,counter_account_id,
    customer_id,sale_id,counterparty_id,
    source_document_id,source_document_type,
    gross_amount,commission_amount,net_amount,currency,
    transaction_date,value_date,due_date,
    status,description,
    created_by,created_at,posted_at,
    projection_source,operation_group_id,operation_leg
  )
  values (
    v_tx_id,v_tx_id,v_idem,
    v_tenant,v_company,v_branch,v_period,
    'ADJUSTMENT',
    case when v_direction='RECEIVABLE' then 'DEBIT' else 'CREDIT' end,
    null,
    case when v_direction='RECEIVABLE' then v_receivable_account::text else v_payable_account::text end,
    v_clearing_account::text,
    case when v_direction='RECEIVABLE' then v_customer else null end,
    null,
    case when v_direction='PAYABLE' then v_customer else null end,
    v_source_id,'OPENING_BALANCE',
    v_amount,0,v_amount,v_currency,
    v_opening_date,v_opening_date,coalesce(v_due_date,v_opening_date),
    'POSTED',v_description,
    p_actor_user_id,clock_timestamp(),clock_timestamp(),
    'OPENING_BALANCE',v_operation_id,'SINGLE'
  );

  insert into public.finance_transaction_audits(
    id,transaction_id,idempotency_key,
    tenant_id,company_id,branch_id,accounting_period_id,
    action,actor_user_id,customer_id,sale_id,counterparty_id,
    occurred_at,payload_hash
  )
  values (
    'audit:'||v_tx_id,v_tx_id,v_idem,
    v_tenant,v_company,v_branch,v_period,
    'POSTED',p_actor_user_id,
    case when v_direction='RECEIVABLE' then v_customer else null end,
    null,
    case when v_direction='PAYABLE' then v_customer else null end,
    clock_timestamp(),p_payload_hash
  );

  if v_direction='RECEIVABLE' then
    v_open_item_id := md5(
      v_tenant||'|'||v_company||'|'||v_branch||'|'||v_period||
      '|OPENING_BALANCE|'||v_source_id||'|1'
    )::uuid;

    insert into public.finance_receivable_open_items_v1(
      id,tenant_id,company_id,branch_id,accounting_period_id,
      customer_id,sale_id,source_type,source_document_id,installment_id,
      document_number,sequence_no,due_date,
      original_amount,allocated_amount,reserved_amount,currency,status
    )
    values (
      v_open_item_id,v_tenant,v_company,v_branch,v_period,
      v_customer,null,'OPENING_BALANCE',v_source_id,null,
      v_source_id,1,coalesce(v_due_date,v_opening_date),
      v_amount,0,0,v_currency,'OPEN'
    );
  else
    v_payable_movement_id := 'opening-payable:'||v_operation_id;

    insert into public.counterparty_payable_movements(
      movement_id,tenant_id,company_id,branch_id,accounting_period_id,
      idempotency_key,counterparty_customer_id,counterparty_type,movement_kind,
      amount,currency,occurred_at,recorded_at,source_document_id,operation_id,
      note,created_by_user_id
    )
    values (
      v_payable_movement_id,v_tenant,v_company,v_branch,v_period,
      v_idem||':PAYABLE',v_customer,'CUSTOMER','ACCRUAL',
      v_amount,v_currency,v_opening_date::timestamptz,v_opening_date::timestamptz,
      v_source_id,v_operation_id,v_description,p_actor_user_id
    );

    insert into public.counterparty_payable_audits(
      movement_id,tenant_id,company_id,branch_id,accounting_period_id,
      actor_user_id,action,occurred_at,payload
    )
    values (
      v_payable_movement_id,v_tenant,v_company,v_branch,v_period,
      p_actor_user_id,'CREATE',clock_timestamp(),
      jsonb_build_object(
        'source','OPENING_BALANCE',
        'sourceDocumentId',v_source_id,
        'payloadHash',p_payload_hash
      )
    );
  end if;

  v_tx_ids := array_append(v_tx_ids,v_tx_id);

  update public.finance_operation_requests_v1
  set outcome='CREATED',
      result_json=jsonb_build_object(
        'transactionIds',to_jsonb(v_tx_ids),
        'direction',v_direction,
        'sourceDocumentId',v_source_id,
        'openItemId',case when v_open_item_id is null then null else v_open_item_id::text end,
        'payableMovementId',v_payable_movement_id
      ),
      completed_at=now()
  where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
    and accounting_period_id=v_period and idempotency_key=v_idem;

  return query select 'CREATED',v_operation_id,v_tx_ids,null::text;
end;
$function$;

alter function public.persist_finance_opening_balance_v1(jsonb,text,text)
owner to postgres;

revoke all
on function public.persist_finance_opening_balance_v1(jsonb,text,text)
from public,anon,authenticated,service_role;

grant execute
on function public.persist_finance_opening_balance_v1(jsonb,text,text)
to service_role;

commit;
