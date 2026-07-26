-- ENVERP / Paket Mimarisi 08
-- Salt-okunur canlı iş verisi kapsam envanteri.
-- Bu sorgu şema veya veri değiştirmez.

WITH candidate_tables(table_name, domain_name, scope_priority) AS (
    VALUES
        ('customers', 'CUSTOMER', 1),
        ('customers_light', 'CUSTOMER_SYNC', 2),
        ('rooms', 'MEASUREMENT', 1),
        ('openings', 'MEASUREMENT', 1),
        ('measurements', 'MEASUREMENT', 1),
        ('measurement_jobs', 'MEASUREMENT_SYNC', 2),
        ('measurement_changes', 'MEASUREMENT_SYNC', 2),
        ('draft_changes', 'DRAFT_SYNC', 3),
        ('field_tasks', 'FIELD_TASK', 1),
        ('sales_sync_records', 'SALES', 1),
        ('sale_sync_payments', 'FINANCE', 1),
        ('sales_sync_changes', 'SALES_SYNC', 2),
        ('transfer_receipts', 'TRANSFER', 2),
        ('stock_items', 'STOCK', 1),
        ('stock_lots', 'STOCK', 1),
        ('stock_reservations', 'STOCK', 1),
        ('production_orders', 'PRODUCTION', 1),
        ('tailor_work_orders', 'PRODUCTION', 1),
        ('installation_tasks', 'INSTALLATION', 1),
        ('customer_finance_entries', 'FINANCE', 1)
),
table_inventory AS (
    SELECT
        candidate.domain_name,
        candidate.table_name,
        candidate.scope_priority,
        tables.table_name IS NOT NULL AS table_exists,
        COALESCE(stats.n_live_tup, 0)::bigint AS estimated_row_count,
        COUNT(columns.column_name) FILTER (
            WHERE columns.column_name IN (
                'tenant_id',
                'company_id',
                'branch_id',
                'accounting_period_id'
            )
        )::integer AS existing_scope_column_count,
        STRING_AGG(
            columns.column_name || ':' || columns.data_type,
            ', ' ORDER BY columns.ordinal_position
        ) FILTER (
            WHERE columns.column_name IN (
                'tenant_id',
                'company_id',
                'branch_id',
                'accounting_period_id'
            )
        ) AS existing_scope_columns
    FROM candidate_tables AS candidate
    LEFT JOIN information_schema.tables AS tables
        ON tables.table_schema = 'public'
       AND tables.table_name = candidate.table_name
       AND tables.table_type = 'BASE TABLE'
    LEFT JOIN pg_stat_user_tables AS stats
        ON stats.schemaname = 'public'
       AND stats.relname = candidate.table_name
    LEFT JOIN information_schema.columns AS columns
        ON columns.table_schema = 'public'
       AND columns.table_name = candidate.table_name
    GROUP BY
        candidate.domain_name,
        candidate.table_name,
        candidate.scope_priority,
        tables.table_name,
        stats.n_live_tup
),
default_scope AS (
    SELECT
        COUNT(*)::bigint AS default_scope_count,
        COUNT(DISTINCT tenant_id)::bigint AS tenant_count,
        COUNT(DISTINCT company_id)::bigint AS company_count,
        COUNT(DISTINCT branch_id)::bigint AS branch_count,
        COUNT(DISTINCT accounting_period_id)::bigint AS period_count
    FROM public.erp_user_scopes
    WHERE is_active = TRUE
      AND is_default = TRUE
),
foundation AS (
    SELECT
        TO_REGCLASS('public.erp_tenants') IS NOT NULL
            AS tenants_exists,
        TO_REGCLASS('public.erp_companies') IS NOT NULL
            AS companies_exists,
        TO_REGCLASS('public.erp_branches') IS NOT NULL
            AS branches_exists,
        TO_REGCLASS('public.erp_accounting_periods') IS NOT NULL
            AS periods_exists,
        TO_REGCLASS('public.erp_user_scopes') IS NOT NULL
            AS user_scopes_exists
)
SELECT
    '01_FOUNDATION'::text AS category,
    'ERP_SCOPE_FOUNDATION'::text AS domain_name,
    'erp_scope_tables'::text AS object_name,
    CASE
        WHEN foundation.tenants_exists
         AND foundation.companies_exists
         AND foundation.branches_exists
         AND foundation.periods_exists
         AND foundation.user_scopes_exists
        THEN 'READY'
        ELSE 'BLOCKED'
    END::text AS status,
    CONCAT(
        'default_scopes=', default_scope.default_scope_count,
        '; tenants=', default_scope.tenant_count,
        '; companies=', default_scope.company_count,
        '; branches=', default_scope.branch_count,
        '; periods=', default_scope.period_count
    )::text AS detail
FROM foundation
CROSS JOIN default_scope

UNION ALL

SELECT
    '02_TABLE_INVENTORY'::text AS category,
    inventory.domain_name::text,
    inventory.table_name::text AS object_name,
    CASE
        WHEN NOT inventory.table_exists THEN 'NOT_INSTALLED'
        WHEN inventory.existing_scope_column_count = 0 THEN 'NEEDS_SCOPE'
        WHEN inventory.existing_scope_column_count = 4 THEN 'SCOPE_PRESENT'
        ELSE 'PARTIAL_SCOPE_COLLISION'
    END::text AS status,
    CONCAT(
        'priority=', inventory.scope_priority,
        '; estimated_rows=', inventory.estimated_row_count,
        '; scope_column_count=', inventory.existing_scope_column_count,
        '; scope_columns=',
        COALESCE(inventory.existing_scope_columns, '')
    )::text AS detail
FROM table_inventory AS inventory

ORDER BY category, domain_name, object_name;
