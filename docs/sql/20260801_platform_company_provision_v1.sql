-- ENVERP — PLATFORM SUPER ADMIN / COMPANY PROVISION V1
-- Amaç:
-- - Platform seviyesinde yeni tenant + company + branch + accounting period
--   + active package license + ilk COMPANY_ADMIN + default user scope
--   zincirini TEK PostgreSQL transaction içinde oluşturmak.
-- - PLATFORM_SUPER_ADMIN işletme operasyon verisine erişmez.
-- - Şifre düz metin olarak DB fonksiyonuna verilmez; API hash üretir.
--
-- Bu dosya repo migration kaynağıdır.
-- Canlı Supabase'e ayrıca kontrollü SQL uygulama adımında uygulanacaktır.

BEGIN;

ALTER TABLE public.erp_companies
    ADD COLUMN IF NOT EXISTS slug TEXT;

UPDATE public.erp_companies
SET slug = regexp_replace(
    lower(company_code),
    '[^a-z0-9]+',
    '',
    'g'
)
WHERE slug IS NULL
   OR BTRIM(slug) = '';

ALTER TABLE public.erp_companies
    ALTER COLUMN slug SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'erp_company_slug_not_blank'
    ) THEN
        ALTER TABLE public.erp_companies
            ADD CONSTRAINT erp_company_slug_not_blank
            CHECK (BTRIM(slug) <> '');
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'erp_company_slug_format_valid'
    ) THEN
        ALTER TABLE public.erp_companies
            ADD CONSTRAINT erp_company_slug_format_valid
            CHECK (
                slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'
            );
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS
    erp_company_slug_unique
    ON public.erp_companies (slug);

ALTER TABLE public.erp_package_licenses
    ADD COLUMN IF NOT EXISTS branch_limit INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS user_limit INTEGER NOT NULL DEFAULT 5;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'erp_license_branch_limit_valid'
    ) THEN
        ALTER TABLE public.erp_package_licenses
            ADD CONSTRAINT erp_license_branch_limit_valid
            CHECK (
                branch_limit >= 1
                AND branch_limit <= 1000
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'erp_license_user_limit_valid'
    ) THEN
        ALTER TABLE public.erp_package_licenses
            ADD CONSTRAINT erp_license_user_limit_valid
            CHECK (
                user_limit >= 1
                AND user_limit <= 100000
            );
    END IF;
END;
$$;

-- ============================================================
-- CHANNEL ACCESS FOUNDATION V1
-- Model:
--   License channel = tenant/package upper bound.
--   User scope channel = effective per-user/per-scope permission.
--   Effective access requires BOTH to allow the requested channel.
--
-- Existing records retain current access until enforcement rollout.
-- New provisioned companies start with WEB and MOBILE enabled; DESKTOP remains disabled.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.erp_access_channels (
    channel_code TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT erp_access_channel_code_not_blank
        CHECK (BTRIM(channel_code) <> ''),
    CONSTRAINT erp_access_channel_code_format
        CHECK (channel_code ~ '^[A-Z][A-Z0-9_]{1,31}$'),
    CONSTRAINT erp_access_channel_display_name_not_blank
        CHECK (BTRIM(display_name) <> '')
);

INSERT INTO public.erp_access_channels (
    channel_code,
    display_name,
    is_active
)
VALUES
    ('WEB', 'Web', TRUE),
    ('MOBILE', 'Mobile', TRUE),
    ('DESKTOP', 'Desktop', TRUE)
ON CONFLICT (channel_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.erp_license_channel_access (
    license_id UUID NOT NULL
        REFERENCES public.erp_package_licenses(license_id)
        ON DELETE RESTRICT,
    channel_code TEXT NOT NULL
        REFERENCES public.erp_access_channels(channel_code)
        ON DELETE RESTRICT,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (license_id, channel_code)
);

CREATE TABLE IF NOT EXISTS public.erp_user_scope_channel_access (
    user_scope_id UUID NOT NULL
        REFERENCES public.erp_user_scopes(user_scope_id)
        ON DELETE RESTRICT,
    channel_code TEXT NOT NULL
        REFERENCES public.erp_access_channels(channel_code)
        ON DELETE RESTRICT,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_scope_id, channel_code)
);

CREATE INDEX IF NOT EXISTS
    erp_license_channel_access_enabled_idx
    ON public.erp_license_channel_access (
        license_id,
        channel_code
    )
    WHERE is_enabled = TRUE;

CREATE INDEX IF NOT EXISTS
    erp_user_scope_channel_access_enabled_idx
    ON public.erp_user_scope_channel_access (
        user_scope_id,
        channel_code
    )
    WHERE is_enabled = TRUE;

-- Backward compatibility:
-- Existing licenses/scopes are initially allowed on all three channels.
-- Enforcement is NOT activated by this migration source.
INSERT INTO public.erp_license_channel_access (
    license_id,
    channel_code,
    is_enabled
)
SELECT
    license.license_id,
    channel.channel_code,
    TRUE
FROM public.erp_package_licenses AS license
CROSS JOIN public.erp_access_channels AS channel
WHERE channel.channel_code IN (
    'WEB',
    'MOBILE',
    'DESKTOP'
)
ON CONFLICT (license_id, channel_code) DO NOTHING;

INSERT INTO public.erp_user_scope_channel_access (
    user_scope_id,
    channel_code,
    is_enabled
)
SELECT
    scope.user_scope_id,
    channel.channel_code,
    TRUE
FROM public.erp_user_scopes AS scope
CROSS JOIN public.erp_access_channels AS channel
WHERE channel.channel_code IN (
    'WEB',
    'MOBILE',
    'DESKTOP'
)
ON CONFLICT (user_scope_id, channel_code) DO NOTHING;

ALTER TABLE public.erp_access_channels
    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_access_channels
    FORCE ROW LEVEL SECURITY;

ALTER TABLE public.erp_license_channel_access
    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_license_channel_access
    FORCE ROW LEVEL SECURITY;

ALTER TABLE public.erp_user_scope_channel_access
    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_user_scope_channel_access
    FORCE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
    ON TABLE public.erp_access_channels
    FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES
    ON TABLE public.erp_license_channel_access
    FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES
    ON TABLE public.erp_user_scope_channel_access
    FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION
public.initialize_provisioned_company_channel_access_v1(
    p_tenant_id UUID,
    p_user_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_license_id UUID;
    v_user_scope_id UUID;
BEGIN
    SELECT license_id
    INTO v_license_id
    FROM public.erp_package_licenses
    WHERE tenant_id = p_tenant_id
      AND is_active = TRUE
    LIMIT 1;

    SELECT user_scope_id
    INTO v_user_scope_id
    FROM public.erp_user_scopes
    WHERE user_id = p_user_id
      AND tenant_id = p_tenant_id
      AND is_active = TRUE
      AND is_default = TRUE
    LIMIT 1;

    IF v_license_id IS NULL
       OR v_user_scope_id IS NULL THEN
        RAISE EXCEPTION
            'CHANNEL_ACCESS_INIT_INVALID_SCOPE';
    END IF;

    INSERT INTO public.erp_license_channel_access (
        license_id,
        channel_code,
        is_enabled
    )
    VALUES
        (v_license_id, 'WEB', TRUE),
        (v_license_id, 'MOBILE', TRUE),
        (v_license_id, 'DESKTOP', FALSE)
    ON CONFLICT (license_id, channel_code)
    DO UPDATE SET
        is_enabled = EXCLUDED.is_enabled,
        updated_at = NOW();

    INSERT INTO public.erp_user_scope_channel_access (
        user_scope_id,
        channel_code,
        is_enabled
    )
    VALUES
        (v_user_scope_id, 'WEB', TRUE),
        (v_user_scope_id, 'MOBILE', TRUE),
        (v_user_scope_id, 'DESKTOP', FALSE)
    ON CONFLICT (user_scope_id, channel_code)
    DO UPDATE SET
        is_enabled = EXCLUDED.is_enabled,
        updated_at = NOW();
END;
$$;

REVOKE ALL
    ON FUNCTION
    public.initialize_provisioned_company_channel_access_v1(
        UUID,
        TEXT
    )
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION
    public.initialize_provisioned_company_channel_access_v1(
        UUID,
        TEXT
    )
    TO service_role;
CREATE TABLE IF NOT EXISTS public.erp_platform_provision_audits (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES public.erp_tenants(tenant_id)
        ON DELETE RESTRICT,
    company_id UUID NOT NULL,
    action TEXT NOT NULL,
    actor_user_id TEXT NOT NULL
        REFERENCES public.users(id)
        ON DELETE RESTRICT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT erp_platform_provision_company_fk
        FOREIGN KEY (tenant_id, company_id)
        REFERENCES public.erp_companies(
            tenant_id,
            company_id
        )
        ON DELETE RESTRICT,
    CONSTRAINT erp_platform_provision_action_valid
        CHECK (
            action IN (
                'COMPANY_PROVISIONED'
            )
        )
);

ALTER TABLE public.erp_platform_provision_audits
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.erp_platform_provision_audits
    FORCE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
    ON TABLE public.erp_platform_provision_audits
    FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS
    erp_platform_provision_audit_company_idx
    ON public.erp_platform_provision_audits (
        tenant_id,
        company_id,
        created_at DESC
    );

CREATE OR REPLACE FUNCTION
public.provision_platform_company_v1(
    p_request JSONB,
    p_actor_user_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_role TEXT;

    v_tenant_id UUID;
    v_company_id UUID;
    v_branch_id UUID;
    v_period_id UUID;
    v_license_id UUID;

    v_admin_user_id TEXT :=
        'user-company-admin-' ||
        gen_random_uuid()::TEXT;

    v_tenant_code TEXT :=
        BTRIM(
            COALESCE(
                p_request ->> 'tenant_code',
                ''
            )
        );

    v_tenant_name TEXT :=
        BTRIM(
            COALESCE(
                p_request ->> 'tenant_name',
                ''
            )
        );

    v_company_code TEXT :=
        BTRIM(
            COALESCE(
                p_request ->> 'company_code',
                ''
            )
        );

    v_company_slug TEXT :=
        BTRIM(
            COALESCE(
                p_request ->> 'company_slug',
                ''
            )
        );

    v_company_name TEXT :=
        BTRIM(
            COALESCE(
                p_request ->> 'company_name',
                ''
            )
        );

    v_branch_code TEXT :=
        BTRIM(
            COALESCE(
                p_request ->> 'branch_code',
                ''
            )
        );

    v_branch_name TEXT :=
        BTRIM(
            COALESCE(
                p_request ->> 'branch_name',
                ''
            )
        );

    v_period_code TEXT :=
        BTRIM(
            COALESCE(
                p_request ->> 'period_code',
                ''
            )
        );

    v_period_name TEXT :=
        BTRIM(
            COALESCE(
                p_request ->> 'period_name',
                ''
            )
        );

    v_package_code TEXT :=
        BTRIM(
            COALESCE(
                p_request ->> 'package_code',
                ''
            )
        );

    v_admin_name TEXT :=
        BTRIM(
            COALESCE(
                p_request ->> 'company_admin_name',
                ''
            )
        );

    v_admin_username TEXT :=
        BTRIM(
            COALESCE(
                p_request ->> 'company_admin_username',
                ''
            )
        );

    v_admin_password_hash TEXT :=
        BTRIM(
            COALESCE(
                p_request ->> 'company_admin_password_hash',
                ''
            )
        );

    v_actor_user_id TEXT :=
        BTRIM(
            COALESCE(
                p_actor_user_id,
                ''
            )
        );

    v_period_starts_on DATE;
    v_period_ends_on DATE;
    v_license_starts_at TIMESTAMPTZ;
    v_license_ends_at TIMESTAMPTZ;

    v_branch_limit INTEGER;
    v_user_limit INTEGER;

    v_feature_overrides JSONB :=
        COALESCE(
            p_request -> 'feature_overrides',
            '{}'::JSONB
        );
BEGIN
    IF p_request IS NULL
       OR jsonb_typeof(p_request) <> 'object' THEN
        RAISE EXCEPTION
            'PLATFORM_PROVISION_INVALID:REQUEST';
    END IF;

    IF p_request ? 'changed_by_user_id' THEN
        RAISE EXCEPTION
            'PLATFORM_PROVISION_INVALID:ACTOR_IN_REQUEST';
    END IF;

    IF COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION
            'PLATFORM_PROVISION_FORBIDDEN:CALLER_ROLE';
    END IF;

    IF v_actor_user_id = '' THEN
        RAISE EXCEPTION
            'PLATFORM_PROVISION_FORBIDDEN:ACTOR_REQUIRED';
    END IF;

    SELECT role
    INTO v_actor_role
    FROM public.users
    WHERE id = v_actor_user_id
      AND "isActive" = TRUE;

    IF v_actor_role IS DISTINCT FROM
       'PLATFORM_SUPER_ADMIN' THEN
        RAISE EXCEPTION
            'PLATFORM_PROVISION_FORBIDDEN';
    END IF;

    IF v_tenant_code = ''
       OR v_tenant_name = ''
       OR v_company_code = ''
       OR v_company_slug = ''
       OR v_company_name = ''
       OR v_branch_code = ''
       OR v_branch_name = ''
       OR v_period_code = ''
       OR v_period_name = ''
       OR v_admin_name = ''
       OR v_admin_username = ''
       OR v_admin_password_hash = '' THEN
        RAISE EXCEPTION
            'PLATFORM_PROVISION_INVALID:REQUIRED_FIELD';
    END IF;

    IF v_company_slug !~
       '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$' THEN
        RAISE EXCEPTION
            'PLATFORM_PROVISION_INVALID:COMPANY_SLUG';
    END IF;

    IF v_package_code NOT IN (
        'ECO',
        'PRO',
        'PLUS',
        'ELITE'
    ) THEN
        RAISE EXCEPTION
            'PLATFORM_PROVISION_INVALID:PACKAGE';
    END IF;

    BEGIN
        v_period_starts_on :=
            (p_request ->> 'period_starts_on')::DATE;

        v_period_ends_on :=
            (p_request ->> 'period_ends_on')::DATE;

        v_license_starts_at :=
            (
                p_request ->> 'license_starts_at'
            )::TIMESTAMPTZ;

        IF (
            p_request ->> 'license_ends_at'
        ) IS NOT NULL THEN
            v_license_ends_at :=
                (
                    p_request ->> 'license_ends_at'
                )::TIMESTAMPTZ;
        ELSE
            v_license_ends_at := NULL;
        END IF;

        v_branch_limit :=
            (
                p_request ->> 'branch_limit'
            )::INTEGER;

        v_user_limit :=
            (
                p_request ->> 'user_limit'
            )::INTEGER;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION
                'PLATFORM_PROVISION_INVALID:TYPE';
    END;

    IF v_period_ends_on <
       v_period_starts_on THEN
        RAISE EXCEPTION
            'PLATFORM_PROVISION_INVALID:PERIOD_RANGE';
    END IF;

    IF v_license_ends_at IS NOT NULL
       AND v_license_ends_at <
           v_license_starts_at THEN
        RAISE EXCEPTION
            'PLATFORM_PROVISION_INVALID:LICENSE_RANGE';
    END IF;

    IF v_branch_limit < 1
       OR v_branch_limit > 1000 THEN
        RAISE EXCEPTION
            'PLATFORM_PROVISION_INVALID:BRANCH_LIMIT';
    END IF;

    IF v_user_limit < 1
       OR v_user_limit > 100000 THEN
        RAISE EXCEPTION
            'PLATFORM_PROVISION_INVALID:USER_LIMIT';
    END IF;

    IF jsonb_typeof(v_feature_overrides)
       <> 'object' THEN
        RAISE EXCEPTION
            'PLATFORM_PROVISION_INVALID:FEATURE_OVERRIDES';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.erp_tenants
        WHERE tenant_code = v_tenant_code
    )
    OR EXISTS (
        SELECT 1
        FROM public.erp_companies
        WHERE slug = v_company_slug
    )
    OR EXISTS (
        SELECT 1
        FROM public.users
        WHERE username = v_admin_username
    ) THEN
        RAISE EXCEPTION
            'PLATFORM_PROVISION_CONFLICT';
    END IF;

    INSERT INTO public.erp_tenants (
        tenant_code,
        name,
        is_active
    )
    VALUES (
        v_tenant_code,
        v_tenant_name,
        TRUE
    )
    RETURNING tenant_id
    INTO v_tenant_id;

    INSERT INTO public.erp_companies (
        tenant_id,
        company_code,
        slug,
        name,
        is_active
    )
    VALUES (
        v_tenant_id,
        v_company_code,
        v_company_slug,
        v_company_name,
        TRUE
    )
    RETURNING company_id
    INTO v_company_id;

    INSERT INTO public.erp_branches (
        tenant_id,
        company_id,
        branch_code,
        name,
        is_active
    )
    VALUES (
        v_tenant_id,
        v_company_id,
        v_branch_code,
        v_branch_name,
        TRUE
    )
    RETURNING branch_id
    INTO v_branch_id;

    INSERT INTO public.erp_accounting_periods (
        tenant_id,
        company_id,
        period_code,
        name,
        starts_on,
        ends_on,
        is_closed
    )
    VALUES (
        v_tenant_id,
        v_company_id,
        v_period_code,
        v_period_name,
        v_period_starts_on,
        v_period_ends_on,
        FALSE
    )
    RETURNING accounting_period_id
    INTO v_period_id;

    INSERT INTO public.erp_package_licenses (
        tenant_id,
        package_code,
        starts_at,
        ends_at,
        is_active,
        feature_overrides,
        branch_limit,
        user_limit
    )
    VALUES (
        v_tenant_id,
        v_package_code,
        v_license_starts_at,
        v_license_ends_at,
        TRUE,
        v_feature_overrides,
        v_branch_limit,
        v_user_limit
    )
    RETURNING license_id
    INTO v_license_id;

    INSERT INTO public.users (
        id,
        name,
        username,
        password,
        role,
        "isActive",
        permissions,
        "createdAt",
        "updatedAt",
        email,
        phone,
        "profileCompletedAt"
    )
    VALUES (
        v_admin_user_id,
        v_admin_name,
        v_admin_username,
        v_admin_password_hash,
        'COMPANY_ADMIN',
        TRUE,
        ARRAY[]::TEXT[],
        NOW(),
        NOW(),
        NULLIF(
            BTRIM(
                p_request ->> 'company_admin_email'
            ),
            ''
        ),
        NULLIF(
            BTRIM(
                p_request ->> 'company_admin_phone'
            ),
            ''
        ),
        NULL
    );

    INSERT INTO public.erp_user_scopes (
        user_id,
        tenant_id,
        company_id,
        branch_id,
        accounting_period_id,
        is_default,
        is_active
    )
    VALUES (
        v_admin_user_id,
        v_tenant_id,
        v_company_id,
        v_branch_id,
        v_period_id,
        TRUE,
        TRUE
    );

    PERFORM
        public.initialize_provisioned_company_channel_access_v1(
            v_tenant_id,
            v_admin_user_id
        );
    INSERT INTO
    public.erp_platform_provision_audits (
        tenant_id,
        company_id,
        action,
        actor_user_id,
        metadata
    )
    VALUES (
        v_tenant_id,
        v_company_id,
        'COMPANY_PROVISIONED',
        v_actor_user_id,
        jsonb_build_object(
            'tenant_code',
            v_tenant_code,
            'company_code',
            v_company_code,
            'branch_code',
            v_branch_code,
            'period_code',
            v_period_code,
            'package_code',
            v_package_code,
            'branch_limit',
            v_branch_limit,
            'user_limit',
            v_user_limit,
            'company_admin_user_id',
            v_admin_user_id
        )
    );

    RETURN jsonb_build_object(
        'tenantId',
        v_tenant_id,
        'companyId',
        v_company_id,
        'branchId',
        v_branch_id,
        'accountingPeriodId',
        v_period_id,
        'licenseId',
        v_license_id,
        'companyAdminUserId',
        v_admin_user_id,
        'tenantCode',
        v_tenant_code,
        'companyCode',
        v_company_code,
        'companySlug',
        v_company_slug,
        'branchCode',
        v_branch_code,
        'periodCode',
        v_period_code,
        'package',
        v_package_code,
        'branchLimit',
        v_branch_limit,
        'userLimit',
        v_user_limit
    );
END;
$$;

REVOKE ALL
    ON FUNCTION
    public.provision_platform_company_v1(JSONB, TEXT)
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION
    public.provision_platform_company_v1(JSONB, TEXT)
    TO service_role;

COMMIT;