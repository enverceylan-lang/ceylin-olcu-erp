-- ENVerp Media Target Authority Scoped Event V1
-- SOURCE ONLY.
-- DO NOT RUN ON LIVE DB WITHOUT EXPLICIT LIVE SQL APPROVAL.
--
-- Goal:
-- CUSTOMER / ROOM / OPENING media targets are accepted when either:
--   A) the exact scoped canonical target exists, or
--   B) the active delta path has recorded that exact entity_id/entity_type
--      inside the same tenant/company/branch/accountingPeriod scope.
--
-- MEASUREMENT remains canonical-only.
--
-- No cross-company fallback.
-- No targetId-only fallback.
-- No weakening of measurement authority.

begin;

create or replace function public.enverp_media_validate_target_scope_v3()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
    v_exists boolean := false;
begin
    if new.target_type = 'CUSTOMER' then
        select (
            exists (
                select 1
                from public.customers c
                where c.id = new.target_id
                  and c.tenant_id = new.tenant_id
                  and c.company_id = new.company_id
                  and c.branch_id = new.branch_id
                  and c.accounting_period_id = new.accounting_period_id
            )
            or
            exists (
                select 1
                from public.measurement_changes mc
                where mc.entity_type = 'CUSTOMER'
                  and mc.entity_id = new.target_id
                  and mc.tenant_id = new.tenant_id
                  and mc.company_id = new.company_id
                  and mc.branch_id = new.branch_id
                  and mc.accounting_period_id = new.accounting_period_id
            )
        )
        into v_exists;

    elsif new.target_type = 'ROOM' then
        select (
            exists (
                select 1
                from public.rooms r
                where r.id = new.target_id
                  and r.tenant_id = new.tenant_id
                  and r.company_id = new.company_id
                  and r.branch_id = new.branch_id
                  and r.accounting_period_id = new.accounting_period_id
            )
            or
            exists (
                select 1
                from public.measurement_changes mc
                where mc.entity_type = 'ROOM'
                  and mc.entity_id = new.target_id
                  and mc.tenant_id = new.tenant_id
                  and mc.company_id = new.company_id
                  and mc.branch_id = new.branch_id
                  and mc.accounting_period_id = new.accounting_period_id
            )
        )
        into v_exists;

    elsif new.target_type = 'OPENING' then
        select (
            exists (
                select 1
                from public.openings o
                where o.id = new.target_id
                  and o.tenant_id = new.tenant_id
                  and o.company_id = new.company_id
                  and o.branch_id = new.branch_id
                  and o.accounting_period_id = new.accounting_period_id
            )
            or
            exists (
                select 1
                from public.measurement_changes mc
                where mc.entity_type = 'OPENING'
                  and mc.entity_id = new.target_id
                  and mc.tenant_id = new.tenant_id
                  and mc.company_id = new.company_id
                  and mc.branch_id = new.branch_id
                  and mc.accounting_period_id = new.accounting_period_id
            )
        )
        into v_exists;

    elsif new.target_type = 'MEASUREMENT' then
        select exists (
            select 1
            from public.measurements m
            where m.id = new.target_id
              and m.tenant_id = new.tenant_id
              and m.company_id = new.company_id
              and m.branch_id = new.branch_id
              and m.accounting_period_id = new.accounting_period_id
        )
        into v_exists;

    else
        raise exception 'ENVERP_MEDIA_UNSUPPORTED_TARGET_TYPE';
    end if;

    if not v_exists then
        raise exception 'ENVERP_MEDIA_TARGET_SCOPE_MISMATCH_OR_NOT_FOUND';
    end if;

    return new;
end;
$$;

commit;