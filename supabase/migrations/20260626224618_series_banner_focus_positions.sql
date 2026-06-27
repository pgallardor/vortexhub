alter table public.event_series
  add column if not exists banner_position varchar(30) not null default 'center';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.event_series'::regclass
      and conname = 'event_series_banner_position_check'
  ) then
    alter table public.event_series
      add constraint event_series_banner_position_check
      check (banner_position in (
        'center 20%', 'center 32%', 'center 42%', 'center',
        'center 58%', 'center 68%', 'center 80%',
        'left center', 'right center'
      ));
  end if;
end $$;

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

create or replace function public.create_event_series(store_id uuid, input jsonb)
returns public.event_series
language plpgsql security definer set search_path = ''
as $$
declare
  result public.event_series;
  branch_id_value uuid := nullif(input->>'branchId', '')::uuid;
  game_id_value uuid := (input->>'gameId')::uuid;
  platform_banner_id_value uuid := nullif(input->>'platformBannerId', '')::uuid;
  custom_banner_id_value uuid := nullif(input->>'customBannerAssetId', '')::uuid;
begin
  perform public.assert_event_scope(store_id, branch_id_value);
  perform public.validate_game(game_id_value, input->>'otherGameName');
  perform public.validate_banner(store_id, input->>'bannerMode', platform_banner_id_value, custom_banner_id_value);
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = input->>'timezone') then
    raise exception 'Invalid IANA timezone' using errcode = '23514';
  end if;
  if (select count(*) = count(distinct value) from jsonb_array_elements_text(input->'weekdays'))
    is not true then raise exception 'Weekdays must be unique' using errcode = '23514'; end if;
  if input->>'registrationMode' = 'external'
    and not public.validate_https_url(input->>'externalRegistrationUrl')
  then raise exception 'External registration URL must be HTTPS without credentials' using errcode = '23514'; end if;

  insert into public.event_series (
    store_id, branch_id, game_id, other_game_name, created_by_account_id, slug,
    title, description, format_name, weekdays, local_start_time, duration_minutes,
    timezone, starts_on, ends_on, registration_mode, external_registration_url,
    entry_fee_amount, entry_fee_currency, location_mode, location_text, location_city,
    location_region, location_country_code, banner_mode, platform_banner_id,
    custom_banner_asset_id, banner_position
  ) values (
    store_id, branch_id_value, game_id_value, input->>'otherGameName', auth.uid(),
    public.unique_slug(coalesce(nullif(input->>'slug', ''), input->>'title'), 'series', store_id),
    trim(input->>'title'), input->>'description', input->>'formatName',
    array(select jsonb_array_elements_text(input->'weekdays')::smallint),
    (input->>'localStartTime')::time, nullif(input->>'durationMinutes', '')::integer,
    input->>'timezone', (input->>'startsOn')::date, nullif(input->>'endsOn', '')::date,
    input->>'registrationMode', input->>'externalRegistrationUrl',
    nullif(input->>'entryFeeAmount', '')::numeric, input->>'entryFeeCurrency',
    input->>'locationMode', input->>'locationText', input->>'locationCity',
    input->>'locationRegion', input->>'locationCountryCode', input->>'bannerMode',
    platform_banner_id_value, custom_banner_id_value,
    coalesce(nullif(input->>'bannerPosition', ''), 'center')
  ) returning * into result;
  return result;
end;
$$;

create or replace function public.update_event_series(series_id uuid, input jsonb)
returns public.event_series
language plpgsql security definer set search_path = ''
as $$
declare
  current_series public.event_series;
  result public.event_series;
  branch_id_value uuid := nullif(input->>'branchId', '')::uuid;
  platform_banner_id_value uuid := nullif(input->>'platformBannerId', '')::uuid;
  custom_banner_id_value uuid := nullif(input->>'customBannerAssetId', '')::uuid;
begin
  select * into current_series from public.event_series where id = series_id and deleted_at is null for update;
  if current_series.id is null then raise exception 'Series not found' using errcode = 'P0002'; end if;
  if current_series.status = 'ended' then raise exception 'Ended series cannot be edited' using errcode = '23514'; end if;
  perform public.assert_event_scope(current_series.store_id, branch_id_value);
  perform public.validate_game((input->>'gameId')::uuid, input->>'otherGameName');
  perform public.validate_banner(current_series.store_id, input->>'bannerMode', platform_banner_id_value, custom_banner_id_value);
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = input->>'timezone') then
    raise exception 'Invalid IANA timezone' using errcode = '23514';
  end if;
  update public.event_series set
    branch_id = branch_id_value, game_id = (input->>'gameId')::uuid,
    other_game_name = input->>'otherGameName',
    slug = case when activated_at is null
      then public.unique_slug(coalesce(nullif(input->>'slug', ''), input->>'title'), 'series', store_id)
      else slug end,
    title = trim(input->>'title'), description = input->>'description', format_name = input->>'formatName',
    weekdays = array(select jsonb_array_elements_text(input->'weekdays')::smallint),
    local_start_time = (input->>'localStartTime')::time,
    duration_minutes = nullif(input->>'durationMinutes', '')::integer,
    timezone = input->>'timezone', starts_on = (input->>'startsOn')::date,
    ends_on = nullif(input->>'endsOn', '')::date,
    registration_mode = input->>'registrationMode', external_registration_url = input->>'externalRegistrationUrl',
    entry_fee_amount = nullif(input->>'entryFeeAmount', '')::numeric, entry_fee_currency = input->>'entryFeeCurrency',
    location_mode = input->>'locationMode', location_text = input->>'locationText',
    location_city = input->>'locationCity', location_region = input->>'locationRegion',
    location_country_code = input->>'locationCountryCode', banner_mode = input->>'bannerMode',
    platform_banner_id = platform_banner_id_value,
    custom_banner_asset_id = custom_banner_id_value,
    banner_position = coalesce(nullif(input->>'bannerPosition', ''), 'center')
    where id = series_id returning * into result;
  return result;
end;
$$;

create or replace function public.generate_series_occurrences(
  series_id uuid, window_start date, window_end date
)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare s public.event_series; local_date date; local_start timestamp; start_value timestamptz;
  inserted_count integer := 0; inserted_row_count integer := 0;
begin
  select * into s from public.event_series where id = series_id and status = 'active' and deleted_at is null;
  if s.id is null then return 0; end if;
  for local_date in
    select d::date from generate_series(window_start, window_end, interval '1 day') d
    where extract(isodow from d)::smallint = any(s.weekdays)
      and d::date >= s.starts_on and (s.ends_on is null or d::date <= s.ends_on)
  loop
    local_start := local_date + s.local_start_time;
    start_value := local_start at time zone s.timezone;
    insert into public.events (
      event_series_id, series_local_date, store_id, branch_id, game_id, other_game_name,
      created_by_account_id, slug, title, description, format_name, status,
      registration_mode, external_registration_url, starts_at, ends_at,
      entry_fee_amount, entry_fee_currency, location_mode, location_text, location_city,
      location_region, location_country_code, banner_mode, platform_banner_id,
      custom_banner_asset_id, banner_position, published_at
    ) values (
      s.id, local_date, s.store_id, s.branch_id, s.game_id, s.other_game_name,
      s.created_by_account_id, public.unique_slug(s.slug || '-' || local_date::text, 'event', s.store_id),
      s.title, s.description, s.format_name, 'published', s.registration_mode,
      s.external_registration_url, start_value,
      case when s.duration_minutes is null then null else start_value + make_interval(mins => s.duration_minutes) end,
      s.entry_fee_amount, s.entry_fee_currency, s.location_mode, s.location_text, s.location_city,
      s.location_region, s.location_country_code,
      case when s.banner_mode = 'custom' and exists (
        select 1 from public.store_media_assets a join public.store_entitlements e on e.store_id = a.store_id
        where a.id = s.custom_banner_asset_id and a.status = 'active'
          and e.feature = 'custom_event_banners' and e.status = 'active'
          and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
      ) then 'custom' else 'platform' end,
      case when s.banner_mode = 'custom' and exists (
        select 1 from public.store_media_assets a join public.store_entitlements e on e.store_id = a.store_id
        where a.id = s.custom_banner_asset_id and a.status = 'active'
          and e.feature = 'custom_event_banners' and e.status = 'active'
          and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
      ) then null when s.banner_mode = 'platform' then s.platform_banner_id else (
        select id from public.platform_event_banners
        where status = 'active' and is_default and (game_id = s.game_id or game_id is null)
        order by game_id nulls last limit 1
      ) end,
      case when s.banner_mode = 'custom' and exists (
        select 1 from public.store_media_assets a join public.store_entitlements e on e.store_id = a.store_id
        where a.id = s.custom_banner_asset_id and a.status = 'active'
          and e.feature = 'custom_event_banners' and e.status = 'active'
          and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
      ) then s.custom_banner_asset_id else null end,
      s.banner_position,
      now()
    ) on conflict (event_series_id, series_local_date) do nothing;
    get diagnostics inserted_row_count = row_count;
    inserted_count := inserted_count + inserted_row_count;
  end loop;
  return inserted_count;
end;
$$;
