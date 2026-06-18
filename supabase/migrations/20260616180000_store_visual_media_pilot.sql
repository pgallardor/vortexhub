alter table public.store_media_assets
  add column if not exists asset_type varchar(30) not null default 'event_banner';

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.store_media_assets'::regclass
      and contype = 'c'
      and (
        pg_get_constraintdef(oid) like '%width%'
        or pg_get_constraintdef(oid) like '%height%'
        or pg_get_constraintdef(oid) like '%asset_type%'
      )
  loop
    execute format('alter table public.store_media_assets drop constraint %I', constraint_record.conname);
  end loop;
end $$;

alter table public.store_media_assets
  add constraint store_media_assets_asset_type_check
  check (asset_type in ('store_logo', 'event_banner'));

alter table public.store_media_assets
  add constraint store_media_assets_dimensions_check
  check (
    (asset_type = 'store_logo' and width >= 256 and height >= 256)
    or (asset_type = 'event_banner' and width >= 1200 and height >= 675)
  );

create index if not exists store_media_assets_store_type_status_idx
  on public.store_media_assets (store_id, asset_type, status)
  where deleted_at is null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('store-media-sources', 'store-media-sources', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('store-media-optimized', 'store-media-optimized', true, 5242880, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists store_media_sources_manager_insert on storage.objects;
create policy store_media_sources_manager_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'store-media-sources'
    and public.can_manage_store((storage.foldername(name))[1]::uuid, null)
  );

drop policy if exists store_media_optimized_public_read on storage.objects;
create policy store_media_optimized_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'store-media-optimized');

drop policy if exists store_media_optimized_manager_insert on storage.objects;
create policy store_media_optimized_manager_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'store-media-optimized'
    and public.can_manage_store((storage.foldername(name))[1]::uuid, null)
  );

create or replace function public.register_store_media_asset(
  store_id uuid,
  asset_type text,
  source_storage_path text,
  optimized_storage_path text,
  public_url text,
  mime_type text,
  byte_size integer,
  width integer,
  height integer
)
returns public.store_media_assets
language plpgsql security definer set search_path = ''
as $$
declare
  result public.store_media_assets;
begin
  if not public.is_store_wide_manager(store_id) then
    raise exception 'Store-wide manager required' using errcode = '42501';
  end if;

  if asset_type not in ('store_logo', 'event_banner') then
    raise exception 'Invalid media asset type' using errcode = '23514';
  end if;

  if mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Invalid media type' using errcode = '23514';
  end if;

  if byte_size <= 0 or byte_size > 5242880 then
    raise exception 'Invalid media size' using errcode = '23514';
  end if;

  if asset_type = 'store_logo' and (width < 256 or height < 256) then
    raise exception 'Store logo must be at least 256 by 256 pixels' using errcode = '23514';
  end if;

  if asset_type = 'event_banner' and (width < 1200 or height < 675) then
    raise exception 'Event banner must be at least 1200 by 675 pixels' using errcode = '23514';
  end if;

  if asset_type = 'event_banner' and (
    select count(*)
    from public.store_media_assets a
    where a.store_id = register_store_media_asset.store_id
      and a.asset_type = 'event_banner'
      and a.status = 'active'
      and a.deleted_at is null
  ) >= 20 then
    raise exception 'Maximum active custom event banners reached' using errcode = '23514';
  end if;

  if asset_type = 'store_logo' then
    update public.store_media_assets
    set status = 'removed',
        deleted_at = now(),
        remove_after = null
    where store_media_assets.store_id = register_store_media_asset.store_id
      and store_media_assets.asset_type = 'store_logo'
      and store_media_assets.status = 'active'
      and store_media_assets.deleted_at is null;
  end if;

  insert into public.store_media_assets (
    store_id,
    uploaded_by_account_id,
    asset_type,
    source_storage_path,
    optimized_storage_path,
    mime_type,
    byte_size,
    width,
    height,
    status
  ) values (
    store_id,
    auth.uid(),
    asset_type,
    source_storage_path,
    optimized_storage_path,
    mime_type,
    byte_size,
    width,
    height,
    'active'
  ) returning * into result;

  if asset_type = 'store_logo' then
    update public.stores
    set logo_url = public_url,
        updated_at = now()
    where id = store_id;
  end if;

  perform public.audit(
    case when asset_type = 'store_logo' then 'store_logo.uploaded' else 'custom_banner.uploaded' end,
    'store_media_asset',
    result.id,
    result.store_id
  );

  return result;
end;
$$;

grant execute on function public.register_store_media_asset(uuid, text, text, text, text, text, integer, integer, integer)
  to authenticated;

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
      where a.id = custom_asset_id_value
        and a.store_id = store_id_value
        and a.asset_type = 'event_banner'
        and a.status = 'active'
        and a.deleted_at is null
    ) then raise exception 'Active custom event banner not found' using errcode = '23503'; end if;
  else
    raise exception 'Invalid banner mode' using errcode = '23514';
  end if;
end;
$$;

create or replace function public.remove_store_media_asset(asset_id uuid)
returns public.store_media_assets
language plpgsql security definer set search_path = ''
as $$
declare result public.store_media_assets;
begin
  select * into result from public.store_media_assets where id = asset_id for update;
  if result.id is null or not public.is_store_wide_manager(result.store_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.store_media_assets
  set status = 'removed',
      remove_after = null,
      deleted_at = now()
  where id = asset_id
  returning * into result;

  if result.asset_type = 'store_logo' then
    update public.stores
    set logo_url = null,
        updated_at = now()
    where id = result.store_id
      and logo_url is not null;
  end if;

  perform public.audit(
    case when result.asset_type = 'store_logo' then 'store_logo.removed' else 'custom_banner.removed' end,
    'store_media_asset',
    result.id,
    result.store_id
  );
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
    where store_id = result.store_id and asset_type = 'event_banner' and status = 'active';
  perform public.audit('entitlement.revoked', 'store_entitlement', result.id, result.store_id);
  return result;
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
    where a.asset_type = 'event_banner'
      and a.status = 'active'
      and not exists (
        select 1 from public.store_entitlements e where e.store_id = a.store_id
          and e.feature = 'custom_event_banners' and e.status = 'active'
          and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
      );
  get diagnostics pending_count = row_count;
  update public.store_media_assets a set status = 'active', remove_after = null
    where a.asset_type = 'event_banner'
      and a.status = 'pending_removal'
      and exists (
        select 1 from public.store_entitlements e where e.store_id = a.store_id
          and e.feature = 'custom_event_banners' and e.status = 'active'
          and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
      );
  update public.store_media_assets
  set status = 'removed',
      remove_after = null,
      deleted_at = now()
  where asset_type = 'event_banner'
    and status = 'pending_removal'
    and remove_after <= now();
  get diagnostics removed_count = row_count;
  return jsonb_build_object('expiredEntitlements', expired_count, 'pendingAssets', pending_count, 'removedAssets', removed_count);
end;
$$;
