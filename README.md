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
SUPABASE_SERVICE_ROLE_KEY=<local service role key from supabase status>
VORTEXHUB_APP_URL=http://127.0.0.1:3000
INVITE_EMAIL_PROVIDER=supabase
```

Useful commands:

```bash
npm run supabase:status
npm run supabase:reset
npm run supabase:stop
```

Invite a new store owner during the pilot:

```bash
npm run onboard:store-owner -- --env-file .env.local owner@example.com
```

Locally, the invite uses the Supabase Auth invite template in
`supabase/templates/invite.html`, creates a session through `/auth/callback`,
and sends the owner to `/auth/onboarding` to set a password, accept the current
adult-age declaration, and activate the VortexHub account. Set
`INVITE_EMAIL_PROVIDER=supabase` when testing with Mailpit.

Local Supabase reads the template from `/private/tmp/vortexhub-email-templates`
because Docker/OrbStack can be blocked from reading templates mounted from
macOS `Documents`. `npm run supabase:start` prepares that file before starting
Supabase. After changing local Auth email templates, restart Supabase so Auth
reloads `supabase/config.toml`.

For production invitations, use Resend directly from the onboarding script. This
keeps the email HTML in the repository and avoids depending on the hosted
Supabase email-template editor:

```bash
npm run onboard:store-owner -- --env-file .env.production owner@example.com
```

The script asks Supabase Auth to generate a secure invite link, then sends the
branded email through Resend. The owner still creates their password and session
through Supabase Auth.

The `--env-file` option is explicit on purpose. Keep local and production
values in separate files, for example:

```bash
.env.local       # local Supabase + Mailpit
.env.production  # hosted Supabase + Resend
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
VORTEXHUB_APP_URL=https://<deployed-app-domain>
INVITE_EMAIL_PROVIDER=resend
RESEND_API_KEY=<Resend API key>
RESEND_FROM_EMAIL="VortexHub <no-reply@your-domain.com>"
RESEND_REPLY_TO_EMAIL=<optional support inbox>
```

Apply `supabase/migrations/` to the target Supabase project before pointing
Vercel at it. Local demo users in `supabase/seeds/02_dev_users.sql` are for
development only and must not be loaded in production.

Do not expose `SUPABASE_SERVICE_ROLE_KEY` to browser code. Keep it only in the
terminal, CI job, or a future server-only admin endpoint that sends owner
invitations.

Before sending production emails through Resend:

1. Add and verify a sending domain in Resend.
2. Publish the DNS records that Resend gives you, including DKIM/SPF.
3. Create a Resend API key with send-email access.
4. Use a sender from that verified domain, for example
   `VortexHub <no-reply@auth.your-domain.com>`.
5. Add the deployed Vercel URL to Supabase Auth redirect URLs so invite links
   can return to `/auth/onboarding`.

See [docs/api-stage-1.md](docs/api-stage-1.md) for the API contract and
security model.

See [docs/local-development.md](docs/local-development.md) for the complete
local workflow: migrations, reset, launch, testing, and shutdown.
