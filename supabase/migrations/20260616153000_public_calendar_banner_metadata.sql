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
      'platformBannerName', platform_banner_name,
      'platformBannerStoragePath', platform_banner_storage_path
    ) order by starts_at), '[]'::jsonb),
    'nextCursor', case when count(*) = least(greatest(p_limit, 1), 100) then max(starts_at)::text else null end
  ) from filtered;
$$;
