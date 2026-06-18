create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists btree_gist;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.user_accounts (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name varchar(120) not null check (length(trim(display_name)) >= 2),
  status varchar(30) not null default 'pending'
    check (status in ('pending', 'active', 'suspended')),
  anonymize_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_key varchar(80) not null,
  version varchar(60) not null,
  content text not null,
  content_hash text not null,
  is_current boolean not null default false,
  published_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_key, version)
);

create unique index legal_document_versions_one_current_uq
  on public.legal_document_versions (document_key) where is_current;

create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_account_id uuid not null references public.user_accounts(id) on delete restrict,
  legal_document_version_id uuid not null references public.legal_document_versions(id) on delete restrict,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_account_id, legal_document_version_id)
);

create table public.platform_roles (
  user_account_id uuid primary key references public.user_accounts(id) on delete restrict,
  role varchar(30) not null check (role in ('platform_admin', 'platform_moderator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name varchar(160) not null check (length(trim(name)) >= 2),
  slug varchar(160) not null,
  description text,
  logo_url text,
  timezone varchar(60) not null,
  status varchar(30) not null default 'pending'
    check (status in ('pending', 'active', 'suspended', 'closed')),
  activated_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((activated_at is null) = (status = 'pending')),
  check (status <> 'closed' or closed_at is not null)
);

create unique index stores_slug_active_uq
  on public.stores (slug) where deleted_at is null;

create table public.store_memberships (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  user_account_id uuid not null references public.user_accounts(id) on delete restrict,
  role varchar(30) not null check (role in ('owner', 'admin', 'staff')),
  scope varchar(30) not null check (scope in ('store', 'branches')),
  status varchar(30) not null default 'active' check (status in ('active', 'disabled')),
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, store_id),
  check (role <> 'owner' or scope = 'store')
);

create unique index store_memberships_active_account_uq
  on public.store_memberships (store_id, user_account_id) where deleted_at is null;
create index store_memberships_account_idx
  on public.store_memberships (user_account_id, status) where deleted_at is null;

create table public.store_membership_invitations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  email_normalized citext not null,
  role varchar(30) not null check (role in ('owner', 'admin', 'staff')),
  scope varchar(30) not null check (scope in ('store', 'branches')),
  token_hash text not null,
  status varchar(30) not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by_account_id uuid not null references public.user_accounts(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_by_account_id uuid references public.user_accounts(id) on delete restrict,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, store_id),
  check (role <> 'owner' or scope = 'store')
);

create unique index store_membership_invitations_token_hash_uq
  on public.store_membership_invitations (token_hash);
create index store_membership_invitations_expiry_idx
  on public.store_membership_invitations (expires_at) where status = 'pending';
create unique index store_membership_invitations_one_pending_uq
  on public.store_membership_invitations (store_id, email_normalized) where status = 'pending';

create table public.store_entitlements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  feature varchar(80) not null check (feature = 'custom_event_banners'),
  status varchar(30) not null check (status in ('active', 'expired', 'revoked')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  granted_by_account_id uuid references public.user_accounts(id) on delete restrict,
  source varchar(30) not null default 'manual' check (source = 'manual'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

alter table public.store_entitlements
  add constraint store_entitlements_no_active_overlap
  exclude using gist (
    store_id with =,
    feature with =,
    tstzrange(starts_at, coalesce(ends_at, 'infinity'::timestamptz), '[)') with &&
  ) where (status = 'active');

create index store_entitlements_lookup_idx
  on public.store_entitlements (store_id, feature, status, starts_at, ends_at);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  name varchar(160) not null check (length(trim(name)) >= 2),
  slug varchar(160) not null,
  address_line text,
  city varchar(120),
  region varchar(120),
  country_code char(2),
  latitude numeric(9,6),
  longitude numeric(9,6),
  timezone varchar(60),
  status varchar(30) not null default 'draft'
    check (status in ('draft', 'active', 'inactive')),
  activated_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, store_id),
  check ((latitude is null) = (longitude is null)),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180),
  check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  check (status = 'draft' or activated_at is not null),
  check (status <> 'inactive' or closed_at is not null)
);

create unique index branches_store_slug_active_uq
  on public.branches (store_id, slug) where deleted_at is null;

create table public.store_membership_invitation_branches (
  invitation_id uuid not null,
  branch_id uuid not null,
  store_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (invitation_id, branch_id),
  foreign key (invitation_id, store_id)
    references public.store_membership_invitations(id, store_id) on delete cascade,
  foreign key (branch_id, store_id)
    references public.branches(id, store_id) on delete restrict
);

create table public.branch_membership_assignments (
  id uuid primary key default gen_random_uuid(),
  store_membership_id uuid not null,
  branch_id uuid not null,
  store_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_membership_id, branch_id),
  foreign key (store_membership_id, store_id)
    references public.store_memberships(id, store_id) on delete cascade,
  foreign key (branch_id, store_id)
    references public.branches(id, store_id) on delete restrict
);

create index branch_membership_assignments_membership_idx
  on public.branch_membership_assignments (store_membership_id);
create index branch_membership_assignments_branch_idx
  on public.branch_membership_assignments (branch_id);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  name varchar(120) not null,
  slug varchar(120) not null,
  publisher varchar(120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index games_slug_uq on public.games (slug);

create table public.platform_event_banners (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games(id) on delete restrict,
  name varchar(160) not null,
  storage_path text not null,
  is_default boolean not null default false,
  status varchar(30) not null check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index platform_event_banners_game_default_uq
  on public.platform_event_banners (game_id)
  where game_id is not null and is_default and status = 'active';
create unique index platform_event_banners_global_default_uq
  on public.platform_event_banners ((true))
  where game_id is null and is_default and status = 'active';

create table public.store_media_assets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  uploaded_by_account_id uuid not null references public.user_accounts(id) on delete restrict,
  source_storage_path text not null,
  optimized_storage_path text,
  mime_type varchar(120) not null
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 5242880),
  width integer not null check (width >= 1200),
  height integer not null check (height >= 675),
  status varchar(30) not null
    check (status in ('processing', 'active', 'pending_removal', 'removed', 'rejected')),
  remove_after timestamptz,
  moderated_by_account_id uuid references public.user_accounts(id) on delete restrict,
  moderation_reason varchar(240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, store_id),
  check (remove_after is null or status = 'pending_removal')
);

create index store_media_assets_store_status_idx
  on public.store_media_assets (store_id, status);
create index store_media_assets_removal_idx
  on public.store_media_assets (remove_after) where status = 'pending_removal';

create table public.event_series (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  branch_id uuid,
  game_id uuid not null references public.games(id) on delete restrict,
  other_game_name varchar(120),
  created_by_account_id uuid not null references public.user_accounts(id) on delete restrict,
  slug varchar(180) not null,
  title varchar(180) not null,
  description text,
  format_name varchar(120),
  status varchar(30) not null default 'draft'
    check (status in ('draft', 'active', 'ended')),
  weekdays smallint[] not null,
  local_start_time time not null,
  duration_minutes integer,
  timezone varchar(60) not null,
  starts_on date not null,
  ends_on date,
  registration_mode varchar(20) not null default 'disabled'
    check (registration_mode in ('disabled', 'external')),
  external_registration_url text,
  entry_fee_amount numeric(12,2),
  entry_fee_currency char(3),
  location_mode varchar(20) not null
    check (location_mode in ('branch', 'custom', 'online')),
  location_text text,
  location_city varchar(120),
  location_region varchar(120),
  location_country_code char(2),
  banner_mode varchar(20) not null
    check (banner_mode in ('platform', 'custom')),
  platform_banner_id uuid references public.platform_event_banners(id) on delete restrict,
  custom_banner_asset_id uuid,
  activated_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, store_id),
  foreign key (branch_id, store_id) references public.branches(id, store_id) on delete restrict,
  foreign key (custom_banner_asset_id, store_id)
    references public.store_media_assets(id, store_id) on delete restrict,
  check (cardinality(weekdays) > 0),
  check (weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  check (duration_minutes is null or duration_minutes > 0),
  check (ends_on is null or ends_on >= starts_on),
  check (status = 'draft' or activated_at is not null),
  check (status <> 'ended' or ended_at is not null),
  check (
    (registration_mode = 'external' and external_registration_url is not null)
    or (registration_mode = 'disabled' and external_registration_url is null)
  ),
  check (entry_fee_amount is null or entry_fee_amount >= 0),
  check ((entry_fee_amount is null) = (entry_fee_currency is null)),
  check (entry_fee_currency is null or entry_fee_currency ~ '^[A-Z]{3}$'),
  check (
    (location_mode = 'branch' and branch_id is not null and location_text is null
      and location_city is null and location_region is null and location_country_code is null)
    or (location_mode = 'custom' and location_text is not null and location_city is not null
      and location_country_code is not null)
    or (location_mode = 'online' and location_text is not null and location_city is null
      and location_region is null and location_country_code is null)
  ),
  check (
    (banner_mode = 'platform' and platform_banner_id is not null and custom_banner_asset_id is null)
    or (banner_mode = 'custom' and custom_banner_asset_id is not null and platform_banner_id is null)
  )
);

create unique index event_series_store_slug_active_uq
  on public.event_series (store_id, slug) where deleted_at is null;
create index event_series_generation_idx
  on public.event_series (status, timezone) where status = 'active' and deleted_at is null;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  event_series_id uuid,
  series_local_date date,
  is_series_exception boolean not null default false,
  store_id uuid not null references public.stores(id) on delete restrict,
  branch_id uuid,
  game_id uuid not null references public.games(id) on delete restrict,
  other_game_name varchar(120),
  created_by_account_id uuid not null references public.user_accounts(id) on delete restrict,
  slug varchar(180) not null,
  title varchar(180) not null,
  description text,
  format_name varchar(120),
  status varchar(30) not null default 'draft'
    check (status in ('draft', 'published', 'cancelled', 'completed')),
  registration_mode varchar(20) not null default 'disabled'
    check (registration_mode in ('disabled', 'external')),
  external_registration_url text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  entry_fee_amount numeric(12,2),
  entry_fee_currency char(3),
  location_mode varchar(20) not null
    check (location_mode in ('branch', 'custom', 'online')),
  location_text text,
  location_city varchar(120),
  location_region varchar(120),
  location_country_code char(2),
  banner_mode varchar(20) not null
    check (banner_mode in ('platform', 'custom')),
  platform_banner_id uuid references public.platform_event_banners(id) on delete restrict,
  custom_banner_asset_id uuid,
  published_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by_account_id uuid references public.user_accounts(id) on delete restrict,
  cancellation_message varchar(240),
  cancellation_batch_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (event_series_id, series_local_date),
  foreign key (event_series_id, store_id)
    references public.event_series(id, store_id) on delete restrict,
  foreign key (branch_id, store_id) references public.branches(id, store_id) on delete restrict,
  foreign key (custom_banner_asset_id, store_id)
    references public.store_media_assets(id, store_id) on delete restrict,
  check (ends_at is null or ends_at > starts_at),
  check (
    (event_series_id is null and series_local_date is null)
    or (event_series_id is not null and series_local_date is not null)
  ),
  check (status <> 'published' or published_at is not null),
  check (status <> 'completed' or published_at is not null),
  check (status <> 'cancelled' or cancelled_at is not null),
  check (status <> 'cancelled' or published_at is null or cancellation_message is not null),
  check (archived_at is null or status in ('completed', 'cancelled')),
  check (
    (registration_mode = 'external' and external_registration_url is not null)
    or (registration_mode = 'disabled' and external_registration_url is null)
  ),
  check (entry_fee_amount is null or entry_fee_amount >= 0),
  check ((entry_fee_amount is null) = (entry_fee_currency is null)),
  check (entry_fee_currency is null or entry_fee_currency ~ '^[A-Z]{3}$'),
  check (
    (location_mode = 'branch' and branch_id is not null and location_text is null
      and location_city is null and location_region is null and location_country_code is null)
    or (location_mode = 'custom' and location_text is not null and location_city is not null
      and location_country_code is not null)
    or (location_mode = 'online' and location_text is not null and location_city is null
      and location_region is null and location_country_code is null)
  ),
  check (
    (banner_mode = 'platform' and platform_banner_id is not null and custom_banner_asset_id is null)
    or (banner_mode = 'custom' and custom_banner_asset_id is not null and platform_banner_id is null)
  )
);

create unique index events_store_slug_active_uq
  on public.events (store_id, slug) where deleted_at is null;
create index events_public_calendar_idx
  on public.events (starts_at, game_id, store_id)
  where status = 'published' and archived_at is null and deleted_at is null;
create index events_store_calendar_idx
  on public.events (store_id, starts_at) where deleted_at is null;
create index events_game_calendar_idx
  on public.events (game_id, starts_at)
  where status = 'published' and archived_at is null and deleted_at is null;
create index events_branch_calendar_idx
  on public.events (branch_id, starts_at) where branch_id is not null and deleted_at is null;
create index events_completion_idx
  on public.events (ends_at, starts_at) where status = 'published' and deleted_at is null;
create index events_archival_idx
  on public.events (ends_at, starts_at)
  where status in ('completed', 'cancelled') and archived_at is null;

create table public.event_cancellation_batches (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  branch_id uuid,
  source varchar(30) not null check (source in ('branch_closure', 'store_closure')),
  public_message varchar(240) not null,
  internal_reason text,
  created_by_account_id uuid not null references public.user_accounts(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, store_id),
  foreign key (branch_id, store_id) references public.branches(id, store_id) on delete restrict
);

alter table public.events
  add constraint events_cancellation_batch_store_fk
  foreign key (cancellation_batch_id, store_id)
  references public.event_cancellation_batches(id, store_id) on delete restrict;

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_account_id uuid references public.user_accounts(id) on delete restrict,
  actor_membership_id uuid references public.store_memberships(id) on delete restrict,
  store_id uuid references public.stores(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete restrict,
  action varchar(80) not null,
  subject_type varchar(80) not null,
  subject_id uuid,
  context_type varchar(80),
  context_id uuid,
  outcome varchar(30) not null check (outcome in ('succeeded', 'denied', 'failed')),
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index audit_events_store_occurred_idx
  on public.audit_events (store_id, occurred_at desc);
create index audit_events_occurred_idx on public.audit_events (occurred_at);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'user_accounts', 'legal_document_versions', 'platform_roles', 'stores',
    'store_memberships', 'store_membership_invitations', 'store_entitlements',
    'branches', 'branch_membership_assignments', 'games', 'platform_event_banners',
    'store_media_assets', 'event_series', 'events'
  ]
  loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()',
      table_name, table_name
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'user_accounts', 'legal_document_versions', 'legal_acceptances', 'platform_roles',
    'stores', 'store_memberships', 'store_membership_invitations',
    'store_membership_invitation_branches', 'store_entitlements', 'branches',
    'branch_membership_assignments', 'games', 'platform_event_banners',
    'store_media_assets', 'event_series', 'events', 'event_cancellation_batches',
    'audit_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$$;
