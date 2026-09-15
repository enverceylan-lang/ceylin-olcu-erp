-- ENVerp Measurement Package Authority V1
-- SOURCE MIGRATION ONLY. DO NOT EXECUTE LIVE WITHOUT SEPARATE LIVE SQL APPROVAL.
-- Customer/address/existing parent rows are verify-only.
-- Only INSERT may create missing Room/Opening. UPDATE/SOFT_DELETE never create parents.
-- Existing measurement persistence remains owned by persist_measurement_authority_v1.

begin;

create or replace function public.persist_measurement_package_authority_v1(
  p_command jsonb,
  p_context jsonb,
  p_parent_package jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_operation text;
  v_payload jsonb;
  v_customer_id text;
  v_room_id text;
  v_opening_id text;
  v_window_id text;
  v_tenant_id uuid;
  v_company_id uuid;
  v_branch_id uuid;
  v_accounting_period_id uuid;
  v_room_json jsonb;
  v_opening_json jsonb;
  v_room_name text;
  v_opening_name text;
  v_customer_address_id text;
  v_room public.rooms%rowtype;
  v_opening public.openings%rowtype;
  v_result jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'MEASUREMENT_PACKAGE_AUTHORITY_FORBIDDEN';
  end if;
  if p_command is null or pg_catalog.jsonb_typeof(p_command) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'MEASUREMENT_COMMAND_INVALID';
  end if;
  if p_context is null or pg_catalog.jsonb_typeof(p_context) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'MEASUREMENT_CONTEXT_INVALID';
  end if;
  if p_parent_package is null or pg_catalog.jsonb_typeof(p_parent_package) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'MEASUREMENT_PARENT_PACKAGE_INVALID';
  end if;

  v_operation := pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'operation','')));
  if v_operation not in ('INSERT','UPDATE','SOFT_DELETE') then
    raise exception using errcode = '22023', message = 'MEASUREMENT_OPERATION_UNSUPPORTED';
  end if;
  v_payload := coalesce(p_command->'payload','{}'::jsonb);
  if pg_catalog.jsonb_typeof(v_payload) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'MEASUREMENT_PAYLOAD_INVALID';
  end if;

  begin
    v_tenant_id := (p_context->>'tenantId')::uuid;
    v_company_id := (p_context->>'companyId')::uuid;
    v_branch_id := (p_context->>'branchId')::uuid;
    v_accounting_period_id := (p_context->>'accountingPeriodId')::uuid;
  exception when invalid_text_representation then
    raise exception using errcode = '22023', message = 'MEASUREMENT_SCOPE_INVALID';
  end;
  if v_tenant_id is null or v_company_id is null or v_branch_id is null or v_accounting_period_id is null then
    raise exception using errcode = '22023', message = 'MEASUREMENT_SCOPE_MISSING';
  end if;

  v_customer_id := pg_catalog.btrim(coalesce(v_payload->>'customerId',''));
  v_room_id := pg_catalog.btrim(coalesce(v_payload->>'roomId',''));
  v_opening_id := pg_catalog.btrim(coalesce(v_payload->>'openingId',''));
  v_window_id := pg_catalog.btrim(coalesce(v_payload->>'windowId',''));
  if v_opening_id = '' and v_window_id <> '' then v_opening_id := v_window_id; end if;
  if v_opening_id <> '' and v_window_id <> '' and v_opening_id <> v_window_id then
    raise exception using errcode = '22023', message = 'MEASUREMENT_OPENING_WINDOW_MISMATCH';
  end if;
  if v_customer_id = '' or v_room_id = '' or v_opening_id = '' then
    raise exception using errcode = '22023', message = 'MEASUREMENT_PARENT_ID_MISSING';
  end if;

  v_room_json := p_parent_package->'room';
  v_opening_json := p_parent_package->'opening';
  if v_room_json is null or pg_catalog.jsonb_typeof(v_room_json) is distinct from 'object'
     or v_opening_json is null or pg_catalog.jsonb_typeof(v_opening_json) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'MEASUREMENT_PARENT_PACKAGE_INVALID';
  end if;
  if pg_catalog.btrim(coalesce(v_room_json->>'id','')) <> v_room_id
     or pg_catalog.btrim(coalesce(v_opening_json->>'id','')) <> v_opening_id then
    raise exception using errcode = '22023', message = 'MEASUREMENT_PARENT_PACKAGE_ID_MISMATCH';
  end if;

  perform 1 from public.customers c
  where c.id = v_customer_id
    and c.tenant_id is not distinct from v_tenant_id
    and c.company_id is not distinct from v_company_id
    and c.branch_id is not distinct from v_branch_id
    and c.accounting_period_id is not distinct from v_accounting_period_id
    and (
      v_operation <> 'INSERT'
      or coalesce(c."isDeleted", false) = false
    );
  if not found then
    raise exception using errcode = '23503', message = 'MEASUREMENT_CUSTOMER_SCOPE_PARENT_MISMATCH';
  end if;

  select * into v_room from public.rooms r where r.id = v_room_id for update;
  if not found then
    if v_operation <> 'INSERT' then
      raise exception using errcode = '23503', message = 'MEASUREMENT_ROOM_SCOPE_PARENT_MISMATCH';
    end if;
    v_room_name := pg_catalog.btrim(coalesce(v_room_json->>'name',''));
    if v_room_name = '' then
      raise exception using errcode = '22023', message = 'MEASUREMENT_ROOM_NAME_MISSING';
    end if;
    v_customer_address_id := nullif(pg_catalog.btrim(coalesce(v_room_json->>'customerAddressId','')),'');
    if v_customer_address_id is not null then
      perform 1 from public.customer_addresses a
      where a.id = v_customer_address_id
        and a."customerId" = v_customer_id
        and a.tenant_id is not distinct from v_tenant_id
        and a.company_id is not distinct from v_company_id
        and a.branch_id is not distinct from v_branch_id
        and a.accounting_period_id is not distinct from v_accounting_period_id
        and a."isDeleted" = false;
      if not found then
        raise exception using errcode = '42501', message = 'MEASUREMENT_ROOM_ADDRESS_SCOPE_MISMATCH';
      end if;
    end if;
    insert into public.rooms (
      id,name,"customerId","customerAddressId",photos,videos,"createdAt","updatedAt",
      tenant_id,company_id,branch_id,accounting_period_id
    ) values (
      v_room_id,v_room_name,v_customer_id,v_customer_address_id,'{}'::text[],'{}'::text[],
      coalesce(nullif(pg_catalog.btrim(coalesce(v_room_json->>'createdAt','')),'')::timestamptz,pg_catalog.now()),
      coalesce(nullif(pg_catalog.btrim(coalesce(v_room_json->>'updatedAt','')),'')::timestamptz,pg_catalog.now()),
      v_tenant_id,v_company_id,v_branch_id,v_accounting_period_id
    ) on conflict (id) do nothing;
    select * into v_room from public.rooms r where r.id = v_room_id for update;
  end if;
  if not found
     or v_room."customerId" is distinct from v_customer_id
     or v_room.tenant_id is distinct from v_tenant_id
     or v_room.company_id is distinct from v_company_id
     or v_room.branch_id is distinct from v_branch_id
     or v_room.accounting_period_id is distinct from v_accounting_period_id then
    raise exception using errcode = '23503', message = 'MEASUREMENT_ROOM_SCOPE_PARENT_MISMATCH';
  end if;

  select * into v_opening from public.openings o where o.id = v_opening_id for update;
  if not found then
    if v_operation <> 'INSERT' then
      raise exception using errcode = '23503', message = 'MEASUREMENT_OPENING_SCOPE_PARENT_MISMATCH';
    end if;
    v_opening_name := pg_catalog.btrim(coalesce(v_opening_json->>'name',''));
    if v_opening_name = '' then
      raise exception using errcode = '22023', message = 'MEASUREMENT_OPENING_NAME_MISSING';
    end if;
    insert into public.openings (
      id,name,"roomId",width,height,"fieldNotes",photos,videos,"createdAt","updatedAt",
      tenant_id,company_id,branch_id,accounting_period_id
    ) values (
      v_opening_id,v_opening_name,v_room_id,
      nullif(pg_catalog.btrim(coalesce(v_opening_json->>'width','')),'')::double precision,
      nullif(pg_catalog.btrim(coalesce(v_opening_json->>'height','')),'')::double precision,
      coalesce(v_opening_json->>'fieldNotes',''),'{}'::text[],'{}'::text[],
      coalesce(nullif(pg_catalog.btrim(coalesce(v_opening_json->>'createdAt','')),'')::timestamptz,pg_catalog.now()),
      coalesce(nullif(pg_catalog.btrim(coalesce(v_opening_json->>'updatedAt','')),'')::timestamptz,pg_catalog.now()),
      v_tenant_id,v_company_id,v_branch_id,v_accounting_period_id
    ) on conflict (id) do nothing;
    select * into v_opening from public.openings o where o.id = v_opening_id for update;
  end if;
  if not found
     or v_opening."roomId" is distinct from v_room_id
     or v_opening.tenant_id is distinct from v_tenant_id
     or v_opening.company_id is distinct from v_company_id
     or v_opening.branch_id is distinct from v_branch_id
     or v_opening.accounting_period_id is distinct from v_accounting_period_id then
    raise exception using errcode = '23503', message = 'MEASUREMENT_OPENING_SCOPE_PARENT_MISMATCH';
  end if;

  v_result := public.persist_measurement_authority_v1(p_command,p_context);

  if pg_catalog.upper(pg_catalog.btrim(coalesce(v_result->>'outcome',''))) = 'REPLAY' then
    perform 1 from public.measurements m
    where m.id = pg_catalog.btrim(coalesce(p_command->>'entityId',''))
      and m."customerId" = v_customer_id
      and m."roomId" = v_room_id
      and m."openingId" = v_opening_id
      and m.tenant_id is not distinct from v_tenant_id
      and m.company_id is not distinct from v_company_id
      and m.branch_id is not distinct from v_branch_id
      and m.accounting_period_id is not distinct from v_accounting_period_id;
    if not found then
      raise exception using errcode = 'P0002', message = 'MEASUREMENT_REPLAY_CANONICAL_MISSING';
    end if;
  end if;

  return v_result;
end
$$;

revoke all on function public.persist_measurement_package_authority_v1(jsonb,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.persist_measurement_package_authority_v1(jsonb,jsonb,jsonb)
  to service_role;

commit;