-- ENVERP — PACKAGE CONTRACT RECONCILIATION V1
-- Canonical package codes: ECO | PRO | PLUS | ELITE
-- Legacy DB NORMAL migrates to PRO.
-- STANDARD is application input alias only.
-- This file is NOT applied by the PowerShell reconciliation script.

BEGIN;

DO $preflight$
DECLARE
    invalid_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO invalid_count
    FROM public.erp_package_licenses
    WHERE package_code NOT IN (
        'ECO',
        'NORMAL',
        'PRO',
        'PLUS',
        'ELITE'
    );

    IF invalid_count <> 0 THEN
        RAISE EXCEPTION
            'PACKAGE_CONTRACT_RECONCILIATION_BLOCKED:UNKNOWN_PACKAGE_COUNT=%',
            invalid_count;
    END IF;
END
$preflight$;

ALTER TABLE public.erp_package_licenses
    DROP CONSTRAINT IF EXISTS erp_package_licenses_package_code_check;

ALTER TABLE public.erp_package_licenses
    DROP CONSTRAINT IF EXISTS erp_package_license_package_code_valid;

UPDATE public.erp_package_licenses
SET
    package_code = 'PRO',
    updated_at = NOW()
WHERE package_code = 'NORMAL';

ALTER TABLE public.erp_package_licenses
    ADD CONSTRAINT erp_package_license_package_code_valid
    CHECK (
        package_code IN (
            'ECO',
            'PRO',
            'PLUS',
            'ELITE'
        )
    );

DO $verify$
DECLARE
    legacy_count BIGINT;
    invalid_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO legacy_count
    FROM public.erp_package_licenses
    WHERE package_code = 'NORMAL';

    SELECT COUNT(*)
    INTO invalid_count
    FROM public.erp_package_licenses
    WHERE package_code NOT IN (
        'ECO',
        'PRO',
        'PLUS',
        'ELITE'
    );

    IF legacy_count <> 0 OR invalid_count <> 0 THEN
        RAISE EXCEPTION
            'PACKAGE_CONTRACT_RECONCILIATION_VERIFY_FAILED';
    END IF;
END
$verify$;

COMMIT;