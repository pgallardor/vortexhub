alter table public.store_media_assets
  add column if not exists display_name varchar(120);

update public.store_media_assets
set display_name = 'Banner ' || to_char(created_at at time zone 'America/Santiago', 'YYYY-MM-DD')
where asset_type = 'event_banner'
  and display_name is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.store_media_assets'::regclass
      and conname = 'store_media_assets_display_name_check'
  ) then
    alter table public.store_media_assets
      add constraint store_media_assets_display_name_check
      check (
        display_name is null
        or length(trim(display_name)) between 2 and 120
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.store_media_assets'::regclass
      and conname = 'store_media_assets_event_banner_display_name_check'
  ) then
    alter table public.store_media_assets
      add constraint store_media_assets_event_banner_display_name_check
      check (asset_type <> 'event_banner' or display_name is not null);
  end if;
end $$;

drop function if exists public.register_store_media_asset(uuid, text, text, text, text, text, integer, integer, integer);

create or replace function public.register_store_media_asset(
  store_id uuid,
  asset_type text,
  display_name text,
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
  normalized_display_name text := nullif(trim(display_name), '');
  result public.store_media_assets;
begin
  if not public.is_store_wide_manager(store_id) then
    raise exception 'Store-wide manager required' using errcode = '42501';
  end if;

  if asset_type not in ('store_logo', 'event_banner') then
    raise exception 'Invalid media asset type' using errcode = '23514';
  end if;

  if asset_type = 'event_banner' and (
    normalized_display_name is null
    or length(normalized_display_name) < 2
    or length(normalized_display_name) > 120
  ) then
    raise exception 'Custom event banner name must be between 2 and 120 characters' using errcode = '23514';
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
  ) >= 5 then
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
    display_name,
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
    normalized_display_name,
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

grant execute on function public.register_store_media_asset(uuid, text, text, text, text, text, text, integer, integer, integer)
  to authenticated;
