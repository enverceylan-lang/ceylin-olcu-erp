-- ENVERP — İlk organizasyon/paket seed şablonu
-- DURUM: TASLAK. DEĞERLER ONAYLANMADAN ÇALIŞTIRMAYIN.
--
-- Bu dosya psql değişkeni kullanmaz; Supabase SQL Editor ile uyumludur.
-- Aşağıdaki altı __ONAY_BEKLIYOR__ değerinin tamamı değiştirilmeden işlem
-- bilinçli olarak durur. Kullanıcı kapsamı mevcut users.id ile bağlanır.

DO $$
BEGIN
    IF '__TENANT_CODE_ONAY_BEKLIYOR__' LIKE '%ONAY_BEKLIYOR%'
       OR '__COMPANY_CODE_ONAY_BEKLIYOR__' LIKE '%ONAY_BEKLIYOR%'
       OR '__BRANCH_CODE_ONAY_BEKLIYOR__' LIKE '%ONAY_BEKLIYOR%'
       OR '__PERIOD_CODE_ONAY_BEKLIYOR__' LIKE '%ONAY_BEKLIYOR%'
       OR '__PACKAGE_ONAY_BEKLIYOR__' LIKE '%ONAY_BEKLIYOR%'
       OR '__USER_ID_ONAY_BEKLIYOR__' LIKE '%ONAY_BEKLIYOR%' THEN
        RAISE EXCEPTION 'Seed değerleri onaylanmadı; işlem uygulanmadı.';
    END IF;
END;
$$;

BEGIN;

WITH tenant_row AS (
    INSERT INTO public.erp_tenants (tenant_code, name)
    VALUES ('__TENANT_CODE_ONAY_BEKLIYOR__', '__TENANT_NAME_ONAY_BEKLIYOR__')
    ON CONFLICT (tenant_code) DO UPDATE
        SET name = EXCLUDED.name
    RETURNING tenant_id
),
company_row AS (
    INSERT INTO public.erp_companies (
        tenant_id,
        company_code,
        name
    )
    SELECT
        tenant_id,
        '__COMPANY_CODE_ONAY_BEKLIYOR__',
        '__COMPANY_NAME_ONAY_BEKLIYOR__'
    FROM tenant_row
    ON CONFLICT (tenant_id, company_code) DO UPDATE
        SET name = EXCLUDED.name
    RETURNING tenant_id, company_id
),
branch_row AS (
    INSERT INTO public.erp_branches (
        tenant_id,
        company_id,
        branch_code,
        name
    )
    SELECT
        tenant_id,
        company_id,
        '__BRANCH_CODE_ONAY_BEKLIYOR__',
        '__BRANCH_NAME_ONAY_BEKLIYOR__'
    FROM company_row
    ON CONFLICT (tenant_id, company_id, branch_code) DO UPDATE
        SET name = EXCLUDED.name
    RETURNING tenant_id, company_id, branch_id
),
period_row AS (
    INSERT INTO public.erp_accounting_periods (
        tenant_id,
        company_id,
        period_code,
        name,
        starts_on,
        ends_on
    )
    SELECT
        tenant_id,
        company_id,
        '__PERIOD_CODE_ONAY_BEKLIYOR__',
        '__PERIOD_NAME_ONAY_BEKLIYOR__',
        DATE '__START_DATE_ONAY_BEKLIYOR__',
        DATE '__END_DATE_ONAY_BEKLIYOR__'
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
        is_active
    )
    SELECT
        tenant_id,
        '__PACKAGE_ONAY_BEKLIYOR__',
        NOW(),
        TRUE
    FROM tenant_row
    ON CONFLICT (tenant_id) WHERE is_active = TRUE DO UPDATE
        SET package_code = EXCLUDED.package_code,
            starts_at = EXCLUDED.starts_at
    RETURNING tenant_id
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
    '__USER_ID_ONAY_BEKLIYOR__',
    branch_row.tenant_id,
    branch_row.company_id,
    branch_row.branch_id,
    period_row.accounting_period_id,
    TRUE,
    TRUE
FROM branch_row
JOIN period_row
    ON period_row.tenant_id = branch_row.tenant_id
   AND period_row.company_id = branch_row.company_id
JOIN license_row
    ON license_row.tenant_id = branch_row.tenant_id
ON CONFLICT (
    user_id,
    tenant_id,
    company_id,
    branch_id,
    accounting_period_id
) DO UPDATE
    SET is_default = EXCLUDED.is_default,
        is_active = EXCLUDED.is_active;

COMMIT;
