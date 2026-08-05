-- ENVerp Package C3-B1
-- Authoritative server source truth required before counterparty payable
-- source-document authorization can be claimed as production-safe.
--
-- SOURCE ONLY. This file is NOT applied to live Supabase by this package.

create table if not exists public.counterparty_supplier_receipt_sources (
  source_id text primary key,

  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,

  supplier_customer_id text not null,
  supplier_order_id text not null,
  receipt_id text not null,
  source_document_id text not null,
  stock_item_id text not null,

  received_quantity numeric(18,6) not null,
  actual_purchase_unit_price numeric(18,6) not null,
  purchase_vat_rate numeric(5,2) not null,

  net_amount numeric(18,2) not null,
  payable_amount numeric(18,2) not null,

  currency text not null default 'TRY',

  received_at timestamptz not null,
  recorded_at timestamptz not null,

  recorded_by_user_id text not null,

  constraint counterparty_supplier_receipt_source_scope_ck
    check (
      length(trim(tenant_id)) > 0 and
      length(trim(company_id)) > 0 and
      length(trim(branch_id)) > 0 and
      length(trim(accounting_period_id)) > 0
    ),

  constraint counterparty_supplier_receipt_source_identity_ck
    check (
      length(trim(supplier_customer_id)) > 0 and
      length(trim(supplier_order_id)) > 0 and
      length(trim(receipt_id)) > 0 and
      length(trim(stock_item_id)) > 0
    ),

  constraint counterparty_supplier_receipt_source_quantity_ck
    check (received_quantity > 0),

  constraint counterparty_supplier_receipt_source_unit_price_ck
    check (actual_purchase_unit_price > 0),

  constraint counterparty_supplier_receipt_source_vat_ck
    check (
      purchase_vat_rate in (0, 1, 10, 20)
    ),

  constraint counterparty_supplier_receipt_source_net_amount_ck
    check (
      net_amount > 0 and
      net_amount =
        round(
          received_quantity *
          actual_purchase_unit_price,
          2
        )
    ),

  constraint counterparty_supplier_receipt_source_payable_amount_ck
    check (
      payable_amount > 0 and
      payable_amount =
        round(
          net_amount *
          (
            1 +
            purchase_vat_rate / 100
          ),
          2
        )
    ),

  constraint counterparty_supplier_receipt_source_currency_ck
    check (currency = 'TRY'),

  constraint counterparty_supplier_receipt_source_scope_receipt_uq
    unique (
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      receipt_id
    )
);

create index if not exists counterparty_supplier_receipt_source_supplier_idx
  on public.counterparty_supplier_receipt_sources (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    supplier_customer_id,
    received_at
  );

create index if not exists counterparty_supplier_receipt_source_order_idx
  on public.counterparty_supplier_receipt_sources (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    supplier_order_id
  );

alter table public.counterparty_supplier_receipt_sources
  enable row level security;

revoke insert, update, delete
  on public.counterparty_supplier_receipt_sources
  from anon, authenticated;

revoke delete
  on public.counterparty_supplier_receipt_sources
  from public;


create table if not exists public.counterparty_provider_earning_sources (
  source_id text primary key,

  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,

  provider_customer_id text not null,
  provider_type text not null,
  assignment_type text not null,
  operation_id text not null,
  earnings_entry_id text not null,
  source_document_id text,

  status text not null,

  finalized_amount numeric(18,2) not null,
  currency text not null default 'TRY',

  occurred_at timestamptz not null,
  finalized_at timestamptz not null,
  recorded_at timestamptz not null,

  finalized_by_user_id text not null,

  constraint counterparty_provider_earning_source_scope_ck
    check (
      length(trim(tenant_id)) > 0 and
      length(trim(company_id)) > 0 and
      length(trim(branch_id)) > 0 and
      length(trim(accounting_period_id)) > 0
    ),

  constraint counterparty_provider_earning_source_provider_ck
    check (
      length(trim(provider_customer_id)) > 0 and
      provider_type in ('TAILOR','INSTALLER')
    and assignment_type in ('EXTERNAL','INTERNAL')
    ),

  constraint counterparty_provider_earning_source_identity_ck
    check (
      length(trim(operation_id)) > 0 and
      length(trim(earnings_entry_id)) > 0
    ),

  constraint counterparty_provider_earning_source_status_ck
    check (
      status in ('FINALIZED','PARTIALLY_PAID','PAID')
    ),

  constraint counterparty_provider_earning_source_amount_ck
    check (finalized_amount > 0),

  constraint counterparty_provider_earning_source_currency_ck
    check (currency = 'TRY'),

  constraint counterparty_provider_earning_source_scope_entry_uq
    unique (
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      earnings_entry_id
    ),

  constraint counterparty_provider_earning_source_scope_operation_provider_uq
    unique (
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      operation_id,
      provider_customer_id,
      provider_type
    )
);

create index if not exists counterparty_provider_earning_source_provider_idx
  on public.counterparty_provider_earning_sources (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    provider_customer_id,
    finalized_at
  );

create index if not exists counterparty_provider_earning_source_operation_idx
  on public.counterparty_provider_earning_sources (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    operation_id
  );

alter table public.counterparty_provider_earning_sources
  enable row level security;

revoke insert, update, delete
  on public.counterparty_provider_earning_sources
  from anon, authenticated;

revoke delete
  on public.counterparty_provider_earning_sources
  from public;

-- No client/browser write policy is created here.
-- These source tables are intended to be written only through
-- later server-side controlled source persistence paths.
--
-- Supplier payable authorization must derive/verify:
--   counterparty = supplier_customer_id
--   sourceDocumentId = purchase-receipt:<receipt_id>
--   amount = payable_amount
--   occurredAt = received_at
--
-- Provider payable authorization must derive/verify:
--   counterparty = provider_customer_id
--   type = provider_type
--   operationId = operation_id
--   providerEarningsEntryId = earnings_entry_id
--   amount = finalized_amount
--   occurredAt = finalized_at
--
-- INTERNAL providers have no row in counterparty_provider_earning_sources.