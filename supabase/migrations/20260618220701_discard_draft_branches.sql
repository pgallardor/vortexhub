create or replace function public.discard_draft_branch(branch_id uuid)
returns public.branches
language plpgsql security definer set search_path = ''
as $$
declare result public.branches;
begin
  select * into result from public.branches where id = branch_id for update;
  if result.id is null or not public.is_store_owner(result.store_id) then
    raise exception 'Owner authorization required' using errcode = '42501';
  end if;
  if result.status <> 'draft' then
    raise exception 'Only draft branches can be discarded' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.events e
    where e.branch_id = result.id and e.deleted_at is null
  ) or exists (
    select 1 from public.event_series es
    where es.branch_id = result.id and es.deleted_at is null
  ) then
    raise exception 'Draft branch has linked activity' using errcode = '23514';
  end if;

  update public.branches
    set deleted_at = now()
    where id = result.id
    returning * into result;
  return result;
end;
$$;

grant execute on function public.discard_draft_branch(uuid) to authenticated;

create or replace function public.create_active_branch(store_id uuid, input jsonb)
returns public.branches
language plpgsql security definer set search_path = ''
as $$
declare
  result public.branches;
  effective_timezone text;
begin
  if not public.is_store_wide_manager(store_id) then
    raise exception 'Store-wide manager required' using errcode = '42501';
  end if;

  select coalesce(nullif(input->>'timezone', ''), s.timezone)
    into effective_timezone
  from public.stores s
  where s.id = create_active_branch.store_id
    and s.deleted_at is null;

  if effective_timezone is null
    or nullif(input->>'addressLine', '') is null
    or nullif(input->>'city', '') is null
    or nullif(input->>'countryCode', '') is null
    or not exists (select 1 from pg_catalog.pg_timezone_names where name = effective_timezone)
  then
    raise exception 'Complete physical location and valid timezone required' using errcode = '23514';
  end if;

  insert into public.branches (
    store_id, name, slug, address_line, city, region, country_code,
    latitude, longitude, timezone, status, activated_at
  ) values (
    store_id,
    trim(input->>'name'),
    public.unique_slug(input->>'name', 'branch', store_id),
    input->>'addressLine',
    input->>'city',
    input->>'region',
    input->>'countryCode',
    (input->>'latitude')::numeric,
    (input->>'longitude')::numeric,
    nullif(input->>'timezone', ''),
    'active',
    now()
  ) returning * into result;

  perform public.audit('branch.activated', 'branch', result.id, result.store_id, result.id);
  return result;
end;
$$;

grant execute on function public.create_active_branch(uuid, jsonb) to authenticated;
