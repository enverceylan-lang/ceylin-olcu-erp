-- ENVerp Sale Line Source Authority V1
-- SOURCE ONLY. DO NOT APPLY TO LIVE DB WITHOUT SEPARATE EXPLICIT APPROVAL.
-- Reuses the existing canonical RPC name: persist_sale_line_source_snapshot_v1.
-- No second sale-line writer is introduced.
--
-- Invariants:
-- * exact tenant/company/branch/accounting-period scope
-- * sale/customer/currency binding to sale_documents_v1
-- * stable sourceSaleItemId and unique line identity per snapshot
-- * measurement-origin lines require stockItemId
-- * immutable approved snapshot; identical retry is idempotent
-- * version history is append-only; physical delete is forbidden

begin;

create table if not exists public.sale_line_source_snapshots_v1 (
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  sale_id text not null,
  customer_id text not null,
  currency text not null,
  sale_total numeric(18,6) not null,
  source_version bigint not null,
  line_count integer not null,
  payload jsonb not null,
  actor_user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (
    tenant_id, company_id, branch_id, accounting_period_id, sale_id, source_version
  ),

  constraint sale_line_source_snapshots_v1_scope_ck check (
    btrim(tenant_id) <> '' and btrim(company_id) <> '' and
    btrim(branch_id) <> '' and btrim(accounting_period_id) <> ''
  ),
  constraint sale_line_source_snapshots_v1_identity_ck check (
    btrim(sale_id) <> '' and btrim(customer_id) <> '' and
    btrim(actor_user_id) <> ''
  ),
  constraint sale_line_source_snapshots_v1_currency_ck check (
    currency ~ '^[A-Z]{3}$'
  ),
  constraint sale_line_source_snapshots_v1_total_ck check (sale_total > 0),
  constraint sale_line_source_snapshots_v1_version_ck check (source_version > 0),
  constraint sale_line_source_snapshots_v1_line_count_ck check (line_count > 0),
  constraint sale_line_source_snapshots_v1_payload_ck check (
    pg_catalog.jsonb_typeof(payload) = 'object'
  )
);

create table if not exists public.sale_line_source_rows_v1 (
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  sale_id text not null,
  source_version bigint not null,
  source_sale_item_id text not null,
  source_measurement_ids jsonb not null,
  source_type text not null,
  stock_item_id text null,
  room_name text not null default '',
  window_name text not null default '',
  product_type text not null,
  product_group text not null,
  quantity numeric(18,6) not null,
  metric_size numeric(18,6) not null,
  metric_unit text not null,
  unit_price numeric(18,6) not null,
  discount numeric(18,6) not null,
  row_total numeric(18,6) not null,
  note text null,
  actor_user_id text not null,
  created_at timestamptz not null default now(),

  primary key (
    tenant_id, company_id, branch_id, accounting_period_id,
    sale_id, source_version, source_sale_item_id
  ),

  constraint sale_line_source_rows_v1_scope_ck check (
    btrim(tenant_id) <> '' and btrim(company_id) <> '' and
    btrim(branch_id) <> '' and btrim(accounting_period_id) <> ''
  ),
  constraint sale_line_source_rows_v1_identity_ck check (
    btrim(sale_id) <> '' and btrim(source_sale_item_id) <> '' and
    btrim(actor_user_id) <> ''
  ),
  constraint sale_line_source_rows_v1_measurements_ck check (
    pg_catalog.jsonb_typeof(source_measurement_ids) = 'array'
  ),
  constraint sale_line_source_rows_v1_source_type_ck check (
    source_type in ('MEASUREMENT', 'MANUAL')
  ),
  constraint sale_line_source_rows_v1_measurement_stock_ck check (
    source_type <> 'MEASUREMENT' or
    btrim(coalesce(stock_item_id, '')) <> ''
  ),
  constraint sale_line_source_rows_v1_product_ck check (
    btrim(product_type) <> '' and btrim(product_group) <> ''
  ),
  constraint sale_line_source_rows_v1_quantity_ck check (
    quantity > 0 and metric_size > 0
  ),
  constraint sale_line_source_rows_v1_metric_unit_ck check (
    metric_unit in ('m2', 'mt', 'adet')
  ),
  constraint sale_line_source_rows_v1_amount_ck check (
    unit_price >= 0 and discount >= 0 and row_total >= 0
  )
);

create index if not exists sale_line_source_snapshots_v1_latest_idx
on public.sale_line_source_snapshots_v1 (
  tenant_id, company_id, branch_id, accounting_period_id, sale_id, source_version desc
);

create index if not exists sale_line_source_rows_v1_stock_idx
on public.sale_line_source_rows_v1 (
  tenant_id, company_id, branch_id, accounting_period_id, stock_item_id, sale_id
);

alter table public.sale_line_source_snapshots_v1 enable row level security;
alter table public.sale_line_source_snapshots_v1 force row level security;
alter table public.sale_line_source_rows_v1 enable row level security;
alter table public.sale_line_source_rows_v1 force row level security;

revoke all on table public.sale_line_source_snapshots_v1
from public, anon, authenticated;
revoke all on table public.sale_line_source_rows_v1
from public, anon, authenticated;

grant select, insert
on table public.sale_line_source_snapshots_v1 to service_role;
grant select, insert
on table public.sale_line_source_rows_v1 to service_role;

revoke delete on table public.sale_line_source_snapshots_v1
from public, anon, authenticated, service_role;
revoke delete on table public.sale_line_source_rows_v1
from public, anon, authenticated, service_role;

create or replace function public.persist_sale_line_source_snapshot_v1(
  p_source jsonb,
  p_actor_user_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_tenant text := btrim(coalesce(p_source->>'tenantId',''));
  v_company text := btrim(coalesce(p_source->>'companyId',''));
  v_branch text := btrim(coalesce(p_source->>'branchId',''));
  v_period text := btrim(coalesce(p_source->>'accountingPeriodId',''));
  v_sale_id text := btrim(coalesce(p_source->>'saleId',''));
  v_customer_id text := btrim(coalesce(p_source->>'customerId',''));
  v_currency text := upper(btrim(coalesce(p_source->>'currency','')));
  v_sale_total numeric;
  v_lines jsonb := p_source->'lines';
  v_line jsonb;
  v_line_count integer := 0;
  v_source_sale_item_id text;
  v_measurement_ids jsonb;
  v_source_type text;
  v_stock_item_id text;
  v_product_type text;
  v_product_group text;
  v_metric_unit text;
  v_quantity numeric;
  v_metric_size numeric;
  v_unit_price numeric;
  v_discount numeric;
  v_row_total numeric;
  v_version bigint;
  v_outcome text;
  v_seen_ids text[] := array[]::text[];
  v_sale public.sale_documents_v1%rowtype;
  v_existing public.sale_line_source_snapshots_v1%rowtype;
begin
  if v_tenant='' or v_company='' or v_branch='' or v_period='' then
    raise exception 'SALE_LINE_SOURCE_SCOPE_REQUIRED';
  end if;

  if v_sale_id='' or v_customer_id='' or btrim(coalesce(p_actor_user_id,''))='' then
    raise exception 'SALE_LINE_SOURCE_BINDING_REQUIRED';
  end if;

  begin
    v_sale_total := (p_source->>'saleTotal')::numeric;
  exception when others then
    raise exception 'SALE_LINE_SOURCE_TOTAL_INVALID';
  end;

  if v_sale_total is null or v_sale_total <= 0 then
    raise exception 'SALE_LINE_SOURCE_TOTAL_INVALID';
  end if;

  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'SALE_LINE_SOURCE_CURRENCY_INVALID';
  end if;

  if v_lines is null
     or pg_catalog.jsonb_typeof(v_lines) is distinct from 'array'
     or pg_catalog.jsonb_array_length(v_lines)=0 then
    raise exception 'SALE_LINE_SOURCE_LINES_REQUIRED';
  end if;

  select *
  into v_sale
  from public.sale_documents_v1 s
  where s.tenant_id=v_tenant
    and s.company_id=v_company
    and s.branch_id=v_branch
    and s.accounting_period_id=v_period
    and s.sale_id=v_sale_id
  for update;

  if not found then
    raise exception 'SALE_LINE_SOURCE_SALE_NOT_FOUND';
  end if;

  if v_sale.customer_id is distinct from v_customer_id then
    raise exception 'SALE_LINE_SOURCE_CUSTOMER_MISMATCH';
  end if;

  if v_sale.currency is distinct from v_currency then
    raise exception 'SALE_LINE_SOURCE_CURRENCY_MISMATCH';
  end if;

  for v_line in
    select value from pg_catalog.jsonb_array_elements(v_lines)
  loop
    v_line_count := v_line_count + 1;

    if pg_catalog.jsonb_typeof(v_line) is distinct from 'object' then
      raise exception 'SALE_LINE_SOURCE_LINE_INVALID';
    end if;

    v_source_sale_item_id := btrim(coalesce(v_line->>'sourceSaleItemId',''));
    if v_source_sale_item_id='' then
      raise exception 'SALE_LINE_SOURCE_ITEM_ID_REQUIRED';
    end if;

    if v_source_sale_item_id = any(v_seen_ids) then
      raise exception 'SALE_LINE_SOURCE_ITEM_ID_DUPLICATE';
    end if;
    v_seen_ids := pg_catalog.array_append(v_seen_ids,v_source_sale_item_id);

    v_source_type := btrim(coalesce(v_line->>'sourceType',''));
    if v_source_type not in ('MEASUREMENT','MANUAL') then
      raise exception 'SALE_LINE_SOURCE_TYPE_INVALID';
    end if;

    v_measurement_ids := coalesce(v_line->'sourceMeasurementIds','[]'::jsonb);
    if pg_catalog.jsonb_typeof(v_measurement_ids) is distinct from 'array' then
      raise exception 'SALE_LINE_SOURCE_MEASUREMENT_IDS_INVALID';
    end if;

    v_stock_item_id := nullif(btrim(coalesce(v_line->>'stockItemId','')),'');
    if v_source_type='MEASUREMENT'
       and (pg_catalog.jsonb_array_length(v_measurement_ids)=0 or v_stock_item_id is null) then
      raise exception 'SALE_LINE_SOURCE_MEASUREMENT_STOCK_REQUIRED';
    end if;
    if v_source_type='MANUAL'
       and pg_catalog.jsonb_array_length(v_measurement_ids)>0 then
      raise exception 'SALE_LINE_SOURCE_TYPE_MEASUREMENT_MISMATCH';
    end if;

    v_product_type := btrim(coalesce(v_line->>'productType',''));
    v_product_group := btrim(coalesce(v_line->>'productGroup',''));
    if v_product_type='' or v_product_group='' then
      raise exception 'SALE_LINE_SOURCE_PRODUCT_REQUIRED';
    end if;

    v_metric_unit := btrim(coalesce(v_line->>'metricUnit',''));
    if v_metric_unit not in ('m2','mt','adet') then
      raise exception 'SALE_LINE_SOURCE_METRIC_UNIT_INVALID';
    end if;

    begin
      v_quantity := (v_line->>'quantity')::numeric;
      v_metric_size := (v_line->>'metricSize')::numeric;
      v_unit_price := (v_line->>'unitPrice')::numeric;
      v_discount := (v_line->>'discount')::numeric;
      v_row_total := (v_line->>'rowTotal')::numeric;
    exception when others then
      raise exception 'SALE_LINE_SOURCE_NUMERIC_INVALID';
    end;

    if v_quantity is null or v_quantity<=0 then
      raise exception 'SALE_LINE_SOURCE_QUANTITY_INVALID';
    end if;
    if v_metric_size is null or v_metric_size<=0 then
      raise exception 'SALE_LINE_SOURCE_METRIC_SIZE_INVALID';
    end if;
    if v_unit_price is null or v_unit_price<0 then
      raise exception 'SALE_LINE_SOURCE_UNIT_PRICE_INVALID';
    end if;
    if v_discount is null or v_discount<0 then
      raise exception 'SALE_LINE_SOURCE_DISCOUNT_INVALID';
    end if;
    if v_row_total is null or v_row_total<0 then
      raise exception 'SALE_LINE_SOURCE_ROW_TOTAL_INVALID';
    end if;
  end loop;

  select *
  into v_existing
  from public.sale_line_source_snapshots_v1 x
  where x.tenant_id=v_tenant
    and x.company_id=v_company
    and x.branch_id=v_branch
    and x.accounting_period_id=v_period
    and x.sale_id=v_sale_id
  order by x.source_version desc
  limit 1
  for update;

  if found then
    if v_existing.customer_id is distinct from v_customer_id
       or v_existing.currency is distinct from v_currency then
      raise exception 'SALE_LINE_SOURCE_EXISTING_IDENTITY_CONFLICT';
    end if;

    if v_existing.payload = p_source then
      return pg_catalog.jsonb_build_object(
        'outcome','IDEMPOTENT',
        'saleId',v_sale_id,
        'sourceVersion',v_existing.source_version,
        'lineCount',v_existing.line_count
      );
    end if;

    if v_sale.status='ONAYLANDI' then
      raise exception 'SALE_LINE_SOURCE_APPROVED_IMMUTABLE';
    end if;

    if v_sale.status not in ('TASLAK','TEKLİF') then
      raise exception 'SALE_LINE_SOURCE_SALE_STATUS_INVALID';
    end if;

    v_version := v_existing.source_version + 1;
    v_outcome := 'UPDATED';
  else
    if v_sale.status='ONAYLANDI' then
      raise exception 'SALE_LINE_SOURCE_APPROVED_SNAPSHOT_REQUIRED';
    end if;

    if v_sale.status not in ('TASLAK','TEKLİF') then
      raise exception 'SALE_LINE_SOURCE_SALE_STATUS_INVALID';
    end if;

    v_version := 1;
    v_outcome := 'CREATED';
  end if;

  insert into public.sale_line_source_snapshots_v1 (
    tenant_id,company_id,branch_id,accounting_period_id,
    sale_id,customer_id,currency,sale_total,
    source_version,line_count,payload,actor_user_id
  ) values (
    v_tenant,v_company,v_branch,v_period,
    v_sale_id,v_customer_id,v_currency,v_sale_total,
    v_version,v_line_count,p_source,btrim(p_actor_user_id)
  );

  for v_line in
    select value from pg_catalog.jsonb_array_elements(v_lines)
  loop
    insert into public.sale_line_source_rows_v1 (
      tenant_id,company_id,branch_id,accounting_period_id,
      sale_id,source_version,source_sale_item_id,
      source_measurement_ids,source_type,stock_item_id,
      room_name,window_name,product_type,product_group,
      quantity,metric_size,metric_unit,unit_price,discount,row_total,
      note,actor_user_id
    ) values (
      v_tenant,v_company,v_branch,v_period,
      v_sale_id,v_version,btrim(v_line->>'sourceSaleItemId'),
      coalesce(v_line->'sourceMeasurementIds','[]'::jsonb),
      btrim(v_line->>'sourceType'),
      nullif(btrim(coalesce(v_line->>'stockItemId','')),''),
      btrim(coalesce(v_line->>'roomName','')),
      btrim(coalesce(v_line->>'windowName','')),
      btrim(v_line->>'productType'),
      btrim(v_line->>'productGroup'),
      (v_line->>'quantity')::numeric,
      (v_line->>'metricSize')::numeric,
      btrim(v_line->>'metricUnit'),
      (v_line->>'unitPrice')::numeric,
      (v_line->>'discount')::numeric,
      (v_line->>'rowTotal')::numeric,
      nullif(btrim(coalesce(v_line->>'note','')),''),
      btrim(p_actor_user_id)
    );
  end loop;

  return pg_catalog.jsonb_build_object(
    'outcome',v_outcome,
    'saleId',v_sale_id,
    'sourceVersion',v_version,
    'lineCount',v_line_count
  );
end;
$function$;

revoke all
on function public.persist_sale_line_source_snapshot_v1(jsonb,text)
from public,anon,authenticated;

grant execute
on function public.persist_sale_line_source_snapshot_v1(jsonb,text)
to service_role;

commit;