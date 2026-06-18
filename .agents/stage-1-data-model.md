# VortexHub Stage 1 Physical Data Model

## Purpose

This document is the implementation source of truth for MVP Stage 1.

Stage 1 validates:

- Store onboarding and self-service activation.
- Multi-operator and multi-branch administration.
- One-time and weekly recurring event publishing.
- Public calendar discovery.
- External registration links.
- Store visual identity uploads: public optimized store logos, platform event
  banners, and tester-open custom event banners that become premium-gated after
  official launch.

Read `.agents/product-context.md`, `.agents/data-model.md`, and
`.agents/architecture-decisions.md` for accepted product boundaries and future
design. When implementing Stage 1, this document takes precedence over future
tables and columns described there.

## Explicitly Excluded

Do not create Stage 1 tables, columns, functions, policies, or UI flows for:

- Player profiles, tags, nickname history, avatars, or QR credentials.
- Internal event registration, capacity, occupancy, registration cancellation,
  or reinstatement.
- In-app notifications.
- Attendance, points, rewards, or payments.
- Dependent players or guardianships.
- Scheduled store or branch closure plans.
- Series pause or complex recurrence rules.
- Public player lookup, public event history browsing, maps, or radius search.

Stage 1 event registration mode is only `disabled` or `external`.

## PostgreSQL Conventions

- Enable extensions required by the schema, including `pgcrypto` and `citext`.
- Use `uuid PRIMARY KEY DEFAULT gen_random_uuid()` unless a table explicitly
  shares an external identifier.
- Store timestamps as `timestamptz` in UTC.
- Use IANA timezone names for local-time interpretation.
- Every mutable domain table has `created_at` and `updated_at`.
- A shared trigger maintains `updated_at`.
- Use `deleted_at` only where soft deletion preserves historical identity.
- Use `varchar` plus `CHECK` constraints for Stage 1 states.
- Enable RLS on every table in an exposed schema.
- Deny access by default and grant only explicit policies.
- Use partial unique indexes for active soft-deleted records.
- Use `ON DELETE RESTRICT` by default. Use cascade only for strictly owned,
  non-historical join rows.
- Public URLs use slugs. Internal UUIDs are never public resource locators.

## Stage 1 Tables

Create only these domain tables:

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

Do not create `store_closure_plans`, `branch_closure_plans`,
`user_notifications`, or any player and registration tables in Stage 1.

## Identity And Legal Acceptance

### `user_accounts`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid PK/FK | Same UUID as `auth.users.id` |
| `display_name` | varchar(120) | Required |
| `status` | varchar(30) | `pending`, `active`, `suspended` |
| `anonymize_after` | timestamptz nullable | Set on deletion request |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz nullable | |

Supabase Auth owns credentials, verified email, sessions, and recovery.
VortexHub never stores password hashes.

An operator must have `status = 'active'`, no `deleted_at`, and acceptance of
the current `minimum_age_declaration` before performing store actions.

Account deletion immediately disables access and memberships. Anonymization
occurs after 30 days and cannot complete while the account is the final active
owner of an active store.

### `legal_document_versions`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid PK | |
| `document_key` | varchar(80) | `minimum_age_declaration` initially |
| `version` | varchar(60) | Immutable |
| `content` | text | Exact immutable presented content |
| `content_hash` | text | Hash of exact presented content |
| `is_current` | boolean | One current version per document key |
| `published_at` | timestamptz | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Current-version flag changes only |

Required uniqueness:

```sql
UNIQUE (document_key, version)
```

Maintain exactly one current published version for
`minimum_age_declaration` through a partial unique index and transactional
publication operation.

### `legal_acceptances`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid PK | |
| `user_account_id` | uuid FK | |
| `legal_document_version_id` | uuid FK | |
| `accepted_at` | timestamptz | |
| `created_at` | timestamptz | |

Required uniqueness:

```sql
UNIQUE (user_account_id, legal_document_version_id)
```

Legal document content and version identifiers are immutable. Only the
transactionally managed `is_current` flag changes. Versions and acceptances are
retained permanently.

## Platform Administration

### `platform_roles`

| Column | Type | Rules |
| --- | --- | --- |
| `user_account_id` | uuid PK/FK | |
| `role` | varchar(30) | `platform_admin`, `platform_moderator` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

- `platform_admin` manages games, platform banners, entitlements, store
  suspension/restoration, moderation, and platform-role assignment.
- `platform_moderator` moderates custom banners only.
- Assignment is available only through a secure internal operation.
- Every role change and platform action is audited.

## Stores And Memberships

### `stores`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid PK | |
| `name` | varchar(160) | Required |
| `slug` | varchar(160) | Global public identifier |
| `description` | text nullable | |
| `logo_url` | text nullable | Public optimized logo URL/path |
| `timezone` | varchar(60) | Valid IANA timezone |
| `status` | varchar(30) | `pending`, `active`, `suspended`, `closed` |
| `activated_at` | timestamptz nullable | Freezes slug |
| `closed_at` | timestamptz nullable | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz nullable | |

Rules:

- A pending store activates through an audited owner RPC.
- Creating a store atomically creates its initial active owner membership.
- Activation requires a valid name, unique slug, timezone, active owner, and
  current adult-age declaration acceptance.
- An active store must always have at least one active owner.
- `suspended` is controlled by `platform_admin` and reversible only by
  `platform_admin`.
- `closed` is owner-requested, immediate, and terminal during Stage 1.
- Store closure requires a minimal affected-event preview and a public
  cancellation message. It closes branches, ends active series, cancels future
  published events through a cancellation batch, and disables operational
  memberships.
- A store may activate without branches.
- A store may activate without a logo, but uploading a public optimized logo is
  a core Stage 1 capability available to owners and store-wide admins.
- The slug is immutable after `activated_at` is set.

### `store_memberships`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid PK | |
| `store_id` | uuid FK | |
| `user_account_id` | uuid FK | |
| `role` | varchar(30) | `owner`, `admin`, `staff` |
| `scope` | varchar(30) | `store`, `branches` |
| `status` | varchar(30) | `active`, `disabled` |
| `accepted_at` | timestamptz | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz nullable | |

Required uniqueness:

```sql
UNIQUE (id, store_id)
```

```sql
CREATE UNIQUE INDEX store_memberships_active_account_uq
ON store_memberships (store_id, user_account_id)
WHERE deleted_at IS NULL;
```

Rules:

- Invitations live separately; memberships do not use an `invited` state.
- Owners always have `scope = 'store'`.
- Active branch-scoped memberships require at least one assignment to an active
  branch.
- Removing the final active assignment must reject or atomically disable the
  membership. It never expands access.
- The final active owner of an active store cannot leave, be demoted, be
  disabled, or delete their account.

Stage 1 permissions:

- `owner`: full store administration.
- `admin`: manages branches, series, and events within scope; cannot manage
  owners. Store-wide admins may upload/remove store logos and custom banners.
  Branch-scoped admins may select existing eligible banners for assigned-branch
  events.
- `staff`: read-only operational access within scope.

A branch-scoped admin cannot create a new branch because the new branch is not
within existing scope. Owners and store-wide admins may create branches.

### `store_membership_invitations`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid PK | |
| `store_id` | uuid FK | |
| `email_normalized` | citext | Intended verified Supabase Auth email |
| `role` | varchar(30) | `owner`, `admin`, `staff` |
| `scope` | varchar(30) | `store`, `branches` |
| `token_hash` | text | Hash only; never plaintext |
| `status` | varchar(30) | `pending`, `accepted`, `revoked`, `expired` |
| `invited_by_account_id` | uuid FK | |
| `expires_at` | timestamptz | Seven days after creation |
| `accepted_by_account_id` | uuid FK nullable | |
| `accepted_at` | timestamptz nullable | |
| `revoked_at` | timestamptz nullable | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Rules:

- Owners may invite any role.
- Admins may invite admin or staff only, with no broader scope than their own.
- Acceptance requires an active account with the same verified Supabase Auth
  email and current age declaration.
- Accepting creates membership and assignments atomically.
- Plaintext invitation links are delivered by email and never persisted or
  logged.
- Sending and accepting never reveal whether the email already had an account.
- VortexHub sends no other Stage 1 product email.
- Delete terminal invitation rows 30 days after acceptance, revocation, or
  expiry. Required invitation history remains in data-minimal audit records
  without the invited email.

### `store_membership_invitation_branches`

| Column | Type | Rules |
| --- | --- | --- |
| `invitation_id` | uuid FK | `ON DELETE CASCADE` |
| `branch_id` | uuid FK | Active branch in invitation store |
| `store_id` | uuid FK | Composite ownership enforcement |
| `created_at` | timestamptz | |

Required uniqueness:

```sql
UNIQUE (invitation_id, branch_id)
```

Add `UNIQUE (id, store_id)` to `store_membership_invitations` and enforce:

```sql
(invitation_id, store_id) REFERENCES store_membership_invitations(id, store_id)
(branch_id, store_id) REFERENCES branches(id, store_id)
```

- `scope = 'branches'` requires at least one row.
- `scope = 'store'` requires no rows.
- Reject acceptance if any intended branch is no longer active.

### `branch_membership_assignments`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid PK | |
| `store_membership_id` | uuid FK | |
| `branch_id` | uuid FK | |
| `store_id` | uuid FK | Composite ownership enforcement |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Required uniqueness and composite ownership:

```sql
UNIQUE (store_membership_id, branch_id)
```

```sql
(store_membership_id, store_id) REFERENCES store_memberships(id, store_id)
(branch_id, store_id) REFERENCES branches(id, store_id)
```

### `store_entitlements`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid PK | |
| `store_id` | uuid FK | |
| `feature` | varchar(80) | `custom_event_banners` |
| `status` | varchar(30) | `active`, `expired`, `revoked` |
| `starts_at` | timestamptz | |
| `ends_at` | timestamptz nullable | |
| `granted_by_account_id` | uuid FK nullable | Platform admin |
| `source` | varchar(30) | Stage 1: `manual`; `external_billing` later |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Only `platform_admin` manages entitlements during Stage 1. An entitlement is
active only when status and time bounds permit it. Prevent overlapping active
entitlements for the same store and feature.

Pilot rule: before official launch, tester stores should receive active
`custom_event_banners` access by default, either through onboarding-created
manual entitlement rows or an explicit environment-level pilot gate. After
official launch, custom event-banner upload and selection require an active
non-expired entitlement.

## Branches

### `branches`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid PK | |
| `store_id` | uuid FK | |
| `name` | varchar(160) | |
| `slug` | varchar(160) | Public identifier within store |
| `address_line` | text nullable | Required before activation |
| `city` | varchar(120) nullable | Required before activation |
| `region` | varchar(120) nullable | |
| `country_code` | char(2) nullable | Required before activation |
| `latitude` | numeric(9,6) nullable | |
| `longitude` | numeric(9,6) nullable | |
| `timezone` | varchar(60) nullable | Overrides store timezone |
| `status` | varchar(30) | `draft`, `active`, `inactive` |
| `activated_at` | timestamptz nullable | Freezes physical identity |
| `closed_at` | timestamptz nullable | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz nullable | |

Required uniqueness:

```sql
UNIQUE (id, store_id)
```

```sql
CREATE UNIQUE INDEX branches_store_slug_active_uq
ON branches (store_id, slug)
WHERE deleted_at IS NULL;
```

Rules:

- Draft branches are not public and cannot host published events.
- Activation requires complete physical location and valid effective timezone.
- After first activation, name, slug, address, city, region, country,
  coordinates, and timezone are immutable.
- Relocation requires immediate closure and creation of a new branch.
- Owner-only immediate closure requires an affected-event preview and public
  cancellation message. It ends attached active series, cancels future
  published events through a cancellation batch, removes branch assignments,
  and disables branch-scoped memberships left without active assignments.
- Owner-only reactivation does not restore assignments, ended series, or
  cancelled events.
- No event or series reassignment exists during Stage 1.
- Coordinates are stored for future use but Stage 1 has no maps or distance
  search.

## Game Catalog And Banners

### `games`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid PK | |
| `name` | varchar(120) | |
| `slug` | varchar(120) | Public global identifier |
| `publisher` | varchar(120) nullable | |
| `is_active` | boolean | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Only `platform_admin` manages games. Seed stable records for `Miscelaneo` and
`Otros`. Inactive games remain valid for history but cannot be selected by new
events or series.

### `platform_event_banners`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid PK | |
| `game_id` | uuid FK nullable | Null for global fallback |
| `name` | varchar(160) | |
| `storage_path` | text | Public optimized Storage object |
| `is_default` | boolean | |
| `status` | varchar(30) | `active`, `inactive` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Only `platform_admin` manages platform banners. Maintain at most one active
default per game and one active global fallback.

Fallback order:

1. Selected active platform banner.
2. Active default for the event game.
3. Active global default.

### `store_media_assets`

Store-owned visual identity media stored in Supabase Storage.

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid PK | |
| `store_id` | uuid FK | |
| `uploaded_by_account_id` | uuid FK | Owner or authorized admin |
| `asset_type` | varchar(30) | `store_logo`, `event_banner` |
| `source_storage_path` | text | Private source object |
| `optimized_storage_path` | text nullable | Public WebP variant |
| `mime_type` | varchar(120) | `image/jpeg`, `image/png`, `image/webp` |
| `byte_size` | integer | Maximum 5 MB |
| `width` | integer | Minimum depends on `asset_type` |
| `height` | integer | Minimum depends on `asset_type` |
| `status` | varchar(30) | `processing`, `active`, `pending_removal`, `removed`, `rejected` |
| `remove_after` | timestamptz nullable | |
| `moderated_by_account_id` | uuid FK nullable | |
| `moderation_reason` | varchar(240) nullable | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz nullable | |

Rules:

- Store logo upload is a core Stage 1 capability and does not require premium
  entitlement.
- Custom event banner upload and selection are open to tester stores during the
  pilot. After official launch, they require active `custom_event_banners`
  entitlement.
- Owner and store-wide admin may upload or remove assets. Branch-scoped admins
  may select an existing active asset for events in assigned branches but
  cannot upload or remove store-level assets.
- A store may have one active `store_logo` selected as its current public logo.
- Maximum 20 active `event_banner` assets per store.
- Validate source type, size, dimensions, and aspect ratio in a trusted server
  process.
- `store_logo` sources must be at least 256 by 256 pixels and generate a square
  public optimized WebP variant suitable for cards, headers, and admin chrome.
- `event_banner` sources must be at least 1200 by 675 pixels and generate a
  public optimized WebP calendar/detail variant.
- `platform_admin` and `platform_moderator` may remove inappropriate assets.
- Post-launch premium loss marks `event_banner` assets `pending_removal` with a
  30-day grace period. Pilot access ending at official launch follows the same
  transition only for stores that do not receive/keep an entitlement.
- Store logo removal clears `stores.logo_url` and may fall back to the generated
  brand mark. It must not affect event publication.
- On removal, delete Storage objects and set status `removed`; retain the row.
- Events referencing unavailable custom event banners display the platform
  fallback.
- Past event references never block event-banner removal.

## Event Publishing

### Shared Event And Series Rules

- Exactly one representative `store_id`.
- Exactly one active `game_id`.
- `Otros` requires `other_game_name`; all other games reject it.
- Registration mode is `disabled` or `external`.
- `disabled` is default and requires null external URL.
- `external` requires an HTTPS URL.
- External URLs must be absolute, contain no embedded credentials, and use
  `https`.
- Entry fee is informational only. Amount and ISO 4217 currency are both null
  or both present. Zero explicitly means free.
- Location mode is `branch`, `custom`, or `online`.
- Banner mode is `platform` or `custom`.
- Custom banner selection requires an active `event_banner` asset owned by the
  event store. During pilot, tester stores may select these assets without a
  premium entitlement; after official launch, current entitlement is required at
  selection time.
- Owner and admin may manage within membership scope. Staff is read-only.
- Branch-scoped authorization uses `branch_id`. Records with null `branch_id`
  require store-wide scope.

Location coherence:

```text
branch:
  branch_id required and active
  location_text/city/region/country null

custom:
  location_text, location_city, location_country_code required
  location_region optional
  branch_id optional as organizing branch

online:
  location_text required
  location city/region/country null
  branch_id optional as organizing branch
```

The public city filter uses branch city for `branch`, explicit custom city for
`custom`, and a special `Online` value for `online`.

### `event_series`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid PK | |
| `store_id` | uuid FK | |
| `branch_id` | uuid FK nullable | Composite ownership |
| `game_id` | uuid FK | |
| `other_game_name` | varchar(120) nullable | |
| `created_by_account_id` | uuid FK | |
| `slug` | varchar(180) | Public identifier within store |
| `title` | varchar(180) | |
| `description` | text nullable | |
| `format_name` | varchar(120) nullable | |
| `status` | varchar(30) | `draft`, `active`, `ended` |
| `weekdays` | smallint[] | One or more unique ISO weekdays 1-7 |
| `local_start_time` | time | Local wall-clock time |
| `duration_minutes` | integer nullable | Positive |
| `timezone` | varchar(60) | Valid IANA timezone |
| `starts_on` | date | |
| `ends_on` | date nullable | `>= starts_on` |
| `registration_mode` | varchar(20) | `disabled`, `external` |
| `external_registration_url` | text nullable | HTTPS when external |
| `entry_fee_amount` | numeric(12,2) nullable | Non-negative |
| `entry_fee_currency` | char(3) nullable | ISO 4217 |
| `location_mode` | varchar(20) | `branch`, `custom`, `online` |
| `location_text` | text nullable | |
| `location_city` | varchar(120) nullable | |
| `location_region` | varchar(120) nullable | |
| `location_country_code` | char(2) nullable | |
| `banner_mode` | varchar(20) | `platform`, `custom` |
| `platform_banner_id` | uuid FK nullable | |
| `custom_banner_asset_id` | uuid FK nullable | |
| `activated_at` | timestamptz nullable | Freezes slug |
| `ended_at` | timestamptz nullable | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz nullable | |

Required indexes:

```sql
CREATE UNIQUE INDEX event_series_store_slug_active_uq
ON event_series (store_id, slug)
WHERE deleted_at IS NULL;
```

```sql
CREATE INDEX event_series_generation_idx
ON event_series (status, timezone)
WHERE status = 'active' AND deleted_at IS NULL;
```

```sql
CREATE INDEX event_series_store_status_idx
ON event_series (store_id, status)
WHERE deleted_at IS NULL;
```

Rules:

- Activating a series freezes its slug and immediately generates/publishes all
  eligible remaining occurrences in the current local week.
- Every Sunday at 00:00 in the series timezone, generate/publish the following
  Monday-through-Sunday occurrences.
- Generation is idempotent.
- Series edits affect only dates not yet generated.
- Ending a series stops future generation and does not change generated events.
- Stage 1 has no pause and no bulk action when ending a series.
- If the series references a custom banner that is no longer eligible,
  generation snapshots the applicable platform fallback instead.

### `events`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid PK | |
| `event_series_id` | uuid FK nullable | |
| `series_local_date` | date nullable | Original scheduled local date |
| `is_series_exception` | boolean | Default false |
| `store_id` | uuid FK | |
| `branch_id` | uuid FK nullable | Composite ownership |
| `game_id` | uuid FK | |
| `other_game_name` | varchar(120) nullable | |
| `created_by_account_id` | uuid FK | |
| `slug` | varchar(180) | Public identifier within store |
| `title` | varchar(180) | |
| `description` | text nullable | |
| `format_name` | varchar(120) nullable | |
| `status` | varchar(30) | `draft`, `published`, `cancelled`, `completed` |
| `registration_mode` | varchar(20) | `disabled`, `external` |
| `external_registration_url` | text nullable | HTTPS when external |
| `starts_at` | timestamptz | |
| `ends_at` | timestamptz nullable | Must be after start |
| `entry_fee_amount` | numeric(12,2) nullable | Non-negative |
| `entry_fee_currency` | char(3) nullable | ISO 4217 |
| `location_mode` | varchar(20) | `branch`, `custom`, `online` |
| `location_text` | text nullable | |
| `location_city` | varchar(120) nullable | |
| `location_region` | varchar(120) nullable | |
| `location_country_code` | char(2) nullable | |
| `banner_mode` | varchar(20) | `platform`, `custom` |
| `platform_banner_id` | uuid FK nullable | |
| `custom_banner_asset_id` | uuid FK nullable | |
| `published_at` | timestamptz nullable | Freezes slug |
| `cancelled_at` | timestamptz nullable | |
| `cancelled_by_account_id` | uuid FK nullable | |
| `cancellation_message` | varchar(240) nullable | Required for published event |
| `cancellation_batch_id` | uuid FK nullable | |
| `archived_at` | timestamptz nullable | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz nullable | |

Required constraints and indexes:

```sql
CHECK (ends_at IS NULL OR ends_at > starts_at)
```

```sql
CHECK (
  (event_series_id IS NULL AND series_local_date IS NULL)
  OR
  (event_series_id IS NOT NULL AND series_local_date IS NOT NULL)
)
```

```sql
UNIQUE (event_series_id, series_local_date)
```

```sql
CREATE UNIQUE INDEX events_store_slug_active_uq
ON events (store_id, slug)
WHERE deleted_at IS NULL;
```

```sql
CREATE INDEX events_public_calendar_idx
ON events (starts_at, game_id, store_id)
WHERE status = 'published' AND archived_at IS NULL AND deleted_at IS NULL;
```

```sql
CREATE INDEX events_store_calendar_idx
ON events (store_id, starts_at)
WHERE deleted_at IS NULL;
```

The store calendar index is the primary support for authorized organizer
calendar range reads. Add narrower indexes only after measuring real query
plans for branch, game, or status-heavy filters.

Rules:

- Generated slugs use `{series-slug}-{YYYY-MM-DD}` from `series_local_date`.
- Editing a generated occurrence never changes its series and sets
  `is_series_exception = true`.
- Publishing freezes the slug.
- Date or time changes and cancellation are audited.
- Cancelling a published event requires a public `cancellation_message`.
- Auto-complete a published event at `ends_at`, or six hours after `starts_at`
  when `ends_at` is null.
- A cancelled event never becomes completed.
- Auto-archive completed or cancelled events after 12 months from `ends_at`, or
  `starts_at` when no end exists.
- The public calendar lists future and currently active published events only.
- Published past and archived events resolve by direct slug URL with basic
  information and platform banner fallback.
- Stage 1 has no public historical-event explorer.

### `event_cancellation_batches`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid PK | |
| `store_id` | uuid FK | |
| `branch_id` | uuid FK nullable | |
| `source` | varchar(30) | `branch_closure`, `store_closure` |
| `public_message` | varchar(240) | Applied to published affected events |
| `internal_reason` | text nullable | Audit-only |
| `created_by_account_id` | uuid FK | Owner |
| `created_at` | timestamptz | |

Cancellation batches are immutable. Immediate close RPCs create one batch and
link each cancelled future event to it.

## Audit

### `audit_events`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid PK | |
| `actor_account_id` | uuid FK nullable | |
| `actor_membership_id` | uuid FK nullable | |
| `store_id` | uuid FK nullable | |
| `branch_id` | uuid FK nullable | |
| `action` | varchar(80) | Stable allowlisted action |
| `subject_type` | varchar(80) | |
| `subject_id` | uuid nullable | |
| `context_type` | varchar(80) nullable | |
| `context_id` | uuid nullable | |
| `outcome` | varchar(30) | `succeeded`, `denied`, `failed` |
| `request_id` | uuid nullable | |
| `metadata` | jsonb | Action-specific allowlisted shape |
| `occurred_at` | timestamptz | |
| `created_at` | timestamptz | |

Audit records are append-only, have no general client read access, and never
contain invitation tokens, authentication tokens, verified emails, Storage
secrets, or unnecessary personal data.

Stage 1 audited actions:

- Store activation, suspension, restoration, and closure.
- Platform-role assignment and removal.
- Owner and membership changes.
- Invitation creation, revocation, and acceptance.
- Branch activation, closure, and reactivation.
- Event and series publication, date/time changes, ending, and cancellation.
- Custom banner upload, removal, selection, and moderation.
- Platform banner and game catalog changes.
- Entitlement grant, expiry, and revocation.

Do not audit ordinary title, description, or format edits.

General audit retention is 24 months. Security-sensitive actions, including
platform-role changes and store suspension/restoration, are retained for 36
months. Expiry uses an auditable deletion or irreversible anonymization job.

## Slug Rules

Generate slugs by:

1. Lowercasing.
2. Removing diacritics and normalizing separators to `-`.
3. Collapsing and trimming hyphens.
4. Enforcing maximum length.
5. Rejecting reserved route words.
6. Appending a short random non-sequential suffix on collision.

Do not expose UUIDs or sequential identifiers in slugs.

Slugs may be edited before first publication or activation and are immutable
afterward.

## Required Stage 1 Indexes

In addition to primary keys and indexes listed with individual tables, create:

```sql
CREATE UNIQUE INDEX stores_slug_active_uq
ON stores (slug)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX legal_document_versions_one_current_uq
ON legal_document_versions (document_key)
WHERE is_current;

CREATE INDEX store_memberships_account_idx
ON store_memberships (user_account_id, status)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX store_membership_invitations_token_hash_uq
ON store_membership_invitations (token_hash);

CREATE INDEX store_membership_invitations_expiry_idx
ON store_membership_invitations (expires_at)
WHERE status = 'pending';

CREATE UNIQUE INDEX store_membership_invitations_one_pending_uq
ON store_membership_invitations (store_id, email_normalized)
WHERE status = 'pending';

CREATE INDEX branch_membership_assignments_membership_idx
ON branch_membership_assignments (store_membership_id);

CREATE INDEX branch_membership_assignments_branch_idx
ON branch_membership_assignments (branch_id);

CREATE UNIQUE INDEX games_slug_uq
ON games (slug);

CREATE INDEX store_entitlements_lookup_idx
ON store_entitlements (store_id, feature, status, starts_at, ends_at);

CREATE INDEX store_media_assets_store_status_idx
ON store_media_assets (store_id, status);

CREATE INDEX store_media_assets_removal_idx
ON store_media_assets (remove_after)
WHERE status = 'pending_removal';

CREATE INDEX events_game_calendar_idx
ON events (game_id, starts_at)
WHERE status = 'published' AND archived_at IS NULL AND deleted_at IS NULL;

CREATE INDEX events_branch_calendar_idx
ON events (branch_id, starts_at)
WHERE branch_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX events_completion_idx
ON events (ends_at, starts_at)
WHERE status = 'published' AND deleted_at IS NULL;

CREATE INDEX events_archival_idx
ON events (ends_at, starts_at)
WHERE status IN ('completed', 'cancelled') AND archived_at IS NULL;

CREATE INDEX audit_events_store_occurred_idx
ON audit_events (store_id, occurred_at DESC);

CREATE INDEX audit_events_occurred_idx
ON audit_events (occurred_at);
```

Use partial or exclusion constraints to prevent overlapping active
`store_entitlements` for the same `(store_id, feature)`.

Maintain one active default platform banner per game and one active global
default through partial unique indexes or an equivalent transactional
constraint.

## Mandatory Integrity Constraints

Every migration must enforce state values and same-store references. At
minimum:

The following expressions are grouped for readability. Apply each `CHECK` to
the corresponding table and use table qualifiers only where accepted by the
migration syntax.

```sql
CHECK (user_accounts.status IN ('pending', 'active', 'suspended'))
CHECK (platform_roles.role IN ('platform_admin', 'platform_moderator'))
CHECK (stores.status IN ('pending', 'active', 'suspended', 'closed'))
CHECK (store_memberships.role IN ('owner', 'admin', 'staff'))
CHECK (store_memberships.scope IN ('store', 'branches'))
CHECK (store_memberships.status IN ('active', 'disabled'))
CHECK (store_memberships.role <> 'owner' OR store_memberships.scope = 'store')
CHECK (store_membership_invitations.status IN ('pending', 'accepted', 'revoked', 'expired'))
CHECK (store_entitlements.feature = 'custom_event_banners')
CHECK (store_entitlements.status IN ('active', 'expired', 'revoked'))
CHECK (store_entitlements.source = 'manual')
CHECK (branches.status IN ('draft', 'active', 'inactive'))
CHECK (event_series.status IN ('draft', 'active', 'ended'))
CHECK (events.status IN ('draft', 'published', 'cancelled', 'completed'))
CHECK (event_series.registration_mode IN ('disabled', 'external'))
CHECK (events.registration_mode IN ('disabled', 'external'))
CHECK (event_series.location_mode IN ('branch', 'custom', 'online'))
CHECK (events.location_mode IN ('branch', 'custom', 'online'))
CHECK (event_series.banner_mode IN ('platform', 'custom'))
CHECK (events.banner_mode IN ('platform', 'custom'))
CHECK (audit_events.outcome IN ('succeeded', 'denied', 'failed'))
```

Timestamp coherence:

```sql
CHECK ((activated_at IS NULL) = (stores.status = 'pending'))
CHECK (stores.status <> 'closed' OR closed_at IS NOT NULL)
CHECK (branches.status = 'draft' OR activated_at IS NOT NULL)
CHECK (branches.status <> 'inactive' OR closed_at IS NOT NULL)
CHECK (event_series.status = 'draft' OR activated_at IS NOT NULL)
CHECK (event_series.status <> 'ended' OR ended_at IS NOT NULL)
CHECK (events.status <> 'published' OR published_at IS NOT NULL)
CHECK (events.status <> 'completed' OR published_at IS NOT NULL)
CHECK (events.status <> 'cancelled' OR cancelled_at IS NOT NULL)
CHECK (
  events.status <> 'cancelled'
  OR published_at IS NULL
  OR cancellation_message IS NOT NULL
)
CHECK (archived_at IS NULL OR events.status IN ('completed', 'cancelled'))
CHECK (ends_at IS NULL OR ends_at > starts_at)
```

External registration coherence for both series and events:

```sql
CHECK (
  (registration_mode = 'external' AND external_registration_url IS NOT NULL)
  OR
  (registration_mode = 'disabled' AND external_registration_url IS NULL)
)
```

RPC validation additionally requires an absolute HTTPS URL with no embedded
credentials.

Informational fee coherence for both series and events:

```sql
CHECK (entry_fee_amount IS NULL OR entry_fee_amount >= 0)
CHECK (
  (entry_fee_amount IS NULL AND entry_fee_currency IS NULL)
  OR
  (entry_fee_amount IS NOT NULL AND entry_fee_currency IS NOT NULL)
)
```

Location coherence for both series and events:

```sql
CHECK (
  (location_mode = 'branch'
    AND branch_id IS NOT NULL
    AND location_text IS NULL
    AND location_city IS NULL
    AND location_region IS NULL
    AND location_country_code IS NULL)
  OR
  (location_mode = 'custom'
    AND location_text IS NOT NULL
    AND location_city IS NOT NULL
    AND location_country_code IS NOT NULL)
  OR
  (location_mode = 'online'
    AND location_text IS NOT NULL
    AND location_city IS NULL
    AND location_region IS NULL
    AND location_country_code IS NULL)
)
```

Banner coherence for both series and events:

```sql
CHECK (
  (banner_mode = 'platform'
    AND platform_banner_id IS NOT NULL
    AND custom_banner_asset_id IS NULL)
  OR
  (banner_mode = 'custom'
    AND custom_banner_asset_id IS NOT NULL
    AND platform_banner_id IS NULL)
)
```

Other required coherence:

```sql
CHECK ((latitude IS NULL) = (longitude IS NULL))
CHECK (byte_size > 0 AND byte_size <= 5242880)
CHECK (width >= 1200 AND height >= 675)
CHECK (remove_after IS NULL OR status = 'pending_removal')
CHECK (ends_on IS NULL OR ends_on >= starts_on)
CHECK (duration_minutes IS NULL OR duration_minutes > 0)
CHECK (cardinality(weekdays) > 0)
CHECK (
  (event_series_id IS NULL AND series_local_date IS NULL)
  OR
  (event_series_id IS NOT NULL AND series_local_date IS NOT NULL)
)
```

Validate unique weekday values in the series RPC or through an immutable helper
used by a `CHECK`.

Add `UNIQUE (id, store_id)` to `event_series`, `store_media_assets`, and
`event_cancellation_batches`. Required same-store foreign keys:

```sql
(event_series_id, store_id) REFERENCES event_series(id, store_id)
(branch_id, store_id) REFERENCES branches(id, store_id)
(custom_banner_asset_id, store_id) REFERENCES store_media_assets(id, store_id)
(cancellation_batch_id, store_id) REFERENCES event_cancellation_batches(id, store_id)
```

Nullable composite references apply only when their resource identifier is not
null.

Rules that depend on current row state in another table must be enforced inside
transactional RPCs, including:

- Current age declaration acceptance.
- Active store, branch, game, entitlement, membership, and assignment.
- `Otros` and `other_game_name` coherence.
- Slug and physical-branch immutability after activation/publication.
- Last active owner protection.
- Invitation scope and verified-email acceptance.
- Maximum 20 active custom assets per store.
- Series generation and immediate closure behavior.

## RLS And Client Access

### Public `anon` And `authenticated` Reads

Allow:

- Public store records with status `active`, `suspended`, or `closed`.
- Active branches for public discovery and inactive branches only where
  required to render a direct historical resource.
- Active games.
- Active platform banners.
- Active event series belonging to active stores.
- Future and currently active published events belonging to active stores for
  public calendar discovery.
- Basic direct-history pages for published past and archived events, including
  historical events of suspended or closed stores.
- Active optimized custom banner metadata required to render public events and
  series. Optimized custom banner objects are public media; source objects are
  private.

Do not expose audit records, invitations, memberships, entitlements, platform
roles, source media objects, cancellation batches, or legal evidence publicly.

Use public views or equivalent query boundaries so suspended and closed stores
remain directly resolvable without appearing as active calendar results.

### Authenticated Operator Reads

- Users may read their own `user_accounts` row and legal acceptance status.
- Authenticated users may read published legal document versions required for
  acceptance.
- Owners read all operational records for their store.
- Admins read and manage operational records within membership scope.
- Only store-wide admins and owners may read private custom-banner source-media
  workflow data.
- Staff read branches, series, events, and public banner information within
  membership scope. Staff cannot read membership invitations, entitlements,
  audit records, or private source media.
- Branch-scoped access requires an active assignment to the record's
  `branch_id`.
- Records with null `branch_id` require a store-wide membership.

### Organizer Calendar Read Contract

Stage 1 must provide an authorized store-calendar read surface through either
RLS-protected views plus client queries or a `security invoker` RPC. The
recommended shape is:

```text
get_store_calendar_workspace(
  store_id,
  range_start timestamptz,
  range_end timestamptz,
  branch_ids uuid[] nullable,
  game_ids uuid[] nullable,
  statuses text[] nullable
)
```

Responsibilities:

- Validate the caller has an active owner, admin, or staff membership for the
  store.
- Apply branch scope server-side. Branch-scoped users only receive records for
  assigned branches; records with null `branch_id` require store-wide scope.
- Require a bounded range. Stage 1 should support week and month planning
  windows and reject unbounded calendar reads.
- Return concrete `events` in the requested range, including drafts,
  published, cancelled, and completed records when authorized and requested.
- Include enough joined context for the UI without extra per-event lookups:
  game, branch or effective location, event status, registration mode,
  banner optimized URL or platform fallback, `event_series_id`,
  source series title and slug when present, `series_local_date`, and
  `is_series_exception`. This supports showing a "generated by series"
  indicator on calendar events and linking from event edit screens to the
  source series template.
- Return active and draft `event_series` summaries for the same store and
  authorized scope so the calendar can show recurrence templates alongside
  generated occurrences without treating a template as a concrete event.
- Never infer conflicts from time overlap. The backend may return overlapping
  events in the same range, but Stage 1 has no modeled exclusive resource and
  therefore no automatic conflict state.
- Use stable internal UUIDs only on authenticated admin surfaces. Public
  calendar resources continue to use slugs.

This read surface does not create new Stage 1 tables. It is a contract over
`events`, `event_series`, `branches`, `games`, and banner metadata with the
existing membership and branch-assignment authorization rules.

### Writes

Use deny-by-default RLS. Relevant domain writes use authorized RPC functions
rather than general direct table writes.

Use `auth.uid()` only as caller identity. Resolve current roles, membership
status, scope, and branch assignments from domain tables, not JWT claims.

Use `security invoker` by default. Any `security definer` function must:

- Validate caller and authorization explicitly.
- Use schema-qualified names.
- Set a safe `search_path`.
- Restrict execute privileges.
- Have dedicated authorization tests.

Secret and service-level Supabase keys never appear in clients.

## Required Stage 1 RPC Functions

Names are indicative but responsibilities are mandatory.

### Calendar Workspace Reads

- `get_store_calendar_workspace(...)` or an equivalent RLS-protected read model
  satisfying the organizer calendar read contract above.

### Account And Legal

- `accept_legal_document(version_id)`
- `activate_user_account()`
- `request_account_deletion()`
- `restore_account_before_anonymization()`

### Store And Membership

- `create_store(...)`
- `activate_store(store_id)`
- `close_store_immediately(store_id, public_message, internal_reason)`
- `invite_store_member(...)`
- `revoke_store_invitation(invitation_id)`
- `accept_store_invitation(token)`
- `change_store_membership(...)`
- `disable_store_membership(membership_id)`
- `set_branch_membership_assignments(...)`

### Branch

- `create_branch(...)`
- `activate_branch(branch_id)`
- `close_branch_immediately(branch_id, public_message, internal_reason)`
- `reactivate_branch(branch_id)`

### Events And Series

- `create_event(...)`
- `update_event(...)`
- `publish_event(event_id)`
- `cancel_event(event_id, public_message)`
- `create_event_series(...)`
- `update_event_series(...)`
- `activate_event_series(series_id)`
- `end_event_series(series_id)`

### Platform And Premium

- `set_platform_role(...)` through internal-only execution
- `suspend_store(store_id, reason)`
- `restore_suspended_store(store_id, reason)`
- `manage_game(...)`
- `manage_platform_banner(...)`
- `grant_store_entitlement(...)`
- `revoke_store_entitlement(...)`
- `begin_store_media_upload(...)`
- `finalize_store_media_asset(...)` through trusted processing
- `remove_store_media_asset(...)`
- `moderate_store_media_asset(...)`

Banner upload and optimization may use a trusted Edge Function or server
process, but database ownership, entitlement, limits, status transitions, and
audit remain transactional.

## Required Stage 1 Jobs

Jobs must be idempotent and safe to retry.

The first three jobs are calendar-domain jobs. The remaining jobs are required
maintenance and retention jobs.

### Weekly Occurrence Generation

- Evaluate each active series in its own IANA timezone.
- Every Sunday at local 00:00, generate and publish the following
  Monday-through-Sunday occurrences.
- On series activation, generate and publish eligible remaining dates in the
  current local week.
- Rely on `UNIQUE (event_series_id, series_local_date)` for idempotency.

### Event Completion

- Complete published events at `ends_at`.
- If `ends_at` is null, complete six hours after `starts_at`.
- Never complete cancelled events.

### Event Archival

- Set `archived_at` for completed or cancelled events after 12 months.
- Use `ends_at`, or `starts_at` when no end exists.
- Never physically delete events.

### Invitation Expiration

- Mark pending invitations expired after `expires_at`.
- Delete terminal invitation rows 30 days after acceptance, revocation, or
  expiry without copying invited email into audit metadata.

### Premium Asset Removal

- Expire entitlements when their `ends_at` passes.
- When entitlement is lost, mark applicable assets `pending_removal` and set
  `remove_after = now() + interval '30 days'`.
- Restore eligible assets if entitlement returns during grace.
- At expiry, remove Storage objects and mark rows `removed`.
- Event rendering falls back to platform banners.

### Account Anonymization

- After the 30-day deletion grace period, anonymize eligible accounts.
- Never anonymize the final active owner of an active store.

### Audit Retention

- Delete or irreversibly anonymize expired audit records according to their
  retention class.
- Audit retention execution.

## Supabase Storage

Use separate buckets or equivalent policy boundaries:

- Platform banners: public optimized files, platform-admin writes only.
- Store media sources: private, trusted processing access only.
- Store logo optimized variants: public read, authorized owner/admin upload
  workflow only.
- Custom event banner optimized variants: public read, authorized owner/admin
  upload workflow only.

Do not trust client-provided MIME type, byte size, dimensions, ownership, or
optimized output. Validate in a trusted process.

## Stage 1 Acceptance Criteria

Implementation is ready for Stage 1 when:

1. Visitors can browse and filter upcoming events by game, date, city, store,
   and Online.
2. Public URLs use stable slugs and past published event links still resolve.
3. An adult authenticated operator can create and activate a store without
   manual approval.
4. Owners can invite owners, admins, and staff; admins can invite admins and
   staff without granting broader scope.
5. Branch-scoped access cannot read or mutate another branch's operational
   data.
6. Stores can operate with zero, one, or multiple branches.
7. Owners and admins can publish one-time and weekly recurring events within
   scope.
8. Series activation and Sunday generation produce no duplicate occurrences.
9. Events support disabled or explicit HTTPS external registration only.
10. External registration never stores participants or counts.
11. Free platform banners always provide a valid fallback.
12. Stores can upload, optimize, display, replace, and remove public logos.
13. Pilot tester stores can upload and select validated custom event banners.
14. After official launch, losing entitlement removes custom event-banner media after grace without breaking event
    pages.
15. Owner-only immediate closure cancels future published events through an
    auditable batch.
16. RLS prevents cross-store and cross-branch access.
17. Critical Stage 1 actions create allowlisted append-only audit records.
18. No excluded Stage 1 tables or internal-registration columns exist.

## Before Production

- Finalize and legally review the exact `minimum_age_declaration` text and
  initial version identifier.
- Legally review audit retention periods.
- Seed at least one active global platform banner and active defaults for
  supported games.
- Verify IANA timezone and ISO currency/country validation strategy.
- Test every RLS policy and privileged RPC with visitor, owner, admin, staff,
  suspended-user, suspended-store, and platform-role scenarios.
- Test jobs across daylight-saving timezone transitions.
- Verify invitation and Storage secrets never enter logs or audit metadata.
