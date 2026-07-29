select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'users'
  and column_name in (
    'providerCustomerId',
    'providerType'
  )
order by column_name;

select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.users'::regclass
  and conname = 'users_provider_type_check';

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'users'
  and indexname in (
    'users_provider_customer_id_idx',
    'users_provider_type_idx'
  )
order by indexname;

select
  count(*) as invalid_provider_type_count
from public.users
where "providerType" is not null
  and "providerType" not in (
    'TAILOR',
    'INSTALLER'
  );

select
  count(*) as invalid_role_link_count
from public.users
where "providerCustomerId" is not null
  and (
    (
      "providerType" = 'TAILOR'
      and upper(coalesce(role, '')) not in (
        'TAILOR',
        'PRODUCTION'
      )
    )
    or
    (
      "providerType" = 'INSTALLER'
      and upper(coalesce(role, '')) not in (
        'INSTALLER',
        'INSTALLATION'
      )
    )
  );