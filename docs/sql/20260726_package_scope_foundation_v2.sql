-- ENVERP — Package and Scope Foundation V2
--
-- DURUM: TASLAK. CANLI SUPABASE'E UYGULANMAYACAKTIR.
-- V1 yerine geçer; V1 canlıya uygulanmadığı varsayılır.
--
-- Anahtar stratejisi:
-- - Teknik kimlikler global UUID'dir.
-- - İnsan tarafından kullanılan kodlar tenant/şirket kapsamında unique'tir.
-- - Uygulamadaki ErpScope teknik kimlikleri string olarak taşımaya devam eder.
-- - Mevcut iş tabloları bu migration'da değiştirilmez.

BEGIN;

CREATE TABLE IF NOT EXISTS public.erp_tenants (
    tenant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT erp_tenant_code_not_blank CHECK (BTRIM(tenant_code) <> ''),
    CONSTRAINT erp_tenant_name_not_blank CHECK (BTRIM(name) <> ''),
    CONSTRAINT erp_tenant_code_unique UNIQUE (tenant_code)
);

CREATE TABLE IF NOT EXISTS public.erp_companies (
    company_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES public.erp_tenants(tenant_id)
        ON DELETE RESTRICT,
    company_code TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT erp_company_code_not_blank CHECK (BTRIM(company_code) <> ''),
    CONSTRAINT erp_company_name_not_blank CHECK (BTRIM(name) <> ''),
    CONSTRAINT erp_company_code_in_tenant_unique
        UNIQUE (tenant_id, company_code),
    CONSTRAINT erp_company_tenant_identity_unique
        UNIQUE (tenant_id, company_id)
);

CREATE TABLE IF NOT EXISTS public.erp_branches (
    branch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    company_id UUID NOT NULL,
    branch_code TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT erp_branch_company_fk
        FOREIGN KEY (tenant_id, company_id)
        REFERENCES public.erp_companies(tenant_id, company_id)
        ON DELETE RESTRICT,
    CONSTRAINT erp_branch_code_not_blank CHECK (BTRIM(branch_code) <> ''),
    CONSTRAINT erp_branch_name_not_blank CHECK (BTRIM(name) <> ''),
    CONSTRAINT erp_branch_code_in_company_unique
        UNIQUE (tenant_id, company_id, branch_code),
    CONSTRAINT erp_branch_scope_identity_unique
        UNIQUE (tenant_id, company_id, branch_id)
);

CREATE TABLE IF NOT EXISTS public.erp_accounting_periods (
    accounting_period_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    company_id UUID NOT NULL,
    period_code TEXT NOT NULL,
    name TEXT NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT erp_period_company_fk
        FOREIGN KEY (tenant_id, company_id)
        REFERENCES public.erp_companies(tenant_id, company_id)
        ON DELETE RESTRICT,
    CONSTRAINT erp_period_code_not_blank CHECK (BTRIM(period_code) <> ''),
    CONSTRAINT erp_period_name_not_blank CHECK (BTRIM(name) <> ''),
    CONSTRAINT erp_period_dates_valid CHECK (ends_on >= starts_on),
    CONSTRAINT erp_period_code_in_company_unique
        UNIQUE (tenant_id, company_id, period_code),
    CONSTRAINT erp_period_scope_identity_unique
        UNIQUE (tenant_id, company_id, accounting_period_id)
);

CREATE TABLE IF NOT EXISTS public.erp_package_licenses (
    license_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES public.erp_tenants(tenant_id)
        ON DELETE RESTRICT,
    package_code TEXT NOT NULL
        CHECK (package_code IN ('ECO', 'NORMAL', 'PLUS')),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    feature_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT erp_license_dates_valid
        CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS erp_one_enabled_license_per_tenant
    ON public.erp_package_licenses (tenant_id)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS erp_license_validity_lookup_idx
    ON public.erp_package_licenses (tenant_id, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS public.erp_user_scopes (
    user_scope_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL
        REFERENCES public.users(id)
        ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    company_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    accounting_period_id UUID NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT erp_user_scope_branch_fk
        FOREIGN KEY (tenant_id, company_id, branch_id)
        REFERENCES public.erp_branches(tenant_id, company_id, branch_id)
        ON DELETE RESTRICT,
    CONSTRAINT erp_user_scope_period_fk
        FOREIGN KEY (tenant_id, company_id, accounting_period_id)
        REFERENCES public.erp_accounting_periods(
            tenant_id,
            company_id,
            accounting_period_id
        )
        ON DELETE RESTRICT,
    CONSTRAINT erp_user_scope_unique
        UNIQUE (
            user_id,
            tenant_id,
            company_id,
            branch_id,
            accounting_period_id
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS erp_one_default_scope_per_user
    ON public.erp_user_scopes (user_id)
    WHERE is_default = TRUE AND is_active = TRUE;

CREATE INDEX IF NOT EXISTS erp_user_scope_lookup_idx
    ON public.erp_user_scopes (
        tenant_id,
        company_id,
        branch_id,
        accounting_period_id,
        user_id
    )
    WHERE is_active = TRUE;

CREATE OR REPLACE FUNCTION public.set_erp_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_erp_tenants_updated_at
    BEFORE UPDATE ON public.erp_tenants
    FOR EACH ROW EXECUTE FUNCTION public.set_erp_updated_at();

CREATE TRIGGER trg_erp_companies_updated_at
    BEFORE UPDATE ON public.erp_companies
    FOR EACH ROW EXECUTE FUNCTION public.set_erp_updated_at();

CREATE TRIGGER trg_erp_branches_updated_at
    BEFORE UPDATE ON public.erp_branches
    FOR EACH ROW EXECUTE FUNCTION public.set_erp_updated_at();

CREATE TRIGGER trg_erp_periods_updated_at
    BEFORE UPDATE ON public.erp_accounting_periods
    FOR EACH ROW EXECUTE FUNCTION public.set_erp_updated_at();

CREATE TRIGGER trg_erp_licenses_updated_at
    BEFORE UPDATE ON public.erp_package_licenses
    FOR EACH ROW EXECUTE FUNCTION public.set_erp_updated_at();

CREATE TRIGGER trg_erp_user_scopes_updated_at
    BEFORE UPDATE ON public.erp_user_scopes
    FOR EACH ROW EXECUTE FUNCTION public.set_erp_updated_at();

ALTER TABLE public.erp_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_package_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_user_scopes ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.erp_tenants FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.erp_companies FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.erp_branches FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.erp_accounting_periods FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.erp_package_licenses FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.erp_user_scopes FROM anon, authenticated;

COMMIT;
