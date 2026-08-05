-- ENVerp Package C3-B2
-- Counterparty source-truth persistence RPCs.
-- SOURCE ONLY. Not applied to live Supabase by this package.

create or replace function public.persist_counterparty_supplier_receipt_source_v1(
  p_source jsonb,
  p_actor jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.counterparty_supplier_receipt_sources%rowtype;
  v_inserted public.counterparty_supplier_receipt_sources%rowtype;
  v_actor_user_id text;
begin
  v_actor_user_id := nullif(trim(p_actor ->> 'userId'), '');

  if v_actor_user_id is null then
    raise exception 'ACTOR_USER_REQUIRED';
  end if;

  select *
  into v_existing
  from public.counterparty_supplier_receipt_sources
  where source_id = p_source ->> 'sourceId';

  if found then
    if
      v_existing.tenant_id = p_source ->> 'tenantId' and
      v_existing.company_id = p_source ->> 'companyId' and
      v_existing.branch_id = p_source ->> 'branchId' and
      v_existing.accounting_period_id = p_source ->> 'accountingPeriodId' and
      v_existing.supplier_customer_id = p_source ->> 'supplierCustomerId' and
      v_existing.supplier_order_id = p_source ->> 'supplierOrderId' and
      v_existing.receipt_id = p_source ->> 'receiptId' and
      v_existing.source_document_id = p_source ->> 'sourceDocumentId' and
      v_existing.stock_item_id = p_source ->> 'stockItemId' and
      v_existing.received_quantity = (p_source ->> 'receivedQuantity')::numeric and
      v_existing.actual_purchase_unit_price = (p_source ->> 'actualPurchaseUnitPrice')::numeric and
      v_existing.purchase_vat_rate = (p_source ->> 'purchaseVatRate')::numeric and
      v_existing.net_amount = (p_source ->> 'netAmount')::numeric and
      v_existing.payable_amount = (p_source ->> 'payableAmount')::numeric and
      v_existing.currency = coalesce(nullif(p_source ->> 'currency', ''), 'TRY') and
      v_existing.received_at = (p_source ->> 'receivedAt')::timestamptz
    then
      return jsonb_build_object(
        'status', 'REPLAY',
        'sourceId', v_existing.source_id
      );
    end if;

    return jsonb_build_object(
      'status', 'CONFLICT',
      'reason', 'SOURCE_ID_CONFLICT',
      'sourceId', v_existing.source_id
    );
  end if;

  select *
  into v_existing
  from public.counterparty_supplier_receipt_sources
  where tenant_id = p_source ->> 'tenantId'
    and company_id = p_source ->> 'companyId'
    and branch_id = p_source ->> 'branchId'
    and accounting_period_id = p_source ->> 'accountingPeriodId'
    and receipt_id = p_source ->> 'receiptId';

  if found then
    return jsonb_build_object(
      'status', 'CONFLICT',
      'reason', 'RECEIPT_ID_CONFLICT',
      'sourceId', v_existing.source_id
    );
  end if;

  insert into public.counterparty_supplier_receipt_sources (
    source_id,
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    supplier_customer_id,
    supplier_order_id,
    receipt_id,
    source_document_id,
    stock_item_id,
    received_quantity,
    actual_purchase_unit_price,
    purchase_vat_rate,
    net_amount,
    payable_amount,
    currency,
    received_at,
    recorded_at,
    recorded_by_user_id
  )
  values (
    p_source ->> 'sourceId',
    p_source ->> 'tenantId',
    p_source ->> 'companyId',
    p_source ->> 'branchId',
    p_source ->> 'accountingPeriodId',
    p_source ->> 'supplierCustomerId',
    p_source ->> 'supplierOrderId',
    p_source ->> 'receiptId',
    p_source ->> 'sourceDocumentId',
    p_source ->> 'stockItemId',
    (p_source ->> 'receivedQuantity')::numeric,
    (p_source ->> 'actualPurchaseUnitPrice')::numeric,
    (p_source ->> 'purchaseVatRate')::numeric,
    (p_source ->> 'netAmount')::numeric,
    (p_source ->> 'payableAmount')::numeric,
    coalesce(nullif(p_source ->> 'currency', ''), 'TRY'),
    (p_source ->> 'receivedAt')::timestamptz,
    coalesce(
      nullif(p_source ->> 'recordedAt', '')::timestamptz,
      now()
    ),
    v_actor_user_id
  )
  returning *
  into v_inserted;

  return jsonb_build_object(
    'status', 'CREATED',
    'sourceId', v_inserted.source_id
  );
end;
$$;

revoke all
  on function public.persist_counterparty_supplier_receipt_source_v1(jsonb, jsonb)
  from public, anon, authenticated;

grant execute
  on function public.persist_counterparty_supplier_receipt_source_v1(jsonb, jsonb)
  to service_role;


create or replace function public.persist_counterparty_provider_earning_source_v1(
  p_source jsonb,
  p_actor jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.counterparty_provider_earning_sources%rowtype;
  v_inserted public.counterparty_provider_earning_sources%rowtype;
  v_actor_user_id text;
begin
  v_actor_user_id := nullif(trim(p_actor ->> 'userId'), '');

  if v_actor_user_id is null then
    raise exception 'ACTOR_USER_REQUIRED';
  end if;

  if upper(coalesce(p_source ->> 'assignmentType', 'EXTERNAL')) = 'INTERNAL' then
    return jsonb_build_object(
      'status', 'REJECTED',
      'reason', 'INTERNAL_PROVIDER_NO_PAYABLE_SOURCE'
    );
  end if;

  select *
  into v_existing
  from public.counterparty_provider_earning_sources
  where source_id = p_source ->> 'sourceId';

  if found then
    if
      v_existing.tenant_id = p_source ->> 'tenantId' and
      v_existing.company_id = p_source ->> 'companyId' and
      v_existing.branch_id = p_source ->> 'branchId' and
      v_existing.accounting_period_id = p_source ->> 'accountingPeriodId' and
      v_existing.provider_customer_id = p_source ->> 'providerCustomerId' and
      v_existing.provider_type = p_source ->> 'providerType' and
      v_existing.assignment_type = p_source ->> 'assignmentType' and
      v_existing.operation_id = p_source ->> 'operationId' and
      v_existing.earnings_entry_id = p_source ->> 'earningsEntryId' and
      coalesce(v_existing.source_document_id, '') =
        coalesce(p_source ->> 'sourceDocumentId', '') and
      v_existing.status = p_source ->> 'status' and
      v_existing.finalized_amount = (p_source ->> 'finalizedAmount')::numeric and
      v_existing.currency = coalesce(nullif(p_source ->> 'currency', ''), 'TRY') and
      v_existing.occurred_at = (p_source ->> 'occurredAt')::timestamptz and
      v_existing.finalized_at = (p_source ->> 'finalizedAt')::timestamptz
    then
      return jsonb_build_object(
        'status', 'REPLAY',
        'sourceId', v_existing.source_id
      );
    end if;

    return jsonb_build_object(
      'status', 'CONFLICT',
      'reason', 'SOURCE_ID_CONFLICT',
      'sourceId', v_existing.source_id
    );
  end if;

  select *
  into v_existing
  from public.counterparty_provider_earning_sources
  where tenant_id = p_source ->> 'tenantId'
    and company_id = p_source ->> 'companyId'
    and branch_id = p_source ->> 'branchId'
    and accounting_period_id = p_source ->> 'accountingPeriodId'
    and earnings_entry_id = p_source ->> 'earningsEntryId';

  if found then
    return jsonb_build_object(
      'status', 'CONFLICT',
      'reason', 'EARNINGS_ENTRY_CONFLICT',
      'sourceId', v_existing.source_id
    );
  end if;

  insert into public.counterparty_provider_earning_sources (
    source_id,
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    provider_customer_id,
    provider_type,
    assignment_type,
    operation_id,
    earnings_entry_id,
    source_document_id,
    status,
    finalized_amount,
    currency,
    occurred_at,
    finalized_at,
    recorded_at,
    finalized_by_user_id
  )
  values (
    p_source ->> 'sourceId',
    p_source ->> 'tenantId',
    p_source ->> 'companyId',
    p_source ->> 'branchId',
    p_source ->> 'accountingPeriodId',
    p_source ->> 'providerCustomerId',
    p_source ->> 'providerType',
    p_source ->> 'assignmentType',
    p_source ->> 'operationId',
    p_source ->> 'earningsEntryId',
    nullif(p_source ->> 'sourceDocumentId', ''),
    p_source ->> 'status',
    (p_source ->> 'finalizedAmount')::numeric,
    coalesce(nullif(p_source ->> 'currency', ''), 'TRY'),
    (p_source ->> 'occurredAt')::timestamptz,
    (p_source ->> 'finalizedAt')::timestamptz,
    coalesce(
      nullif(p_source ->> 'recordedAt', '')::timestamptz,
      now()
    ),
    v_actor_user_id
  )
  returning *
  into v_inserted;

  return jsonb_build_object(
    'status', 'CREATED',
    'sourceId', v_inserted.source_id
  );
end;
$$;

revoke all
  on function public.persist_counterparty_provider_earning_source_v1(jsonb, jsonb)
  from public, anon, authenticated;

grant execute
  on function public.persist_counterparty_provider_earning_source_v1(jsonb, jsonb)
  to service_role;
-- C3-B6 authoritative source read boundary.
-- Exact four-scope + immutable source identity. Service-role only.

create or replace function public.read_counterparty_supplier_receipt_source_v1(
  p_scope jsonb,
  p_receipt_id text
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select to_jsonb(s) - 'recorded_by_user_id'
  from public.counterparty_supplier_receipt_sources s
  where s.tenant_id = p_scope ->> 'tenantId'
    and s.company_id = p_scope ->> 'companyId'
    and s.branch_id = p_scope ->> 'branchId'
    and s.accounting_period_id = p_scope ->> 'accountingPeriodId'
    and s.receipt_id = p_receipt_id
  limit 1;
$$;

revoke all on function public.read_counterparty_supplier_receipt_source_v1(
  jsonb,
  text
) from public, anon, authenticated;

grant execute on function public.read_counterparty_supplier_receipt_source_v1(
  jsonb,
  text
) to service_role;

create or replace function public.read_counterparty_provider_earning_source_v1(
  p_scope jsonb,
  p_earnings_entry_id text
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select to_jsonb(s) - 'recorded_by_user_id'
  from public.counterparty_provider_earning_sources s
  where s.tenant_id = p_scope ->> 'tenantId'
    and s.company_id = p_scope ->> 'companyId'
    and s.branch_id = p_scope ->> 'branchId'
    and s.accounting_period_id = p_scope ->> 'accountingPeriodId'
    and s.earnings_entry_id = p_earnings_entry_id
  limit 1;
$$;

revoke all on function public.read_counterparty_provider_earning_source_v1(
  jsonb,
  text
) from public, anon, authenticated;

grant execute on function public.read_counterparty_provider_earning_source_v1(
  jsonb,
  text
) to service_role;
