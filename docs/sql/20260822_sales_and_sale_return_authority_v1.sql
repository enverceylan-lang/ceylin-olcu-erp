-- ENVerp Sales + Sale Return Server Authority V1
-- SOURCE ONLY. DO NOT APPLY TO LIVE DB WITHOUT SEPARATE EXPLICIT APPROVAL.
-- Purpose:
--   1) canonical server sale identity/creator/status authority
--   2) server-enforced ADMIN/delegated maker-checker approval
--   3) central sale-return lifecycle + idempotency + audit
-- Scope invariant:
--   tenant_id + company_id + branch_id + accounting_period_id
-- No physical delete.

begin;

create table if not exists public.sale_documents_v1 (
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  sale_id text not null,
  customer_id text not null,
  sale_number text null,
  created_by_user_id text not null,
  status text not null,
  total_amount numeric(18,2) not null default 0,
  currency text not null default 'TRY',
  payload_hash text not null,
  source_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_by_user_id text null,
  approved_at timestamptz null,

  primary key (
    tenant_id, company_id, branch_id, accounting_period_id, sale_id
  ),

  constraint sale_documents_v1_scope_ck check (
    btrim(tenant_id)<>'' and btrim(company_id)<>'' and
    btrim(branch_id)<>'' and btrim(accounting_period_id)<>''
  ),
  constraint sale_documents_v1_required_ck check (
    btrim(sale_id)<>'' and btrim(customer_id)<>'' and
    btrim(created_by_user_id)<>'' and btrim(payload_hash)<>''
  ),
  constraint sale_documents_v1_status_ck check (
    status in (
      'TASLAK','TEKLİF','ONAYLANDI','SİPARİŞ',
      'ÜRETİME_GÖNDERİLDİ','MONTAJA_GÖNDERİLDİ','TAMAMLANDI'
    )
  ),
  constraint sale_documents_v1_amount_ck check (total_amount >= 0),
  constraint sale_documents_v1_currency_ck check (currency ~ '^[A-Z]{3}$'),
  constraint sale_documents_v1_version_ck check (source_version > 0)
);

create index if not exists sale_documents_v1_customer_idx
on public.sale_documents_v1 (
  tenant_id,company_id,branch_id,accounting_period_id,customer_id,updated_at
);

alter table public.sale_documents_v1 enable row level security;
alter table public.sale_documents_v1 force row level security;
revoke all on table public.sale_documents_v1 from public,anon,authenticated;
grant select,insert,update on table public.sale_documents_v1 to service_role;
revoke delete on table public.sale_documents_v1 from public,anon,authenticated,service_role;

create table if not exists public.sale_returns_v1 (
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  sale_return_id text not null,
  sale_id text not null,
  customer_id text not null,
  created_by_user_id text not null,
  status text not null,
  amount numeric(18,2) not null,
  currency text not null,
  reason text null,
  idempotency_key text not null,
  payload_hash text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (
    tenant_id,company_id,branch_id,accounting_period_id,sale_return_id
  ),
  unique (
    tenant_id,company_id,branch_id,accounting_period_id,idempotency_key
  ),

  constraint sale_returns_v1_required_ck check (
    btrim(sale_return_id)<>'' and btrim(sale_id)<>'' and
    btrim(customer_id)<>'' and btrim(created_by_user_id)<>'' and
    btrim(idempotency_key)<>'' and btrim(payload_hash)<>''
  ),
  constraint sale_returns_v1_status_ck check (
    status in ('BAŞLATILDI','ONAYLANDI','TAMAMLANDI','REDDEDİLDİ')
  ),
  constraint sale_returns_v1_amount_ck check (amount > 0),
  constraint sale_returns_v1_currency_ck check (currency ~ '^[A-Z]{3}$')
);

create table if not exists public.sale_return_audits_v1 (
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  audit_id text not null,
  sale_return_id text not null,
  from_status text not null,
  to_status text not null,
  actor_user_id text not null,
  occurred_at timestamptz not null,
  reason text null,
  payload_hash text not null,
  primary key (
    tenant_id,company_id,branch_id,accounting_period_id,audit_id
  )
);

alter table public.sale_returns_v1 enable row level security;
alter table public.sale_returns_v1 force row level security;
alter table public.sale_return_audits_v1 enable row level security;
alter table public.sale_return_audits_v1 force row level security;

revoke all on table public.sale_returns_v1 from public,anon,authenticated;
revoke all on table public.sale_return_audits_v1 from public,anon,authenticated;
grant select,insert,update on table public.sale_returns_v1 to service_role;
grant select,insert on table public.sale_return_audits_v1 to service_role;
revoke delete on table public.sale_returns_v1 from public,anon,authenticated,service_role;
revoke delete on table public.sale_return_audits_v1 from public,anon,authenticated,service_role;

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
  v_sale_number text := nullif(btrim(coalesce(p_sale->>'saleNumber','')),'');
  v_status text := btrim(coalesce(p_sale->>'status',''));
  v_currency text := upper(btrim(coalesce(p_sale->>'currency','TRY')));
  v_amount numeric := coalesce(nullif(p_sale->>'totalAmount','')::numeric,0);
  v_existing public.sale_documents_v1%rowtype;
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

  select * into v_existing
  from public.sale_documents_v1 s
  where s.tenant_id=v_tenant and s.company_id=v_company
    and s.branch_id=v_branch and s.accounting_period_id=v_period
    and s.sale_id=v_sale_id
  for update;

  if found then
    if v_existing.created_by_user_id is distinct from btrim(p_actor_user_id)
       or v_existing.customer_id is distinct from v_customer_id then
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
    sale_id,customer_id,sale_number,created_by_user_id,status,
    total_amount,currency,payload_hash,source_version
  ) values (
    v_tenant,v_company,v_branch,v_period,
    v_sale_id,v_customer_id,v_sale_number,btrim(p_actor_user_id),v_status,
    v_amount,v_currency,p_payload_hash,1
  );

  return jsonb_build_object(
    'outcome','CREATED','saleId',v_sale_id,'createdByUserId',btrim(p_actor_user_id)
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

  update public.sale_documents_v1
  set status='ONAYLANDI',
      approved_by_user_id=v_actor,
      approved_at=now(),
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

create or replace function public.persist_sale_return_authority_v1(
  p_command jsonb,
  p_actor_user_id text,
  p_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_action text := upper(btrim(coalesce(p_command->>'action','')));
  v_tenant text := btrim(coalesce(p_command->>'tenantId',''));
  v_company text := btrim(coalesce(p_command->>'companyId',''));
  v_branch text := btrim(coalesce(p_command->>'branchId',''));
  v_period text := btrim(coalesce(p_command->>'accountingPeriodId',''));
  v_return_id text := btrim(coalesce(p_command->>'saleReturnId',''));
  v_sale_id text := btrim(coalesce(p_command->>'saleId',''));
  v_customer_id text := btrim(coalesce(p_command->>'customerId',''));
  v_idem text := btrim(coalesce(p_command->>'idempotencyKey',''));
  v_currency text := upper(btrim(coalesce(p_command->>'currency','TRY')));
  v_amount numeric := nullif(p_command->>'amount','')::numeric;
  v_occurred timestamptz := nullif(p_command->>'occurredAt','')::timestamptz;
  v_reason text := nullif(btrim(coalesce(p_command->>'reason','')),'');
  v_current public.sale_returns_v1%rowtype;
  v_sale public.sale_documents_v1%rowtype;
  v_next text;
  v_audit_id text;
begin
  if v_tenant='' or v_company='' or v_branch='' or v_period=''
     or v_return_id='' or v_sale_id='' or v_customer_id=''
     or v_idem='' or btrim(coalesce(p_actor_user_id,''))=''
     or btrim(coalesce(p_payload_hash,''))='' then
    raise exception 'SALE_RETURN_AUTHORITY_REQUIRED_FIELD_MISSING';
  end if;

  select * into v_sale
  from public.sale_documents_v1 s
  where s.tenant_id=v_tenant and s.company_id=v_company
    and s.branch_id=v_branch and s.accounting_period_id=v_period
    and s.sale_id=v_sale_id
    and s.customer_id=v_customer_id
  for update;

  if not found or v_sale.status not in (
    'ONAYLANDI','SİPARİŞ','ÜRETİME_GÖNDERİLDİ','MONTAJA_GÖNDERİLDİ','TAMAMLANDI'
  ) then
    raise exception 'SALE_RETURN_APPROVED_SALE_SOURCE_REQUIRED';
  end if;

  if v_action='START' then
    if v_amount is null or v_amount<=0 or v_currency !~ '^[A-Z]{3}$' or v_occurred is null then
      raise exception 'SALE_RETURN_AMOUNT_CURRENCY_DATE_INVALID';
    end if;

    select * into v_current
    from public.sale_returns_v1 r
    where r.tenant_id=v_tenant and r.company_id=v_company
      and r.branch_id=v_branch and r.accounting_period_id=v_period
      and r.idempotency_key=v_idem
    for update;

    if found then
      if v_current.sale_return_id=v_return_id
         and v_current.sale_id=v_sale_id
         and v_current.customer_id=v_customer_id
         and v_current.amount=v_amount
         and v_current.currency=v_currency
         and v_current.payload_hash=p_payload_hash then
        return jsonb_build_object('outcome','REPLAY','saleReturnId',v_return_id);
      end if;
      raise exception 'SALE_RETURN_IDEMPOTENCY_PAYLOAD_CONFLICT';
    end if;

    insert into public.sale_returns_v1 (
      tenant_id,company_id,branch_id,accounting_period_id,
      sale_return_id,sale_id,customer_id,created_by_user_id,
      status,amount,currency,reason,idempotency_key,payload_hash,occurred_at
    ) values (
      v_tenant,v_company,v_branch,v_period,
      v_return_id,v_sale_id,v_customer_id,btrim(p_actor_user_id),
      'BAŞLATILDI',v_amount,v_currency,v_reason,v_idem,p_payload_hash,v_occurred
    );

    return jsonb_build_object('outcome','CREATED','saleReturnId',v_return_id);
  end if;

  select * into v_current
  from public.sale_returns_v1 r
  where r.tenant_id=v_tenant and r.company_id=v_company
    and r.branch_id=v_branch and r.accounting_period_id=v_period
    and r.sale_return_id=v_return_id
  for update;

  if not found then
    raise exception 'SALE_RETURN_NOT_FOUND';
  end if;

  v_next := case v_action
    when 'APPROVE' then 'ONAYLANDI'
    when 'REJECT' then 'REDDEDİLDİ'
    when 'COMPLETE' then 'TAMAMLANDI'
    else null
  end;

  if v_next is null then
    raise exception 'SALE_RETURN_ACTION_INVALID';
  end if;

  if (v_current.status='BAŞLATILDI' and v_next in ('ONAYLANDI','REDDEDİLDİ'))
     or (v_current.status='ONAYLANDI' and v_next='TAMAMLANDI') then
    null;
  elsif v_current.status=v_next then
    return jsonb_build_object('outcome','REPLAY','saleReturnId',v_return_id,'status',v_next);
  else
    raise exception 'SALE_RETURN_STATUS_TRANSITION_INVALID';
  end if;

  v_audit_id := encode(
    digest(
      convert_to(
        v_tenant||'|'||v_company||'|'||v_branch||'|'||v_period||'|'||
        v_return_id||'|'||v_current.status||'|'||v_next||'|'||
        btrim(p_actor_user_id)||'|'||coalesce(p_command->>'occurredAt',''),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  update public.sale_returns_v1
  set status=v_next,
      updated_at=coalesce(v_occurred,now())
  where tenant_id=v_tenant and company_id=v_company
    and branch_id=v_branch and accounting_period_id=v_period
    and sale_return_id=v_return_id;

  insert into public.sale_return_audits_v1 (
    tenant_id,company_id,branch_id,accounting_period_id,
    audit_id,sale_return_id,from_status,to_status,
    actor_user_id,occurred_at,reason,payload_hash
  ) values (
    v_tenant,v_company,v_branch,v_period,
    v_audit_id,v_return_id,v_current.status,v_next,
    btrim(p_actor_user_id),coalesce(v_occurred,now()),v_reason,p_payload_hash
  )
  on conflict do nothing;

  return jsonb_build_object(
    'outcome','UPDATED','saleReturnId',v_return_id,'status',v_next
  );
end;
$function$;

revoke all on function public.persist_sale_document_authority_v1(jsonb,text,text)
from public,anon,authenticated;
revoke all on function public.approve_sale_document_authority_v1(jsonb,text,text,boolean)
from public,anon,authenticated;
revoke all on function public.persist_sale_return_authority_v1(jsonb,text,text)
from public,anon,authenticated;

grant execute on function public.persist_sale_document_authority_v1(jsonb,text,text)
to service_role;
grant execute on function public.approve_sale_document_authority_v1(jsonb,text,text,boolean)
to service_role;
grant execute on function public.persist_sale_return_authority_v1(jsonb,text,text)
to service_role;

commit;