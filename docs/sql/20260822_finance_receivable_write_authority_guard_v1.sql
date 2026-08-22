-- ENVERP - FINANCE RECEIVABLE WRITE AUTHORITY GUARD V1
-- SOURCE ONLY. DO NOT APPLY TO LIVE DATABASE WITHOUT SEPARATE EXPLICIT APPROVAL.
--
-- Purpose:
-- 1) Generic finance operation RPC may no longer create customer COLLECTION.
--    Customer collection authority is persist_finance_collection_v1 only.
-- 2) SALE_RETURN_APPROVAL may not post while the sale still has canonical
--    OPEN/PARTIAL receivable. Until a dedicated return-allocation model exists,
--    the system fails closed instead of leaving customer open items incorrect.
--
-- No physical finance delete. No balance overwrite. Existing finance core
-- functions remain the underlying authorities.

begin;

do $preflight$
begin
  if to_regprocedure('public.persist_finance_operation_v1(jsonb,text,text)') is null
     and to_regprocedure('public.persist_finance_operation_core_v1(jsonb,text,text)') is null then
    raise exception 'FINANCE_RECEIVABLE_GUARD_GENERIC_OPERATION_MISSING';
  end if;

  if to_regprocedure('public.persist_finance_system_workflow_core_v1(text,jsonb,jsonb,jsonb)') is null then
    raise exception 'FINANCE_RECEIVABLE_GUARD_WORKFLOW_CORE_MISSING';
  end if;

  if to_regclass('public.finance_receivable_open_items_v1') is null then
    raise exception 'FINANCE_RECEIVABLE_GUARD_OPEN_ITEMS_MISSING';
  end if;
end
$preflight$;

-- Preserve the existing generic RPC as core exactly once.
do $rename_generic$
begin
  if to_regprocedure('public.persist_finance_operation_core_v1(jsonb,text,text)') is null then
    alter function public.persist_finance_operation_v1(jsonb,text,text)
      rename to persist_finance_operation_core_v1;
  end if;
end
$rename_generic$;

create or replace function public.persist_finance_operation_v1(
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
set search_path=pg_catalog,public
as $function$
declare
  v_kind text := upper(trim(coalesce(p_operation->>'kind','')));
  v_operation_id text := nullif(trim(coalesce(p_operation->>'operationId','')),'');
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FINANCE_OPERATION_FORBIDDEN:SERVICE_ROLE_REQUIRED';
  end if;

  if v_kind='COLLECTION' then
    return query
    select
      'REJECT'::text,
      v_operation_id,
      null::text[],
      'FINANCE_COLLECTION_CANONICAL_COMMAND_REQUIRED'::text;
    return;
  end if;

  return query
  select
    r.outcome,
    r.operation_id,
    r.transaction_ids,
    r.reason
  from public.persist_finance_operation_core_v1(
    p_operation,
    p_actor_user_id,
    p_payload_hash
  ) r;
end;
$function$;

revoke all on function public.persist_finance_operation_v1(jsonb,text,text)
from public,anon,authenticated;

grant execute on function public.persist_finance_operation_v1(jsonb,text,text)
to service_role;

-- Replace only the already-existing outer workflow wrapper.
-- SALE_APPROVAL keeps its receivable registration behavior.
-- SALE_RETURN_APPROVAL with remaining receivable is fail-closed.
create or replace function public.persist_finance_system_workflow_v1(
  p_workflow text,
  p_source jsonb,
  p_transaction jsonb,
  p_audit jsonb
)
returns table(outcome text,transaction_id text,reason text)
language plpgsql
security definer
set search_path=pg_catalog,public
as $function$
declare
  v_outcome text;
  v_transaction text;
  v_reason text;
  v_tenant text := trim(coalesce(p_source->>'tenant_id',''));
  v_company text := trim(coalesce(p_source->>'company_id',''));
  v_branch text := trim(coalesce(p_source->>'branch_id',''));
  v_period text := trim(coalesce(p_source->>'accounting_period_id',''));
  v_sale text := trim(coalesce(p_source->>'sale_id',''));
  v_customer text := trim(coalesce(p_source->>'customer_id',''));
  v_currency text := upper(trim(coalesce(p_source->>'currency','')));
  v_open_receivable numeric := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FINANCE_WORKFLOW_FORBIDDEN:SERVICE_ROLE_REQUIRED';
  end if;

  select r.outcome,r.transaction_id,r.reason
  into v_outcome,v_transaction,v_reason
  from public.persist_finance_system_workflow_core_v1(
    p_workflow,p_source,p_transaction,p_audit
  ) r;

  if p_workflow='SALE_APPROVAL' and v_outcome in ('CREATED','REPLAY') then
    perform public.register_finance_sale_receivables_v1(p_source);
  elsif p_workflow='SALE_RETURN_APPROVAL' and v_outcome in ('CREATED','REPLAY') then
    if
      v_tenant='' or v_company='' or v_branch='' or v_period='' or
      v_sale='' or v_customer='' or v_currency !~ '^[A-Z]{3}$'
    then
      raise exception 'FINANCE_SALE_RETURN_RECEIVABLE_SCOPE_INVALID';
    end if;

    select coalesce(sum(
      oi.original_amount - oi.allocated_amount - oi.reserved_amount
    ),0)
    into v_open_receivable
    from public.finance_receivable_open_items_v1 oi
    where oi.tenant_id=v_tenant
      and oi.company_id=v_company
      and oi.branch_id=v_branch
      and oi.accounting_period_id=v_period
      and oi.sale_id=v_sale
      and oi.customer_id=v_customer
      and oi.currency=v_currency
      and oi.status in ('OPEN','PARTIAL');

    if v_open_receivable > 0 then
      raise exception
        'FINANCE_SALE_RETURN_OPEN_RECEIVABLE_ADJUSTMENT_REQUIRED';
    end if;
  end if;

  return query select v_outcome,v_transaction,v_reason;
end;
$function$;

revoke all on function public.persist_finance_system_workflow_v1(text,jsonb,jsonb,jsonb)
from public,anon,authenticated;

grant execute on function public.persist_finance_system_workflow_v1(text,jsonb,jsonb,jsonb)
to service_role;

do $verify$
declare
  v_generic oid;
  v_workflow oid;
begin
  v_generic := to_regprocedure('public.persist_finance_operation_v1(jsonb,text,text)');
  v_workflow := to_regprocedure('public.persist_finance_system_workflow_v1(text,jsonb,jsonb,jsonb)');

  if v_generic is null or v_workflow is null then
    raise exception 'FINANCE_RECEIVABLE_GUARD_VERIFY_FUNCTION_MISSING';
  end if;

  if has_function_privilege('anon',v_generic,'EXECUTE')
     or has_function_privilege('authenticated',v_generic,'EXECUTE')
     or has_function_privilege('anon',v_workflow,'EXECUTE')
     or has_function_privilege('authenticated',v_workflow,'EXECUTE') then
    raise exception 'FINANCE_RECEIVABLE_GUARD_VERIFY_UNAUTHORIZED_EXECUTE';
  end if;

  if not has_function_privilege('service_role',v_generic,'EXECUTE')
     or not has_function_privilege('service_role',v_workflow,'EXECUTE') then
    raise exception 'FINANCE_RECEIVABLE_GUARD_VERIFY_SERVICE_ROLE_EXECUTE_MISSING';
  end if;
end
$verify$;

commit;