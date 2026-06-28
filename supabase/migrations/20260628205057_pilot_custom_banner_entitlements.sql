insert into public.store_entitlements (
  store_id,
  feature,
  status,
  starts_at,
  ends_at,
  granted_by_account_id
)
select
  s.id,
  'custom_event_banners',
  'active',
  now(),
  null,
  null
from public.stores s
where s.deleted_at is null
  and s.status <> 'closed'
  and not exists (
    select 1
    from public.store_entitlements e
    where e.store_id = s.id
      and e.feature = 'custom_event_banners'
      and e.status = 'active'
      and e.starts_at <= now()
      and (e.ends_at is null or e.ends_at > now())
  );

update public.store_media_assets a
set status = 'active',
    remove_after = null
where a.asset_type = 'event_banner'
  and a.status = 'pending_removal'
  and a.deleted_at is null
  and exists (
    select 1
    from public.store_entitlements e
    where e.store_id = a.store_id
      and e.feature = 'custom_event_banners'
      and e.status = 'active'
      and e.starts_at <= now()
      and (e.ends_at is null or e.ends_at > now())
  );

create or replace function public.create_store(input jsonb)
returns public.stores
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.stores;
  pilot_entitlement public.store_entitlements;
begin
  if not public.is_active_account(auth.uid()) then
    raise exception 'Active account required' using errcode = '42501';
  end if;

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

  insert into public.store_entitlements (
    store_id,
    feature,
    status,
    starts_at,
    ends_at,
    granted_by_account_id
  )
  values (
    result.id,
    'custom_event_banners',
    'active',
    now(),
    null,
    null
  )
  returning * into pilot_entitlement;

  perform public.audit(
    'entitlement.granted',
    'store_entitlement',
    pilot_entitlement.id,
    pilot_entitlement.store_id
  );

  return result;
end;
$$;
