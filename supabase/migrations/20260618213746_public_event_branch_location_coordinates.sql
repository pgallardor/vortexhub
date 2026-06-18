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
    'branchLatitude', case when e.location_mode = 'branch' then b.latitude else null end,
    'branchLongitude', case when e.location_mode = 'branch' then b.longitude else null end,
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
