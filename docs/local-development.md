# Guía De Desarrollo Local

Esta guía explica cómo ejecutar VortexHub con Supabase local sobre OrbStack.
Ejecuta todos los comandos desde la raíz del proyecto:

```bash
cd /Users/pgallardo/Documents/Projects/HubVortex
source ~/.zshrc
```

## 1. Preparar El Entorno

1. Abre OrbStack y espera a que Docker esté disponible.
2. Instala las dependencias del proyecto:

```bash
npm install
```

3. Comprueba Docker y Supabase CLI:

```bash
docker version
npx supabase --version
```

La configuración local de Next.js ya está en `.env.local`.

## 2. Iniciar Supabase

```bash
npm run supabase:start
```

La primera ejecución descarga las imágenes necesarias y puede tardar varios
minutos.

Servicios disponibles:

| Servicio | URL |
| --- | --- |
| Supabase API | `http://127.0.0.1:54321` |
| PostgreSQL | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Supabase Studio | `http://127.0.0.1:54323` |
| Mailpit | `http://127.0.0.1:54324` |

Comprueba el estado:

```bash
npm run supabase:status
```

## 3. Lanzar Las Migraciones

Para aplicar únicamente migraciones pendientes:

```bash
npx supabase migration up
```

Las migraciones se ejecutan en orden por nombre desde:

```text
supabase/migrations/
```

Después puedes comprobar el esquema:

```bash
npx supabase db lint --local --level warning
```

## 4. Reiniciar La Base, Las Migraciones Y El Seed Local

Para eliminar todos los datos locales, recrear la base, aplicar todas las
migraciones, ejecutar el seed SQL y reconstruir assets locales:

```bash
npm run supabase:reset
```

Este comando es destructivo para los datos locales. Ejecuta:

1. Recreación de PostgreSQL local.
2. Todas las migraciones de `supabase/migrations/`.
3. El contenido de `supabase/seed.sql`.
4. El seed local post-reset con `scripts/seed-local.mjs`.

Úsalo después de modificar migraciones existentes o cuando necesites volver a
un estado conocido.

El seed local post-reset restaura los objetos de Storage para banners de
plataforma desde `public/Banners/optimized/platform` y carga usuarios locales de
desarrollo. Necesita `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`; obtén la key
desde `npm run supabase:status` y guárdala solo en archivos locales.

Si necesitas recrear únicamente la base sin post-seed:

```bash
npm run supabase:reset:db
```

## 4.1. Reejecutar Seeds Locales

`npm run supabase:reset` carga `supabase/seed.sql`, que contiene el catálogo
base, documentos legales y buckets. Los objetos de Storage y los usuarios de
desarrollo viven en seeds locales separados para evitar cargarlos
accidentalmente en producción.

Para reejecutar todo el seed local sin resetear la base:

```bash
npm run supabase:seed:local
```

Para restaurar solo banners de plataforma:

```bash
npm run supabase:seed:platform-banners
```

Para recrear solo usuarios locales:

```bash
npm run supabase:seed:dev-users
```

Contraseña para todos:

```text
DevPassword123!
```

Usuarios disponibles:

```text
platform.admin@vortexhub.local
store.owner@vortexhub.local
store.admin@vortexhub.local
store.staff@vortexhub.local
```

## 5. Lanzar La Aplicación

Con Supabase iniciado, abre otra terminal y ejecuta:

```bash
cd /Users/pgallardo/Documents/Projects/HubVortex
source ~/.zshrc
npm run dev
```

La API Next.js estará disponible en:

```text
http://localhost:3000
```

No ejecutes `npm run build` mientras `npm run dev` está activo, porque ambos
escriben en `.next`.

## 6. Probar La Aplicación

Comprobar el catálogo público:

```bash
curl http://127.0.0.1:3000/api/v1/public/games
```

Comprobar el calendario público:

```bash
curl "http://127.0.0.1:3000/api/v1/public/calendar?limit=10"
```

Comprobar Supabase Auth:

```bash
curl http://127.0.0.1:54321/auth/v1/health
```

Ejecutar verificaciones de código y base:

```bash
npm run typecheck
npm run build
npx supabase db lint --local --level warning
```

Para inspeccionar tablas, usuarios, Auth y Storage visualmente, abre:

```text
http://127.0.0.1:54323
```

Los correos enviados por Supabase Auth aparecen en Mailpit:

```text
http://127.0.0.1:54324
```

Para invitar un owner de tienda en local:

```bash
npm run onboard:store-owner -- --env-file .env.local owner@example.com
```

Si el correo no existe en Auth, Supabase crea el usuario invitado. Si el correo
ya existe, el comando envía un magic link al onboarding de tienda para que esa
misma cuenta pueda crear o administrar una tienda sin perder su identidad de
jugador.

Los templates locales viven en:

```text
supabase/templates/invite.html
supabase/templates/magic_link.html
```

Después de cambiar templates de Auth, reinicia Supabase para que Auth recargue
`supabase/config.toml`.

## 7. Terminar La Aplicación

Detén Next.js en su terminal con:

```text
Ctrl+C
```

Detén Supabase y sus contenedores:

```bash
npm run supabase:stop
```

Después puedes cerrar OrbStack.

## Flujo Diario Recomendado

Inicio:

```bash
npm run supabase:start
npm run dev
```

Después de cambiar una migración:

```bash
npm run supabase:reset
npx supabase db lint --local --level warning
```

Antes de terminar:

```text
Ctrl+C
```

```bash
npm run supabase:stop
```

## Problemas Comunes

### Docker No Está Disponible

Abre OrbStack y comprueba:

```bash
docker version
```

### Un Puerto Ya Está En Uso

Comprueba procesos y contenedores:

```bash
npm run supabase:status
lsof -i :3000
```

### La API Indica Que Falta Una Tabla O RPC

Recrea la base local:

```bash
npm run supabase:reset
```

### Next.js Reporta Módulos Faltantes En `.next`

Detén `npm run dev`, ejecuta:

```bash
npm run build
npm run dev
```

Evita ejecutar build y dev simultáneamente.
