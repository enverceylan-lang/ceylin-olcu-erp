BEGIN;

-- ENVerp MEDIA ENTITLEMENT AUTHORITY V1
-- Canonical authority:
--   GLOBAL MEDIA master switch
--   COMPANY MEDIA entitlement: tenant_id + company_id
-- Existing tenant package license remains unchanged.
-- Missing rows are interpreted as disabled by server code.
--
-- Fail-closed migration preflight:
-- dependency types/keys/roles and all target names must be exact before DDL.

DO $$
DECLARE
    v_users_id_type TEXT;
BEGIN
    IF to_regclass('public.users') IS NULL THEN
        RAISE EXCEPTION
            'MEDIA_ENTITLEMENT_PREFLIGHT_USERS_RELATION_MISSING';
    END IF;

    IF to_regclass('public.erp_companies') IS NULL THEN
        RAISE EXCEPTION
            'MEDIA_ENTITLEMENT_PREFLIGHT_COMPANIES_RELATION_MISSING';
    END IF;

    SELECT data_type
    INTO v_users_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'id';

    IF v_users_id_type IS DISTINCT FROM 'text' THEN
        RAISE EXCEPTION
            'MEDIA_ENTITLEMENT_PREFLIGHT_USERS_ID_TYPE:%',
            COALESCE(v_users_id_type, 'MISSING');
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'role'
    ) THEN
        RAISE EXCEPTION
            'MEDIA_ENTITLEMENT_PREFLIGHT_USERS_ROLE_MISSING';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'isActive'
          AND data_type = 'boolean'
    ) THEN
        RAISE EXCEPTION
            'MEDIA_ENTITLEMENT_PREFLIGHT_USERS_ACTIVE_TYPE';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'erp_companies'
          AND column_name = 'tenant_id'
          AND data_type = 'uuid'
    ) OR NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'erp_companies'
          AND column_name = 'company_id'
          AND data_type = 'uuid'
    ) THEN
        RAISE EXCEPTION
            'MEDIA_ENTITLEMENT_PREFLIGHT_COMPANY_SCOPE_TYPE';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        WHERE c.conrelid = to_regclass('public.users')
          AND c.contype IN ('p', 'u')
          AND (
              SELECT array_agg(a.attname::text ORDER BY k.ord)
              FROM unnest(c.conkey) WITH ORDINALITY
                   AS k(attnum, ord)
              JOIN pg_attribute a
                ON a.attrelid = c.conrelid
               AND a.attnum = k.attnum
          ) = ARRAY['id']::text[]
    ) THEN
        RAISE EXCEPTION
            'MEDIA_ENTITLEMENT_PREFLIGHT_USERS_ID_NOT_UNIQUE';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        WHERE c.conrelid = to_regclass('public.erp_companies')
          AND c.contype IN ('p', 'u')
          AND (
              SELECT array_agg(a.attname::text ORDER BY k.ord)
              FROM unnest(c.conkey) WITH ORDINALITY
                   AS k(attnum, ord)
              JOIN pg_attribute a
                ON a.attrelid = c.conrelid
               AND a.attnum = k.attnum
          ) = ARRAY['tenant_id', 'company_id']::text[]
    ) THEN
        RAISE EXCEPTION
            'MEDIA_ENTITLEMENT_PREFLIGHT_COMPANY_SCOPE_NOT_UNIQUE';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = 'anon'
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = 'service_role'
    ) THEN
        RAISE EXCEPTION
            'MEDIA_ENTITLEMENT_PREFLIGHT_REQUIRED_ROLE_MISSING';
    END IF;

    IF to_regprocedure('gen_random_uuid()') IS NULL THEN
        RAISE EXCEPTION
            'MEDIA_ENTITLEMENT_PREFLIGHT_GEN_RANDOM_UUID_MISSING';
    END IF;

    IF to_regclass('public.erp_platform_feature_switches') IS NOT NULL
       OR to_regclass('public.erp_company_feature_entitlements') IS NOT NULL
       OR to_regclass('public.erp_feature_entitlement_audits') IS NOT NULL
    THEN
        RAISE EXCEPTION
            'MEDIA_ENTITLEMENT_PREFLIGHT_TARGET_RELATION_EXISTS';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n
          ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
              'set_platform_feature_switch_v1',
              'set_company_feature_entitlement_v1'
          )
    ) THEN
        RAISE EXCEPTION
            'MEDIA_ENTITLEMENT_PREFLIGHT_RPC_NAME_COLLISION';
    END IF;

    IF to_regclass(
        'public.erp_company_feature_entitlements_company_idx'
    ) IS NOT NULL
       OR to_regclass(
           'public.erp_feature_entitlement_audits_company_created_idx'
       ) IS NOT NULL
    THEN
        RAISE EXCEPTION
            'MEDIA_ENTITLEMENT_PREFLIGHT_INDEX_NAME_COLLISION';
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.erp_platform_feature_switches (
    feature_code TEXT PRIMARY KEY,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by_user_id TEXT NOT NULL
        REFERENCES public.users(id)
        ON DELETE RESTRICT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT erp_platform_feature_switch_code_valid
        CHECK (feature_code IN ('MEDIA'))
);

CREATE TABLE IF NOT EXISTS public.erp_company_feature_entitlements (
    tenant_id UUID NOT NULL,
    company_id UUID NOT NULL,
    feature_code TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by_user_id TEXT NOT NULL
        REFERENCES public.users(id)
        ON DELETE RESTRICT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT erp_company_feature_entitlement_pk
        PRIMARY KEY (tenant_id, company_id, feature_code),
    CONSTRAINT erp_company_feature_entitlement_company_fk
        FOREIGN KEY (tenant_id, company_id)
        REFERENCES public.erp_companies(tenant_id, company_id)
        ON DELETE RESTRICT,
    CONSTRAINT erp_company_feature_entitlement_code_valid
        CHECK (feature_code IN ('MEDIA'))
);

CREATE TABLE IF NOT EXISTS public.erp_feature_entitlement_audits (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_type TEXT NOT NULL,
    tenant_id UUID,
    company_id UUID,
    feature_code TEXT NOT NULL,
    old_enabled BOOLEAN,
    new_enabled BOOLEAN NOT NULL,
    actor_user_id TEXT NOT NULL
        REFERENCES public.users(id)
        ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT erp_feature_entitlement_audit_scope_valid
        CHECK (scope_type IN ('GLOBAL', 'COMPANY')),
    CONSTRAINT erp_feature_entitlement_audit_feature_valid
        CHECK (feature_code IN ('MEDIA')),
    CONSTRAINT erp_feature_entitlement_audit_scope_shape_valid
        CHECK (
            (
                scope_type = 'GLOBAL'
                AND tenant_id IS NULL
                AND company_id IS NULL
            )
            OR
            (
                scope_type = 'COMPANY'
                AND tenant_id IS NOT NULL
                AND company_id IS NOT NULL
            )
        ),
    CONSTRAINT erp_feature_entitlement_audit_company_fk
        FOREIGN KEY (tenant_id, company_id)
        REFERENCES public.erp_companies(tenant_id, company_id)
        ON DELETE RESTRICT
);

ALTER TABLE public.erp_platform_feature_switches
    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_platform_feature_switches
    FORCE ROW LEVEL SECURITY;

ALTER TABLE public.erp_company_feature_entitlements
    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_company_feature_entitlements
    FORCE ROW LEVEL SECURITY;

ALTER TABLE public.erp_feature_entitlement_audits
    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_feature_entitlement_audits
    FORCE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
    ON TABLE public.erp_platform_feature_switches
    FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES
    ON TABLE public.erp_company_feature_entitlements
    FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES
    ON TABLE public.erp_feature_entitlement_audits
    FROM PUBLIC, anon, authenticated;

GRANT SELECT
    ON TABLE public.erp_platform_feature_switches
    TO service_role;

GRANT SELECT
    ON TABLE public.erp_company_feature_entitlements
    TO service_role;

CREATE INDEX IF NOT EXISTS
    erp_company_feature_entitlements_company_idx
    ON public.erp_company_feature_entitlements (
        tenant_id,
        company_id,
        feature_code
    );

CREATE INDEX IF NOT EXISTS
    erp_feature_entitlement_audits_company_created_idx
    ON public.erp_feature_entitlement_audits (
        tenant_id,
        company_id,
        created_at DESC
    );

CREATE OR REPLACE FUNCTION
public.set_platform_feature_switch_v1(
    p_feature_code TEXT,
    p_is_enabled BOOLEAN,
    p_actor_user_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_role TEXT;
    v_feature_code TEXT := UPPER(BTRIM(COALESCE(p_feature_code, '')));
    v_actor_user_id TEXT := BTRIM(COALESCE(p_actor_user_id, ''));
    v_old_enabled BOOLEAN;
BEGIN
    IF v_actor_user_id = '' THEN
        RAISE EXCEPTION 'MEDIA_ENTITLEMENT_FORBIDDEN:ACTOR_REQUIRED';
    END IF;

    SELECT role
    INTO v_actor_role
    FROM public.users
    WHERE id = v_actor_user_id
      AND "isActive" = TRUE;

    IF v_actor_role IS DISTINCT FROM 'PLATFORM_SUPER_ADMIN' THEN
        RAISE EXCEPTION 'MEDIA_ENTITLEMENT_FORBIDDEN';
    END IF;

    IF v_feature_code <> 'MEDIA' THEN
        RAISE EXCEPTION 'MEDIA_ENTITLEMENT_INVALID:FEATURE';
    END IF;

    SELECT is_enabled
    INTO v_old_enabled
    FROM public.erp_platform_feature_switches
    WHERE feature_code = v_feature_code
    FOR UPDATE;

    INSERT INTO public.erp_platform_feature_switches (
        feature_code,
        is_enabled,
        updated_by_user_id,
        updated_at
    )
    VALUES (
        v_feature_code,
        p_is_enabled,
        v_actor_user_id,
        NOW()
    )
    ON CONFLICT (feature_code)
    DO UPDATE SET
        is_enabled = EXCLUDED.is_enabled,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = NOW();

    INSERT INTO public.erp_feature_entitlement_audits (
        scope_type,
        tenant_id,
        company_id,
        feature_code,
        old_enabled,
        new_enabled,
        actor_user_id
    )
    VALUES (
        'GLOBAL',
        NULL,
        NULL,
        v_feature_code,
        v_old_enabled,
        p_is_enabled,
        v_actor_user_id
    );

    RETURN jsonb_build_object(
        'feature_code', v_feature_code,
        'is_enabled', p_is_enabled
    );
END;
$$;

CREATE OR REPLACE FUNCTION
public.set_company_feature_entitlement_v1(
    p_tenant_id UUID,
    p_company_id UUID,
    p_feature_code TEXT,
    p_is_enabled BOOLEAN,
    p_actor_user_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_role TEXT;
    v_feature_code TEXT := UPPER(BTRIM(COALESCE(p_feature_code, '')));
    v_actor_user_id TEXT := BTRIM(COALESCE(p_actor_user_id, ''));
    v_old_enabled BOOLEAN;
BEGIN
    IF v_actor_user_id = '' THEN
        RAISE EXCEPTION 'MEDIA_ENTITLEMENT_FORBIDDEN:ACTOR_REQUIRED';
    END IF;

    SELECT role
    INTO v_actor_role
    FROM public.users
    WHERE id = v_actor_user_id
      AND "isActive" = TRUE;

    IF v_actor_role IS DISTINCT FROM 'PLATFORM_SUPER_ADMIN' THEN
        RAISE EXCEPTION 'MEDIA_ENTITLEMENT_FORBIDDEN';
    END IF;

    IF v_feature_code <> 'MEDIA' THEN
        RAISE EXCEPTION 'MEDIA_ENTITLEMENT_INVALID:FEATURE';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.erp_companies
        WHERE tenant_id = p_tenant_id
          AND company_id = p_company_id
    ) THEN
        RAISE EXCEPTION 'MEDIA_ENTITLEMENT_INVALID:COMPANY_SCOPE';
    END IF;

    SELECT is_enabled
    INTO v_old_enabled
    FROM public.erp_company_feature_entitlements
    WHERE tenant_id = p_tenant_id
      AND company_id = p_company_id
      AND feature_code = v_feature_code
    FOR UPDATE;

    INSERT INTO public.erp_company_feature_entitlements (
        tenant_id,
        company_id,
        feature_code,
        is_enabled,
        updated_by_user_id,
        updated_at
    )
    VALUES (
        p_tenant_id,
        p_company_id,
        v_feature_code,
        p_is_enabled,
        v_actor_user_id,
        NOW()
    )
    ON CONFLICT (tenant_id, company_id, feature_code)
    DO UPDATE SET
        is_enabled = EXCLUDED.is_enabled,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = NOW();

    INSERT INTO public.erp_feature_entitlement_audits (
        scope_type,
        tenant_id,
        company_id,
        feature_code,
        old_enabled,
        new_enabled,
        actor_user_id
    )
    VALUES (
        'COMPANY',
        p_tenant_id,
        p_company_id,
        v_feature_code,
        v_old_enabled,
        p_is_enabled,
        v_actor_user_id
    );

    RETURN jsonb_build_object(
        'tenant_id', p_tenant_id,
        'company_id', p_company_id,
        'feature_code', v_feature_code,
        'is_enabled', p_is_enabled
    );
END;
$$;

REVOKE ALL
    ON FUNCTION public.set_platform_feature_switch_v1(
        TEXT,
        BOOLEAN,
        TEXT
    )
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.set_platform_feature_switch_v1(
        TEXT,
        BOOLEAN,
        TEXT
    )
    TO service_role;

REVOKE ALL
    ON FUNCTION public.set_company_feature_entitlement_v1(
        UUID,
        UUID,
        TEXT,
        BOOLEAN,
        TEXT
    )
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.set_company_feature_entitlement_v1(
        UUID,
        UUID,
        TEXT,
        BOOLEAN,
        TEXT
    )
    TO service_role;

COMMIT;
