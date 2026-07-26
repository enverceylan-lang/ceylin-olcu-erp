-- ENVERP / Paket Mimarisi 08
-- Canlı iş verisi kapsam migrasyonu.
-- Açık canlı yazma onayı ve doğrulanmış yedek olmadan çalıştırmayın.

BEGIN;

DO $preflight$
DECLARE
    target_table text;
    missing_tables text[] := ARRAY[]::text[];
    distinct_scope_count integer;
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
        IF TO_REGCLASS('public.' || target_table) IS NULL THEN
            missing_tables := ARRAY_APPEND(missing_tables, target_table);
        END IF;
    END LOOP;

    IF CARDINALITY(missing_tables) > 0 THEN
        RAISE EXCEPTION
            'Required target tables are missing: %',
            ARRAY_TO_STRING(missing_tables, ', ');
    END IF;

    SELECT COUNT(*)
    INTO distinct_scope_count
    FROM (
        SELECT DISTINCT
            tenant_id,
            company_id,
            branch_id,
            accounting_period_id
        FROM public.erp_user_scopes
        WHERE is_active = TRUE
          AND is_default = TRUE
    ) AS active_default_scopes;

    IF distinct_scope_count <> 1 THEN
        RAISE EXCEPTION
            'Expected exactly one distinct active default scope, found %',
            distinct_scope_count;
    END IF;
END
$preflight$;

DO $migration$
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
                ADD COLUMN IF NOT EXISTS tenant_id uuid,
                ADD COLUMN IF NOT EXISTS company_id uuid,
                ADD COLUMN IF NOT EXISTS branch_id uuid,
                ADD COLUMN IF NOT EXISTS accounting_period_id uuid',
            target_table
        );

        EXECUTE FORMAT(
            'WITH default_scope AS (
                SELECT DISTINCT
                    tenant_id,
                    company_id,
                    branch_id,
                    accounting_period_id
                FROM public.erp_user_scopes
                WHERE is_active = TRUE
                  AND is_default = TRUE
            )
            UPDATE public.%I AS target
            SET
                tenant_id = COALESCE(target.tenant_id, scope.tenant_id),
                company_id = COALESCE(target.company_id, scope.company_id),
                branch_id = COALESCE(target.branch_id, scope.branch_id),
                accounting_period_id = COALESCE(
                    target.accounting_period_id,
                    scope.accounting_period_id
                )
            FROM default_scope AS scope
            WHERE target.tenant_id IS NULL
               OR target.company_id IS NULL
               OR target.branch_id IS NULL
               OR target.accounting_period_id IS NULL',
            target_table
        );

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = FORMAT('public.%I', target_table)::regclass
              AND conname = constraint_prefix || '_branch_fk'
        ) THEN
            EXECUTE FORMAT(
                'ALTER TABLE public.%I
                    ADD CONSTRAINT %I
                    FOREIGN KEY (tenant_id, company_id, branch_id)
                    REFERENCES public.erp_branches(
                        tenant_id,
                        company_id,
                        branch_id
                    )
                    NOT VALID',
                target_table,
                constraint_prefix || '_branch_fk'
            );
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = FORMAT('public.%I', target_table)::regclass
              AND conname = constraint_prefix || '_period_fk'
        ) THEN
            EXECUTE FORMAT(
                'ALTER TABLE public.%I
                    ADD CONSTRAINT %I
                    FOREIGN KEY (
                        tenant_id,
                        company_id,
                        accounting_period_id
                    )
                    REFERENCES public.erp_accounting_periods(
                        tenant_id,
                        company_id,
                        accounting_period_id
                    )
                    NOT VALID',
                target_table,
                constraint_prefix || '_period_fk'
            );
        END IF;

        EXECUTE FORMAT(
            'ALTER TABLE public.%I VALIDATE CONSTRAINT %I',
            target_table,
            constraint_prefix || '_branch_fk'
        );
        EXECUTE FORMAT(
            'ALTER TABLE public.%I VALIDATE CONSTRAINT %I',
            target_table,
            constraint_prefix || '_period_fk'
        );

        EXECUTE FORMAT(
            'CREATE INDEX IF NOT EXISTS %I
             ON public.%I (
                tenant_id,
                company_id,
                branch_id,
                accounting_period_id
             )',
            'idx_' || target_table || '_erp_scope',
            target_table
        );
    END LOOP;
END
$migration$;

COMMIT;
