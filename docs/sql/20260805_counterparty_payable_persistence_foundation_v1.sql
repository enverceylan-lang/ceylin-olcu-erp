-- ENVerp Counterparty Payable Persistence Foundation V1
-- Server truth for SUPPLIER / TAILOR / INSTALLER payable movements.
-- No physical DELETE. Reversal is a movement.

create table if not exists public.counterparty_payable_movements (
  movement_id text primary key,
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,

  idempotency_key text not null,
  counterparty_customer_id text not null,
  counterparty_type text not null,
  movement_kind text not null,

  amount numeric(18,2) not null,
  currency text not null default 'TRY',

  occurred_at timestamptz not null,
  recorded_at timestamptz not null,

  source_document_id text null,
  operation_id text null,
  provider_earnings_entry_id text null,
  source_payment_id text null,
  reversal_of_movement_id text null,
  note text null,

  created_by_user_id text not null,
  created_at timestamptz not null default now(),

  constraint counterparty_payable_scope_required_chk
    check (
      length(trim(tenant_id)) > 0 and
      length(trim(company_id)) > 0 and
      length(trim(branch_id)) > 0 and
      length(trim(accounting_period_id)) > 0
    ),

  constraint counterparty_payable_counterparty_type_chk
    check (
      counterparty_type in ('SUPPLIER','TAILOR','INSTALLER')
    ),

  constraint counterparty_payable_kind_chk
    check (
      movement_kind in ('ACCRUAL','PAYMENT','REVERSAL')
    ),

  constraint counterparty_payable_amount_positive_chk
    check (amount > 0),

  constraint counterparty_payable_currency_chk
    check (currency = 'TRY'),

  constraint counterparty_payable_reversal_shape_chk
    check (
      (movement_kind = 'REVERSAL' and reversal_of_movement_id is not null)
      or
      (movement_kind <> 'REVERSAL' and reversal_of_movement_id is null)
    ),

  constraint counterparty_payable_reversal_fk
    foreign key (reversal_of_movement_id)
    references public.counterparty_payable_movements(movement_id)
    deferrable initially immediate,

  constraint counterparty_payable_scope_idempotency_uq
    unique (
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      idempotency_key
    )
);

create index if not exists counterparty_payable_scope_counterparty_idx
  on public.counterparty_payable_movements (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    counterparty_customer_id,
    occurred_at
  );

create index if not exists counterparty_payable_source_document_idx
  on public.counterparty_payable_movements (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    source_document_id
  );

create table if not exists public.counterparty_payable_audits (
  audit_id bigint generated always as identity primary key,
  movement_id text not null,
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,

  actor_user_id text not null,
  action text not null,
  occurred_at timestamptz not null,
  payload jsonb not null,

  created_at timestamptz not null default now(),

  constraint counterparty_payable_audit_action_chk
    check (action in ('CREATE','REPLAY','CONFLICT')),

  constraint counterparty_payable_audit_movement_fk
    foreign key (movement_id)
    references public.counterparty_payable_movements(movement_id)
);

alter table public.counterparty_payable_movements
  enable row level security;

alter table public.counterparty_payable_audits
  enable row level security;

-- Direct client table mutation is intentionally denied.
revoke insert, update, delete
  on public.counterparty_payable_movements
  from anon, authenticated;

revoke insert, update, delete
  on public.counterparty_payable_audits
  from anon, authenticated;

revoke delete
  on public.counterparty_payable_movements
  from public;

revoke delete
  on public.counterparty_payable_audits
  from public;