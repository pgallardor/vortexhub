create or replace function public.rename_store_media_asset(asset_id uuid, display_name text)
returns public.store_media_assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_display_name text := nullif(trim(display_name), '');
  result public.store_media_assets;
begin
  if normalized_display_name is null
    or length(normalized_display_name) < 2
    or length(normalized_display_name) > 120
  then
    raise exception 'Custom event banner name must be between 2 and 120 characters' using errcode = '23514';
  end if;

  select *
  into result
  from public.store_media_assets
  where id = asset_id
  for update;

  if result.id is null
    or result.asset_type <> 'event_banner'
    or result.status <> 'active'
    or result.deleted_at is not null
    or not public.is_store_wide_manager(result.store_id)
  then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.store_media_assets
  set display_name = normalized_display_name,
      updated_at = now()
  where id = asset_id
  returning * into result;

  perform public.audit(
    'custom_banner.renamed',
    'store_media_asset',
    result.id,
    result.store_id
  );

  return result;
end;
$$;

revoke all on function public.rename_store_media_asset(uuid, text) from public;
grant execute on function public.rename_store_media_asset(uuid, text) to authenticated;
