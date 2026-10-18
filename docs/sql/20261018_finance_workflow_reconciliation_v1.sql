-- ENVERP FINANCE WORKFLOW RECONCILIATION V1
-- Read-only verification for ambiguous client results
-- No write, no lock, pure read
-- Live apply requires separate explicit approval.

begin;

create or replace function public.reconcile_finance_system_workflow_v1(
  p_workflow text,
  p_scope jsonb,
  p_source_id text,        -- sale_id veya sale_return_id
  p_idempotency_key text,
  p_transaction_id text,
  p_audit_payload_hash text
) returns table (
  outcome text,            -- 'CONFIRMED' | 'CONFLICT' | 'NOT_FOUND' | 'AMBIGUOUS'
  transaction_id text,
  reason text,
  occurred_at timestamptz,
  server_payload_hash text
) language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant text := trim(coalesce(p_scope->>'tenantId',''));
  v_company text := trim(coalesce(p_scope->>'companyId',''));
  v_branch text := trim(coalesce(p_scope->>'branchId',''));
  v_period text := trim(coalesce(p_scope->>'accountingPeriodId',''));
  v_outcome text;
  v_tx_id text;
  v_reason text;
  v_occurred_at timestamptz;
  v_server_hash text;
  v_existing_tx public.finance_transactions%rowtype;
  v_existing_audit public.finance_transaction_audits%rowtype;
  v_found_idempotency_key text;
begin
  -- Scope validation
  if v_tenant = '' or v_company = '' or v_branch = '' or v_period = '' then
    return query select 'NOT_FOUND'::text, null::text, 'SCOPE_REQUIRED'::text, null::timestamptz, null::text;
    return;
  end if;

  if p_workflow not in ('SALE_APPROVAL', 'SALE_RETURN_APPROVAL') then
    return query select 'NOT_FOUND'::text, null::text, 'INVALID_WORKFLOW'::text, null::timestamptz, null::text;
    return;
  end if;

  -- 1. Check finance_transactions by idempotency_key (authoritative for idempotency)
  select ft.*
  into v_existing_tx
  from public.finance_transactions ft
  where ft.tenant_id = v_tenant
    and ft.company_id = v_company
    and ft.branch_id = v_branch
    and ft.accounting_period_id = v_period
    and ft.idempotency_key = p_idempotency_key
  order by ft.created_at desc
  limit 1;

  if not found then
    -- 2. Fallback: check source workflow tables for source_id match
    if p_workflow = 'SALE_APPROVAL' then
      select ft.transaction_id, ft.idempotency_key, fta.payload_hash, ft.posted_at
      into v_tx_id, v_found_idempotency_key, v_server_hash, v_occurred_at
      from public.finance_transactions ft
      join public.finance_transaction_audits fta
        on fta.tenant_id = ft.tenant_id
       and fta.company_id = ft.company_id
       and fta.branch_id = ft.branch_id
       and fta.accounting_period_id = ft.accounting_period_id
       and fta.transaction_id = ft.transaction_id
       and fta.action = 'POSTED'
      where ft.tenant_id = v_tenant
        and ft.company_id = v_company
        and ft.branch_id = v_branch
        and ft.accounting_period_id = v_period
        and ft.projection_source = 'SALE_CHARGE'
        and ft.sale_id = p_source_id
      order by ft.created_at desc
      limit 1;
    else
      select ft.transaction_id, ft.idempotency_key, fta.payload_hash, ft.posted_at
      into v_tx_id, v_found_idempotency_key, v_server_hash, v_occurred_at
      from public.finance_transactions ft
      join public.finance_transaction_audits fta
        on fta.tenant_id = ft.tenant_id
       and fta.company_id = ft.company_id
       and fta.branch_id = ft.branch_id
       and fta.accounting_period_id = ft.accounting_period_id
       and fta.transaction_id = ft.transaction_id
       and fta.action = 'POSTED'
      where ft.tenant_id = v_tenant
        and ft.company_id = v_company
        and ft.branch_id = v_branch
        and ft.accounting_period_id = v_period
        and ft.projection_source = 'SALE_RETURN'
        and ft.sale_id = p_source_id
      order by ft.created_at desc
      limit 1;
    end if;

    if not found then
      return query select 'NOT_FOUND'::text, null::text, 'NO_SERVER_RECORD'::text, null::timestamptz, null::text;
      return;
    end if;

    -- Found by source_id but not by idempotency_key -> check if idempotency_key matches
    if v_found_idempotency_key <> p_idempotency_key then
      return query select 'AMBIGUOUS'::text, v_tx_id, 'IDEMPOTENCY_KEY_MISMATCH'::text, v_occurred_at, v_server_hash;
      return;
    end if;

    -- Same idempotency_key found via source_id -> CONFIRMED
    return query select 'CONFIRMED'::text, v_tx_id, 'RECONCILED_BY_SOURCE_ID'::text, v_occurred_at, v_server_hash;
    return;
  end if;

  -- Found by idempotency_key - verify payload_hash
  select fta.*
  into v_existing_audit
  from public.finance_transaction_audits fta
  where fta.tenant_id = v_tenant
    and fta.company_id = v_company
    and fta.branch_id = v_branch
    and fta.accounting_period_id = v_period
    and fta.transaction_id = v_existing_tx.transaction_id
    and fta.action = 'POSTED'
  limit 1;

  if not found then
    return query select 'CONFLICT'::text, v_existing_tx.transaction_id, 'AUDIT_MISSING'::text, null::timestamptz, null::text;
    return;
  end if;

  -- Check transaction_id match
  if v_existing_tx.transaction_id <> p_transaction_id then
    return query select 'CONFLICT'::text, v_existing_tx.transaction_id, 'TRANSACTION_ID_MISMATCH'::text, v_existing_tx.posted_at, v_existing_audit.payload_hash;
    return;
  end if;

  -- Check payload_hash match
  if v_existing_audit.payload_hash <> p_audit_payload_hash then
    return query select 'CONFLICT'::text, v_existing_tx.transaction_id, 'IDEMPOTENCY_PAYLOAD_CONFLICT'::text, v_existing_tx.posted_at, v_existing_audit.payload_hash;
    return;
  end if;

  -- All matches - CONFIRMED
  return query select 'CONFIRMED'::text, v_existing_tx.transaction_id, 'RECONCILED'::text, v_existing_tx.posted_at, v_existing_audit.payload_hash;
end;
$$;

revoke all on function public.reconcile_finance_system_workflow_v1(text,jsonb,text,text,text,text) from public, anon, authenticated;
grant execute on function public.reconcile_finance_system_workflow_v1(text,jsonb,text,text,text,text) to service_role;

commit;