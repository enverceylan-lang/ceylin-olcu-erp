begin;

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
      ft.reversed_at
    from public.finance_transactions ft
    where ft.tenant_id = v_tenant
      and ft.company_id = v_company
      and ft.branch_id = v_branch
      and ft.accounting_period_id = v_period
      and ft.currency = v_currency
      and exists (
        select 1
        from scoped_allocations ca
        where ca.transaction_id = ft.transaction_id
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
          'reversedAt', reversed_at
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
      'reservedTotal', om.reserved_total,
      'currentBalance', om.current_balance,
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
        mi.missing_metadata_count = 0 and
        om.allocated_amount_total is not distinct from am.active_allocation_total and
        dm.total_open_amount is not distinct from om.current_balance,
      'reason',
        case
          when om.invalid_item_count <> 0 then 'OPEN_ITEM_AMOUNT_INTEGRITY_FAILED'
          when am.invalid_allocation_count <> 0 then 'ALLOCATION_AMOUNT_INTEGRITY_FAILED'
          when mi.missing_metadata_count <> 0 then 'ALLOCATION_TRANSACTION_METADATA_MISSING'
          when om.allocated_amount_total is distinct from am.active_allocation_total then 'ALLOCATED_TOTAL_MISMATCH'
          when dm.total_open_amount is distinct from om.current_balance then 'DUE_BALANCE_MISMATCH'
          else null
        end
    )
  )
  into v_result
  from open_metrics om
  cross join allocation_metrics am
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

commit;