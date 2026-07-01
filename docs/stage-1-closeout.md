# VortexHub Stage 1 Closeout

Fecha de cierre: 2026-07-01

Este documento compacta el estado actual de VortexHub al cerrar Stage 1 y deja
un puente operativo hacia Stage 2. Resume lo implementado, lo documentado, los
gaps detectados y una propuesta de trabajo seguro para el resto de 2026.

## Resumen Ejecutivo

Stage 1 quedo implementada como una plataforma Next.js + Supabase para que
tiendas TCG publiquen calendarios publicos, administren tiendas/sucursales,
usen identidad visual, inviten operadores y publiquen eventos one-shot o series
semanales con registro externo o deshabilitado.

El alcance fisico de Stage 1 se respeta: no hay tablas ni flujos reales de
player profiles, QR de jugador, registro interno, capacidad, asistencia, puntos,
recompensas, pagos, notificaciones in-app o planes de cierre programado.

Hay un extra deliberado pre-Stage 2: `player_launch_interests`, una lista minima
de interes por correo para avisar cuando llegue la experiencia de jugadores. No
es identidad de jugador ni habilita permisos, QR, registros o puntos.

Verificacion final de codigo:

- `npm run build`: OK.
- `npm run typecheck`: OK despues de regenerar `.next-build/types` con build.
- Worktree estaba limpio antes de crear este informe.

No se corrio lint/advisors de Supabase en esta pasada porque no habia un
Supabase local levantado. En hilos previos se observaron warnings existentes
por extensiones en `public` y funciones `SECURITY DEFINER`; los cambios nuevos
criticos de permisos se fueron hardeneando cuando aparecieron.

## Fuentes Revisadas

- `AGENTS.md`
- `.agents/product-context.md`
- `.agents/calendar-experience.md`
- `.agents/data-model.md`
- `.agents/architecture-decisions.md`
- `.agents/stage-1-data-model.md`
- `.agents/stage-2-pilot-spec.md`
- `README.md`
- `docs/api-stage-1.md`
- `docs/local-development.md`
- `supabase/migrations/`
- `supabase/seed.sql`
- `src/app`, `src/components`, `src/lib`, `src/repositories`, `src/services`,
  `src/schemas`
- Resumenes de threads previos de HubVortex en Codex.

## Compactacion De Conversaciones

La conversacion de VortexHub evoluciono en estos bloques:

1. Modelo base y ADRs: se separo `user_accounts` de `player_profiles`, se fijo
   UUID/PostgreSQL, QR como identificador no autorizacion, slugs publicos, una
   tienda representativa por evento, un juego por evento, RLS deny-by-default y
   puntos futuros como ledger inmutable.

2. Corte Stage 1: se creo `.agents/stage-1-data-model.md` como contrato fisico
   cerrado con 18 tablas, sin jugadores ni registro interno. Stage 1 quedo
   centrada en publicacion, tiendas, membresias, sucursales, banners, auditoria
   y jobs.

3. API Stage 1: se definio el patron Route Handler -> Zod -> Service ->
   Repository -> Supabase RPC/RLS, con errores JSON consistentes.

4. Frontend Lovable/Next: se incorporo una UI publica/admin, directorio de
   tiendas, home, calendario publico, pagina de tienda, detalle de evento y
   panel admin.

5. Experiencia de calendario: se documento que home no debe ser el catalogo
   completo, que el calendario publico debe ser compacto y que el calendario
   admin debe distinguir eventos concretos de series.

6. Supabase real: se agregaron migraciones, seeds de juegos/banners, Supabase
   Auth, legal acceptance, RLS, RPCs, Storage y jobs cron.

7. Onboarding de tiendas: se creo flujo de invitacion de owner, email template,
   callback/onboarding, declaracion de mayoria de edad y activacion de cuenta.

8. Sucursales y mapas: se agregaron coordenadas, widget informativo de ubicacion
   en eventos presenciales, cierre/reactivacion de sucursales y hardening de
   permisos para RPCs nuevas.

9. Performance/RLS: se agregaron indices y optimizaciones de policies con
   initplans. Tambien se documento la necesidad de revisar advisors antes de
   produccion.

10. Visibilidad y series: se agrego `is_publicly_visible`, calendario/tienda
    ocultable, soporte de series, lista de eventos y filtro de completados.

11. Pre-Stage 2 jugadores: se agrego una pagina/formulario de interes para
    jugadores con `player_launch_interests`, sin crear identidad de jugador.

12. Banners: se agregaron banners de plataforma, backoffice local para banners,
    banners custom por tienda, preview/focus position, nombre derivado de
    archivo y renombrado posterior.

13. Equipo de tienda: se implemento owner/admin/staff, invitaciones por email,
    scopes de tienda/sucursales, administracion de miembros y proteccion de
    ultimo owner.

14. Feedback UX: se agregaron mecanismos de feedback/estados para acciones
    importantes, especialmente en administracion.

15. Ambientes y despliegue: se decidio que el piloto puede vivir en Vercel Hobby
    + Supabase Free con disciplina dev/prod; para lanzamiento comercial conviene
    Vercel Pro y luego evaluar Supabase Pro.

16. Links compartibles: se agrego `/c/{storeSlug}` como entrada corta local para
    calendario de tienda y se documento `short_links` como capacidad futura, sin
    meterlo en Stage 1 fisico.

17. Limpieza UX de slug: el slug de tienda se quito del formulario publico de
    creacion para evitar friccion; se genera automaticamente.

18. Stage 2 pilot: se documento en `.agents/stage-2-pilot-spec.md` que el flujo
    principal de puntos sera QR de accion/transaccion creado por tienda y
    confirmado por jugador, no busqueda global de jugadores.

## Implementado En Stage 1

### Stack

- Next.js App Router, TypeScript, React 19.
- Supabase Auth, Postgres, RLS, RPCs, Storage y `pg_cron`.
- Zod para validacion HTTP.
- Repositorios y servicios server-side para comandos y lectura publica.
- `sharp` para tooling/backoffice de imagenes.

### Base De Datos

Las 18 tablas Stage 1 existen en migraciones:

1. `user_accounts`
2. `legal_document_versions`
3. `legal_acceptances`
4. `platform_roles`
5. `stores`
6. `store_memberships`
7. `store_membership_invitations`
8. `store_membership_invitation_branches`
9. `store_entitlements`
10. `branches`
11. `branch_membership_assignments`
12. `games`
13. `platform_event_banners`
14. `store_media_assets`
15. `event_series`
16. `events`
17. `event_cancellation_batches`
18. `audit_events`

Tabla adicional fuera del nucleo Stage 1:

- `player_launch_interests`: lista de interes por correo para lanzamiento de
  jugadores. No representa perfiles, QR, registros ni permisos.

El schema implementa UUIDs, timestamps, soft delete donde aplica, slugs,
constraints, indices parciales, FK compuestas para pertenencia a tienda, RLS en
tablas expuestas, triggers `updated_at` y auditoria append-only.

### Auth Y Legal

- Supabase Auth maneja credenciales, sesiones e email.
- `user_accounts.id` referencia `auth.users.id`.
- Existe aceptacion versionada de `minimum_age_declaration`.
- Version vigente en seed: `2026-06-26-clean`.
- Activacion de cuenta requiere aceptacion legal actual.
- Account deletion desactiva cuenta/membresias y programa anonimizacion a 30
  dias, bloqueando si el usuario es ultimo owner activo.

### Tiendas

- Crear tienda desde cuenta activa.
- Slug generado automaticamente.
- Activacion self-service por owner.
- Ocultar/mostrar tienda publica con `is_publicly_visible`.
- Cierre inmediato owner-only con batch de cancelacion de eventos futuros.
- Estados `pending`, `active`, `suspended`, `closed`.
- Pilot entitlement automatico para `custom_event_banners`.

### Membresias E Invitaciones

- Roles fijos: `owner`, `admin`, `staff`.
- Scope: `store` o `branches`.
- Owners siempre store-wide.
- Invitaciones por email con token opaco hasheado, expiracion 7 dias, aceptacion
  por email verificado de Supabase.
- Snapshot de sucursales para invitaciones branch-scoped.
- Administracion de miembros desde UI.
- Proteccion de ultimo owner activo.

### Sucursales

- Crear, activar, cerrar y reactivar.
- Estados `draft`, `active`, `inactive`.
- Slugs generados automaticamente.
- Ubicacion fisica con direccion, ciudad, region, pais, latitud/longitud y
  timezone.
- Identidad fisica inmutable despues de activacion.
- Tiendas pueden operar con cero sucursales usando eventos custom/online.
- Widget publico de ubicacion en eventos presenciales con coordenadas utiles.

### Juegos Y Calendario

- Catalogo global seed con `Miscelaneo`, `Otros` y juegos TCG principales.
- Un evento/serie pertenece a exactamente un juego.
- `Otros` requiere nombre especifico.
- Calendario publico filtra por game, date, city/store y `Online`.
- Public home, directorio `/stores`, pagina de tienda y detalle de evento.
- Direct links historicos basicos para eventos publicados/pasados.
- `/c/{storeSlug}` redirige a `/stores/{storeSlug}` como entrada compartible
  corta local.

### Eventos Y Series

- Eventos one-time con lifecycle `draft`, `published`, `cancelled`,
  `completed`.
- Registro Stage 1 solo `disabled` o `external`.
- URLs externas requieren HTTPS y no hay almacenamiento de participantes o
  conteos externos.
- Ubicacion `branch`, `custom`, `online`.
- Fee informativo.
- Cancelacion de eventos publicados requiere mensaje publico.
- Series semanales con multiples weekdays, timezone IANA, generacion de
  ocurrencias concretas, activacion inmediata de la semana actual e idempotencia
  por `(event_series_id, series_local_date)`.
- Edicion de ocurrencia marca excepcion de serie.
- Ending de series detiene generacion futura sin borrar ocurrencias existentes.

### Identidad Visual Y Banners

- Banners de plataforma con defaults por juego y fallback global.
- Backoffice local para administrar banners de plataforma contra Supabase.
- Store media con `store_logo` y `event_banner`.
- Buckets `store-media-sources` privados y `store-media-optimized` publicos.
- Validacion de tipo, peso y dimensiones.
- Logo de tienda optimizado y publico.
- Custom event banners disponibles para piloto mediante entitlement.
- Focus/banner position y preview en forms.
- Nombre de banner derivado del archivo y renombrable despues.
- UI limita banners custom activos a 5; la DB mantiene limite de 20. Esto debe
  normalizarse como decision antes de produccion.

### Admin UI

- `/admin` dashboard.
- Gestion de tiendas.
- Gestion de sucursales.
- Gestion de eventos.
- Gestion de series.
- Vista calendario semanal admin.
- Gestion de banners.
- Gestion de equipo/invitaciones.
- Login/logout/onboarding.
- Feedback de acciones importantes.

### API Real Disponible

Rutas implementadas bajo `src/app/api/v1`:

- Account/legal: `/account`, `/account/activate`,
  `/account/legal-acceptances`, `/account/restore`.
- Public: `/public/games`, `/public/calendar`,
  `/public/stores/{storeSlug}/events/{eventSlug}`.
- Stores: `/stores`, `/stores/{storeId}/activate`,
  `/stores/{storeId}/branches`, `/stores/{storeId}/close`,
  `/stores/{storeId}/events`, `/stores/{storeId}/invitations`,
  `/stores/{storeId}/media`, `/stores/{storeId}/series`,
  `/stores/{storeId}/visibility`.
- Branches: `/branches/{branchId}`, `/activate`, `/close`, `/reactivate`.
- Events: `/events/{eventId}`, `/publish`, `/cancel`.
- Series: `/series/{seriesId}`, `/activate`, `/end`.
- Memberships: `/memberships/{membershipId}`, `/disable`, `/branches`.
- Invitations: `/invitations/accept`, `/invitations/{invitationId}/revoke`.
- Media: `/media/{assetId}` for remove/rename.
- Pre-Stage 2: `/player-launch-interest`.

### Jobs

- Weekly occurrence generation.
- Event completion: actualmente horario (`0 * * * *`).
- Event archival despues de 12 meses.
- Invitation expiry/cleanup.
- Premium asset maintenance/removal.
- Account anonymization.
- Audit retention.

### Seeds Y Operacion Local

- `supabase/seed.sql` carga declaracion legal, juegos, platform banners y
  buckets base.
- `supabase/seeds/02_dev_users.sql` crea usuarios solo locales.
- `supabase/seeds/03_demo_thousand_sunny.sql` carga tienda demo local.
- README documenta local Supabase + OrbStack, Mailpit y flujo de deploy.

## Excluido Correctamente De Stage 1

- `player_profiles`
- `player_qr_credentials`
- `event_registrations`
- `event_registration_transitions`
- `event_attendances`
- `point_ledger_entries`
- `reward_redemptions`
- `user_notifications`
- `store_closure_plans`
- `branch_closure_plans`
- Internal capacity, occupancy bars, waitlists, payments, attendance, rewards,
  player public lookup o store-created guest players.

## Gaps Y Limpieza Recomendada

1. Actualizar `docs/api-stage-1.md`: lista endpoints ideales que no existen tal
   cual, como public store/branch/series API y closure-preview. Debe reflejar el
   API real o marcar secciones como propuestas.

2. Implementar o cerrar la decision de `get_store_calendar_workspace`: el
   contrato Stage 1 recomienda un RPC/read model acotado; hoy la UI admin lee
   directamente tablas RLS desde `admin-data.ts`.

3. Normalizar limite de banners custom: UI/API usa 5 activos, DB permite 20 y
   el contrato Stage 1 habla de 20. Elegir uno y documentarlo.

4. Revisar buckets legacy en seed: `custom-banner-sources` y
   `custom-banner-optimized` aparecen en `seed.sql`, mientras la implementacion
   actual usa `store-media-sources` y `store-media-optimized`.

5. Agregar suite minima de tests: hoy no hay tests automatizados de RLS/RPC en
   repo. Stage 2 necesita pruebas de autorizacion antes de tocar jugadores,
   puntos o QR.

6. Revisar Supabase advisors antes de produccion comercial: warnings previos
   de extensiones en `public` y funciones `SECURITY DEFINER` deben quedar
   clasificados como aceptados, mitigados o corregidos.

7. Definir release discipline: produccion se despliega por push a `main`; Stage
   2 debe moverse a PRs/branches y dev project para evitar tocar prod.

8. Legal/privacidad antes de produccion comercial: revisar texto legal, retencion
   de auditoria, consentimientos, datos de jugadores y cualquier flujo con
   menores.

## Plan Para Crear Proyecto Dev Seguro

Objetivo: desarrollar Stage 2 sin conectar previews ni ramas a datos reales de
produccion.

### 1. Separar Ambientes

- Mantener `prod`: dominio real, Supabase prod, Vercel production desde `main`.
- Crear `dev`: segundo proyecto Supabase y proyecto/env separado en Vercel.
- Configurar variables separadas:
  - `.env.local` para Supabase local.
  - `.env.development` o `.env.dev` para Supabase dev remoto.
  - `.env.production` para Supabase prod.
- Nunca usar `SUPABASE_SERVICE_ROLE_KEY` en Vercel preview/browser.

### 2. Git Y Deploy

- `main`: solo releases listos para produccion.
- `feat/*`: desarrollo Stage 2.
- `fix/*`: fixes chicos.
- PR obligatorio hacia `main`, aunque trabajes solo.
- Vercel previews de PR conectados solo a Supabase dev, nunca prod.
- Migrations: aplicar primero local/dev, luego prod solo al merge/release.

### 3. Supabase Dev

- Crear proyecto Supabase dev con schema limpio.
- Aplicar migraciones Stage 1 completas.
- Cargar seed no productivo.
- Crear usuarios dev/test separados.
- Verificar Auth redirect URLs para preview/dev.
- Mantener buckets dev separados.

### 4. Pipeline Minimo

Antes de merge:

- `npm run typecheck`
- `npm run build`
- `supabase db lint --local --level warning` cuando local este arriba.
- `supabase db advisors` o equivalente antes de migraciones sensibles.
- Pruebas SQL/RLS para casos visitor/player/owner/admin/staff/unrelated.

### 5. Guardia De Datos

- Script o checklist que imprima el proyecto Supabase objetivo antes de
  `db push`.
- Prohibir manualmente `supabase db push --linked` si el branch no es `main`
  para prod.
- Usar nombres visuales claros en Vercel/Supabase: `vortexhub-prod`,
  `vortexhub-dev`.
- No cargar `02_dev_users.sql` en produccion.

### 6. Skill/Proceso Para Codex

Crear una skill minimalista de despliegue/PR con estas reglas:

- Siempre identificar ambiente antes de migrar.
- Nunca aplicar migraciones remotas sin dry-run.
- Stage 2 siempre en branch `feat/stage-2-*`.
- Validar `typecheck`, `build` y SQL/RLS antes de PR.
- No tocar prod desde una rama de feature.
- Al cerrar una tarea, dejar resumen de migraciones, endpoints, RLS y pruebas.

## Roadmap Julio-Diciembre 2026

### Julio 2026: Cierre Y Dev Foundation

- Limpiar docs Stage 1 y API.
- Crear Supabase dev y Vercel dev/preview.
- Definir PR workflow.
- Agregar tests base de RPC/RLS.
- Resolver limite banners 5 vs 20.
- Clasificar warnings de Supabase advisors.

### Agosto 2026: Stage 2 Fase 1

- Implementar player profile adulto y onboarding progresivo.
- Implementar nickname + immutable player tag.
- Resolver decision tecnica de QR persistente sin plaintext.
- Implementar QR personal display/rotation.
- Reemplazar paginas placeholder `/player/me` y `/player/qr`.

### Septiembre 2026: Stage 2 Fase 2-3

- Implementar action QR para point intents.
- Implementar `point_ledger_entries`.
- Confirmacion de jugador para grant/redemption.
- Ajustes admin owner/admin.
- Auditoria completa de QR/action/points.
- Piloto controlado con 1-2 tiendas.

### Octubre 2026: Location Y Piloto Ampliado

- Normalizar locations (`discovery_locations` o read model equivalente).
- Refactor de calendario publico para location slug/facets.
- Agregar opt-in `Usar mi ubicacion` sin persistir coordenadas.
- Medir query plans de calendario y puntos.
- Ajustar UX de punto/QR con feedback de tiendas piloto.

### Noviembre 2026: Preparacion Produccion Comercial

- Legal review de jugadores, retencion, auditoria y privacidad.
- Revisar dominio, emails, branding y templates.
- Migrar Vercel a Pro si empieza oferta comercial.
- Evaluar Supabase Pro por backups/no-pausing/cuotas.
- Definir pricing inicial y entitlement model:
  - calendario base,
  - banners/custom branding,
  - modulo puntos,
  - futuros modulos premium.
- Documentar soporte, incident response y runbooks.

### Diciembre 2026: Produccion, Pricing Y Nuevos Modulos

- Lanzamiento comercial controlado.
- Activar pricing y entitlements operativos.
- Hardening final de RLS/RPC/security definer.
- Backups y monitoreo.
- Roadmap 2027:
  - registros internos y capacidad,
  - asistencia/check-in,
  - rewards/redemptions,
  - short links oficiales,
  - analytics,
  - eventual soporte menores solo con revision legal completa.

## Criterio De Entrada A Stage 2

Stage 2 deberia empezar solo cuando:

- Stage 1 build/typecheck esta limpio.
- Proyecto dev remoto existe y previews no apuntan a prod.
- Hay tests basicos de autorizacion o al menos harness SQL reproducible.
- `docs/api-stage-1.md` no contradice el API real.
- Se decide el limite de banners.
- Se acepta explicitamente el diseño de QR persistente sin guardar secretos en
  plaintext.

## Preguntas Abiertas

1. Para Stage 2, preferimos guardar QR secreto cifrado o derivarlo con secreto
   server-side desde material no sensible?
2. El limite comercial/piloto de banners custom sera 5 o 20?
3. El modulo de puntos sera parte del plan base de tiendas piloto o un modulo
   premium desde lanzamiento?
4. El lanzamiento comercial usara solo Chile inicialmente o necesitara
   discovery multi-pais desde el primer mes?
5. Que nivel de soporte/SLA queremos prometer antes de migrar a planes pagados?
