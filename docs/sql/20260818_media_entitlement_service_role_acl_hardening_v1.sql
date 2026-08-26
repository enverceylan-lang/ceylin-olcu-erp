BEGIN;

DO $$
BEGIN
  IF to_regclass('public.erp_platform_feature_switches') IS NULL THEN
    RAISE EXCEPTION 'MEDIA_ENTITLEMENT_ACL_HARDENING_RELATION_MISSING: erp_platform_feature_switches';
  END IF;

  IF to_regclass('public.erp_company_feature_entitlements') IS NULL THEN
    RAISE EXCEPTION 'MEDIA_ENTITLEMENT_ACL_HARDENING_RELATION_MISSING: erp_company_feature_entitlements';
  END IF;

  IF to_regclass('public.erp_feature_entitlement_audits') IS NULL THEN
    RAISE EXCEPTION 'MEDIA_ENTITLEMENT_ACL_HARDENING_RELATION_MISSING: erp_feature_entitlement_audits';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'service_role'
  ) THEN
    RAISE EXCEPTION 'MEDIA_ENTITLEMENT_ACL_HARDENING_ROLE_MISSING: service_role';
  END IF;
END
$$;

REVOKE ALL PRIVILEGES
ON TABLE public.erp_platform_feature_switches
FROM service_role;

REVOKE ALL PRIVILEGES
ON TABLE public.erp_company_feature_entitlements
FROM service_role;

REVOKE ALL PRIVILEGES
ON TABLE public.erp_feature_entitlement_audits
FROM service_role;

GRANT SELECT
ON TABLE public.erp_platform_feature_switches
TO service_role;

GRANT SELECT
ON TABLE public.erp_company_feature_entitlements
TO service_role;

DO $$
DECLARE
  v_total integer;
  v_expected_select integer;
  v_audit_direct integer;
  v_direct_dml integer;
BEGIN
  SELECT count(*)
  INTO v_total
  FROM information_schema.role_table_grants
  WHERE grantee = 'service_role'
    AND table_schema = 'public'
    AND table_name IN (
      'erp_platform_feature_switches',
      'erp_company_feature_entitlements',
      'erp_feature_entitlement_audits'
    );

  SELECT count(*)
  INTO v_expected_select
  FROM information_schema.role_table_grants
  WHERE grantee = 'service_role'
    AND table_schema = 'public'
    AND privilege_type = 'SELECT'
    AND table_name IN (
      'erp_platform_feature_switches',
      'erp_company_feature_entitlements'
    );

  SELECT count(*)
  INTO v_audit_direct
  FROM information_schema.role_table_grants
  WHERE grantee = 'service_role'
    AND table_schema = 'public'
    AND table_name = 'erp_feature_entitlement_audits';

  SELECT count(*)
  INTO v_direct_dml
  FROM information_schema.role_table_grants
  WHERE grantee = 'service_role'
    AND table_schema = 'public'
    AND table_name IN (
      'erp_platform_feature_switches',
      'erp_company_feature_entitlements',
      'erp_feature_entitlement_audits'
    )
    AND privilege_type IN (
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE',
      'REFERENCES',
      'TRIGGER'
    );

  IF v_total <> 2 THEN
    RAISE EXCEPTION 'MEDIA_ENTITLEMENT_ACL_HARDENING_POSTCHECK_TOTAL_PRIVILEGES: %', v_total;
  END IF;

  IF v_expected_select <> 2 THEN
    RAISE EXCEPTION 'MEDIA_ENTITLEMENT_ACL_HARDENING_POSTCHECK_SELECT_PRIVILEGES: %', v_expected_select;
  END IF;

  IF v_audit_direct <> 0 THEN
    RAISE EXCEPTION 'MEDIA_ENTITLEMENT_ACL_HARDENING_POSTCHECK_AUDIT_PRIVILEGES: %', v_audit_direct;
  END IF;

  IF v_direct_dml <> 0 THEN
    RAISE EXCEPTION 'MEDIA_ENTITLEMENT_ACL_HARDENING_POSTCHECK_DIRECT_DML: %', v_direct_dml;
  END IF;
END
$$;

COMMIT;