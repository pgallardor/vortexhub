create or replace function public.create_event(store_id uuid, input jsonb)
returns public.events
language plpgsql security definer set search_path = ''
as $$
declare
  result public.events;
  branch_id_value uuid := nullif(input->>'branchId', '')::uuid;
  game_id_value uuid := (input->>'gameId')::uuid;
  platform_banner_id_value uuid := nullif(input->>'platformBannerId', '')::uuid;
  custom_banner_id_value uuid := nullif(input->>'customBannerAssetId', '')::uuid;
begin
  perform public.assert_event_scope(store_id, branch_id_value);
  perform public.validate_game(game_id_value, input->>'otherGameName');
  perform public.validate_banner(store_id, input->>'bannerMode', platform_banner_id_value, custom_banner_id_value);
  if input->>'registrationMode' = 'external'
    and not public.validate_https_url(input->>'externalRegistrationUrl')
  then raise exception 'External registration URL must be HTTPS without credentials' using errcode = '23514'; end if;

  insert into public.events (
    store_id, branch_id, game_id, other_game_name, created_by_account_id, slug,
    title, description, format_name, registration_mode, external_registration_url,
    starts_at, ends_at, entry_fee_amount, entry_fee_currency, location_mode,
    location_text, location_city, location_region, location_country_code,
    banner_mode, platform_banner_id, custom_banner_asset_id
  ) values (
    store_id, branch_id_value, game_id_value, input->>'otherGameName', auth.uid(),
    public.unique_slug(coalesce(nullif(input->>'slug', ''), input->>'title'), 'event', store_id),
    trim(input->>'title'), input->>'description', input->>'formatName',
    input->>'registrationMode', input->>'externalRegistrationUrl',
    (input->>'startsAt')::timestamptz, nullif(input->>'endsAt', '')::timestamptz,
    nullif(input->>'entryFeeAmount', '')::numeric, input->>'entryFeeCurrency',
    input->>'locationMode', input->>'locationText', input->>'locationCity',
    input->>'locationRegion', input->>'locationCountryCode', input->>'bannerMode',
    platform_banner_id_value, custom_banner_id_value
  ) returning * into result;
  return result;
end;
$$;

create or replace function public.update_event(event_id uuid, input jsonb)
returns public.events
language plpgsql security definer set search_path = ''
as $$
declare
  current_event public.events;
  result public.events;
  branch_id_value uuid := nullif(input->>'branchId', '')::uuid;
  game_id_value uuid := (input->>'gameId')::uuid;
  platform_banner_id_value uuid := nullif(input->>'platformBannerId', '')::uuid;
  custom_banner_id_value uuid := nullif(input->>'customBannerAssetId', '')::uuid;
  old_starts_at timestamptz;
  old_ends_at timestamptz;
begin
  select * into current_event from public.events where id = event_id and deleted_at is null for update;
  if current_event.id is null then raise exception 'Event not found' using errcode = 'P0002'; end if;
  perform public.assert_event_scope(current_event.store_id, branch_id_value);
  perform public.validate_game(game_id_value, input->>'otherGameName');
  perform public.validate_banner(current_event.store_id, input->>'bannerMode', platform_banner_id_value, custom_banner_id_value);
  if input->>'registrationMode' = 'external'
    and not public.validate_https_url(input->>'externalRegistrationUrl')
  then raise exception 'External registration URL must be HTTPS without credentials' using errcode = '23514'; end if;
  if current_event.status in ('cancelled', 'completed') then
    raise exception 'Terminal event cannot be edited' using errcode = '23514';
  end if;
  old_starts_at := current_event.starts_at;
  old_ends_at := current_event.ends_at;
  update public.events set
    branch_id = branch_id_value,
    game_id = game_id_value,
    other_game_name = input->>'otherGameName',
    slug = case when published_at is null
      then public.unique_slug(coalesce(nullif(input->>'slug', ''), input->>'title'), 'event', store_id)
      else slug end,
    title = trim(input->>'title'),
    description = input->>'description',
    format_name = input->>'formatName',
    registration_mode = input->>'registrationMode',
    external_registration_url = input->>'externalRegistrationUrl',
    starts_at = (input->>'startsAt')::timestamptz,
    ends_at = nullif(input->>'endsAt', '')::timestamptz,
    entry_fee_amount = nullif(input->>'entryFeeAmount', '')::numeric,
    entry_fee_currency = input->>'entryFeeCurrency',
    location_mode = input->>'locationMode',
    location_text = input->>'locationText',
    location_city = input->>'locationCity',
    location_region = input->>'locationRegion',
    location_country_code = input->>'locationCountryCode',
    banner_mode = input->>'bannerMode',
    platform_banner_id = platform_banner_id_value,
    custom_banner_asset_id = custom_banner_id_value,
    is_series_exception = event_series_id is not null
  where id = event_id returning * into result;
  if old_starts_at is distinct from result.starts_at or old_ends_at is distinct from result.ends_at then
    perform public.audit('event.schedule_changed', 'event', result.id, result.store_id, result.branch_id);
  end if;
  return result;
end;
$$;

create or replace function public.publish_event(event_id uuid)
returns public.events
language plpgsql security definer set search_path = ''
as $$
declare result public.events;
begin
  select * into result from public.events where id = event_id and deleted_at is null for update;
  if result.id is null then raise exception 'Event not found' using errcode = 'P0002'; end if;
  perform public.assert_event_scope(result.store_id, result.branch_id);
  update public.events set status = 'published', published_at = coalesce(published_at, now())
    where id = event_id and status = 'draft' returning * into result;
  if result.id is null then raise exception 'Draft event not found' using errcode = 'P0002'; end if;
  perform public.audit('event.published', 'event', result.id, result.store_id, result.branch_id);
  return result;
end;
$$;

create or replace function public.cancel_event(event_id uuid, public_message text)
returns public.events
language plpgsql security definer set search_path = ''
as $$
declare result public.events;
begin
  select * into result from public.events where id = event_id and deleted_at is null for update;
  if result.id is null then raise exception 'Event not found' using errcode = 'P0002'; end if;
  perform public.assert_event_scope(result.store_id, result.branch_id);
  if result.status = 'published' and length(trim(public_message)) < 5 then
    raise exception 'Published event cancellation message is required' using errcode = '23514';
  end if;
  update public.events set status = 'cancelled', cancelled_at = now(),
    cancelled_by_account_id = auth.uid(),
    cancellation_message = case when published_at is null then null else trim(public_message) end
    where id = event_id and status in ('draft', 'published') returning * into result;
  if result.id is null then raise exception 'Event cannot be cancelled' using errcode = '23514'; end if;
  perform public.audit('event.cancelled', 'event', result.id, result.store_id, result.branch_id);
  return result;
end;
$$;

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
    location_region, location_country_code, banner_mode, platform_banner_id, custom_banner_asset_id
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
    platform_banner_id_value, custom_banner_id_value
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
    platform_banner_id = platform_banner_id_value, custom_banner_asset_id = custom_banner_id_value
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
      custom_banner_asset_id, published_at
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
      now()
    ) on conflict (event_series_id, series_local_date) do nothing;
    get diagnostics inserted_row_count = row_count;
    inserted_count := inserted_count + inserted_row_count;
  end loop;
  return inserted_count;
end;
$$;

create or replace function public.activate_event_series(series_id uuid)
returns public.event_series
language plpgsql security definer set search_path = ''
as $$
declare result public.event_series; local_today date; week_end date;
begin
  select * into result from public.event_series where id = series_id and deleted_at is null for update;
  if result.id is null then raise exception 'Series not found' using errcode = 'P0002'; end if;
  perform public.assert_event_scope(result.store_id, result.branch_id);
  update public.event_series set status = 'active', activated_at = coalesce(activated_at, now())
    where id = series_id and status = 'draft' returning * into result;
  if result.id is null then raise exception 'Draft series not found' using errcode = 'P0002'; end if;
  local_today := (now() at time zone result.timezone)::date;
  week_end := local_today + (7 - extract(isodow from local_today)::integer);
  perform public.generate_series_occurrences(result.id, local_today, week_end);
  perform public.audit('series.activated', 'event_series', result.id, result.store_id, result.branch_id);
  return result;
end;
$$;

create or replace function public.end_event_series(series_id uuid)
returns public.event_series
language plpgsql security definer set search_path = ''
as $$
declare result public.event_series;
begin
  select * into result from public.event_series where id = series_id and deleted_at is null for update;
  if result.id is null then raise exception 'Series not found' using errcode = 'P0002'; end if;
  perform public.assert_event_scope(result.store_id, result.branch_id);
  update public.event_series set status = 'ended', ended_at = now()
    where id = series_id and status = 'active' returning * into result;
  if result.id is null then raise exception 'Active series not found' using errcode = 'P0002'; end if;
  perform public.audit('series.ended', 'event_series', result.id, result.store_id, result.branch_id);
  return result;
end;
$$;

create or replace function public.close_branch_immediately(branch_id uuid, public_message text, internal_reason text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare b public.branches; batch_id uuid; cancelled_count integer;
begin
  select * into b from public.branches where id = branch_id for update;
  if b.id is null or not public.is_store_owner(b.store_id) then raise exception 'Owner required' using errcode = '42501'; end if;
  insert into public.event_cancellation_batches (store_id, branch_id, source, public_message, internal_reason, created_by_account_id)
  values (b.store_id, b.id, 'branch_closure', trim(public_message), internal_reason, auth.uid()) returning id into batch_id;
  update public.event_series es set status = 'ended', ended_at = now()
    where es.branch_id = b.id and es.status = 'active';
  update public.events e set status = 'cancelled', cancelled_at = now(), cancelled_by_account_id = auth.uid(),
    cancellation_message = trim(public_message), cancellation_batch_id = batch_id
    where e.branch_id = b.id and e.status = 'published' and e.starts_at >= now();
  get diagnostics cancelled_count = row_count;
  delete from public.branch_membership_assignments a where a.branch_id = b.id;
  update public.store_memberships m set status = 'disabled'
    where m.store_id = b.store_id and m.scope = 'branches' and m.status = 'active'
      and not exists (select 1 from public.branch_membership_assignments a where a.store_membership_id = m.id);
  update public.branches set status = 'inactive', closed_at = now() where id = b.id;
  perform public.audit('branch.closed', 'branch', b.id, b.store_id, b.id, jsonb_build_object('cancelledEvents', cancelled_count));
  return jsonb_build_object('branchId', b.id, 'cancellationBatchId', batch_id, 'cancelledEvents', cancelled_count);
end;
$$;

create or replace function public.close_store_immediately(store_id uuid, public_message text, internal_reason text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare batch_id uuid; cancelled_count integer;
begin
  perform 1 from public.stores where id = store_id and status = 'active' for update;
  if not found or not public.is_store_owner(store_id) then raise exception 'Owner required' using errcode = '42501'; end if;
  insert into public.event_cancellation_batches (store_id, source, public_message, internal_reason, created_by_account_id)
  values (store_id, 'store_closure', trim(public_message), internal_reason, auth.uid()) returning id into batch_id;
  update public.event_series es set status = 'ended', ended_at = now()
    where es.store_id = close_store_immediately.store_id and es.status = 'active';
  update public.events set status = 'cancelled', cancelled_at = now(), cancelled_by_account_id = auth.uid(),
    cancellation_message = trim(public_message), cancellation_batch_id = batch_id
    where events.store_id = close_store_immediately.store_id and status = 'published' and starts_at >= now();
  get diagnostics cancelled_count = row_count;
  update public.branches set status = 'inactive', closed_at = now()
    where branches.store_id = close_store_immediately.store_id and status = 'active';
  update public.store_memberships set status = 'disabled'
    where store_memberships.store_id = close_store_immediately.store_id and status = 'active';
  update public.stores set status = 'closed', closed_at = now() where id = store_id;
  perform public.audit('store.closed', 'store', store_id, store_id, null, jsonb_build_object('cancelledEvents', cancelled_count));
  return jsonb_build_object('storeId', store_id, 'cancellationBatchId', batch_id, 'cancelledEvents', cancelled_count);
end;
$$;

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
    select e.*, s.slug as store_slug, s.name as store_name, g.slug as game_slug, g.name as game_name,
      case when e.location_mode = 'branch' then b.city when e.location_mode = 'custom' then e.location_city else 'Online' end as effective_city
    from public.events e
    join public.stores s on s.id = e.store_id
    join public.games g on g.id = e.game_id
    left join public.branches b on b.id = e.branch_id
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
      'storeSlug', store_slug, 'storeName', store_name, 'eventSlug', slug,
      'title', title, 'gameSlug', game_slug, 'gameName', game_name,
      'startsAt', starts_at, 'endsAt', ends_at, 'city', effective_city,
      'registrationMode', registration_mode, 'locationMode', location_mode,
      'status', status
    ) order by starts_at), '[]'::jsonb),
    'nextCursor', case when count(*) = least(greatest(p_limit, 1), 100) then max(starts_at)::text else null end
  ) from filtered;
$$;

create or replace function public.get_public_event(p_store_slug text, p_event_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'storeSlug', s.slug, 'storeName', s.name, 'eventSlug', e.slug, 'title', e.title,
    'description', e.description, 'formatName', e.format_name, 'status', e.status,
    'gameSlug', g.slug, 'gameName', g.name, 'otherGameName', e.other_game_name,
    'startsAt', e.starts_at, 'endsAt', e.ends_at, 'registrationMode', e.registration_mode,
    'externalRegistrationUrl', e.external_registration_url, 'locationMode', e.location_mode,
    'locationText', e.location_text, 'cancellationMessage', e.cancellation_message,
    'archivedAt', e.archived_at
  )
  from public.events e
  join public.stores s on s.id = e.store_id
  join public.games g on g.id = e.game_id
  where s.slug = p_store_slug and e.slug = p_event_slug and e.published_at is not null and e.deleted_at is null
  limit 1;
$$;

create or replace function public.complete_due_events()
returns integer language plpgsql security definer set search_path = ''
as $$
declare affected integer;
begin
  update public.events set status = 'completed'
  where status = 'published' and deleted_at is null
    and coalesce(ends_at, starts_at + interval '6 hours') <= now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.archive_due_events()
returns integer language plpgsql security definer set search_path = ''
as $$
declare affected integer;
begin
  update public.events set archived_at = now()
  where status in ('completed', 'cancelled') and archived_at is null
    and coalesce(ends_at, starts_at) <= now() - interval '12 months';
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.expire_invitations()
returns integer language plpgsql security definer set search_path = ''
as $$
declare affected integer;
begin
  update public.store_membership_invitations set status = 'expired'
    where status = 'pending' and expires_at <= now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.unique_slug(text, text, uuid) from public;
revoke all on function public.has_current_age_acceptance(uuid) from public;
revoke all on function public.is_active_account(uuid) from public;
revoke all on function public.is_platform_role(text) from public;
revoke all on function public.active_membership(uuid, uuid) from public;
revoke all on function public.can_read_store(uuid, uuid) from public;
revoke all on function public.can_manage_store(uuid, uuid) from public;
revoke all on function public.is_store_owner(uuid) from public;
revoke all on function public.is_store_wide_manager(uuid) from public;
revoke all on function public.audit(text, text, uuid, uuid, uuid, jsonb) from public;
revoke all on function public.validate_game(uuid, text) from public;
revoke all on function public.validate_banner(uuid, text, uuid, uuid) from public;
revoke all on function public.assert_event_scope(uuid, uuid) from public;
revoke all on function public.generate_series_occurrences(uuid, date, date) from public;
revoke all on function public.complete_due_events() from public;
revoke all on function public.archive_due_events() from public;
revoke all on function public.expire_invitations() from public;

grant execute on function public.create_user_account(jsonb) to authenticated;
grant execute on function public.accept_legal_document(uuid) to authenticated;
grant execute on function public.activate_user_account() to authenticated;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.restore_account_before_anonymization() to authenticated;
grant execute on function public.create_store(jsonb) to authenticated;
grant execute on function public.activate_store(uuid) to authenticated;
grant execute on function public.create_branch(uuid, jsonb) to authenticated;
grant execute on function public.activate_branch(uuid) to authenticated;
grant execute on function public.reactivate_branch(uuid) to authenticated;
grant execute on function public.invite_store_member(uuid, jsonb) to authenticated;
grant execute on function public.revoke_store_invitation(uuid) to authenticated;
grant execute on function public.accept_store_invitation(text) to authenticated;
grant execute on function public.change_store_membership(uuid, jsonb) to authenticated;
grant execute on function public.disable_store_membership(uuid) to authenticated;
grant execute on function public.set_branch_membership_assignments(uuid, uuid[]) to authenticated;
grant execute on function public.create_event(uuid, jsonb) to authenticated;
grant execute on function public.update_event(uuid, jsonb) to authenticated;
grant execute on function public.publish_event(uuid) to authenticated;
grant execute on function public.cancel_event(uuid, text) to authenticated;
grant execute on function public.create_event_series(uuid, jsonb) to authenticated;
grant execute on function public.update_event_series(uuid, jsonb) to authenticated;
grant execute on function public.activate_event_series(uuid) to authenticated;
grant execute on function public.end_event_series(uuid) to authenticated;
grant execute on function public.close_branch_immediately(uuid, text, text) to authenticated;
grant execute on function public.close_store_immediately(uuid, text, text) to authenticated;
grant execute on function public.list_public_calendar(text, text, text, date, date, integer, text) to anon, authenticated;
grant execute on function public.get_public_event(text, text) to anon, authenticated;
