-- MEDIA LIFECYCLE AUTHORITY V1
-- SOURCE ONLY.
-- LIVE EXECUTION REQUIRES SEPARATE APPROVAL.
--
-- Authority:
--   authenticated server session
--   + exact ERP scope
--   + entitlement
--   + permission
--   + lifecycle
--
-- Canonical target existence is NOT user permission.
--
-- Structural integrity rule:
--   1. If target exists canonically in the current scope: OK.
--   2. If target does not exist canonically anywhere:
--      local-first target is allowed.
--   3. If the same target_id already exists canonically in
--      another ERP scope: reject.
--
-- Thus local-first Media is supported without weakening
-- cross-company isolation.

begin;

create or replace function public.enverp_media_validate_target_scope_v3()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
    v_exact_exists boolean := false;
    v_any_exists boolean := false;
begin
    if new.target_type not in (
        'CUSTOMER',
        'ROOM',
        'OPENING',
        'MEASUREMENT'
    ) then
        raise exception
            'ENVERP_MEDIA_UNSUPPORTED_TARGET_TYPE';
    end if;

    if new.target_id is null
       or length(btrim(new.target_id)) = 0 then
        raise exception
            'ENVERP_MEDIA_TARGET_ID_REQUIRED';
    end if;

    if new.target_type = 'CUSTOMER' then
        select exists (
            select 1
            from public.customers c
            where c.id = new.target_id
              and c.tenant_id = new.tenant_id
              and c.company_id = new.company_id
              and c.branch_id = new.branch_id
              and c.accounting_period_id =
                  new.accounting_period_id
        )
        into v_exact_exists;

        select exists (
            select 1
            from public.customers c
            where c.id = new.target_id
        )
        into v_any_exists;

    elsif new.target_type = 'ROOM' then
        select exists (
            select 1
            from public.rooms r
            where r.id = new.target_id
              and r.tenant_id = new.tenant_id
              and r.company_id = new.company_id
              and r.branch_id = new.branch_id
              and r.accounting_period_id =
                  new.accounting_period_id
        )
        into v_exact_exists;

        select exists (
            select 1
            from public.rooms r
            where r.id = new.target_id
        )
        into v_any_exists;

    elsif new.target_type = 'OPENING' then
        select exists (
            select 1
            from public.openings o
            where o.id = new.target_id
              and o.tenant_id = new.tenant_id
              and o.company_id = new.company_id
              and o.branch_id = new.branch_id
              and o.accounting_period_id =
                  new.accounting_period_id
        )
        into v_exact_exists;

        select exists (
            select 1
            from public.openings o
            where o.id = new.target_id
        )
        into v_any_exists;

    elsif new.target_type = 'MEASUREMENT' then
        select exists (
            select 1
            from public.measurements m
            where m.id = new.target_id
              and m.tenant_id = new.tenant_id
              and m.company_id = new.company_id
              and m.branch_id = new.branch_id
              and m.accounting_period_id =
                  new.accounting_period_id
        )
        into v_exact_exists;

        select exists (
            select 1
            from public.measurements m
            where m.id = new.target_id
        )
        into v_any_exists;
    end if;

    if v_any_exists and not v_exact_exists then
        raise exception
            'ENVERP_MEDIA_TARGET_SCOPE_MISMATCH';
    end if;

    /*
      v_any_exists = false is the legitimate local-first case.

      The target identity is bound to the authenticated
      Media RPC/server scope when the Media row is created.

      This function does not decide whether the actor has
      permission to upload/read/change Media.
    */

    return new;
end;
$function$;

commit;