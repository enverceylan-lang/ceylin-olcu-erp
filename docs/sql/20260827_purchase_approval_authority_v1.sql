-- ENVerp Purchase Draft + Approval Authority V1.1
-- SOURCE ONLY. This candidate does not execute live SQL.
-- Financial approval reads a server-persisted DRAFT under row lock.
-- Approval + supplier payable + Purchase Price 1 authority are atomic.

create extension if not exists pgcrypto;

create table if not exists public.purchase_documents_authority_v1 (
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  purchase_document_id text not null,
  document_no text not null,
  supplier_id text not null,
  supplier_name text null,
  document_date timestamptz not null,
  due_date timestamptz null,
  currency text not null
    check (currency = 'TRY'),
  status text not null
    check (status in ('DRAFT','APPROVED')),
  subtotal numeric(18,2) not null,
  discount_total numeric(18,2) not null,
  net_total numeric(18,2) not null,
  tax_total numeric(18,2) not null,
  grand_total numeric(18,2) not null
    check (grand_total > 0),
  line_snapshot jsonb not null,
  price1_updates jsonb not null
    default '[]'::jsonb,
  notes text null,
  draft_payload_hash text not null,
  created_by_user_id text not null,
  created_at timestamptz not null,
  updated_by_user_id text not null,
  updated_at timestamptz not null,
  approval_idempotency_key text null,
  approved_by_user_id text null,
  approved_at timestamptz null,
  payable_movement_id text null,
  primary key (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    purchase_document_id
  ),
  unique (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    document_no,
    supplier_id
  )
);

create table if not exists public.purchase_document_authority_audits_v1 (
  audit_id uuid primary key
    default gen_random_uuid(),
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  purchase_document_id text not null,
  action text not null
    check (
      action in (
        'DRAFT_CREATE',
        'DRAFT_UPDATE',
        'DRAFT_REPLAY',
        'APPROVE',
        'APPROVE_REPLAY'
      )
    ),
  actor_user_id text not null,
  payload_hash text not null,
  occurred_at timestamptz not null
    default now()
);

create table if not exists public.stock_purchase_price1_v1 (
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  stock_item_id text not null,
  purchase_price1 numeric(18,2) not null
    check (purchase_price1 >= 0),
  source_purchase_document_id text not null,
  source_purchase_document_line_id text not null,
  updated_by_user_id text not null,
  updated_at timestamptz not null,
  primary key (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    stock_item_id
  )
);

create table if not exists public.stock_purchase_price1_audits_v1 (
  audit_id uuid primary key
    default gen_random_uuid(),
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  stock_item_id text not null,
  purchase_price1 numeric(18,2) not null,
  source_purchase_document_id text not null,
  source_purchase_document_line_id text not null,
  actor_user_id text not null,
  occurred_at timestamptz not null
    default now()
);

alter table public.purchase_documents_authority_v1
  enable row level security;
alter table public.purchase_documents_authority_v1
  force row level security;
alter table public.purchase_document_authority_audits_v1
  enable row level security;
alter table public.purchase_document_authority_audits_v1
  force row level security;
alter table public.stock_purchase_price1_v1
  enable row level security;
alter table public.stock_purchase_price1_v1
  force row level security;
alter table public.stock_purchase_price1_audits_v1
  enable row level security;
alter table public.stock_purchase_price1_audits_v1
  force row level security;

revoke insert, update, delete
  on public.purchase_documents_authority_v1
  from anon, authenticated;
revoke insert, update, delete
  on public.purchase_document_authority_audits_v1
  from anon, authenticated;
revoke insert, update, delete
  on public.stock_purchase_price1_v1
  from anon, authenticated;
revoke insert, update, delete
  on public.stock_purchase_price1_audits_v1
  from anon, authenticated;

revoke delete
  on public.purchase_documents_authority_v1
  from public;
revoke delete
  on public.purchase_document_authority_audits_v1
  from public;
revoke delete
  on public.stock_purchase_price1_v1
  from public;
revoke delete
  on public.stock_purchase_price1_audits_v1
  from public;

create or replace function public.persist_purchase_document_draft_v1(
  p_draft jsonb,
  p_actor_user_id text,
  p_payload_hash text
)
returns table (
  outcome text,
  purchase_document_id text,
  payload_hash text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_tenant_id text :=
    nullif(btrim(p_draft->>'tenantId'),'');
  v_company_id text :=
    nullif(btrim(p_draft->>'companyId'),'');
  v_branch_id text :=
    nullif(btrim(p_draft->>'branchId'),'');
  v_accounting_period_id text :=
    nullif(btrim(p_draft->>'accountingPeriodId'),'');
  v_purchase_document_id text :=
    nullif(btrim(p_draft->>'purchaseDocumentId'),'');
  v_actor text :=
    nullif(btrim(p_actor_user_id),'');
  v_hash text :=
    nullif(btrim(p_payload_hash),'');
  v_now timestamptz := now();
  v_existing public.purchase_documents_authority_v1%rowtype;
  v_outcome text;
begin
  if
    v_tenant_id is null or
    v_company_id is null or
    v_branch_id is null or
    v_accounting_period_id is null or
    v_purchase_document_id is null or
    v_actor is null or
    v_hash is null or
    length(v_hash) <> 64 or
    nullif(btrim(p_draft->>'documentNo'),'') is null or
    nullif(btrim(p_draft->>'supplierId'),'') is null or
    nullif(btrim(p_draft->>'currency'),'') <> 'TRY' or
    nullif(btrim(p_draft->>'status'),'') <> 'DRAFT' or
    nullif(p_draft->>'grandTotal','')::numeric(18,2) <= 0 or
    jsonb_typeof(p_draft->'lines') <> 'array' or
    jsonb_array_length(p_draft->'lines') = 0
  then
    raise exception
      'PURCHASE_DRAFT_INVALID_REQUEST';
  end if;

  select *
    into v_existing
    from public.purchase_documents_authority_v1
   where tenant_id = v_tenant_id
     and company_id = v_company_id
     and branch_id = v_branch_id
     and accounting_period_id = v_accounting_period_id
     and purchase_document_id = v_purchase_document_id
   for update;

  if found and v_existing.status = 'APPROVED' then
    raise exception
      'PURCHASE_DRAFT_ALREADY_APPROVED';
  end if;

  if found and v_existing.draft_payload_hash = v_hash then
    insert into public.purchase_document_authority_audits_v1 (
      tenant_id, company_id, branch_id, accounting_period_id,
      purchase_document_id, action, actor_user_id, payload_hash, occurred_at
    ) values (
      v_tenant_id, v_company_id, v_branch_id, v_accounting_period_id,
      v_purchase_document_id, 'DRAFT_REPLAY', v_actor, v_hash, v_now
    );

    return query
      select
        'REPLAY'::text,
        v_purchase_document_id,
        v_hash,
        v_existing.updated_at;
    return;
  end if;

  if found then
    update public.purchase_documents_authority_v1
       set document_no = p_draft->>'documentNo',
           supplier_id = p_draft->>'supplierId',
           supplier_name = nullif(btrim(p_draft->>'supplierName'),''),
           document_date = (p_draft->>'documentDate')::timestamptz,
           due_date = nullif(p_draft->>'dueDate','')::timestamptz,
           subtotal = (p_draft->>'subtotal')::numeric(18,2),
           discount_total = (p_draft->>'discountTotal')::numeric(18,2),
           net_total = (p_draft->>'netTotal')::numeric(18,2),
           tax_total = (p_draft->>'taxTotal')::numeric(18,2),
           grand_total = (p_draft->>'grandTotal')::numeric(18,2),
           line_snapshot = p_draft->'lines',
           price1_updates = coalesce(p_draft->'price1Updates','[]'::jsonb),
           notes = nullif(p_draft->>'notes',''),
           draft_payload_hash = v_hash,
           updated_by_user_id = v_actor,
           updated_at = v_now
     where tenant_id = v_tenant_id
       and company_id = v_company_id
       and branch_id = v_branch_id
       and accounting_period_id = v_accounting_period_id
       and purchase_document_id = v_purchase_document_id;

    v_outcome := 'UPDATED';
  else
    insert into public.purchase_documents_authority_v1 (
      tenant_id, company_id, branch_id, accounting_period_id,
      purchase_document_id, document_no, supplier_id, supplier_name,
      document_date, due_date, currency, status,
      subtotal, discount_total, net_total, tax_total, grand_total,
      line_snapshot, price1_updates, notes, draft_payload_hash,
      created_by_user_id, created_at, updated_by_user_id, updated_at
    ) values (
      v_tenant_id, v_company_id, v_branch_id, v_accounting_period_id,
      v_purchase_document_id, p_draft->>'documentNo', p_draft->>'supplierId',
      nullif(btrim(p_draft->>'supplierName'),''),
      (p_draft->>'documentDate')::timestamptz,
      nullif(p_draft->>'dueDate','')::timestamptz,
      'TRY', 'DRAFT',
      (p_draft->>'subtotal')::numeric(18,2),
      (p_draft->>'discountTotal')::numeric(18,2),
      (p_draft->>'netTotal')::numeric(18,2),
      (p_draft->>'taxTotal')::numeric(18,2),
      (p_draft->>'grandTotal')::numeric(18,2),
      p_draft->'lines',
      coalesce(p_draft->'price1Updates','[]'::jsonb),
      nullif(p_draft->>'notes',''),
      v_hash, v_actor, v_now, v_actor, v_now
    );

    v_outcome := 'CREATED';
  end if;

  insert into public.purchase_document_authority_audits_v1 (
    tenant_id, company_id, branch_id, accounting_period_id,
    purchase_document_id, action, actor_user_id, payload_hash, occurred_at
  ) values (
    v_tenant_id, v_company_id, v_branch_id, v_accounting_period_id,
    v_purchase_document_id,
    case when v_outcome = 'CREATED' then 'DRAFT_CREATE' else 'DRAFT_UPDATE' end,
    v_actor, v_hash, v_now
  );

  return query
    select
      v_outcome,
      v_purchase_document_id,
      v_hash,
      v_now;
end;
$$;

create or replace function public.approve_purchase_document_authority_v1(
  p_scope jsonb,
  p_purchase_document_id text,
  p_approval_idempotency_key text,
  p_expected_draft_payload_hash text,
  p_actor_user_id text
)
returns table (
  outcome text,
  purchase_document_id text,
  payable_movement_id text,
  price1_updates jsonb,
  approved_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_tenant_id text :=
    nullif(btrim(p_scope->>'tenantId'),'');
  v_company_id text :=
    nullif(btrim(p_scope->>'companyId'),'');
  v_branch_id text :=
    nullif(btrim(p_scope->>'branchId'),'');
  v_accounting_period_id text :=
    nullif(btrim(p_scope->>'accountingPeriodId'),'');
  v_purchase_document_id text :=
    nullif(btrim(p_purchase_document_id),'');
  v_approval_key text :=
    nullif(btrim(p_approval_idempotency_key),'');
  v_expected_hash text :=
    nullif(btrim(p_expected_draft_payload_hash),'');
  v_actor text :=
    nullif(btrim(p_actor_user_id),'');
  v_document public.purchase_documents_authority_v1%rowtype;
  v_payable_outcome text;
  v_payable_movement_id text;
  v_payable_reason text;
  v_approved_at timestamptz := now();
  v_price jsonb;
begin
  if
    v_tenant_id is null or
    v_company_id is null or
    v_branch_id is null or
    v_accounting_period_id is null or
    v_purchase_document_id is null or
    v_approval_key is null or
    v_expected_hash is null or
    length(v_expected_hash) <> 64 or
    v_actor is null
  then
    raise exception
      'PURCHASE_APPROVAL_INVALID_REQUEST';
  end if;

  select *
    into v_document
    from public.purchase_documents_authority_v1
   where tenant_id = v_tenant_id
     and company_id = v_company_id
     and branch_id = v_branch_id
     and accounting_period_id = v_accounting_period_id
     and purchase_document_id = v_purchase_document_id
   for update;

  if not found then
    raise exception
      'PURCHASE_APPROVAL_SERVER_DRAFT_REQUIRED';
  end if;

  if v_document.status = 'APPROVED' then
    if
      v_document.approval_idempotency_key = v_approval_key and
      v_document.draft_payload_hash = v_expected_hash and
      v_document.payable_movement_id is not null
    then
      insert into public.purchase_document_authority_audits_v1 (
        tenant_id, company_id, branch_id, accounting_period_id,
        purchase_document_id, action, actor_user_id, payload_hash, occurred_at
      ) values (
        v_tenant_id, v_company_id, v_branch_id, v_accounting_period_id,
        v_purchase_document_id, 'APPROVE_REPLAY', v_actor, v_expected_hash, v_approved_at
      );

      return query
        select
          'REPLAY'::text,
          v_document.purchase_document_id,
          v_document.payable_movement_id,
          v_document.price1_updates,
          v_document.approved_at;
      return;
    end if;

    raise exception
      'PURCHASE_APPROVAL_CONFLICT';
  end if;

  if v_document.status <> 'DRAFT' then
    raise exception
      'PURCHASE_APPROVAL_DRAFT_REQUIRED';
  end if;

  if v_document.draft_payload_hash <> v_expected_hash then
    raise exception
      'PURCHASE_APPROVAL_STALE_DRAFT';
  end if;

  v_payable_movement_id :=
    'purchase-payable:' ||
    v_purchase_document_id;

  select
    p.outcome,
    p.movement_id,
    p.reason
  into
    v_payable_outcome,
    v_payable_movement_id,
    v_payable_reason
  from public.persist_counterparty_payable_movement_v1(
    jsonb_build_object(
      'movementId',
        v_payable_movement_id,
      'idempotencyKey',
        'PURCHASE_PAYABLE:' || v_purchase_document_id,
      'tenantId',
        v_tenant_id,
      'companyId',
        v_company_id,
      'branchId',
        v_branch_id,
      'accountingPeriodId',
        v_accounting_period_id,
      'counterpartyCustomerId',
        v_document.supplier_id,
      'counterpartyType',
        'SUPPLIER',
      'kind',
        'ACCRUAL',
      'amount',
        v_document.grand_total,
      'currency',
        'TRY',
      'occurredAt',
        v_approved_at,
      'recordedAt',
        v_approved_at,
      'sourceDocumentId',
        v_purchase_document_id,
      'note',
        'Approved purchase document'
    ),
    jsonb_build_object(
      'actorUserId',
        v_actor,
      'action',
        'PURCHASE_APPROVAL',
      'payloadHash',
        v_document.draft_payload_hash,
      'purchaseDocumentId',
        v_purchase_document_id
    )
  ) as p
  limit 1;

  if
    v_payable_outcome not in ('CREATED','REPLAY') or
    v_payable_movement_id is null
  then
    raise exception
      'PURCHASE_APPROVAL_PAYABLE_FAILED:%',
      coalesce(v_payable_reason,v_payable_outcome,'UNKNOWN');
  end if;

  for v_price in
    select value
      from jsonb_array_elements(
        coalesce(
          v_document.price1_updates,
          '[]'::jsonb
        )
      )
  loop
    insert into public.stock_purchase_price1_v1 (
      tenant_id, company_id, branch_id, accounting_period_id,
      stock_item_id, purchase_price1,
      source_purchase_document_id, source_purchase_document_line_id,
      updated_by_user_id, updated_at
    ) values (
      v_tenant_id, v_company_id, v_branch_id, v_accounting_period_id,
      btrim(v_price->>'stockItemId'),
      (v_price->>'purchasePrice1')::numeric(18,2),
      v_purchase_document_id,
      btrim(v_price->>'purchaseDocumentLineId'),
      v_actor, v_approved_at
    )
    on conflict (
      tenant_id, company_id, branch_id, accounting_period_id, stock_item_id
    )
    do update set
      purchase_price1 = excluded.purchase_price1,
      source_purchase_document_id = excluded.source_purchase_document_id,
      source_purchase_document_line_id = excluded.source_purchase_document_line_id,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = excluded.updated_at;

    insert into public.stock_purchase_price1_audits_v1 (
      tenant_id, company_id, branch_id, accounting_period_id,
      stock_item_id, purchase_price1,
      source_purchase_document_id, source_purchase_document_line_id,
      actor_user_id, occurred_at
    ) values (
      v_tenant_id, v_company_id, v_branch_id, v_accounting_period_id,
      btrim(v_price->>'stockItemId'),
      (v_price->>'purchasePrice1')::numeric(18,2),
      v_purchase_document_id,
      btrim(v_price->>'purchaseDocumentLineId'),
      v_actor, v_approved_at
    );
  end loop;

  update public.purchase_documents_authority_v1
     set status = 'APPROVED',
         approval_idempotency_key = v_approval_key,
         approved_by_user_id = v_actor,
         approved_at = v_approved_at,
         payable_movement_id = v_payable_movement_id,
         updated_by_user_id = v_actor,
         updated_at = v_approved_at
   where tenant_id = v_tenant_id
     and company_id = v_company_id
     and branch_id = v_branch_id
     and accounting_period_id = v_accounting_period_id
     and purchase_document_id = v_purchase_document_id;

  insert into public.purchase_document_authority_audits_v1 (
    tenant_id, company_id, branch_id, accounting_period_id,
    purchase_document_id, action, actor_user_id, payload_hash, occurred_at
  ) values (
    v_tenant_id, v_company_id, v_branch_id, v_accounting_period_id,
    v_purchase_document_id, 'APPROVE', v_actor, v_expected_hash, v_approved_at
  );

  return query
    select
      'CREATED'::text,
      v_purchase_document_id,
      v_payable_movement_id,
      v_document.price1_updates,
      v_approved_at;
end;
$$;

alter function public.persist_purchase_document_draft_v1(jsonb,text,text)
  owner to postgres;
alter function public.approve_purchase_document_authority_v1(jsonb,text,text,text,text)
  owner to postgres;

revoke all
  on function public.persist_purchase_document_draft_v1(jsonb,text,text)
  from public, anon, authenticated;
revoke all
  on function public.approve_purchase_document_authority_v1(jsonb,text,text,text,text)
  from public, anon, authenticated;

grant execute
  on function public.persist_purchase_document_draft_v1(jsonb,text,text)
  to service_role;
grant execute
  on function public.approve_purchase_document_authority_v1(jsonb,text,text,text,text)
  to service_role;
