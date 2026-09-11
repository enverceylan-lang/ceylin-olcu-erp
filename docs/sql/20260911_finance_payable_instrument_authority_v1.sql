-- ENVERP F2-B1 PAYABLE INSTRUMENT AUTHORITY V1
-- SOURCE ONLY. LIVE APPLY REQUIRES SEPARATE EXPLICIT APPROVAL.
begin;

do $preflight$
begin
  if to_regclass('public.finance_instruments_v1') is null
     or to_regclass('public.finance_instrument_events_v1') is null
     or to_regclass('public.finance_accounts') is null
     or to_regclass('public.bank_accounts') is null
     or to_regclass('public.finance_transactions') is null
     or to_regclass('public.finance_transaction_audits') is null
     or to_regclass('public.counterparty_payable_movements') is null
     or to_regclass('public.counterparty_payable_audits') is null
     or to_regclass('public.finance_operation_requests_v1') is null then
    raise exception 'FINANCE_PAYABLE_INSTRUMENT_PREFLIGHT_RELATION_MISSING';
  end if;
end
$preflight$;

create or replace function public.persist_finance_payable_instrument_v1(
  p_command jsonb,p_actor_user_id text,p_payload_hash text
)
returns table(outcome text,operation_id text,transaction_ids text[],instrument_id text,reason text,occurred_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare
  v_tenant text:=trim(coalesce(p_command->>'tenantId',''));
  v_company text:=trim(coalesce(p_command->>'companyId',''));
  v_branch text:=trim(coalesce(p_command->>'branchId',''));
  v_period text:=trim(coalesce(p_command->>'accountingPeriodId',''));
  v_operation uuid;
  v_idem text:=trim(coalesce(p_command->>'idempotencyKey',''));
  v_type text:=upper(trim(coalesce(p_command->>'instrumentType','')));
  v_counterparty text:=trim(coalesce(p_command->>'counterpartyId',''));
  v_counterparty_type text:=upper(trim(coalesce(p_command->>'counterpartyType','')));
  v_amount numeric:=nullif(p_command->>'amount','')::numeric;
  v_currency text:=upper(trim(coalesce(p_command->>'currency','')));
  v_now timestamptz:=nullif(p_command->>'occurredAt','')::timestamptz;
  v_instrument uuid:=gen_random_uuid();
  v_existing public.finance_operation_requests_v1%rowtype;
  v_payable_balance numeric;
  v_count integer;
  v_customer_payable_ledger uuid;
  v_instrument_payable_ledger uuid;
  v_payable_movement_id text;
  v_tx text;
  v_result jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FINANCE_PAYABLE_INSTRUMENT_SERVICE_ROLE_REQUIRED';
  end if;

  begin v_operation:=(p_command->>'operationId')::uuid;
  exception when others then
    return query select 'REJECT',null::text,array[]::text[],null::text,'FINANCE_PAYABLE_INSTRUMENT_OPERATION_UUID_INVALID',clock_timestamp();
    return;
  end;

  if v_tenant='' or v_company='' or v_branch='' or v_period='' or v_idem='' or
     v_type not in('CHEQUE','NOTE') or v_counterparty='' or
     v_counterparty_type not in('SUPPLIER','TAILOR','INSTALLER') or
     v_amount is null or v_amount<=0 or v_currency!~'^[A-Z]{3}$' or v_now is null or
     trim(coalesce(p_actor_user_id,''))='' or trim(coalesce(p_payload_hash,''))='' then
    return query select 'REJECT',v_operation::text,array[]::text[],null::text,'FINANCE_PAYABLE_INSTRUMENT_REQUIRED_FIELD_INVALID',clock_timestamp();
    return;
  end if;

  if trim(coalesce(p_command#>>'{instrument,instrumentNumber}',''))='' or
     trim(coalesce(p_command#>>'{instrument,drawerName}',''))='' or
     nullif(p_command#>>'{instrument,dueDate}','')::date is null or
     (v_type='CHEQUE' and trim(coalesce(p_command#>>'{instrument,bankName}',''))='') then
    return query select 'REJECT',v_operation::text,array[]::text[],null::text,'FINANCE_PAYABLE_INSTRUMENT_DOCUMENT_INVALID',clock_timestamp();
    return;
  end if;

  insert into public.finance_operation_requests_v1(
    tenant_id,company_id,branch_id,accounting_period_id,idempotency_key,payload_hash,
    operation_id,outcome,actor_user_id
  ) values (
    v_tenant,v_company,v_branch,v_period,v_idem,p_payload_hash,v_operation::text,'PENDING',p_actor_user_id
  ) on conflict do nothing;

  select * into v_existing from public.finance_operation_requests_v1
  where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
    and accounting_period_id=v_period and idempotency_key=v_idem
  for update;

  if v_existing.payload_hash<>p_payload_hash then
    return query select 'CONFLICT',v_existing.operation_id,array[]::text[],null::text,'IDEMPOTENCY_PAYLOAD_CONFLICT',clock_timestamp();
    return;
  elsif v_existing.outcome='CREATED' then
    return query select 'REPLAY',v_existing.operation_id,
      coalesce(array(select jsonb_array_elements_text(coalesce(v_existing.result_json->'transactionIds','[]'::jsonb))),array[]::text[]),
      v_existing.result_json->>'instrumentId',null::text,
      coalesce((v_existing.result_json->>'occurredAt')::timestamptz,clock_timestamp());
    return;
  elsif v_existing.outcome='REJECT' then
    return query select 'REJECT',v_existing.operation_id,array[]::text[],null::text,
      v_existing.result_json->>'reason',coalesce(v_existing.completed_at,clock_timestamp());
    return;
  elsif v_existing.operation_id<>v_operation::text then
    return query select 'CONFLICT',v_existing.operation_id,array[]::text[],null::text,'FINANCE_PAYABLE_INSTRUMENT_PENDING_CONFLICT',clock_timestamp();
    return;
  end if;

  begin
    perform 1 from public.counterparty_payable_movements pm
    where pm.tenant_id=v_tenant and pm.company_id=v_company and pm.branch_id=v_branch
      and pm.accounting_period_id=v_period and pm.counterparty_customer_id=v_counterparty
      and pm.counterparty_type=v_counterparty_type and pm.currency=v_currency
    order by pm.occurred_at,pm.movement_id for update;

    select coalesce(sum(case
      when pm.movement_kind='ACCRUAL' then pm.amount
      when pm.movement_kind='PAYMENT' then -pm.amount
      when original.movement_kind='ACCRUAL' then -pm.amount
      when original.movement_kind='PAYMENT' then pm.amount
      else 0 end),0)
    into v_payable_balance
    from public.counterparty_payable_movements pm
    left join public.counterparty_payable_movements original
      on original.movement_id=pm.reversal_of_movement_id
    where pm.tenant_id=v_tenant and pm.company_id=v_company and pm.branch_id=v_branch
      and pm.accounting_period_id=v_period and pm.counterparty_customer_id=v_counterparty
      and pm.counterparty_type=v_counterparty_type and pm.currency=v_currency;

    if v_payable_balance<v_amount then
      raise exception 'FINANCE_PAYABLE_INSTRUMENT_EXCEEDS_COUNTERPARTY_PAYABLE';
    end if;

    insert into public.finance_instruments_v1(
      id,tenant_id,company_id,branch_id,accounting_period_id,instrument_type,direction,state,
      customer_id,counterparty_id,instrument_number,drawer_name,bank_name,bank_branch,account_number,
      issue_date,issue_place,guarantor_name,due_date,amount,currency,document_media_id,description,
      created_by,created_at,updated_at
    ) values (
      v_instrument,v_tenant,v_company,v_branch,v_period,v_type,'PAYABLE','ISSUED',
      null,v_counterparty,trim(p_command#>>'{instrument,instrumentNumber}'),trim(p_command#>>'{instrument,drawerName}'),
      nullif(trim(coalesce(p_command#>>'{instrument,bankName}','')),''),
      nullif(trim(coalesce(p_command#>>'{instrument,bankBranch}','')),''),
      nullif(trim(coalesce(p_command#>>'{instrument,accountNumber}','')),''),
      nullif(p_command#>>'{instrument,issueDate}','')::date,
      nullif(trim(coalesce(p_command#>>'{instrument,issuePlace}','')),''),
      nullif(trim(coalesce(p_command#>>'{instrument,guarantorName}','')),''),
      (p_command#>>'{instrument,dueDate}')::date,v_amount,v_currency,null,
      nullif(trim(coalesce(p_command->>'description','')),''),
      p_actor_user_id,v_now,v_now
    );

    insert into public.finance_instrument_events_v1(
      id,instrument_id,tenant_id,company_id,branch_id,accounting_period_id,
      from_state,to_state,counterparty_id,actor_user_id,occurred_at,payload_hash
    ) values (
      gen_random_uuid(),v_instrument,v_tenant,v_company,v_branch,v_period,
      null,'ISSUED',v_counterparty,p_actor_user_id,v_now,p_payload_hash
    );

    insert into public.finance_accounts(
      id,tenant_id,company_id,branch_id,accounting_period_id,code,name,account_type,currency,
      is_active,is_default_collection,is_default_payment,created_by,updated_by
    ) values (
      md5(v_tenant||'|'||v_company||'|'||v_branch||'|'||v_period||'|'||v_currency||'|'||v_type||'_PAYABLE')::uuid,
      v_tenant,v_company,v_branch,v_period,
      case when v_type='CHEQUE' then 'SYS-CHEQUE-PAYABLE-' else 'SYS-NOTE-PAYABLE-' end||v_currency,
      case when v_type='CHEQUE' then 'Issued Cheques ' else 'Issued Notes ' end||v_currency,
      case when v_type='CHEQUE' then 'CHEQUE_PAYABLE' else 'NOTE_PAYABLE' end,
      v_currency,true,false,false,p_actor_user_id,p_actor_user_id
    ) on conflict (tenant_id,company_id,branch_id,accounting_period_id,code) do nothing;

    select count(*),min(fa.id) into v_count,v_customer_payable_ledger
    from public.finance_accounts fa
    where fa.tenant_id=v_tenant and fa.company_id=v_company and fa.branch_id=v_branch
      and fa.accounting_period_id=v_period and fa.currency=v_currency
      and fa.account_type='CUSTOMER_PAYABLE' and fa.is_active and fa.archived_at is null;
    if v_count<>1 then raise exception 'FINANCE_COUNTERPARTY_PAYABLE_ACCOUNT_NOT_UNIQUE'; end if;

    select count(*),min(fa.id) into v_count,v_instrument_payable_ledger
    from public.finance_accounts fa
    where fa.tenant_id=v_tenant and fa.company_id=v_company and fa.branch_id=v_branch
      and fa.accounting_period_id=v_period and fa.currency=v_currency
      and fa.account_type=case when v_type='CHEQUE' then 'CHEQUE_PAYABLE' else 'NOTE_PAYABLE' end
      and fa.is_active and fa.archived_at is null;
    if v_count<>1 then raise exception 'FINANCE_PAYABLE_INSTRUMENT_ACCOUNT_NOT_UNIQUE'; end if;

    v_payable_movement_id:='instrument-payment:'||v_operation::text;
    insert into public.counterparty_payable_movements(
      movement_id,tenant_id,company_id,branch_id,accounting_period_id,idempotency_key,
      counterparty_customer_id,counterparty_type,movement_kind,amount,currency,
      occurred_at,recorded_at,source_document_id,operation_id,source_payment_id,note,created_by_user_id
    ) values (
      v_payable_movement_id,v_tenant,v_company,v_branch,v_period,v_idem||':payable',
      v_counterparty,v_counterparty_type,'PAYMENT',v_amount,v_currency,
      v_now,v_now,v_instrument::text,v_operation::text,v_instrument::text,
      case when v_type='CHEQUE' then 'Issued cheque payment' else 'Issued note payment' end,p_actor_user_id
    );

    insert into public.counterparty_payable_audits(
      movement_id,tenant_id,company_id,branch_id,accounting_period_id,actor_user_id,action,occurred_at,payload
    ) values (
      v_payable_movement_id,v_tenant,v_company,v_branch,v_period,p_actor_user_id,'CREATE',v_now,
      jsonb_build_object('instrumentId',v_instrument,'payloadHash',p_payload_hash)
    );

    v_tx:=v_operation::text;
    insert into public.finance_transactions(
      id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
      transaction_type,direction,payment_method,finance_account_id,counter_account_id,
      customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
      gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
      created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
    ) values (
      v_tx,v_tx,v_idem,v_tenant,v_company,v_branch,v_period,'PAYMENT','DEBIT',
      case when v_type='CHEQUE' then 'CHEQUE' else 'PROMISSORY_NOTE' end,
      v_customer_payable_ledger::text,v_instrument_payable_ledger::text,
      null,null,v_counterparty,v_instrument::text,case when v_type='CHEQUE' then 'CHEQUE' else 'NOTE' end,
      v_amount,0,v_amount,v_currency,current_date,'POSTED',
      case when v_type='CHEQUE' then 'Issued cheque closes counterparty payable' else 'Issued note closes counterparty payable' end,
      p_actor_user_id,v_now,v_now,'MANUAL',v_operation::text,'SINGLE'
    );

    insert into public.finance_transaction_audits(
      id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
      action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
    ) values (
      'audit:'||v_tx,v_tx,v_idem,v_tenant,v_company,v_branch,v_period,
      'POSTED',p_actor_user_id,null,null,v_counterparty,v_now,p_payload_hash
    );

    v_result:=jsonb_build_object(
      'transactionIds',jsonb_build_array(v_tx),
      'instrumentId',v_instrument::text,
      'occurredAt',v_now
    );

    update public.finance_operation_requests_v1
    set outcome='CREATED',result_json=v_result,completed_at=v_now
    where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
      and accounting_period_id=v_period and idempotency_key=v_idem;

    return query select 'CREATED',v_operation::text,array[v_tx],v_instrument::text,null::text,v_now;
    return;
  exception when others then
    update public.finance_operation_requests_v1
    set outcome='REJECT',
      result_json=jsonb_build_object('reason',case when sqlerrm~'^FINANCE_' then sqlerrm else 'FINANCE_PAYABLE_INSTRUMENT_PERSISTENCE_FAILED' end),
      completed_at=clock_timestamp()
    where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
      and accounting_period_id=v_period and idempotency_key=v_idem;
    return query select 'REJECT',v_operation::text,array[]::text[],null::text,
      case when sqlerrm~'^FINANCE_' then sqlerrm else 'FINANCE_PAYABLE_INSTRUMENT_PERSISTENCE_FAILED' end,clock_timestamp();
    return;
  end;
end;
$function$;

create or replace function public.transition_finance_payable_instrument_v1(
  p_command jsonb,p_actor_user_id text,p_payload_hash text
)
returns table(outcome text,operation_id text,transaction_ids text[],instrument_id text,reason text,occurred_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare
  v_tenant text:=trim(coalesce(p_command->>'tenantId',''));
  v_company text:=trim(coalesce(p_command->>'companyId',''));
  v_branch text:=trim(coalesce(p_command->>'branchId',''));
  v_period text:=trim(coalesce(p_command->>'accountingPeriodId',''));
  v_operation uuid;
  v_idem text:=trim(coalesce(p_command->>'idempotencyKey',''));
  v_instrument_id uuid;
  v_next text:=upper(trim(coalesce(p_command->>'toState','')));
  v_now timestamptz:=nullif(p_command->>'occurredAt','')::timestamptz;
  v_existing public.finance_operation_requests_v1%rowtype;
  v_instrument public.finance_instruments_v1%rowtype;
  v_count integer;
  v_instrument_payable_ledger uuid;
  v_bank_id uuid;
  v_bank_ledger uuid;
  v_bank_currency text;
  v_original_payment public.finance_transactions%rowtype;
  v_original_payable_movement_id text;
  v_payable_movement_id text;
  v_tx text;
  v_tx_ids text[]:=array[]::text[];
  v_result jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FINANCE_PAYABLE_INSTRUMENT_SERVICE_ROLE_REQUIRED';
  end if;

  begin
    v_operation:=(p_command->>'operationId')::uuid;
    v_instrument_id:=(p_command->>'instrumentId')::uuid;
  exception when others then
    return query select 'REJECT',null::text,array[]::text[],null::text,'FINANCE_PAYABLE_INSTRUMENT_TRANSITION_UUID_INVALID',clock_timestamp();
    return;
  end;

  if v_tenant='' or v_company='' or v_branch='' or v_period='' or v_idem='' or
     v_next not in('PAID','RETURNED','CANCELLED') or v_now is null or
     trim(coalesce(p_actor_user_id,''))='' or trim(coalesce(p_payload_hash,''))='' then
    return query select 'REJECT',v_operation::text,array[]::text[],v_instrument_id::text,'FINANCE_PAYABLE_INSTRUMENT_TRANSITION_REQUIRED_FIELD_INVALID',clock_timestamp();
    return;
  end if;

  insert into public.finance_operation_requests_v1(
    tenant_id,company_id,branch_id,accounting_period_id,idempotency_key,payload_hash,
    operation_id,outcome,actor_user_id
  ) values (
    v_tenant,v_company,v_branch,v_period,v_idem,p_payload_hash,v_operation::text,'PENDING',p_actor_user_id
  ) on conflict do nothing;

  select * into v_existing from public.finance_operation_requests_v1
  where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
    and accounting_period_id=v_period and idempotency_key=v_idem
  for update;

  if v_existing.payload_hash<>p_payload_hash then
    return query select 'CONFLICT',v_existing.operation_id,array[]::text[],v_instrument_id::text,'IDEMPOTENCY_PAYLOAD_CONFLICT',clock_timestamp();
    return;
  elsif v_existing.outcome='CREATED' then
    return query select 'REPLAY',v_existing.operation_id,
      coalesce(array(select jsonb_array_elements_text(coalesce(v_existing.result_json->'transactionIds','[]'::jsonb))),array[]::text[]),
      v_existing.result_json->>'instrumentId',null::text,
      coalesce((v_existing.result_json->>'occurredAt')::timestamptz,clock_timestamp());
    return;
  elsif v_existing.outcome='REJECT' then
    return query select 'REJECT',v_existing.operation_id,array[]::text[],v_instrument_id::text,
      v_existing.result_json->>'reason',coalesce(v_existing.completed_at,clock_timestamp());
    return;
  elsif v_existing.operation_id<>v_operation::text then
    return query select 'CONFLICT',v_existing.operation_id,array[]::text[],v_instrument_id::text,'FINANCE_PAYABLE_INSTRUMENT_TRANSITION_PENDING_CONFLICT',clock_timestamp();
    return;
  end if;

  begin
    select * into v_instrument from public.finance_instruments_v1
    where id=v_instrument_id and tenant_id=v_tenant and company_id=v_company
      and branch_id=v_branch and accounting_period_id=v_period and direction='PAYABLE'
    for update;

    if not found then raise exception 'FINANCE_PAYABLE_INSTRUMENT_NOT_FOUND'; end if;
    if v_instrument.state<>'ISSUED' then raise exception 'FINANCE_PAYABLE_INSTRUMENT_STATE_INVALID'; end if;

    select count(*),min(fa.id) into v_count,v_instrument_payable_ledger
    from public.finance_accounts fa
    where fa.tenant_id=v_tenant and fa.company_id=v_company and fa.branch_id=v_branch
      and fa.accounting_period_id=v_period and fa.currency=v_instrument.currency
      and fa.account_type=case when v_instrument.instrument_type='CHEQUE' then 'CHEQUE_PAYABLE' else 'NOTE_PAYABLE' end
      and fa.is_active and fa.archived_at is null;
    if v_count<>1 then raise exception 'FINANCE_PAYABLE_INSTRUMENT_ACCOUNT_NOT_UNIQUE'; end if;

    if v_next='PAID' then
      begin v_bank_id:=(p_command->>'bankAccountId')::uuid;
      exception when others then raise exception 'FINANCE_PAYABLE_INSTRUMENT_BANK_ACCOUNT_UUID_INVALID'; end;

      select ba.ledger_account_id,ba.currency into v_bank_ledger,v_bank_currency
      from public.bank_accounts ba
      where ba.id=v_bank_id and ba.tenant_id=v_tenant and ba.company_id=v_company
        and ba.branch_id=v_branch and ba.accounting_period_id=v_period
        and ba.is_active and ba.archived_at is null
      for update;
      if not found or v_bank_currency<>v_instrument.currency then
        raise exception 'FINANCE_PAYABLE_INSTRUMENT_BANK_ACCOUNT_SCOPE_OR_CURRENCY_INVALID';
      end if;

      v_tx:=v_operation::text;
      insert into public.finance_transactions(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        transaction_type,direction,payment_method,finance_account_id,counter_account_id,
        customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
        gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
        created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
      ) values (
        v_tx,v_tx,v_idem,v_tenant,v_company,v_branch,v_period,'TRANSFER','DEBIT','BANK_TRANSFER',
        v_instrument_payable_ledger::text,v_bank_ledger::text,
        null,null,v_instrument.counterparty_id,v_instrument.id::text,
        case when v_instrument.instrument_type='CHEQUE' then 'CHEQUE' else 'NOTE' end,
        v_instrument.amount,0,v_instrument.amount,v_instrument.currency,current_date,'POSTED',
        'Payable instrument bank settlement',p_actor_user_id,v_now,v_now,
        'MANUAL',v_operation::text,'SINGLE'
      );

      insert into public.finance_transaction_audits(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
      ) values (
        'audit:'||v_tx,v_tx,v_idem,v_tenant,v_company,v_branch,v_period,
        'POSTED',p_actor_user_id,null,null,v_instrument.counterparty_id,v_now,p_payload_hash
      );
      v_tx_ids:=array_append(v_tx_ids,v_tx);
    else
      select pm.movement_id into v_original_payable_movement_id
      from public.counterparty_payable_movements pm
      where pm.tenant_id=v_tenant and pm.company_id=v_company and pm.branch_id=v_branch
        and pm.accounting_period_id=v_period and pm.source_document_id=v_instrument.id::text
        and pm.movement_kind='PAYMENT'
      order by pm.created_at desc limit 1 for update;
      if not found then raise exception 'FINANCE_PAYABLE_INSTRUMENT_PAYMENT_MOVEMENT_NOT_FOUND'; end if;

      v_payable_movement_id:='instrument-payment-reversal:'||v_operation::text;
      insert into public.counterparty_payable_movements(
        movement_id,tenant_id,company_id,branch_id,accounting_period_id,idempotency_key,
        counterparty_customer_id,counterparty_type,movement_kind,amount,currency,
        occurred_at,recorded_at,source_document_id,operation_id,source_payment_id,
        reversal_of_movement_id,note,created_by_user_id
      )
      select v_payable_movement_id,v_tenant,v_company,v_branch,v_period,v_idem||':payable-reversal',
        pm.counterparty_customer_id,pm.counterparty_type,'REVERSAL',pm.amount,pm.currency,
        v_now,v_now,v_instrument.id::text,v_operation::text,v_instrument.id::text,pm.movement_id,
        'Issued instrument return/cancel reversal',p_actor_user_id
      from public.counterparty_payable_movements pm
      where pm.movement_id=v_original_payable_movement_id;

      insert into public.counterparty_payable_audits(
        movement_id,tenant_id,company_id,branch_id,accounting_period_id,actor_user_id,action,occurred_at,payload
      ) values (
        v_payable_movement_id,v_tenant,v_company,v_branch,v_period,p_actor_user_id,'CREATE',v_now,
        jsonb_build_object('instrumentId',v_instrument.id,'payloadHash',p_payload_hash,'reversal',true)
      );

      select * into v_original_payment from public.finance_transactions ft
      where ft.tenant_id=v_tenant and ft.company_id=v_company and ft.branch_id=v_branch
        and ft.accounting_period_id=v_period and ft.source_document_id=v_instrument.id::text
        and ft.source_document_type=case when v_instrument.instrument_type='CHEQUE' then 'CHEQUE' else 'NOTE' end
        and ft.transaction_type='PAYMENT'
      order by ft.created_at desc limit 1 for update;
      if not found or v_original_payment.status<>'POSTED' or v_original_payment.reversed_at is not null then
        raise exception 'FINANCE_PAYABLE_INSTRUMENT_ORIGINAL_PAYMENT_INVALID';
      end if;

      v_tx:=v_operation::text||':REV';
      insert into public.finance_transactions(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        transaction_type,direction,payment_method,finance_account_id,counter_account_id,
        customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
        gross_amount,commission_amount,net_amount,currency,transaction_date,value_date,due_date,
        status,description,external_reference,reversal_of_transaction_id,created_by,created_at,
        posted_at,projection_source,operation_group_id,operation_leg
      ) values (
        v_tx,v_tx,v_idem||':finance-reversal',v_tenant,v_company,v_branch,v_period,
        'REVERSAL',case when v_original_payment.direction='DEBIT' then 'CREDIT' else 'DEBIT' end,
        v_original_payment.payment_method,v_original_payment.finance_account_id,v_original_payment.counter_account_id,
        v_original_payment.customer_id,v_original_payment.sale_id,v_original_payment.counterparty_id,
        'REVERSAL:'||v_original_payment.transaction_id,'MANUAL',
        v_original_payment.gross_amount,v_original_payment.commission_amount,v_original_payment.net_amount,
        v_original_payment.currency,current_date,v_original_payment.value_date,v_original_payment.due_date,
        'POSTED',coalesce(nullif(trim(coalesce(p_command->>'reason','')),''),'Issued instrument reversal'),
        v_original_payment.transaction_id,v_original_payment.transaction_id,p_actor_user_id,v_now,v_now,
        'REVERSAL',v_operation::text,'REVERSAL_OUT'
      );

      insert into public.finance_transaction_audits(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
      ) values (
        'audit:'||v_tx,v_tx,v_idem||':finance-reversal',v_tenant,v_company,v_branch,v_period,
        'POSTED',p_actor_user_id,v_original_payment.customer_id,v_original_payment.sale_id,
        v_original_payment.counterparty_id,v_now,p_payload_hash
      );

      update public.finance_transactions
      set status='REVERSED',reversed_at=v_now
      where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
        and accounting_period_id=v_period and transaction_id=v_original_payment.transaction_id;

      v_tx_ids:=array_append(v_tx_ids,v_tx);
    end if;

    update public.finance_instruments_v1
    set state=v_next,updated_at=v_now
    where id=v_instrument.id;

    insert into public.finance_instrument_events_v1(
      id,instrument_id,tenant_id,company_id,branch_id,accounting_period_id,
      from_state,to_state,bank_account_id,counterparty_id,reason,
      actor_user_id,occurred_at,payload_hash
    ) values (
      gen_random_uuid(),v_instrument.id,v_tenant,v_company,v_branch,v_period,
      v_instrument.state,v_next,case when v_next='PAID' then v_bank_id else null end,
      v_instrument.counterparty_id,nullif(trim(coalesce(p_command->>'reason','')),''),
      p_actor_user_id,v_now,p_payload_hash
    );

    v_result:=jsonb_build_object(
      'transactionIds',to_jsonb(v_tx_ids),
      'instrumentId',v_instrument.id::text,
      'occurredAt',v_now
    );
    update public.finance_operation_requests_v1
    set outcome='CREATED',result_json=v_result,completed_at=v_now
    where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
      and accounting_period_id=v_period and idempotency_key=v_idem;

    return query select 'CREATED',v_operation::text,v_tx_ids,v_instrument.id::text,null::text,v_now;
    return;
  exception when others then
    update public.finance_operation_requests_v1
    set outcome='REJECT',
      result_json=jsonb_build_object('reason',case when sqlerrm~'^FINANCE_' then sqlerrm else 'FINANCE_PAYABLE_INSTRUMENT_TRANSITION_PERSISTENCE_FAILED' end),
      completed_at=clock_timestamp()
    where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
      and accounting_period_id=v_period and idempotency_key=v_idem;
    return query select 'REJECT',v_operation::text,array[]::text[],v_instrument_id::text,
      case when sqlerrm~'^FINANCE_' then sqlerrm else 'FINANCE_PAYABLE_INSTRUMENT_TRANSITION_PERSISTENCE_FAILED' end,
      clock_timestamp();
    return;
  end;
end;
$function$;

revoke all on function public.persist_finance_payable_instrument_v1(jsonb,text,text) from public,anon,authenticated;
grant execute on function public.persist_finance_payable_instrument_v1(jsonb,text,text) to service_role;
revoke all on function public.transition_finance_payable_instrument_v1(jsonb,text,text) from public,anon,authenticated;
grant execute on function public.transition_finance_payable_instrument_v1(jsonb,text,text) to service_role;

commit;