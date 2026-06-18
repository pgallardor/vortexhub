-- Development-only users for local Supabase.
-- Password for every user in this file: DevPassword123!
--
-- Load with:
-- psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/seeds/02_dev_users.sql

create extension if not exists pgcrypto;

create temporary table seed_dev_users (
  id uuid primary key,
  email text not null unique,
  display_name text not null,
  platform_role text
);

insert into seed_dev_users (id, email, display_name, platform_role) values
  ('00000000-0000-4000-8000-000000000001', 'platform.admin@vortexhub.local', 'Platform Admin Dev', 'platform_admin'),
  ('00000000-0000-4000-8000-000000000010', 'store.owner@vortexhub.local', 'Store Owner Dev', null),
  ('00000000-0000-4000-8000-000000000011', 'store.admin@vortexhub.local', 'Store Admin Dev', null),
  ('00000000-0000-4000-8000-000000000012', 'store.staff@vortexhub.local', 'Store Staff Dev', null);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
select
  '00000000-0000-0000-0000-000000000000',
  id,
  'authenticated',
  'authenticated',
  email,
  crypt('DevPassword123!', gen_salt('bf')),
  now(),
  now(),
  jsonb_build_object('provider', 'email', 'providers', array['email']),
  jsonb_build_object('display_name', display_name),
  now(),
  now(),
  '',
  '',
  '',
  ''
from seed_dev_users
on conflict (id) do update
set email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

do $$
declare
  seed_user seed_dev_users%rowtype;
  identity_columns text;
  identity_values text;
begin
  for seed_user in select * from seed_dev_users loop
    identity_columns := 'user_id, identity_data, provider, last_sign_in_at, created_at, updated_at';
    identity_values := format(
      '%L::uuid, %L::jsonb, %L, now(), now(), now()',
      seed_user.id,
      jsonb_build_object('sub', seed_user.id::text, 'email', seed_user.email)::text,
      'email'
    );

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'identities'
        and column_name = 'id'
        and is_generated = 'NEVER'
    ) then
      identity_columns := 'id, ' || identity_columns;
      identity_values := format('%L, %s', seed_user.id::text, identity_values);
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'identities'
        and column_name = 'provider_id'
        and is_generated = 'NEVER'
    ) then
      identity_columns := replace(identity_columns, 'user_id,', 'provider_id, user_id,');
      identity_values := format('%L, %s', seed_user.id::text, identity_values);
    end if;

    execute format(
      'insert into auth.identities (%s) values (%s) on conflict do nothing',
      identity_columns,
      identity_values
    );
  end loop;
end $$;

insert into public.user_accounts (id, display_name, status)
select id, display_name, 'active'
from seed_dev_users
on conflict (id) do update
set display_name = excluded.display_name,
    status = 'active',
    deleted_at = null,
    anonymize_after = null,
    updated_at = now();

insert into public.legal_acceptances (user_account_id, legal_document_version_id, accepted_at)
select seed_dev_users.id, legal_document_versions.id, now()
from seed_dev_users
cross join public.legal_document_versions
where legal_document_versions.document_key = 'minimum_age_declaration'
  and legal_document_versions.is_current
on conflict (user_account_id, legal_document_version_id) do nothing;

insert into public.platform_roles (user_account_id, role)
select id, platform_role
from seed_dev_users
where platform_role is not null
on conflict (user_account_id) do update
set role = excluded.role,
    updated_at = now();
