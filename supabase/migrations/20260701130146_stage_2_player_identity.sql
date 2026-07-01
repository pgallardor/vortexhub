create table public.player_profiles (
  id uuid primary key default gen_random_uuid(),
  user_account_id uuid not null references public.user_accounts(id) on delete restrict,
  nickname varchar(40) not null check (length(trim(nickname)) between 2 and 40),
  player_tag char(6) not null check (player_tag ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
  avatar_storage_path text,
  avatar_optimized_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index player_profiles_account_active_uq
  on public.player_profiles (user_account_id)
  where deleted_at is null;

create unique index player_profiles_player_tag_uq
  on public.player_profiles (player_tag);

create index player_profiles_account_idx
  on public.player_profiles (user_account_id)
  where deleted_at is null;

create table public.player_nickname_changes (
  id uuid primary key default gen_random_uuid(),
  player_profile_id uuid not null references public.player_profiles(id) on delete restrict,
  previous_nickname varchar(40) not null,
  new_nickname varchar(40) not null,
  changed_by_account_id uuid references public.user_accounts(id) on delete restrict,
  reason varchar(30) not null check (reason in ('player', 'moderation')),
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index player_nickname_changes_profile_changed_idx
  on public.player_nickname_changes (player_profile_id, changed_at desc);

create table public.player_qr_credentials (
  id uuid primary key default gen_random_uuid(),
  player_profile_id uuid not null references public.player_profiles(id) on delete restrict,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  display_nonce uuid not null,
  status varchar(30) not null default 'active'
    check (status in ('active', 'revoked')),
  issued_at timestamptz not null default now(),
  rotated_at timestamptz,
  revoked_at timestamptz,
  revoked_reason varchar(40)
    check (revoked_reason is null or revoked_reason in ('rotation', 'account_inactive', 'moderation')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'active' and revoked_at is null) or (status = 'revoked' and revoked_at is not null))
);

create unique index player_qr_credentials_token_hash_uq
  on public.player_qr_credentials (token_hash);

create unique index player_qr_credentials_one_active_per_player_uq
  on public.player_qr_credentials (player_profile_id)
  where status = 'active';

create index player_qr_credentials_player_status_idx
  on public.player_qr_credentials (player_profile_id, status);

alter table public.player_profiles enable row level security;
alter table public.player_nickname_changes enable row level security;
alter table public.player_qr_credentials enable row level security;

create trigger player_profiles_set_updated_at before update on public.player_profiles
for each row execute function public.set_updated_at();

create trigger player_qr_credentials_set_updated_at before update on public.player_qr_credentials
for each row execute function public.set_updated_at();

grant select on public.player_profiles to authenticated;

create policy own_player_profile_read on public.player_profiles for select
  to authenticated using ((select auth.uid()) = user_account_id and deleted_at is null);

create or replace function public.normalize_player_nickname(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(trim(value), '\s+', ' ', 'g');
$$;

create or replace function public.assert_valid_player_nickname(value text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized text := public.normalize_player_nickname(value);
  reserved_names text[] := array[
    'admin', 'administrador', 'moderador', 'moderadora', 'staff',
    'soporte', 'support', 'vortexhub', 'vortex', 'tienda', 'store',
    'null', 'undefined'
  ];
begin
  if normalized is null or length(normalized) < 2 or length(normalized) > 40 then
    raise exception 'Invalid player nickname length' using errcode = '22023';
  end if;

  if normalized ~ '[[:cntrl:]]' then
    raise exception 'Invalid player nickname characters' using errcode = '22023';
  end if;

  if lower(normalized) = any(reserved_names) then
    raise exception 'Reserved player nickname' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.generate_player_tag()
returns char(6)
language plpgsql
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  attempt integer := 0;
begin
  loop
    candidate := '';
    for tag_position in 1..6 loop
      candidate := candidate || substr(
        alphabet,
        (get_byte(extensions.gen_random_bytes(1), 0) % length(alphabet)) + 1,
        1
      );
    end loop;

    exit when not exists (
      select 1 from public.player_profiles where player_tag = candidate
    );

    attempt := attempt + 1;
    if attempt >= 32 then
      raise exception 'Could not generate player tag' using errcode = '23505';
    end if;
  end loop;

  return candidate::char(6);
end;
$$;

create or replace function public.player_profile_payload(profile_id_value uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'nickname', p.nickname,
    'playerTag', p.player_tag,
    'avatarUrl', p.avatar_optimized_storage_path,
    'createdAt', p.created_at,
    'updatedAt', p.updated_at
  )
  from public.player_profiles p
  where p.id = profile_id_value and p.deleted_at is null;
$$;

create or replace function public.get_my_player_profile()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_value uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_active_account(auth.uid()) then
    raise exception 'Active adult account required' using errcode = '42501';
  end if;

  select id into profile_id_value
  from public.player_profiles
  where user_account_id = auth.uid() and deleted_at is null;

  if profile_id_value is null then
    return null;
  end if;

  return public.player_profile_payload(profile_id_value);
end;
$$;

create or replace function public.ensure_player_profile(input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  nickname_value text := public.normalize_player_nickname(input ->> 'nickname');
  token_hash_value text := lower(coalesce(input ->> 'qrTokenHash', ''));
  display_nonce_value uuid := nullif(input ->> 'qrDisplayNonce', '')::uuid;
  profile_id_value uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_active_account(auth.uid()) then
    raise exception 'Active adult account required' using errcode = '42501';
  end if;

  perform 1 from public.user_accounts where id = auth.uid() for update;

  select id into profile_id_value
  from public.player_profiles
  where user_account_id = auth.uid() and deleted_at is null
  for update;

  if profile_id_value is null then
    perform public.assert_valid_player_nickname(nickname_value);

    if token_hash_value !~ '^[a-f0-9]{64}$' or display_nonce_value is null then
      raise exception 'Valid QR credential material is required' using errcode = '22023';
    end if;

    insert into public.player_profiles (user_account_id, nickname, player_tag)
    values (auth.uid(), nickname_value, public.generate_player_tag())
    returning id into profile_id_value;

    insert into public.player_qr_credentials (player_profile_id, token_hash, display_nonce)
    values (profile_id_value, token_hash_value, display_nonce_value);

    perform public.audit(
      'player_profile.created',
      'player_profile',
      profile_id_value,
      null,
      null,
      jsonb_build_object('source', coalesce(input ->> 'source', 'player_onboarding'))
    );

    perform public.audit(
      'player_qr.issued',
      'player_qr_credential',
      profile_id_value,
      null,
      null,
      jsonb_build_object('reason', 'initial_issue')
    );
  elsif not exists (
    select 1
    from public.player_qr_credentials
    where player_profile_id = profile_id_value and status = 'active'
  ) then
    if token_hash_value !~ '^[a-f0-9]{64}$' or display_nonce_value is null then
      raise exception 'Valid QR credential material is required' using errcode = '22023';
    end if;

    insert into public.player_qr_credentials (player_profile_id, token_hash, display_nonce)
    values (profile_id_value, token_hash_value, display_nonce_value);

    perform public.audit(
      'player_qr.issued',
      'player_qr_credential',
      profile_id_value,
      null,
      null,
      jsonb_build_object('reason', 'missing_active_credential')
    );
  end if;

  return public.player_profile_payload(profile_id_value);
end;
$$;

create or replace function public.get_my_player_qr()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_active_account(auth.uid()) then
    raise exception 'Active adult account required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'profile', public.player_profile_payload(p.id),
    'credential', jsonb_build_object(
      'id', q.id,
      'displayNonce', q.display_nonce,
      'issuedAt', q.issued_at,
      'canRotateAfter', greatest(q.issued_at, coalesce(q.rotated_at, q.issued_at)) + interval '5 minutes'
    )
  )
  into payload
  from public.player_profiles p
  join public.player_qr_credentials q on q.player_profile_id = p.id and q.status = 'active'
  where p.user_account_id = auth.uid() and p.deleted_at is null
  limit 1;

  return payload;
end;
$$;

create or replace function public.rotate_my_player_qr(input jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  token_hash_value text := lower(coalesce(input ->> 'qrTokenHash', ''));
  display_nonce_value uuid := nullif(input ->> 'qrDisplayNonce', '')::uuid;
  profile_id_value uuid;
  active_credential record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_active_account(auth.uid()) then
    raise exception 'Active adult account required' using errcode = '42501';
  end if;

  if token_hash_value !~ '^[a-f0-9]{64}$' or display_nonce_value is null then
    raise exception 'Valid QR credential material is required' using errcode = '22023';
  end if;

  select id into profile_id_value
  from public.player_profiles
  where user_account_id = auth.uid() and deleted_at is null
  for update;

  if profile_id_value is null then
    raise exception 'Player profile required' using errcode = '23503';
  end if;

  select *
  into active_credential
  from public.player_qr_credentials
  where player_profile_id = profile_id_value and status = 'active'
  for update;

  if active_credential.id is not null
    and greatest(active_credential.issued_at, coalesce(active_credential.rotated_at, active_credential.issued_at)) > now() - interval '5 minutes' then
    raise exception 'QR rotation is rate limited' using errcode = '22023';
  end if;

  if active_credential.id is not null then
    update public.player_qr_credentials
    set status = 'revoked',
      revoked_at = now(),
      revoked_reason = 'rotation',
      rotated_at = now()
    where id = active_credential.id;
  end if;

  insert into public.player_qr_credentials (player_profile_id, token_hash, display_nonce, rotated_at)
  values (profile_id_value, token_hash_value, display_nonce_value, now());

  perform public.audit(
    'player_qr.rotated',
    'player_qr_credential',
    profile_id_value,
    null,
    null,
    '{}'::jsonb
  );

  return public.get_my_player_qr();
end;
$$;

create or replace function public.resolve_player_qr_for_context(input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  store_id_value uuid := nullif(input ->> 'storeId', '')::uuid;
  branch_id_value uuid := nullif(input ->> 'branchId', '')::uuid;
  token_hash_value text := lower(coalesce(input ->> 'qrTokenHash', ''));
  membership_value public.store_memberships;
  profile_record record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if token_hash_value !~ '^[a-f0-9]{64}$' or store_id_value is null then
    raise exception 'Valid QR resolution context is required' using errcode = '22023';
  end if;

  membership_value := public.active_membership(store_id_value, branch_id_value);

  if membership_value.id is null then
    insert into public.audit_events (
      actor_account_id, store_id, branch_id, action, subject_type, outcome, metadata
    ) values (
      auth.uid(), store_id_value, branch_id_value, 'player_qr.resolve_denied',
      'player_qr_credential', 'denied', jsonb_build_object('reason', 'unauthorized_store_context')
    );

    raise exception 'Not authorized to resolve player QR' using errcode = '42501';
  end if;

  select p.id, p.nickname, p.player_tag, p.avatar_optimized_storage_path
  into profile_record
  from public.player_qr_credentials q
  join public.player_profiles p on p.id = q.player_profile_id
  join public.user_accounts a on a.id = p.user_account_id
  where q.token_hash = token_hash_value
    and q.status = 'active'
    and p.deleted_at is null
    and a.status = 'active'
    and a.deleted_at is null
  limit 1;

  if profile_record.id is null then
    insert into public.audit_events (
      actor_account_id, actor_membership_id, store_id, branch_id, action, subject_type, outcome, metadata
    ) values (
      auth.uid(), membership_value.id, store_id_value, branch_id_value,
      'player_qr.resolve_failed', 'player_qr_credential', 'failed',
      jsonb_build_object('reason', 'not_found_or_revoked')
    );

    raise exception 'Player QR not found' using errcode = '23503';
  end if;

  insert into public.audit_events (
    actor_account_id, actor_membership_id, store_id, branch_id, action,
    subject_type, subject_id, outcome, metadata
  ) values (
    auth.uid(), membership_value.id, store_id_value, branch_id_value,
    'player_qr.resolved', 'player_profile', profile_record.id, 'succeeded',
    jsonb_build_object('context', coalesce(input ->> 'context', 'stage_2_profile_test'))
  );

  return jsonb_build_object(
    'nickname', profile_record.nickname,
    'playerTag', profile_record.player_tag,
    'avatarUrl', profile_record.avatar_optimized_storage_path
  );
end;
$$;

create or replace function public.revoke_player_qr_credentials_for_inactive_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.status <> 'active' or new.deleted_at is not null)
    and (old.status = 'active' and old.deleted_at is null) then
    update public.player_qr_credentials q
    set status = 'revoked',
      revoked_at = now(),
      revoked_reason = 'account_inactive'
    from public.player_profiles p
    where p.id = q.player_profile_id
      and p.user_account_id = new.id
      and q.status = 'active';
  end if;

  return new;
end;
$$;

create trigger user_accounts_revoke_player_qr_on_inactive
after update of status, deleted_at on public.user_accounts
for each row execute function public.revoke_player_qr_credentials_for_inactive_account();

revoke all on function public.normalize_player_nickname(text) from public;
revoke all on function public.assert_valid_player_nickname(text) from public;
revoke all on function public.generate_player_tag() from public;
revoke all on function public.player_profile_payload(uuid) from public;
revoke all on function public.revoke_player_qr_credentials_for_inactive_account() from public;
revoke all on function public.ensure_player_profile(jsonb) from public;
revoke all on function public.get_my_player_profile() from public;
revoke all on function public.get_my_player_qr() from public;
revoke all on function public.rotate_my_player_qr(jsonb) from public;
revoke all on function public.resolve_player_qr_for_context(jsonb) from public;

grant execute on function public.ensure_player_profile(jsonb) to authenticated;
grant execute on function public.get_my_player_profile() to authenticated;
grant execute on function public.get_my_player_qr() to authenticated;
grant execute on function public.rotate_my_player_qr(jsonb) to authenticated;
grant execute on function public.resolve_player_qr_for_context(jsonb) to authenticated;
