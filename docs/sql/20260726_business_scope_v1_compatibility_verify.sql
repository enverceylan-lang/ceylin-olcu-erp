-- ENVERP / Paket Mimarisi 08
-- Uyumluluk düzeltmesi sonrası salt-okunur doğrulama.

WITH target_tables(table_name) AS (
    VALUES
        ('customers'),
        ('customers_light'),
        ('draft_changes'),
        ('field_tasks'),
        ('measurements'),
        ('openings'),
        ('rooms'),
        ('measurement_changes'),
        ('measurement_jobs')
),
column_check AS (
    SELECT
        target.table_name,
        COUNT(columns.column_name) FILTER (
            WHERE columns.column_name IN (
                'tenant_id',
                'company_id',
                'branch_id',
                'accounting_period_id'
            )
              AND columns.data_type = 'uuid'
        ) AS uuid_column_count,
        COUNT(columns.column_name) FILTER (
            WHERE columns.column_name IN (
                'tenant_id',
                'company_id',
                'branch_id',
                'accounting_period_id'
            )
              AND columns.is_nullable = 'YES'
        ) AS compatible_nullable_count
    FROM target_tables AS target
    LEFT JOIN information_schema.columns AS columns
        ON columns.table_schema = 'public'
       AND columns.table_name = target.table_name
    GROUP BY target.table_name
),
constraint_check AS (
    SELECT
        target.table_name,
        COUNT(constraints.oid) FILTER (
            WHERE constraints.contype = 'f'
              AND constraints.convalidated
              AND constraints.conname IN (
                  'erp_scope_' || target.table_name || '_branch_fk',
                  'erp_scope_' || target.table_name || '_period_fk'
              )
        ) AS valid_fk_count
    FROM target_tables AS target
    LEFT JOIN pg_class AS tables
        ON tables.relname = target.table_name
       AND tables.relnamespace = 'public'::regnamespace
    LEFT JOIN pg_constraint AS constraints
        ON constraints.conrelid = tables.oid
    GROUP BY target.table_name
)
SELECT
    columns.table_name,
    columns.uuid_column_count,
    columns.compatible_nullable_count,
    constraints.valid_fk_count,
    (
        columns.uuid_column_count = 4
        AND columns.compatible_nullable_count = 4
        AND constraints.valid_fk_count = 2
    ) AS passed
FROM column_check AS columns
JOIN constraint_check AS constraints
    ON constraints.table_name = columns.table_name
ORDER BY columns.table_name;
