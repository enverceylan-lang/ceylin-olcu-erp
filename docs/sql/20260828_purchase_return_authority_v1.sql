-- ENVerp Purchase Return Authority V1
-- SOURCE ONLY. Live apply requires separate explicit ONAY.
-- Purchase return is a new physical OUT event, not deletion/reversal
-- of a supplier receipt. Supplier payable correction is REVERSAL.
-- Entire return + stock OUT + payable REVERSAL is one transaction.

create extension if not exists pgcrypto;

create table if not exists public.purchase_returns_v1 (
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  purchase_return_id text not null,
  purchase_document_id text not null,
  idempotency_key text not null,
  supplier_id text not null,
  reason text not null,
  returned_at timestamptz not null,
  gross_amount numeric(18,2) not null
    check (gross_amount > 0),
  payable_reversal_movement_id text not null,
  payload_hash text not null,
  created_by_user_id text not null,
  created_at timestamptz not null default now(),
  primary key (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    purchase_return_id
  ),
  unique (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    idempotency_key
  )
);

create table if not exists public.purchase_return_lines_v1 (
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  purchase_return_line_id text not null,
  purchase_return_id text not null,
  purchase_document_id text not null,
  purchase_document_line_id text not null,
  line_kind text not null
    check (line_kind in ('GOODS','SERVICE')),
  stock_item_id text null,
  quantity numeric(18,6) not null
    check (quantity > 0),
  unit text not null,
  gross_amount numeric(18,2) not null
    check (gross_amount >= 0),
  created_at timestamptz not null default now(),
  primary key (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    purchase_return_line_id
  ),
  foreign key (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    purchase_return_id
  )
  references public.purchase_returns_v1 (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    purchase_return_id
  )
  on delete restrict
);

create index if not exists
purchase_return_lines_document_idx
on public.purchase_return_lines_v1 (
  tenant_id,
  company_id,
  branch_id,
  accounting_period_id,
  purchase_document_id,
  purchase_document_line_id
);

alter table public.purchase_returns_v1
  enable row level security;
alter table public.purchase_returns_v1
  force row level security;
alter table public.purchase_return_lines_v1
  enable row level security;
alter table public.purchase_return_lines_v1
  force row level security;

revoke all
  on public.purchase_returns_v1
  from public, anon, authenticated;
revoke all
  on public.purchase_return_lines_v1
  from public, anon, authenticated;

-- stock_movements_v1 V1 hard-wired source identity to supplier_receipts_v1.
-- Evolve it to an explicit polymorphic source with DB trigger enforcement.
do $stock_source_migration$
declare
  v_constraint record;
begin
  if to_regclass(
    'public.stock_movements_v1'
  ) is null then
    raise exception
      'PURCHASE_RETURN_STOCK_MOVEMENTS_MISSING';
  end if;

  for v_constraint in
    select
      c.conname,
      c.contype,
      pg_get_constraintdef(c.oid) as definition,
      c.confrelid
    from pg_constraint c
    where c.conrelid =
      'public.stock_movements_v1'::regclass
  loop
    if
      v_constraint.contype = 'c' and
      position(
        'source_type'
        in lower(
          v_constraint.definition
        )
      ) > 0
    then
      execute format(
        'alter table public.stock_movements_v1 drop constraint %I',
        v_constraint.conname
      );
    elsif
      v_constraint.contype = 'f' and
      v_constraint.confrelid =
        'public.supplier_receipts_v1'::regclass
    then
      execute format(
        'alter table public.stock_movements_v1 drop constraint %I',
        v_constraint.conname
      );
    end if;
  end loop;
end;
$stock_source_migration$;

alter table public.stock_movements_v1
  drop constraint if exists
    stock_movements_v1_source_type_v2_chk;

alter table public.stock_movements_v1
  add constraint
    stock_movements_v1_source_type_v2_chk
  check (
    source_type in (
      'SUPPLIER_RECEIPT',
      'PURCHASE_RETURN'
    )
  );

create or replace function
public.enforce_stock_movement_source_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.source_type =
    'SUPPLIER_RECEIPT'
  then
    if not exists (
      select 1
      from public.supplier_receipts_v1 r
      where r.tenant_id =
        new.tenant_id
        and r.company_id =
          new.company_id
        and r.branch_id =
          new.branch_id
        and r.accounting_period_id =
          new.accounting_period_id
        and r.receipt_id =
          new.source_id
    ) then
      raise exception
        'STOCK_MOVEMENT_SUPPLIER_RECEIPT_SOURCE_MISSING';
    end if;
  elsif new.source_type =
    'PURCHASE_RETURN'
  then
    if not exists (
      select 1
      from public.purchase_return_lines_v1 l
      where l.tenant_id =
        new.tenant_id
        and l.company_id =
          new.company_id
        and l.branch_id =
          new.branch_id
        and l.accounting_period_id =
          new.accounting_period_id
        and l.purchase_return_line_id =
          new.source_id
        and l.line_kind = 'GOODS'
        and l.stock_item_id =
          new.stock_item_id
    ) then
      raise exception
        'STOCK_MOVEMENT_PURCHASE_RETURN_SOURCE_MISSING';
    end if;
  else
    raise exception
      'STOCK_MOVEMENT_SOURCE_TYPE_INVALID';
  end if;

  return new;
end;
$$;

drop trigger if exists
  stock_movements_source_v2_trg
  on public.stock_movements_v1;

create trigger
  stock_movements_source_v2_trg
before insert or update
on public.stock_movements_v1
for each row execute function
  public.enforce_stock_movement_source_v2();

create table if not exists
public.purchase_return_audits_v1 (
  audit_id uuid primary key
    default gen_random_uuid(),
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  purchase_return_id text not null,
  purchase_document_id text not null,
  action text not null
    check (
      action in (
        'CREATE',
        'REPLAY'
      )
    ),
  actor_user_id text not null,
  payload_hash text not null,
  occurred_at timestamptz not null
    default now()
);

alter table public.purchase_return_audits_v1
  enable row level security;
alter table public.purchase_return_audits_v1
  force row level security;

revoke all
  on public.purchase_return_audits_v1
  from public, anon, authenticated;

create or replace function
public.persist_purchase_return_authority_v1(
  p_scope jsonb,
  p_purchase_return_id text,
  p_purchase_document_id text,
  p_idempotency_key text,
  p_returned_at text,
  p_reason text,
  p_lines jsonb,
  p_payload_hash text,
  p_actor_user_id text
)
returns table (
  outcome text,
  purchase_return_id text,
  purchase_document_id text,
  gross_amount numeric,
  payable_reversal_movement_id text,
  returned_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_tenant text :=
    nullif(
      btrim(
        p_scope->>'tenantId'
      ),
      ''
    );
  v_company text :=
    nullif(
      btrim(
        p_scope->>'companyId'
      ),
      ''
    );
  v_branch text :=
    nullif(
      btrim(
        p_scope->>'branchId'
      ),
      ''
    );
  v_period text :=
    nullif(
      btrim(
        p_scope->>'accountingPeriodId'
      ),
      ''
    );
  v_return_id text :=
    nullif(
      btrim(
        p_purchase_return_id
      ),
      ''
    );
  v_document_id text :=
    nullif(
      btrim(
        p_purchase_document_id
      ),
      ''
    );
  v_idempotency text :=
    nullif(
      btrim(
        p_idempotency_key
      ),
      ''
    );
  v_reason text :=
    nullif(
      btrim(
        p_reason
      ),
      ''
    );
  v_actor text :=
    nullif(
      btrim(
        p_actor_user_id
      ),
      ''
    );
  v_hash text :=
    nullif(
      btrim(
        p_payload_hash
      ),
      ''
    );
  v_returned_at timestamptz :=
    p_returned_at::timestamptz;

  v_document
    public.purchase_documents_authority_v1%rowtype;
  v_existing
    public.purchase_returns_v1%rowtype;

  v_line jsonb;
  v_source_line jsonb;
  v_line_id text;
  v_return_line_id text;
  v_kind text;
  v_stock_item_id text;
  v_unit text;
  v_quantity numeric(18,6);
  v_source_quantity numeric(18,6);
  v_prior_quantity numeric(18,6);
  v_next_quantity numeric(18,6);
  v_source_gross numeric(18,2);
  v_prior_gross numeric(18,2);
  v_next_gross numeric(18,2);
  v_line_gross numeric(18,2);
  v_total_gross numeric(18,2) := 0;
  v_available numeric(18,6);
  v_reversal_id text;
  v_payable_outcome text;
  v_payable_movement_id text;
  v_payable_reason text;
begin
  if
    v_tenant is null or
    v_company is null or
    v_branch is null or
    v_period is null or
    v_return_id is null or
    v_document_id is null or
    v_idempotency is null or
    v_reason is null or
    v_actor is null or
    v_hash is null or
    length(v_hash) <> 64 or
    jsonb_typeof(p_lines) <>
      'array' or
    jsonb_array_length(p_lines) = 0
  then
    raise exception
      'PURCHASE_RETURN_INVALID_REQUEST';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(
      p_lines
    ) x
  ) <> (
    select count(
      distinct
      nullif(
        btrim(
          x->>
          'purchaseDocumentLineId'
        ),
        ''
      )
    )
    from jsonb_array_elements(
      p_lines
    ) x
  ) then
    raise exception
      'PURCHASE_RETURN_DUPLICATE_LINE';
  end if;

  select *
  into v_existing
  from public.purchase_returns_v1 r
  where r.tenant_id = v_tenant
    and r.company_id = v_company
    and r.branch_id = v_branch
    and r.accounting_period_id =
      v_period
    and (
      r.purchase_return_id =
        v_return_id
      or r.idempotency_key =
        v_idempotency
    )
  for update;

  if found then
    if
      v_existing.purchase_return_id =
        v_return_id and
      v_existing.purchase_document_id =
        v_document_id and
      v_existing.idempotency_key =
        v_idempotency and
      v_existing.payload_hash =
        v_hash
    then
      insert into
      public.purchase_return_audits_v1 (
        tenant_id,
        company_id,
        branch_id,
        accounting_period_id,
        purchase_return_id,
        purchase_document_id,
        action,
        actor_user_id,
        payload_hash
      ) values (
        v_tenant,
        v_company,
        v_branch,
        v_period,
        v_return_id,
        v_document_id,
        'REPLAY',
        v_actor,
        v_hash
      );

      return query
        select
          'REPLAY'::text,
          v_existing
            .purchase_return_id,
          v_existing
            .purchase_document_id,
          v_existing
            .gross_amount,
          v_existing
            .payable_reversal_movement_id,
          v_existing
            .returned_at;
      return;
    end if;

    raise exception
      'PURCHASE_RETURN_IDEMPOTENCY_CONFLICT';
  end if;

  select *
  into v_document
  from public.purchase_documents_authority_v1 d
  where d.tenant_id = v_tenant
    and d.company_id = v_company
    and d.branch_id = v_branch
    and d.accounting_period_id =
      v_period
    and d.purchase_document_id =
      v_document_id
  for update;

  if not found then
    raise exception
      'PURCHASE_RETURN_PURCHASE_NOT_FOUND';
  end if;

  if
    v_document.status <> 'APPROVED' or
    v_document.payable_movement_id
      is null
  then
    raise exception
      'PURCHASE_RETURN_APPROVED_PURCHASE_REQUIRED';
  end if;

  for v_line in
    select value
    from jsonb_array_elements(
      p_lines
    )
  loop
    v_line_id :=
      nullif(
        btrim(
          v_line->>
            'purchaseDocumentLineId'
        ),
        ''
      );

    v_quantity :=
      nullif(
        v_line->>'quantity',
        ''
      )::numeric(18,6);

    if
      v_line_id is null or
      v_quantity is null or
      v_quantity <= 0
    then
      raise exception
        'PURCHASE_RETURN_LINE_INVALID';
    end if;

    select value
    into v_source_line
    from jsonb_array_elements(
      v_document.line_snapshot
    )
    where value->>'id' =
      v_line_id
    limit 1;

    if not found then
      raise exception
        'PURCHASE_RETURN_SOURCE_LINE_NOT_FOUND';
    end if;

    v_kind :=
      nullif(
        btrim(
          v_source_line->>'kind'
        ),
        ''
      );
    v_stock_item_id :=
      nullif(
        btrim(
          v_source_line->>'stockItemId'
        ),
        ''
      );
    v_unit :=
      nullif(
        btrim(
          v_source_line->>'unit'
        ),
        ''
      );
    v_source_quantity :=
      (v_source_line->>'quantity')
        ::numeric(18,6);
    v_source_gross :=
      (v_source_line->>'grossAmount')
        ::numeric(18,2);

    select coalesce(
      sum(l.quantity),
      0
    )
    into v_prior_quantity
    from public.purchase_return_lines_v1 l
    where l.tenant_id = v_tenant
      and l.company_id = v_company
      and l.branch_id = v_branch
      and l.accounting_period_id =
        v_period
      and l.purchase_document_id =
        v_document_id
      and l.purchase_document_line_id =
        v_line_id;

    v_next_quantity :=
      v_prior_quantity +
      v_quantity;

    if
      v_source_quantity <= 0 or
      v_next_quantity >
        v_source_quantity +
        0.000001
    then
      raise exception
        'PURCHASE_RETURN_OVER_RETURN';
    end if;

    v_prior_gross :=
      round(
        v_source_gross *
        v_prior_quantity /
        v_source_quantity,
        2
      );
    v_next_gross :=
      round(
        v_source_gross *
        v_next_quantity /
        v_source_quantity,
        2
      );
    v_line_gross :=
      v_next_gross -
      v_prior_gross;

    if v_line_gross < 0 then
      raise exception
        'PURCHASE_RETURN_AMOUNT_INVALID';
    end if;

    v_total_gross :=
      v_total_gross +
      v_line_gross;

    v_return_line_id :=
      v_return_id ||
      ':' ||
      v_line_id;

    insert into
    public.purchase_return_lines_v1 (
      tenant_id,
      company_id,
      branch_id,
      accounting_period_id,
      purchase_return_line_id,
      purchase_return_id,
      purchase_document_id,
      purchase_document_line_id,
      line_kind,
      stock_item_id,
      quantity,
      unit,
      gross_amount
    ) values (
      v_tenant,
      v_company,
      v_branch,
      v_period,
      v_return_line_id,
      v_return_id,
      v_document_id,
      v_line_id,
      v_kind,
      v_stock_item_id,
      v_quantity,
      v_unit,
      v_line_gross
    );

    if v_kind = 'GOODS' then
      if
        v_stock_item_id is null or
        v_unit not in (
          'mt',
          'm2',
          'adet'
        )
      then
        raise exception
          'PURCHASE_RETURN_GOODS_STOCK_IDENTITY_INVALID';
      end if;

      select coalesce(
        sum(
          case
            when m.direction = 'IN'
              then m.quantity
            else -m.quantity
          end
        ),
        0
      )
      into v_available
      from public.stock_movements_v1 m
      where m.tenant_id = v_tenant
        and m.company_id = v_company
        and m.branch_id = v_branch
        and m.accounting_period_id =
          v_period
        and m.stock_item_id =
          v_stock_item_id
        and m.unit = v_unit
        and m.status = 'POSTED';

      if
        v_available + 0.000001 <
        v_quantity
      then
        raise exception
          'PURCHASE_RETURN_INSUFFICIENT_STOCK';
      end if;

      insert into
      public.stock_movements_v1 (
        tenant_id,
        company_id,
        branch_id,
        accounting_period_id,
        movement_id,
        idempotency_key,
        stock_item_id,
        source_type,
        source_id,
        direction,
        quantity,
        unit,
        status,
        occurred_at,
        actor_user_id,
        payload_hash
      ) values (
        v_tenant,
        v_company,
        v_branch,
        v_period,
        'stock-movement:purchase-return:' ||
          v_return_line_id,
        'STOCK:PURCHASE_RETURN:' ||
          v_return_line_id,
        v_stock_item_id,
        'PURCHASE_RETURN',
        v_return_line_id,
        'OUT',
        v_quantity,
        v_unit,
        'POSTED',
        v_returned_at,
        v_actor,
        v_hash
      );
    elsif v_kind <> 'SERVICE' then
      raise exception
        'PURCHASE_RETURN_LINE_KIND_INVALID';
    end if;
  end loop;

  if v_total_gross <= 0 then
    raise exception
      'PURCHASE_RETURN_TOTAL_INVALID';
  end if;

  v_reversal_id :=
    'purchase-return-payable-reversal:' ||
    v_return_id;

  select
    x.outcome,
    x.movement_id,
    x.reason
  into
    v_payable_outcome,
    v_payable_movement_id,
    v_payable_reason
  from public.persist_counterparty_payable_movement_v1(
    jsonb_build_object(
      'movementId',
        v_reversal_id,
      'idempotencyKey',
        'PURCHASE_RETURN_PAYABLE:' ||
        v_return_id,
      'tenantId',
        v_tenant,
      'companyId',
        v_company,
      'branchId',
        v_branch,
      'accountingPeriodId',
        v_period,
      'counterpartyCustomerId',
        v_document.supplier_id,
      'counterpartyType',
        'SUPPLIER',
      'kind',
        'REVERSAL',
      'amount',
        v_total_gross,
      'currency',
        'TRY',
      'occurredAt',
        v_returned_at,
      'recordedAt',
        v_returned_at,
      'sourceDocumentId',
        v_return_id,
      'reversalOfMovementId',
        v_document
          .payable_movement_id,
      'note',
        'Approved purchase return'
    ),
    jsonb_build_object(
      'actorUserId',
        v_actor,
      'action',
        'PURCHASE_RETURN',
      'payloadHash',
        v_hash,
      'purchaseReturnId',
        v_return_id,
      'purchaseDocumentId',
        v_document_id
    )
  ) x
  limit 1;

  if
    v_payable_outcome not in (
      'CREATED',
      'REPLAY'
    ) or
    v_payable_movement_id is null
  then
    raise exception
      'PURCHASE_RETURN_PAYABLE_REVERSAL_FAILED:%',
      coalesce(
        v_payable_reason,
        v_payable_outcome,
        'UNKNOWN'
      );
  end if;

  insert into
  public.purchase_returns_v1 (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    purchase_return_id,
    purchase_document_id,
    idempotency_key,
    supplier_id,
    reason,
    returned_at,
    gross_amount,
    payable_reversal_movement_id,
    payload_hash,
    created_by_user_id
  ) values (
    v_tenant,
    v_company,
    v_branch,
    v_period,
    v_return_id,
    v_document_id,
    v_idempotency,
    v_document.supplier_id,
    v_reason,
    v_returned_at,
    v_total_gross,
    v_payable_movement_id,
    v_hash,
    v_actor
  );

  insert into
  public.purchase_return_audits_v1 (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    purchase_return_id,
    purchase_document_id,
    action,
    actor_user_id,
    payload_hash
  ) values (
    v_tenant,
    v_company,
    v_branch,
    v_period,
    v_return_id,
    v_document_id,
    'CREATE',
    v_actor,
    v_hash
  );

  return query
    select
      'CREATED'::text,
      v_return_id,
      v_document_id,
      v_total_gross,
      v_payable_movement_id,
      v_returned_at;
end;
$$;

revoke all on function
public.persist_purchase_return_authority_v1(
  jsonb,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text
)
from public, anon, authenticated;

grant execute on function
public.persist_purchase_return_authority_v1(
  jsonb,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text
)
to service_role;
