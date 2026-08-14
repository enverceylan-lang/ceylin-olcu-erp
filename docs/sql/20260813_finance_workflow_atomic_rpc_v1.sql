-- ENVERP FINANCE WORKFLOW ATOMIC RPC V1
-- Local migration source. Apply to live Supabase only after explicit approval.
-- Source snapshot + finance transaction + finance audit run in one DB transaction.

begin;

create or replace function public.persist_finance_system_workflow_v1(
  p_workflow text,
  p_source jsonb,
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
  v_outcome text;
  v_transaction_id text;
  v_reason text;
  v_marker text := 'ENVERP_FINANCE_WORKFLOW_CONFLICT_ROLLBACK';
  v_error_message text;
  v_existing_sale public.finance_sale_workflow_sources%rowtype;
  v_existing_return public.finance_sale_return_workflow_sources%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception
      using message = 'FINANCE_WORKFLOW_FORBIDDEN:SERVICE_ROLE_REQUIRED';
  end if;

  if p_workflow not in ('SALE_APPROVAL', 'SALE_RETURN_APPROVAL') then
    raise exception using message = 'FINANCE_WORKFLOW_INVALID';
  end if;

  if p_source is null or jsonb_typeof(p_source) <> 'object' then
    raise exception using message = 'FINANCE_WORKFLOW_SOURCE_PAYLOAD_REQUIRED';
  end if;

  if p_transaction is null or jsonb_typeof(p_transaction) <> 'object' then
    raise exception using message = 'FINANCE_TRANSACTION_PAYLOAD_REQUIRED';
  end if;

  if p_audit is null or jsonb_typeof(p_audit) <> 'object' then
    raise exception using message = 'FINANCE_AUDIT_PAYLOAD_REQUIRED';
  end if;

  if
    p_source ->> 'tenant_id' is distinct from p_transaction ->> 'tenant_id' or
    p_source ->> 'company_id' is distinct from p_transaction ->> 'company_id' or
    p_source ->> 'branch_id' is distinct from p_transaction ->> 'branch_id' or
    p_source ->> 'accounting_period_id' is distinct from p_transaction ->> 'accounting_period_id' or
    p_audit ->> 'tenant_id' is distinct from p_transaction ->> 'tenant_id' or
    p_audit ->> 'company_id' is distinct from p_transaction ->> 'company_id' or
    p_audit ->> 'branch_id' is distinct from p_transaction ->> 'branch_id' or
    p_audit ->> 'accounting_period_id' is distinct from p_transaction ->> 'accounting_period_id'
  then
    raise exception using message = 'FINANCE_WORKFLOW_SCOPE_MISMATCH';
  end if;

  if p_source ->> 'status' is distinct from 'ONAYLANDI' then
    raise exception using message = 'FINANCE_WORKFLOW_SOURCE_STATUS_INVALID';
  end if;

  if p_workflow = 'SALE_APPROVAL' then
    if
      p_source ->> 'sale_id' is distinct from p_transaction ->> 'sale_id' or
      p_source ->> 'customer_id' is distinct from p_transaction ->> 'customer_id' or
      (p_source ->> 'total_amount')::numeric is distinct from
        (p_transaction ->> 'net_amount')::numeric or
      p_source ->> 'approved_by_user_id' is distinct from
        p_transaction ->> 'created_by'
    then
      raise exception using message = 'FINANCE_WORKFLOW_SOURCE_MISMATCH';
    end if;
  else
    if
      p_source ->> 'sale_return_id' is distinct from
        p_transaction ->> 'source_document_id' or
      p_source ->> 'sale_id' is distinct from p_transaction ->> 'sale_id' or
      p_source ->> 'customer_id' is distinct from p_transaction ->> 'customer_id' or
      (p_source ->> 'amount')::numeric is distinct from
        (p_transaction ->> 'net_amount')::numeric or
      p_source ->> 'actor_user_id' is distinct from
        p_transaction ->> 'created_by'
    then
      raise exception using message = 'FINANCE_WORKFLOW_SOURCE_MISMATCH';
    end if;
  end if;

  begin
    if p_workflow = 'SALE_APPROVAL' then
      insert into public.finance_sale_workflow_sources (
        tenant_id, company_id, branch_id, accounting_period_id,
        sale_id, customer_id, status, total_amount, currency,
        approved_by_user_id, approved_at, source_version, payload_hash
      )
      values (
        p_source ->> 'tenant_id',
        p_source ->> 'company_id',
        p_source ->> 'branch_id',
        p_source ->> 'accounting_period_id',
        p_source ->> 'sale_id',
        p_source ->> 'customer_id',
        p_source ->> 'status',
        (p_source ->> 'total_amount')::numeric,
        p_source ->> 'currency',
        p_source ->> 'approved_by_user_id',
        (p_source ->> 'approved_at')::timestamptz,
        (p_source ->> 'source_version')::bigint,
        p_source ->> 'payload_hash'
      )
      on conflict (
        tenant_id, company_id, branch_id, accounting_period_id, sale_id
      )
      do nothing;

      select fsws.*
      into v_existing_sale
      from public.finance_sale_workflow_sources as fsws
      where fsws.tenant_id = p_source ->> 'tenant_id'
        and fsws.company_id = p_source ->> 'company_id'
        and fsws.branch_id = p_source ->> 'branch_id'
        and fsws.accounting_period_id = p_source ->> 'accounting_period_id'
        and fsws.sale_id = p_source ->> 'sale_id'
      for update;

      if not found then
        raise exception
          using message = 'FINANCE_WORKFLOW_SOURCE_PERSISTENCE_FAILED';
      end if;

      if
        v_existing_sale.customer_id is distinct from p_source ->> 'customer_id' or
        v_existing_sale.status is distinct from p_source ->> 'status' or
        v_existing_sale.total_amount is distinct from (p_source ->> 'total_amount')::numeric or
        v_existing_sale.currency is distinct from p_source ->> 'currency' or
        v_existing_sale.approved_by_user_id is distinct from p_source ->> 'approved_by_user_id' or
        v_existing_sale.approved_at is distinct from (p_source ->> 'approved_at')::timestamptz or
        v_existing_sale.source_version is distinct from (p_source ->> 'source_version')::bigint or
        v_existing_sale.payload_hash is distinct from p_source ->> 'payload_hash'
      then
        v_outcome := 'CONFLICT';
        v_transaction_id := p_transaction ->> 'transaction_id';
        v_reason := 'SOURCE_DOCUMENT_CONFLICT';
        raise exception using message = v_marker;
      end if;
    else
      insert into public.finance_sale_return_workflow_sources (
        tenant_id, company_id, branch_id, accounting_period_id,
        sale_return_id, sale_id, customer_id, status, amount, currency,
        actor_user_id, approved_at, source_version, payload_hash
      )
      values (
        p_source ->> 'tenant_id',
        p_source ->> 'company_id',
        p_source ->> 'branch_id',
        p_source ->> 'accounting_period_id',
        p_source ->> 'sale_return_id',
        p_source ->> 'sale_id',
        p_source ->> 'customer_id',
        p_source ->> 'status',
        (p_source ->> 'amount')::numeric,
        p_source ->> 'currency',
        p_source ->> 'actor_user_id',
        (p_source ->> 'approved_at')::timestamptz,
        (p_source ->> 'source_version')::bigint,
        p_source ->> 'payload_hash'
      )
      on conflict (
        tenant_id, company_id, branch_id, accounting_period_id, sale_return_id
      )
      do nothing;

      select fsrws.*
      into v_existing_return
      from public.finance_sale_return_workflow_sources as fsrws
      where fsrws.tenant_id = p_source ->> 'tenant_id'
        and fsrws.company_id = p_source ->> 'company_id'
        and fsrws.branch_id = p_source ->> 'branch_id'
        and fsrws.accounting_period_id = p_source ->> 'accounting_period_id'
        and fsrws.sale_return_id = p_source ->> 'sale_return_id'
      for update;

      if not found then
        raise exception
          using message = 'FINANCE_WORKFLOW_SOURCE_PERSISTENCE_FAILED';
      end if;

      if
        v_existing_return.sale_id is distinct from p_source ->> 'sale_id' or
        v_existing_return.customer_id is distinct from p_source ->> 'customer_id' or
        v_existing_return.status is distinct from p_source ->> 'status' or
        v_existing_return.amount is distinct from (p_source ->> 'amount')::numeric or
        v_existing_return.currency is distinct from p_source ->> 'currency' or
        v_existing_return.actor_user_id is distinct from p_source ->> 'actor_user_id' or
        v_existing_return.approved_at is distinct from (p_source ->> 'approved_at')::timestamptz or
        v_existing_return.source_version is distinct from (p_source ->> 'source_version')::bigint or
        v_existing_return.payload_hash is distinct from p_source ->> 'payload_hash'
      then
        v_outcome := 'CONFLICT';
        v_transaction_id := p_transaction ->> 'transaction_id';
        v_reason := 'SOURCE_DOCUMENT_CONFLICT';
        raise exception using message = v_marker;
      end if;
    select
      result.outcome,
      result.transaction_id,
      result.reason
    into
      v_outcome,
      v_transaction_id,
      v_reason
    from public.persist_finance_transaction_v1(
      p_transaction,
      p_audit
    ) as result;

    if v_outcome = 'CONFLICT' then
      raise exception using message = v_marker;
    end if;
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics
        v_error_message = message_text;

      if v_error_message is distinct from v_marker then
        raise;
      end if;
  end;

  return query
  select
    v_outcome,
    v_transaction_id,
    v_reason;
end;
$function$;

revoke all
on function public.persist_finance_system_workflow_v1(text, jsonb, jsonb, jsonb)
from public, anon, authenticated;

grant execute
on function public.persist_finance_system_workflow_v1(text, jsonb, jsonb, jsonb)
to service_role;

commit;