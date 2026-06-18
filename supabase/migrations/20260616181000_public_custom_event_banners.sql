create or replace function public.list_public_calendar(
  p_game_slug text default null,
  p_store_slug text default null,
  p_city text default null,
  p_from_date date default null,
  p_to_date date default null,
  p_limit integer default 25,
  p_cursor text default null
)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with filtered as (
    select
      e.*,
      s.slug as store_slug,
      s.name as store_name,
      g.slug as game_slug,
      g.name as game_name,
      pb.name as platform_banner_name,
      pb.storage_path as platform_banner_storage_path,
      cba.optimized_storage_path as custom_banner_optimized_storage_path,
      case
        when e.location_mode = 'branch' then b.city
        when e.location_mode = 'custom' then e.location_city
        else 'Online'
      end as effective_city
    from public.events e
    join public.stores s on s.id = e.store_id
    join public.games g on g.id = e.game_id
    left join public.branches b on b.id = e.branch_id
    left join public.platform_event_banners pb on pb.id = e.platform_banner_id
      and pb.status = 'active'
    left join public.store_media_assets cba on cba.id = e.custom_banner_asset_id
      and cba.store_id = e.store_id
      and cba.asset_type = 'event_banner'
      and cba.status = 'active'
      and cba.deleted_at is null
    where e.status = 'published' and e.archived_at is null and e.deleted_at is null
      and s.status = 'active' and s.deleted_at is null
      and (e.ends_at is null and e.starts_at >= now() or e.ends_at >= now())
      and (p_game_slug is null or g.slug = p_game_slug)
      and (p_store_slug is null or s.slug = p_store_slug)
      and (p_city is null or lower(case when e.location_mode = 'branch' then b.city when e.location_mode = 'custom' then e.location_city else 'Online' end) = lower(p_city))
      and (p_from_date is null or e.starts_at >= p_from_date::timestamptz)
      and (p_to_date is null or e.starts_at < (p_to_date + 1)::timestamptz)
      and (p_cursor is null or e.starts_at > p_cursor::timestamptz)
    order by e.starts_at, e.id
    limit least(greatest(p_limit, 1), 100)
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'storeSlug', store_slug,
      'storeName', store_name,
      'eventSlug', slug,
      'title', title,
      'gameSlug', game_slug,
      'gameName', game_name,
      'startsAt', starts_at,
      'endsAt', ends_at,
      'city', effective_city,
      'registrationMode', registration_mode,
      'locationMode', location_mode,
      'status', status,
      'bannerMode', banner_mode,
      'bannerPosition', banner_position,
      'platformBannerName', platform_banner_name,
      'platformBannerStoragePath', platform_banner_storage_path,
      'customBannerOptimizedStoragePath', custom_banner_optimized_storage_path
    ) order by starts_at), '[]'::jsonb),
    'nextCursor', case when count(*) = least(greatest(p_limit, 1), 100) then max(starts_at)::text else null end
  ) from filtered;
$$;

create or replace function public.get_public_event(p_store_slug text, p_event_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'storeSlug', s.slug,
    'storeName', s.name,
    'eventSlug', e.slug,
    'title', e.title,
    'description', e.description,
    'formatName', e.format_name,
    'status', e.status,
    'gameSlug', g.slug,
    'gameName', g.name,
    'otherGameName', e.other_game_name,
    'startsAt', e.starts_at,
    'endsAt', e.ends_at,
    'timezone', coalesce(b.timezone, s.timezone),
    'registrationMode', e.registration_mode,
    'externalRegistrationUrl', e.external_registration_url,
    'locationMode', e.location_mode,
    'locationText', e.location_text,
    'locationCity', case
      when e.location_mode = 'branch' then b.city
      when e.location_mode = 'custom' then e.location_city
      else null
    end,
    'locationRegion', case
      when e.location_mode = 'branch' then b.region
      when e.location_mode = 'custom' then e.location_region
      else null
    end,
    'locationCountryCode', case
      when e.location_mode = 'branch' then b.country_code
      when e.location_mode = 'custom' then e.location_country_code
      else null
    end,
    'branchName', b.name,
    'branchAddressLine', b.address_line,
    'entryFeeAmount', e.entry_fee_amount,
    'entryFeeCurrency', e.entry_fee_currency,
    'bannerMode', e.banner_mode,
    'bannerPosition', e.banner_position,
    'platformBannerName', pb.name,
    'platformBannerStoragePath', pb.storage_path,
    'customBannerOptimizedStoragePath', cba.optimized_storage_path,
    'cancellationMessage', e.cancellation_message,
    'archivedAt', e.archived_at
  )
  from public.events e
  join public.stores s on s.id = e.store_id
  join public.games g on g.id = e.game_id
  left join public.branches b on b.id = e.branch_id
  left join public.platform_event_banners pb on pb.id = e.platform_banner_id
    and pb.status = 'active'
  left join public.store_media_assets cba on cba.id = e.custom_banner_asset_id
    and cba.store_id = e.store_id
    and cba.asset_type = 'event_banner'
    and cba.status = 'active'
    and cba.deleted_at is null
  where s.slug = p_store_slug
    and e.slug = p_event_slug
    and e.published_at is not null
    and e.deleted_at is null
  limit 1;
$$;

create or replace function public.get_public_store_calendar(p_store_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with target_store as (
    select
      s.id,
      s.slug,
      s.name,
      s.description,
      s.logo_url,
      s.timezone,
      s.status,
      coalesce(
        (
          select b.city
          from public.branches b
          where b.store_id = s.id
            and b.status = 'active'
            and b.deleted_at is null
          order by b.created_at, b.id
          limit 1
        ),
        'Online'
      ) as city_label
    from public.stores s
    where s.slug = p_store_slug
      and s.status = 'active'
      and s.deleted_at is null
    limit 1
  ),
  store_branches as (
    select b.*
    from public.branches b
    join target_store s on s.id = b.store_id
    where b.status = 'active'
      and b.deleted_at is null
    order by b.name
  ),
  store_events as (
    select
      e.*,
      s.slug as store_slug,
      s.name as store_name,
      s.timezone as store_timezone,
      g.slug as game_slug,
      g.name as game_name,
      b.name as branch_name,
      b.address_line as branch_address_line,
      b.city as branch_city,
      b.region as branch_region,
      b.country_code as branch_country_code,
      b.timezone as branch_timezone,
      pb.name as platform_banner_name,
      pb.storage_path as platform_banner_storage_path,
      cba.optimized_storage_path as custom_banner_optimized_storage_path
    from public.events e
    join target_store s on s.id = e.store_id
    join public.games g on g.id = e.game_id
    left join public.branches b on b.id = e.branch_id
    left join public.platform_event_banners pb on pb.id = e.platform_banner_id
      and pb.status = 'active'
    left join public.store_media_assets cba on cba.id = e.custom_banner_asset_id
      and cba.store_id = e.store_id
      and cba.asset_type = 'event_banner'
      and cba.status = 'active'
      and cba.deleted_at is null
    where e.status = 'published'
      and e.archived_at is null
      and e.deleted_at is null
      and (e.ends_at is null and e.starts_at >= now() or e.ends_at >= now())
    order by e.starts_at, e.id
  )
  select case when not exists (select 1 from target_store) then null else jsonb_build_object(
    'store', (
      select jsonb_build_object(
        'id', id,
        'slug', slug,
        'name', name,
        'description', description,
        'logoUrl', logo_url,
        'timezone', timezone,
        'status', status,
        'cityLabel', city_label
      )
      from target_store
    ),
    'branches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'storeId', store_id,
        'slug', slug,
        'name', name,
        'city', city,
        'address', address_line,
        'status', status
      ) order by name)
      from store_branches
    ), '[]'::jsonb),
    'games', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', distinct_games.game_slug,
        'name', distinct_games.game_name
      ) order by distinct_games.game_name)
      from (
        select distinct game_slug, game_name
        from store_events
      ) distinct_games
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'storeSlug', store_slug,
        'storeName', store_name,
        'eventSlug', slug,
        'title', title,
        'description', description,
        'formatName', format_name,
        'status', status,
        'gameSlug', game_slug,
        'gameName', game_name,
        'otherGameName', other_game_name,
        'startsAt', starts_at,
        'endsAt', ends_at,
        'timezone', coalesce(branch_timezone, store_timezone),
        'registrationMode', registration_mode,
        'externalRegistrationUrl', external_registration_url,
        'locationMode', location_mode,
        'locationText', location_text,
        'locationCity', case
          when location_mode = 'branch' then branch_city
          when location_mode = 'custom' then location_city
          else null
        end,
        'locationRegion', case
          when location_mode = 'branch' then branch_region
          when location_mode = 'custom' then location_region
          else null
        end,
        'locationCountryCode', case
          when location_mode = 'branch' then branch_country_code
          when location_mode = 'custom' then location_country_code
          else null
        end,
        'branchId', branch_id,
        'branchName', branch_name,
        'branchAddressLine', branch_address_line,
        'entryFeeAmount', entry_fee_amount,
        'entryFeeCurrency', entry_fee_currency,
        'bannerMode', banner_mode,
        'bannerPosition', banner_position,
        'platformBannerName', platform_banner_name,
        'platformBannerStoragePath', platform_banner_storage_path,
        'customBannerOptimizedStoragePath', custom_banner_optimized_storage_path,
        'cancellationMessage', cancellation_message,
        'archivedAt', archived_at
      ) order by starts_at)
      from store_events
    ), '[]'::jsonb)
  ) end;
$$;
