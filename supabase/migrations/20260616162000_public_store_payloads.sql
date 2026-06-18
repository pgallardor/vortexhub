create or replace function public.list_public_stores()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with active_stores as (
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
    where s.status = 'active'
      and s.deleted_at is null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'slug', slug,
    'name', name,
    'description', description,
    'logoUrl', logo_url,
    'timezone', timezone,
    'status', status,
    'cityLabel', city_label
  ) order by name), '[]'::jsonb)
  from active_stores;
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
      case
        when e.location_mode = 'branch' then b.city
        when e.location_mode = 'custom' then e.location_city
        else 'Online'
      end as effective_city
    from public.events e
    join target_store s on s.id = e.store_id
    join public.games g on g.id = e.game_id
    left join public.branches b on b.id = e.branch_id
    left join public.platform_event_banners pb on pb.id = e.platform_banner_id
      and pb.status = 'active'
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
        'platformBannerName', platform_banner_name,
        'platformBannerStoragePath', platform_banner_storage_path,
        'cancellationMessage', cancellation_message,
        'archivedAt', archived_at
      ) order by starts_at)
      from store_events
    ), '[]'::jsonb)
  ) end;
$$;

grant execute on function public.list_public_stores() to anon, authenticated;
grant execute on function public.get_public_store_calendar(text) to anon, authenticated;
