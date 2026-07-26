-- ENVERP — CEYLİN ilk kapsam seed doğrulaması
-- SALT OKUNUR. Kişisel veri ve parola döndürmez.

WITH checks AS (
    SELECT
        'tenant'::text AS check_name,
        COUNT(*) AS actual_count,
        1::bigint AS expected_count
    FROM public.erp_tenants
    WHERE tenant_code = 'CEYLIN'
      AND name = 'CEYLİN PERDE & ÇEYİZ'
      AND is_active = TRUE

    UNION ALL

    SELECT
        'company',
        COUNT(*),
        1::bigint
    FROM public.erp_companies AS company
    JOIN public.erp_tenants AS tenant
        ON tenant.tenant_id = company.tenant_id
    WHERE tenant.tenant_code = 'CEYLIN'
      AND company.company_code = 'CEYLIN_PERDE'
      AND company.is_active = TRUE

    UNION ALL

    SELECT
        'branch',
        COUNT(*),
        1::bigint
    FROM public.erp_branches AS branch
    JOIN public.erp_companies AS company
        ON company.company_id = branch.company_id
       AND company.tenant_id = branch.tenant_id
    JOIN public.erp_tenants AS tenant
        ON tenant.tenant_id = branch.tenant_id
    WHERE tenant.tenant_code = 'CEYLIN'
      AND company.company_code = 'CEYLIN_PERDE'
      AND branch.branch_code = 'MERKEZ'
      AND branch.is_active = TRUE

    UNION ALL

    SELECT
        'period',
        COUNT(*),
        1::bigint
    FROM public.erp_accounting_periods AS period
    JOIN public.erp_companies AS company
        ON company.company_id = period.company_id
       AND company.tenant_id = period.tenant_id
    WHERE company.company_code = 'CEYLIN_PERDE'
      AND period.period_code = '2026'
      AND period.starts_on = DATE '2026-01-01'
      AND period.ends_on = DATE '2026-12-31'

    UNION ALL

    SELECT
        'active_plus_license',
        COUNT(*),
        1::bigint
    FROM public.erp_package_licenses AS license
    JOIN public.erp_tenants AS tenant
        ON tenant.tenant_id = license.tenant_id
    WHERE tenant.tenant_code = 'CEYLIN'
      AND license.package_code = 'PLUS'
      AND license.is_active = TRUE

    UNION ALL

    SELECT
        'admin_default_scope',
        COUNT(*),
        1::bigint
    FROM public.erp_user_scopes AS scope
    JOIN public.users AS app_user
        ON app_user.id = scope.user_id
    JOIN public.erp_tenants AS tenant
        ON tenant.tenant_id = scope.tenant_id
    JOIN public.erp_companies AS company
        ON company.company_id = scope.company_id
       AND company.tenant_id = scope.tenant_id
    JOIN public.erp_branches AS branch
        ON branch.branch_id = scope.branch_id
       AND branch.company_id = scope.company_id
       AND branch.tenant_id = scope.tenant_id
    JOIN public.erp_accounting_periods AS period
        ON period.accounting_period_id = scope.accounting_period_id
       AND period.company_id = scope.company_id
       AND period.tenant_id = scope.tenant_id
    WHERE app_user.username = 'admin'
      AND tenant.tenant_code = 'CEYLIN'
      AND company.company_code = 'CEYLIN_PERDE'
      AND branch.branch_code = 'MERKEZ'
      AND period.period_code = '2026'
      AND scope.is_default = TRUE
      AND scope.is_active = TRUE
)
SELECT
    check_name,
    actual_count,
    expected_count,
    (actual_count = expected_count) AS passed
FROM checks
ORDER BY check_name;
