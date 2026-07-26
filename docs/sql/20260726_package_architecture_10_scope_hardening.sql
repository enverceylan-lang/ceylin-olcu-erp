-- ENVERP / Paket Mimarisi 10
-- Yalnız yeni uygulama sürümü canlı smoke testlerini geçtikten sonra çalıştırın.

BEGIN;

DO $hardening$
DECLARE
    target_table text;
    unscoped_count bigint;
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
        EXECUTE FORMAT(
            'SELECT COUNT(*) FROM public.%I
             WHERE tenant_id IS NULL
                OR company_id IS NULL
                OR branch_id IS NULL
                OR accounting_period_id IS NULL',
            target_table
        ) INTO unscoped_count;

        IF unscoped_count <> 0 THEN
            RAISE EXCEPTION
                'Table % has % unscoped rows',
                target_table,
                unscoped_count;
        END IF;

        EXECUTE FORMAT(
            'ALTER TABLE public.%I
                ALTER COLUMN tenant_id SET NOT NULL,
                ALTER COLUMN company_id SET NOT NULL,
                ALTER COLUMN branch_id SET NOT NULL,
                ALTER COLUMN accounting_period_id SET NOT NULL',
            target_table
        );
    END LOOP;
END
$hardening$;

COMMIT;
