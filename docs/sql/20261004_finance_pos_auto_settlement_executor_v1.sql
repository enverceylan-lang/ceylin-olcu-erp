-- ENVERP - POS AUTO SETTLEMENT EXECUTOR V1
-- SOURCE ONLY. Live apply requires separate explicit approval.
-- Canonical day policy for V1: CALENDAR_DAY.
-- This successor does not rewrite historical migrations.
-- It reuses persist_finance_pos_authority_v1 for all financial posting.

create or replace function public.finance_deterministic_uuid_v1(p_seed text)
returns uuid
language sql
immutable
strict
as $function$
  select (
    substr(md5(p_seed),1,8) || '-' ||
    substr(md5(p_seed),9,4) || '-' ||
    substr(md5(p_seed),13,4) || '-' ||
    substr(md5(p_seed),17,4) || '-' ||
    substr(md5(p_seed),21,12)
  )::uuid;
$function$;

revoke all on function public.finance_deterministic_uuid_v1(text)
from public, anon, authenticated;

create or replace function public.run_finance_pos_auto_settlement_v1(
  p_effective_date date default current_date,
  p_limit integer default 100
)
returns table(
  claimed_count integer,
  created_count integer,
  replay_count integer,
  rejected_count integer,
  conflict_count integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_claimed integer := 0;
  v_created integer := 0;
  v_replayed integer := 0;
  v_rejected integer := 0;
  v_conflict integer := 0;

  v_operation_id uuid;
  v_settlement_id uuid;
  v_idempotency_key text;
  v_settlement_number text;
  v_occurred_at timestamptz;
  v_operation jsonb;
  v_payload_hash text;

  v_outcome text;
  v_result_operation_id text;
  v_transaction_ids text[];
  v_reason text;

  r record;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FINANCE_POS_AUTO_SETTLEMENT_SERVICE_ROLE_REQUIRED';
  end if;

  if p_effective_date is null then
    raise exception 'FINANCE_POS_AUTO_SETTLEMENT_EFFECTIVE_DATE_REQUIRED';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'FINANCE_POS_AUTO_SETTLEMENT_LIMIT_INVALID';
  end if;

  for r in
    select
      l.id as schedule_line_id,
      l.transaction_id,
      l.tenant_id,
      l.company_id,
      l.branch_id,
      l.accounting_period_id,
      l.expected_settlement_date,
      l.pending_amount
    from public.finance_pos_settlement_lines_v1 l
    join public.finance_pos_transactions_v1 t
      on t.tenant_id = l.tenant_id
     and t.company_id = l.company_id
     and t.branch_id = l.branch_id
     and t.accounting_period_id = l.accounting_period_id
     and t.id = l.transaction_id
    where l.expected_settlement_date <= p_effective_date
      and l.status in ('PENDING','PARTIALLY_SETTLED')
      and l.pending_amount > 0
      and l.reversed_at is null
      and t.status in ('PENDING_SETTLEMENT','PARTIALLY_SETTLED')
      and t.reversed_at is null
    order by l.expected_settlement_date, l.id
    limit p_limit
    for update of l skip locked
  loop
    v_claimed := v_claimed + 1;

    -- Same due line + same effective date => same operation identity.
    -- A rejected line may be retried on a later date after configuration is fixed.
    v_idempotency_key :=
      'POS:AUTO_SETTLE:' || r.schedule_line_id::text || ':' || p_effective_date::text;

    v_operation_id :=
      public.finance_deterministic_uuid_v1(
        'POS:AUTO_SETTLE:OP:' || r.schedule_line_id::text || ':' || p_effective_date::text
      );

    v_settlement_id :=
      public.finance_deterministic_uuid_v1(
        'POS:AUTO_SETTLE:SETTLEMENT:' || r.schedule_line_id::text
      );

    v_settlement_number :=
      'AUTO-POS-' || replace(r.schedule_line_id::text, '-', '');

    -- Finance date stays on the canonical due date, even if the worker catches up later.
    -- V1 day policy is explicitly CALENDAR_DAY.
    v_occurred_at :=
      (r.expected_settlement_date::text || ' 12:00:00+03')::timestamptz;

    v_operation := jsonb_build_object(
      'tenantId', r.tenant_id,
      'companyId', r.company_id,
      'branchId', r.branch_id,
      'accountingPeriodId', r.accounting_period_id,
      'operationId', v_operation_id::text,
      'idempotencyKey', v_idempotency_key,
      'action', 'SETTLE_TRANSACTION',
      'occurredAt', to_char(v_occurred_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
      'settlement', jsonb_build_object(
        'transactionId', r.transaction_id::text,
        'scheduleLineId', r.schedule_line_id::text,
        'settlementId', v_settlement_id::text,
        'settlementNumber', v_settlement_number,
        'amount', round(r.pending_amount, 2),
        'settlementDate', r.expected_settlement_date::text,
        'description', 'Automatic POS settlement'
      )
    );

    v_payload_hash := md5(v_operation::text);

    select
      x.outcome,
      x.operation_id,
      x.transaction_ids,
      x.reason
    into
      v_outcome,
      v_result_operation_id,
      v_transaction_ids,
      v_reason
    from public.persist_finance_pos_authority_v1(
      v_operation,
      'SYSTEM:POS_AUTO_SETTLEMENT',
      v_payload_hash
    ) x;

    if v_outcome = 'CREATED' then
      v_created := v_created + 1;
    elsif v_outcome = 'REPLAY' then
      v_replayed := v_replayed + 1;
    elsif v_outcome = 'REJECT' then
      v_rejected := v_rejected + 1;
    elsif v_outcome = 'CONFLICT' then
      v_conflict := v_conflict + 1;
    else
      raise exception
        'FINANCE_POS_AUTO_SETTLEMENT_UNKNOWN_OUTCOME:%',
        coalesce(v_outcome, 'NULL');
    end if;
  end loop;

  return query
  select
    v_claimed,
    v_created,
    v_replayed,
    v_rejected,
    v_conflict;
end;
$function$;

revoke all on function public.run_finance_pos_auto_settlement_v1(date,integer)
from public, anon, authenticated;

grant execute on function public.run_finance_pos_auto_settlement_v1(date,integer)
to service_role;
