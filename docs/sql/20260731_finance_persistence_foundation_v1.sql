-- ============================================================
-- ENVERP FINANCE PERSISTENCE FOUNDATION V1
-- DURUM: TASLAK
-- CANLI SUPABASE'E UYGULANMAYACAKTIR.
--
-- Amaç:
-- - local-first merkezi finans hareketlerinin Supabase kalıcılık
--   tabanını tanımlamak,
-- - tenant/company/branch/accounting period izolasyonunu zorunlu
--   kılmak,
-- - idempotency ve audit bütünlüğünü veritabanında korumak,
-- - fiziksel silmeyi uygulama rollerine kapatmak.
--
-- Bu dosya yalnız şema sözleşmesidir.
-- Canlı uygulama ayrı onay, yedek ve Supabase SQL doğrulaması ister.
-- ============================================================

begin;

create table if not exists public.finance_transactions (
  id text not null,
  transaction_id text not null,
  idempotency_key text not null,

  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,

  transaction_type text not null,
  direction text not null,
  payment_method text null,

  finance_account_id text null,
  counter_account_id text null,

  customer_id text not null,
  sale_id text not null,

  source_document_id text not null,
  source_document_type text not null,

  gross_amount numeric(18, 2) not null,
  commission_amount numeric(18, 2) not null default 0,
  net_amount numeric(18, 2) not null,

  currency text not null,

  transaction_date date not null,
  value_date date null,
  due_date date null,

  status text not null,

  description text null,
  external_reference text null,
  reversal_of_transaction_id text null,

  created_by text not null,
  created_at timestamptz not null,
  posted_at timestamptz null,
  reversed_at timestamptz null,
  archived_at timestamptz null,

  projection_source text not null,

  constraint finance_transactions_pk
    primary key (
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      id
    ),

  constraint finance_transactions_transaction_id_uq
    unique (
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      transaction_id
    ),

  constraint finance_transactions_idempotency_uq
    unique (
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      idempotency_key
    ),

  constraint finance_transactions_source_document_uq
    unique (
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      transaction_type,
      source_document_type,
      source_document_id
    ),

  constraint finance_transactions_scope_not_blank_ck
    check (
      btrim(tenant_id) <> '' and
      btrim(company_id) <> '' and
      btrim(branch_id) <> '' and
      btrim(accounting_period_id) <> ''
    ),

  constraint finance_transactions_ids_not_blank_ck
    check (
      btrim(id) <> '' and
      btrim(transaction_id) <> '' and
      btrim(idempotency_key) <> '' and
      btrim(customer_id) <> '' and
      btrim(sale_id) <> '' and
      btrim(source_document_id) <> '' and
      btrim(created_by) <> ''
    ),

  constraint finance_transactions_amounts_ck
    check (
      gross_amount > 0 and
      commission_amount >= 0 and
      net_amount > 0 and
      net_amount <= gross_amount
    ),

  constraint finance_transactions_currency_ck
    check (
      currency ~ '^[A-Z]{3}$'
    ),

  constraint finance_transactions_direction_ck
    check (
      direction in ('DEBIT', 'CREDIT')
    ),

  constraint finance_transactions_type_ck
    check (
      transaction_type in (
        'SALE_CHARGE',
        'COLLECTION',
        'PAYMENT',
        'TRANSFER',
        'REVERSAL',
        'REFUND',
        'ADJUSTMENT'
      )
    ),

  constraint finance_transactions_status_ck
    check (
      status in (
        'DRAFT',
        'PENDING',
        'POSTED',
        'SETTLED',
        'FAILED',
        'CANCELLED',
        'REVERSED'
      )
    ),

  constraint finance_transactions_payment_method_ck
    check (
      payment_method is null or
      payment_method in (
        'GENERIC',
        'CASH',
        'CREDIT_CARD',
        'EFT',
        'BANK_TRANSFER',
        'CHEQUE',
        'PROMISSORY_NOTE',
        'OTHER'
      )
    ),

  constraint finance_transactions_source_type_ck
    check (
      source_document_type in (
        'SALE',
        'SALE_PAYMENT',
        'SALE_RETURN',
        'LEGACY_DOWN_PAYMENT',
        'EXPENSE',
        'CHEQUE',
        'NOTE',
        'POS_SETTLEMENT',
        'OPENING_BALANCE',
        'MANUAL'
      )
    ),

  constraint finance_transactions_projection_source_ck
    check (
      projection_source in (
        'SALE_CHARGE',
        'SALE_PAYMENT',
        'SALE_RETURN',
        'LEGACY_DOWN_PAYMENT'
      )
    ),

  constraint finance_transactions_posted_time_ck
    check (
      status <> 'POSTED' or
      posted_at is not null
    ),

  constraint finance_transactions_reversal_fields_ck
    check (
      (
        transaction_type = 'REVERSAL' and
        reversal_of_transaction_id is not null
      ) or
      (
        transaction_type <> 'REVERSAL'
      )
    )
);

create index if not exists
  finance_transactions_scope_customer_idx
on public.finance_transactions (
  tenant_id,
  company_id,
  branch_id,
  accounting_period_id,
  customer_id,
  transaction_date,
  created_at
);

create index if not exists
  finance_transactions_scope_sale_idx
on public.finance_transactions (
  tenant_id,
  company_id,
  branch_id,
  accounting_period_id,
  sale_id,
  transaction_date,
  created_at
);

create index if not exists
  finance_transactions_scope_status_idx
on public.finance_transactions (
  tenant_id,
  company_id,
  branch_id,
  accounting_period_id,
  status
);

create table if not exists public.finance_transaction_audits (
  id text not null,
  transaction_id text not null,
  idempotency_key text not null,

  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,

  action text not null,
  actor_user_id text not null,
  customer_id text not null,
  sale_id text not null,
  occurred_at timestamptz not null,

  payload_hash text not null,

  constraint finance_transaction_audits_pk
    primary key (
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      id
    ),

  constraint finance_transaction_audits_event_uq
    unique (
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      transaction_id,
      action
    ),

  constraint finance_transaction_audits_transaction_fk
    foreign key (
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      transaction_id
    )
    references public.finance_transactions (
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      transaction_id
    )
    on update restrict
    on delete restrict,

  constraint finance_transaction_audits_scope_not_blank_ck
    check (
      btrim(tenant_id) <> '' and
      btrim(company_id) <> '' and
      btrim(branch_id) <> '' and
      btrim(accounting_period_id) <> ''
    ),

  constraint finance_transaction_audits_ids_not_blank_ck
    check (
      btrim(id) <> '' and
      btrim(transaction_id) <> '' and
      btrim(idempotency_key) <> '' and
      btrim(actor_user_id) <> '' and
      btrim(customer_id) <> '' and
      btrim(sale_id) <> '' and
      btrim(payload_hash) <> ''
    ),

  constraint finance_transaction_audits_action_ck
    check (
      action in (
        'POSTED',
        'REVERSED',
        'ARCHIVED'
      )
    )
);

create index if not exists
  finance_transaction_audits_scope_transaction_idx
on public.finance_transaction_audits (
  tenant_id,
  company_id,
  branch_id,
  accounting_period_id,
  transaction_id,
  occurred_at
);

alter table public.finance_transactions
  enable row level security;

alter table public.finance_transaction_audits
  enable row level security;

alter table public.finance_transactions
  force row level security;

alter table public.finance_transaction_audits
  force row level security;

-- V1 güvenli varsayılan:
-- anon ve authenticated rolleri için doğrudan politika tanımlanmaz.
-- Bu nedenle istemci tarafı doğrudan erişim kapalıdır.
-- Yazma/okuma yalnız server-side doğrulanmış ERP scope üzerinden,
-- ayrı RPC veya service-role API katmanı kurulduktan sonra açılacaktır.

revoke all
on table public.finance_transactions
from anon, authenticated;

revoke all
on table public.finance_transaction_audits
from anon, authenticated;

grant select, insert, update
on table public.finance_transactions
to service_role;

grant select, insert
on table public.finance_transaction_audits
to service_role;

-- Finans hareketlerinde fiziksel silme yetkisi hiçbir uygulama rolüne verilmez.
revoke delete
on table public.finance_transactions
from anon, authenticated, service_role;

revoke delete
on table public.finance_transaction_audits
from anon, authenticated, service_role;

commit;