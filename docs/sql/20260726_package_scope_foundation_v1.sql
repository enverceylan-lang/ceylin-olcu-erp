-- ENVERP - Package and Scope Foundation V1
--
-- DURUM: TASLAK. CANLI SUPABASE'E UYGULANMAYACAKTIR.
-- Canlı tablo envanteri, yedek, geri alma provası ve kullanıcı onayı olmadan
-- bu dosyayı SQL Editor veya migration aracıyla çalıştırmayın.
--
-- Bu taslak mevcut customers/sales/measurements tablolarını değiştirmez.
-- Önce organizasyon ve lisans omurgasını ayrı, kapalı tablolar olarak kurar.

BEGIN;

CREATE TABLE IF NOT EXISTS public.erp_tenants (
    tenant_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT erp_tenant_id_not_blank CHECK (BTRIM(tenant_id) <> ''),
    CONSTRAINT erp_tenant_name_not_blank CHECK (BTRIM(name) <> '')
);

CREATE TABLE IF NOT EXISTS public.erp_companies (
    company_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL
        REFERENCES public.erp_tenants(tenant_id)
        ON DELETE RESTRICT,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT erp_company_id_not_blank CHECK (BTRIM(company_id) <> ''),
    CONSTRAINT erp_company_name_not_blank CHECK (BTRIM(name) <> ''),
    CONSTRAINT erp_company_tenant_unique UNIQUE (tenant_id, company_id)
);

CREATE TABLE IF NOT EXISTS public.erp_branches (
    branch_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT erp_branch_company_fk
        FOREIGN KEY (tenant_id, company_id)
        REFERENCES public.erp_companies(tenant_id, company_id)
        ON DELETE RESTRICT,
    CONSTRAINT erp_branch_id_not_blank CHECK (BTRIM(branch_id) <> ''),
    CONSTRAINT erp_branch_name_not_blank CHECK (BTRIM(name) <> ''),
    CONSTRAINT erp_branch_scope_unique
        UNIQUE (tenant_id, company_id, branch_id)
);

CREATE TABLE IF NOT EXISTS public.erp_accounting_periods (
    accounting_period_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
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
    CONSTRAINT erp_period_dates_valid CHECK (ends_on >= starts_on),
    CONSTRAINT erp_period_scope_unique
        UNIQUE (tenant_id, company_id, accounting_period_id)
);

CREATE TABLE IF NOT EXISTS public.erp_package_licenses (
    license_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL
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

CREATE UNIQUE INDEX IF NOT EXISTS erp_one_active_license_per_tenant
    ON public.erp_package_licenses (tenant_id)
    WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.erp_user_scopes (
    user_scope_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    accounting_period_id TEXT NOT NULL,
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

ALTER TABLE public.erp_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_package_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_user_scopes ENABLE ROW LEVEL SECURITY;

-- Politika bilinçli olarak eklenmemiştir. RLS açık ve politika yokken doğrudan
-- istemci erişimi kapalı kalır. Yalnız ayrıca denetlenen sunucu API'leri
-- service_role üzerinden erişmelidir.

COMMIT;
