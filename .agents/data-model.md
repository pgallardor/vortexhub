# VortexHub PostgreSQL Data Model

For Stage 1 implementation, use `.agents/stage-1-data-model.md` as the physical
schema source of truth. This document also preserves accepted later-stage
boundaries.

## Delivery Boundary

Implement the model in stages.

MVP Stage 1 creates only the tables and functions required for store-operator
authentication, legal acceptance, stores, memberships and invitations,
entitlements, optional branches, games, store visual identity media, banners,
event series, events, cancellation batches, and audit.

Every Stage 1 operator requires an active `user_account` with acceptance of the
current `minimum_age_declaration` before performing store actions.

Do not create player profiles, player tags, nickname history, player QR
credentials, guardianships, internal event registrations, registration
transitions, or their workflows during Stage 1. Preserve their accepted model
definitions below for later implementation.

Stage 1 events use only `registration_mode = 'external'` or `'disabled'`.
Internal mode and capacity-related fields become active only in the later
internal-registration stage.

Use `disabled` as the Stage 1 default. Use `external` only with a valid external
registration URL. The initial Stage 1 event and series tables omit internal
registration windows and capacity columns; add them through a later migration
when internal registration is implemented.

Stage 1 external registration URLs require HTTPS. Public pages display an
explicit external-registration action and indicate that it leaves VortexHub;
do not redirect automatically. Owners and authorized admins may edit the URL
within scope. Do not store external participants or counts.

Stage 1 includes `platform_event_banners`, `store_media_assets`, store logo
uploads, and custom event banners. Custom event banners are open to tester
stores during pilot and become controlled by manually managed
`custom_event_banners` entitlements after official launch, including Storage
validation, optimized variants, fallback, post-launch grace-period removal for
premium event banners, and moderation workflows.

Stage 1 also implements store memberships, invitations, store or branch scope,
branch assignments, and last-owner protection. During Stage 1, owners manage
the full store domain, admins manage branches, series, and events within scope,
store-wide admins manage store logo and custom banner uploads/removal, and
staff are read-only within scope.

Do not defer invitations, staff, or branch-scoped memberships from Stage 1;
they are required to validate multi-operator and multi-branch store use.

Do not create `user_notifications` during Stage 1. Implement notifications with
the later internal-registration stage.

Stage 1 email is limited to Supabase Auth and delivery of store-membership
invitation links. Do not send event, activity, lifecycle, or marketing email.

Do not create `store_closure_plans` or `branch_closure_plans` during Stage 1.
Stage 1 uses owner-only immediate closure with a minimal affected-event preview,
lifecycle-state update, and auditable bulk cancellation of future events.

Stage 1 audit events cover store lifecycle, ownership and membership changes,
invitations, branch lifecycle, event and series publication/date/time
changes/cancellation, premium banner operations and moderation, and entitlement
changes. Do not audit every minor title or description edit.

Stage 1 implements separate platform roles for global administration and
moderation. Platform-role assignment is internal-only and audited.

Stage 1 weekly series support one or more ISO weekdays. Generate and publish the
next Monday-through-Sunday occurrences every Sunday in the series timezone.
Occurrence edits are independent, series edits affect only dates not yet
generated, and ending a series stops generation without altering generated
occurrences. Do not implement series pause or special bulk
deletion/cancellation during Stage 1.

Activating a series immediately generates and publishes every eligible
remaining occurrence in the current local week. The next Sunday job generates
the following week. Both paths are idempotent and rely on series/date
uniqueness.

Stage 1 calendar-domain jobs include event auto-completion, weekly occurrence
generation, and 12-month logical archival. Required maintenance jobs handle
invitation expiry, premium-asset grace removal, account anonymization, and audit
retention. Do not physically delete archived events.

## Conventions

- Primary keys: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- Mutable domain tables: `created_at timestamptz NOT NULL DEFAULT now()` and
  `updated_at timestamptz NOT NULL DEFAULT now()`.
- Soft-deletable tables: `deleted_at timestamptz NULL`.
- Store all timestamps in UTC and use store or branch timezones only for display.
- Prefer `varchar` plus `CHECK` constraints for evolving states.
- Maintain `updated_at` with a shared database trigger.
- Generate public slugs from visible names, resolve collisions with short random
  suffixes, and freeze them after first publication or public activation.
- Enable RLS on every table in an exposed schema. Use constraints for persisted
  invariants and transactional RPC functions for multi-row domain operations.

## Supabase Access Model

Direct client reads protected by RLS:

- Public active stores, active branches, games, published event series, and
  published events.
- An authenticated user's own permitted account, player profile, and
  registration data.
- Store operational data permitted by the caller's active membership role and
  explicit store or branch scope.

Relevant domain writes and sensitive operations use explicitly authorized
transactional PostgreSQL RPC functions. Tables containing QR credentials, audit
events, legal evidence, registration transitions, closure plans, and
cancellation batches do not allow general direct client access.

Use `auth.uid()` only as caller identity and read current memberships and branch
assignments from domain tables. Use `security invoker` functions by default.
Restrict and test every `security definer` function, set a safe `search_path`,
and use schema-qualified relations. Never expose secret or service-level
Supabase keys to clients.

## Identity

### `user_accounts`

VortexHub domain record for an identity authenticated by Supabase Auth.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK/FK | Same UUID as `auth.users.id` |
| `display_name` | varchar(120) | Account-level display name |
| `status` | varchar(30) | `pending`, `active`, `suspended` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz nullable | |

Supabase Auth owns credentials, email, email verification, sessions, and account
recovery. Do not store password hashes or use authentication-provider metadata
as the source of truth for domain authorization.

Account deletion soft-deletes and deactivates this record, revokes Supabase Auth
access, disables memberships, and anonymizes visible domain data after the
30-day grace period. Access remains disabled during that period. Preserve the
internal identifier for required historical relationships.

### `player_profiles`

Global player identity, separate from authentication.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | Internal identifier |
| `user_account_id` | uuid FK nullable | Unique when present |
| `nickname` | varchar(40) | Public-facing name, minimum 2 characters |
| `player_tag` | char(6) | Globally unique random immutable disambiguator |
| `avatar_storage_path` | text nullable | Private source in Supabase Storage |
| `avatar_optimized_storage_path` | text nullable | Square optimized WebP variant |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz nullable | |

A profile must have either its own `user_account_id` or at least one verified
guardian relationship. Enforce this through the service layer because it spans
multiple tables and may require a deferred workflow.

For the adult-only MVP, every player profile must belong to an active
authenticated account. Do not collect legal names, birth date, birth year, age
category, or other restricted logistics data.

Create a profile lazily when an active authenticated account first initiates a
player action such as self-registration or opening a personal QR. Create the
profile and first QR credential transactionally, then resume the original
action. Store-only operators do not require player profiles.

Nicknames are not unique and are not verified identity. Generate a globally
unique random immutable `player_tag` for each profile. The tag does not expose
the UUID, authorize actions, replace QR, or support public player lookup. Show
nickname and tag together only where an authorized operator needs to
disambiguate players.

Generate tags from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, retry on uniqueness
collision, and enforce:

```sql
CHECK (player_tag ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$')
```

Tags are not editable.

Players may change nickname once every 30 days. VortexHub moderation may apply
an immediate audited change. Previous nicknames are not public or permanently
reserved.

Player avatars are optional. Allow JPEG, PNG, and WebP source uploads up to 2
MB with minimum dimensions of 256 by 256 pixels and generate a square optimized
WebP variant. Authorized store contexts may access only the optimized variant,
never the source. VortexHub may remove avatars through audited moderation.
Delete avatar media after the account-deletion 30-day grace period.

### `player_nickname_changes`

Internal temporary history for impersonation and abuse investigation.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `player_profile_id` | uuid FK | |
| `previous_nickname` | varchar(40) | |
| `new_nickname` | varchar(40) | |
| `changed_by_account_id` | uuid FK nullable | Null for internal moderation process |
| `reason` | varchar(30) | `player`, `moderation` |
| `changed_at` | timestamptz | |
| `created_at` | timestamptz | |

This table has no store or general client access. Retain entries for 12 months,
then delete or irreversibly anonymize them through the auditable retention
process.

Deletion soft-deletes the profile, revokes its QR credentials, and later
anonymizes `nickname` and `avatar_url` after the 30-day grace period. Preserve
its internal identifier and historical relationships. An anonymized profile
cannot be reclaimed or attached to a newly created account.

### `legal_document_versions`

Immutable versions of legal declarations and agreements presented by
VortexHub.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `document_key` | varchar(80) | Stable identifier such as `minimum_age_declaration` |
| `version` | varchar(60) | Human-readable immutable version |
| `content_hash` | text | Hash of the exact presented content |
| `published_at` | timestamptz | |
| `created_at` | timestamptz | |

Required uniqueness:

```sql
UNIQUE (document_key, version)
```

### `legal_acceptances`

Append-only evidence that an authenticated account accepted a specific legal
document version.

| Column | Type | Notes |
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

The MVP requires acceptance of the current `minimum_age_declaration` before a
`user_account` becomes active. These records are immutable and are not soft
deleted. Retain acceptances and their referenced document versions permanently
as evidence.

### `player_guardianships`

Allows authenticated adults to manage dependent minor profiles.

Future update only. Do not create this table or enable dependent player profiles
in the MVP launch. Preserve this proposed boundary for implementation after
legal review.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `guardian_account_id` | uuid FK | Authenticated guardian |
| `player_profile_id` | uuid FK | Dependent player |
| `relationship` | varchar(30) | `parent`, `guardian`, `caregiver`, `other` |
| `status` | varchar(30) | `pending`, `verified`, `revoked` |
| `consented_at` | timestamptz nullable | |
| `consent_version` | varchar(60) nullable | Immutable accepted version |
| `revoked_at` | timestamptz nullable | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Recommended uniqueness:

```sql
UNIQUE (guardian_account_id, player_profile_id)
```

### `player_qr_credentials`

Rotatable opaque identifiers used only within authorized actions.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | Internal identifier |
| `player_profile_id` | uuid FK | |
| `token_hash` | text | Deterministic hash of a high-entropy opaque secret |
| `status` | varchar(20) | `active`, `revoked` |
| `issued_at` | timestamptz | |
| `revoked_at` | timestamptz nullable | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Only one active QR credential should exist per player. The plaintext secret is
shown to the player in the QR but is never persisted or logged. Scanning the
secret must never grant authorization or return a public player profile.

Contextual QR resolution for event registration returns only optimized avatar,
nickname, player tag, current registration state for the event, and currently
authorized actions. It never returns email, internal UUIDs, multi-store history,
other events, memberships, complete profile data, or future point information.
The result is short-lived, event-and-action scoped, non-navigable, and audited.

Active authenticated players may rotate their QR at most once every five
minutes. Rotation atomically revokes the previous credential and creates a new
one. Signing out or changing nickname does not rotate QR. Account suspension,
deletion, or anonymization revokes active credentials. Audit rotation without
storing secrets or token hashes.

MVP QR resolution requires backend connectivity. Do not embed readable player
identity or offline-verifiable profile data in QR, and do not cache player
identities for offline resolution. Connectivity failure must fail safely and
permit a later retry.

Do not store a mutable player `last_scanned_at`, create attendance from QR
resolution, or infer attendance from QR-assisted registration. Audit only the
explicit contextual action. Future `event_attendances` remain separate and
cannot be backfilled by inference from prior scans or registrations.

## Stores

### `platform_roles`

Internal platform authority, independent of store memberships.

| Column | Type | Notes |
| --- | --- | --- |
| `user_account_id` | uuid PK/FK | |
| `role` | varchar(30) | `platform_admin`, `platform_moderator` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

`platform_admin` manages games, platform banners, entitlements, store
suspension and restoration, moderation, and platform-role assignment.
`platform_moderator` moderates custom banner content only. Assignment is
available only through a secure internal operation. All changes and actions are
audited.

### `stores`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `name` | varchar(160) | |
| `slug` | varchar(160) | Public identifier |
| `description` | text nullable | |
| `logo_url` | text nullable | |
| `timezone` | varchar(60) | IANA timezone |
| `status` | varchar(30) | `pending`, `active`, `suspended`, `closed` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz nullable | |

Pending stores are not public. Suspended stores retain public historical pages
but block new registrations and store operations. Closed stores retain history
but block new activity. `closed` is terminal during the MVP. Suspensions may be
reversed only through an audited VortexHub administrative action.

Stores may activate without branches and publish custom-location or online
events. Branch-location events require an active branch.

Pending stores activate through an audited owner action after validating name,
globally unique slug, IANA timezone, at least one active owner, and the acting
owner's active account and current adult-age declaration. Logo and description
are optional. Manual VortexHub approval is not required during the MVP.

### `store_closure_plans`

Scheduled two-phase owner-requested closure of a store.

Later stage only. Do not create this table during Stage 1.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `store_id` | uuid FK | |
| `effective_at` | timestamptz | Closure boundary |
| `reason` | text nullable | |
| `status` | varchar(30) | `scheduled`, `cancelled`, `executed` |
| `created_by_account_id` | uuid FK | Owner who scheduled closure |
| `cancelled_by_account_id` | uuid FK nullable | |
| `cancelled_at` | timestamptz nullable | |
| `executed_at` | timestamptz nullable | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Only one `scheduled` closure may exist per store. Only owners may schedule,
cancel, or execute a closure early. Execution closes the store, marks branches
inactive, ends active series, cancels future events through auditable batches,
and disables operational memberships. Preserve historical records.

### `store_memberships`

Associates authenticated accounts with stores.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `store_id` | uuid FK | |
| `user_account_id` | uuid FK | |
| `role` | varchar(30) | `owner`, `admin`, `staff` |
| `scope` | varchar(30) | `store`, `branches` |
| `status` | varchar(30) | `invited`, `active`, `disabled` |
| `invited_at` | timestamptz nullable | |
| `accepted_at` | timestamptz nullable | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz nullable | |

The MVP does not collect restricted player logistics data. If such data is
introduced in a future update, only `owner` receives access by default.

Owners must use `scope = 'store'`. Admins and staff may use either scope.
An active membership with `scope = 'branches'` must have at least one active
branch assignment. Enforce changes that span assignments and membership status
transactionally.

Every active store must have at least one active owner. Block leaving,
demotion, membership disablement, and account deletion when they would remove
the final active owner. Owner additions and removals require an authorized owner
action and an audit record.

MVP permissions are fixed by role and membership scope. Owners manage the whole
store. Admins manage branches and events and may perform QR-assisted
registration within scope, but cannot manage owners or cancel registrations.
Staff may view operational event information, perform QR-assisted registration,
manually cancel registrations, and approve or reject reinstatement requests
within scope, but cannot create or edit events or branches.

### `store_membership_invitations`

Expiring invitation to create or activate a store membership.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `store_id` | uuid FK | |
| `email_normalized` | citext | Intended verified Supabase Auth email |
| `role` | varchar(30) | `owner`, `admin`, `staff` |
| `scope` | varchar(30) | `store`, `branches` |
| `token_hash` | text | Hash of a high-entropy opaque token |
| `status` | varchar(30) | `pending`, `accepted`, `revoked`, `expired` |
| `invited_by_account_id` | uuid FK | |
| `expires_at` | timestamptz | Seven days after creation |
| `accepted_by_account_id` | uuid FK nullable | |
| `accepted_at` | timestamptz nullable | |
| `revoked_at` | timestamptz nullable | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Branch-scoped invitations require associated intended branch assignments
validated against the inviter's scope. Owners may invite any role; admins may
invite only admins and staff with scope they are authorized to grant.

Acceptance requires authentication with the same verified email. Never persist
or log the plaintext token, create an account automatically, or reveal whether
the invited email already has an account. Invitation creation, revocation, and
acceptance are audited.

Deliver the plaintext invitation link by email without persisting it. This is
the only VortexHub product email used during Stage 1.

### `store_membership_invitation_branches`

Intended branch assignments for a branch-scoped invitation.

| Column | Type | Notes |
| --- | --- | --- |
| `invitation_id` | uuid FK | |
| `branch_id` | uuid FK | Active branch in the invitation's store |
| `created_at` | timestamptz | |

Required uniqueness:

```sql
UNIQUE (invitation_id, branch_id)
```

A `branches`-scoped invitation requires at least one intended active branch; a
`store`-scoped invitation must have none. Acceptance creates membership and
assignments atomically. If an intended branch becomes ineligible before
acceptance, reject acceptance until the invitation is corrected or replaced.

### `store_entitlements`

Store-scoped authorization for premium product capabilities.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `store_id` | uuid FK | |
| `feature` | varchar(80) | `custom_event_banners` initially |
| `status` | varchar(30) | `active`, `expired`, `revoked` |
| `starts_at` | timestamptz | |
| `ends_at` | timestamptz nullable | |
| `granted_by_account_id` | uuid FK nullable | VortexHub administrator |
| `source` | varchar(30) | `manual`, `external_billing` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

During the MVP, VortexHub administrators manage entitlements manually. During
pilot, tester stores should receive active custom-banner access by default. At
official launch, relevant custom-banner actions verify an active entitlement at
execution time. Do not store payment or subscription transactions.

### `branches`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `store_id` | uuid FK | |
| `name` | varchar(160) | |
| `slug` | varchar(160) | Unique within active store branches |
| `address_line` | text nullable | |
| `city` | varchar(120) nullable | |
| `region` | varchar(120) nullable | |
| `country_code` | char(2) | ISO country code |
| `latitude` | numeric(9,6) nullable | |
| `longitude` | numeric(9,6) nullable | |
| `timezone` | varchar(60) nullable | Overrides store timezone |
| `status` | varchar(30) | `draft`, `active`, `inactive` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz nullable | |

Add `UNIQUE (id, store_id)` so events can enforce branch ownership with a
composite foreign key.

Coordinates are reserved for future geospatial discovery. MVP public calendar
filters use game, date, city, and store only; do not implement radius search,
distance ordering, user geolocation, or maps.

Draft branches are not public and cannot host published events. Inactive
branches remain available only for historical context. Owner-only reactivation
requires auditing and does not restore series, cancelled events, or previous
staff assignments.

After first activation, branch name, slug, address, city, region, country,
coordinates, and timezone are immutable. Moving or materially renaming a branch
requires closing it and creating a new branch. Historical and future events
remain attached to the original branch unless explicitly reassigned under their
normal event-edit rules.

### `branch_closure_plans`

Scheduled two-phase closure of a branch.

Later stage only. Do not create this table during Stage 1.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `branch_id` | uuid FK | |
| `effective_at` | timestamptz | Closure boundary |
| `reason` | text nullable | |
| `status` | varchar(30) | `scheduled`, `cancelled`, `executed` |
| `created_by_account_id` | uuid FK | Owner who scheduled closure |
| `cancelled_by_account_id` | uuid FK nullable | |
| `cancelled_at` | timestamptz nullable | |
| `executed_at` | timestamptz nullable | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Only one `scheduled` closure may exist per branch. Only owners may schedule,
cancel, or execute a closure early. Scheduling must present a preview of
affected series, events, and registrations.

While a closure is scheduled, block creating, publishing, moving, or generating
events at or after `effective_at`. At execution, atomically mark the branch
inactive, end active series at the boundary, and cancel affected events through
an auditable cancellation batch.

The MVP does not support reassigning affected events or series to another
branch. Replacement activity must be created separately at an active branch.

### `branch_membership_assignments`

Optional branch scope for store memberships.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `store_membership_id` | uuid FK | |
| `branch_id` | uuid FK | Must belong to the membership's store |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Required uniqueness:

```sql
UNIQUE (store_membership_id, branch_id)
```

Add `UNIQUE (id, store_id)` to `store_memberships` and include `store_id` in
this table so a composite foreign key can guarantee that the membership and
branch belong to the same store:

```sql
(store_membership_id, store_id) REFERENCES store_memberships(id, store_id)
(branch_id, store_id) REFERENCES branches(id, store_id)
```

Assignments apply only to memberships with `scope = 'branches'`. Removing the
last assignment from an active branch-scoped membership must be rejected or
atomically disable the membership.

A branch-scoped membership cannot become active without at least one assignment
to an active branch.

## Events

### `games`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `name` | varchar(120) | |
| `slug` | varchar(120) | Public identifier |
| `publisher` | varchar(120) nullable | |
| `is_active` | boolean | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Seed at least:

- `Miscelaneo`: deliberately multigame or open-play events.
- `Otros`: a specific game not yet represented in the catalog.

Only VortexHub administrators manage this catalog. Inactive games remain valid
for historical references but cannot be selected for new events or series.

### `platform_event_banners`

VortexHub-managed public banner catalog available to all stores.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `game_id` | uuid FK nullable | Optional default association |
| `name` | varchar(160) | |
| `storage_path` | text | Supabase Storage object path |
| `status` | varchar(30) | `active`, `inactive` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `store_media_assets`

Store-owned visual identity media stored in Supabase Storage.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `store_id` | uuid FK | Owning store |
| `uploaded_by_account_id` | uuid FK | Owner or admin |
| `asset_type` | varchar(30) | `store_logo`, `event_banner` |
| `source_storage_path` | text | Private source object |
| `optimized_storage_path` | text | Generated public WebP variant |
| `mime_type` | varchar(120) | Validated allowlisted type |
| `width` | integer | |
| `height` | integer | |
| `status` | varchar(30) | `active`, `pending_removal`, `removed` |
| `remove_after` | timestamptz nullable | Premium-loss grace deadline |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz nullable | |

Store logo upload is a core Stage 1 capability and does not require premium
entitlement. Custom event-banner upload and selection are open to tester stores
during pilot and require current premium entitlement after official launch.
Files must pass type, dimension, size, and store-ownership validation. Losing
the entitlement after launch marks event-banner assets for removal after a
30-day grace period. Past event references do not block removal; clients fall
back to the applicable platform banner when a referenced custom event banner is
unavailable.

Allow JPEG, PNG, and WebP sources up to 5 MB. Store logos require at least 256
by 256 pixels and generate a square optimized WebP variant. Event banners
require at least 1200 by 675 pixels and a recommended 16:9 aspect ratio, then
generate an optimized WebP calendar/detail variant. Limit each store to one
current public logo and 20 active custom event-banner assets. Owners and
store-wide admins may upload or remove store visual media. VortexHub
administrators may remove inappropriate content through an audited moderation
action.

### `event_series`

Weekly recurring event templates. These are not registration or attendance
targets; each generated occurrence is stored in `events`.

Each series and generated event has exactly one representative organizing
`store_id`. Do not implement multi-store ownership or co-administration. Future
collaboration metadata must not change the representative store's ownership,
authorization, registration, audit, or point scope.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `store_id` | uuid FK | Organizing store |
| `branch_id` | uuid FK nullable | Must belong to `store_id` |
| `game_id` | uuid FK | Exactly one game |
| `other_game_name` | varchar(120) nullable | Required only when game is `Otros` |
| `created_by_account_id` | uuid FK | |
| `slug` | varchar(180) | Public series identifier, unique within store |
| `title` | varchar(180) | |
| `description` | text nullable | |
| `format_name` | varchar(120) nullable | |
| `status` | varchar(30) | Stage 1: `draft`, `active`, `ended`; `paused` later |
| `weekdays` | smallint[] | ISO weekdays, values `1` through `7` |
| `local_start_time` | time | Wall-clock start time |
| `duration_minutes` | integer nullable | |
| `timezone` | varchar(60) | IANA timezone used for generation |
| `starts_on` | date | First eligible local date |
| `ends_on` | date nullable | Last eligible local date |
| `registration_mode` | varchar(20) | Default for generated events |
| `external_registration_url` | text nullable | Default for generated events |
| `registration_opens_before` | interval nullable | Default relative offset |
| `registration_closes_before` | interval nullable | Default relative offset |
| `capacity` | integer nullable | Default for generated events |
| `entry_fee_amount` | numeric(12,2) nullable | Informational default |
| `entry_fee_currency` | char(3) nullable | |
| `location_mode` | varchar(20) | `branch`, `custom`, `online` |
| `location_text` | text nullable | Required for `custom` and `online` |
| `location_city` | varchar(120) nullable | Required for `custom` |
| `location_region` | varchar(120) nullable | Optional for `custom` |
| `location_country_code` | char(2) nullable | Required for `custom` |
| `banner_mode` | varchar(20) | `platform`, `custom` |
| `platform_banner_id` | uuid FK nullable | Required for platform selection |
| `custom_banner_asset_id` | uuid FK nullable | Required for custom selection |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz nullable | |

Use `(branch_id, store_id) REFERENCES branches(id, store_id)`. Validate weekday
values, positive duration, registration mode, external URL coherence, date
range, capacity, fee fields, location coherence, and `other_game_name` with
database constraints.

Require exactly one banner reference matching `banner_mode`. Custom selection
requires an active asset owned by the same store. During pilot, tester stores
may select custom assets without premium entitlement; after official launch,
current premium entitlement is required.

### `events`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `event_series_id` | uuid FK nullable | Source template for generated occurrence |
| `series_local_date` | date nullable | Scheduled local date used for idempotency |
| `is_series_exception` | boolean | True after an individual occurrence edit |
| `store_id` | uuid FK | Organizing store |
| `branch_id` | uuid FK nullable | Must belong to `store_id` |
| `game_id` | uuid FK | Exactly one game |
| `other_game_name` | varchar(120) nullable | Required only when game is `Otros` |
| `created_by_account_id` | uuid FK | |
| `slug` | varchar(180) | Public identifier, unique within the store |
| `title` | varchar(180) | |
| `description` | text nullable | |
| `format_name` | varchar(120) nullable | |
| `status` | varchar(30) | `draft`, `published`, `cancelled`, `completed` |
| `registration_mode` | varchar(20) | `internal`, `external`, `disabled` |
| `external_registration_url` | text nullable | Required only for `external` |
| `registration_opens_at` | timestamptz nullable | |
| `registration_closes_at` | timestamptz nullable | |
| `starts_at` | timestamptz | |
| `ends_at` | timestamptz nullable | |
| `capacity` | integer nullable | Enforced only for internal registration |
| `entry_fee_amount` | numeric(12,2) nullable | Informational in MVP |
| `entry_fee_currency` | char(3) nullable | |
| `location_mode` | varchar(20) | `branch`, `custom`, `online` |
| `location_text` | text nullable | Required for `custom` and `online` |
| `location_city` | varchar(120) nullable | Required for `custom` |
| `location_region` | varchar(120) nullable | Optional for `custom` |
| `location_country_code` | char(2) nullable | Required for `custom` |
| `banner_mode` | varchar(20) | `platform`, `custom` |
| `platform_banner_id` | uuid FK nullable | Snapshotted platform selection |
| `custom_banner_asset_id` | uuid FK nullable | Snapshotted store asset |
| `published_at` | timestamptz nullable | |
| `cancelled_at` | timestamptz nullable | |
| `cancelled_by_account_id` | uuid FK nullable | |
| `cancellation_message` | varchar(240) nullable | Required when cancelling published event |
| `cancellation_batch_id` | uuid FK nullable | |
| `archived_at` | timestamptz nullable | Operational archive marker |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz nullable | |

Important checks:

```sql
CHECK (ends_at IS NULL OR ends_at > starts_at)
CHECK (capacity IS NULL OR capacity > 0)
CHECK (entry_fee_amount IS NULL OR entry_fee_amount >= 0)
CHECK (
  (entry_fee_amount IS NULL AND entry_fee_currency IS NULL)
  OR
  (entry_fee_amount IS NOT NULL AND entry_fee_currency IS NOT NULL)
)
CHECK (registration_opens_at IS NULL OR registration_opens_at < starts_at)
CHECK (registration_closes_at IS NULL OR registration_closes_at <= starts_at)
CHECK (
  registration_opens_at IS NULL
  OR registration_closes_at IS NULL
  OR registration_opens_at < registration_closes_at
)
CHECK (
  (registration_mode = 'external' AND external_registration_url IS NOT NULL)
  OR
  (registration_mode <> 'external' AND external_registration_url IS NULL)
)
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

Use `(branch_id, store_id) REFERENCES branches(id, store_id)` to prevent events
from referencing another store's branch.

Require `other_game_name` when `game_id` references `Otros`; reject it for all
other games, including `Miscelaneo`. New events and series cannot reference an
inactive game.

For `custom` and `online`, an optional `branch_id` represents the organizing
branch. When `branch_id` is null, only active store-wide memberships may operate
the event.

Calendar city filtering uses the branch city for `branch`, the explicitly
stored city for `custom`, and a special `Online` filter for `online`. Stores do
not have a single city.

For internal events, null `registration_opens_at` means publication time and
null `registration_closes_at` means `starts_at`. Do not permit registrations
after `starts_at`. Players may cancel their own registration. While registration
remains open, a cancelled player may request reinstatement; authorized staff
within event scope or store owners may approve it subject to current capacity,
or reject it.

Generated events snapshot their series defaults. Editing an occurrence does not
mutate `event_series`. Require both `event_series_id` and `series_local_date` to
be null or both non-null. Prevent duplicate generation with:

```sql
UNIQUE (event_series_id, series_local_date)
```

Generated occurrence slugs use `{series-slug}-{YYYY-MM-DD}`, based on
`series_local_date`, with the standard short random suffix applied only on
collision.

Generate and publish occurrences idempotently every Sunday at 00:00 in each
series' timezone for the following Monday-through-Sunday week. Historical
events remain durable records; `archived_at` hides completed history from
operational interfaces without deleting it. During the MVP, automatically set
`archived_at` for completed or cancelled events 12 months after `ends_at`, or
after `starts_at` when `ends_at` is null.

Public calendar queries include only future and currently active events.
Published past and archived events remain resolvable by direct slug route with
basic event information and lifecycle state, no occupancy or registration data,
and the applicable platform banner fallback. Do not provide a public historical
event explorer during the MVP.

After the first registration exists, `store_id`, `game_id`, and
`registration_mode` are immutable. Time, branch, capacity, and fee changes
require explicit confirmation and auditing. Capacity cannot be reduced below
the number of confirmed registrations. Cancellation preserves registrations.
Series updates must not overwrite occurrences with dependent activity.

Cancelling a published event requires `cancellation_message`; drafts may omit
it. The message remains visible on the direct historical event page. Immediate
store or branch closure supplies one public message to every affected published
future event. Keep internal audit context separate.

Editing an occurrence sets `is_series_exception = true` and never changes its
series. Ending a series stops generation, deletes only future draft occurrences
without activity, and cancels future published occurrences or occurrences with
activity through an auditable cancellation batch. Pausing stops generation
without cancelling existing occurrences.

Entry fees are informational. Zero explicitly means free; null amount and
currency mean no fee was provided. Do not store payments, discounts, collection
status, or refunds during the MVP.

Generated occurrences snapshot the series banner. Editing an occurrence banner
does not change the series. After premium loss, new events and occurrences use a
platform banner and custom assets are removed after the 30-day grace period.
Past events fall back to the applicable platform banner when their custom asset
is unavailable. Custom assets must belong to the event's store.

Published events complete automatically at `ends_at`, or six hours after
`starts_at` when no end time exists. Owners and authorized admins may complete
an event early through an audited action. Staff cannot change event lifecycle
state. Cancelled events never become completed. Completion does not imply
attendance, registration outcome, points, rewards, or payment status.

### `event_cancellation_batches`

Auditable context for one bulk event cancellation operation.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `store_id` | uuid FK | |
| `branch_id` | uuid FK nullable | |
| `source` | varchar(30) | `branch_closure`, `store_closure` |
| `public_message` | varchar(240) | Applied to affected published events |
| `internal_reason` | text nullable | Audit-only operational context |
| `created_by_account_id` | uuid FK | |
| `created_at` | timestamptz | |

Branch-closure execution links every affected event to one cancellation batch.
Cancellation batches are immutable and do not use soft delete.

### `event_registrations`

Source of truth only for events with `registration_mode = 'internal'`.
Do not create registrations or store participant counts for external events.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `event_id` | uuid FK | |
| `player_profile_id` | uuid FK | |
| `status` | varchar(30) | `confirmed`, `cancelled`, `reinstatement_requested` |
| `channel` | varchar(30) | `self_service`, `staff_qr` |
| `registered_by_account_id` | uuid FK | Actor that performed registration |
| `registered_at` | timestamptz | |
| `cancelled_at` | timestamptz nullable | |
| `reinstatement_requested_at` | timestamptz nullable | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Required uniqueness:

```sql
UNIQUE (event_id, player_profile_id)
```

Capacity consumption must be performed atomically in a transaction. When a
defined capacity is full, reject new registration and reinstatement approval
attempts. Cancelling a confirmed registration immediately releases one slot for
a later registration or approval. Reinstatement requests do not consume
capacity. A null event capacity means unlimited capacity.

Manual cancellation selects an existing registration from the event's
operational list and does not require a fresh QR scan. Only authorized staff
within event scope and store owners may perform it. Admins cannot cancel
registrations. Store cancellation requires `duplicate`, `invalid_registration`,
or `other`; `other` may include a brief internal note not shown to the player.
Insert the immutable transition and audit event in the same transaction.

For active internal events with defined capacity, public calendar views may
derive an occupancy progress bar from confirmed registrations divided by
capacity and show the exact aggregate count, such as `16 of 20 occupied`. Do not
store editable occupancy counters. Do not show occupancy bars for unlimited,
external-registration, disabled-registration, cancelled, or completed events.
Public views must never expose participant identities or registration records.
Exact eligibility is determined atomically during registration.

For `self_service`, `registered_by_account_id` must own the registered player
profile. For `staff_qr`, the actor must have an active authorized membership for
the event's store and branch, and the action must originate from a contextual
scan of the player's active QR. QR-assisted registrations must be recorded in
`audit_events`.

An operator may scan their own QR; record `staff_qr` when using the operational
flow and `self_service` when using the player flow. Store role never bypasses
capacity, registration windows, or other registration rules.

Registrations are retained while their event exists and are not automatically
deleted during the MVP.

A cancelled player may request reinstatement while registration remains open.
Authorized staff within event scope or store owners may approve the request,
transitioning it to `confirmed` according to current capacity and registration
rules, or reject it back to `cancelled`. Admins cannot approve or reject.

Set `reinstatement_requested_at` only while status is
`reinstatement_requested`. On approval, update `registered_at` to the approval
time and clear cancellation and request timestamps. On rejection, clear only
the request timestamp and retain the cancellation timestamp.

At the effective registration close time, transition every remaining
`reinstatement_requested` registration to `cancelled` with transition reason
`registration_closed`. The expiration job is idempotent, clears
`reinstatement_requested_at`, and does not affect capacity.

Do not enforce a numeric cancellation or reinstatement-request limit during the
MVP. Operators use the immutable transition history when deciding whether to
approve repeated requests.

Authorized staff and owners deciding reinstatement may read only the transition
history for the target registration in the current event. Do not expose
cross-event or cross-store registration behavior.

After rejection, the player may submit another reinstatement request while
registration remains open. Each request and decision creates a separate
immutable transition.

Reinstatement rejection requires `no_capacity`, `registration_closed`,
`repeated_changes`, or `other`. Only `other` may include an internal note.
Players see the structured rejection reason but not the note.

If an approval attempt loses a concurrent capacity race, do not change the
pending request. The operator may explicitly reject it with `no_capacity` or
leave it pending while registration remains open.

### `event_registration_transitions`

Append-only history of registration state changes.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `event_registration_id` | uuid FK | |
| `from_status` | varchar(30) nullable | Null only for initial registration |
| `to_status` | varchar(30) | `confirmed`, `cancelled`, `reinstatement_requested` |
| `actor_account_id` | uuid FK | Actor that performed the transition |
| `channel` | varchar(30) | `self_service`, `staff_qr`, `store_operator` |
| `reason` | varchar(30) nullable | Structured reason when required |
| `internal_note` | varchar(240) nullable | Allowed only for store `other` cancellation |
| `occurred_at` | timestamptz | |
| `created_at` | timestamptz | |

Every registration state change must insert one transition in the same
transaction. Transition records are immutable and do not use soft delete.
Self-cancellation does not require a reason. Store cancellation requires
`duplicate`, `invalid_registration`, or `other`; only `other` may include an
internal note. Automatic reinstatement expiration uses `registration_closed`.
Reinstatement rejection uses `no_capacity`, `registration_closed`,
`repeated_changes`, or `other`. Players do not see internal notes.

## Audit

### `user_notifications`

Persistent in-app notifications for authenticated accounts.

Later internal-registration stage only. Do not create this table during Stage
1.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `user_account_id` | uuid FK | Recipient |
| `type` | varchar(80) | Stable notification type |
| `subject_type` | varchar(80) | Related domain resource type |
| `subject_id` | uuid | Related internal identifier |
| `payload` | jsonb | Allowlisted structured rendering data |
| `read_at` | timestamptz nullable | |
| `resolved_at` | timestamptz nullable | Null while grouped action remains pending |
| `group_key` | varchar(180) nullable | Stable recipient-specific grouping key |
| `created_at` | timestamptz | |

Initial types cover store registration cancellation, reinstatement approval or
rejection, event date or time changes, and event cancellation. Location,
capacity, informational fee, title, description, format, and banner changes do
not generate notifications during the MVP. Store structured allowlisted
payloads rather than rendered message copies. Users may read only their own
notifications and mark them as read. Notifications are distinct from audit
events.

Reinstatement requests notify owners and staff authorized for the event branch.
Events without a branch notify owners and store-wide staff. Do not notify
admins. Group repeated pending requests by event and recipient rather than
creating one notification per request.

Grouped reinstatement notifications use a stable event-and-recipient
`group_key`. `read_at` records viewing; `resolved_at` is set automatically when
no pending requests remain. A later request clears `resolved_at` and reopens the
existing group for recipients who remain authorized.

The MVP sends no email, SMS, or push notifications. Create notifications
reliably with the related domain operation, either in the same transaction or
through an idempotent transactional outbox.

Retain notifications for 12 months, then delete them through an idempotent
retention job. Domain facts and audit records remain governed separately.

### `audit_events`

Record sensitive actions such as QR resolution and restricted data access.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `actor_account_id` | uuid FK nullable | |
| `actor_membership_id` | uuid FK nullable | Membership authorizing store action |
| `store_id` | uuid FK nullable | Authorization scope |
| `branch_id` | uuid FK nullable | Authorization scope |
| `action` | varchar(80) | Stable action name |
| `subject_type` | varchar(80) | |
| `subject_id` | uuid nullable | |
| `context_type` | varchar(80) nullable | Operational context type |
| `context_id` | uuid nullable | Operational context identifier |
| `outcome` | varchar(30) | `succeeded`, `denied`, `failed` |
| `request_id` | uuid nullable | Correlates related operations |
| `metadata` | jsonb | Allowlisted shape for the stable action |
| `occurred_at` | timestamptz | |
| `created_at` | timestamptz | |

Audit records are append-only and do not use soft delete. They have no general
client read access. Sensitive denied and failed attempts are audited as well as
successful actions.

Each stable action defines an allowlisted metadata shape. Never store QR secrets
or hashes, authentication tokens, email addresses, or unnecessary personal data
in audit records.

General audit records are retained for 24 months. QR, security, restricted
disclosure, and other sensitive-action audit records are retained for 36
months. At expiry, an auditable retention job must delete or irreversibly
anonymize them. These periods require legal review before production.

## Future Tables

Do not implement until required, but preserve these boundaries:

- `player_guardianships`: guardian-managed dependent profiles, after legal
  review and a complete consent workflow.
- `event_attendances`: separate check-in and attendance fact.
- `point_ledger_entries`: immutable store-scoped positive or negative movements
  for one player, optionally referencing an event or attendance, using
  structured reasons and compensating corrections.
- `reward_redemptions`: reward claims and fulfillment.
- `store_player_settings`: store-specific player preferences or restrictions.
- Structured event logistics requirements and responses, only after defining
  purpose, consent, authorization, disclosure, and retention rules.

Do not add point balances or point-related columns to current MVP tables.
Future balances are derived or cached projections of the immutable ledger.
Points and rewards are strictly scoped to one `store_id`; branches of that store
share the ledger, while other stores cannot view or transfer its points.

## Recommended Indexes

```sql
CREATE UNIQUE INDEX player_profiles_account_active_uq
ON player_profiles (user_account_id)
WHERE user_account_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX player_profiles_player_tag_uq
ON player_profiles (player_tag);

CREATE UNIQUE INDEX player_qr_credentials_token_hash_uq
ON player_qr_credentials (token_hash);

CREATE UNIQUE INDEX player_qr_credentials_one_active_per_player_uq
ON player_qr_credentials (player_profile_id)
WHERE status = 'active';

CREATE UNIQUE INDEX stores_slug_active_uq
ON stores (slug) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX branches_store_slug_active_uq
ON branches (store_id, slug) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX events_slug_active_uq
ON events (store_id, slug) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX event_series_slug_active_uq
ON event_series (store_id, slug) WHERE deleted_at IS NULL;

CREATE INDEX events_public_calendar_idx
ON events (starts_at, game_id)
WHERE status = 'published' AND deleted_at IS NULL;

CREATE INDEX events_store_calendar_idx
ON events (store_id, starts_at)
WHERE deleted_at IS NULL;

CREATE INDEX event_registrations_event_status_idx
ON event_registrations (event_id, status);

CREATE INDEX event_registrations_player_idx
ON event_registrations (player_profile_id, registered_at DESC);

CREATE INDEX store_memberships_account_idx
ON store_memberships (user_account_id)
WHERE deleted_at IS NULL;

CREATE INDEX audit_events_store_occurred_idx
ON audit_events (store_id, occurred_at DESC);
```
