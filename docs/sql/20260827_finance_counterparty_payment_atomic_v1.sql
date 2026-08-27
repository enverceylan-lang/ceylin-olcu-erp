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

begin;

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
     or v_movement_type not in ('SUPPLIER','TAILOR','INSTALLER')
     or v_movement_kind <> 'PAYMENT'
     or v_movement_currency !~ '^[A-Z]{3}$'
     or v_movement_amount is null
     or v_movement_amount <= 0
     or v_movement_source_document is null
     or v_movement_operation is null
     or v_source_payment is null then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_MOVEMENT_INVALID';
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

commit;