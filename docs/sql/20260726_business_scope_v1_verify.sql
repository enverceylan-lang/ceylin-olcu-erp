-- ENVERP / Paket Mimarisi 08
-- Migrasyon sonrası salt-okunur doğrulama.

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
              AND columns.is_nullable = 'NO'
        ) AS valid_column_count
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
              AND (
                  constraints.conname =
                      'erp_scope_' || target.table_name || '_branch_fk'
                  OR constraints.conname =
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
),
index_check AS (
    SELECT
        target.table_name,
        COUNT(indexes.indexname) AS scope_index_count
    FROM target_tables AS target
    LEFT JOIN pg_indexes AS indexes
        ON indexes.schemaname = 'public'
       AND indexes.tablename = target.table_name
       AND indexes.indexname =
           'idx_' || target.table_name || '_erp_scope'
    GROUP BY target.table_name
)
SELECT
    columns.table_name,
    columns.valid_column_count,
    constraints.valid_fk_count,
    indexes.scope_index_count,
    (
        columns.valid_column_count = 4
        AND constraints.valid_fk_count = 2
        AND indexes.scope_index_count = 1
    ) AS passed
FROM column_check AS columns
JOIN constraint_check AS constraints
    ON constraints.table_name = columns.table_name
JOIN index_check AS indexes
    ON indexes.table_name = columns.table_name
ORDER BY columns.table_name;
