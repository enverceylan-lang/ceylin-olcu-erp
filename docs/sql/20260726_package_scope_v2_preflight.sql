-- ENVERP — Package/Scope V2 canlı önkoşul taraması
-- SALT OKUNUR. Şema veya veri değiştirmez.
-- Beklenen: bütün satırlarda passed=true.

WITH target_tables(table_name) AS (
    VALUES
        ('erp_tenants'::text),
        ('erp_companies'::text),
        ('erp_branches'::text),
        ('erp_accounting_periods'::text),
        ('erp_package_licenses'::text),
        ('erp_user_scopes'::text)
),
checks AS (
    SELECT
        'uuid_generator_available'::text AS check_name,
        (to_regprocedure('gen_random_uuid()') IS NOT NULL) AS passed,
        CASE
            WHEN to_regprocedure('gen_random_uuid()') IS NOT NULL
                THEN 'gen_random_uuid() available'
            ELSE 'gen_random_uuid() missing'
        END::text AS detail

    UNION ALL

    SELECT
        'target_table_collision',
        COUNT(*) = 0,
        concat('existing_target_table_count=', COUNT(*))
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (SELECT table_name FROM target_tables)

    UNION ALL

    SELECT
        'users_id_is_text',
        COUNT(*) = 1,
        concat('matching_column_count=', COUNT(*))
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'id'
      AND data_type = 'text'
      AND is_nullable = 'NO'

    UNION ALL

    SELECT
        'exactly_one_active_admin',
        COUNT(*) = 1,
        concat('active_admin_count=', COUNT(*))
    FROM public.users
    WHERE username = 'admin'
      AND "isActive" = TRUE

    UNION ALL

    SELECT
        'admin_username_unique_constraint',
        COUNT(*) >= 1,
        concat('matching_unique_constraint_count=', COUNT(*))
    FROM pg_catalog.pg_constraint AS con
    JOIN pg_catalog.pg_class AS tbl
        ON tbl.oid = con.conrelid
    JOIN pg_catalog.pg_namespace AS ns
        ON ns.oid = tbl.relnamespace
    WHERE ns.nspname = 'public'
      AND tbl.relname = 'users'
      AND con.contype = 'u'
      AND pg_catalog.pg_get_constraintdef(con.oid, TRUE)
          = 'UNIQUE (username)'

    UNION ALL

    SELECT
        'service_role_exists',
        COUNT(*) = 1,
        concat('role_count=', COUNT(*))
    FROM pg_catalog.pg_roles
    WHERE rolname = 'service_role'

    UNION ALL

    SELECT
        'service_role_public_usage',
        has_schema_privilege('service_role', 'public', 'USAGE'),
        concat(
            'has_usage=',
            has_schema_privilege('service_role', 'public', 'USAGE')
        )

    UNION ALL

    SELECT
        'service_role_users_access',
        has_table_privilege(
            'service_role',
            'public.users',
            'SELECT,INSERT,UPDATE,DELETE'
        ),
        concat(
            'has_required_access=',
            has_table_privilege(
                'service_role',
                'public.users',
                'SELECT,INSERT,UPDATE,DELETE'
            )
        )

    UNION ALL

    SELECT
        'unsafe_open_policy_count',
        COUNT(*) = 0,
        concat('unsafe_policy_count=', COUNT(*))
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND cmd = 'ALL'
      AND coalesce(qual, '') = 'true'
      AND coalesce(with_check, '') = 'true'

    UNION ALL

    SELECT
        'anon_sensitive_users_select_closed',
        NOT has_column_privilege(
            'anon',
            'public.users',
            'password',
            'SELECT'
        ),
        concat(
            'anon_password_select=',
            has_column_privilege(
                'anon',
                'public.users',
                'password',
                'SELECT'
            )
        )
)
SELECT
    check_name,
    passed,
    detail
FROM checks
ORDER BY check_name;
