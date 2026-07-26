-- ENVERP — CEYLİN PERDE & ÇEYİZ ilk kapsam seed V1
--
-- DURUM: ONAYLI DEĞERLERLE HAZIRLANMIŞ TASLAK.
-- V2 tabloları oluşturulmadan çalıştırmayın.
-- Ayrı canlı uygulama onayı olmadan Supabase SQL Editor'da çalıştırmayın.
--
-- Tenant: CEYLIN
-- Şirket: CEYLIN_PERDE
-- Şube: MERKEZ
-- Dönem: 2026 (2026-01-01 / 2026-12-31)
-- Paket: PLUS
-- Varsayılan kapsam kullanıcısı: admin

BEGIN;

DO $$
DECLARE
    admin_count INTEGER;
    active_admin_count INTEGER;
BEGIN
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE "isActive" = TRUE)
    INTO admin_count, active_admin_count
    FROM public.users
    WHERE username = 'admin';

    IF admin_count <> 1 THEN
        RAISE EXCEPTION
            'Seed durduruldu: admin kullanıcı sayısı 1 olmalıdır; bulunan=%',
            admin_count;
    END IF;

    IF active_admin_count <> 1 THEN
        RAISE EXCEPTION
            'Seed durduruldu: admin kullanıcısı aktif değildir.';
    END IF;
END;
$$;

WITH tenant_row AS (
    INSERT INTO public.erp_tenants (tenant_code, name, is_active)
    VALUES ('CEYLIN', 'CEYLİN PERDE & ÇEYİZ', TRUE)
    ON CONFLICT (tenant_code) DO UPDATE
        SET name = EXCLUDED.name,
            is_active = TRUE
    RETURNING tenant_id
),
company_row AS (
    INSERT INTO public.erp_companies (
        tenant_id,
        company_code,
        name,
        is_active
    )
    SELECT
        tenant_id,
        'CEYLIN_PERDE',
        'CEYLİN PERDE & ÇEYİZ',
        TRUE
    FROM tenant_row
    ON CONFLICT (tenant_id, company_code) DO UPDATE
        SET name = EXCLUDED.name,
            is_active = TRUE
    RETURNING tenant_id, company_id
),
branch_row AS (
    INSERT INTO public.erp_branches (
        tenant_id,
        company_id,
        branch_code,
        name,
        is_active
    )
    SELECT
        tenant_id,
        company_id,
        'MERKEZ',
        'Merkez Şube',
        TRUE
    FROM company_row
    ON CONFLICT (tenant_id, company_id, branch_code) DO UPDATE
        SET name = EXCLUDED.name,
            is_active = TRUE
    RETURNING tenant_id, company_id, branch_id
),
period_row AS (
    INSERT INTO public.erp_accounting_periods (
        tenant_id,
        company_id,
        period_code,
        name,
        starts_on,
        ends_on,
        is_closed
    )
    SELECT
        tenant_id,
        company_id,
        '2026',
        '2026 Muhasebe Dönemi',
        DATE '2026-01-01',
        DATE '2026-12-31',
        FALSE
    FROM company_row
    ON CONFLICT (tenant_id, company_id, period_code) DO UPDATE
        SET name = EXCLUDED.name,
            starts_on = EXCLUDED.starts_on,
            ends_on = EXCLUDED.ends_on
    RETURNING tenant_id, company_id, accounting_period_id
),
license_row AS (
    INSERT INTO public.erp_package_licenses (
        tenant_id,
        package_code,
        starts_at,
        ends_at,
        is_active
    )
    SELECT
        tenant_id,
        'PLUS',
        TIMESTAMPTZ '2026-01-01 00:00:00+03',
        NULL,
        TRUE
    FROM tenant_row
    ON CONFLICT (tenant_id) WHERE is_active = TRUE DO UPDATE
        SET package_code = EXCLUDED.package_code,
            starts_at = EXCLUDED.starts_at,
            ends_at = NULL
    RETURNING tenant_id
),
admin_user AS (
    SELECT id AS user_id
    FROM public.users
    WHERE username = 'admin'
      AND "isActive" = TRUE
),
seed_scope AS (
    SELECT
        admin_user.user_id,
        branch_row.tenant_id,
        branch_row.company_id,
        branch_row.branch_id,
        period_row.accounting_period_id
    FROM admin_user
    CROSS JOIN branch_row
    JOIN period_row
        ON period_row.tenant_id = branch_row.tenant_id
       AND period_row.company_id = branch_row.company_id
    JOIN license_row
        ON license_row.tenant_id = branch_row.tenant_id
),
clear_other_defaults AS (
    UPDATE public.erp_user_scopes AS existing_scope
    SET is_default = FALSE
    FROM seed_scope
    WHERE existing_scope.user_id = seed_scope.user_id
      AND existing_scope.is_default = TRUE
      AND (
          existing_scope.tenant_id,
          existing_scope.company_id,
          existing_scope.branch_id,
          existing_scope.accounting_period_id
      ) IS DISTINCT FROM (
          seed_scope.tenant_id,
          seed_scope.company_id,
          seed_scope.branch_id,
          seed_scope.accounting_period_id
      )
    RETURNING existing_scope.user_scope_id
)
INSERT INTO public.erp_user_scopes (
    user_id,
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    is_default,
    is_active
)
SELECT
    user_id,
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id,
    TRUE,
    TRUE
FROM seed_scope
ON CONFLICT (
    user_id,
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id
) DO UPDATE
    SET is_default = TRUE,
        is_active = TRUE;

COMMIT;
