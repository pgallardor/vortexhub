# VortexHub Stage 2 Pilot Spec

## Purpose

Stage 2 activates the first player-facing pilot capabilities after the Stage 1
publishing foundation:

1. Player identity and personal QR.
2. Store-scoped action QR for point grants and redemptions.
3. Store-scoped prize point ledger.
4. Location detection and location filtering improvements for expansion beyond
   one city.

This document is a planning and delivery spec. It does not replace the accepted
Stage 1 physical schema in `.agents/stage-1-data-model.md`. Stage 2 migrations
must preserve Stage 1 behavior and follow the accepted architecture decisions in
`.agents/architecture-decisions.md`.

## Product Boundary

Stage 2 may implement:

- Authenticated player profile onboarding for adult users.
- Personal player QR display and rotation.
- Contextual QR resolution for authorized store actions.
- Short-lived store action QR for point grants and redemptions.
- Store-scoped point movements using an immutable ledger.
- Calendar location normalization and opt-in browser location detection.
- Indexes, read models, or generated columns needed for location filtering at
  multi-city scale.

Stage 2 must not implement unless separately accepted:

- Public player lookup or public player profiles.
- Store-created guest players.
- Dependent minor profiles or guardianships.
- Attendance inferred from QR scans, registrations, or event completion.
- Payments, rewards catalog, reward redemption, or refunds.
- Cross-store point balances, transfers, or rankings.
- Offline QR resolution or cached player identity.
- Map UI, radius search, or distance ordering before a geospatial design is
  accepted.

## Guiding Rules

- Personal QR identifies a player only inside an authenticated and authorized
  action.
- A QR scan never grants authorization by itself.
- Personal player QR and store action QR are separate concepts.
- Point grant and redemption flows use store-created action QR by default.
- Stores never create unclaimed or unauthenticated player profiles.
- Stores must not search the global player directory to grant or redeem points.
- Points belong to exactly one store. There is no global point balance.
- Point balances are derived or cached projections of immutable ledger entries.
- Corrections use compensating ledger entries, never edits to historical
  movements.
- Location detection must be opt-in and must not persist the user's precise
  browser location by default.
- Public URLs continue to use slugs. Internal UUIDs are not public locators.
- Enable RLS on every new exposed table and index every authorization path.

## Delivery Order

### Phase 1: Player Identity And QR

Create the player identity foundation before points or QR-assisted store flows.

Required tables:

```sql
player_profiles
player_nickname_changes
player_qr_credentials
```

Required behavior:

- Create a player profile lazily when an active authenticated user first opens
  `/player/me`, opens `/player/qr`, or starts a player action.
- Collect only nickname and optional avatar during Stage 2 onboarding.
- Generate immutable `player_tag` using
  `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
- Enforce at most one active adult player profile per authenticated account.
- Store only a deterministic hash of the QR secret.
- Allow only one active QR credential per player.
- Allow player QR rotation at most once every five minutes.
- Revoke active QR credentials on account suspension, deletion, or
  anonymization.

Required RPCs:

```text
ensure_player_profile(input jsonb)
get_my_player_profile()
get_my_player_qr()
rotate_my_player_qr()
resolve_player_qr_for_context(input jsonb)
```

Important open design decision before implementation:

- Decide how a player can display the same QR after a refresh or on a second
  device while still never storing the plaintext QR secret.
- Acceptable options include deriving the QR secret from persisted non-secret
  material plus a server secret, or storing an encrypted secret with strict key
  handling. Do not silently fall back to plaintext storage.

### Phase 2: Store Action QR

Implement short-lived action QR for store workflows. For the Stage 2 pilot,
points should use action QR rather than personal player QR as the primary flow.

Action QR represents one pending store operation, not a player identity. The
store creates the operation, displays the QR, and the authenticated player scans
it to confirm that the point movement should be applied to their own player
profile.

Initial action QR contexts:

- `point_grant`: store grants points to the scanning player.
- `point_redemption`: store redeems or subtracts points from the scanning
  player.
- `point_correction_acknowledgement`: optional acknowledgement for correction
  workflows if the pilot requires player visibility.

Required table:

```sql
point_transaction_intents
```

Recommended columns:

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid PK | Internal identifier |
| `store_id` | uuid FK | Required point scope |
| `branch_id` | uuid nullable | Authorization scope when relevant |
| `event_id` | uuid nullable | Optional event attribution |
| `created_by_account_id` | uuid FK | Store operator who created the intent |
| `created_by_membership_id` | uuid FK | Store authorization used |
| `type` | varchar(30) | `point_grant`, `point_redemption` |
| `delta` | integer | Positive for grant, negative for redemption |
| `reason` | varchar(40) | Structured point reason |
| `status` | varchar(30) | `pending_player_confirmation`, `completed`, `cancelled`, `expired` |
| `qr_token_hash` | text | Hash of short-lived opaque action token |
| `player_profile_id` | uuid nullable | Set only when completed |
| `idempotency_key` | text nullable | Prevent duplicate creation |
| `metadata` | jsonb | Allowlisted, non-sensitive details |
| `expires_at` | timestamptz | Short expiry, recommended 2-5 minutes |
| `completed_at` | timestamptz nullable | |
| `cancelled_at` | timestamptz nullable | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Required behavior:

- The store operator creates an intent after selecting type, amount, reason,
  optional event, and optional internal note.
- VortexHub returns a short-lived action QR payload for that intent.
- The player scans the action QR while authenticated.
- If the player has no profile, progressive onboarding runs first and then
  resumes confirmation.
- The player sees a confirmation screen with store, operation type, points,
  reason, and event when present.
- Player acceptance executes one transactional RPC that locks the intent,
  validates status, expiry, store state, operator authorization, player status,
  balance rules, and idempotency, then inserts `point_ledger_entries` and marks
  the intent completed.
- Cancelling or expiry never writes a point ledger entry.
- The action QR token is not a UUID and is never stored in plaintext, logged, or
  written to audit metadata.
- Action QR scans do not disclose the player's identity to the store until the
  player confirms.
- The default point flow does not require the store to search for a player by
  email, nickname, tag, or internal UUID.

Recommended RPCs:

```text
create_point_transaction_intent(input jsonb)
get_point_transaction_intent_for_player(input jsonb)
confirm_point_transaction_intent(input jsonb)
cancel_point_transaction_intent(intent_id uuid)
expire_point_transaction_intents()
```

Confirmation result for the player may include:

- Store name.
- Operation type.
- Point amount.
- Structured reason.
- Event title when present.
- Expiry status.

Confirmation result must not include:

- Store internal notes.
- Store membership identifiers.
- Other player balances.
- QR token hash.
- Any point history outside the operation being confirmed.

Store operator result after completion may include only:

- Optimized avatar variant when present.
- Nickname.
- Player tag.
- Store-scoped point summary after the movement.
- Completed intent status.

Store operator result must not include:

- Email.
- Internal player UUIDs as public navigable identifiers.
- Other stores.
- Other events.
- Complete player profile.
- QR secret or token hash.
- Future point information outside the active store context.

Every action QR creation, scan, confirmation, cancellation, expiry, denial, and
failure must write an audit record with an allowlisted metadata shape. Audit
metadata must never include QR secrets, QR hashes, authentication tokens, email
addresses, or unnecessary personal data.

Personal player QR remains available for future flows where the player must be
identified directly, such as internal registration, check-in, or store-assisted
support. Personal QR is not the default mechanism for point grants or
redemptions in the Stage 2 pilot.

### Phase 3: Store-Scoped Prize Points

Create points as an immutable ledger. Do not add editable point balances to
players, stores, events, registrations, or QR credentials.

Required table:

```sql
point_ledger_entries
```

Recommended columns:

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid PK | `DEFAULT gen_random_uuid()` |
| `store_id` | uuid FK | Required point scope |
| `player_profile_id` | uuid FK | Required target player |
| `delta` | integer | Non-zero; positive grant or negative correction/spend |
| `reason` | varchar(40) | Structured reason |
| `intent_id` | uuid nullable | Completed action intent that produced this movement |
| `event_id` | uuid nullable | Optional event attribution |
| `event_attendance_id` | uuid nullable | Future only; do not create until attendance exists |
| `actor_account_id` | uuid FK | Operator or system actor |
| `actor_membership_id` | uuid FK nullable | Store authorization used |
| `idempotency_key` | text nullable | Prevent duplicate submissions |
| `metadata` | jsonb | Allowlisted, non-sensitive details |
| `occurred_at` | timestamptz | Defaults to `now()` |
| `created_at` | timestamptz | Defaults to `now()` |

Allowed initial reasons:

- `event_prize`
- `manual_bonus`
- `manual_correction`
- `pilot_import`
- `reward_redemption_adjustment` only after reward redemption is accepted

Required behavior:

- Owners and admins may create point grant and redemption intents within store
  scope.
- Staff may create point grant and redemption intents only if explicitly enabled
  for the pilot store or separately accepted as Stage 2 scope.
- Owners and admins may create manual administrative adjustments without player
  confirmation when the reason is correction, pilot import, or operational
  cleanup.
- Point grants may optionally reference an event owned by the same store.
- Corrections must reference the reason and may include a brief internal note.
- A negative movement must not make the derived balance negative unless an
  accepted business rule allows debt.
- The public calendar never exposes player point balances.
- Other stores cannot read a player's balance or ledger entries.

Recommended RPCs:

```text
record_store_point_movement(input jsonb)
get_store_player_point_summary(input jsonb)
list_store_point_ledger(input jsonb)
```

`record_store_point_movement` is for administrative adjustments and migration
or import workflows. Normal player-facing grant and redemption flows use
`confirm_point_transaction_intent`, which inserts the ledger entry inside the
same transaction that completes the intent.

Balance strategy:

- Start with an aggregate RPC grouped by `(store_id, player_profile_id)`.
- Add a cached projection only after query plans or pilot volume justify it.
- If a projection is added, it is a cache maintained transactionally from the
  ledger. It is not the source of truth.

### Phase 4: Location Normalization And Filtering

The Stage 1 public calendar already supports city filtering, but current
calendar filtering derives city from a `case` expression over branch and custom
event data. Stage 2 should prepare discovery for multiple cities before adding
browser location detection.

Required behavior:

- Preserve existing filters by game, date, city, and store.
- Preserve the special `Online` location filter.
- Normalize discoverable event location into a stable filter key.
- Support cities with the same name in different regions or countries.
- Return location facets from backend payloads instead of deriving all options
  from a preloaded client-side event list.
- Do not persist browser latitude or longitude for visitors.
- Do not require location permission to browse the calendar.

Recommended incremental model:

```sql
discovery_locations
event_discovery_locations
```

Alternative acceptable approach:

- Use generated columns or a security-invoker read model if it can preserve
  branch as the source of truth for branch-location events.

Recommended `discovery_locations` columns:

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid PK | |
| `slug` | varchar(180) | Public stable filter identifier |
| `label` | varchar(180) | Public display label |
| `city` | varchar(120) nullable | Null only for online |
| `region` | varchar(120) nullable | |
| `country_code` | char(2) nullable | |
| `kind` | varchar(20) | `place` or `online` |
| `latitude` | numeric(9,6) nullable | Representative centroid, not user data |
| `longitude` | numeric(9,6) nullable | Representative centroid, not user data |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Recommended `event_discovery_locations` columns:

| Column | Type | Rules |
| --- | --- | --- |
| `event_id` | uuid PK/FK | One discoverable location per event |
| `discovery_location_id` | uuid FK | |
| `store_id` | uuid FK | Denormalized for filtering and same-store checks |
| `starts_at` | timestamptz | Denormalized for public calendar range reads |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Refactor `list_public_calendar` to filter by a stable location slug rather than
`lower(case ...)` text comparison. Keep a backwards-compatible `city` parameter
only as a temporary API alias if needed.

### Phase 5: Opt-In Browser Location

Add location detection after normalized location filtering exists.

Required behavior:

- Ask permission through an explicit user action such as `Usar mi ubicacion`.
- Use browser geolocation only on the client.
- Send rounded or transient coordinates to the backend only for nearest-market
  lookup when needed.
- Do not store visitor coordinates.
- Allow manual city/market selection at all times.
- Fail gracefully when permission is denied or unavailable.

Initial recommendation:

- For the pilot, map user coordinates to the nearest `discovery_locations`
  record and apply that location filter.
- Defer radius search, distance ordering, maps, and PostGIS until the pilot
  confirms enough multi-city demand.

Future geospatial upgrade:

- Enable PostGIS.
- Add `geography(Point,4326)` for branches and discovery locations.
- Add GiST indexes for nearest-neighbor or radius queries.
- Define privacy rules before storing any user location preference.

## Authorization And RLS

New exposed tables must use deny-by-default RLS.

Recommended client access:

- Players may read and update only their own player profile fields allowed by
  product rules.
- Players may read only their own active QR display payload through RPC.
- Players may read and confirm only pending action intents through the action QR
  token they scanned.
- Store operators cannot browse player profiles.
- Store operators can create and inspect action intents only within authorized
  store scope.
- Store operators can resolve a personal player QR only inside an authorized
  contextual RPC when that future flow explicitly requires it.
- Store operators can read point summaries and ledger rows only for their own
  active store scope.
- Public visitors can read only normalized public discovery locations and
  published event discovery data required for calendar filtering.

Use RPCs for:

- QR creation, rotation, and resolution.
- Action QR intent creation, confirmation, cancellation, and expiry.
- Point ledger writes.
- Any multi-row update involving player profile onboarding and QR credential
  creation.
- Any operation that must audit success, denial, or failure.

RLS performance requirements:

- Wrap `auth.uid()` calls in `select auth.uid()` inside policies.
- Index every foreign key used by RLS membership checks.
- Use partial indexes for active, non-deleted, status-filtered paths.
- Keep `security definer` functions restricted, schema-qualified, and with
  `set search_path = ''`.
- Revoke direct execution from roles that should not call privileged helpers.

## Recommended Indexes

```sql
create unique index player_profiles_account_active_uq
on player_profiles (user_account_id)
where user_account_id is not null and deleted_at is null;

create unique index player_profiles_player_tag_uq
on player_profiles (player_tag);

create unique index player_qr_credentials_token_hash_uq
on player_qr_credentials (token_hash);

create unique index player_qr_credentials_one_active_per_player_uq
on player_qr_credentials (player_profile_id)
where status = 'active';

create index player_qr_credentials_player_status_idx
on player_qr_credentials (player_profile_id, status);

create index point_ledger_store_player_occurred_idx
on point_ledger_entries (store_id, player_profile_id, occurred_at desc);

create index point_ledger_store_event_idx
on point_ledger_entries (store_id, event_id)
where event_id is not null;

create unique index point_ledger_intent_uq
on point_ledger_entries (intent_id)
where intent_id is not null;

create unique index point_ledger_idempotency_uq
on point_ledger_entries (store_id, idempotency_key)
where idempotency_key is not null;

create unique index point_transaction_intents_qr_token_hash_uq
on point_transaction_intents (qr_token_hash);

create index point_transaction_intents_store_status_idx
on point_transaction_intents (store_id, status, created_at desc);

create index point_transaction_intents_expiry_idx
on point_transaction_intents (expires_at)
where status = 'pending_player_confirmation';

create unique index point_transaction_intents_idempotency_uq
on point_transaction_intents (store_id, idempotency_key)
where idempotency_key is not null;

create unique index discovery_locations_slug_uq
on discovery_locations (slug);

create index discovery_locations_place_lookup_idx
on discovery_locations (country_code, region, city)
where kind = 'place';

create index event_discovery_locations_location_start_idx
on event_discovery_locations (discovery_location_id, starts_at);

create index event_discovery_locations_store_start_idx
on event_discovery_locations (store_id, starts_at);
```

Add narrower indexes only after checking representative `EXPLAIN` plans for
calendar queries, point summaries, and QR resolution.

## UI Deliverables

Player UI:

- Replace `/player/me` later-stage notice with profile onboarding and profile
  summary.
- Replace `/player/qr` later-stage notice with QR display, rotation, and safe
  copy explaining that QR is identification only.
- Add loading, empty, revoked, and rotation-rate-limited states.
- Add an action QR scanner or scanned action route.
- Show pending point grant/redemption details before confirmation.
- Require explicit player acceptance before writing ledger entries.
- Show success, expired, cancelled, denied, and already-completed states.

Store UI:

- Add a point grant/redemption flow that creates an action QR intent.
- Show the generated action QR with expiry and cancel controls.
- After player confirmation, show completed status and store-scoped player
  point summary.
- Add a separate administrative adjustment flow for owners/admins.
- Add store point ledger history for owners/admins.

Public calendar UI:

- Keep manual location filter.
- Add opt-in `Usar mi ubicacion` action.
- Show selected location/market clearly.
- Keep `Online` selectable without geolocation.
- Preserve game/date/store filters.

## API Deliverables

New route handlers should follow the existing service/repository/RPC pattern.

Suggested routes:

```text
GET  /api/v1/player/me
POST /api/v1/player/me
GET  /api/v1/player/qr
POST /api/v1/player/qr/rotate
POST /api/v1/stores/{storeId}/player-qr/resolve
POST /api/v1/stores/{storeId}/point-intents
GET  /api/v1/stores/{storeId}/point-intents/{intentId}
POST /api/v1/stores/{storeId}/point-intents/{intentId}/cancel
GET  /api/v1/player/point-intents/{token}
POST /api/v1/player/point-intents/{token}/confirm
POST /api/v1/stores/{storeId}/points/adjustments
GET  /api/v1/stores/{storeId}/points
GET  /api/v1/public/locations
GET  /api/v1/public/locations/nearest
```

Do not expose service-role keys or QR secrets through any route response.

## Audit Requirements

Audit these actions:

- Player profile creation.
- Player nickname moderation change.
- QR credential issue.
- QR credential rotation.
- QR credential revocation.
- QR resolution succeeded, denied, and failed.
- Point action intent created.
- Point action intent scanned.
- Point action intent confirmed.
- Point action intent cancelled.
- Point action intent expired.
- Point action intent denied or failed.
- Point ledger movement created.
- Manual point correction created.
- Sensitive point or player disclosure denied.

Audit records must use stable action names and allowlisted metadata. Never
store QR secrets, QR hashes, auth tokens, email addresses, raw browser
coordinates, or unrestricted request payloads.

## Acceptance Criteria

Stage 2 is acceptable when:

1. An active authenticated adult user can create a player profile lazily.
2. A player can display and rotate a QR without exposing internal UUIDs.
3. A revoked or rotated QR no longer resolves.
4. A store operator cannot resolve a QR outside an authorized store context.
5. A store operator can create a point grant action QR without selecting a
   global player record.
6. A player can scan an action QR, review the operation, and explicitly confirm
   or decline.
7. Confirming an action QR writes the ledger entry and completes the intent in
   one transaction.
8. Expired, cancelled, already-completed, or replayed action QR tokens do not
   create duplicate ledger entries.
9. Action QR confirmation reveals only minimum context-specific player data to
   the store.
10. Every action QR attempt creates an audit record without QR secret/hash.
11. A store owner/admin can create manual point corrections through an audited
   administrative adjustment flow.
12. Point balances are derived from ledger entries and are isolated per store.
13. Corrections create compensating entries instead of editing history.
14. Public visitors cannot see player identities or point balances.
15. Calendar filtering still works by game, date, store, and location.
16. Online events remain available under the `Online` location filter.
17. Browser location permission is optional and never required for discovery.
18. RLS tests cover visitor, player, owner, admin, staff, and unrelated store.
19. Representative calendar and point queries have indexes verified with
    `EXPLAIN`.

## Implementation Notes

- Before creating migrations, check current Supabase CLI help and changelog.
- Iterate schema locally with SQL/RPC tests before generating migration files.
- Run Supabase advisors after database changes.
- Keep migrations scoped: player/QR, points, and location refactor can ship as
  separate migration groups if needed.
- Update `.agents/data-model.md` and `.agents/architecture-decisions.md` only
  after Stage 2 decisions move from proposed pilot scope to accepted product
  architecture.
