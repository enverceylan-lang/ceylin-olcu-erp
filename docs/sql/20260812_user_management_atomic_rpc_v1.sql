-- ENVerp User Management Atomic Persistence V1
-- Source migration. Must be applied to Supabase separately after source validation.
-- Purpose:
-- - users + erp_user_scopes writes are one PostgreSQL transaction boundary
-- - DB-side actor/scope authorization
-- - company-scoped username uniqueness remains canonical in erp_user_scopes
-- - immutable server-side audit without password/hash values

BEGIN;

CREATE TABLE IF NOT EXISTS public.erp_user_management_audits (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    company_id UUID NOT NULL,
    actor_user_id TEXT NOT NULL,
    actor_user_scope_id UUID NOT NULL,
    target_user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    changed_fields TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT erp_user_management_audit_company_fk
        FOREIGN KEY (tenant_id, company_id)
        REFERENCES public.erp_companies(tenant_id, company_id)
        ON DELETE RESTRICT,

    CONSTRAINT erp_user_management_audit_action_valid
        CHECK (action IN ('CREATE', 'UPDATE')),

    CONSTRAINT erp_user_management_audit_actor_not_blank
        CHECK (BTRIM(actor_user_id) <> ''),

    CONSTRAINT erp_user_management_audit_target_not_blank
        CHECK (BTRIM(target_user_id) <> '')
);

CREATE INDEX IF NOT EXISTS erp_user_management_audit_company_created_idx
    ON public.erp_user_management_audits (
        tenant_id,
        company_id,
        created_at DESC
    );

CREATE INDEX IF NOT EXISTS erp_user_management_audit_target_created_idx
    ON public.erp_user_management_audits (
        tenant_id,
        company_id,
        target_user_id,
        created_at DESC
    );

CREATE OR REPLACE FUNCTION public.prevent_erp_user_management_audit_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'ERP_USER_MGMT_AUDIT_DELETE_FORBIDDEN';
END;
$$;

DROP TRIGGER IF EXISTS trg_erp_user_management_audit_no_delete
    ON public.erp_user_management_audits;

CREATE TRIGGER trg_erp_user_management_audit_no_delete
    BEFORE DELETE ON public.erp_user_management_audits
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_erp_user_management_audit_delete();

CREATE OR REPLACE FUNCTION public.manage_company_user_v1(
    p_user JSONB,
    p_is_create BOOLEAN,
    p_password_changed BOOLEAN,
    p_actor_user_id TEXT,
    p_actor_user_scope_id UUID,
    p_tenant_id UUID,
    p_company_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_role TEXT;
    v_target_id TEXT := BTRIM(COALESCE(p_user ->> 'id', ''));
    v_username TEXT := BTRIM(COALESCE(p_user ->> 'username', ''));
    v_existing public.users%ROWTYPE;
    v_actor_scope public.erp_user_scopes%ROWTYPE;
    v_permissions TEXT[];
    v_changed_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'ERP_USER_MGMT_FORBIDDEN:SERVICE_ROLE_REQUIRED';
    END IF;

    IF p_user IS NULL OR jsonb_typeof(p_user) <> 'object' THEN
        RAISE EXCEPTION 'ERP_USER_MGMT_INVALID:REQUEST';
    END IF;

    IF BTRIM(COALESCE(p_actor_user_id, '')) = ''
       OR p_actor_user_scope_id IS NULL
       OR p_tenant_id IS NULL
       OR p_company_id IS NULL THEN
        RAISE EXCEPTION 'ERP_USER_MGMT_INVALID:ACTOR_SCOPE';
    END IF;

    SELECT scope.*
    INTO v_actor_scope
    FROM public.erp_user_scopes AS scope
    WHERE scope.user_scope_id = p_actor_user_scope_id
      AND scope.user_id = p_actor_user_id
      AND scope.tenant_id = p_tenant_id
      AND scope.company_id = p_company_id
      AND scope.is_active = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ERP_USER_MGMT_FORBIDDEN:ACTOR_SCOPE';
    END IF;

    SELECT UPPER(BTRIM(COALESCE(u.role, '')))
    INTO v_actor_role
    FROM public.users AS u
    WHERE u.id = p_actor_user_id
      AND u."isActive" = TRUE;

    IF v_actor_role IS NULL THEN
        RAISE EXCEPTION 'ERP_USER_MGMT_FORBIDDEN:ACTOR';
    END IF;

    IF v_target_id = '' OR v_username = '' THEN
        RAISE EXCEPTION 'ERP_USER_MGMT_INVALID:TARGET';
    END IF;

    IF jsonb_typeof(COALESCE(p_user -> 'permissions', '[]'::JSONB)) <> 'array' THEN
        RAISE EXCEPTION 'ERP_USER_MGMT_INVALID:PERMISSIONS';
    END IF;

    SELECT COALESCE(array_agg(value), ARRAY[]::TEXT[])
    INTO v_permissions
    FROM jsonb_array_elements_text(
        COALESCE(p_user -> 'permissions', '[]'::JSONB)
    );

    IF p_is_create THEN
        IF v_actor_role <> 'ADMIN' THEN
            RAISE EXCEPTION 'ERP_USER_MGMT_FORBIDDEN:CREATE_ROLE';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM public.users AS u
            WHERE u.id = v_target_id
        ) THEN
            RAISE EXCEPTION 'ERP_USER_MGMT_CONFLICT:TARGET_EXISTS';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM public.erp_user_scopes AS s
            WHERE s.tenant_id = p_tenant_id
              AND s.company_id = p_company_id
              AND s.username = v_username
        ) THEN
            RAISE EXCEPTION 'ERP_USER_MGMT_CONFLICT:USERNAME';
        END IF;

        INSERT INTO public.users (
            id,
            name,
            username,
            password,
            role,
            "isActive",
            permissions,
            email,
            phone,
            "tcNo",
            address,
            "profileCompletedAt",
            "createdAt",
            "updatedAt",
            "providerCustomerId",
            "providerType"
        )
        VALUES (
            v_target_id,
            BTRIM(COALESCE(p_user ->> 'name', '')),
            v_username,
            p_user ->> 'password',
            COALESCE(NULLIF(BTRIM(p_user ->> 'role'), ''), 'FIELD'),
            COALESCE((p_user ->> 'isActive')::BOOLEAN, TRUE),
            v_permissions,
            NULLIF(BTRIM(COALESCE(p_user ->> 'email', '')), ''),
            NULLIF(BTRIM(COALESCE(p_user ->> 'phone', '')), ''),
            NULLIF(BTRIM(COALESCE(p_user ->> 'tcNo', '')), ''),
            NULLIF(BTRIM(COALESCE(p_user ->> 'address', '')), ''),
            NULLIF(p_user ->> 'profileCompletedAt', '')::TIMESTAMPTZ,
            (p_user ->> 'createdAt')::TIMESTAMPTZ,
            (p_user ->> 'updatedAt')::TIMESTAMPTZ,
            NULLIF(BTRIM(COALESCE(p_user ->> 'providerCustomerId', '')), ''),
            NULLIF(BTRIM(COALESCE(p_user ->> 'providerType', '')), '')
        );

        BEGIN
            INSERT INTO public.erp_user_scopes (
                user_scope_id,
                user_id,
                tenant_id,
                username,
                company_id,
                branch_id,
                accounting_period_id,
                is_default,
                is_active
            )
            VALUES (
                gen_random_uuid(),
                v_target_id,
                v_actor_scope.tenant_id,
                v_username,
                v_actor_scope.company_id,
                v_actor_scope.branch_id,
                v_actor_scope.accounting_period_id,
                TRUE,
                TRUE
            );
        EXCEPTION
            WHEN unique_violation THEN
                RAISE EXCEPTION 'ERP_USER_MGMT_CONFLICT:USERNAME';
        END;

        v_changed_fields := ARRAY[
            'name',
            'username',
            'role',
            'isActive',
            'permissions',
            'email',
            'phone',
            'tcNo',
            'address',
            'profileCompletedAt',
            'providerCustomerId',
            'providerType'
        ];

        IF p_password_changed THEN
            v_changed_fields := array_append(
                v_changed_fields,
                'passwordChanged'
            );
        END IF;
    ELSE
        SELECT u.*
        INTO v_existing
        FROM public.users AS u
        WHERE u.id = v_target_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'ERP_USER_MGMT_INVALID:TARGET_NOT_FOUND';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM public.erp_user_scopes AS s
            WHERE s.user_id = v_target_id
              AND s.tenant_id = p_tenant_id
              AND s.company_id = p_company_id
              AND s.is_active = TRUE
        ) THEN
            RAISE EXCEPTION 'ERP_USER_MGMT_FORBIDDEN:TARGET_SCOPE';
        END IF;

        IF v_actor_role <> 'ADMIN' AND v_target_id <> p_actor_user_id THEN
            RAISE EXCEPTION 'ERP_USER_MGMT_FORBIDDEN:TARGET';
        END IF;

        IF v_actor_role <> 'ADMIN' THEN
            IF v_username IS DISTINCT FROM v_existing.username
               OR COALESCE(p_user ->> 'role', '') IS DISTINCT FROM COALESCE(v_existing.role, '')
               OR (p_user ->> 'isActive')::BOOLEAN IS DISTINCT FROM v_existing."isActive"
               OR v_permissions IS DISTINCT FROM COALESCE(v_existing.permissions, ARRAY[]::TEXT[])
               OR NULLIF(BTRIM(COALESCE(p_user ->> 'providerCustomerId', '')), '')
                    IS DISTINCT FROM v_existing."providerCustomerId"
               OR NULLIF(BTRIM(COALESCE(p_user ->> 'providerType', '')), '')
                    IS DISTINCT FROM v_existing."providerType" THEN
                RAISE EXCEPTION 'ERP_USER_MGMT_FORBIDDEN:SELF_PRIVILEGED_FIELDS';
            END IF;

            IF v_existing."profileCompletedAt" IS NOT NULL THEN
                IF BTRIM(COALESCE(p_user ->> 'name', ''))
                        IS DISTINCT FROM v_existing.name
                   OR NULLIF(BTRIM(COALESCE(p_user ->> 'email', '')), '')
                        IS DISTINCT FROM v_existing.email
                   OR NULLIF(BTRIM(COALESCE(p_user ->> 'phone', '')), '')
                        IS DISTINCT FROM v_existing.phone
                   OR NULLIF(BTRIM(COALESCE(p_user ->> 'tcNo', '')), '')
                        IS DISTINCT FROM v_existing."tcNo"
                   OR NULLIF(BTRIM(COALESCE(p_user ->> 'address', '')), '')
                        IS DISTINCT FROM v_existing.address THEN
                    RAISE EXCEPTION 'ERP_USER_MGMT_FORBIDDEN:PROFILE_LOCKED';
                END IF;
            END IF;
        END IF;

        IF v_actor_role = 'ADMIN'
           AND v_username IS DISTINCT FROM v_existing.username THEN
            IF EXISTS (
                SELECT 1
                FROM public.erp_user_scopes AS s
                WHERE s.tenant_id = p_tenant_id
                  AND s.company_id = p_company_id
                  AND s.username = v_username
                  AND s.user_id <> v_target_id
            ) THEN
                RAISE EXCEPTION 'ERP_USER_MGMT_CONFLICT:USERNAME';
            END IF;
        END IF;

        v_changed_fields := array_remove(
            ARRAY[
                CASE WHEN BTRIM(COALESCE(p_user ->> 'name', ''))
                    IS DISTINCT FROM v_existing.name THEN 'name' END,
                CASE WHEN v_username
                    IS DISTINCT FROM v_existing.username THEN 'username' END,
                CASE WHEN COALESCE(p_user ->> 'role', '')
                    IS DISTINCT FROM COALESCE(v_existing.role, '') THEN 'role' END,
                CASE WHEN (p_user ->> 'isActive')::BOOLEAN
                    IS DISTINCT FROM v_existing."isActive" THEN 'isActive' END,
                CASE WHEN v_permissions
                    IS DISTINCT FROM COALESCE(v_existing.permissions, ARRAY[]::TEXT[])
                    THEN 'permissions' END,
                CASE WHEN NULLIF(BTRIM(COALESCE(p_user ->> 'email', '')), '')
                    IS DISTINCT FROM v_existing.email THEN 'email' END,
                CASE WHEN NULLIF(BTRIM(COALESCE(p_user ->> 'phone', '')), '')
                    IS DISTINCT FROM v_existing.phone THEN 'phone' END,
                CASE WHEN NULLIF(BTRIM(COALESCE(p_user ->> 'tcNo', '')), '')
                    IS DISTINCT FROM v_existing."tcNo" THEN 'tcNo' END,
                CASE WHEN NULLIF(BTRIM(COALESCE(p_user ->> 'address', '')), '')
                    IS DISTINCT FROM v_existing.address THEN 'address' END,
                CASE WHEN NULLIF(p_user ->> 'profileCompletedAt', '')::TIMESTAMPTZ
                    IS DISTINCT FROM v_existing."profileCompletedAt"
                    THEN 'profileCompletedAt' END,
                CASE WHEN NULLIF(BTRIM(COALESCE(p_user ->> 'providerCustomerId', '')), '')
                    IS DISTINCT FROM v_existing."providerCustomerId"
                    THEN 'providerCustomerId' END,
                CASE WHEN NULLIF(BTRIM(COALESCE(p_user ->> 'providerType', '')), '')
                    IS DISTINCT FROM v_existing."providerType"
                    THEN 'providerType' END
            ],
            NULL
        );

        IF p_password_changed THEN
            v_changed_fields := array_append(
                v_changed_fields,
                'passwordChanged'
            );
        END IF;

        UPDATE public.users
        SET
            name = BTRIM(COALESCE(p_user ->> 'name', '')),
            username = v_username,
            password = CASE
                WHEN p_password_changed
                    THEN p_user ->> 'password'
                ELSE v_existing.password
            END,
            role = COALESCE(NULLIF(BTRIM(p_user ->> 'role'), ''), v_existing.role),
            "isActive" = (p_user ->> 'isActive')::BOOLEAN,
            permissions = v_permissions,
            email = NULLIF(BTRIM(COALESCE(p_user ->> 'email', '')), ''),
            phone = NULLIF(BTRIM(COALESCE(p_user ->> 'phone', '')), ''),
            "tcNo" = NULLIF(BTRIM(COALESCE(p_user ->> 'tcNo', '')), ''),
            address = NULLIF(BTRIM(COALESCE(p_user ->> 'address', '')), ''),
            "profileCompletedAt" =
                NULLIF(p_user ->> 'profileCompletedAt', '')::TIMESTAMPTZ,
            "updatedAt" = (p_user ->> 'updatedAt')::TIMESTAMPTZ,
            "providerCustomerId" =
                NULLIF(BTRIM(COALESCE(p_user ->> 'providerCustomerId', '')), ''),
            "providerType" =
                NULLIF(BTRIM(COALESCE(p_user ->> 'providerType', '')), '')
        WHERE id = v_target_id;

        IF v_actor_role = 'ADMIN'
           AND v_username IS DISTINCT FROM v_existing.username THEN
            BEGIN
                UPDATE public.erp_user_scopes
                SET username = v_username
                WHERE user_id = v_target_id
                  AND tenant_id = p_tenant_id
                  AND company_id = p_company_id
                  AND is_active = TRUE;
            EXCEPTION
                WHEN unique_violation THEN
                    RAISE EXCEPTION 'ERP_USER_MGMT_CONFLICT:USERNAME';
            END;
        END IF;
    END IF;

    INSERT INTO public.erp_user_management_audits (
        tenant_id,
        company_id,
        actor_user_id,
        actor_user_scope_id,
        target_user_id,
        action,
        changed_fields
    )
    VALUES (
        p_tenant_id,
        p_company_id,
        p_actor_user_id,
        p_actor_user_scope_id,
        v_target_id,
        CASE WHEN p_is_create THEN 'CREATE' ELSE 'UPDATE' END,
        v_changed_fields
    );

    RETURN jsonb_build_object(
        'target_user_id', v_target_id,
        'action', CASE WHEN p_is_create THEN 'CREATE' ELSE 'UPDATE' END,
        'changed_fields', to_jsonb(v_changed_fields)
    );
END;
$$;

ALTER TABLE public.erp_user_management_audits
    ENABLE ROW LEVEL SECURITY;


REVOKE ALL PRIVILEGES
    ON TABLE public.erp_user_management_audits
    FROM PUBLIC, anon, authenticated;

REVOKE ALL
    ON FUNCTION public.manage_company_user_v1(
        JSONB,
        BOOLEAN,
        BOOLEAN,
        TEXT,
        UUID,
        UUID,
        UUID
    )
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.manage_company_user_v1(
        JSONB,
        BOOLEAN,
        BOOLEAN,
        TEXT,
        UUID,
        UUID,
        UUID
    )
    TO service_role;

COMMIT;