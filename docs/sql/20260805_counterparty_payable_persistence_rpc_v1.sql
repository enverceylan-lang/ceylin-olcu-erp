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
    v_counterparty_type not in ('SUPPLIER','TAILOR','INSTALLER') or
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