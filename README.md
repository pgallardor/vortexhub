# VortexHub - MVP Stage 1

Public discovery and administration demo for VortexHub Stage 1 using Next.js
App Router, TypeScript, Supabase Auth/Database/Storage, Zod, services,
repositories, and transactional PostgreSQL RPCs.

Stage 1 currently covers store administration, branch administration, event
creation/editing, public calendars, game filtering, platform banners, custom
pilot event banners, and store logos.

Player profiles, QR credentials, internal registration, capacity, attendance,
points, rewards, payments, notifications, and scheduled closure plans remain
out of scope until explicitly added.

## Run locally with Supabase and OrbStack

```bash
npm install
npm run supabase:start
npm run dev
```

Local services:

- API: `http://127.0.0.1:54321`
- PostgreSQL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Studio: `http://127.0.0.1:54323`
- Mailpit: `http://127.0.0.1:54324`

Environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable key from supabase status>
```

Useful commands:

```bash
npm run supabase:status
npm run supabase:reset
npm run supabase:stop
```

`npm run supabase:reset` recreates the local database, applies every file in
`supabase/migrations/` in timestamp order, and loads `supabase/seed.sql`.

The Stage 1 migration includes the 18 physical domain tables, constraints,
indexes, RLS, transactional RPCs, Storage buckets, seed catalog, and scheduled
maintenance jobs.

## Deploy

Vercel needs:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable or anon key>
```

Apply `supabase/migrations/` to the target Supabase project before pointing
Vercel at it. Local demo users in `supabase/seeds/02_dev_users.sql` are for
development only and must not be loaded in production.

See [docs/api-stage-1.md](docs/api-stage-1.md) for the API contract and
security model.

See [docs/local-development.md](docs/local-development.md) for the complete
local workflow: migrations, reset, launch, testing, and shutdown.
