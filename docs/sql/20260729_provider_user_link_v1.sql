begin;

alter table public.users
  add column if not exists "providerCustomerId" text null;

alter table public.users
  add column if not exists "providerType" text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_provider_type_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_provider_type_check
      check (
        "providerType" is null
        or "providerType" in ('TAILOR', 'INSTALLER')
      );
  end if;
end
$$;

create index if not exists users_provider_customer_id_idx
  on public.users ("providerCustomerId")
  where "providerCustomerId" is not null;

create index if not exists users_provider_type_idx
  on public.users ("providerType")
  where "providerType" is not null;

update public.users
set
  "providerCustomerId" = null,
  "providerType" = null
where upper(coalesce(role, '')) not in (
  'TAILOR',
  'PRODUCTION',
  'INSTALLER',
  'INSTALLATION'
)
and (
  "providerCustomerId" is not null
  or "providerType" is not null
);

update public.users
set "providerType" = 'TAILOR'
where upper(coalesce(role, '')) in (
  'TAILOR',
  'PRODUCTION'
)
and "providerCustomerId" is not null
and "providerType" is null;

update public.users
set "providerType" = 'INSTALLER'
where upper(coalesce(role, '')) in (
  'INSTALLER',
  'INSTALLATION'
)
and "providerCustomerId" is not null
and "providerType" is null;

comment on column public.users."providerCustomerId" is
  'Linked TAILOR or INSTALLER cari/customer record id. Null means no provider account link.';

comment on column public.users."providerType" is
  'Provider account type: TAILOR or INSTALLER. Must match normalized user role.';

commit;