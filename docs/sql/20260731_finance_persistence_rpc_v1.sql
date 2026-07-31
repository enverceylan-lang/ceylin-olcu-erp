-- ============================================================
-- ENVERP FINANCE PERSISTENCE RPC V1
-- DURUM: TASLAK
-- CANLI SUPABASE'E UYGULANMAYACAKTIR.
--
-- Önkoşul:
-- docs/sql/20260731_finance_persistence_foundation_v1.sql
--
-- Amaç:
-- finance_transactions + finance_transaction_audits kayıtlarını
-- tek PostgreSQL transaction içinde atomik ve idempotent yazmak.
--
-- Güvenlik:
-- - yalnız service_role çalıştırabilir,
-- - anon/authenticated doğrudan çalıştıramaz,
-- - scope alanlarında fallback yoktur,
-- - fiziksel silme yoktur,
-- - aynı idempotency key farklı payload ile gelirse conflict döner.
-- ============================================================

begin;

create or replace function public.persist_finance_transaction_v1(
  p_transaction jsonb,
  p_audit jsonb
)
returns table (
  outcome text,
  transaction_id text,
  reason text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_existing public.finance_transactions%rowtype;
  v_existing_audit public.finance_transaction_audits%rowtype;
  v_transaction_id text;
  v_idempotency_key text;
  v_tenant_id text;
  v_company_id text;
  v_branch_id text;
  v_accounting_period_id text;
  v_payload_hash text;
begin
  if p_transaction is null or
     jsonb_typeof(p_transaction) <> 'object' then
    raise exception
      using message = 'FINANCE_TRANSACTION_PAYLOAD_REQUIRED';
  end if;

  if p_audit is null or
     jsonb_typeof(p_audit) <> 'object' then
    raise exception
      using message = 'FINANCE_AUDIT_PAYLOAD_REQUIRED';
  end if;

  v_transaction_id =
    nullif(btrim(p_transaction ->> 'transaction_id'), '');

  v_idempotency_key =
    nullif(btrim(p_transaction ->> 'idempotency_key'), '');

  v_tenant_id =
    nullif(btrim(p_transaction ->> 'tenant_id'), '');

  v_company_id =
    nullif(btrim(p_transaction ->> 'company_id'), '');

  v_branch_id =
    nullif(btrim(p_transaction ->> 'branch_id'), '');

  v_accounting_period_id =
    nullif(btrim(p_transaction ->> 'accounting_period_id'), '');

  v_payload_hash =
    nullif(btrim(p_audit ->> 'payload_hash'), '');

  if v_transaction_id is null then
    raise exception
      using message = 'FINANCE_TRANSACTION_ID_REQUIRED';
  end if;

  if v_idempotency_key is null then
    raise exception
      using message = 'FINANCE_IDEMPOTENCY_KEY_REQUIRED';
  end if;

  if v_tenant_id is null or
     v_company_id is null or
     v_branch_id is null or
     v_accounting_period_id is null then
    raise exception
      using message = 'FINANCE_SCOPE_REQUIRED';
  end if;

  if v_payload_hash is null then
    raise exception
      using message = 'FINANCE_PAYLOAD_HASH_REQUIRED';
  end if;

  if
    p_audit ->> 'transaction_id' is distinct from
      v_transaction_id or
    p_audit ->> 'idempotency_key' is distinct from
      v_idempotency_key or
    p_audit ->> 'tenant_id' is distinct from
      v_tenant_id or
    p_audit ->> 'company_id' is distinct from
      v_company_id or
    p_audit ->> 'branch_id' is distinct from
      v_branch_id or
    p_audit ->> 'accounting_period_id' is distinct from
      v_accounting_period_id
  then
    raise exception
      using message = 'FINANCE_AUDIT_TRANSACTION_MISMATCH';
  end if;

  select *
  into v_existing
  from public.finance_transactions
  where tenant_id = v_tenant_id
    and company_id = v_company_id
    and branch_id = v_branch_id
    and accounting_period_id = v_accounting_period_id
    and idempotency_key = v_idempotency_key
  for update;

  if found then
    select *
    into v_existing_audit
    from public.finance_transaction_audits
    where tenant_id = v_tenant_id
      and company_id = v_company_id
      and branch_id = v_branch_id
      and accounting_period_id = v_accounting_period_id
      and transaction_id = v_existing.transaction_id
      and action = 'POSTED';

    if not found then
      raise exception
        using message = 'FINANCE_AUDIT_MISSING';
    end if;

    if
      v_existing.transaction_id <> v_transaction_id or
      v_existing_audit.payload_hash <> v_payload_hash
    then
      return query
      select
        'CONFLICT'::text,
        v_existing.transaction_id,
        'IDEMPOTENCY_PAYLOAD_CONFLICT'::text;

      return;
    end if;

    return query
    select
      'REPLAY'::text,
      v_existing.transaction_id,
      null::text;

    return;
  end if;

  begin
    insert into public.finance_transactions (
      id,
      transaction_id,
      idempotency_key,
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      transaction_type,
      direction,
      payment_method,
      finance_account_id,
      counter_account_id,
      customer_id,
      sale_id,
      source_document_id,
      source_document_type,
      gross_amount,
      commission_amount,
      net_amount,
      currency,
      transaction_date,
      value_date,
      due_date,
      status,
      description,
      external_reference,
      reversal_of_transaction_id,
      created_by,
      created_at,
      posted_at,
      reversed_at,
      archived_at,
      projection_source
    )
    values (
      p_transaction ->> 'id',
      v_transaction_id,
      v_idempotency_key,
      v_tenant_id,
      v_company_id,
      v_branch_id,
      v_accounting_period_id,
      p_transaction ->> 'transaction_type',
      p_transaction ->> 'direction',
      nullif(p_transaction ->> 'payment_method', ''),
      nullif(p_transaction ->> 'finance_account_id', ''),
      nullif(p_transaction ->> 'counter_account_id', ''),
      p_transaction ->> 'customer_id',
      p_transaction ->> 'sale_id',
      p_transaction ->> 'source_document_id',
      p_transaction ->> 'source_document_type',
      (p_transaction ->> 'gross_amount')::numeric,
      (p_transaction ->> 'commission_amount')::numeric,
      (p_transaction ->> 'net_amount')::numeric,
      p_transaction ->> 'currency',
      (p_transaction ->> 'transaction_date')::date,
      nullif(p_transaction ->> 'value_date', '')::date,
      nullif(p_transaction ->> 'due_date', '')::date,
      p_transaction ->> 'status',
      nullif(p_transaction ->> 'description', ''),
      nullif(p_transaction ->> 'external_reference', ''),
      nullif(p_transaction ->> 'reversal_of_transaction_id', ''),
      p_transaction ->> 'created_by',
      (p_transaction ->> 'created_at')::timestamptz,
      nullif(p_transaction ->> 'posted_at', '')::timestamptz,
      nullif(p_transaction ->> 'reversed_at', '')::timestamptz,
      nullif(p_transaction ->> 'archived_at', '')::timestamptz,
      p_transaction ->> 'projection_source'
    );

    insert into public.finance_transaction_audits (
      id,
      transaction_id,
      idempotency_key,
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      action,
      actor_user_id,
      customer_id,
      sale_id,
      occurred_at,
      payload_hash
    )
    values (
      p_audit ->> 'id',
      p_audit ->> 'transaction_id',
      p_audit ->> 'idempotency_key',
      p_audit ->> 'tenant_id',
      p_audit ->> 'company_id',
      p_audit ->> 'branch_id',
      p_audit ->> 'accounting_period_id',
      p_audit ->> 'action',
      p_audit ->> 'actor_user_id',
      p_audit ->> 'customer_id',
      p_audit ->> 'sale_id',
      (p_audit ->> 'occurred_at')::timestamptz,
      p_audit ->> 'payload_hash'
    );
  exception
    when unique_violation then
      return query
      select
        'CONFLICT'::text,
        v_transaction_id,
        'SOURCE_DOCUMENT_CONFLICT'::text;

      return;
  end;

  return query
  select
    'CREATED'::text,
    v_transaction_id,
    null::text;
end;
$function$;

revoke all
on function public.persist_finance_transaction_v1(jsonb, jsonb)
from public, anon, authenticated;

grant execute
on function public.persist_finance_transaction_v1(jsonb, jsonb)
to service_role;

commit;