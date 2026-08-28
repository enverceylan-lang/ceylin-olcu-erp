begin;

create table if not exists public.supplier_receipts_v1 (
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  receipt_id text not null,
  idempotency_key text not null,
  supplier_order_id text not null,
  supplier_order_line_id text not null,
  allocation_id text not null,
  stock_item_id text not null,
  received_quantity numeric(18,6) not null check (received_quantity > 0),
  received_unit text not null check (received_unit in ('mt','m2','adet')),
  received_by_user_id text not null,
  received_at timestamptz not null,
  payload_hash text not null,
  status text not null default 'POSTED' check (status in ('POSTED','REVERSED')),
  reversed_by_user_id text,
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now(),
  primary key (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    receipt_id
  ),
  unique (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    idempotency_key
  ),
  foreign key (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    supplier_order_id
  )
    references public.supplier_orders_v1 (
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      supplier_order_id
    )
    on delete restrict,
  foreign key (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    supplier_order_line_id
  )
    references public.supplier_order_lines_v1 (
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      supplier_order_line_id
    )
    on delete restrict
);

create table if not exists public.stock_movements_v1 (
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  movement_id text not null,
  idempotency_key text not null,
  stock_item_id text not null,
  source_type text not null check (
    source_type in ('SUPPLIER_RECEIPT')
  ),
  source_id text not null,
  direction text not null check (
    direction in ('IN','OUT')
  ),
  quantity numeric(18,6) not null check (quantity > 0),
  unit text not null check (unit in ('mt','m2','adet')),
  status text not null default 'POSTED' check (status in ('POSTED','REVERSED')),
  occurred_at timestamptz not null,
  actor_user_id text not null,
  payload_hash text not null,
  created_at timestamptz not null default now(),
  primary key (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    movement_id
  ),
  unique (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    idempotency_key
  ),
  unique (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    source_type,
    source_id
  ),
  foreign key (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    source_id
  )
    references public.supplier_receipts_v1 (
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      receipt_id
    )
    on delete restrict
);

alter table public.supplier_receipts_v1
  enable row level security;
alter table public.supplier_receipts_v1
  force row level security;

alter table public.stock_movements_v1
  enable row level security;
alter table public.stock_movements_v1
  force row level security;

revoke all on public.supplier_receipts_v1
  from public, anon, authenticated;
revoke all on public.stock_movements_v1
  from public, anon, authenticated;

create or replace function public.persist_supplier_receipt_stock_v1(
  p_command jsonb,
  p_actor_user_id text,
  p_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_action text :=
    upper(btrim(coalesce(p_command->>'action','')));
  v_tenant text :=
    btrim(coalesce(p_command->>'tenantId',''));
  v_company text :=
    btrim(coalesce(p_command->>'companyId',''));
  v_branch text :=
    btrim(coalesce(p_command->>'branchId',''));
  v_period text :=
    btrim(coalesce(p_command->>'accountingPeriodId',''));
  v_receipt_id text :=
    btrim(coalesce(p_command->>'receiptId',''));
  v_idempotency text :=
    btrim(coalesce(p_command->>'idempotencyKey',''));
  v_order_id text :=
    btrim(coalesce(p_command->>'supplierOrderId',''));
  v_line_id text :=
    btrim(coalesce(p_command->>'supplierOrderLineId',''));
  v_allocation_id text :=
    btrim(coalesce(p_command->>'allocationId',''));
  v_stock_item_id text :=
    btrim(coalesce(p_command->>'stockItemId',''));
  v_received_qty numeric :=
    coalesce((p_command->>'receivedQuantity')::numeric,0);
  v_received_unit text :=
    btrim(coalesce(p_command->>'receivedUnit',''));
  v_received_at timestamptz :=
    (p_command->>'receivedAt')::timestamptz;

  v_ordered_qty numeric;
  v_ordered_unit text;
  v_existing_hash text;
  v_existing_receipt_id text;
  v_prior_received numeric := 0;
  v_cumulative numeric := 0;
  v_order_status text;
  v_incomplete_exists boolean;
begin
  if
    v_action <> 'RECEIVE_SUPPLIER_ORDER'
    or length(v_tenant)=0
    or length(v_company)=0
    or length(v_branch)=0
    or length(v_period)=0
    or length(v_receipt_id)=0
    or length(v_idempotency)=0
    or length(v_order_id)=0
    or length(v_line_id)=0
    or length(v_allocation_id)=0
    or length(v_stock_item_id)=0
    or length(btrim(coalesce(p_actor_user_id,'')))=0
    or length(btrim(coalesce(p_payload_hash,'')))=0
    or v_received_qty <= 0
    or v_received_unit not in ('mt','m2','adet')
    or v_received_at is null
  then
    raise exception 'SUPPLIER_RECEIPT_COMMAND_INVALID';
  end if;

  select
    r.payload_hash,
    r.receipt_id
  into
    v_existing_hash,
    v_existing_receipt_id
  from public.supplier_receipts_v1 r
  where
    r.tenant_id=v_tenant
    and r.company_id=v_company
    and r.branch_id=v_branch
    and r.accounting_period_id=v_period
    and r.idempotency_key=v_idempotency
  limit 1;

  if found then
    if
      v_existing_hash = p_payload_hash
      and v_existing_receipt_id = v_receipt_id
    then
      select
        coalesce(
          sum(r.received_quantity)
            filter (
              where r.status='POSTED'
            ),
          0
        )
      into v_cumulative
      from public.supplier_receipts_v1 r
      where
        r.tenant_id=v_tenant
        and r.company_id=v_company
        and r.branch_id=v_branch
        and r.accounting_period_id=v_period
        and r.supplier_order_id=v_order_id
        and r.allocation_id=v_allocation_id;

      select o.status
      into v_order_status
      from public.supplier_orders_v1 o
      where
        o.tenant_id=v_tenant
        and o.company_id=v_company
        and o.branch_id=v_branch
        and o.accounting_period_id=v_period
        and o.supplier_order_id=v_order_id;

      return jsonb_build_object(
        'outcome','REPLAY',
        'receiptId',v_receipt_id,
        'supplierOrderStatus',coalesce(v_order_status,''),
        'cumulativeReceivedQuantity',v_cumulative
      );
    end if;

    raise exception 'SUPPLIER_RECEIPT_IDEMPOTENCY_CONFLICT';
  end if;

  select
    l.ordered_quantity,
    l.ordered_unit
  into
    v_ordered_qty,
    v_ordered_unit
  from public.supplier_order_lines_v1 l
  where
    l.tenant_id=v_tenant
    and l.company_id=v_company
    and l.branch_id=v_branch
    and l.accounting_period_id=v_period
    and l.supplier_order_line_id=v_line_id
    and l.supplier_order_id=v_order_id
    and l.allocation_id=v_allocation_id
    and l.stock_item_id=v_stock_item_id
  for update;

  if not found then
    raise exception 'SUPPLIER_RECEIPT_ORDER_LINE_NOT_FOUND';
  end if;

  if v_ordered_unit <> v_received_unit then
    raise exception 'SUPPLIER_RECEIPT_UNIT_MISMATCH';
  end if;

  select
    coalesce(
      sum(r.received_quantity)
        filter (
          where r.status='POSTED'
        ),
      0
    )
  into v_prior_received
  from public.supplier_receipts_v1 r
  where
    r.tenant_id=v_tenant
    and r.company_id=v_company
    and r.branch_id=v_branch
    and r.accounting_period_id=v_period
    and r.supplier_order_line_id=v_line_id;

  if
    v_prior_received + v_received_qty >
      v_ordered_qty + 0.000001
  then
    raise exception 'SUPPLIER_RECEIPT_OVER_RECEIPT';
  end if;

  insert into public.supplier_receipts_v1 (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    receipt_id,
    idempotency_key,
    supplier_order_id,
    supplier_order_line_id,
    allocation_id,
    stock_item_id,
    received_quantity,
    received_unit,
    received_by_user_id,
    received_at,
    payload_hash,
    status
  )
  values (
    v_tenant,
    v_company,
    v_branch,
    v_period,
    v_receipt_id,
    v_idempotency,
    v_order_id,
    v_line_id,
    v_allocation_id,
    v_stock_item_id,
    v_received_qty,
    v_received_unit,
    p_actor_user_id,
    v_received_at,
    p_payload_hash,
    'POSTED'
  );

  insert into public.stock_movements_v1 (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    movement_id,
    idempotency_key,
    stock_item_id,
    source_type,
    source_id,
    direction,
    quantity,
    unit,
    status,
    occurred_at,
    actor_user_id,
    payload_hash
  )
  values (
    v_tenant,
    v_company,
    v_branch,
    v_period,
    'stock-movement:supplier-receipt:' || v_receipt_id,
    'STOCK:' || v_idempotency,
    v_stock_item_id,
    'SUPPLIER_RECEIPT',
    v_receipt_id,
    'IN',
    v_received_qty,
    v_received_unit,
    'POSTED',
    v_received_at,
    p_actor_user_id,
    p_payload_hash
  );

  v_cumulative :=
    v_prior_received +
    v_received_qty;

  select exists (
    select 1
    from public.supplier_order_lines_v1 l
    where
      l.tenant_id=v_tenant
      and l.company_id=v_company
      and l.branch_id=v_branch
      and l.accounting_period_id=v_period
      and l.supplier_order_id=v_order_id
      and (
        select coalesce(
          sum(r.received_quantity)
            filter (
              where r.status='POSTED'
            ),
          0
        )
        from public.supplier_receipts_v1 r
        where
          r.tenant_id=l.tenant_id
          and r.company_id=l.company_id
          and r.branch_id=l.branch_id
          and r.accounting_period_id=l.accounting_period_id
          and r.supplier_order_line_id=l.supplier_order_line_id
      ) < l.ordered_quantity - 0.000001
  )
  into v_incomplete_exists;

  v_order_status :=
    case
      when v_incomplete_exists
        then 'PARTIALLY_RECEIVED'
      else 'RECEIVED'
    end;

  update public.supplier_orders_v1
  set
    status=v_order_status,
    updated_at=now()
  where
    tenant_id=v_tenant
    and company_id=v_company
    and branch_id=v_branch
    and accounting_period_id=v_period
    and supplier_order_id=v_order_id;

  if not found then
    raise exception 'SUPPLIER_RECEIPT_ORDER_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'outcome','CREATED',
    'receiptId',v_receipt_id,
    'supplierOrderStatus',v_order_status,
    'cumulativeReceivedQuantity',v_cumulative
  );
end;
$$;

revoke all on function
  public.persist_supplier_receipt_stock_v1(jsonb,text,text)
  from public, anon, authenticated;

grant execute on function
  public.persist_supplier_receipt_stock_v1(jsonb,text,text)
  to service_role;

commit;