# Stage 2 Parallel Environment

Stage 2 should run outside the Stage 1 production database until player identity
and QR flows are accepted.

## Recommended Shape

- Code branch: `feat/stage-2-player-profile` or another Stage 2 branch.
- Supabase database: a dedicated Supabase preview branch or a separate Stage 2
  project.
- Vercel: a preview deployment wired to the Stage 2 Supabase target.
- Email provider: keep demo email limits protected; player profile and QR do
  not send email in this first slice.

Do not point the Stage 2 app at the Stage 1 production database while testing
player profile creation or QR rotation.

## Required Environment Variables

Use a separate env file such as `.env.stage2.local` for the Stage 2 target:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://stage-2-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=stage-2-publishable-key
SUPABASE_SERVICE_ROLE_KEY=stage-2-service-role-key
VORTEXHUB_APP_URL=https://stage-2-preview.example.com
VORTEXHUB_QR_PEPPER=replace-with-at-least-32-random-server-only-characters
INVITE_EMAIL_PROVIDER=resend
```

Generate `VORTEXHUB_QR_PEPPER` with a secret manager or a local command such as:

```bash
openssl rand -base64 48
```

This value is server-only. Do not expose it as `NEXT_PUBLIC_*`, commit it, log it,
or reuse it across unrelated environments. Rotating it invalidates display of
existing QR payloads derived from older nonces, so treat rotation as a planned
credential rollover.

## Migration Order

Apply Stage 1 migrations first, then Stage 2 migrations:

```bash
npx supabase migration up
```

For local reset testing:

```bash
npm run supabase:reset
```

After migrations, run:

```bash
npm run typecheck
npm run build
npx supabase db lint --local --level warning
```

## Current Stage 2 Slice

Implemented in the first slice:

- `player_profiles`
- `player_nickname_changes`
- `player_qr_credentials`
- Lazy profile creation through `/player/me`
- Personal QR display and five-minute rotation guard through `/player/qr`
- QR credential revocation when an account becomes inactive or deleted

Still pending for later Stage 2 phases:

- Avatar upload and moderation workflow
- Internal event registration
- Store action QR for points
- Store-scoped point ledger
- Location normalization and optional browser location
