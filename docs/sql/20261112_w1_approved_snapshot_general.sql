-- W1 approved snapshot binding and GENERAL source cutover.
-- Prerequisites: current W1 tables, extensions.digest, scoped keys and the
-- canonical snapshot/row schema. Coordinate with the API that passes
-- approvedLineSnapshotVersion. Read RPC and existing keys stay in place.
-- No backfill. An older approval without a binding fails closed in ensure.
-- Rollback: before commit the transaction can be rolled back. After cutover,
-- keep the approval bindings and committed GENERAL/events. Do not restore the
-- legacy reader for sales approved under this contract without compatibility.

begin;
alter table public.sale_line_source_snapshots_v1
  add column if not exists sale_document_version bigint,
  add column if not exists sale_document_payload_hash text;
alter table public.sale_documents_v1
  add column if not exists approved_line_snapshot_version bigint,
  add column if not exists approved_line_snapshot_payload jsonb,
  add column if not exists approved_line_rows_payload jsonb;

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
  v_gross_total numeric := 0;
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
    v_gross_total := v_gross_total + v_row_total;
  end loop;

  -- The document stores gross at numeric(18,2). The snapshot stores net
  -- after the sale-level discount, whose amount is absent from this schema.
  if v_gross_total::numeric(18,2) is distinct from v_sale.total_amount
     or v_sale_total <> v_sale_total::numeric(18,2)
     or v_sale_total > v_sale.total_amount then
    raise exception 'W1_SALE_TOTAL_MISMATCH';
  end if;

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

    if v_existing.payload = p_source and (
      v_sale.status = 'ONAYLANDI' or (
        v_existing.sale_document_version = v_sale.source_version and
        v_existing.sale_document_payload_hash = v_sale.payload_hash
      )
    ) then
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
    source_version,line_count,payload,actor_user_id,sale_document_version,sale_document_payload_hash
  ) values (
    v_tenant,v_company,v_branch,v_period,
    v_sale_id,v_customer_id,v_currency,v_sale_total,
    v_version,v_line_count,p_source,btrim(p_actor_user_id),v_sale.source_version,v_sale.payload_hash
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

create or replace function public.approve_sale_document_authority_v1(
  p_scope jsonb,
  p_sale_id text,
  p_actor_user_id text,
  p_allow_self_approval boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_tenant text := btrim(coalesce(p_scope->>'tenantId',''));
  v_company text := btrim(coalesce(p_scope->>'companyId',''));
  v_branch text := btrim(coalesce(p_scope->>'branchId',''));
  v_period text := btrim(coalesce(p_scope->>'accountingPeriodId',''));
  v_sale_id text := btrim(coalesce(p_sale_id,''));
  v_actor text := btrim(coalesce(p_actor_user_id,''));
  v_sale public.sale_documents_v1%rowtype;
  v_snapshot_version_text text := p_scope->>'approvedLineSnapshotVersion';
  v_snapshot public.sale_line_source_snapshots_v1%rowtype;
  v_rows jsonb;
  v_snapshot_gross numeric;
begin
  if v_tenant='' or v_company='' or v_branch='' or v_period=''
     or v_sale_id='' or v_actor='' then
    raise exception 'SALE_APPROVAL_REQUIRED_FIELD_MISSING';
  end if;

  select * into v_sale
  from public.sale_documents_v1 s
  where s.tenant_id=v_tenant and s.company_id=v_company
    and s.branch_id=v_branch and s.accounting_period_id=v_period
    and s.sale_id=v_sale_id
  for update;

  if not found then
    raise exception 'SALE_APPROVAL_SOURCE_NOT_FOUND';
  end if;

  if v_sale.status='ONAYLANDI' then
    return jsonb_build_object(
      'outcome','REPLAY','saleId',v_sale_id,
      'approvedByUserId',v_sale.approved_by_user_id
    );
  end if;

  if v_sale.status not in ('TASLAK','TEKLİF') then
    raise exception 'SALE_APPROVAL_STATUS_INVALID';
  end if;

  if not coalesce(p_allow_self_approval,false)
     and v_sale.created_by_user_id=v_actor then
    raise exception 'SALE_APPROVAL_MAKER_CHECKER_REJECTED';
  end if;

  if v_snapshot_version_text is null or v_snapshot_version_text !~ '^[1-9][0-9]{0,15}$' then
    raise exception 'W1_APPROVED_SNAPSHOT_VERSION_REQUIRED';
  end if;

  select * into v_snapshot
  from public.sale_line_source_snapshots_v1 s
  where s.tenant_id=v_tenant and s.company_id=v_company
    and s.branch_id=v_branch and s.accounting_period_id=v_period
    and s.sale_id=v_sale_id and s.source_version=v_snapshot_version_text::bigint
  for update;

  if not found
     or v_snapshot.sale_document_version is distinct from v_sale.source_version
     or v_snapshot.sale_document_payload_hash is distinct from v_sale.payload_hash
     or v_snapshot.customer_id is distinct from v_sale.customer_id
     or v_snapshot.currency is distinct from v_sale.currency then
    raise exception 'W1_APPROVED_SNAPSHOT_BINDING_MISMATCH';
  end if;

  select jsonb_agg(to_jsonb(r) order by r.source_sale_item_id) into v_rows
  from public.sale_line_source_rows_v1 r
  where r.tenant_id=v_tenant and r.company_id=v_company
    and r.branch_id=v_branch and r.accounting_period_id=v_period
    and r.sale_id=v_sale_id and r.source_version=v_snapshot.source_version;

  if v_rows is null or jsonb_array_length(v_rows) <> v_snapshot.line_count then
    raise exception 'W1_INCOMPLETE_SALE_LINES';
  end if;

  -- Recheck the original row totals at document precision, and verify
  -- each stored amount using the row column's existing numeric(18,6) scale.
  select sum((item.line->>'rowTotal')::numeric)
  into v_snapshot_gross
  from jsonb_array_elements(v_snapshot.payload->'lines') item(line);

  if v_snapshot_gross::numeric(18,2) is distinct from v_sale.total_amount
     or v_snapshot.sale_total is distinct from (v_snapshot.payload->>'saleTotal')::numeric(18,6)
     or v_snapshot.sale_total <> v_snapshot.sale_total::numeric(18,2)
     or v_snapshot.sale_total <= 0
     or v_snapshot.sale_total > v_sale.total_amount
     or exists (
       select 1
       from jsonb_array_elements(v_rows) stored(row_data)
       left join jsonb_array_elements(v_snapshot.payload->'lines') item(line)
         on stored.row_data->>'source_sale_item_id'=btrim(item.line->>'sourceSaleItemId')
       where (stored.row_data->>'row_total')::numeric
         is distinct from (item.line->>'rowTotal')::numeric(18,6)
     ) then
    raise exception 'W1_SALE_TOTAL_MISMATCH';
  end if;

  update public.sale_documents_v1
  set status='ONAYLANDI',
      approved_by_user_id=v_actor,
      approved_at=now(),
      approved_line_snapshot_version=v_snapshot.source_version,
      approved_line_snapshot_payload=v_snapshot.payload,
      approved_line_rows_payload=v_rows,
      updated_at=now()
  where tenant_id=v_tenant and company_id=v_company
    and branch_id=v_branch and accounting_period_id=v_period
    and sale_id=v_sale_id;

  return jsonb_build_object(
    'outcome','APPROVED','saleId',v_sale_id,
    'createdByUserId',v_sale.created_by_user_id,
    'approvedByUserId',v_actor
  );
end;
$function$;



CREATE OR REPLACE FUNCTION public.ensure_approved_main_operation_w1_candidate(p_tenant_id text, p_company_id text, p_branch_id text, p_accounting_period_id text, p_sale_id text, p_actor_user_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$

DECLARE
  v_sale public.sale_documents_v1%ROWTYPE;
  v_customer text;
  v_address text;
  v_lines jsonb;
  v_count integer;
  v_snapshot public.sale_line_source_snapshots_v1%ROWTYPE;
  v_verified_rows jsonb;
  v_payload jsonb;
  v_hash text;
  v_op public.erp_main_operations_v1%ROWTYPE;
  v_t uuid;
  v_c uuid;
  v_b uuid;
  v_p uuid;
  v_time timestamptz;

BEGIN
  IF nullif(btrim(p_tenant_id),'') IS NULL
     OR nullif(btrim(p_company_id),'') IS NULL
     OR nullif(btrim(p_branch_id),'') IS NULL
     OR nullif(btrim(p_accounting_period_id),'') IS NULL
     OR nullif(btrim(p_sale_id),'') IS NULL
     OR nullif(btrim(p_actor_user_id),'') IS NULL
  THEN
     RAISE EXCEPTION 'W1_BAD_INPUT' USING ERRCODE='22023';
  END IF;

  BEGIN
     v_t := p_tenant_id::uuid;
     v_c := p_company_id::uuid;
     v_b := p_branch_id::uuid;
     v_p := p_accounting_period_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
     RAISE EXCEPTION 'W1_NON_UUID_SCOPE' USING ERRCODE='22023';
  END;

  -- Runtime user must be authorized by Next server.
  -- Lock approved sale to serialize operation creation.

  SELECT * INTO STRICT v_sale
  FROM public.sale_documents_v1
  WHERE tenant_id=p_tenant_id
    AND company_id=p_company_id
    AND branch_id=p_branch_id
    AND accounting_period_id=p_accounting_period_id
    AND sale_id=p_sale_id
  FOR UPDATE;

  IF v_sale.status <> 'ONAYLANDI'
     OR v_sale.approved_at IS NULL
     OR v_sale.source_version < 1
  THEN
     RAISE EXCEPTION 'W1_SALE_NOT_APPROVED'
     USING ERRCODE='23514';
  END IF;

  IF v_sale.created_at IS NULL
     OR v_sale.created_by_user_id IS NULL
     OR v_sale.approved_by_user_id IS NULL
  THEN
     RAISE EXCEPTION 'W1_SALE_PROVENANCE_MISSING'
     USING ERRCODE='23514';
  END IF;

  -- UUID scope matching mandatory.
  -- No fallback to ID-only legacy customers.

  SELECT c.name INTO STRICT v_customer
  FROM public.customers c
  WHERE c.id=v_sale.customer_id
    AND c."isDeleted"=false
    AND c.tenant_id=v_t
    AND c.company_id=v_c
    AND c.branch_id=v_b
    AND c.accounting_period_id=v_p;

  IF nullif(btrim(v_customer),'') IS NULL THEN
     RAISE EXCEPTION 'W1_CUSTOMER_NAME_MISSING'
     USING ERRCODE='23514';
  END IF;

  v_address := NULL;

  IF v_sale.customer_address_id IS NOT NULL THEN

     SELECT a.address INTO STRICT v_address
     FROM public.customer_addresses a
     WHERE a.id=v_sale.customer_address_id
       AND a."customerId"=v_sale.customer_id
       AND a."isDeleted"=false
       AND a.tenant_id=v_t
       AND a.company_id=v_c
       AND a.branch_id=v_b
       AND a.accounting_period_id=v_p;

  ELSIF v_sale.customer_address_snapshot IS NOT NULL THEN

     RAISE EXCEPTION 'W1_ADDRESS_SNAPSHOT_UNVERIFIED'
     USING ERRCODE='23514';

  END IF;

  IF v_sale.approved_line_snapshot_version IS NULL
     OR v_sale.approved_line_snapshot_payload IS NULL
     OR v_sale.approved_line_rows_payload IS NULL THEN
    RAISE EXCEPTION 'W1_APPROVED_SNAPSHOT_BINDING_REQUIRED' USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_snapshot
  FROM public.sale_line_source_snapshots_v1 s
  WHERE (s.tenant_id,s.company_id,s.branch_id,s.accounting_period_id,s.sale_id,s.source_version)
      = (v_sale.tenant_id,v_sale.company_id,v_sale.branch_id,v_sale.accounting_period_id,
         v_sale.sale_id,v_sale.approved_line_snapshot_version)
  FOR UPDATE;

  IF NOT FOUND
     OR v_snapshot.customer_id IS DISTINCT FROM v_sale.customer_id
     OR v_snapshot.currency IS DISTINCT FROM v_sale.currency
     OR v_snapshot.sale_document_version IS DISTINCT FROM v_sale.source_version
     OR v_snapshot.sale_document_payload_hash IS DISTINCT FROM v_sale.payload_hash
     OR v_snapshot.payload IS DISTINCT FROM v_sale.approved_line_snapshot_payload THEN
    RAISE EXCEPTION 'W1_APPROVED_SNAPSHOT_BINDING_MISMATCH' USING ERRCODE='23514';
  END IF;

  SELECT count(*)::integer, jsonb_agg(to_jsonb(r) ORDER BY r.source_sale_item_id)
  INTO v_count,v_verified_rows
  FROM public.sale_line_source_rows_v1 r
  WHERE (r.tenant_id,r.company_id,r.branch_id,r.accounting_period_id,r.sale_id,r.source_version)
      = (v_sale.tenant_id,v_sale.company_id,v_sale.branch_id,v_sale.accounting_period_id,
         v_sale.sale_id,v_sale.approved_line_snapshot_version);

  IF v_count<1 OR v_count<>v_snapshot.line_count THEN
    RAISE EXCEPTION 'W1_INCOMPLETE_SALE_LINES' USING ERRCODE='23514';
  END IF;
  IF v_verified_rows IS DISTINCT FROM v_sale.approved_line_rows_payload THEN
    RAISE EXCEPTION 'W1_APPROVED_SNAPSHOT_ROWS_CHANGED' USING ERRCODE='23514';
  END IF;

  -- The snapshot array provides the original order. Render only verified rows.
  SELECT count(DISTINCT r.source_sale_item_id)::integer,
         jsonb_agg(concat_ws(
           ' / ', nullif(r.room_name,''), nullif(r.window_name,''),
           nullif(r.product_type,''), r.quantity::text || ' ' || r.metric_unit
         ) ORDER BY item.ordinality)
  INTO v_count,v_lines
  FROM jsonb_array_elements(v_snapshot.payload->'lines') WITH ORDINALITY AS item(line,ordinality)
  JOIN jsonb_to_recordset(v_verified_rows) AS r(
    source_sale_item_id text, room_name text, window_name text,
    product_type text, quantity numeric, metric_unit text
  ) ON r.source_sale_item_id=btrim(item.line->>'sourceSaleItemId');

  IF v_count<>v_snapshot.line_count OR jsonb_array_length(v_lines)<>v_snapshot.line_count THEN
    RAISE EXCEPTION 'W1_INCOMPLETE_SALE_LINES' USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_op
  FROM public.erp_main_operations_v1
  WHERE tenant_id=p_tenant_id
    AND company_id=p_company_id
    AND branch_id=p_branch_id
    AND accounting_period_id=p_accounting_period_id
    AND sale_id=p_sale_id
  FOR UPDATE;

  IF FOUND THEN

    IF v_op.payload_hash <>
      encode(
        extensions.digest(
          v_op.operation_payload::text,
          'sha256'
        ),
        'hex'
      )
    THEN
       RAISE EXCEPTION 'W1_PAYLOAD_INTEGRITY_FAILED'
       USING ERRCODE='23514';
    END IF;

    IF v_op.source_sale_version<>v_sale.source_version THEN
       RAISE EXCEPTION 'W1_SALE_REVISION_CHANGED'
       USING ERRCODE='23514';
    END IF;

    RETURN jsonb_build_object(
      'operation_id',v_op.operation_id,
      'sale_id',v_op.sale_id,
      'kind',v_op.kind,
      'status',v_op.status,
      'source_sale_version',v_op.source_sale_version,
      'version',v_op.version,
      'created_at',v_op.created_at,
      'updated_at',v_op.updated_at,
      'operation_payload',v_op.operation_payload,
      'payload_hash',v_op.payload_hash
    );

  END IF;

  -- Dates are initial anchors, not appointments.

  v_time := v_sale.created_at;

  v_payload := jsonb_build_object(
    'tenantId',p_tenant_id,
    'companyId',p_company_id,
    'branchId',p_branch_id,
    'accountingPeriodId',p_accounting_period_id,
    'id','general-operation:'||p_sale_id,
    'idempotencyKey','GENERAL:'||p_sale_id,
    'kind','GENERAL',
    'sourceId',p_sale_id,
    'saleId',p_sale_id,
    'customerId',v_sale.customer_id,
    'customerName',v_customer,
    'title','Genel İş Takibi — '||
      coalesce(nullif(v_sale.sale_number,''),p_sale_id),
    'details',v_lines,
    'scheduledAt',
      to_char(
        v_time AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
    'dueAt',
      to_char(
        v_time AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
    'status','DRAFT',
    'notes','Satış kaydından otomatik oluşturuldu.',
    'createdByUserId',v_sale.created_by_user_id,
    'createdAt',
      to_char(
        v_time AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
    'updatedAt',
      to_char(
        v_time AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
  );

  IF v_address IS NOT NULL THEN
     v_payload := v_payload ||
       jsonb_build_object('address',v_address);
  END IF;

  v_hash := encode(
    extensions.digest(
      v_payload::text,
      'sha256'
    ),
    'hex'
  );

  INSERT INTO public.erp_main_operations_v1 (
     tenant_id,
     company_id,
     branch_id,
     accounting_period_id,
     sale_id,
     operation_id,
     kind,
     status,
     source_sale_version,
     version,
     operation_payload,
     payload_hash,
     created_at,
     updated_at
  )
  VALUES (
     p_tenant_id,
     p_company_id,
     p_branch_id,
     p_accounting_period_id,
     p_sale_id,
     'general-operation:'||p_sale_id,
     'GENERAL',
     'DRAFT',
     v_sale.source_version,
     1,
     v_payload,
     v_hash,
     v_time,
     v_time
  )
  RETURNING * INTO v_op;

  INSERT INTO public.erp_main_operation_events_v1 (
     tenant_id,
     company_id,
     branch_id,
     accounting_period_id,
     event_id,
     operation_id,
     event_type,
     actor_user_id,
     event_payload
  )
  VALUES (
     p_tenant_id,
     p_company_id,
     p_branch_id,
     p_accounting_period_id,
     'created:'||v_op.operation_id,
     v_op.operation_id,
     'CREATED',
     p_actor_user_id,
     jsonb_build_object(
       'source_sale_version',
       v_sale.source_version
     )
  );

  RETURN jsonb_build_object(
    'operation_id',v_op.operation_id,
    'sale_id',v_op.sale_id,
    'kind',v_op.kind,
    'status',v_op.status,
    'source_sale_version',v_op.source_sale_version,
    'version',v_op.version,
    'created_at',v_op.created_at,
    'updated_at',v_op.updated_at,
    'operation_payload',v_op.operation_payload,
    'payload_hash',v_op.payload_hash
  );

EXCEPTION
  WHEN no_data_found THEN
    RAISE EXCEPTION 'W1_REQUIRED_SOURCE_MISSING'
    USING ERRCODE='P0002';

  WHEN too_many_rows THEN
    RAISE EXCEPTION 'W1_SOURCE_NOT_UNIQUE'
    USING ERRCODE='P0003';

END;
$function$;

revoke all on function public.approve_sale_document_authority_v1(jsonb,text,text,boolean)
  from public, anon, authenticated;
grant execute on function public.approve_sale_document_authority_v1(jsonb,text,text,boolean)
  to service_role;
revoke all on function public.persist_sale_line_source_snapshot_v1(jsonb,text)
  from public, anon, authenticated;
grant execute on function public.persist_sale_line_source_snapshot_v1(jsonb,text)
  to service_role;

revoke execute on function public.ensure_approved_main_operation_w1_candidate(text,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.ensure_approved_main_operation_w1_candidate(text,text,text,text,text,text)
  to service_role;
commit;