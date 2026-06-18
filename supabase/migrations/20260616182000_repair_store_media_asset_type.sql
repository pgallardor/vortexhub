do $$
declare
  constraint_record record;
begin
  alter table public.store_media_assets
    add column if not exists asset_type varchar(30) not null default 'event_banner';

  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.store_media_assets'::regclass
      and contype = 'c'
      and (
        pg_get_constraintdef(oid) like '%width%'
        or pg_get_constraintdef(oid) like '%height%'
        or pg_get_constraintdef(oid) like '%asset_type%'
      )
  loop
    execute format('alter table public.store_media_assets drop constraint %I', constraint_record.conname);
  end loop;

  alter table public.store_media_assets
    add constraint store_media_assets_asset_type_check
    check (asset_type in ('store_logo', 'event_banner'));

  alter table public.store_media_assets
    add constraint store_media_assets_dimensions_check
    check (
      (asset_type = 'store_logo' and width >= 256 and height >= 256)
      or (asset_type = 'event_banner' and width >= 1200 and height >= 675)
    );

  create index if not exists store_media_assets_store_type_status_idx
    on public.store_media_assets (store_id, asset_type, status)
    where deleted_at is null;
end $$;
