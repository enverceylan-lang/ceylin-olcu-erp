-- ENVERP / Paket Mimarisi 08
-- Yalnız hemen geri alma için kullanılır.
-- Kapsamlı uygulama verisi yazılmaya başladıktan sonra çalıştırmayın.

BEGIN;

DO $rollback$
DECLARE
    target_table text;
    constraint_prefix text;
BEGIN
    FOREACH target_table IN ARRAY ARRAY[
        'customers',
        'customers_light',
        'draft_changes',
        'field_tasks',
        'measurements',
        'openings',
        'rooms',
        'measurement_changes',
        'measurement_jobs'
    ]
    LOOP
        constraint_prefix := 'erp_scope_' || target_table;

        EXECUTE FORMAT(
            'ALTER TABLE public.%I
                DROP CONSTRAINT IF EXISTS %I,
                DROP CONSTRAINT IF EXISTS %I',
            target_table,
            constraint_prefix || '_branch_fk',
            constraint_prefix || '_period_fk'
        );
        EXECUTE FORMAT(
            'DROP INDEX IF EXISTS public.%I',
            'idx_' || target_table || '_erp_scope'
        );
        EXECUTE FORMAT(
            'ALTER TABLE public.%I
                DROP COLUMN IF EXISTS accounting_period_id,
                DROP COLUMN IF EXISTS branch_id,
                DROP COLUMN IF EXISTS company_id,
                DROP COLUMN IF EXISTS tenant_id',
            target_table
        );
    END LOOP;
END
$rollback$;

COMMIT;
