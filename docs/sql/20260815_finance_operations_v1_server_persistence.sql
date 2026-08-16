-- ENVerp Finance Operations V1 - Server Persistence Bridge
-- SOURCE PATCH ONLY. Apply to live DB only after separate review + explicit authorization.
-- Reuses finance_transactions as canonical movement store; does not create a duplicate ledger.

begin;

alter table public.finance_transactions
  alter column customer_id drop not null,
  alter column sale_id drop not null;

alter table public.finance_transaction_audits
  alter column customer_id drop not null,
  alter column sale_id drop not null;

alter table public.finance_transactions
  add column if not exists counterparty_id text null,
  add column if not exists operation_group_id text null,
  add column if not exists operation_leg text null;

alter table public.finance_transaction_audits
  add column if not exists counterparty_id text null;

alter table public.finance_transactions
  drop constraint if exists finance_transactions_ids_not_blank_ck;

alter table public.finance_transactions
  add constraint finance_transactions_ids_not_blank_ck check (
    btrim(id) <> '' and
    btrim(transaction_id) <> '' and
    btrim(idempotency_key) <> '' and
    (customer_id is null or btrim(customer_id) <> '') and
    (sale_id is null or btrim(sale_id) <> '') and
    (counterparty_id is null or btrim(counterparty_id) <> '') and
    btrim(source_document_id) <> '' and
    btrim(created_by) <> ''
  );

alter table public.finance_transactions
  drop constraint if exists finance_transactions_projection_source_ck;

alter table public.finance_transactions
  add constraint finance_transactions_projection_source_ck check (
    projection_source in (
      'SALE_CHARGE','SALE_PAYMENT','SALE_RETURN','LEGACY_DOWN_PAYMENT',
      'MANUAL','PAYMENT','TRANSFER','REVERSAL'
    )
  );

alter table public.finance_transactions
  drop constraint if exists finance_transactions_operation_leg_ck;

alter table public.finance_transactions
  add constraint finance_transactions_operation_leg_ck check (
    operation_leg is null or operation_leg in ('SINGLE','OUT','IN','REVERSAL_OUT','REVERSAL_IN')
  );

alter table public.finance_transactions
  drop constraint if exists finance_transactions_source_document_uq;

drop index if exists public.finance_transactions_source_document_uq;

create unique index finance_transactions_source_document_uq
on public.finance_transactions (
  tenant_id, company_id, branch_id, accounting_period_id,
  transaction_type, source_document_type, source_document_id,
  coalesce(operation_leg,'SINGLE')
);

create table if not exists public.finance_operation_requests_v1 (
  tenant_id text not null,
  company_id text not null,
  branch_id text not null,
  accounting_period_id text not null,
  idempotency_key text not null,
  payload_hash text not null,
  operation_id text not null,
  outcome text not null,
  result_json jsonb null,
  actor_user_id text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  primary key (
    tenant_id, company_id, branch_id, accounting_period_id, idempotency_key
  ),
  constraint finance_operation_requests_scope_chk check (
    btrim(tenant_id) <> '' and btrim(company_id) <> '' and
    btrim(branch_id) <> '' and btrim(accounting_period_id) <> ''
  ),
  constraint finance_operation_requests_outcome_chk check (
    outcome in ('PENDING','CREATED','REJECT')
  )
);

alter table public.finance_operation_requests_v1 enable row level security;
alter table public.finance_operation_requests_v1 force row level security;

revoke all on table public.finance_operation_requests_v1 from anon, authenticated;
grant select, insert, update on table public.finance_operation_requests_v1 to service_role;
revoke delete on table public.finance_operation_requests_v1 from anon, authenticated, service_role;

create or replace function public.persist_finance_operation_v1(
  p_operation jsonb,
  p_actor_user_id text,
  p_payload_hash text
)
returns table(
  outcome text,
  operation_id text,
  transaction_ids text[],
  reason text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_tenant text := trim(coalesce(p_operation->>'tenantId',''));
  v_company text := trim(coalesce(p_operation->>'companyId',''));
  v_branch text := trim(coalesce(p_operation->>'branchId',''));
  v_period text := trim(coalesce(p_operation->>'accountingPeriodId',''));
  v_operation_id text := trim(coalesce(p_operation->>'operationId',''));
  v_idem text := trim(coalesce(p_operation->>'idempotencyKey',''));
  v_kind text := trim(coalesce(p_operation->>'kind',''));
  v_channel text := trim(coalesce(p_operation->>'channel',''));
  v_action text := trim(coalesce(p_operation->>'action',''));
  v_currency text := upper(trim(coalesce(p_operation->>'currency','')));
  v_amount numeric := nullif(p_operation->>'amount','')::numeric;
  v_occurred_at timestamptz := nullif(p_operation->>'occurredAt','')::timestamptz;
  v_payment_method text := nullif(trim(coalesce(p_operation->>'paymentMethod','')), '');
  v_customer text := nullif(trim(coalesce(p_operation#>>'{source,customerId}','')), '');
  v_counterparty text := nullif(trim(coalesce(p_operation#>>'{source,counterpartyId}','')), '');
  v_sale text := nullif(trim(coalesce(p_operation#>>'{source,saleId}','')), '');
  v_source_id text := nullif(trim(coalesce(p_operation#>>'{source,sourceDocumentId}','')), '');
  v_source_type text := nullif(trim(coalesce(p_operation#>>'{source,sourceDocumentType}','')), '');
  v_description text := nullif(trim(coalesce(p_operation->>'description','')), '');
  v_reversal_target text := nullif(trim(coalesce(p_operation->>'reversalOfTransactionId','')), '');
  v_existing public.finance_operation_requests_v1%rowtype;
  v_operational uuid;
  v_ledger uuid;
  v_counter_ledger uuid;
  v_source_bank uuid;
  v_destination_bank uuid;
  v_source_ledger uuid;
  v_destination_ledger uuid;
  v_account_currency text;
  v_counter_currency text;
  v_tx_ids text[] := array[]::text[];
  v_tx_id text;
  v_audit_id text;
  v_row public.finance_transactions%rowtype;
  v_found_count integer := 0;
  v_reject_reason text := null;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FINANCE_OPERATION_SERVICE_ROLE_REQUIRED';
  end if;

  if p_operation is null or jsonb_typeof(p_operation) <> 'object' then
    return query select 'REJECT', null::text, null::text[], 'FINANCE_OPERATION_PAYLOAD_REQUIRED';
    return;
  end if;

  if v_tenant = '' or v_company = '' or v_branch = '' or v_period = '' or
     v_operation_id = '' or v_idem = '' or trim(coalesce(p_payload_hash,'')) = '' or
     trim(coalesce(p_actor_user_id,'')) = '' then
    return query select 'REJECT', v_operation_id, null::text[], 'FINANCE_OPERATION_REQUIRED_FIELD_MISSING';
    return;
  end if;

  insert into public.finance_operation_requests_v1 (
    tenant_id, company_id, branch_id, accounting_period_id,
    idempotency_key, payload_hash, operation_id, outcome, actor_user_id
  )
  values (
    v_tenant, v_company, v_branch, v_period,
    v_idem, p_payload_hash, v_operation_id, 'PENDING', p_actor_user_id
  )
  on conflict do nothing;

  if not found then
    select *
    into v_existing
    from public.finance_operation_requests_v1 r
    where r.tenant_id = v_tenant
      and r.company_id = v_company
      and r.branch_id = v_branch
      and r.accounting_period_id = v_period
      and r.idempotency_key = v_idem
    for update;

    if v_existing.payload_hash is distinct from p_payload_hash then
      return query select 'CONFLICT', v_existing.operation_id, null::text[], 'IDEMPOTENCY_PAYLOAD_CONFLICT';
      return;
    end if;

    if v_existing.outcome = 'CREATED' then
      return query select
        'REPLAY',
        v_existing.operation_id,
        coalesce(array(select jsonb_array_elements_text(v_existing.result_json->'transactionIds')), array[]::text[]),
        null::text;
      return;
    end if;

    if v_existing.outcome = 'REJECT' then
      return query select
        'REJECT',
        v_existing.operation_id,
        null::text[],
        v_existing.result_json->>'reason';
      return;
    end if;

    return query select 'CONFLICT', v_existing.operation_id, null::text[], 'FINANCE_OPERATION_PENDING_CONFLICT';
    return;
  end if;

  if v_amount is null or v_amount <= 0 or v_currency !~ '^[A-Z]{3}$' or v_occurred_at is null then
    update public.finance_operation_requests_v1
    set outcome='REJECT',
        result_json=jsonb_build_object('reason','FINANCE_OPERATION_AMOUNT_CURRENCY_DATE_INVALID'),
        completed_at=now()
    where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
      and accounting_period_id=v_period and idempotency_key=v_idem;
    return query select 'REJECT', v_operation_id, null::text[], 'FINANCE_OPERATION_AMOUNT_CURRENCY_DATE_INVALID';
    return;
  end if;

  if v_source_id is null then
    v_source_id := v_operation_id;
  end if;
  if v_source_type is null then
    v_source_type := 'MANUAL';
  end if;

  <<operation_body>>
  begin
  if v_action = 'REVERSE' then
    if v_reversal_target is null then
      v_reject_reason := 'FINANCE_REVERSAL_TARGET_REQUIRED';
      exit operation_body;
    end if;

    for v_row in
      select ft.*
      from public.finance_transactions ft
      where ft.tenant_id=v_tenant and ft.company_id=v_company
        and ft.branch_id=v_branch and ft.accounting_period_id=v_period
        and (ft.operation_group_id=v_reversal_target or ft.transaction_id=v_reversal_target)
      order by ft.transaction_id
      for update
    loop
      v_found_count := v_found_count + 1;

      if v_row.transaction_type = 'REVERSAL' or v_row.status = 'REVERSED' then
        raise exception 'FINANCE_REVERSAL_TARGET_INVALID';
      end if;

      v_tx_id := v_operation_id || ':REV:' || v_found_count::text;
      v_audit_id := 'audit:' || v_tx_id;

      insert into public.finance_transactions (
        id, transaction_id, idempotency_key,
        tenant_id, company_id, branch_id, accounting_period_id,
        transaction_type, direction, payment_method,
        finance_account_id, counter_account_id,
        customer_id, sale_id, counterparty_id,
        source_document_id, source_document_type,
        gross_amount, commission_amount, net_amount,
        currency, transaction_date, value_date, due_date,
        status, description, external_reference, reversal_of_transaction_id,
        created_by, created_at, posted_at, reversed_at, archived_at,
        projection_source, operation_group_id, operation_leg
      )
      values (
        v_tx_id, v_tx_id, v_idem || ':REV:' || v_found_count::text,
        v_tenant, v_company, v_branch, v_period,
        'REVERSAL',
        case when v_row.direction='DEBIT' then 'CREDIT' else 'DEBIT' end,
        v_row.payment_method,
        v_row.finance_account_id, v_row.counter_account_id,
        v_row.customer_id, v_row.sale_id, v_row.counterparty_id,
        'REVERSAL:' || v_reversal_target, 'MANUAL',
        v_row.gross_amount, v_row.commission_amount, v_row.net_amount,
        v_row.currency, v_occurred_at::date, v_row.value_date, v_row.due_date,
        'POSTED', coalesce(v_description,'Ters kayıt'), v_reversal_target, v_row.transaction_id,
        p_actor_user_id, v_occurred_at, v_occurred_at, null, null,
        'REVERSAL', v_operation_id,
        case when v_row.operation_leg='OUT' then 'REVERSAL_OUT'
             when v_row.operation_leg='IN' then 'REVERSAL_IN'
             else 'SINGLE' end
      );

      insert into public.finance_transaction_audits (
        id, transaction_id, idempotency_key,
        tenant_id, company_id, branch_id, accounting_period_id,
        action, actor_user_id, customer_id, sale_id, counterparty_id,
        occurred_at, payload_hash
      )
      values (
        v_audit_id, v_tx_id, v_idem || ':REV:' || v_found_count::text,
        v_tenant, v_company, v_branch, v_period,
        'POSTED', p_actor_user_id, v_row.customer_id, v_row.sale_id, v_row.counterparty_id,
        v_occurred_at, p_payload_hash
      );

      update public.finance_transactions ft
      set status='REVERSED', reversed_at=v_occurred_at
      where ft.tenant_id=v_tenant and ft.company_id=v_company
        and ft.branch_id=v_branch and ft.accounting_period_id=v_period
        and ft.transaction_id=v_row.transaction_id;

      v_tx_ids := array_append(v_tx_ids, v_tx_id);
    end loop;

    if v_found_count = 0 then
      update public.finance_operation_requests_v1
      set outcome='REJECT',
          result_json=jsonb_build_object('reason','FINANCE_REVERSAL_TARGET_NOT_FOUND'),
          completed_at=now()
      where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
        and accounting_period_id=v_period and idempotency_key=v_idem;
      return query select 'REJECT', v_operation_id, null::text[], 'FINANCE_REVERSAL_TARGET_NOT_FOUND';
      return;
    end if;

  elsif v_kind = 'TRANSFER' and v_channel = 'TRANSFER' and v_action = 'CREATE' then
    v_source_bank := nullif(p_operation#>>'{accounts,sourceBankAccountId}','')::uuid;
    v_destination_bank := nullif(p_operation#>>'{accounts,destinationBankAccountId}','')::uuid;

    if v_source_bank is null or v_destination_bank is null or v_source_bank=v_destination_bank then
      return query select 'REJECT', v_operation_id, null::text[], 'FINANCE_TRANSFER_BANK_PAIR_INVALID';
      return;
    end if;

    -- Deterministic lock order prevents transfer deadlocks.
    perform 1
    from public.bank_accounts ba
    where ba.id in (v_source_bank,v_destination_bank)
      and ba.tenant_id=v_tenant and ba.company_id=v_company
      and ba.branch_id=v_branch and ba.accounting_period_id=v_period
    order by ba.id
    for update;

    select ba.ledger_account_id, ba.currency
    into v_source_ledger, v_account_currency
    from public.bank_accounts ba
    where ba.id=v_source_bank and ba.tenant_id=v_tenant and ba.company_id=v_company
      and ba.branch_id=v_branch and ba.accounting_period_id=v_period
      and ba.is_active=true and ba.archived_at is null;

    if not found then
      v_reject_reason := 'FINANCE_TRANSFER_SOURCE_BANK_INACTIVE_OR_MISSING';
      exit operation_body;
    end if;

    select ba.ledger_account_id, ba.currency
    into v_destination_ledger, v_counter_currency
    from public.bank_accounts ba
    where ba.id=v_destination_bank and ba.tenant_id=v_tenant and ba.company_id=v_company
      and ba.branch_id=v_branch and ba.accounting_period_id=v_period
      and ba.is_active=true and ba.archived_at is null;

    if not found or v_account_currency<>v_currency or v_counter_currency<>v_currency then
      v_reject_reason := 'FINANCE_TRANSFER_CURRENCY_OR_DESTINATION_INVALID';
      exit operation_body;
    end if;

    -- OUT leg
    v_tx_id := v_operation_id || ':OUT';
    insert into public.finance_transactions (
      id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
      transaction_type,direction,payment_method,finance_account_id,counter_account_id,
      customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
      gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
      created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
    ) values (
      v_tx_id,v_tx_id,v_idem||':OUT',v_tenant,v_company,v_branch,v_period,
      'TRANSFER','CREDIT','BANK_TRANSFER',v_source_ledger::text,v_destination_ledger::text,
      null,null,null,v_source_id,'MANUAL',
      v_amount,0,v_amount,v_currency,v_occurred_at::date,'POSTED',v_description,
      p_actor_user_id,v_occurred_at,v_occurred_at,'TRANSFER',v_operation_id,'OUT'
    );
    insert into public.finance_transaction_audits (
      id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
      action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
    ) values (
      'audit:'||v_tx_id,v_tx_id,v_idem||':OUT',v_tenant,v_company,v_branch,v_period,
      'POSTED',p_actor_user_id,null,null,null,v_occurred_at,p_payload_hash
    );
    v_tx_ids := array_append(v_tx_ids,v_tx_id);

    -- IN leg
    v_tx_id := v_operation_id || ':IN';
    insert into public.finance_transactions (
      id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
      transaction_type,direction,payment_method,finance_account_id,counter_account_id,
      customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
      gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
      created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
    ) values (
      v_tx_id,v_tx_id,v_idem||':IN',v_tenant,v_company,v_branch,v_period,
      'TRANSFER','DEBIT','BANK_TRANSFER',v_destination_ledger::text,v_source_ledger::text,
      null,null,null,v_source_id,'MANUAL',
      v_amount,0,v_amount,v_currency,v_occurred_at::date,'POSTED',v_description,
      p_actor_user_id,v_occurred_at,v_occurred_at,'TRANSFER',v_operation_id,'IN'
    );
    insert into public.finance_transaction_audits (
      id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
      action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
    ) values (
      'audit:'||v_tx_id,v_tx_id,v_idem||':IN',v_tenant,v_company,v_branch,v_period,
      'POSTED',p_actor_user_id,null,null,null,v_occurred_at,p_payload_hash
    );
    v_tx_ids := array_append(v_tx_ids,v_tx_id);

  elsif v_action = 'CREATE' and v_kind in ('COLLECTION','PAYMENT') then
    if v_kind='COLLECTION' and v_customer is null then
      v_reject_reason := 'FINANCE_COLLECTION_CUSTOMER_REQUIRED';
      exit operation_body;
    end if;
    if v_kind='PAYMENT' and v_counterparty is null then
      v_reject_reason := 'FINANCE_PAYMENT_COUNTERPARTY_REQUIRED';
      exit operation_body;
    end if;

    if v_channel='CASH' then
      v_operational := nullif(p_operation#>>'{accounts,cashAccountId}','')::uuid;
      select ca.ledger_account_id,ca.currency into v_ledger,v_account_currency
      from public.cash_accounts ca
      where ca.id=v_operational and ca.tenant_id=v_tenant and ca.company_id=v_company
        and ca.branch_id=v_branch and ca.accounting_period_id=v_period
        and ca.is_active=true and ca.archived_at is null
      for update;
    elsif v_channel='BANK' then
      v_operational := nullif(p_operation#>>'{accounts,bankAccountId}','')::uuid;
      select ba.ledger_account_id,ba.currency into v_ledger,v_account_currency
      from public.bank_accounts ba
      where ba.id=v_operational and ba.tenant_id=v_tenant and ba.company_id=v_company
        and ba.branch_id=v_branch and ba.accounting_period_id=v_period
        and ba.is_active=true and ba.archived_at is null
      for update;
    elsif v_channel='POS' and v_kind='COLLECTION' then
      v_operational := nullif(p_operation#>>'{accounts,posAccountId}','')::uuid;
      select pa.clearing_ledger_account_id,pa.currency into v_ledger,v_account_currency
      from public.pos_accounts pa
      where pa.id=v_operational and pa.tenant_id=v_tenant and pa.company_id=v_company
        and pa.branch_id=v_branch and pa.accounting_period_id=v_period
        and pa.is_active=true and pa.archived_at is null
      for update;
    else
      v_reject_reason := 'FINANCE_OPERATION_CHANNEL_UNSUPPORTED';
      exit operation_body;
    end if;

    if not found or v_account_currency<>v_currency then
      v_reject_reason := 'FINANCE_OPERATION_ACCOUNT_INACTIVE_SCOPE_OR_CURRENCY';
      exit operation_body;
    end if;

    v_counter_ledger := nullif(p_operation#>>'{accounts,counterAccountId}','')::uuid;
    select fa.currency into v_counter_currency
    from public.finance_accounts fa
    where fa.id=v_counter_ledger and fa.tenant_id=v_tenant and fa.company_id=v_company
      and fa.branch_id=v_branch and fa.accounting_period_id=v_period
      and fa.is_active=true and fa.archived_at is null
    for update;

    if not found or v_counter_currency<>v_currency or v_counter_ledger=v_ledger then
      v_reject_reason := 'FINANCE_COUNTER_LEDGER_INVALID';
      exit operation_body;
    end if;

    v_tx_id := v_operation_id;
    insert into public.finance_transactions (
      id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
      transaction_type,direction,payment_method,finance_account_id,counter_account_id,
      customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
      gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
      created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
    ) values (
      v_tx_id,v_tx_id,v_idem,v_tenant,v_company,v_branch,v_period,
      v_kind,case when v_kind='COLLECTION' then 'DEBIT' else 'CREDIT' end,
      v_payment_method,v_ledger::text,v_counter_ledger::text,
      v_customer,v_sale,v_counterparty,v_source_id,
      case when v_kind='COLLECTION' then 'SALE_PAYMENT' else 'EXPENSE' end,
      v_amount,0,v_amount,v_currency,v_occurred_at::date,'POSTED',v_description,
      p_actor_user_id,v_occurred_at,v_occurred_at,
      case when v_kind='COLLECTION' then 'SALE_PAYMENT' else 'PAYMENT' end,
      v_operation_id,'SINGLE'
    );

    insert into public.finance_transaction_audits (
      id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
      action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
    ) values (
      'audit:'||v_tx_id,v_tx_id,v_idem,v_tenant,v_company,v_branch,v_period,
      'POSTED',p_actor_user_id,v_customer,v_sale,v_counterparty,v_occurred_at,p_payload_hash
    );
    v_tx_ids := array_append(v_tx_ids,v_tx_id);

  else
    v_reject_reason := 'FINANCE_OPERATION_NOT_IMPLEMENTED';
    exit operation_body;
  end if;

  end operation_body;

  if v_reject_reason is not null then
    update public.finance_operation_requests_v1
    set outcome='REJECT',
        result_json=jsonb_build_object('reason',v_reject_reason),
        completed_at=now()
    where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
      and accounting_period_id=v_period and idempotency_key=v_idem;

    return query select 'REJECT',v_operation_id,null::text[],v_reject_reason;
    return;
  end if;

  update public.finance_operation_requests_v1
  set outcome='CREATED',
      result_json=jsonb_build_object('transactionIds',to_jsonb(v_tx_ids)),
      completed_at=now()
  where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
    and accounting_period_id=v_period and idempotency_key=v_idem;

  return query select 'CREATED',v_operation_id,v_tx_ids,null::text;

exception
  when unique_violation then
    raise;
end;
$function$;

revoke all on function public.persist_finance_operation_v1(jsonb,text,text)
from public,anon,authenticated;

grant execute on function public.persist_finance_operation_v1(jsonb,text,text)
to service_role;

commit;