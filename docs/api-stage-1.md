# VortexHub Stage 1 Backend API

## Architecture

```text
src/
  app/api/v1/
    public/                         Public calendar and direct-link reads
    account/                        Legal acceptance and account lifecycle
    stores/                         Store-scoped creation commands
    branches/                       Branch lifecycle commands
    events/                         Event lifecycle commands
    series/                         Weekly-series lifecycle commands
    invitations/                    Invitation acceptance and revocation
  lib/
    auth/                           Supabase-session requirements
    database/                       Shared RPC adapter
    http/                           Validation/error/response wrappers
    supabase/                       Cookie-aware Supabase server client
    validation/                     Shared Zod primitives
  repositories/
    domain-command-repository.ts    Authorized transactional RPC access
    public-calendar-repository.ts   Public read boundary
  schemas/                          Zod request/query schemas
  services/                         Use-case orchestration
```

Request flow:

```text
Route Handler -> Zod schema -> Service -> Repository -> Supabase RLS/RPC
```

Writes use authenticated server clients with the caller's session. They never
use a service-role key. PostgreSQL RPCs remain responsible for authorization,
same-store references, atomic transitions, locking, audit, and invariants that
span rows.

## Response Contract

Success:

```json
{
  "data": {
    "id": "017de470-2ea0-4d84-adf1-b4ebdfdb9416",
    "status": "draft"
  }
}
```

Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "La solicitud contiene datos inválidos.",
    "details": {}
  }
}
```

Codes are `BAD_REQUEST`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`,
`CONFLICT`, `VALIDATION_ERROR`, and `INTERNAL_ERROR`.

## Endpoint Definitions

Public identifiers use slugs. UUIDs appear only in authenticated/internal
operator endpoints.

### Public

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/v1/public/games` | Active global game catalog |
| GET | `/api/v1/public/calendar` | Upcoming/current published events; filters: `game`, `store`, `city`, `from`, `to`, `limit`, `cursor` |
| GET | `/api/v1/public/stores/{storeSlug}` | Public store or direct historical store page |
| GET | `/api/v1/public/stores/{storeSlug}/branches/{branchSlug}` | Public branch/direct history |
| GET | `/api/v1/public/stores/{storeSlug}/events/{eventSlug}` | Published, past, cancelled, or archived direct event link |
| GET | `/api/v1/public/stores/{storeSlug}/series/{seriesSlug}` | Active public series |

The public calendar must omit suspended/closed stores and historical events.
Direct historical links remain resolvable through restricted public views/RPCs.

### Account and legal

| Method | Route | RPC |
| --- | --- | --- |
| POST | `/api/v1/account` | authenticated `create_user_account` bootstrap |
| GET | `/api/v1/legal-documents/current/minimum-age-declaration` | public current-version read |
| POST | `/api/v1/account/legal-acceptances` | `accept_legal_document` |
| POST | `/api/v1/account/activate` | `activate_user_account` |
| DELETE | `/api/v1/account` | `request_account_deletion` |
| POST | `/api/v1/account/restore` | `restore_account_before_anonymization` |

Supabase Auth owns sign-up, verified email, sessions, recovery, and logout.

### Stores, members, and invitations

| Method | Route | RPC |
| --- | --- | --- |
| POST | `/api/v1/stores` | `create_store` |
| POST | `/api/v1/stores/{storeId}/activate` | `activate_store` |
| GET | `/api/v1/stores/{storeId}/closure-preview` | authorized preview RPC |
| POST | `/api/v1/stores/{storeId}/close` | `close_store_immediately` |
| GET | `/api/v1/stores/{storeId}/memberships` | scoped operational read |
| PUT | `/api/v1/memberships/{membershipId}` | `change_store_membership` |
| POST | `/api/v1/memberships/{membershipId}/disable` | `disable_store_membership` |
| PUT | `/api/v1/memberships/{membershipId}/branches` | `set_branch_membership_assignments` |
| POST | `/api/v1/stores/{storeId}/invitations` | `invite_store_member` |
| POST | `/api/v1/invitations/{invitationId}/revoke` | `revoke_store_invitation` |
| POST | `/api/v1/invitations/accept` | `accept_store_invitation` |

### Branches

| Method | Route | RPC |
| --- | --- | --- |
| POST | `/api/v1/stores/{storeId}/branches` | `create_branch` |
| PUT | `/api/v1/branches/{branchId}` | draft-only branch edit RPC |
| POST | `/api/v1/branches/{branchId}/activate` | `activate_branch` |
| GET | `/api/v1/branches/{branchId}/closure-preview` | authorized preview RPC |
| POST | `/api/v1/branches/{branchId}/close` | `close_branch_immediately` |
| POST | `/api/v1/branches/{branchId}/reactivate` | `reactivate_branch` |

### Events and weekly series

| Method | Route | RPC |
| --- | --- | --- |
| POST | `/api/v1/stores/{storeId}/events` | `create_event` |
| PUT | `/api/v1/events/{eventId}` | `update_event` |
| POST | `/api/v1/events/{eventId}/publish` | `publish_event` |
| POST | `/api/v1/events/{eventId}/cancel` | `cancel_event` |
| POST | `/api/v1/stores/{storeId}/series` | `create_event_series` |
| PUT | `/api/v1/series/{seriesId}` | `update_event_series` |
| POST | `/api/v1/series/{seriesId}/activate` | `activate_event_series` |
| POST | `/api/v1/series/{seriesId}/end` | `end_event_series` |

`PUT` uses a complete replacement payload for mutable event/series fields.
Generated occurrences are edited independently and become series exceptions.

### Media, entitlements, and platform administration

| Method | Route | RPC/process |
| --- | --- | --- |
| POST | `/api/v1/stores/{storeId}/media-assets/uploads` | `begin_store_media_upload` |
| POST | `/api/v1/media-assets/{assetId}/finalize` | trusted `finalize_store_media_asset` |
| POST | `/api/v1/media-assets/{assetId}/remove` | `remove_store_media_asset` |
| POST | `/api/v1/platform/media-assets/{assetId}/moderate` | `moderate_store_media_asset` |
| PUT | `/api/v1/platform/games/{gameId}` | `manage_game` |
| PUT | `/api/v1/platform/banners/{bannerId}` | `manage_platform_banner` |
| POST | `/api/v1/platform/stores/{storeId}/entitlements` | `grant_store_entitlement` |
| POST | `/api/v1/platform/entitlements/{entitlementId}/revoke` | `revoke_store_entitlement` |
| POST | `/api/v1/platform/stores/{storeId}/suspend` | `suspend_store` |
| POST | `/api/v1/platform/stores/{storeId}/restore` | `restore_suspended_store` |

Platform-role assignment is an internal-only operation and is not exposed as a
normal product endpoint.

## Zod Schemas

Schemas live in `src/schemas`. Important cross-field rules already encoded:

- Registration is exactly `disabled` with no URL, or `external` with an
  absolute HTTPS URL and no embedded credentials.
- Locations are exactly `branch`, `custom`, or `online`, with coherent fields.
- Banners are exactly `platform` or `custom`.
- Fee amount and ISO currency are both null or both present.
- Event end is after start.
- Weekly series use unique ISO weekdays `1..7`.
- Owners always use store scope; branch scope requires branch IDs.
- Store/branch closure requires a short public cancellation message.

Database RPCs must repeat all security and integrity validation. Zod is for a
clear HTTP contract, not a trusted authorization boundary.

## Request Examples

Create a disabled-registration branch event:

```http
POST /api/v1/stores/017de470-2ea0-4d84-adf1-b4ebdfdb9416/events
Content-Type: application/json
Cookie: sb-access-token=...
```

```json
{
  "gameId": "f99520eb-82af-477b-b329-d50c79570c3f",
  "title": "Friday Night Magic",
  "registrationMode": "disabled",
  "locationMode": "branch",
  "branchId": "10f55212-f731-435f-a8ba-710ac41ea9cb",
  "bannerMode": "platform",
  "platformBannerId": "a40ba48c-4957-4518-86d5-75a01459fed2",
  "startsAt": "2026-06-19T22:00:00Z",
  "endsAt": "2026-06-20T02:00:00Z",
  "entryFeeAmount": 5000,
  "entryFeeCurrency": "CLP"
}
```

Create an external-registration online weekly series:

```json
{
  "gameId": "f99520eb-82af-477b-b329-d50c79570c3f",
  "title": "Liga semanal online",
  "registrationMode": "external",
  "externalRegistrationUrl": "https://example.com/register/weekly-league",
  "locationMode": "online",
  "locationText": "Discord de la tienda",
  "bannerMode": "platform",
  "platformBannerId": "a40ba48c-4957-4518-86d5-75a01459fed2",
  "weekdays": [2, 5],
  "localStartTime": "19:30",
  "durationMinutes": 180,
  "timezone": "America/Santiago",
  "startsOn": "2026-06-16"
}
```

Public calendar:

```http
GET /api/v1/public/calendar?game=magic-the-gathering&city=Santiago&from=2026-06-12&to=2026-06-30
```

```json
{
  "data": {
    "items": [
      {
        "storeSlug": "vortex-cards",
        "eventSlug": "friday-night-magic-2026-06-19",
        "title": "Friday Night Magic",
        "startsAt": "2026-06-19T22:00:00Z",
        "registrationMode": "disabled"
      }
    ],
    "nextCursor": null
  }
}
```

Validation failure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "La solicitud contiene datos inválidos.",
    "details": {
      "fieldErrors": {
        "externalRegistrationUrl": [
          "Debe ser una URL HTTPS absoluta y sin credenciales embebidas."
        ]
      }
    }
  }
}
```

## Security Notes

- Use only the anon key in the Next.js server client; never expose or use the
  service-role key for caller-driven routes.
- Call `auth.getUser()` server-side before every protected command.
- Resolve operator roles, status, scope, and branch assignments from database
  tables inside each RPC. Never authorize from JWT metadata.
- Enable deny-by-default RLS on every exposed table. Prefer public views or
  public RPCs for calendar/direct-history reads.
- Restrict every `security definer` RPC, set a safe `search_path`, schema-qualify
  relations, validate `auth.uid()`, and grant execute only to intended roles.
- Hash invitation tokens; never store or log plaintext tokens. Acceptance must
  match the authenticated user's verified Supabase Auth email.
- Enforce current adult-age declaration acceptance for all store actions.
- Enforce last-active-owner, branch scope, same-store references, active game,
  active entitlement, slug freezing, and lifecycle transitions transactionally.
- Store custom-banner source objects privately. Validate actual MIME, bytes,
  dimensions, ownership, and optimized WebP output in a trusted process.
- Do not automatically redirect to external registration URLs. Return/display
  an explicit leave-VortexHub action.
- Audit only the allowlisted critical Stage 1 actions and never include tokens,
  verified emails, Storage secrets, or unnecessary personal data.
- Jobs for occurrence generation, completion, archival, invitation expiry,
  premium removal, anonymization, and audit retention must be idempotent.
- Add rate limits at the edge for authentication, invitations, upload
  initialization, and platform administration.

## Supabase RPC Contract

This scaffold passes complex create/update payloads as `jsonb` named `input`
and identifiers as explicit named arguments. PostgreSQL functions should return
the resulting resource or a minimal transition result.

Recommended database error mapping:

- `42501` -> `FORBIDDEN`
- `23505`/`23P01` -> `CONFLICT`
- other `22...`/`23...` constraint failures -> `VALIDATION_ERROR`
- not-found functions should raise a stable domain error that the repository
  maps to `NOT_FOUND`

The physical schema, constraints, RLS, RPC implementations, Storage policies,
and scheduled jobs remain governed by `.agents/stage-1-data-model.md`.
