create or replace function public.slugify(value text, max_length integer default 160)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select left(
    trim(both '-' from regexp_replace(
      lower(translate(value,
        'áéíóúüñÁÉÍÓÚÜÑ',
        'aeiouunAEIOUUN')),
      '[^a-z0-9]+', '-', 'g'
    )),
    max_length
  );
$$;

create or replace function public.unique_slug(base text, resource text, parent_id uuid default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text := public.slugify(base, case when resource = 'store' then 150 else 170 end);
  exists_slug boolean;
begin
  if candidate = '' or candidate in ('api', 'admin', 'auth', 'events', 'stores', 'branches', 'series') then
    candidate := 'item';
  end if;

  loop
    if resource = 'store' then
      select exists(select 1 from public.stores where slug = candidate and deleted_at is null)
        into exists_slug;
    elsif resource = 'branch' then
      select exists(select 1 from public.branches where store_id = parent_id and slug = candidate and deleted_at is null)
        into exists_slug;
    elsif resource = 'event' then
      select exists(select 1 from public.events where store_id = parent_id and slug = candidate and deleted_at is null)
        into exists_slug;
    elsif resource = 'series' then
      select exists(select 1 from public.event_series where store_id = parent_id and slug = candidate and deleted_at is null)
        into exists_slug;
    else
      raise exception 'Unsupported slug resource' using errcode = '22023';
    end if;

    exit when not exists_slug;
    candidate := left(candidate, 150) || '-' || lower(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
  end loop;
  return candidate;
end;
$$;

create or replace function public.has_current_age_acceptance(account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.legal_acceptances la
    join public.legal_document_versions ldv on ldv.id = la.legal_document_version_id
    where la.user_account_id = account_id
      and ldv.document_key = 'minimum_age_declaration'
      and ldv.is_current
      and ldv.published_at <= now()
  );
$$;

create or replace function public.is_active_account(account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_accounts
    where id = account_id and status = 'active' and deleted_at is null
  ) and public.has_current_age_acceptance(account_id);
$$;

create or replace function public.is_platform_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_roles
    where user_account_id = auth.uid()
      and (role = required_role or (required_role = 'platform_moderator' and role = 'platform_admin'))
  ) and public.is_active_account(auth.uid());
$$;

create or replace function public.active_membership(target_store_id uuid, target_branch_id uuid default null)
returns public.store_memberships
language sql
stable
security definer
set search_path = ''
as $$
  select m
  from public.store_memberships m
  join public.stores s on s.id = m.store_id
  where m.user_account_id = auth.uid()
    and m.store_id = target_store_id
    and m.status = 'active'
    and m.deleted_at is null
    and s.status = 'active'
    and s.deleted_at is null
    and public.is_active_account(auth.uid())
    and (
      m.scope = 'store'
      or (
        target_branch_id is not null
        and exists (
          select 1 from public.branch_membership_assignments a
          join public.branches b on b.id = a.branch_id
          where a.store_membership_id = m.id
            and a.branch_id = target_branch_id
            and b.status = 'active'
            and b.deleted_at is null
        )
      )
    )
  limit 1;
$$;

create or replace function public.can_read_store(target_store_id uuid, target_branch_id uuid default null)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (public.active_membership(target_store_id, target_branch_id)).id is not null;
$$;

create or replace function public.can_manage_store(target_store_id uuid, target_branch_id uuid default null)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((public.active_membership(target_store_id, target_branch_id)).role in ('owner', 'admin'), false);
$$;

create or replace function public.is_store_owner(target_store_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((public.active_membership(target_store_id, null)).role = 'owner', false);
$$;

create or replace function public.is_store_wide_manager(target_store_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (public.active_membership(target_store_id, null)).role in ('owner', 'admin')
    and (public.active_membership(target_store_id, null)).scope = 'store',
    false
  );
$$;

create or replace function public.audit(
  action_name text,
  subject_type_name text,
  subject_id_value uuid default null,
  store_id_value uuid default null,
  branch_id_value uuid default null,
  metadata_value jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership_id_value uuid;
begin
  if store_id_value is not null then
    membership_id_value := (public.active_membership(store_id_value, branch_id_value)).id;
  end if;
  insert into public.audit_events (
    actor_account_id, actor_membership_id, store_id, branch_id, action,
    subject_type, subject_id, outcome, metadata
  ) values (
    auth.uid(), membership_id_value, store_id_value, branch_id_value, action_name,
    subject_type_name, subject_id_value, 'succeeded', coalesce(metadata_value, '{}'::jsonb)
  );
end;
$$;

create or replace function public.validate_https_url(value text)
returns boolean
language sql immutable set search_path = ''
as $$
  select value ~ '^https://[^[:space:]]+$' and value !~ '^https://[^/]*@';
$$;

create or replace function public.validate_game(game_id_value uuid, other_game_name_value text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare game_slug text;
begin
  select slug into game_slug from public.games where id = game_id_value and is_active;
  if game_slug is null then raise exception 'Active game not found' using errcode = '23503'; end if;
  if game_slug = 'otros' and nullif(trim(other_game_name_value), '') is null then
    raise exception 'Otros requires other_game_name' using errcode = '23514';
  end if;
  if game_slug <> 'otros' and other_game_name_value is not null then
    raise exception 'other_game_name is only valid for Otros' using errcode = '23514';
  end if;
end;
$$;

create or replace function public.validate_banner(
  store_id_value uuid, banner_mode_value text, platform_banner_id_value uuid, custom_asset_id_value uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if banner_mode_value = 'platform' then
    if not exists (
      select 1 from public.platform_event_banners
      where id = platform_banner_id_value and status = 'active'
    ) then raise exception 'Active platform banner not found' using errcode = '23503'; end if;
  elsif banner_mode_value = 'custom' then
    if not exists (
      select 1
      from public.store_media_assets a
      where a.id = custom_asset_id_value and a.store_id = store_id_value and a.status = 'active'
    ) or not exists (
      select 1 from public.store_entitlements e
      where e.store_id = store_id_value and e.feature = 'custom_event_banners'
        and e.status = 'active' and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
    ) then raise exception 'Custom banner is not eligible' using errcode = '42501'; end if;
  else
    raise exception 'Invalid banner mode' using errcode = '23514';
  end if;
end;
$$;

create or replace function public.assert_event_scope(store_id_value uuid, branch_id_value uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.can_manage_store(store_id_value, branch_id_value) then
    raise exception 'Not authorized for event scope' using errcode = '42501';
  end if;
  if branch_id_value is not null and not exists (
    select 1 from public.branches
    where id = branch_id_value and store_id = store_id_value and status = 'active' and deleted_at is null
  ) then raise exception 'Active branch not found' using errcode = '23503'; end if;
end;
$$;

create or replace function public.protect_immutable_fields()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_table_name = 'stores'
    and to_jsonb(old)->>'activated_at' is not null
    and to_jsonb(new)->>'slug' <> to_jsonb(old)->>'slug' then
    raise exception 'Store slug is immutable after activation' using errcode = '23514';
  elsif tg_table_name = 'branches' and to_jsonb(old)->>'activated_at' is not null and
    jsonb_build_array(
      to_jsonb(new)->'name', to_jsonb(new)->'slug', to_jsonb(new)->'address_line',
      to_jsonb(new)->'city', to_jsonb(new)->'region', to_jsonb(new)->'country_code',
      to_jsonb(new)->'latitude', to_jsonb(new)->'longitude', to_jsonb(new)->'timezone'
    ) is distinct from jsonb_build_array(
      to_jsonb(old)->'name', to_jsonb(old)->'slug', to_jsonb(old)->'address_line',
      to_jsonb(old)->'city', to_jsonb(old)->'region', to_jsonb(old)->'country_code',
      to_jsonb(old)->'latitude', to_jsonb(old)->'longitude', to_jsonb(old)->'timezone'
    ) then
    raise exception 'Branch physical identity is immutable after activation' using errcode = '23514';
  elsif tg_table_name = 'events'
    and to_jsonb(old)->>'published_at' is not null
    and to_jsonb(new)->>'slug' <> to_jsonb(old)->>'slug' then
    raise exception 'Event slug is immutable after publication' using errcode = '23514';
  elsif tg_table_name = 'event_series'
    and to_jsonb(old)->>'activated_at' is not null
    and to_jsonb(new)->>'slug' <> to_jsonb(old)->>'slug' then
    raise exception 'Series slug is immutable after activation' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger stores_protect_immutable before update on public.stores
for each row execute function public.protect_immutable_fields();
create trigger branches_protect_immutable before update on public.branches
for each row execute function public.protect_immutable_fields();
create trigger events_protect_immutable before update on public.events
for each row execute function public.protect_immutable_fields();
create trigger event_series_protect_immutable before update on public.event_series
for each row execute function public.protect_immutable_fields();

create or replace function public.create_user_account(input jsonb)
returns public.user_accounts
language plpgsql security definer set search_path = ''
as $$
declare result public.user_accounts;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.user_accounts (id, display_name)
  values (auth.uid(), trim(input->>'displayName'))
  on conflict (id) do update set display_name = excluded.display_name
  returning * into result;
  return result;
end;
$$;

create or replace function public.accept_legal_document(version_id uuid)
returns public.legal_acceptances
language plpgsql security definer set search_path = ''
as $$
declare result public.legal_acceptances;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.legal_document_versions
    where id = version_id and is_current and published_at <= now()
  ) then raise exception 'Current legal document not found' using errcode = '23503'; end if;
  insert into public.legal_acceptances (user_account_id, legal_document_version_id)
  values (auth.uid(), version_id)
  on conflict (user_account_id, legal_document_version_id) do update
    set accepted_at = public.legal_acceptances.accepted_at
  returning * into result;
  return result;
end;
$$;

create or replace function public.activate_user_account()
returns public.user_accounts
language plpgsql security definer set search_path = ''
as $$
declare result public.user_accounts;
begin
  if not public.has_current_age_acceptance(auth.uid()) then
    raise exception 'Current minimum age declaration is required' using errcode = '42501';
  end if;
  update public.user_accounts set status = 'active'
  where id = auth.uid() and deleted_at is null and status = 'pending'
  returning * into result;
  if result.id is null then raise exception 'Pending account not found' using errcode = 'P0002'; end if;
  return result;
end;
$$;

create or replace function public.request_account_deletion()
returns public.user_accounts
language plpgsql security definer set search_path = ''
as $$
declare result public.user_accounts;
begin
  if exists (
    select 1 from public.store_memberships m join public.stores s on s.id = m.store_id
    where m.user_account_id = auth.uid() and m.role = 'owner' and m.status = 'active'
      and m.deleted_at is null and s.status = 'active'
      and not exists (
        select 1 from public.store_memberships other
        where other.store_id = m.store_id and other.role = 'owner' and other.status = 'active'
          and other.deleted_at is null and other.user_account_id <> auth.uid()
      )
  ) then raise exception 'Final active owner cannot delete account' using errcode = '23514'; end if;

  update public.store_memberships set status = 'disabled'
    where user_account_id = auth.uid() and status = 'active';
  update public.user_accounts
    set status = 'suspended', deleted_at = now(), anonymize_after = now() + interval '30 days'
    where id = auth.uid() returning * into result;
  return result;
end;
$$;

create or replace function public.restore_account_before_anonymization()
returns public.user_accounts
language plpgsql security definer set search_path = ''
as $$
declare result public.user_accounts;
begin
  update public.user_accounts
    set status = 'active', deleted_at = null, anonymize_after = null
    where id = auth.uid() and anonymize_after > now() and public.has_current_age_acceptance(auth.uid())
    returning * into result;
  if result.id is null then raise exception 'Account cannot be restored' using errcode = 'P0002'; end if;
  return result;
end;
$$;

create or replace function public.create_store(input jsonb)
returns public.stores
language plpgsql security definer set search_path = ''
as $$
declare result public.stores;
begin
  if not public.is_active_account(auth.uid()) then raise exception 'Active account required' using errcode = '42501'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = input->>'timezone') then
    raise exception 'Invalid IANA timezone' using errcode = '23514';
  end if;
  insert into public.stores (name, slug, description, timezone)
  values (
    trim(input->>'name'),
    public.unique_slug(coalesce(nullif(input->>'slug', ''), input->>'name'), 'store'),
    input->>'description',
    input->>'timezone'
  ) returning * into result;
  insert into public.store_memberships (store_id, user_account_id, role, scope)
  values (result.id, auth.uid(), 'owner', 'store');
  return result;
end;
$$;

create or replace function public.activate_store(store_id uuid)
returns public.stores
language plpgsql security definer set search_path = ''
as $$
declare result public.stores;
begin
  if not exists (
    select 1 from public.store_memberships m
    where m.store_id = activate_store.store_id and m.user_account_id = auth.uid()
      and m.role = 'owner' and m.status = 'active' and m.deleted_at is null
  ) or not public.is_active_account(auth.uid()) then
    raise exception 'Owner authorization required' using errcode = '42501';
  end if;
  update public.stores set status = 'active', activated_at = now()
    where id = store_id and status = 'pending' and deleted_at is null
    returning * into result;
  if result.id is null then raise exception 'Pending store not found' using errcode = 'P0002'; end if;
  perform public.audit('store.activated', 'store', result.id, result.id);
  return result;
end;
$$;

create or replace function public.create_branch(store_id uuid, input jsonb)
returns public.branches
language plpgsql security definer set search_path = ''
as $$
declare result public.branches;
begin
  if not public.is_store_wide_manager(store_id) then raise exception 'Store-wide manager required' using errcode = '42501'; end if;
  insert into public.branches (
    store_id, name, slug, address_line, city, region, country_code, latitude, longitude, timezone
  ) values (
    store_id, trim(input->>'name'),
    public.unique_slug(coalesce(nullif(input->>'slug', ''), input->>'name'), 'branch', store_id),
    input->>'addressLine', input->>'city', input->>'region', input->>'countryCode',
    (input->>'latitude')::numeric, (input->>'longitude')::numeric, input->>'timezone'
  ) returning * into result;
  return result;
end;
$$;

create or replace function public.activate_branch(branch_id uuid)
returns public.branches
language plpgsql security definer set search_path = ''
as $$
declare result public.branches;
begin
  select * into result from public.branches where id = branch_id for update;
  if result.id is null then raise exception 'Branch not found' using errcode = 'P0002'; end if;
  if not public.can_manage_store(result.store_id, null) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if result.address_line is null or result.city is null or result.country_code is null
    or not exists (
      select 1 from pg_catalog.pg_timezone_names
      where name = coalesce(result.timezone, (select timezone from public.stores where id = result.store_id))
    )
  then raise exception 'Complete physical location and valid timezone required' using errcode = '23514'; end if;
  update public.branches set status = 'active', activated_at = coalesce(activated_at, now()), closed_at = null
    where id = branch_id and status = 'draft' returning * into result;
  if result.id is null then raise exception 'Draft branch not found' using errcode = 'P0002'; end if;
  perform public.audit('branch.activated', 'branch', result.id, result.store_id, result.id);
  return result;
end;
$$;

create or replace function public.reactivate_branch(branch_id uuid)
returns public.branches
language plpgsql security definer set search_path = ''
as $$
declare result public.branches;
begin
  select * into result from public.branches where id = branch_id for update;
  if result.id is null or not public.is_store_owner(result.store_id) then
    raise exception 'Owner authorization required' using errcode = '42501';
  end if;
  update public.branches set status = 'active', closed_at = null where id = branch_id and status = 'inactive'
    returning * into result;
  if result.id is null then raise exception 'Inactive branch not found' using errcode = 'P0002'; end if;
  perform public.audit('branch.reactivated', 'branch', result.id, result.store_id, result.id);
  return result;
end;
$$;

create or replace function public.invite_store_member(store_id uuid, input jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  inviter public.store_memberships;
  invitation public.store_membership_invitations;
  token text := encode(extensions.gen_random_bytes(32), 'hex');
  branch_id_value uuid;
begin
  inviter := public.active_membership(store_id, null);
  if inviter.id is null or inviter.role = 'staff' then raise exception 'Not authorized' using errcode = '42501'; end if;
  if inviter.role = 'admin' and (input->>'role' = 'owner' or input->>'scope' = 'store' and inviter.scope <> 'store') then
    raise exception 'Admin cannot grant requested scope' using errcode = '42501';
  end if;
  insert into public.store_membership_invitations (
    store_id, email_normalized, role, scope, token_hash, invited_by_account_id, expires_at
  ) values (
    store_id, lower(trim(input->>'email'))::public.citext, input->>'role', input->>'scope',
    encode(extensions.digest(token, 'sha256'), 'hex'), auth.uid(), now() + interval '7 days'
  ) returning * into invitation;

  if invitation.scope = 'branches' then
    for branch_id_value in select jsonb_array_elements_text(input->'branchIds')::uuid loop
      if not exists (
        select 1 from public.branches b
        where b.id = branch_id_value and b.store_id = invite_store_member.store_id
          and b.status = 'active' and b.deleted_at is null
      ) or not public.can_read_store(invite_store_member.store_id, branch_id_value) then
        raise exception 'Invalid invitation branch scope' using errcode = '42501';
      end if;
      insert into public.store_membership_invitation_branches (invitation_id, branch_id, store_id)
      values (invitation.id, branch_id_value, store_id);
    end loop;
    if not exists (select 1 from public.store_membership_invitation_branches where invitation_id = invitation.id) then
      raise exception 'Branch-scoped invitation requires branches' using errcode = '23514';
    end if;
  end if;
  perform public.audit('invitation.created', 'store_membership_invitation', invitation.id, store_id);
  return jsonb_build_object('invitationId', invitation.id, 'token', token, 'expiresAt', invitation.expires_at);
end;
$$;

create or replace function public.revoke_store_invitation(invitation_id uuid)
returns public.store_membership_invitations
language plpgsql security definer set search_path = ''
as $$
declare result public.store_membership_invitations;
begin
  select * into result from public.store_membership_invitations where id = invitation_id for update;
  if result.id is null or not public.can_manage_store(result.store_id, null) then raise exception 'Not authorized' using errcode = '42501'; end if;
  update public.store_membership_invitations set status = 'revoked', revoked_at = now()
    where id = invitation_id and status = 'pending' returning * into result;
  if result.id is null then raise exception 'Pending invitation not found' using errcode = 'P0002'; end if;
  perform public.audit('invitation.revoked', 'store_membership_invitation', result.id, result.store_id);
  return result;
end;
$$;

create or replace function public.accept_store_invitation(token text)
returns public.store_memberships
language plpgsql security definer set search_path = ''
as $$
declare
  invitation public.store_membership_invitations;
  result public.store_memberships;
  verified_email public.citext;
begin
  if not public.is_active_account(auth.uid()) then raise exception 'Active account required' using errcode = '42501'; end if;
  select lower(email)::public.citext into verified_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  select * into invitation from public.store_membership_invitations
    where token_hash = encode(extensions.digest(token, 'sha256'), 'hex') and status = 'pending' for update;
  if invitation.id is null or invitation.expires_at <= now() or invitation.email_normalized <> verified_email then
    raise exception 'Invitation is invalid or expired' using errcode = '42501';
  end if;
  if invitation.scope = 'branches' and exists (
    select 1 from public.store_membership_invitation_branches ib
    left join public.branches b on b.id = ib.branch_id
    where ib.invitation_id = invitation.id and (b.status <> 'active' or b.deleted_at is not null)
  ) then raise exception 'Invitation branch is no longer active' using errcode = '23514'; end if;

  insert into public.store_memberships (store_id, user_account_id, role, scope)
  values (invitation.store_id, auth.uid(), invitation.role, invitation.scope)
  returning * into result;
  insert into public.branch_membership_assignments (store_membership_id, branch_id, store_id)
    select result.id, branch_id, invitation.store_id
    from public.store_membership_invitation_branches where invitation_id = invitation.id;
  update public.store_membership_invitations
    set status = 'accepted', accepted_by_account_id = auth.uid(), accepted_at = now()
    where id = invitation.id;
  perform public.audit('invitation.accepted', 'store_membership_invitation', invitation.id, invitation.store_id);
  return result;
end;
$$;

create or replace function public.change_store_membership(membership_id uuid, input jsonb)
returns public.store_memberships
language plpgsql security definer set search_path = ''
as $$
declare target public.store_memberships; result public.store_memberships; branch_id_value uuid;
begin
  select * into target from public.store_memberships where id = membership_id for update;
  if target.id is null or not public.is_store_owner(target.store_id) then raise exception 'Owner required' using errcode = '42501'; end if;
  if target.role = 'owner' and input->>'role' <> 'owner' and not exists (
    select 1 from public.store_memberships
    where store_id = target.store_id and role = 'owner' and status = 'active'
      and deleted_at is null and id <> target.id
  ) then raise exception 'Cannot demote final active owner' using errcode = '23514'; end if;
  update public.store_memberships set role = input->>'role', scope = input->>'scope'
    where id = membership_id returning * into result;
  delete from public.branch_membership_assignments where store_membership_id = membership_id;
  if result.scope = 'branches' then
    for branch_id_value in select jsonb_array_elements_text(input->'branchIds')::uuid loop
      insert into public.branch_membership_assignments (store_membership_id, branch_id, store_id)
      select result.id, b.id, result.store_id from public.branches b
      where b.id = branch_id_value and b.store_id = result.store_id and b.status = 'active';
    end loop;
    if not exists (select 1 from public.branch_membership_assignments where store_membership_id = result.id) then
      raise exception 'Branch-scoped membership requires active assignments' using errcode = '23514';
    end if;
  end if;
  perform public.audit('membership.changed', 'store_membership', result.id, result.store_id);
  return result;
end;
$$;

create or replace function public.disable_store_membership(membership_id uuid)
returns public.store_memberships
language plpgsql security definer set search_path = ''
as $$
declare target public.store_memberships; result public.store_memberships;
begin
  select * into target from public.store_memberships where id = membership_id for update;
  if target.id is null or not public.is_store_owner(target.store_id) then raise exception 'Owner required' using errcode = '42501'; end if;
  if target.role = 'owner' and not exists (
    select 1 from public.store_memberships where store_id = target.store_id and role = 'owner'
      and status = 'active' and deleted_at is null and id <> target.id
  ) then raise exception 'Cannot disable final active owner' using errcode = '23514'; end if;
  update public.store_memberships set status = 'disabled' where id = membership_id returning * into result;
  perform public.audit('membership.disabled', 'store_membership', result.id, result.store_id);
  return result;
end;
$$;

create or replace function public.set_branch_membership_assignments(membership_id uuid, branch_ids uuid[])
returns public.store_memberships
language plpgsql security definer set search_path = ''
as $$
declare target public.store_memberships; branch_id_value uuid;
begin
  select * into target from public.store_memberships where id = membership_id for update;
  if target.id is null or target.scope <> 'branches' or not public.is_store_owner(target.store_id) then
    raise exception 'Owner and branch-scoped membership required' using errcode = '42501';
  end if;
  delete from public.branch_membership_assignments where store_membership_id = membership_id;
  foreach branch_id_value in array branch_ids loop
    insert into public.branch_membership_assignments (store_membership_id, branch_id, store_id)
    select target.id, id, target.store_id from public.branches
    where id = branch_id_value and store_id = target.store_id and status = 'active' and deleted_at is null;
  end loop;
  if not exists (select 1 from public.branch_membership_assignments where store_membership_id = target.id) then
    raise exception 'At least one active assignment is required' using errcode = '23514';
  end if;
  perform public.audit('membership.assignments_changed', 'store_membership', target.id, target.store_id);
  return target;
end;
$$;
