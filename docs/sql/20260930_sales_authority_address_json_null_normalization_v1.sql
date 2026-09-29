-- ENVERP
-- Sales Authority Address JSON Null Normalization V1
--
-- Purpose:
-- Explicit JSON null for customerAddressSnapshot must be normalized
-- to SQL NULL before the existing address-pair integrity check.
--
-- Scope:
-- public.persist_sale_document_authority_v1 only.
--
-- No change to:
-- - address pair integrity
-- - customer address ownership validation
-- - ERP scope isolation
-- - actor identity
-- - payload hash
-- - draft status rules
-- - approval authority
-- - sale return authority

create or replace function public.persist_sale_document_authority_v1(
  p_sale jsonb,
  p_actor_user_id text,
  p_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_tenant text := btrim(coalesce(p_sale->>'tenantId',''));
  v_company text := btrim(coalesce(p_sale->>'companyId',''));
  v_branch text := btrim(coalesce(p_sale->>'branchId',''));
  v_period text := btrim(coalesce(p_sale->>'accountingPeriodId',''));
  v_sale_id text := btrim(coalesce(p_sale->>'saleId',''));
  v_customer_id text := btrim(coalesce(p_sale->>'customerId',''));
  v_customer_address_id text := nullif(btrim(coalesce(p_sale->>'customerAddressId','')),'');
  v_customer_address_snapshot jsonb :=
    case
      when p_sale->'customerAddressSnapshot' is null
        or p_sale->'customerAddressSnapshot' = 'null'::jsonb
      then null
      else p_sale->'customerAddressSnapshot'
    end;
  v_sale_number text := nullif(btrim(coalesce(p_sale->>'saleNumber','')),'');
  v_status text := btrim(coalesce(p_sale->>'status',''));
  v_currency text := upper(btrim(coalesce(p_sale->>'currency','TRY')));
  v_amount numeric := coalesce(nullif(p_sale->>'totalAmount','')::numeric,0);
  v_existing public.sale_documents_v1%rowtype;
  v_canonical_address public.customer_addresses%rowtype;
begin
  if v_tenant='' or v_company='' or v_branch='' or v_period='' then
    raise exception 'SALE_AUTHORITY_SCOPE_REQUIRED';
  end if;
  if v_sale_id='' or v_customer_id='' or btrim(coalesce(p_actor_user_id,''))='' then
    raise exception 'SALE_AUTHORITY_IDENTITY_REQUIRED';
  end if;
  if btrim(coalesce(p_payload_hash,''))='' then
    raise exception 'SALE_AUTHORITY_PAYLOAD_HASH_REQUIRED';
  end if;
  if v_status not in ('TASLAK','TEKLİF') then
    raise exception 'SALE_AUTHORITY_DRAFT_STATUS_REQUIRED';
  end if;
  if v_currency !~ '^[A-Z]{3}$' or v_amount < 0 then
    raise exception 'SALE_AUTHORITY_AMOUNT_OR_CURRENCY_INVALID';
  end if;

  if (v_customer_address_id is null) <> (v_customer_address_snapshot is null) then
    raise exception 'SALE_AUTHORITY_ADDRESS_PAIR_REQUIRED';
  end if;

  if v_customer_address_id is not null then
    if pg_catalog.jsonb_typeof(v_customer_address_snapshot) is distinct from 'object'
       or btrim(coalesce(v_customer_address_snapshot->>'customerAddressId','')) <> v_customer_address_id then
      raise exception 'SALE_AUTHORITY_ADDRESS_SNAPSHOT_INVALID';
    end if;

    select * into v_canonical_address
    from public.customer_addresses a
    where a.id = v_customer_address_id
      and a."customerId" = v_customer_id
      and a.tenant_id::text = v_tenant
      and a.company_id::text = v_company
      and a.branch_id::text = v_branch
      and a.accounting_period_id::text = v_period
      and a."isDeleted" = false
    for update;

    if not found then
      raise exception 'SALE_AUTHORITY_CUSTOMER_ADDRESS_PARENT_MISMATCH';
    end if;

    v_customer_address_snapshot := pg_catalog.jsonb_build_object(
      'customerAddressId', v_canonical_address.id,
      'title', v_canonical_address.title,
      'phone', v_canonical_address.phone,
      'province', v_canonical_address.province,
      'district', v_canonical_address.district,
      'address', v_canonical_address.address,
      'mapLocation', v_canonical_address."mapLocation",
      'latitude', v_canonical_address.latitude,
      'longitude', v_canonical_address.longitude,
      'capturedAt', pg_catalog.now()
    );
  end if;

  select * into v_existing
  from public.sale_documents_v1 s
  where s.tenant_id=v_tenant and s.company_id=v_company
    and s.branch_id=v_branch and s.accounting_period_id=v_period
    and s.sale_id=v_sale_id
  for update;

  if found then
    if v_existing.created_by_user_id is distinct from btrim(p_actor_user_id)
       or v_existing.customer_id is distinct from v_customer_id
       or v_existing.customer_address_id is distinct from v_customer_address_id then
      raise exception 'SALE_AUTHORITY_IDENTITY_CONFLICT';
    end if;

    if v_existing.status not in ('TASLAK','TEKLİF') then
      raise exception 'SALE_AUTHORITY_APPROVED_IMMUTABLE';
    end if;

    update public.sale_documents_v1
    set sale_number=v_sale_number,
        status=v_status,
        total_amount=v_amount,
        currency=v_currency,
        payload_hash=p_payload_hash,
        source_version=v_existing.source_version+1,
        updated_at=now()
    where tenant_id=v_tenant and company_id=v_company
      and branch_id=v_branch and accounting_period_id=v_period
      and sale_id=v_sale_id;

    return jsonb_build_object(
      'outcome','UPDATED','saleId',v_sale_id,'createdByUserId',v_existing.created_by_user_id
    );
  end if;

  insert into public.sale_documents_v1 (
    tenant_id,company_id,branch_id,accounting_period_id,
    sale_id,customer_id,customer_address_id,customer_address_snapshot,
    sale_number,created_by_user_id,status,
    total_amount,currency,payload_hash,source_version
  ) values (
    v_tenant,v_company,v_branch,v_period,
    v_sale_id,v_customer_id,v_customer_address_id,v_customer_address_snapshot,
    v_sale_number,btrim(p_actor_user_id),v_status,
    v_amount,v_currency,p_payload_hash,1
  );

  return jsonb_build_object(
    'outcome','CREATED','saleId',v_sale_id,'createdByUserId',btrim(p_actor_user_id)
  );
end;
$function$;
