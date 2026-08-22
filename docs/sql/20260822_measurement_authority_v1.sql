-- ENVerp Measurement Canonical Authority V1.1
-- SOURCE FILE ONLY. This migration is NOT executed by the patch script.

alter table public.measurements
  add column if not exists "templateType" text,
  add column if not exists "rawValues" jsonb not null default '{}'::jsonb,
  add column if not exists "productId" text,
  add column if not exists "productGroup" text,
  add column if not exists "calculatedHeight" numeric,
  add column if not exists "details" jsonb not null default '{}'::jsonb,
  add column if not exists "createdById" text,
  add column if not exists "measuredBy" text,
  add column if not exists "measuredById" text,
  add column if not exists "measuredDate" timestamptz,
  add column if not exists "notesHistory" jsonb not null default '[]'::jsonb,
  add column if not exists entity_version bigint not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.measurements'::regclass
      and conname = 'measurements_entity_version_positive'
  ) then
    alter table public.measurements
      add constraint measurements_entity_version_positive
      check (entity_version > 0);
  end if;
end
$$;

create table if not exists public.measurement_command_receipts (
  change_id text primary key,
  tenant_id uuid not null,
  company_id uuid not null,
  branch_id uuid not null,
  accounting_period_id uuid not null,
  entity_id text not null,
  operation text not null check (operation in ('INSERT','UPDATE','SOFT_DELETE')),
  expected_version bigint not null check (expected_version >= 0),
  resulting_version bigint,
  actor_user_id text not null,
  command_payload jsonb not null,
  outcome text not null check (outcome in ('PENDING','COMPLETED')),
  result_json jsonb,
  created_at timestamptz not null default pg_catalog.now(),
  completed_at timestamptz
);

alter table public.measurement_command_receipts enable row level security;
alter table public.measurement_command_receipts force row level security;

revoke all on table public.measurement_command_receipts from public, anon, authenticated, service_role;

create or replace function public.persist_measurement_authority_v1(
  p_command jsonb,
  p_context jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_change_id text;
  v_entity_id text;
  v_operation text;
  v_expected_version bigint;
  v_actor_user_id text;
  v_device_id text;
  v_tenant_id uuid;
  v_company_id uuid;
  v_branch_id uuid;
  v_accounting_period_id uuid;
  v_payload jsonb;
  v_customer_id text;
  v_room_id text;
  v_opening_id text;
  v_window_id text;
  v_current_version bigint;
  v_current_is_deleted boolean;
  v_row_tenant uuid;
  v_row_company uuid;
  v_row_branch uuid;
  v_row_period uuid;
  v_resulting_version bigint;
  v_inserted integer;
  v_existing_receipt public.measurement_command_receipts%rowtype;
  v_entity_json jsonb;
  v_result jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'MEASUREMENT_AUTHORITY_FORBIDDEN';
  end if;

  if p_command is null or pg_catalog.jsonb_typeof(p_command) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'MEASUREMENT_COMMAND_INVALID';
  end if;
  if p_context is null or pg_catalog.jsonb_typeof(p_context) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'MEASUREMENT_CONTEXT_INVALID';
  end if;

  v_change_id := pg_catalog.btrim(coalesce(p_command->>'changeId',''));
  v_entity_id := pg_catalog.btrim(coalesce(p_command->>'entityId',''));
  v_operation := pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'operation','')));
  v_actor_user_id := pg_catalog.btrim(coalesce(p_context->>'actorUserId',''));
  v_device_id := pg_catalog.btrim(coalesce(p_command->>'deviceId','unknown'));
  v_payload := coalesce(p_command->'payload','{}'::jsonb);

  if v_change_id = '' or v_entity_id = '' or v_actor_user_id = '' then
    raise exception using errcode = '22023', message = 'MEASUREMENT_COMMAND_IDENTITY_MISSING';
  end if;
  if v_operation not in ('INSERT','UPDATE','SOFT_DELETE') then
    raise exception using errcode = '22023', message = 'MEASUREMENT_OPERATION_UNSUPPORTED';
  end if;
  if pg_catalog.jsonb_typeof(v_payload) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'MEASUREMENT_PAYLOAD_INVALID';
  end if;
  if coalesce(p_command->>'expectedVersion','') !~ '^[0-9]+$' then
    raise exception using errcode = '22023', message = 'MEASUREMENT_EXPECTED_VERSION_MISSING';
  end if;
  v_expected_version := (p_command->>'expectedVersion')::bigint;

  begin
    v_tenant_id := (p_context->>'tenantId')::uuid;
    v_company_id := (p_context->>'companyId')::uuid;
    v_branch_id := (p_context->>'branchId')::uuid;
    v_accounting_period_id := (p_context->>'accountingPeriodId')::uuid;
  exception
    when invalid_text_representation then
      raise exception using errcode = '22023', message = 'MEASUREMENT_SCOPE_INVALID';
  end;

  if v_tenant_id is null or v_company_id is null or v_branch_id is null or v_accounting_period_id is null then
    raise exception using errcode = '22023', message = 'MEASUREMENT_SCOPE_MISSING';
  end if;

  v_customer_id := pg_catalog.btrim(coalesce(v_payload->>'customerId',''));
  v_room_id := pg_catalog.btrim(coalesce(v_payload->>'roomId',''));
  v_opening_id := pg_catalog.btrim(coalesce(v_payload->>'openingId',''));
  v_window_id := pg_catalog.btrim(coalesce(v_payload->>'windowId',''));

  if v_opening_id = '' and v_window_id <> '' then
    v_opening_id := v_window_id;
  end if;
  if v_opening_id <> '' and v_window_id <> '' and v_opening_id <> v_window_id then
    raise exception using errcode = '22023', message = 'MEASUREMENT_OPENING_WINDOW_MISMATCH';
  end if;
  if v_customer_id = '' or v_room_id = '' or v_opening_id = '' then
    raise exception using errcode = '22023', message = 'MEASUREMENT_PARENT_ID_MISSING';
  end if;

  perform 1
  from public.customers c
  where c.id = v_customer_id
    and c.tenant_id = v_tenant_id
    and c.company_id = v_company_id
    and c.branch_id = v_branch_id
    and c.accounting_period_id = v_accounting_period_id;
  if not found then
    raise exception using errcode = '23503', message = 'MEASUREMENT_CUSTOMER_SCOPE_PARENT_MISMATCH';
  end if;

  perform 1
  from public.rooms r
  where r.id = v_room_id
    and r."customerId" = v_customer_id
    and r.tenant_id = v_tenant_id
    and r.company_id = v_company_id
    and r.branch_id = v_branch_id
    and r.accounting_period_id = v_accounting_period_id;
  if not found then
    raise exception using errcode = '23503', message = 'MEASUREMENT_ROOM_SCOPE_PARENT_MISMATCH';
  end if;

  perform 1
  from public.openings o
  where o.id = v_opening_id
    and o."roomId" = v_room_id
    and o.tenant_id = v_tenant_id
    and o.company_id = v_company_id
    and o.branch_id = v_branch_id
    and o.accounting_period_id = v_accounting_period_id;
  if not found then
    raise exception using errcode = '23503', message = 'MEASUREMENT_OPENING_SCOPE_PARENT_MISMATCH';
  end if;

  insert into public.measurement_command_receipts (
    change_id,
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    entity_id,
    operation,
    expected_version,
    actor_user_id,
    command_payload,
    outcome
  )
  values (
    v_change_id,
    v_tenant_id,
    v_company_id,
    v_branch_id,
    v_accounting_period_id,
    v_entity_id,
    v_operation,
    v_expected_version,
    v_actor_user_id,
    p_command,
    'PENDING'
  )
  on conflict (change_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select *
    into v_existing_receipt
    from public.measurement_command_receipts
    where change_id = v_change_id
    for update;

    if v_existing_receipt.tenant_id <> v_tenant_id
       or v_existing_receipt.company_id <> v_company_id
       or v_existing_receipt.branch_id <> v_branch_id
       or v_existing_receipt.accounting_period_id <> v_accounting_period_id
       or v_existing_receipt.entity_id <> v_entity_id
       or v_existing_receipt.operation <> v_operation
       or v_existing_receipt.expected_version <> v_expected_version
       or v_existing_receipt.actor_user_id <> v_actor_user_id
       or v_existing_receipt.command_payload <> p_command then
      raise exception using errcode = '23505', message = 'MEASUREMENT_IDEMPOTENCY_CONFLICT';
    end if;

    if v_existing_receipt.outcome = 'COMPLETED' and v_existing_receipt.result_json is not null then
      return v_existing_receipt.result_json || pg_catalog.jsonb_build_object('outcome','REPLAY');
    end if;

    raise exception using errcode = '40001', message = 'MEASUREMENT_COMMAND_IN_PROGRESS';
  end if;

  if v_operation = 'INSERT' then
    if v_expected_version <> 0 then
      raise exception using errcode = '22023', message = 'MEASUREMENT_INSERT_EXPECTED_VERSION_MUST_BE_ZERO';
    end if;

    perform 1 from public.measurements m where m.id = v_entity_id for update;
    if found then
      raise exception using errcode = '23505', message = 'MEASUREMENT_ALREADY_EXISTS';
    end if;

    insert into public.measurements (
      id,
      "customerId",
      "roomId",
      "openingId",
      "templateType",
      "rawValues",
      "productId",
      "productGroup",
      "productType",
      "calculatedWidth",
      "calculatedHeight",
      "details",
      notes,
      status,
      "createdById",
      "measuredBy",
      "measuredById",
      "measuredDate",
      "notesHistory",
      "createdAt",
      "updatedAt",
      "isDeleted",
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      entity_version
    )
    values (
      v_entity_id,
      v_customer_id,
      v_room_id,
      v_opening_id,
      nullif(v_payload->>'templateType',''),
      coalesce(v_payload->'rawValues','{}'::jsonb),
      nullif(v_payload->>'productId',''),
      nullif(v_payload->>'productGroup',''),
      nullif(v_payload->>'productType',''),
      nullif(v_payload->>'calculatedWidth','')::numeric,
      nullif(v_payload->>'calculatedHeight','')::numeric,
      coalesce(v_payload->'details','{}'::jsonb),
      coalesce(v_payload->>'notes',''),
      coalesce(v_payload->>'status',''),
      nullif(v_payload->>'createdById',''),
      coalesce(v_payload->>'measuredBy',''),
      nullif(v_payload->>'measuredById',''),
      coalesce(nullif(v_payload->>'measuredDate','')::timestamptz, pg_catalog.now()),
      coalesce(v_payload->'notesHistory','[]'::jsonb),
      coalesce(nullif(v_payload->>'createdAt','')::timestamptz, pg_catalog.now()),
      pg_catalog.now(),
      false,
      v_tenant_id,
      v_company_id,
      v_branch_id,
      v_accounting_period_id,
      1
    );

    v_resulting_version := 1;
  else
    select
      m.entity_version,
      m."isDeleted",
      m.tenant_id,
      m.company_id,
      m.branch_id,
      m.accounting_period_id
    into
      v_current_version,
      v_current_is_deleted,
      v_row_tenant,
      v_row_company,
      v_row_branch,
      v_row_period
    from public.measurements m
    where m.id = v_entity_id
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'MEASUREMENT_NOT_FOUND';
    end if;

    if v_row_tenant <> v_tenant_id
       or v_row_company <> v_company_id
       or v_row_branch <> v_branch_id
       or v_row_period <> v_accounting_period_id then
      raise exception using errcode = '42501', message = 'MEASUREMENT_SCOPE_MISMATCH';
    end if;

    if v_expected_version < 1 then
      raise exception using errcode = '22023', message = 'MEASUREMENT_UPDATE_EXPECTED_VERSION_INVALID';
    end if;
    if v_current_version <> v_expected_version then
      raise exception using errcode = '40001', message = 'MEASUREMENT_STALE_VERSION';
    end if;

    v_resulting_version := v_current_version + 1;
    if v_current_is_deleted then
      raise exception using errcode = '55000', message = 'MEASUREMENT_ALREADY_SOFT_DELETED';
    end if;


    if v_operation = 'SOFT_DELETE' then
      update public.measurements
      set
        "isDeleted" = true,
        "updatedAt" = pg_catalog.now(),
        entity_version = v_resulting_version
      where id = v_entity_id;
    else
      update public.measurements
      set
        "customerId" = v_customer_id,
        "roomId" = v_room_id,
        "openingId" = v_opening_id,
        "templateType" = nullif(v_payload->>'templateType',''),
        "rawValues" = coalesce(v_payload->'rawValues','{}'::jsonb),
        "productId" = nullif(v_payload->>'productId',''),
        "productGroup" = nullif(v_payload->>'productGroup',''),
        "productType" = nullif(v_payload->>'productType',''),
        "calculatedWidth" = nullif(v_payload->>'calculatedWidth','')::numeric,
        "calculatedHeight" = nullif(v_payload->>'calculatedHeight','')::numeric,
        "details" = coalesce(v_payload->'details','{}'::jsonb),
        notes = coalesce(v_payload->>'notes',''),
        status = coalesce(v_payload->>'status',''),
        "createdById" = nullif(v_payload->>'createdById',''),
        "measuredBy" = coalesce(v_payload->>'measuredBy',''),
        "measuredById" = nullif(v_payload->>'measuredById',''),
        "measuredDate" = coalesce(nullif(v_payload->>'measuredDate','')::timestamptz, "measuredDate"),
        "notesHistory" = coalesce(v_payload->'notesHistory','[]'::jsonb),
        "updatedAt" = pg_catalog.now(),
        "isDeleted" = false,
        entity_version = v_resulting_version
      where id = v_entity_id;
    end if;
  end if;

  select pg_catalog.to_jsonb(m)
  into v_entity_json
  from public.measurements m
  where m.id = v_entity_id
    and m.tenant_id = v_tenant_id
    and m.company_id = v_company_id
    and m.branch_id = v_branch_id
    and m.accounting_period_id = v_accounting_period_id;

  if v_entity_json is null then
    raise exception using errcode = 'P0002', message = 'MEASUREMENT_CANONICAL_READBACK_FAILED';
  end if;

  v_entity_json := v_entity_json || pg_catalog.jsonb_build_object('version',v_resulting_version);

  insert into public.measurement_changes (
    change_id,
    entity_type,
    entity_id,
    operation,
    patch,
    device_id,
    user_id,
    created_at,
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id
  )
  values (
    v_change_id,
    'MEASUREMENT',
    v_entity_id,
    v_operation,
    pg_catalog.jsonb_build_object('data',v_entity_json),
    v_device_id,
    v_actor_user_id,
    pg_catalog.now(),
    v_tenant_id,
    v_company_id,
    v_branch_id,
    v_accounting_period_id
  );

  v_result := pg_catalog.jsonb_build_object(
    'changeId', v_change_id,
    'entityId', v_entity_id,
    'entityVersion', v_resulting_version,
    'outcome',
      case
        when v_operation = 'INSERT' then 'CREATED'
        when v_operation = 'UPDATE' then 'UPDATED'
        else 'SOFT_DELETED'
      end
  );

  update public.measurement_command_receipts
  set
    resulting_version = v_resulting_version,
    outcome = 'COMPLETED',
    result_json = v_result,
    completed_at = pg_catalog.now()
  where change_id = v_change_id;

  return v_result;
end
$$;

revoke all on function public.persist_measurement_authority_v1(jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.persist_measurement_authority_v1(jsonb,jsonb)
  to service_role;

-- Enforce one canonical application write path.
-- Current closed producer inventory found no other tracked direct measurements writer
-- after sync/customers is migrated by the paired source patch.
revoke insert, update, delete on table public.measurements from service_role;
grant select on table public.measurements to service_role;