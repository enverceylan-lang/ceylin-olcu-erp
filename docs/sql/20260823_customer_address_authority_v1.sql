-- ENVERP CUSTOMER ADDRESS AUTHORITY V1.1
-- SOURCE MIGRATION. DO NOT EXECUTE LIVE WITHOUT SEPARATE APPROVAL.

begin;

create table if not exists public.customer_addresses (
  id text primary key,
  "customerId" text not null,
  title text,
  normalized_title text,
  phone text,
  province text,
  district text,
  address text not null default '',
  "mapLocation" text,
  latitude numeric,
  longitude numeric,
  "legacyPrimary" boolean not null default false,
  "isDeleted" boolean not null default false,
  "createdAt" timestamptz not null default pg_catalog.now(),
  "updatedAt" timestamptz not null default pg_catalog.now(),
  tenant_id uuid not null,
  company_id uuid not null,
  branch_id uuid not null,
  accounting_period_id uuid not null,
  entity_version bigint not null default 1
    check (entity_version > 0)
);

alter table public.customer_addresses enable row level security;
alter table public.customer_addresses force row level security;

revoke all on table public.customer_addresses from public, anon, authenticated, service_role;
grant select on table public.customer_addresses to service_role;

alter table public.rooms
  add column if not exists "customerAddressId" text;

alter table public.measurements
  add column if not exists "customerAddressId" text;

create index if not exists customer_addresses_scope_customer_idx
  on public.customer_addresses (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    "customerId"
  );

create unique index if not exists customer_addresses_active_title_uq
  on public.customer_addresses (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    "customerId",
    normalized_title
  )
  where "isDeleted" = false
    and normalized_title is not null
    and pg_catalog.btrim(normalized_title) <> '';

create table if not exists public.customer_address_command_receipts (
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

alter table public.customer_address_command_receipts enable row level security;
alter table public.customer_address_command_receipts force row level security;
revoke all on table public.customer_address_command_receipts
  from public, anon, authenticated, service_role;

create table if not exists public.customer_address_audits (
  audit_id text primary key,
  change_id text not null,
  tenant_id uuid not null,
  company_id uuid not null,
  branch_id uuid not null,
  accounting_period_id uuid not null,
  address_id text not null,
  customer_id text not null,
  operation text not null,
  actor_user_id text not null,
  before_json jsonb,
  after_json jsonb,
  expected_version bigint not null,
  resulting_version bigint not null,
  created_at timestamptz not null default pg_catalog.now()
);

alter table public.customer_address_audits enable row level security;
alter table public.customer_address_audits force row level security;
revoke all on table public.customer_address_audits
  from public, anon, authenticated, service_role;
create or replace function public.normalize_customer_address_title_v1(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select pg_catalog.regexp_replace(
    pg_catalog.lower(
      pg_catalog.translate(
        pg_catalog.btrim(coalesce(p_value,'')),
        'ÇĞIİÖŞÜçğıöşü',
        'CGIIOSUcgiosu'
      )
    ),
    '\s+',
    ' ',
    'g'
  )
$$;

revoke all on function public.normalize_customer_address_title_v1(text)
  from public, anon, authenticated;
grant execute on function public.normalize_customer_address_title_v1(text)
  to service_role;

create or replace function public.persist_customer_address_authority_v1(
  p_operation text,
  p_address jsonb,
  p_context jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_operation text;
  v_address_id text;
  v_customer_id text;
  v_change_id text;
  v_actor_user_id text;
  v_expected_version bigint;
  v_title text;
  v_normalized_title text;
  v_tenant_id uuid;
  v_company_id uuid;
  v_branch_id uuid;
  v_accounting_period_id uuid;
  v_active_count integer;
  v_other_blank_count integer;
  v_inserted integer;
  v_existing public.customer_addresses%rowtype;
  v_existing_receipt public.customer_address_command_receipts%rowtype;
  v_before jsonb;
  v_result jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'CUSTOMER_ADDRESS_AUTHORITY_FORBIDDEN';
  end if;

  if p_address is null or pg_catalog.jsonb_typeof(p_address) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'CUSTOMER_ADDRESS_PAYLOAD_INVALID';
  end if;
  if p_context is null or pg_catalog.jsonb_typeof(p_context) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'CUSTOMER_ADDRESS_CONTEXT_INVALID';
  end if;

  v_operation := pg_catalog.upper(pg_catalog.btrim(coalesce(p_operation,'')));
  if v_operation not in ('INSERT','UPDATE','SOFT_DELETE') then
    raise exception using errcode = '22023', message = 'CUSTOMER_ADDRESS_OPERATION_UNSUPPORTED';
  end if;

  begin
    v_tenant_id := (p_context->>'tenantId')::uuid;
    v_company_id := (p_context->>'companyId')::uuid;
    v_branch_id := (p_context->>'branchId')::uuid;
    v_accounting_period_id := (p_context->>'accountingPeriodId')::uuid;
  exception
    when invalid_text_representation then
      raise exception using errcode = '22023', message = 'CUSTOMER_ADDRESS_SCOPE_INVALID';
  end;

  if v_tenant_id is null or v_company_id is null or v_branch_id is null or v_accounting_period_id is null then
    raise exception using errcode = '22023', message = 'CUSTOMER_ADDRESS_SCOPE_MISSING';
  end if;

  v_address_id := pg_catalog.btrim(coalesce(p_address->>'id',''));
  v_customer_id := pg_catalog.btrim(coalesce(p_address->>'customerId',''));
  if v_address_id = '' or v_customer_id = '' then
    raise exception using errcode = '22023', message = 'CUSTOMER_ADDRESS_IDENTITY_MISSING';
  end if;

  v_change_id := pg_catalog.btrim(coalesce(p_context->>'changeId',''));
  v_actor_user_id := pg_catalog.btrim(coalesce(p_context->>'actorUserId',''));

  begin
    v_expected_version := (p_context->>'expectedVersion')::bigint;
  exception
    when invalid_text_representation then
      raise exception using errcode = '22023', message = 'CUSTOMER_ADDRESS_EXPECTED_VERSION_INVALID';
  end;

  if v_change_id = '' or v_actor_user_id = '' or v_expected_version is null or v_expected_version < 0 then
    raise exception using errcode = '22023', message = 'CUSTOMER_ADDRESS_COMMAND_METADATA_REQUIRED';
  end if;

  v_title := nullif(pg_catalog.btrim(coalesce(p_address->>'title','')), '');
  v_normalized_title := nullif(public.normalize_customer_address_title_v1(v_title), '');

  insert into public.customer_address_command_receipts (
    change_id, tenant_id, company_id, branch_id, accounting_period_id,
    entity_id, operation, expected_version, actor_user_id, command_payload, outcome
  ) values (
    v_change_id, v_tenant_id, v_company_id, v_branch_id, v_accounting_period_id,
    v_address_id, v_operation, v_expected_version, v_actor_user_id,
    pg_catalog.jsonb_build_object(
      'operation', v_operation,
      'address', p_address,
      'context', p_context
    ),
    'PENDING'
  )
  on conflict (change_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select * into v_existing_receipt
    from public.customer_address_command_receipts
    where change_id = v_change_id
    for update;

    if v_existing_receipt.tenant_id <> v_tenant_id
       or v_existing_receipt.company_id <> v_company_id
       or v_existing_receipt.branch_id <> v_branch_id
       or v_existing_receipt.accounting_period_id <> v_accounting_period_id
       or v_existing_receipt.entity_id <> v_address_id
       or v_existing_receipt.operation <> v_operation
       or v_existing_receipt.expected_version <> v_expected_version
       or v_existing_receipt.actor_user_id <> v_actor_user_id
       or v_existing_receipt.command_payload <> pg_catalog.jsonb_build_object(
         'operation', v_operation,
         'address', p_address,
         'context', p_context
       ) then
      raise exception using errcode = '23505', message = 'CUSTOMER_ADDRESS_IDEMPOTENCY_CONFLICT';
    end if;

    if v_existing_receipt.outcome = 'COMPLETED'
       and v_existing_receipt.result_json is not null then
      return v_existing_receipt.result_json
        || pg_catalog.jsonb_build_object('outcome','REPLAY');
    end if;

    raise exception using errcode = '40001', message = 'CUSTOMER_ADDRESS_COMMAND_IN_PROGRESS';
  end if;

  perform 1
  from public.customers c
  where c.id = v_customer_id
    and c.tenant_id = v_tenant_id
    and c.company_id = v_company_id
    and c.branch_id = v_branch_id
    and c.accounting_period_id = v_accounting_period_id;
  if not found then
    raise exception using errcode = '23503', message = 'CUSTOMER_ADDRESS_CUSTOMER_SCOPE_PARENT_MISMATCH';
  end if;

  perform 1
  from public.customers c
  where c.id = v_customer_id
    and c.tenant_id = v_tenant_id
    and c.company_id = v_company_id
    and c.branch_id = v_branch_id
    and c.accounting_period_id = v_accounting_period_id
  for update;

  if v_operation = 'INSERT' then
    if v_expected_version <> 0 then
      raise exception using errcode = '22023', message = 'CUSTOMER_ADDRESS_INSERT_EXPECTED_VERSION_MUST_BE_ZERO';
    end if;

    perform 1 from public.customer_addresses a where a.id = v_address_id for update;
    if found then
      raise exception using errcode = '23505', message = 'CUSTOMER_ADDRESS_ALREADY_EXISTS';
    end if;

    select count(*) into v_active_count
    from public.customer_addresses a
    where a."customerId" = v_customer_id
      and a.tenant_id = v_tenant_id
      and a.company_id = v_company_id
      and a.branch_id = v_branch_id
      and a.accounting_period_id = v_accounting_period_id
      and a."isDeleted" = false;

    select count(*) into v_other_blank_count
    from public.customer_addresses a
    where a."customerId" = v_customer_id
      and a.tenant_id = v_tenant_id
      and a.company_id = v_company_id
      and a.branch_id = v_branch_id
      and a.accounting_period_id = v_accounting_period_id
      and a."isDeleted" = false
      and coalesce(pg_catalog.btrim(a.normalized_title),'') = '';

    if v_active_count + 1 > 1 and (v_normalized_title is null or v_other_blank_count > 0) then
      raise exception using errcode = '23514', message = 'CUSTOMER_ADDRESS_TITLE_REQUIRED_FOR_MULTI_ACTIVE';
    end if;

    insert into public.customer_addresses (
      id, "customerId", title, normalized_title, phone, province, district,
      address, "mapLocation", latitude, longitude, "legacyPrimary", "isDeleted",
      "createdAt", "updatedAt", tenant_id, company_id, branch_id, accounting_period_id,
      entity_version
    )
    values (
      v_address_id,
      v_customer_id,
      v_title,
      v_normalized_title,
      nullif(pg_catalog.btrim(coalesce(p_address->>'phone','')), ''),
      nullif(pg_catalog.btrim(coalesce(p_address->>'province','')), ''),
      nullif(pg_catalog.btrim(coalesce(p_address->>'district','')), ''),
      coalesce(p_address->>'address',''),
      nullif(pg_catalog.btrim(coalesce(p_address->>'mapLocation','')), ''),
      nullif(p_address->>'latitude','')::numeric,
      nullif(p_address->>'longitude','')::numeric,
      coalesce((p_address->>'legacyPrimary')::boolean,false),
      false,
      coalesce(nullif(p_address->>'createdAt','')::timestamptz, pg_catalog.now()),
      pg_catalog.now(),
      v_tenant_id,
      v_company_id,
      v_branch_id,
      v_accounting_period_id,
      1
    );
  else
    select * into v_existing
    from public.customer_addresses a
    where a.id = v_address_id
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'CUSTOMER_ADDRESS_NOT_FOUND';
    end if;

    if v_existing."customerId" <> v_customer_id
       or v_existing.tenant_id <> v_tenant_id
       or v_existing.company_id <> v_company_id
       or v_existing.branch_id <> v_branch_id
       or v_existing.accounting_period_id <> v_accounting_period_id then
      raise exception using errcode = '42501', message = 'CUSTOMER_ADDRESS_SCOPE_OR_PARENT_MISMATCH';
    end if;

    if v_existing.entity_version <> v_expected_version then
      raise exception using errcode = '40001', message = 'CUSTOMER_ADDRESS_VERSION_CONFLICT';
    end if;

    v_before := pg_catalog.to_jsonb(v_existing);

    if v_operation = 'SOFT_DELETE' then
      perform 1
      from public.rooms r
      where r."customerAddressId" = v_address_id
        and r.tenant_id = v_tenant_id
        and r.company_id = v_company_id
        and r.branch_id = v_branch_id
        and r.accounting_period_id = v_accounting_period_id
        and coalesce(r."isDeleted", false) = false
      limit 1;

      if found then
        raise exception using errcode = '23503', message = 'CUSTOMER_ADDRESS_IN_USE_BY_ROOM';
      end if;

      perform 1
      from public.measurements m
      where m."customerAddressId" = v_address_id
        and m.tenant_id = v_tenant_id
        and m.company_id = v_company_id
        and m.branch_id = v_branch_id
        and m.accounting_period_id = v_accounting_period_id
        and coalesce(m."isDeleted", false) = false
      limit 1;

      if found then
        raise exception using errcode = '23503', message = 'CUSTOMER_ADDRESS_IN_USE_BY_MEASUREMENT';
      end if;

      update public.customer_addresses
      set "isDeleted" = true,
          entity_version = entity_version + 1,
          "updatedAt" = pg_catalog.now()
      where id = v_address_id;
    else
      select count(*) into v_active_count
      from public.customer_addresses a
      where a."customerId" = v_customer_id
        and a.tenant_id = v_tenant_id
        and a.company_id = v_company_id
        and a.branch_id = v_branch_id
        and a.accounting_period_id = v_accounting_period_id
        and a."isDeleted" = false;

      select count(*) into v_other_blank_count
      from public.customer_addresses a
      where a."customerId" = v_customer_id
        and a.tenant_id = v_tenant_id
        and a.company_id = v_company_id
        and a.branch_id = v_branch_id
        and a.accounting_period_id = v_accounting_period_id
        and a."isDeleted" = false
        and a.id <> v_address_id
        and coalesce(pg_catalog.btrim(a.normalized_title),'') = '';

      if v_active_count > 1 and (v_normalized_title is null or v_other_blank_count > 0) then
        raise exception using errcode = '23514', message = 'CUSTOMER_ADDRESS_TITLE_REQUIRED_FOR_MULTI_ACTIVE';
      end if;

      if not (p_address ? 'title') then
        v_title := v_existing.title;
        v_normalized_title := v_existing.normalized_title;
      end if;

      update public.customer_addresses
      set
        title = v_title,
        normalized_title = v_normalized_title,
        phone = case
          when p_address ? 'phone'
            then nullif(pg_catalog.btrim(coalesce(p_address->>'phone','')), '')
          else phone
        end,
        province = case
          when p_address ? 'province'
            then nullif(pg_catalog.btrim(coalesce(p_address->>'province','')), '')
          else province
        end,
        district = case
          when p_address ? 'district'
            then nullif(pg_catalog.btrim(coalesce(p_address->>'district','')), '')
          else district
        end,
        address = case
          when p_address ? 'address' then coalesce(p_address->>'address','')
          else address
        end,
        "mapLocation" = case
          when p_address ? 'mapLocation'
            then nullif(pg_catalog.btrim(coalesce(p_address->>'mapLocation','')), '')
          else "mapLocation"
        end,
        latitude = case
          when p_address ? 'latitude' then nullif(p_address->>'latitude','')::numeric
          else latitude
        end,
        longitude = case
          when p_address ? 'longitude' then nullif(p_address->>'longitude','')::numeric
          else longitude
        end,
        "legacyPrimary" = case
          when p_address ? 'legacyPrimary'
            then coalesce((p_address->>'legacyPrimary')::boolean, false)
          else "legacyPrimary"
        end,
        entity_version = entity_version + 1,
        "updatedAt" = pg_catalog.now()
      where id = v_address_id;
    end if;
  end if;

  select pg_catalog.to_jsonb(a) into v_result
  from public.customer_addresses a
  where a.id = v_address_id
    and a.tenant_id = v_tenant_id
    and a.company_id = v_company_id
    and a.branch_id = v_branch_id
    and a.accounting_period_id = v_accounting_period_id;

  if v_result is null then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_ADDRESS_CANONICAL_READBACK_FAILED';
  end if;

  v_result := v_result || pg_catalog.jsonb_build_object(
    'outcome',
    case when v_operation = 'INSERT' then 'CREATED' else 'UPDATED' end,
    'entityVersion',
    (v_result->>'entity_version')::bigint
  );

  insert into public.customer_address_audits (
    audit_id, change_id, tenant_id, company_id, branch_id, accounting_period_id,
    address_id, customer_id, operation, actor_user_id,
    before_json, after_json, expected_version, resulting_version
  ) values (
    v_change_id || ':audit',
    v_change_id,
    v_tenant_id,
    v_company_id,
    v_branch_id,
    v_accounting_period_id,
    v_address_id,
    v_customer_id,
    v_operation,
    v_actor_user_id,
    v_before,
    v_result,
    v_expected_version,
    (v_result->>'entity_version')::bigint
  );

  update public.customer_address_command_receipts
  set outcome = 'COMPLETED',
      resulting_version = (v_result->>'entity_version')::bigint,
      result_json = v_result,
      completed_at = pg_catalog.now()
  where change_id = v_change_id;

  return v_result;
end
$$;

revoke all on function public.persist_customer_address_authority_v1(text,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.persist_customer_address_authority_v1(text,jsonb,jsonb)
  to service_role;

revoke insert, update, delete on table public.customer_addresses from service_role;
grant select on table public.customer_addresses to service_role;

-- Staged migration:
-- room/measurement customerAddressId stays nullable for legacy rows.
-- No automatic text/location/title matching backfill.
-- persist_measurement_authority_v1 stays the only measurement writer.

commit;
