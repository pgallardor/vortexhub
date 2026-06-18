create or replace function public.create_branch(store_id uuid, input jsonb)
returns public.branches
language plpgsql security definer set search_path = ''
as $$
declare result public.branches;
begin
  if not public.is_store_wide_manager(store_id) then raise exception 'Store-wide manager required' using errcode = '42501'; end if;
  insert into public.branches (
    store_id, name, slug, address_line, city, region, country_code, latitude, longitude, timezone
  ) values (
    store_id, trim(input->>'name'),
    public.unique_slug(input->>'name', 'branch', store_id),
    input->>'addressLine', input->>'city', input->>'region', input->>'countryCode',
    (input->>'latitude')::numeric, (input->>'longitude')::numeric, input->>'timezone'
  ) returning * into result;
  return result;
end;
$$;
