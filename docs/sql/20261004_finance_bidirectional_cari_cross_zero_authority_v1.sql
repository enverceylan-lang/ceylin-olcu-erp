-- ENVERP Finance - Bidirectional Cari Cross-Zero Authority V1
-- SUCCESSOR SOURCE. Historical migrations are intentionally not rewritten.
-- SOURCE ONLY. Live apply requires separate explicit approval.
--
-- Domain law:
--   Real incoming/outgoing movement is recorded even when cari balance crosses zero.
--   Scope, idempotency, reversal, audit, source identity and channel integrity remain fail-closed.
--   Cheque/note nominal integrity is NOT removed by this successor.

begin;

-- CUSTOMER CASH/BANK outgoing payment may cross zero.
create or replace function public.persist_finance_counterparty_payment_v1(
  p_operation jsonb,
  p_movement jsonb,
  p_audit jsonb,
  p_actor_user_id text,
  p_payload_hash text
)
returns table(
  outcome text,
  operation_id text,
  transaction_ids text[],
  movement_id text,
  reason text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_tenant text := nullif(btrim(coalesce(p_operation->>'tenantId','')), '');
  v_company text := nullif(btrim(coalesce(p_operation->>'companyId','')), '');
  v_branch text := nullif(btrim(coalesce(p_operation->>'branchId','')), '');
  v_period text := nullif(btrim(coalesce(p_operation->>'accountingPeriodId','')), '');
  v_operation_id text := nullif(btrim(coalesce(p_operation->>'operationId','')), '');
  v_idem text := nullif(btrim(coalesce(p_operation->>'idempotencyKey','')), '');
  v_channel text := nullif(btrim(coalesce(p_operation->>'channel','')), '');
  v_kind text := nullif(btrim(coalesce(p_operation->>'kind','')), '');
  v_action text := nullif(btrim(coalesce(p_operation->>'action','')), '');
  v_currency text := upper(btrim(coalesce(p_operation->>'currency','')));
  v_amount numeric(18,2) := nullif(p_operation->>'amount','')::numeric(18,2);
  v_counterparty text := nullif(btrim(coalesce(p_operation#>>'{source,counterpartyId}','')), '');
  v_source_document text := nullif(btrim(coalesce(p_operation#>>'{source,sourceDocumentId}','')), '');

  v_movement_id text := nullif(btrim(coalesce(p_movement->>'movementId','')), '');
  v_movement_idem text := nullif(btrim(coalesce(p_movement->>'idempotencyKey','')), '');
  v_movement_counterparty text := nullif(btrim(coalesce(p_movement->>'counterpartyCustomerId','')), '');
  v_movement_type text := nullif(btrim(coalesce(p_movement->>'counterpartyType','')), '');
  v_movement_kind text := nullif(btrim(coalesce(p_movement->>'kind','')), '');
  v_movement_currency text := upper(btrim(coalesce(p_movement->>'currency','')));
  v_movement_amount numeric(18,2) := nullif(p_movement->>'amount','')::numeric(18,2);
  v_movement_source_document text := nullif(btrim(coalesce(p_movement->>'sourceDocumentId','')), '');
  v_movement_operation text := nullif(btrim(coalesce(p_movement->>'operationId','')), '');
  v_source_payment text := nullif(btrim(coalesce(p_movement->>'sourcePaymentId','')), '');

  v_control_code text;
  v_control_id uuid;
  v_control_count integer;
  v_customer_payable_balance numeric(18,2);

  v_operation jsonb;

  v_finance_outcome text;
  v_finance_operation_id text;
  v_finance_transaction_ids text[];
  v_finance_reason text;

  v_payable_outcome text;
  v_payable_movement_id text;
  v_payable_reason text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_SERVICE_ROLE_REQUIRED';
  end if;

  if p_operation is null
     or jsonb_typeof(p_operation) <> 'object'
     or p_movement is null
     or jsonb_typeof(p_movement) <> 'object'
     or p_audit is null
     or jsonb_typeof(p_audit) <> 'object' then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_PAYLOAD_REQUIRED';
  end if;

  if v_tenant is null
     or v_company is null
     or v_branch is null
     or v_period is null
     or v_operation_id is null
     or v_idem is null
     or v_counterparty is null
     or v_source_document is null
     or v_currency !~ '^[A-Z]{3}$'
     or v_amount is null
     or v_amount <= 0 then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_OPERATION_INVALID';
  end if;

  if v_kind <> 'PAYMENT'
     or v_action <> 'CREATE'
     or v_channel not in ('CASH','BANK') then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_KIND_CHANNEL_FORBIDDEN';
  end if;

  if v_movement_id is null
     or v_movement_idem is null
     or v_movement_counterparty is null
     or v_movement_type not in ('CUSTOMER','SUPPLIER','TAILOR','INSTALLER')
     or v_movement_kind <> 'PAYMENT'
     or v_movement_currency !~ '^[A-Z]{3}$'
     or v_movement_amount is null
     or v_movement_amount <= 0
     or v_movement_source_document is null
     or v_movement_operation is null
     or v_source_payment is null then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_MOVEMENT_INVALID';
  end if;

  if v_movement_type = 'CUSTOMER' then
    with effective_payable as (
      select pm.movement_kind, pm.amount
      from public.counterparty_payable_movements pm
      where pm.tenant_id = v_tenant
        and pm.company_id = v_company
        and pm.branch_id = v_branch
        and pm.accounting_period_id = v_period
        and pm.counterparty_customer_id = v_movement_counterparty
        and pm.counterparty_type = 'CUSTOMER'
        and pm.currency = v_movement_currency
        and pm.movement_kind in ('ACCRUAL','PAYMENT')
        and not exists (
          select 1
          from public.counterparty_payable_movements r
          where r.tenant_id = pm.tenant_id
            and r.company_id = pm.company_id
            and r.branch_id = pm.branch_id
            and r.accounting_period_id = pm.accounting_period_id
            and r.movement_kind = 'REVERSAL'
            and r.reversal_of_movement_id = pm.movement_id
        )
    )
    select coalesce(sum(
      case
        when movement_kind = 'ACCRUAL' then amount
        when movement_kind = 'PAYMENT' then -amount
        else 0
      end
    ), 0)::numeric(18,2)
    into v_customer_payable_balance
    from effective_payable;

  end if;

  if nullif(btrim(coalesce(p_actor_user_id,'')), '') is null
     or nullif(btrim(coalesce(p_payload_hash,'')), '') is null
     or nullif(btrim(coalesce(p_audit->>'actorUserId','')), '') is distinct from
        nullif(btrim(coalesce(p_actor_user_id,'')), '') then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_AUDIT_INVALID';
  end if;

  if nullif(btrim(coalesce(p_movement->>'tenantId','')), '') is distinct from v_tenant
     or nullif(btrim(coalesce(p_movement->>'companyId','')), '') is distinct from v_company
     or nullif(btrim(coalesce(p_movement->>'branchId','')), '') is distinct from v_branch
     or nullif(btrim(coalesce(p_movement->>'accountingPeriodId','')), '') is distinct from v_period
     or v_movement_counterparty is distinct from v_counterparty
     or v_movement_currency is distinct from v_currency
     or v_movement_amount is distinct from v_amount
     or v_movement_source_document is distinct from v_source_document
     or v_movement_operation is distinct from v_operation_id
     or v_source_payment is distinct from v_operation_id
     or v_movement_id is distinct from (v_operation_id || ':PAYABLE')
     or v_movement_idem is distinct from (v_idem || ':PAYABLE') then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_CROSS_AUTHORITY_MISMATCH';
  end if;

  -- Dedicated scoped control account. Existing account taxonomy already permits
  -- CLEARING. This does not represent a user cash/bank account and carries no
  -- mutable balance column; balances remain derived from posted movements.
  v_control_code := 'SYS-COUNTERPARTY-PAYABLE-' || v_currency;
  v_control_id := md5(
    v_tenant || '|' ||
    v_company || '|' ||
    v_branch || '|' ||
    v_period || '|' ||
    v_control_code
  )::uuid;

  insert into public.finance_accounts (
    id,
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    code,
    name,
    account_type,
    currency,
    is_active,
    is_default_collection,
    is_default_payment,
    created_by,
    updated_by
  )
  values (
    v_control_id,
    v_tenant,
    v_company,
    v_branch,
    v_period,
    v_control_code,
    'Counterparty Payable Control',
    'CLEARING',
    v_currency,
    true,
    false,
    false,
    p_actor_user_id,
    p_actor_user_id
  )
  on conflict (
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    code
  )
  do nothing;

  select count(*), min(fa.id)
    into v_control_count, v_control_id
  from public.finance_accounts fa
  where fa.tenant_id = v_tenant
    and fa.company_id = v_company
    and fa.branch_id = v_branch
    and fa.accounting_period_id = v_period
    and fa.code = v_control_code
    and fa.account_type = 'CLEARING'
    and fa.currency = v_currency
    and fa.is_active = true
    and fa.archived_at is null;

  if v_control_count <> 1 or v_control_id is null then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_CONTROL_ACCOUNT_INVALID';
  end if;

  v_operation := jsonb_set(
    p_operation,
    '{accounts,counterAccountId}',
    to_jsonb(v_control_id::text),
    true
  );

  select
    f.outcome,
    f.operation_id,
    f.transaction_ids,
    f.reason
  into
    v_finance_outcome,
    v_finance_operation_id,
    v_finance_transaction_ids,
    v_finance_reason
  from public.persist_finance_operation_v1(
    v_operation,
    p_actor_user_id,
    p_payload_hash
  ) f;

  if v_finance_outcome in ('REJECT','CONFLICT') then
    return query
    select
      v_finance_outcome,
      v_finance_operation_id,
      v_finance_transaction_ids,
      null::text,
      v_finance_reason;
    return;
  end if;

  if v_finance_outcome not in ('CREATED','REPLAY') then
    raise exception
      'FINANCE_COUNTERPARTY_PAYMENT_FINANCE_OUTCOME_INVALID:%',
      v_finance_outcome;
  end if;

  select
    p.outcome,
    p.movement_id,
    p.reason
  into
    v_payable_outcome,
    v_payable_movement_id,
    v_payable_reason
  from public.persist_counterparty_payable_movement_v1(
    p_movement,
    p_audit
  ) p;

  if v_payable_outcome not in ('CREATED','REPLAY') then
    -- Critical: exception, not a normal return. If the finance ledger was
    -- created in this invocation, PostgreSQL rolls it back with this function.
    raise exception
      'FINANCE_COUNTERPARTY_PAYMENT_PAYABLE_FAILED:%:%',
      coalesce(v_payable_outcome,'NULL'),
      coalesce(v_payable_reason,'NULL');
  end if;

  if v_finance_outcome is distinct from v_payable_outcome then
    -- Fail closed on split historical/replay state. Never silently heal one
    -- authority while the other authority is already in a different state.
    raise exception
      'FINANCE_COUNTERPARTY_PAYMENT_OUTCOME_MISMATCH:FINANCE=%:PAYABLE=%',
      v_finance_outcome,
      v_payable_outcome;
  end if;

  if v_finance_operation_id is distinct from v_operation_id
     or v_payable_movement_id is distinct from v_movement_id then
    raise exception 'FINANCE_COUNTERPARTY_PAYMENT_IDENTITY_MISMATCH';
  end if;

  return query
  select
    v_finance_outcome,
    v_finance_operation_id,
    v_finance_transaction_ids,
    v_payable_movement_id,
    null::text;
end;
$function$;

-- PAYABLE CHEQUE/NOTE issue may cross zero.
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

-- RECEIVABLE CHEQUE/NOTE endorsement to counterparty may cross zero.
create or replace function public.transition_finance_receivable_instrument_v1(
  p_command jsonb,p_actor_user_id text,p_payload_hash text
)
returns table(outcome text,operation_id text,transaction_ids text[],instrument_id text,reason text,occurred_at timestamptz)
language plpgsql
security definer
set search_path=pg_catalog,public
as $function$
declare
  v_tenant text:=trim(coalesce(p_command->>'tenantId',''));
  v_company text:=trim(coalesce(p_command->>'companyId',''));
  v_branch text:=trim(coalesce(p_command->>'branchId',''));
  v_period text:=trim(coalesce(p_command->>'accountingPeriodId',''));
  v_operation uuid;
  v_instrument_id uuid;
  v_bank_id uuid;
  v_deposit_bank_id uuid;
  v_idem text:=trim(coalesce(p_command->>'idempotencyKey',''));
  v_next text:=trim(coalesce(p_command->>'toState',''));
  v_claimed_from text:=trim(coalesce(p_command->>'fromState',''));
  v_type text:=trim(coalesce(p_command->>'instrumentType',''));
  v_reason_text text:=nullif(trim(coalesce(p_command->>'reason','')),'');
  v_counterparty text:=nullif(trim(coalesce(p_command->>'counterpartyId','')),'');
  v_counterparty_type text:=nullif(trim(coalesce(p_command->>'counterpartyType','')),'');
  v_now timestamptz:=clock_timestamp();
  v_existing public.finance_operation_requests_v1%rowtype;
  v_instrument public.finance_instruments_v1%rowtype;
  v_instrument_allocation public.finance_instrument_allocations_v1%rowtype;
  v_bank_ledger uuid;
  v_receivable_ledger uuid;
  v_portfolio_ledger uuid;
  v_collection_ledger uuid;
  v_payable_ledger uuid;
  v_bank_currency text;
  v_bank_name text;
  v_receivable_count integer;
  v_payable_balance numeric;
  v_payable_movement_id text;
  v_original_payable_movement_id text;
  v_allocation_sum numeric;
  v_tx text;
  v_transaction_ids text[]:=array[]::text[];
  v_error text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'FINANCE_INSTRUMENT_SERVICE_ROLE_REQUIRED'; end if;
  begin
    v_operation:=(p_command->>'operationId')::uuid;
    v_instrument_id:=(p_command->>'instrumentId')::uuid;
  exception when others then
    return query select 'REJECT',null::text,array[]::text[],null::text,'FINANCE_INSTRUMENT_TRANSITION_UUID_INVALID',v_now;
    return;
  end;
  if v_tenant='' or v_company='' or v_branch='' or v_period='' or v_idem='' or
     v_claimed_from not in ('PORTFOLIO','DEPOSITED','ENDORSED') or
     v_next not in ('DEPOSITED','ENDORSED','COLLECTED','RETURNED','CANCELLED') or v_type not in ('CHEQUE','NOTE') or
     trim(coalesce(p_actor_user_id,''))='' or trim(coalesce(p_payload_hash,''))='' then
    return query select 'REJECT',v_operation::text,array[]::text[],v_instrument_id::text,'FINANCE_INSTRUMENT_TRANSITION_REQUIRED_FIELD_INVALID',v_now;
    return;
  end if;

  insert into public.finance_operation_requests_v1(
    tenant_id,company_id,branch_id,accounting_period_id,idempotency_key,payload_hash,
    operation_id,outcome,actor_user_id
  ) values (v_tenant,v_company,v_branch,v_period,v_idem,p_payload_hash,v_operation::text,'PENDING',p_actor_user_id)
  on conflict do nothing;
  if not found then
    select * into v_existing from public.finance_operation_requests_v1 r
    where r.tenant_id=v_tenant and r.company_id=v_company and r.branch_id=v_branch
      and r.accounting_period_id=v_period and r.idempotency_key=v_idem for update;
    if v_existing.payload_hash is distinct from p_payload_hash then
      return query select 'CONFLICT',v_existing.operation_id,array[]::text[],v_instrument_id::text,'IDEMPOTENCY_PAYLOAD_CONFLICT',v_now;
    elsif v_existing.outcome='CREATED' then
      return query select 'REPLAY',v_existing.operation_id,
        coalesce(array(select jsonb_array_elements_text(v_existing.result_json->'transactionIds')),array[]::text[]),
        v_instrument_id::text,null::text,(v_existing.result_json->>'occurredAt')::timestamptz;
    elsif v_existing.outcome='REJECT' then
      return query select 'REJECT',v_existing.operation_id,array[]::text[],v_instrument_id::text,
        v_existing.result_json->>'reason',v_existing.completed_at;
    else
      return query select 'CONFLICT',v_existing.operation_id,array[]::text[],v_instrument_id::text,'FINANCE_INSTRUMENT_PENDING_CONFLICT',v_now;
    end if;
    return;
  end if;

  begin
    select * into v_instrument from public.finance_instruments_v1 i
    where i.id=v_instrument_id and i.tenant_id=v_tenant and i.company_id=v_company
      and i.branch_id=v_branch and i.accounting_period_id=v_period and i.direction='RECEIVABLE'
    for update;
    if not found then raise exception 'FINANCE_INSTRUMENT_NOT_FOUND'; end if;
    if v_instrument.instrument_type<>v_type then raise exception 'FINANCE_INSTRUMENT_TYPE_MISMATCH'; end if;
    if v_instrument.state<>v_claimed_from then raise exception 'FINANCE_INSTRUMENT_FROM_STATE_MISMATCH'; end if;
    if not (
      (v_instrument.state='PORTFOLIO' and v_next in ('DEPOSITED','ENDORSED','RETURNED','CANCELLED')) or
      (v_instrument.state='DEPOSITED' and v_next in ('COLLECTED','RETURNED')) or
      (v_instrument.state='ENDORSED' and v_next='RETURNED')
    ) then raise exception 'FINANCE_INSTRUMENT_STATE_TRANSITION_DENIED'; end if;
    if v_next in ('RETURNED','CANCELLED') and v_reason_text is null then
      raise exception 'FINANCE_INSTRUMENT_TRANSITION_REASON_REQUIRED';
    end if;
    if v_next='ENDORSED' and (v_counterparty is null or
       v_counterparty_type not in ('SUPPLIER','TAILOR','INSTALLER')) then
      raise exception 'FINANCE_INSTRUMENT_ENDORSE_COUNTERPARTY_REQUIRED';
    end if;

    if v_next in ('DEPOSITED','COLLECTED') or (v_next='RETURNED' and v_instrument.state='DEPOSITED') then
      begin v_bank_id:=(p_command->>'bankAccountId')::uuid;
      exception when others then raise exception 'FINANCE_INSTRUMENT_BANK_ACCOUNT_UUID_REQUIRED'; end;
      select ba.ledger_account_id,ba.currency,ba.bank_name into v_bank_ledger,v_bank_currency,v_bank_name
      from public.bank_accounts ba where ba.id=v_bank_id and ba.tenant_id=v_tenant and ba.company_id=v_company
        and ba.branch_id=v_branch and ba.accounting_period_id=v_period and ba.is_active and ba.archived_at is null
      for update;
      if not found or v_bank_currency<>v_instrument.currency then
        raise exception 'FINANCE_INSTRUMENT_BANK_SCOPE_OR_CURRENCY_INVALID';
      end if;
      if v_next='COLLECTED' then
        select e.bank_account_id into v_deposit_bank_id
        from public.finance_instrument_events_v1 e
        where e.instrument_id=v_instrument_id and e.tenant_id=v_tenant and e.company_id=v_company
          and e.branch_id=v_branch and e.accounting_period_id=v_period and e.to_state='DEPOSITED'
        order by e.occurred_at desc,e.id desc limit 1;
        if v_deposit_bank_id is null or v_deposit_bank_id<>v_bank_id then
          raise exception 'FINANCE_INSTRUMENT_COLLECTION_BANK_MISMATCH';
        end if;
      end if;
    end if;

    select count(*),(array_agg(fa.id order by fa.id::text))[1] into v_receivable_count,v_portfolio_ledger
    from public.finance_accounts fa where fa.tenant_id=v_tenant and fa.company_id=v_company
      and fa.branch_id=v_branch and fa.accounting_period_id=v_period and fa.currency=v_instrument.currency
      and fa.account_type=case when v_type='CHEQUE' then 'CHEQUE_RECEIVABLE' else 'NOTE_RECEIVABLE' end
      and fa.is_active and fa.archived_at is null;
    if v_receivable_count<>1 then raise exception 'FINANCE_INSTRUMENT_PORTFOLIO_ACCOUNT_NOT_UNIQUE'; end if;
    select coalesce(sum(ia.amount),0) into v_allocation_sum
    from public.finance_instrument_allocations_v1 ia
    where ia.instrument_id=v_instrument_id and ia.tenant_id=v_tenant and ia.company_id=v_company
      and ia.branch_id=v_branch and ia.accounting_period_id=v_period and ia.state='ALLOCATED';
    if v_allocation_sum is distinct from v_instrument.amount then
      raise exception 'FINANCE_INSTRUMENT_NOMINAL_ALLOCATION_MISMATCH';
    end if;

    if v_next in ('DEPOSITED','COLLECTED') then
      select count(*),(array_agg(fa.id order by fa.id::text))[1] into v_receivable_count,v_collection_ledger
      from public.finance_accounts fa where fa.tenant_id=v_tenant and fa.company_id=v_company
        and fa.branch_id=v_branch and fa.accounting_period_id=v_period and fa.currency=v_instrument.currency
        and fa.account_type=case when v_type='CHEQUE' then 'CHEQUE_IN_COLLECTION' else 'NOTE_IN_COLLECTION' end
        and fa.is_active and fa.archived_at is null;
      if v_receivable_count<>1 then raise exception 'FINANCE_INSTRUMENT_COLLECTION_ACCOUNT_NOT_UNIQUE'; end if;
    end if;

    if v_next='DEPOSITED' then
      v_tx:=v_operation::text;
      insert into public.finance_transactions(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        transaction_type,direction,payment_method,finance_account_id,counter_account_id,
        customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
        gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
        created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
      ) values (v_tx,v_tx,v_idem,v_tenant,v_company,v_branch,v_period,'TRANSFER','DEBIT',
        case when v_type='CHEQUE' then 'CHEQUE' else 'PROMISSORY_NOTE' end,
        v_collection_ledger::text,v_portfolio_ledger::text,v_instrument.customer_id,null,null,
        v_instrument.id::text,case when v_type='CHEQUE' then 'CHEQUE' else 'NOTE' end,
        v_instrument.amount,0,v_instrument.amount,v_instrument.currency,current_date,'POSTED',
        v_bank_name||' – tahsile verilen '||case when v_type='CHEQUE' then 'çek' else 'senet' end,
        p_actor_user_id,v_now,v_now,'MANUAL',v_operation::text,'OUT');
      insert into public.finance_transaction_audits(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
      ) values ('audit:'||v_tx,v_tx,v_idem,v_tenant,v_company,v_branch,v_period,'POSTED',
        p_actor_user_id,v_instrument.customer_id,null,null,v_now,p_payload_hash);
      v_transaction_ids:=array_append(v_transaction_ids,v_tx);
    end if;

    if v_next='COLLECTED' then
      v_tx:=v_operation::text;
      insert into public.finance_transactions(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        transaction_type,direction,payment_method,finance_account_id,counter_account_id,
        customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
        gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
        created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
      ) values (
        v_tx,v_tx,v_idem,v_tenant,v_company,v_branch,v_period,'TRANSFER','DEBIT',
        case when v_instrument.instrument_type='CHEQUE' then 'CHEQUE' else 'PROMISSORY_NOTE' end,
        v_bank_ledger::text,v_collection_ledger::text,v_instrument.customer_id,null,null,
        v_instrument.id::text,case when v_instrument.instrument_type='CHEQUE' then 'CHEQUE' else 'NOTE' end,
        v_instrument.amount,0,v_instrument.amount,v_instrument.currency,current_date,'POSTED',
        v_bank_name||' – '||case when v_instrument.instrument_type='CHEQUE' then 'çek tahsilatı' else 'senet tahsilatı' end,
        p_actor_user_id,v_now,v_now,'TRANSFER',v_operation::text,'IN'
      );
      insert into public.finance_transaction_audits(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
      ) values ('audit:'||v_tx,v_tx,v_idem,v_tenant,v_company,v_branch,v_period,'POSTED',
        p_actor_user_id,v_instrument.customer_id,null,null,v_now,p_payload_hash);

      v_transaction_ids:=array_append(v_transaction_ids,v_tx);
    elsif v_next='ENDORSED' then
      perform 1 from public.counterparty_payable_movements pm
      where pm.tenant_id=v_tenant and pm.company_id=v_company and pm.branch_id=v_branch
        and pm.accounting_period_id=v_period and pm.counterparty_customer_id=v_counterparty
        and pm.counterparty_type=v_counterparty_type and pm.currency=v_instrument.currency
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
        and pm.counterparty_type=v_counterparty_type and pm.currency=v_instrument.currency;
      select count(*),(array_agg(fa.id order by fa.id::text))[1] into v_receivable_count,v_payable_ledger
      from public.finance_accounts fa where fa.tenant_id=v_tenant and fa.company_id=v_company
        and fa.branch_id=v_branch and fa.accounting_period_id=v_period and fa.currency=v_instrument.currency
        and fa.account_type='CUSTOMER_PAYABLE' and fa.is_active and fa.archived_at is null;
      if v_receivable_count<>1 then raise exception 'FINANCE_COUNTERPARTY_PAYABLE_ACCOUNT_NOT_UNIQUE'; end if;
      v_payable_movement_id:='instrument-payment:'||v_operation::text;
      insert into public.counterparty_payable_movements(
        movement_id,tenant_id,company_id,branch_id,accounting_period_id,idempotency_key,
        counterparty_customer_id,counterparty_type,movement_kind,amount,currency,
        occurred_at,recorded_at,source_document_id,operation_id,source_payment_id,note,created_by_user_id
      ) values (v_payable_movement_id,v_tenant,v_company,v_branch,v_period,v_idem||':payable',
        v_counterparty,v_counterparty_type,'PAYMENT',v_instrument.amount,v_instrument.currency,
        v_now,v_now,v_instrument.id::text,v_operation::text,v_instrument.id::text,
        'Ciro edilen '||case when v_type='CHEQUE' then 'çek' else 'senet' end,p_actor_user_id);
      insert into public.counterparty_payable_audits(
        movement_id,tenant_id,company_id,branch_id,accounting_period_id,actor_user_id,action,occurred_at,payload
      ) values (v_payable_movement_id,v_tenant,v_company,v_branch,v_period,p_actor_user_id,'CREATE',v_now,
        jsonb_build_object('instrumentId',v_instrument.id,'payloadHash',p_payload_hash));
      v_tx:=v_operation::text;
      insert into public.finance_transactions(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        transaction_type,direction,payment_method,finance_account_id,counter_account_id,
        customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
        gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
        created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
      ) values (v_tx,v_tx,v_idem,v_tenant,v_company,v_branch,v_period,'PAYMENT','DEBIT',
        case when v_type='CHEQUE' then 'CHEQUE' else 'PROMISSORY_NOTE' end,
        v_payable_ledger::text,v_portfolio_ledger::text,null,null,v_counterparty,v_instrument.id::text,
        case when v_type='CHEQUE' then 'CHEQUE' else 'NOTE' end,v_instrument.amount,0,v_instrument.amount,
        v_instrument.currency,current_date,'POSTED','Ciro ile borç kapama',p_actor_user_id,v_now,v_now,
        'MANUAL',v_operation::text,'SINGLE');
      insert into public.finance_transaction_audits(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
      ) values ('audit:'||v_tx,v_tx,v_idem,v_tenant,v_company,v_branch,v_period,'POSTED',
        p_actor_user_id,null,null,v_counterparty,v_now,p_payload_hash);
      v_transaction_ids:=array_append(v_transaction_ids,v_tx);
    elsif v_next in ('RETURNED','CANCELLED') then
      select count(*),(array_agg(fa.id order by fa.id::text))[1] into v_receivable_count,v_receivable_ledger
      from public.finance_accounts fa where fa.tenant_id=v_tenant and fa.company_id=v_company
        and fa.branch_id=v_branch and fa.accounting_period_id=v_period and fa.currency=v_instrument.currency
        and fa.account_type='CUSTOMER_RECEIVABLE' and fa.is_active and fa.archived_at is null;
      if v_receivable_count<>1 then raise exception 'FINANCE_CUSTOMER_RECEIVABLE_ACCOUNT_NOT_UNIQUE'; end if;
      if v_instrument.state='ENDORSED' then
        select count(*),(array_agg(fa.id order by fa.id::text))[1] into v_receivable_count,v_payable_ledger
        from public.finance_accounts fa where fa.tenant_id=v_tenant and fa.company_id=v_company
          and fa.branch_id=v_branch and fa.accounting_period_id=v_period and fa.currency=v_instrument.currency
          and fa.account_type='CUSTOMER_PAYABLE' and fa.is_active and fa.archived_at is null;
        if v_receivable_count<>1 then raise exception 'FINANCE_COUNTERPARTY_PAYABLE_ACCOUNT_NOT_UNIQUE'; end if;
        select pm.movement_id into v_original_payable_movement_id
        from public.counterparty_payable_movements pm
        where pm.tenant_id=v_tenant and pm.company_id=v_company and pm.branch_id=v_branch
          and pm.accounting_period_id=v_period and pm.source_document_id=v_instrument.id::text
          and pm.movement_kind='PAYMENT'
        order by pm.created_at desc limit 1 for update;
        if not found then raise exception 'FINANCE_INSTRUMENT_ENDORSE_PAYMENT_NOT_FOUND'; end if;
        v_payable_movement_id:='instrument-payment-reversal:'||v_operation::text;
        insert into public.counterparty_payable_movements(
          movement_id,tenant_id,company_id,branch_id,accounting_period_id,idempotency_key,
          counterparty_customer_id,counterparty_type,movement_kind,amount,currency,
          occurred_at,recorded_at,source_document_id,operation_id,source_payment_id,
          reversal_of_movement_id,note,created_by_user_id
        ) select v_payable_movement_id,v_tenant,v_company,v_branch,v_period,v_idem||':payable-reversal',
          pm.counterparty_customer_id,pm.counterparty_type,'REVERSAL',pm.amount,pm.currency,
          v_now,v_now,v_instrument.id::text,v_operation::text,v_instrument.id::text,pm.movement_id,
          'Ciro edilen evrak iade/karşılıksız ters kaydı',p_actor_user_id
        from public.counterparty_payable_movements pm where pm.movement_id=v_original_payable_movement_id;
        insert into public.counterparty_payable_audits(
          movement_id,tenant_id,company_id,branch_id,accounting_period_id,actor_user_id,action,occurred_at,payload
        ) values (v_payable_movement_id,v_tenant,v_company,v_branch,v_period,p_actor_user_id,'CREATE',v_now,
          jsonb_build_object('instrumentId',v_instrument.id,'payloadHash',p_payload_hash,'reversal',true));

        v_tx:=v_operation::text||':endorse-reversal';
        insert into public.finance_transactions(
          id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
          transaction_type,direction,payment_method,finance_account_id,counter_account_id,
          customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
          gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
          created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
        ) values (v_tx,v_tx,v_idem||':endorse-reversal',v_tenant,v_company,v_branch,v_period,'REVERSAL','DEBIT',
          case when v_type='CHEQUE' then 'CHEQUE' else 'PROMISSORY_NOTE' end,
          v_portfolio_ledger::text,v_payable_ledger::text,null,null,v_instrument.counterparty_id,
          v_instrument.id::text,case when v_type='CHEQUE' then 'CHEQUE' else 'NOTE' end,
          v_instrument.amount,0,v_instrument.amount,v_instrument.currency,current_date,'POSTED',
          'Ciro iade/karşılıksız ters kaydı',p_actor_user_id,v_now,v_now,'REVERSAL',v_operation::text,'REVERSAL_OUT');
        insert into public.finance_transaction_audits(
          id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
          action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
        ) values ('audit:'||v_tx,v_tx,v_idem||':endorse-reversal',v_tenant,v_company,v_branch,v_period,
          'POSTED',p_actor_user_id,null,null,v_instrument.counterparty_id,v_now,p_payload_hash);
        v_transaction_ids:=array_append(v_transaction_ids,v_tx);
      end if;
      for v_instrument_allocation in
        select ia.* from public.finance_instrument_allocations_v1 ia
        where ia.instrument_id=v_instrument_id and ia.tenant_id=v_tenant and ia.company_id=v_company
          and ia.branch_id=v_branch and ia.accounting_period_id=v_period and ia.state='ALLOCATED'
        order by ia.open_item_id for update
      loop
        update public.finance_receivable_open_items_v1 oi set
          allocated_amount=oi.allocated_amount-v_instrument_allocation.amount,
          status=case when oi.allocated_amount-v_instrument_allocation.amount=0 and oi.reserved_amount=0
            then 'OPEN' else 'PARTIAL' end,updated_at=v_now
        where oi.id=v_instrument_allocation.open_item_id and oi.allocated_amount>=v_instrument_allocation.amount;
        if not found then raise exception 'FINANCE_INSTRUMENT_RELEASE_CONFLICT'; end if;
        update public.finance_instrument_allocations_v1 set state='RELEASED',updated_at=v_now
        where id=v_instrument_allocation.id;
        update public.finance_collection_allocations_v1 ca set reversed_at=v_now
        where ca.open_item_id=v_instrument_allocation.open_item_id and ca.reversed_at is null
          and ca.transaction_id in (
            select ft.transaction_id from public.finance_transactions ft
            where ft.tenant_id=v_tenant and ft.company_id=v_company and ft.branch_id=v_branch
              and ft.accounting_period_id=v_period and ft.source_document_id=v_instrument.id::text
              and ft.transaction_type='COLLECTION'
          );
      end loop;
      v_tx:=v_operation::text||':customer-return';
      insert into public.finance_transactions(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        transaction_type,direction,payment_method,finance_account_id,counter_account_id,
        customer_id,sale_id,counterparty_id,source_document_id,source_document_type,
        gross_amount,commission_amount,net_amount,currency,transaction_date,status,description,
        created_by,created_at,posted_at,projection_source,operation_group_id,operation_leg
      ) values (v_tx,v_tx,v_idem||':customer-return',v_tenant,v_company,v_branch,v_period,'REVERSAL','DEBIT',
        case when v_type='CHEQUE' then 'CHEQUE' else 'PROMISSORY_NOTE' end,
        v_receivable_ledger::text,
        case when v_instrument.state='DEPOSITED' then v_collection_ledger::text else v_portfolio_ledger::text end,
        v_instrument.customer_id,null,v_instrument.counterparty_id,v_instrument.id::text,
        case when v_type='CHEQUE' then 'CHEQUE' else 'NOTE' end,v_instrument.amount,0,v_instrument.amount,
        v_instrument.currency,current_date,'POSTED',coalesce(v_reason_text,'Evrak iade/iptal ters kaydı'),
        p_actor_user_id,v_now,v_now,'MANUAL',v_operation::text,'REVERSAL_IN');
      insert into public.finance_transaction_audits(
        id,transaction_id,idempotency_key,tenant_id,company_id,branch_id,accounting_period_id,
        action,actor_user_id,customer_id,sale_id,counterparty_id,occurred_at,payload_hash
      ) values ('audit:'||v_tx,v_tx,v_idem||':customer-return',v_tenant,v_company,v_branch,v_period,
        'POSTED',p_actor_user_id,v_instrument.customer_id,null,v_instrument.counterparty_id,v_now,p_payload_hash);
      v_transaction_ids:=array_append(v_transaction_ids,v_tx);
    end if;

    update public.finance_instruments_v1 set state=v_next,
      counterparty_id=case when v_next='ENDORSED' then v_counterparty else counterparty_id end,
      updated_at=v_now where id=v_instrument_id;
    insert into public.finance_instrument_events_v1(
      id,instrument_id,tenant_id,company_id,branch_id,accounting_period_id,from_state,to_state,
      bank_account_id,counterparty_id,reason,actor_user_id,occurred_at,payload_hash
    ) values (gen_random_uuid(),v_instrument_id,v_tenant,v_company,v_branch,v_period,
      v_instrument.state,v_next,v_bank_id,v_counterparty,v_reason_text,p_actor_user_id,v_now,p_payload_hash);
    update public.finance_operation_requests_v1 set outcome='CREATED',
      result_json=jsonb_build_object('transactionIds',to_jsonb(v_transaction_ids),'instrumentId',v_instrument_id::text,'occurredAt',v_now),
      completed_at=v_now
    where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
      and accounting_period_id=v_period and idempotency_key=v_idem;
    return query select 'CREATED',v_operation::text,v_transaction_ids,v_instrument_id::text,null::text,v_now;
    return;
  exception when others then
    v_error:=case when sqlerrm ~ '^FINANCE_' then sqlerrm else 'FINANCE_INSTRUMENT_TRANSITION_PERSISTENCE_FAILED' end;
    update public.finance_operation_requests_v1 set outcome='REJECT',
      result_json=jsonb_build_object('reason',v_error),completed_at=clock_timestamp()
    where tenant_id=v_tenant and company_id=v_company and branch_id=v_branch
      and accounting_period_id=v_period and idempotency_key=v_idem;
    return query select 'REJECT',v_operation::text,array[]::text[],v_instrument_id::text,v_error,clock_timestamp();
    return;
  end;
end;
$function$;

commit;
