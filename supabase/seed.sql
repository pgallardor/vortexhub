insert into public.legal_document_versions (
  document_key, version, content, content_hash, is_current, published_at
) values (
  'minimum_age_declaration',
  '2026-06-26-clean',
  'Declaro que tengo al menos 18 años y entiendo que esta declaración es necesaria para crear y operar una cuenta de tienda en VortexHub.',
  encode(extensions.digest(
    'Declaro que tengo al menos 18 años y entiendo que esta declaración es necesaria para crear y operar una cuenta de tienda en VortexHub.',
    'sha256'
  ), 'hex'),
  true,
  now()
)
on conflict (document_key, version) do nothing;

insert into public.games (name, slug, publisher) values
  ('Miscelaneo', 'miscelaneo', null),
  ('Otros', 'otros', null),
  ('Pokemon TCG', 'pokemon-tcg', null),
  ('One Piece TCG', 'one-piece-tcg', null),
  ('Mitos y Leyendas', 'mitos-y-leyendas', null),
  ('Digimon TCG', 'digimon-tcg', null),
  ('Yu-Gi-Oh!', 'yugioh', null),
  ('Riftbound', 'riftbound', null),
  ('Beyblade', 'beyblade', null),
  ('Gundam TCG', 'gundam-tcg', null),
  ('Flesh and Blood', 'flesh-and-blood', null),
  ('Grand Archive', 'grand-archive', null),
  ('Shadowverse: Evolve', 'shadowverse-evolve', null)
on conflict (slug) do update
set name = excluded.name,
    publisher = excluded.publisher,
    is_active = true,
    updated_at = now();

insert into public.platform_event_banners (game_id, name, storage_path, is_default, status)
select null, 'VortexHub Default', 'platform/default.webp', true, 'active'
where not exists (
  select 1 from public.platform_event_banners where storage_path = 'platform/default.webp'
);

insert into public.platform_event_banners (game_id, name, storage_path, is_default, status)
select id, name || ' Default', 'platform/' || slug || '-default.webp', true, 'active'
from public.games
where not exists (
  select 1
  from public.platform_event_banners
  where storage_path = 'platform/' || public.games.slug || '-default.webp'
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('platform-event-banners', 'platform-event-banners', true, 5242880, array['image/webp']),
  ('store-media-sources', 'store-media-sources', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('store-media-optimized', 'store-media-optimized', true, 5242880, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
