-- ENVERP / Paket Mimarisi 10
-- Dağıtım öncesi/sonrası salt-okunur canlı kapsam kontrolü.

SELECT
    'customers'::text AS table_name,
    COUNT(*)::bigint AS total_rows,
    COUNT(*) FILTER (
        WHERE tenant_id IS NULL
           OR company_id IS NULL
           OR branch_id IS NULL
           OR accounting_period_id IS NULL
    )::bigint AS unscoped_rows
FROM public.customers
UNION ALL
SELECT 'customers_light', COUNT(*), COUNT(*) FILTER (
    WHERE tenant_id IS NULL OR company_id IS NULL
       OR branch_id IS NULL OR accounting_period_id IS NULL
) FROM public.customers_light
UNION ALL
SELECT 'draft_changes', COUNT(*), COUNT(*) FILTER (
    WHERE tenant_id IS NULL OR company_id IS NULL
       OR branch_id IS NULL OR accounting_period_id IS NULL
) FROM public.draft_changes
UNION ALL
SELECT 'field_tasks', COUNT(*), COUNT(*) FILTER (
    WHERE tenant_id IS NULL OR company_id IS NULL
       OR branch_id IS NULL OR accounting_period_id IS NULL
) FROM public.field_tasks
UNION ALL
SELECT 'measurements', COUNT(*), COUNT(*) FILTER (
    WHERE tenant_id IS NULL OR company_id IS NULL
       OR branch_id IS NULL OR accounting_period_id IS NULL
) FROM public.measurements
UNION ALL
SELECT 'openings', COUNT(*), COUNT(*) FILTER (
    WHERE tenant_id IS NULL OR company_id IS NULL
       OR branch_id IS NULL OR accounting_period_id IS NULL
) FROM public.openings
UNION ALL
SELECT 'rooms', COUNT(*), COUNT(*) FILTER (
    WHERE tenant_id IS NULL OR company_id IS NULL
       OR branch_id IS NULL OR accounting_period_id IS NULL
) FROM public.rooms
UNION ALL
SELECT 'measurement_changes', COUNT(*), COUNT(*) FILTER (
    WHERE tenant_id IS NULL OR company_id IS NULL
       OR branch_id IS NULL OR accounting_period_id IS NULL
) FROM public.measurement_changes
UNION ALL
SELECT 'measurement_jobs', COUNT(*), COUNT(*) FILTER (
    WHERE tenant_id IS NULL OR company_id IS NULL
       OR branch_id IS NULL OR accounting_period_id IS NULL
) FROM public.measurement_jobs
ORDER BY table_name;
