-- ENVerp Finance F2 - Atomic Counterparty Payment Reversal V1
-- SOURCE ONLY. Live apply requires separate explicit live-SQL approval.
--
-- CASH/BANK PAYMENT reversal must reverse:
--   1) canonical finance transaction authority
--   2) canonical counterparty payable movement authority
-- in one PostgreSQL transaction.
--
-- No physical delete. No direct balance mutation. No fallback.

begin;

create or replace function public.persist_finance_counterparty_payment_reversal_v1(
  p_operation jsonb,
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
  v_target text := nullif(btrim(coalesce(p_operation->>'reversalOfTransactionId','')), '');
  v_occurred_at timestamptz := nullif(p_operation->>'occurredAt','')::timestamptz;

  v_source_finance public.finance_transactions%rowtype;
  v_source_payable public.counterparty_payable_movements%rowtype;
  v_source_finance_count integer;
  v_source_payable_count integer;

  v_movement jsonb;
  v_audit jsonb;

  v_finance_outcome text;
  v_finance_operation_id text;
  v_finance_transaction_ids text[];
  v_finance_reason text;

  v_payable_outcome text;
  v_payable_movement_id text;
  v_payable_reason text;

  v_reversal_movement_id text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_SERVICE_ROLE_REQUIRED';
  end if;

  if p_operation is null
     or jsonb_typeof(p_operation) <> 'object'
     or p_audit is null
     or jsonb_typeof(p_audit) <> 'object' then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_PAYLOAD_REQUIRED';
  end if;

  if v_tenant is null
     or v_company is null
     or v_branch is null
     or v_period is null
     or v_operation_id is null
     or v_idem is null
     or v_occurred_at is null
     or v_target is null then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_OPERATION_INVALID';
  end if;

  if v_kind <> 'PAYMENT'
     or v_action <> 'REVERSE'
     or v_channel not in ('CASH','BANK') then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_KIND_CHANNEL_FORBIDDEN';
  end if;

  if nullif(btrim(coalesce(p_actor_user_id,'')), '') is null
     or nullif(btrim(coalesce(p_payload_hash,'')), '') is null
     or nullif(btrim(coalesce(p_audit->>'actorUserId','')), '') is distinct from
        nullif(btrim(coalesce(p_actor_user_id,'')), '') then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_AUDIT_INVALID';
  end if;

  select count(*)
  into v_source_finance_count
  from public.finance_transactions ft
  where ft.tenant_id = v_tenant
    and ft.company_id = v_company
    and ft.branch_id = v_branch
    and ft.accounting_period_id = v_period
    and (ft.operation_group_id = v_target or ft.transaction_id = v_target)
    and ft.projection_source = 'PAYMENT'
    and ft.transaction_type <> 'REVERSAL'
    and ft.counterparty_id is not null
    and ft.payment_method = v_channel;

  if v_source_finance_count <> 1 then
    raise exception
      'FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_SOURCE_FINANCE_AMBIGUOUS:%',
      v_source_finance_count;
  end if;

  select ft.*
  into strict v_source_finance
  from public.finance_transactions ft
  where ft.tenant_id = v_tenant
    and ft.company_id = v_company
    and ft.branch_id = v_branch
    and ft.accounting_period_id = v_period
    and (ft.operation_group_id = v_target or ft.transaction_id = v_target)
    and ft.projection_source = 'PAYMENT'
    and ft.transaction_type <> 'REVERSAL'
    and ft.counterparty_id is not null
    and ft.payment_method = v_channel;

  if v_source_finance.operation_group_id is null
     or v_source_finance.source_document_id is null
     or v_source_finance.currency is null
     or v_source_finance.gross_amount is null
     or v_source_finance.gross_amount <= 0 then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_SOURCE_FINANCE_INVALID';
  end if;

  select count(*)
  into v_source_payable_count
  from public.counterparty_payable_movements pm
  where pm.tenant_id = v_tenant
    and pm.company_id = v_company
    and pm.branch_id = v_branch
    and pm.accounting_period_id = v_period
    and pm.counterparty_customer_id = v_source_finance.counterparty_id
    and pm.movement_kind = 'PAYMENT'
    and pm.source_payment_id = v_source_finance.operation_group_id
    and pm.source_document_id = v_source_finance.source_document_id
    and pm.currency = v_source_finance.currency
    and pm.amount = v_source_finance.gross_amount;

  if v_source_payable_count <> 1 then
    raise exception
      'FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_SOURCE_PAYABLE_AMBIGUOUS:%',
      v_source_payable_count;
  end if;

  select pm.*
  into strict v_source_payable
  from public.counterparty_payable_movements pm
  where pm.tenant_id = v_tenant
    and pm.company_id = v_company
    and pm.branch_id = v_branch
    and pm.accounting_period_id = v_period
    and pm.counterparty_customer_id = v_source_finance.counterparty_id
    and pm.movement_kind = 'PAYMENT'
    and pm.source_payment_id = v_source_finance.operation_group_id
    and pm.source_document_id = v_source_finance.source_document_id
    and pm.currency = v_source_finance.currency
    and pm.amount = v_source_finance.gross_amount;

  v_reversal_movement_id := v_operation_id || ':PAYABLE-REVERSAL';

  v_movement := jsonb_build_object(
    'movementId', v_reversal_movement_id,
    'tenantId', v_tenant,
    'companyId', v_company,
    'branchId', v_branch,
    'accountingPeriodId', v_period,
    'counterpartyCustomerId', v_source_payable.counterparty_customer_id,
    'counterpartyType', v_source_payable.counterparty_type,
    'idempotencyKey', v_idem || ':PAYABLE-REVERSAL',
    'kind', 'REVERSAL',
    'amount', v_source_payable.amount,
    'currency', v_source_payable.currency,
    'occurredAt', v_occurred_at,
    'recordedAt', v_occurred_at,
    'sourceDocumentId', v_source_payable.source_document_id,
    'operationId', v_operation_id,
    'sourcePaymentId', v_source_payable.source_payment_id,
    'reversalOfMovementId', v_source_payable.movement_id,
    'note', nullif(btrim(coalesce(p_operation->>'description','')), '')
  );

  v_audit := jsonb_build_object(
    'actorUserId', p_actor_user_id,
    'action', 'CREATE',
    'occurredAt', v_occurred_at,
    'source', 'FINANCE_COUNTERPARTY_PAYMENT_REVERSAL'
  );

  select x.outcome, x.operation_id, x.transaction_ids, x.reason
  into
    v_finance_outcome,
    v_finance_operation_id,
    v_finance_transaction_ids,
    v_finance_reason
  from public.persist_finance_operation_v1(
    p_operation,
    p_actor_user_id,
    p_payload_hash
  ) x;

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
      'FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_FINANCE_OUTCOME_INVALID:%',
      v_finance_outcome;
  end if;

  select x.outcome, x.movement_id, x.reason
  into v_payable_outcome, v_payable_movement_id, v_payable_reason
  from public.persist_counterparty_payable_movement_v1(
    v_movement,
    v_audit
  ) x;

  if v_payable_outcome not in ('CREATED','REPLAY') then
    raise exception
      'FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_PAYABLE_FAILED:%:%',
      v_payable_outcome,
      coalesce(v_payable_reason,'');
  end if;

  if v_finance_outcome is distinct from v_payable_outcome then
    raise exception
      'FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_OUTCOME_MISMATCH:FINANCE=%:PAYABLE=%',
      v_finance_outcome,
      v_payable_outcome;
  end if;

  if v_finance_operation_id is distinct from v_operation_id
     or v_payable_movement_id is distinct from v_reversal_movement_id then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_IDENTITY_MISMATCH';
  end if;

  return query
  select
    v_finance_outcome,
    v_finance_operation_id,
    v_finance_transaction_ids,
    v_payable_movement_id,
    null::text;
end
$function$;

alter function public.persist_finance_counterparty_payment_reversal_v1(
  jsonb,jsonb,text,text
) owner to postgres;

revoke all
  on function public.persist_finance_counterparty_payment_reversal_v1(
    jsonb,jsonb,text,text
  )
  from public, anon, authenticated, service_role;

grant execute
  on function public.persist_finance_counterparty_payment_reversal_v1(
    jsonb,jsonb,text,text
  )
  to service_role;

commit;