begin;

create table if not exists public.procurement_needs_v1 (
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  need_id text not null,
  idempotency_key text not null,
  sale_id text not null,
  sale_item_id text not null,
  stock_item_id text not null,
  supplier_id text,
  required_quantity numeric(18,6) not null check (required_quantity > 0),
  required_unit text not null check (required_unit in ('mt','m2','adet')),
  allocated_quantity numeric(18,6) not null default 0 check (allocated_quantity >= 0),
  procurement_quantity numeric(18,6) not null check (procurement_quantity >= 0),
  state text not null check (state in ('WAITING','ORDERED','OVERRIDDEN','FULFILLED','CANCELLED')),
  created_by_user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, company_id, branch_id, accounting_period_id, need_id),
  unique (tenant_id, company_id, branch_id, accounting_period_id, idempotency_key),
  unique (tenant_id, company_id, branch_id, accounting_period_id, sale_id, sale_item_id, stock_item_id, need_id),
  check (allocated_quantity <= required_quantity),
  check (procurement_quantity <= required_quantity)
);

create table if not exists public.supplier_orders_v1 (
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  supplier_order_id text not null,
  idempotency_key text not null,
  supplier_id text not null,
  sale_id text not null,
  payload_hash text not null,
  status text not null check (status in ('PREPARING','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED')),
  created_by_user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, company_id, branch_id, accounting_period_id, supplier_order_id),
  unique (tenant_id, company_id, branch_id, accounting_period_id, idempotency_key)
);

create table if not exists public.supplier_order_lines_v1 (
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  supplier_order_line_id text not null,
  supplier_order_id text not null,
  need_id text not null,
  sale_id text not null,
  sale_item_id text not null,
  stock_item_id text not null,
  production_order_id text not null,
  allocation_id text not null,
  purpose text not null check (purpose in ('TAILOR_MATERIAL','MECHANICAL_PRODUCT')),
  ordered_quantity numeric(18,6) not null check (ordered_quantity > 0),
  ordered_unit text not null check (ordered_unit in ('mt','m2','adet')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, company_id, branch_id, accounting_period_id, supplier_order_line_id),
  unique (tenant_id, company_id, branch_id, accounting_period_id, need_id),
  foreign key (tenant_id, company_id, branch_id, accounting_period_id, supplier_order_id)
    references public.supplier_orders_v1
    (tenant_id, company_id, branch_id, accounting_period_id, supplier_order_id)
    on delete restrict,
  foreign key (tenant_id, company_id, branch_id, accounting_period_id, need_id)
    references public.procurement_needs_v1
    (tenant_id, company_id, branch_id, accounting_period_id, need_id)
    on delete restrict
);

alter table public.supplier_order_lines_v1
  add column if not exists production_order_id text,
  add column if not exists allocation_id text,
  add column if not exists purpose text;

create table if not exists public.procurement_decision_audits_v1 (
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  audit_id text not null,
  idempotency_key text not null,
  action text not null check (action in ('CREATE_ORDER','OVERRIDE_NO_ORDER')),
  sale_id text not null,
  sale_item_id text not null,
  stock_item_id text not null,
  supplier_id text,
  required_quantity numeric(18,6) not null check (required_quantity > 0),
  required_unit text not null check (required_unit in ('mt','m2','adet')),
  actor_user_id text not null,
  reason_code text,
  reason_text text,
  payload_hash text not null,
  recorded_at timestamptz not null default now(),
  primary key (tenant_id, company_id, branch_id, accounting_period_id, audit_id),
  unique (tenant_id, company_id, branch_id, accounting_period_id, idempotency_key),
  check (
    action <> 'OVERRIDE_NO_ORDER'
    or (reason_code is not null and length(btrim(reason_code)) > 0)
  )
);

alter table public.procurement_needs_v1 enable row level security;
alter table public.procurement_needs_v1 force row level security;
alter table public.supplier_orders_v1 enable row level security;
alter table public.supplier_orders_v1 force row level security;
alter table public.supplier_order_lines_v1 enable row level security;
alter table public.supplier_order_lines_v1 force row level security;
alter table public.procurement_decision_audits_v1 enable row level security;
alter table public.procurement_decision_audits_v1 force row level security;

revoke all on public.procurement_needs_v1 from public, anon, authenticated;
revoke all on public.supplier_orders_v1 from public, anon, authenticated;
revoke all on public.supplier_order_lines_v1 from public, anon, authenticated;
revoke all on public.procurement_decision_audits_v1 from public, anon, authenticated;

create or replace function public.persist_procurement_decision_v1(
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
  v_action text := upper(btrim(coalesce(p_command->>'action','')));
  v_tenant text := btrim(coalesce(p_command->>'tenantId',''));
  v_company text := btrim(coalesce(p_command->>'companyId',''));
  v_branch text := btrim(coalesce(p_command->>'branchId',''));
  v_period text := btrim(coalesce(p_command->>'accountingPeriodId',''));
  v_idempotency text := btrim(coalesce(p_command->>'idempotencyKey',''));
  v_sale text := btrim(coalesce(p_command->>'saleId',''));
  v_item text := btrim(coalesce(p_command->>'saleItemId',''));
  v_stock text := btrim(coalesce(p_command->>'stockItemId',''));
  v_supplier text := nullif(btrim(coalesce(p_command->>'supplierId','')), '');
  v_need text := btrim(coalesce(p_command->>'needId',''));
  v_qty numeric := coalesce((p_command->>'requiredQuantity')::numeric,0);
  v_unit text := btrim(coalesce(p_command->>'requiredUnit',''));
  v_reason_code text := nullif(btrim(coalesce(p_command->>'reasonCode','')), '');
  v_reason_text text := nullif(btrim(coalesce(p_command->>'reasonText','')), '');
  v_order_id text := nullif(btrim(coalesce(p_command->>'supplierOrderId','')), '');
  v_line_id text := nullif(btrim(coalesce(p_command->>'supplierOrderLineId','')), '');
  v_existing_hash text;
begin
  if length(v_tenant)=0 or length(v_company)=0 or length(v_branch)=0 or length(v_period)=0
     or length(v_idempotency)=0 or length(v_sale)=0 or length(v_item)=0
     or length(v_stock)=0 or length(v_need)=0 or v_qty <= 0
     or v_unit not in ('mt','m2','adet') then
    raise exception 'PROCUREMENT_COMMAND_INVALID';
  end if;

  if v_action not in ('CREATE_ORDER','OVERRIDE_NO_ORDER') then
    raise exception 'PROCUREMENT_ACTION_INVALID';
  end if;

  if v_action='CREATE_ORDER' and (v_supplier is null or v_order_id is null or v_line_id is null) then
    raise exception 'PROCUREMENT_ORDER_FIELDS_REQUIRED';
  end if;

  if v_action='OVERRIDE_NO_ORDER' and v_reason_code is null then
    raise exception 'PROCUREMENT_OVERRIDE_REASON_REQUIRED';
  end if;

  select a.payload_hash
    into v_existing_hash
  from public.procurement_decision_audits_v1 a
  where a.tenant_id=v_tenant and a.company_id=v_company and a.branch_id=v_branch
    and a.accounting_period_id=v_period and a.idempotency_key=v_idempotency
  limit 1;

  if found then
    if v_existing_hash = p_payload_hash then
      return jsonb_build_object('outcome','REPLAY','needId',v_need,'supplierOrderId',v_order_id);
    end if;
    raise exception 'PROCUREMENT_IDEMPOTENCY_CONFLICT';
  end if;

  insert into public.procurement_needs_v1(
    tenant_id,company_id,branch_id,accounting_period_id,
    need_id,idempotency_key,sale_id,sale_item_id,stock_item_id,supplier_id,
    required_quantity,required_unit,allocated_quantity,procurement_quantity,state,
    created_by_user_id
  ) values (
    v_tenant,v_company,v_branch,v_period,
    v_need,'NEED:'||v_idempotency,v_sale,v_item,v_stock,v_supplier,
    v_qty,v_unit,0,v_qty,
    case when v_action='CREATE_ORDER' then 'ORDERED' else 'OVERRIDDEN' end,
    p_actor_user_id
  )
  on conflict (tenant_id,company_id,branch_id,accounting_period_id,need_id)
  do update set
    supplier_id=excluded.supplier_id,
    required_quantity=excluded.required_quantity,
    required_unit=excluded.required_unit,
    procurement_quantity=excluded.procurement_quantity,
    state=excluded.state,
    updated_at=now();

  if v_action='CREATE_ORDER' then
    insert into public.supplier_orders_v1(
      tenant_id,company_id,branch_id,accounting_period_id,
      supplier_order_id,idempotency_key,supplier_id,sale_id,payload_hash,status,created_by_user_id
    ) values (
      v_tenant,v_company,v_branch,v_period,
      v_order_id,v_idempotency,v_supplier,v_sale,p_payload_hash,'ORDERED',p_actor_user_id
    );

    insert into public.supplier_order_lines_v1(
      tenant_id,company_id,branch_id,accounting_period_id,
      supplier_order_line_id,supplier_order_id,need_id,sale_id,sale_item_id,
      stock_item_id,ordered_quantity,ordered_unit
    ) values (
      v_tenant,v_company,v_branch,v_period,
      v_line_id,v_order_id,v_need,v_sale,v_item,v_stock,v_qty,v_unit
    );
  end if;

  insert into public.procurement_decision_audits_v1(
    tenant_id,company_id,branch_id,accounting_period_id,
    audit_id,idempotency_key,action,sale_id,sale_item_id,stock_item_id,supplier_id,
    required_quantity,required_unit,actor_user_id,reason_code,reason_text,payload_hash
  ) values (
    v_tenant,v_company,v_branch,v_period,
    'procurement-audit:'||v_idempotency,v_idempotency,v_action,v_sale,v_item,v_stock,v_supplier,
    v_qty,v_unit,p_actor_user_id,v_reason_code,v_reason_text,
    p_payload_hash
  );

  return jsonb_build_object('outcome','CREATED','needId',v_need,'supplierOrderId',v_order_id);
end;
$$;

revoke all on function public.persist_procurement_decision_v1(jsonb,text,text) from public, anon, authenticated;
grant execute on function public.persist_procurement_decision_v1(jsonb,text,text) to service_role;

create or replace function public.persist_supplier_order_batch_v1(
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
  v_tenant text := btrim(coalesce(p_command->>'tenantId',''));
  v_company text := btrim(coalesce(p_command->>'companyId',''));
  v_branch text := btrim(coalesce(p_command->>'branchId',''));
  v_period text := btrim(coalesce(p_command->>'accountingPeriodId',''));
  v_idempotency text := btrim(coalesce(p_command->>'idempotencyKey',''));
  v_sale text := btrim(coalesce(p_command->>'saleId',''));
  v_supplier text := btrim(coalesce(p_command->>'supplierId',''));
  v_order_id text := btrim(coalesce(p_command->>'supplierOrderId',''));
  v_lines jsonb := p_command->'lines';
  v_line jsonb;
  v_need text;
  v_item text;
  v_stock text;
  v_line_id text;
  v_production_order text;
  v_allocation text;
  v_purpose text;
  v_qty numeric;
  v_unit text;
  v_existing_hash text;
  v_existing_order_id text;
  v_count integer := 0;
begin
  if length(v_tenant)=0 or length(v_company)=0 or length(v_branch)=0 or length(v_period)=0
     or length(v_idempotency)=0 or length(v_sale)=0 or length(v_supplier)=0
     or length(v_order_id)=0 or v_lines is null or jsonb_typeof(v_lines) <> 'array'
     or jsonb_array_length(v_lines)=0 then
    raise exception 'PROCUREMENT_BATCH_INVALID';
  end if;

  select o.payload_hash, o.supplier_order_id
    into v_existing_hash, v_existing_order_id
  from public.supplier_orders_v1 o
  where o.tenant_id=v_tenant and o.company_id=v_company and o.branch_id=v_branch
    and o.accounting_period_id=v_period and o.idempotency_key=v_idempotency
  limit 1;

  if found then
    if v_existing_hash = p_payload_hash and v_existing_order_id = v_order_id then
      return jsonb_build_object(
        'outcome','REPLAY',
        'supplierOrderId',v_existing_order_id,
        'lineCount',jsonb_array_length(v_lines)
      );
    end if;
    raise exception 'PROCUREMENT_BATCH_IDEMPOTENCY_CONFLICT';
  end if;

  insert into public.supplier_orders_v1(
    tenant_id,company_id,branch_id,accounting_period_id,
    supplier_order_id,idempotency_key,supplier_id,sale_id,payload_hash,status,created_by_user_id
  ) values (
    v_tenant,v_company,v_branch,v_period,
    v_order_id,v_idempotency,v_supplier,v_sale,p_payload_hash,'ORDERED',p_actor_user_id
  );

  for v_line in
    select value from jsonb_array_elements(v_lines)
  loop
    v_need := btrim(coalesce(v_line->>'needId',''));
    v_item := btrim(coalesce(v_line->>'saleItemId',''));
    v_stock := btrim(coalesce(v_line->>'stockItemId',''));
    v_line_id := btrim(coalesce(v_line->>'supplierOrderLineId',''));
    v_production_order := btrim(coalesce(v_line->>'productionOrderId',''));
    v_allocation := btrim(coalesce(v_line->>'allocationId',''));
    v_purpose := btrim(coalesce(v_line->>'purpose',''));
    v_qty := coalesce((v_line->>'requiredQuantity')::numeric,0);
    v_unit := btrim(coalesce(v_line->>'requiredUnit',''));

    if length(v_need)=0 or length(v_item)=0 or length(v_stock)=0 or length(v_line_id)=0
       or length(v_production_order)=0 or length(v_allocation)=0
       or v_purpose not in ('TAILOR_MATERIAL','MECHANICAL_PRODUCT')
       or v_qty <= 0 or v_unit not in ('mt','m2','adet') then
      raise exception 'PROCUREMENT_BATCH_LINE_INVALID';
    end if;

    insert into public.procurement_needs_v1(
      tenant_id,company_id,branch_id,accounting_period_id,
      need_id,idempotency_key,sale_id,sale_item_id,stock_item_id,supplier_id,
      required_quantity,required_unit,allocated_quantity,procurement_quantity,state,
      created_by_user_id
    ) values (
      v_tenant,v_company,v_branch,v_period,
      v_need,'NEED:'||v_idempotency||':'||v_need,v_sale,v_item,v_stock,v_supplier,
      v_qty,v_unit,0,v_qty,'ORDERED',p_actor_user_id
    );

    insert into public.supplier_order_lines_v1(
      tenant_id,company_id,branch_id,accounting_period_id,
      supplier_order_line_id,supplier_order_id,need_id,sale_id,sale_item_id,
      stock_item_id,production_order_id,allocation_id,purpose,
      ordered_quantity,ordered_unit
    ) values (
      v_tenant,v_company,v_branch,v_period,
      v_line_id,v_order_id,v_need,v_sale,v_item,v_stock,
      v_production_order,v_allocation,v_purpose,
      v_qty,v_unit
    );

    insert into public.procurement_decision_audits_v1(
      tenant_id,company_id,branch_id,accounting_period_id,
      audit_id,idempotency_key,action,sale_id,sale_item_id,stock_item_id,supplier_id,
      required_quantity,required_unit,actor_user_id,reason_code,reason_text,payload_hash
    ) values (
      v_tenant,v_company,v_branch,v_period,
      'procurement-audit:'||v_idempotency||':'||v_need,
      v_idempotency||':'||v_need,
      'CREATE_ORDER',v_sale,v_item,v_stock,v_supplier,
      v_qty,v_unit,p_actor_user_id,null,null,p_payload_hash
    );

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'outcome','CREATED',
    'supplierOrderId',v_order_id,
    'lineCount',v_count
  );
end;
$$;

revoke all on function public.persist_supplier_order_batch_v1(jsonb,text,text) from public, anon, authenticated;
grant execute on function public.persist_supplier_order_batch_v1(jsonb,text,text) to service_role;

do $$
begin
  if exists (
    select 1
    from public.supplier_order_lines_v1
    where production_order_id is null
       or length(btrim(production_order_id))=0
       or allocation_id is null
       or length(btrim(allocation_id))=0
       or purpose is null
       or purpose not in ('TAILOR_MATERIAL','MECHANICAL_PRODUCT')
  ) then
    raise exception 'PROCUREMENT_C2_EXISTING_LINE_LINKAGE_BACKFILL_REQUIRED';
  end if;
end;
$$;

alter table public.supplier_order_lines_v1
  alter column production_order_id set not null,
  alter column allocation_id set not null,
  alter column purpose set not null;

commit;





