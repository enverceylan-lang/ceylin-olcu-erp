-- ENVerp Finance F3 Canonical Overview Snapshot V1
-- SOURCE PATCH ONLY. Live apply requires separate explicit authorization.
-- Read-only company/branch/period/currency snapshot.
-- No fallback, no mutation, no locks.

begin;

create or replace function public.read_finance_overview_snapshot_v1(
  p_scope jsonb,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_tenant text := nullif(btrim(coalesce(p_scope->>'tenantId','')), '');
  v_company text := nullif(btrim(coalesce(p_scope->>'companyId','')), '');
  v_branch text := nullif(btrim(coalesce(p_scope->>'branchId','')), '');
  v_period text := nullif(btrim(coalesce(p_scope->>'accountingPeriodId','')), '');
  v_currency text := upper(btrim(coalesce(p_currency,'')));
  v_as_of timestamptz := clock_timestamp();

  v_original_debt numeric(18,2);
  v_allocated_total numeric(18,2);
  v_reserved_total numeric(18,2);
  v_open_balance numeric(18,2);
  v_open_item_count integer;

  v_overdue numeric(18,2);
  v_due_today numeric(18,2);
  v_future numeric(18,2);

  v_active_collection_total numeric(18,2);
  v_active_allocation_total numeric(18,2);
  v_unallocated_credit numeric(18,2);
  v_customer_net numeric(18,2);

  v_payable_accrual numeric(18,2);
  v_payable_payment numeric(18,2);
  v_payable_balance numeric(18,2);

  v_cash_balance numeric(18,2);
  v_bank_balance numeric(18,2);
  v_pos_pending numeric(18,2);

  v_recent jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FINANCE_OVERVIEW_READ_SERVICE_ROLE_REQUIRED';
  end if;

  if v_tenant is null
     or v_company is null
     or v_branch is null
     or v_period is null
     or v_currency !~ '^[A-Z]{3}$' then
    raise exception 'FINANCE_OVERVIEW_READ_INPUT_INVALID';
  end if;

  with scoped_open_items as (
    select
      oi.status,
      oi.due_date,
      oi.original_amount,
      oi.allocated_amount,
      oi.reserved_amount,
      (oi.original_amount - oi.allocated_amount - oi.reserved_amount) as remaining_amount
    from public.finance_receivable_open_items_v1 oi
    where oi.tenant_id = v_tenant
      and oi.company_id = v_company
      and oi.branch_id = v_branch
      and oi.accounting_period_id = v_period
      and oi.currency = v_currency
  )
  select
    coalesce(sum(case when status <> 'REVERSED' then original_amount else 0 end), 0)::numeric(18,2),
    coalesce(sum(case when status <> 'REVERSED' then allocated_amount else 0 end), 0)::numeric(18,2),
    coalesce(sum(case when status <> 'REVERSED' then reserved_amount else 0 end), 0)::numeric(18,2),
    coalesce(sum(case when status in ('OPEN','PARTIAL') then remaining_amount else 0 end), 0)::numeric(18,2),
    count(*) filter (where status in ('OPEN','PARTIAL'))::integer,
    coalesce(sum(remaining_amount) filter (
      where status in ('OPEN','PARTIAL') and due_date < current_date
    ), 0)::numeric(18,2),
    coalesce(sum(remaining_amount) filter (
      where status in ('OPEN','PARTIAL') and due_date = current_date
    ), 0)::numeric(18,2),
    coalesce(sum(remaining_amount) filter (
      where status in ('OPEN','PARTIAL') and due_date > current_date
    ), 0)::numeric(18,2)
  into
    v_original_debt,
    v_allocated_total,
    v_reserved_total,
    v_open_balance,
    v_open_item_count,
    v_overdue,
    v_due_today,
    v_future
  from scoped_open_items;

  select
    coalesce(sum(ft.net_amount), 0)::numeric(18,2)
  into v_active_collection_total
  from public.finance_transactions ft
  where ft.tenant_id = v_tenant
    and ft.company_id = v_company
    and ft.branch_id = v_branch
    and ft.accounting_period_id = v_period
    and ft.currency = v_currency
    and ft.transaction_type = 'COLLECTION'
    and ft.status = 'POSTED'
    and ft.reversed_at is null
    and ft.archived_at is null;

  select
    coalesce(sum(ca.amount), 0)::numeric(18,2)
  into v_active_allocation_total
  from public.finance_collection_allocations_v1 ca
  where ca.tenant_id = v_tenant
    and ca.company_id = v_company
    and ca.branch_id = v_branch
    and ca.accounting_period_id = v_period
    and ca.currency = v_currency
    and ca.reversed_at is null;

  v_unallocated_credit :=
    greatest(v_active_collection_total - v_active_allocation_total, 0)::numeric(18,2);

  v_customer_net :=
    (v_open_balance - v_unallocated_credit)::numeric(18,2);

  with effective_payable as (
    select
      m.movement_kind,
      m.amount
    from public.counterparty_payable_movements m
    where m.tenant_id = v_tenant
      and m.company_id = v_company
      and m.branch_id = v_branch
      and m.accounting_period_id = v_period
      and m.currency = v_currency
      and m.movement_kind in ('ACCRUAL','PAYMENT')
      and not exists (
        select 1
        from public.counterparty_payable_movements r
        where r.tenant_id = m.tenant_id
          and r.company_id = m.company_id
          and r.branch_id = m.branch_id
          and r.accounting_period_id = m.accounting_period_id
          and r.currency = m.currency
          and r.movement_kind = 'REVERSAL'
          and r.reversal_of_movement_id = m.movement_id
      )
  )
  select
    coalesce(sum(amount) filter (where movement_kind = 'ACCRUAL'), 0)::numeric(18,2),
    coalesce(sum(amount) filter (where movement_kind = 'PAYMENT'), 0)::numeric(18,2)
  into
    v_payable_accrual,
    v_payable_payment
  from effective_payable;

  v_payable_balance :=
    (v_payable_accrual - v_payable_payment)::numeric(18,2);

  with active_ledger as (
    select
      ft.direction,
      ft.net_amount,
      fa.account_type
    from public.finance_transactions ft
    join public.finance_accounts fa
      on fa.id::text = ft.finance_account_id
     and fa.tenant_id = ft.tenant_id
     and fa.company_id = ft.company_id
     and fa.branch_id = ft.branch_id
     and fa.accounting_period_id = ft.accounting_period_id
     and fa.currency = ft.currency
     and fa.is_active = true
     and fa.archived_at is null
    where ft.tenant_id = v_tenant
      and ft.company_id = v_company
      and ft.branch_id = v_branch
      and ft.accounting_period_id = v_period
      and ft.currency = v_currency
      and ft.status = 'POSTED'
      and ft.reversed_at is null
      and ft.archived_at is null
      and fa.account_type in ('CASH','BANK')
  )
  select
    coalesce(sum(
      case
        when account_type = 'CASH' and direction = 'DEBIT' then net_amount
        when account_type = 'CASH' and direction = 'CREDIT' then -net_amount
        else 0
      end
    ), 0)::numeric(18,2),
    coalesce(sum(
      case
        when account_type = 'BANK' and direction = 'DEBIT' then net_amount
        when account_type = 'BANK' and direction = 'CREDIT' then -net_amount
        else 0
      end
    ), 0)::numeric(18,2)
  into
    v_cash_balance,
    v_bank_balance
  from active_ledger;

  select
    coalesce(sum(pt.pending_amount), 0)::numeric(18,2)
  into v_pos_pending
  from public.finance_pos_transactions_v1 pt
  where pt.tenant_id = v_tenant
    and pt.company_id = v_company
    and pt.branch_id = v_branch
    and pt.accounting_period_id = v_period
    and pt.currency = v_currency
    and pt.status in ('PENDING_SETTLEMENT','PARTIALLY_SETTLED')
    and pt.reversed_at is null;

  select coalesce(
    jsonb_agg(row_payload order by transaction_date desc, created_at desc, transaction_id desc),
    '[]'::jsonb
  )
  into v_recent
  from (
    select
      ft.transaction_date,
      ft.created_at,
      ft.transaction_id,
      jsonb_build_object(
        'transactionId', ft.transaction_id,
        'transactionType', ft.transaction_type,
        'direction', ft.direction,
        'paymentMethod', ft.payment_method,
        'financeAccountId', ft.finance_account_id,
        'counterAccountId', ft.counter_account_id,
        'customerId', ft.customer_id,
        'saleId', ft.sale_id,
        'sourceDocumentId', ft.source_document_id,
        'sourceDocumentType', ft.source_document_type,
        'netAmount', ft.net_amount,
        'currency', ft.currency,
        'transactionDate', ft.transaction_date,
        'description', ft.description,
        'createdAt', ft.created_at
      ) as row_payload
    from public.finance_transactions ft
    where ft.tenant_id = v_tenant
      and ft.company_id = v_company
      and ft.branch_id = v_branch
      and ft.accounting_period_id = v_period
      and ft.currency = v_currency
      and ft.status = 'POSTED'
      and ft.reversed_at is null
      and ft.archived_at is null
    order by ft.transaction_date desc, ft.created_at desc, ft.transaction_id desc
    limit 20
  ) recent_rows;

  if v_open_balance < 0
     or v_overdue < 0
     or v_due_today < 0
     or v_future < 0
     or round(v_overdue + v_due_today + v_future, 2) <> round(v_open_balance, 2)
     or v_active_allocation_total > v_active_collection_total
     or v_pos_pending < 0 then
    raise exception 'FINANCE_OVERVIEW_READ_RECONCILIATION_FAILED';
  end if;

  return jsonb_build_object(
    'scope', jsonb_build_object(
      'tenantId', v_tenant,
      'companyId', v_company,
      'branchId', v_branch,
      'accountingPeriodId', v_period
    ),
    'currency', v_currency,
    'asOf', v_as_of,
    'receivables', jsonb_build_object(
      'originalDebtTotal', v_original_debt,
      'allocatedCollectionTotal', v_allocated_total,
      'reservedTotal', v_reserved_total,
      'openBalance', v_open_balance,
      'unallocatedCreditTotal', v_unallocated_credit,
      'customerNetPosition', v_customer_net,
      'openItemCount', v_open_item_count
    ),
    'due', jsonb_build_object(
      'overdueAmount', v_overdue,
      'dueTodayAmount', v_due_today,
      'futureAmount', v_future,
      'totalOpenAmount', v_open_balance
    ),
    'payables', jsonb_build_object(
      'accrualTotal', v_payable_accrual,
      'paymentTotal', v_payable_payment,
      'balance', v_payable_balance
    ),
    'liquidity', jsonb_build_object(
      'cashBalance', v_cash_balance,
      'bankBalance', v_bank_balance,
      'posPendingAmount', v_pos_pending
    ),
    'recentTransactions', v_recent,
    'reconciliation', jsonb_build_object(
      'ok', true,
      'reason', null
    )
  );
end;
$function$;

alter function public.read_finance_overview_snapshot_v1(jsonb,text)
  owner to postgres;

revoke all
  on function public.read_finance_overview_snapshot_v1(jsonb,text)
  from public, anon, authenticated, service_role;

grant execute
  on function public.read_finance_overview_snapshot_v1(jsonb,text)
  to service_role;

commit;
