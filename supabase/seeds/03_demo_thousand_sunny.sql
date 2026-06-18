-- Demo store and events for local development.
--
-- Prerequisites:
-- 1. supabase/seed.sql
-- 2. supabase/seeds/02_dev_users.sql
--
-- Load with:
-- psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/seeds/03_demo_thousand_sunny.sql

do $$
begin
  if not exists (
    select 1 from public.user_accounts
    where id = '00000000-0000-4000-8000-000000000010'
      and status = 'active'
      and deleted_at is null
  ) then
    raise exception 'Missing dev users. Run supabase/seeds/02_dev_users.sql first.';
  end if;
end $$;

insert into public.games (name, slug, publisher) values
  ('Pokemon TCG', 'pokemon-tcg', null),
  ('One Piece TCG', 'one-piece-tcg', null),
  ('Yu-Gi-Oh!', 'yugioh', null)
on conflict (slug) do update
set name = excluded.name,
    publisher = excluded.publisher,
    is_active = true,
    updated_at = now();

insert into public.platform_event_banners (game_id, name, storage_path, is_default, status)
select id, name || ' Default', 'platform/' || slug || '-default.webp', true, 'active'
from public.games
where slug in ('pokemon-tcg', 'one-piece-tcg', 'yugioh')
  and not exists (
    select 1
    from public.platform_event_banners
    where game_id = public.games.id
      and is_default
      and status = 'active'
  );

insert into public.stores (
  id,
  name,
  slug,
  description,
  logo_url,
  timezone,
  status,
  activated_at
) values (
  '00000000-0000-4000-8000-000000001000',
  'Thousand Sunny TCG',
  'thousand-sunny-tcg',
  'Tienda y punto de encuentro para comunidades TCG en Concepción, con torneos semanales, ligas casuales y eventos de fin de semana.',
  null,
  'America/Santiago',
  'active',
  now()
)
on conflict (slug) where deleted_at is null do update
set name = excluded.name,
    description = excluded.description,
    timezone = excluded.timezone,
    status = 'active',
    activated_at = coalesce(public.stores.activated_at, excluded.activated_at),
    closed_at = null,
    updated_at = now();

insert into public.branches (
  id,
  store_id,
  name,
  slug,
  address_line,
  city,
  region,
  country_code,
  latitude,
  longitude,
  timezone,
  status,
  activated_at
) values (
  '00000000-0000-4000-8000-000000001001',
  '00000000-0000-4000-8000-000000001000',
  'Casa Matriz Concepción',
  'casa-matriz-concepcion',
  'Barros Arana 1068, local 21',
  'Concepción',
  'Biobío',
  'CL',
  -36.827000,
  -73.050300,
  'America/Santiago',
  'active',
  now()
)
on conflict (store_id, slug) where deleted_at is null do update
set name = excluded.name,
    address_line = excluded.address_line,
    city = excluded.city,
    region = excluded.region,
    country_code = excluded.country_code,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    timezone = excluded.timezone,
    status = 'active',
    activated_at = coalesce(public.branches.activated_at, excluded.activated_at),
    closed_at = null,
    updated_at = now();

insert into public.store_memberships (
  store_id,
  user_account_id,
  role,
  scope,
  status,
  accepted_at
) values
  (
    '00000000-0000-4000-8000-000000001000',
    '00000000-0000-4000-8000-000000000010',
    'owner',
    'store',
    'active',
    now()
  ),
  (
    '00000000-0000-4000-8000-000000001000',
    '00000000-0000-4000-8000-000000000011',
    'admin',
    'store',
    'active',
    now()
  ),
  (
    '00000000-0000-4000-8000-000000001000',
    '00000000-0000-4000-8000-000000000012',
    'staff',
    'branches',
    'active',
    now()
  )
on conflict (store_id, user_account_id) where deleted_at is null do update
set role = excluded.role,
    scope = excluded.scope,
    status = 'active',
    accepted_at = coalesce(public.store_memberships.accepted_at, excluded.accepted_at),
    updated_at = now();

insert into public.branch_membership_assignments (
  store_membership_id,
  branch_id,
  store_id
)
select
  store_memberships.id,
  '00000000-0000-4000-8000-000000001001',
  '00000000-0000-4000-8000-000000001000'
from public.store_memberships
where store_memberships.store_id = '00000000-0000-4000-8000-000000001000'
  and store_memberships.user_account_id = '00000000-0000-4000-8000-000000000012'
  and store_memberships.deleted_at is null
on conflict (store_membership_id, branch_id) do nothing;

with event_seed (
  id,
  game_slug,
  banner_slug,
  slug,
  title,
  description,
  format_name,
  registration_mode,
  external_registration_url,
  starts_at,
  ends_at,
  entry_fee_amount
) as (
  values
    (
      '00000000-0000-4000-8000-000000002001'::uuid,
      'one-piece-tcg',
      'one-piece-tcg',
      'one-piece-liga-local-2026-06-16',
      'One Piece TCG - Liga Local',
      'Rondas suizas para comunidad local. Ideal para probar mazos antes del fin de semana.',
      'Constructed',
      'disabled',
      null,
      '2026-06-16 19:00:00-04'::timestamptz,
      '2026-06-16 22:00:00-04'::timestamptz,
      3000.00
    ),
    (
      '00000000-0000-4000-8000-000000002002'::uuid,
      'pokemon-tcg',
      'pokemon-tcg',
      'pokemon-tcg-practice-night-2026-06-17',
      'Pokemon TCG - Practice Night',
      'Noche casual para testear listas, aprender matchups y preparar torneos.',
      'Casual',
      'disabled',
      null,
      '2026-06-17 18:30:00-04'::timestamptz,
      '2026-06-17 21:30:00-04'::timestamptz,
      null
    ),
    (
      '00000000-0000-4000-8000-000000002003'::uuid,
      'yugioh',
      'yugioh',
      'yugioh-advanced-jueves-2026-06-18',
      'Yu-Gi-Oh! - Advanced Jueves',
      'Torneo formato Advanced con premios en sobres segun asistencia.',
      'Advanced',
      'external',
      'https://events.vortexhub.local/thousand-sunny/yugioh-advanced-jueves-2026-06-18',
      '2026-06-18 19:00:00-04'::timestamptz,
      '2026-06-18 22:30:00-04'::timestamptz,
      5000.00
    ),
    (
      '00000000-0000-4000-8000-000000002004'::uuid,
      'one-piece-tcg',
      'one-piece-tcg',
      'one-piece-friday-battle-2026-06-19',
      'One Piece TCG - Friday Battle',
      'Evento competitivo de viernes con cupos limitados y premios por ranking.',
      'Constructed',
      'external',
      'https://events.vortexhub.local/thousand-sunny/one-piece-friday-battle-2026-06-19',
      '2026-06-19 19:30:00-04'::timestamptz,
      '2026-06-19 23:00:00-04'::timestamptz,
      6000.00
    ),
    (
      '00000000-0000-4000-8000-000000002005'::uuid,
      'pokemon-tcg',
      'pokemon-tcg',
      'pokemon-tcg-saturday-cup-2026-06-20',
      'Pokemon TCG - Saturday Cup',
      'Torneo suizo de sabado para jugadores nuevos y competitivos.',
      'Standard',
      'external',
      'https://events.vortexhub.local/thousand-sunny/pokemon-saturday-cup-2026-06-20',
      '2026-06-20 12:00:00-04'::timestamptz,
      '2026-06-20 16:00:00-04'::timestamptz,
      5000.00
    ),
    (
      '00000000-0000-4000-8000-000000002006'::uuid,
      'yugioh',
      'yugioh',
      'yugioh-sunday-locals-2026-06-21',
      'Yu-Gi-Oh! - Sunday Locals',
      'Domingo de locals con ambiente casual competitivo y premios por participacion.',
      'Advanced',
      'external',
      'https://events.vortexhub.local/thousand-sunny/yugioh-sunday-locals-2026-06-21',
      '2026-06-21 16:00:00-04'::timestamptz,
      '2026-06-21 20:00:00-04'::timestamptz,
      5000.00
    ),
    (
      '00000000-0000-4000-8000-000000002007'::uuid,
      'pokemon-tcg',
      'pokemon-tcg',
      'pokemon-tcg-liga-martes-2026-06-23',
      'Pokemon TCG - Liga Martes',
      'Liga semanal con partidas libres, intercambio y soporte para jugadores nuevos.',
      'League',
      'disabled',
      null,
      '2026-06-23 18:00:00-04'::timestamptz,
      '2026-06-23 21:00:00-04'::timestamptz,
      null
    ),
    (
      '00000000-0000-4000-8000-000000002008'::uuid,
      'one-piece-tcg',
      'one-piece-tcg',
      'one-piece-constructed-2026-06-24',
      'One Piece TCG - Constructed',
      'Torneo de mitad de semana para medir listas y preparar los eventos grandes.',
      'Constructed',
      'external',
      'https://events.vortexhub.local/thousand-sunny/one-piece-constructed-2026-06-24',
      '2026-06-24 19:00:00-04'::timestamptz,
      '2026-06-24 22:30:00-04'::timestamptz,
      5000.00
    ),
    (
      '00000000-0000-4000-8000-000000002009'::uuid,
      'yugioh',
      'yugioh',
      'yugioh-duel-night-2026-06-25',
      'Yu-Gi-Oh! - Duel Night',
      'Noche de duelo con mesas casuales y mini torneo segun asistencia.',
      'Casual / Advanced',
      'disabled',
      null,
      '2026-06-25 18:30:00-04'::timestamptz,
      '2026-06-25 22:00:00-04'::timestamptz,
      2000.00
    ),
    (
      '00000000-0000-4000-8000-000000002010'::uuid,
      'pokemon-tcg',
      'pokemon-tcg',
      'pokemon-tcg-friday-standard-2026-06-26',
      'Pokemon TCG - Friday Standard',
      'Torneo Standard de viernes con premios en sobres y puntos de liga interna.',
      'Standard',
      'external',
      'https://events.vortexhub.local/thousand-sunny/pokemon-friday-standard-2026-06-26',
      '2026-06-26 19:00:00-04'::timestamptz,
      '2026-06-26 22:30:00-04'::timestamptz,
      5000.00
    ),
    (
      '00000000-0000-4000-8000-000000002011'::uuid,
      'one-piece-tcg',
      'one-piece-tcg',
      'one-piece-sunny-cup-2026-06-27',
      'One Piece TCG - Sunny Cup',
      'Evento principal del mes para One Piece TCG en Thousand Sunny.',
      'Constructed',
      'external',
      'https://events.vortexhub.local/thousand-sunny/one-piece-sunny-cup-2026-06-27',
      '2026-06-27 11:00:00-04'::timestamptz,
      '2026-06-27 17:00:00-04'::timestamptz,
      8000.00
    ),
    (
      '00000000-0000-4000-8000-000000002012'::uuid,
      'yugioh',
      'yugioh',
      'yugioh-win-a-box-2026-06-27',
      'Yu-Gi-Oh! - Win a Box',
      'Torneo especial de cierre de mes con premio principal para el primer lugar.',
      'Advanced',
      'external',
      'https://events.vortexhub.local/thousand-sunny/yugioh-win-a-box-2026-06-27',
      '2026-06-27 18:00:00-04'::timestamptz,
      '2026-06-27 23:00:00-04'::timestamptz,
      9000.00
    ),
    (
      '00000000-0000-4000-8000-000000002013'::uuid,
      'pokemon-tcg',
      'pokemon-tcg',
      'pokemon-tcg-family-sunday-2026-06-28',
      'Pokemon TCG - Family Sunday',
      'Jornada abierta para aprender, intercambiar cartas y jugar partidas guiadas.',
      'Casual',
      'disabled',
      null,
      '2026-06-28 12:00:00-04'::timestamptz,
      '2026-06-28 15:00:00-04'::timestamptz,
      null
    ),
    (
      '00000000-0000-4000-8000-000000002014'::uuid,
      'one-piece-tcg',
      'one-piece-tcg',
      'one-piece-casual-sunday-2026-06-28',
      'One Piece TCG - Casual Sunday',
      'Mesas casuales y practica libre para cerrar el fin de semana.',
      'Casual',
      'disabled',
      null,
      '2026-06-28 16:00:00-04'::timestamptz,
      '2026-06-28 20:00:00-04'::timestamptz,
      null
    ),
    (
      '00000000-0000-4000-8000-000000002015'::uuid,
      'yugioh',
      'yugioh',
      'yugioh-cierre-de-mes-2026-06-30',
      'Yu-Gi-Oh! - Cierre de Mes',
      'Ultimo locals del mes con ranking casual y premios por asistencia.',
      'Advanced',
      'external',
      'https://events.vortexhub.local/thousand-sunny/yugioh-cierre-de-mes-2026-06-30',
      '2026-06-30 19:00:00-04'::timestamptz,
      '2026-06-30 22:30:00-04'::timestamptz,
      5000.00
    )
)
insert into public.events (
  id,
  store_id,
  branch_id,
  game_id,
  created_by_account_id,
  slug,
  title,
  description,
  format_name,
  status,
  registration_mode,
  external_registration_url,
  starts_at,
  ends_at,
  entry_fee_amount,
  entry_fee_currency,
  location_mode,
  banner_mode,
  platform_banner_id,
  published_at
)
select
  event_seed.id,
  '00000000-0000-4000-8000-000000001000',
  '00000000-0000-4000-8000-000000001001',
  games.id,
  '00000000-0000-4000-8000-000000000010',
  event_seed.slug,
  event_seed.title,
  event_seed.description,
  event_seed.format_name,
  'published',
  event_seed.registration_mode,
  event_seed.external_registration_url,
  event_seed.starts_at,
  event_seed.ends_at,
  event_seed.entry_fee_amount,
  case when event_seed.entry_fee_amount is null then null else 'CLP' end,
  'branch',
  'platform',
  platform_event_banners.id,
  now()
from event_seed
join public.games on games.slug = event_seed.game_slug
join public.platform_event_banners
  on platform_event_banners.game_id = games.id
  and platform_event_banners.is_default
  and platform_event_banners.status = 'active'
on conflict (store_id, slug) where deleted_at is null do update
set game_id = excluded.game_id,
    branch_id = excluded.branch_id,
    title = excluded.title,
    description = excluded.description,
    format_name = excluded.format_name,
    status = 'published',
    registration_mode = excluded.registration_mode,
    external_registration_url = excluded.external_registration_url,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    entry_fee_amount = excluded.entry_fee_amount,
    entry_fee_currency = excluded.entry_fee_currency,
    location_mode = 'branch',
    location_text = null,
    location_city = null,
    location_region = null,
    location_country_code = null,
    banner_mode = 'platform',
    platform_banner_id = excluded.platform_banner_id,
    custom_banner_asset_id = null,
    published_at = coalesce(public.events.published_at, excluded.published_at),
    cancelled_at = null,
    cancelled_by_account_id = null,
    cancellation_message = null,
    archived_at = null,
    deleted_at = null,
    updated_at = now();
