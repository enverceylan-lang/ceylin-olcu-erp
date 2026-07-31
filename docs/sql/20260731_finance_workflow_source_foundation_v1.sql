-- ENVERP FINANCE WORKFLOW SOURCE FOUNDATION V1
-- DURUM: TASLAK. CANLI SUPABASE'E UYGULANMAYACAKTIR.
-- Amaç: satış onayı ve satış iadesi onayı finans yazımlarının
-- server-side kaynak doğrulama kayıtlarını scope izolasyonuyla tanımlamak.

begin;

create table if not exists public.finance_sale_workflow_sources (
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  sale_id text not null,
  customer_id text not null,
  status text not null,
  total_amount numeric(18, 2) not null,
  currency text not null,
  approved_by_user_id text not null,
  approved_at timestamptz not null,
  source_version bigint not null default 1,
  payload_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint finance_sale_workflow_sources_pk
    primary key (
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      sale_id
    ),

  constraint finance_sale_workflow_sources_scope_ck
    check (
      btrim(tenant_id) <> '' and
      btrim(company_id) <> '' and
      btrim(branch_id) <> '' and
      btrim(accounting_period_id) <> ''
    ),

  constraint finance_sale_workflow_sources_required_ck
    check (
      btrim(sale_id) <> '' and
      btrim(customer_id) <> '' and
      btrim(approved_by_user_id) <> '' and
      btrim(payload_hash) <> ''
    ),

  constraint finance_sale_workflow_sources_status_ck
    check (status = 'ONAYLANDI'),

  constraint finance_sale_workflow_sources_amount_ck
    check (total_amount > 0),

  constraint finance_sale_workflow_sources_currency_ck
    check (currency ~ '^[A-Z]{3}$'),

  constraint finance_sale_workflow_sources_version_ck
    check (source_version > 0)
);

create table if not exists public.finance_sale_return_workflow_sources (
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  sale_return_id text not null,
  sale_id text not null,
  customer_id text not null,
  status text not null,
  amount numeric(18, 2) not null,
  currency text not null,
  actor_user_id text not null,
  approved_at timestamptz not null,
  source_version bigint not null default 1,
  payload_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint finance_sale_return_workflow_sources_pk
    primary key (
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      sale_return_id
    ),

  constraint finance_sale_return_workflow_sources_scope_ck
    check (
      btrim(tenant_id) <> '' and
      btrim(company_id) <> '' and
      btrim(branch_id) <> '' and
      btrim(accounting_period_id) <> ''
    ),

  constraint finance_sale_return_workflow_sources_required_ck
    check (
      btrim(sale_return_id) <> '' and
      btrim(sale_id) <> '' and
      btrim(customer_id) <> '' and
      btrim(actor_user_id) <> '' and
      btrim(payload_hash) <> ''
    ),

  constraint finance_sale_return_workflow_sources_status_ck
    check (status = 'ONAYLANDI'),

  constraint finance_sale_return_workflow_sources_amount_ck
    check (amount > 0),

  constraint finance_sale_return_workflow_sources_currency_ck
    check (currency ~ '^[A-Z]{3}$'),

  constraint finance_sale_return_workflow_sources_version_ck
    check (source_version > 0)
);

create index if not exists finance_sale_workflow_sources_customer_idx
on public.finance_sale_workflow_sources (
  tenant_id,
  company_id,
  branch_id,
  accounting_period_id,
  customer_id,
  approved_at
);

create index if not exists finance_sale_return_workflow_sources_sale_idx
on public.finance_sale_return_workflow_sources (
  tenant_id,
  company_id,
  branch_id,
  accounting_period_id,
  sale_id,
  approved_at
);

alter table public.finance_sale_workflow_sources enable row level security;
alter table public.finance_sale_return_workflow_sources enable row level security;
alter table public.finance_sale_workflow_sources force row level security;
alter table public.finance_sale_return_workflow_sources force row level security;

revoke all on table public.finance_sale_workflow_sources
from anon, authenticated;

revoke all on table public.finance_sale_return_workflow_sources
from anon, authenticated;

grant select, insert, update
on table public.finance_sale_workflow_sources
to service_role;

grant select, insert, update
on table public.finance_sale_return_workflow_sources
to service_role;

revoke delete
on table public.finance_sale_workflow_sources
from anon, authenticated, service_role;

revoke delete
on table public.finance_sale_return_workflow_sources
from anon, authenticated, service_role;

commit;