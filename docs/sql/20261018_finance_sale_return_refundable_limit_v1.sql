-- ENVERP FINANCE SALE RETURN REFUNDABLE LIMIT V1
-- SUCCESSOR: 20260813_finance_workflow_atomic_rpc_v1 üzerine eklenti
-- Mevcut migration DEĞİŞTİRİLMEZ; atomic workflow RPC içine eklenen kontrol
-- Live apply requires separate explicit approval.

begin;

-- Helper function: satış için iade edilebilir kalan tutarı hesapla
-- Scope + sale_id + currency bazında:
--   SALE_CHARGE (DEBIT, POSTED, not REVERSED) - REFUND (CREDIT, POSTED, not REVERSED, source_document_type=SALE_RETURN)
create or replace function public.calculate_remaining_refundable_v1(
  p_tenant text, p_company text, p_branch text, p_period text,
  p_sale_id text, p_currency text
) returns numeric(18,2)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_charge numeric(18,2);
  v_refund_total numeric(18,2);
begin
  -- Orijinal satış tutarı (SALE_CHARGE, DEBIT, POSTED, not REVERSED)
  select coalesce(sum(ft.net_amount), 0)::numeric(18,2)
  into v_sale_charge
  from public.finance_transactions ft
  where ft.tenant_id = p_tenant
    and ft.company_id = p_company
    and ft.branch_id = p_branch
    and ft.accounting_period_id = p_period
    and ft.sale_id = p_sale_id
    and ft.transaction_type = 'SALE_CHARGE'
    and ft.direction = 'DEBIT'
    and ft.status = 'POSTED'
    and ft.reversed_at is null
    and ft.currency = p_currency;

  -- Onaylanmış iadeler (REFUND, CREDIT, POSTED, not REVERSED, source_document_type=SALE_RETURN)
  select coalesce(sum(ft.net_amount), 0)::numeric(18,2)
  into v_refund_total
  from public.finance_transactions ft
  where ft.tenant_id = p_tenant
    and ft.company_id = p_company
    and ft.branch_id = p_branch
    and ft.accounting_period_id = p_period
    and ft.sale_id = p_sale_id
    and ft.transaction_type = 'REFUND'
    and ft.direction = 'CREDIT'
    and ft.source_document_type = 'SALE_RETURN'
    and ft.status = 'POSTED'
    and ft.reversed_at is null
    and ft.currency = p_currency;

  return greatest(v_sale_charge - v_refund_total, 0)::numeric(18,2);
end;
$$;

revoke all on function public.calculate_remaining_refundable_v1(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.calculate_remaining_refundable_v1(text,text,text,text,text,text) to service_role;

commit;