create or replace function public.set_platform_role(account_id uuid, role_value text)
returns public.platform_roles
language plpgsql security definer set search_path = ''
as $$
declare result public.platform_roles;
begin
  if auth.role() <> 'service_role' then raise exception 'Internal operation only' using errcode = '42501'; end if;
  insert into public.platform_roles (user_account_id, role)
  values (account_id, role_value)
  on conflict (user_account_id) do update set role = excluded.role
  returning * into result;
  insert into public.audit_events (actor_account_id, action, subject_type, subject_id, outcome, metadata)
  values (auth.uid(), 'platform_role.set', 'user_account', account_id, 'succeeded', jsonb_build_object('role', role_value));
  return result;
end;
$$;

create or replace function public.suspend_store(store_id uuid, reason text)
returns public.stores
language plpgsql security definer set search_path = ''
as $$
declare result public.stores;
begin
  if not public.is_platform_role('platform_admin') then raise exception 'Platform admin required' using errcode = '42501'; end if;
  update public.stores set status = 'suspended' where id = store_id and status = 'active' returning * into result;
  if result.id is null then raise exception 'Active store not found' using errcode = 'P0002'; end if;
  perform public.audit('store.suspended', 'store', result.id, result.id, null, jsonb_build_object('reason', left(reason, 500)));
  return result;
end;
$$;

create or replace function public.restore_suspended_store(store_id uuid, reason text)
returns public.stores
language plpgsql security definer set search_path = ''
as $$
declare result public.stores;
begin
  if not public.is_platform_role('platform_admin') then raise exception 'Platform admin required' using errcode = '42501'; end if;
  update public.stores set status = 'active' where id = store_id and status = 'suspended' returning * into result;
  if result.id is null then raise exception 'Suspended store not found' using errcode = 'P0002'; end if;
  perform public.audit('store.restored', 'store', result.id, result.id, null, jsonb_build_object('reason', left(reason, 500)));
  return result;
end;
$$;

create or replace function public.manage_game(game_id uuid, input jsonb)
returns public.games
language plpgsql security definer set search_path = ''
as $$
declare result public.games;
begin
  if not public.is_platform_role('platform_admin') then raise exception 'Platform admin required' using errcode = '42501'; end if;
  if game_id is null then
    insert into public.games (name, slug, publisher, is_active)
    values (trim(input->>'name'), public.slugify(input->>'slug', 120), input->>'publisher', (input->>'isActive')::boolean)
    returning * into result;
  else
    update public.games set name = trim(input->>'name'), publisher = input->>'publisher',
      is_active = (input->>'isActive')::boolean
      where id = game_id returning * into result;
  end if;
  perform public.audit('game.changed', 'game', result.id);
  return result;
end;
$$;

create or replace function public.manage_platform_banner(banner_id uuid, input jsonb)
returns public.platform_event_banners
language plpgsql security definer set search_path = ''
as $$
declare result public.platform_event_banners;
begin
  if not public.is_platform_role('platform_admin') then raise exception 'Platform admin required' using errcode = '42501'; end if;
  if banner_id is null then
    insert into public.platform_event_banners (game_id, name, storage_path, is_default, status)
    values (nullif(input->>'gameId', '')::uuid, trim(input->>'name'), input->>'storagePath',
      (input->>'isDefault')::boolean, input->>'status') returning * into result;
  else
    update public.platform_event_banners set game_id = nullif(input->>'gameId', '')::uuid,
      name = trim(input->>'name'), storage_path = input->>'storagePath',
      is_default = (input->>'isDefault')::boolean, status = input->>'status'
      where id = banner_id returning * into result;
  end if;
  perform public.audit('platform_banner.changed', 'platform_event_banner', result.id);
  return result;
end;
$$;

create or replace function public.grant_store_entitlement(
  store_id uuid, feature text, starts_at timestamptz, ends_at timestamptz default null
)
returns public.store_entitlements
language plpgsql security definer set search_path = ''
as $$
declare result public.store_entitlements;
begin
  if not public.is_platform_role('platform_admin') then raise exception 'Platform admin required' using errcode = '42501'; end if;
  insert into public.store_entitlements (store_id, feature, status, starts_at, ends_at, granted_by_account_id)
  values (store_id, feature, 'active', starts_at, ends_at, auth.uid()) returning * into result;
  perform public.audit('entitlement.granted', 'store_entitlement', result.id, result.store_id);
  return result;
end;
$$;

create or replace function public.revoke_store_entitlement(entitlement_id uuid)
returns public.store_entitlements
language plpgsql security definer set search_path = ''
as $$
declare result public.store_entitlements;
begin
  if not public.is_platform_role('platform_admin') then raise exception 'Platform admin required' using errcode = '42501'; end if;
  update public.store_entitlements set status = 'revoked' where id = entitlement_id and status = 'active'
    returning * into result;
  if result.id is null then raise exception 'Active entitlement not found' using errcode = 'P0002'; end if;
  update public.store_media_assets set status = 'pending_removal', remove_after = now() + interval '30 days'
    where store_id = result.store_id and status = 'active';
  perform public.audit('entitlement.revoked', 'store_entitlement', result.id, result.store_id);
  return result;
end;
$$;

create or replace function public.begin_store_media_upload(
  store_id uuid, mime_type text, byte_size integer, source_storage_path text
)
returns public.store_media_assets
language plpgsql security definer set search_path = ''
as $$
declare result public.store_media_assets;
begin
  if not public.is_store_wide_manager(store_id) then raise exception 'Store-wide manager required' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.store_entitlements e where e.store_id = begin_store_media_upload.store_id
      and e.feature = 'custom_event_banners' and e.status = 'active' and e.starts_at <= now()
      and (e.ends_at is null or e.ends_at > now())
  ) then raise exception 'Active custom banner entitlement required' using errcode = '42501'; end if;
  if (select count(*) from public.store_media_assets a
    where a.store_id = begin_store_media_upload.store_id and a.status = 'active') >= 20 then
    raise exception 'Maximum active custom assets reached' using errcode = '23514';
  end if;
  insert into public.store_media_assets (
    store_id, uploaded_by_account_id, source_storage_path, mime_type, byte_size, width, height, status
  ) values (store_id, auth.uid(), source_storage_path, mime_type, byte_size, 1200, 675, 'processing')
  returning * into result;
  perform public.audit('custom_banner.upload_started', 'store_media_asset', result.id, result.store_id);
  return result;
end;
$$;

create or replace function public.finalize_store_media_asset(
  asset_id uuid, optimized_storage_path text, detected_mime_type text,
  detected_byte_size integer, width integer, height integer
)
returns public.store_media_assets
language plpgsql security definer set search_path = ''
as $$
declare result public.store_media_assets;
begin
  if auth.role() <> 'service_role' then raise exception 'Trusted process required' using errcode = '42501'; end if;
  update public.store_media_assets set optimized_storage_path = finalize_store_media_asset.optimized_storage_path,
    mime_type = detected_mime_type, byte_size = detected_byte_size,
    width = finalize_store_media_asset.width, height = finalize_store_media_asset.height, status = 'active'
    where id = asset_id and status = 'processing' returning * into result;
  if result.id is null then raise exception 'Processing asset not found' using errcode = 'P0002'; end if;
  return result;
end;
$$;

create or replace function public.remove_store_media_asset(asset_id uuid)
returns public.store_media_assets
language plpgsql security definer set search_path = ''
as $$
declare result public.store_media_assets;
begin
  select * into result from public.store_media_assets where id = asset_id for update;
  if result.id is null or not public.is_store_wide_manager(result.store_id) then raise exception 'Not authorized' using errcode = '42501'; end if;
  update public.store_media_assets set status = 'removed', remove_after = null, deleted_at = now()
    where id = asset_id returning * into result;
  perform public.audit('custom_banner.removed', 'store_media_asset', result.id, result.store_id);
  return result;
end;
$$;

create or replace function public.moderate_store_media_asset(asset_id uuid, reason text)
returns public.store_media_assets
language plpgsql security definer set search_path = ''
as $$
declare result public.store_media_assets;
begin
  if not public.is_platform_role('platform_moderator') then raise exception 'Platform moderator required' using errcode = '42501'; end if;
  update public.store_media_assets set status = 'removed', remove_after = null, deleted_at = now(),
    moderated_by_account_id = auth.uid(), moderation_reason = left(reason, 240)
    where id = asset_id and status <> 'removed' returning * into result;
  if result.id is null then raise exception 'Asset not found' using errcode = 'P0002'; end if;
  perform public.audit('custom_banner.moderated', 'store_media_asset', result.id, result.store_id);
  return result;
end;
$$;

create or replace function public.generate_weekly_occurrences()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare s public.event_series; local_today date; generated integer := 0;
begin
  for s in select * from public.event_series where status = 'active' and deleted_at is null loop
    local_today := (now() at time zone s.timezone)::date;
    if extract(isodow from local_today) = 7 then
      generated := generated + public.generate_series_occurrences(s.id, local_today + 1, local_today + 7);
    end if;
  end loop;
  return generated;
end;
$$;

create or replace function public.maintain_premium_assets()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare expired_count integer; pending_count integer; removed_count integer;
begin
  update public.store_entitlements set status = 'expired'
    where status = 'active' and ends_at is not null and ends_at <= now();
  get diagnostics expired_count = row_count;
  update public.store_media_assets a set status = 'pending_removal', remove_after = now() + interval '30 days'
    where a.status = 'active' and not exists (
      select 1 from public.store_entitlements e where e.store_id = a.store_id
        and e.feature = 'custom_event_banners' and e.status = 'active'
        and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
    );
  get diagnostics pending_count = row_count;
  update public.store_media_assets a set status = 'active', remove_after = null
    where a.status = 'pending_removal' and exists (
      select 1 from public.store_entitlements e where e.store_id = a.store_id
        and e.feature = 'custom_event_banners' and e.status = 'active'
        and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
    );
  update public.store_media_assets set status = 'removed', remove_after = null, deleted_at = now()
    where status = 'pending_removal' and remove_after <= now();
  get diagnostics removed_count = row_count;
  return jsonb_build_object('expiredEntitlements', expired_count, 'pendingAssets', pending_count, 'removedAssets', removed_count);
end;
$$;

create or replace function public.maintain_invitations()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare expired_count integer; deleted_count integer;
begin
  expired_count := public.expire_invitations();
  delete from public.store_membership_invitations
    where status in ('accepted', 'revoked', 'expired')
      and coalesce(accepted_at, revoked_at, expires_at) <= now() - interval '30 days';
  get diagnostics deleted_count = row_count;
  return jsonb_build_object('expired', expired_count, 'deleted', deleted_count);
end;
$$;

create or replace function public.anonymize_due_accounts()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare affected integer;
begin
  update public.user_accounts ua set display_name = 'Cuenta eliminada', anonymize_after = null
    where ua.deleted_at is not null and ua.anonymize_after <= now()
      and not exists (
        select 1 from public.store_memberships m join public.stores s on s.id = m.store_id
        where m.user_account_id = ua.id and m.role = 'owner' and m.status = 'active' and s.status = 'active'
      );
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.retain_audit_events()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare affected integer;
begin
  delete from public.audit_events
  where occurred_at < now() - case
    when action in ('platform_role.set', 'store.suspended', 'store.restored') then interval '36 months'
    else interval '24 months'
  end;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.set_platform_role(uuid, text) from public;
revoke all on function public.generate_weekly_occurrences() from public;
revoke all on function public.maintain_premium_assets() from public;
revoke all on function public.maintain_invitations() from public;
revoke all on function public.anonymize_due_accounts() from public;
revoke all on function public.retain_audit_events() from public;
revoke all on function public.finalize_store_media_asset(uuid, text, text, integer, integer, integer) from public;

grant execute on function public.set_platform_role(uuid, text) to service_role;
grant execute on function public.finalize_store_media_asset(uuid, text, text, integer, integer, integer) to service_role;
grant execute on function public.generate_weekly_occurrences() to service_role;
grant execute on function public.maintain_premium_assets() to service_role;
grant execute on function public.maintain_invitations() to service_role;
grant execute on function public.anonymize_due_accounts() to service_role;
grant execute on function public.retain_audit_events() to service_role;
grant execute on function public.complete_due_events() to service_role;
grant execute on function public.archive_due_events() to service_role;

grant execute on function public.suspend_store(uuid, text) to authenticated;
grant execute on function public.restore_suspended_store(uuid, text) to authenticated;
grant execute on function public.manage_game(uuid, jsonb) to authenticated;
grant execute on function public.manage_platform_banner(uuid, jsonb) to authenticated;
grant execute on function public.grant_store_entitlement(uuid, text, timestamptz, timestamptz) to authenticated;
grant execute on function public.revoke_store_entitlement(uuid) to authenticated;
grant execute on function public.begin_store_media_upload(uuid, text, integer, text) to authenticated;
grant execute on function public.remove_store_media_asset(uuid) to authenticated;
grant execute on function public.moderate_store_media_asset(uuid, text) to authenticated;
