-- ENVERP / Paket Mimarisi 08
-- Uygulama yazma yolları kapsam kolonlarını göndermeye başlayana kadar
-- yeni kayıt uyumluluğunu korur. Mevcut kapsam verisini silmez.

BEGIN;

DO $compatibility$
DECLARE
    target_table text;
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
            'ALTER TABLE public.%I
                ALTER COLUMN tenant_id DROP NOT NULL,
                ALTER COLUMN company_id DROP NOT NULL,
                ALTER COLUMN branch_id DROP NOT NULL,
                ALTER COLUMN accounting_period_id DROP NOT NULL',
            target_table
        );
    END LOOP;
END
$compatibility$;

COMMIT;
