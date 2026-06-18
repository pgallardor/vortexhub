# VortexHub Architecture Decisions

## Accepted Decisions

### ADR-000A: Deliver The MVP In Stages Starting With Publishing Only

**Status:** Accepted

MVP Stage 1 validates store publishing and public calendar adoption without
implementing player identity, QR, or internal registration.

Use `.agents/stage-1-data-model.md` as the consolidated physical implementation
contract for Stage 1.

Stage 1 implements store-operator authentication, store and optional branch
management, events and weekly series, public discovery, external or disabled
registration modes, banners, required audit and RLS, and the scheduled
operational workflows needed by those capabilities.

Every Stage 1 operator must accept the current versioned adult-age declaration
before their VortexHub account becomes active or they perform store actions.

Stage 1 does not create player profiles, player tags, player avatars, QR
credentials, internal event registrations, capacity workflows, occupancy bars,
registration transitions, reinstatement, attendance, points, or rewards.

Stage 1 event registration mode is `disabled` by default. Use `external` only
when the store provides an external registration URL. Do not add internal
registration or capacity columns to the Stage 1 event schema; introduce them in
the later internal-registration migration.

Stage 1 external registration URLs must use HTTPS. Public event pages show an
explicit external-registration action and make clear that the user is leaving
VortexHub; they do not redirect automatically. Owners and authorized admins may
edit the URL within scope. VortexHub stores no external participants or counts.

Platform event banners and premium custom event banners are included in Stage 1
as the initial monetization hypothesis. Stage 1 therefore includes Supabase
Storage integration, image validation and optimization, manual
`custom_event_banners` entitlements, grace-period removal, fallback behavior,
and audited moderation.

Stage 1 also includes the complete store membership foundation: owners, admins,
staff, invitations, explicit store or branch scope, branch assignments, and
last-owner protection.

These membership capabilities are essential Stage 1 validation scope, not
future-only preparation. Stage 1 must support real stores with multiple
operators, multiple branches, and branch-limited staff access.

Stage 1 permissions are narrower than their future target permissions:

- Owners manage the entire Stage 1 store domain.
- Admins manage branches, series, and events within scope, but not owners.
  Store-wide admins may upload or remove custom banners; branch-scoped admins
  may select eligible existing banners for assigned-branch events.
- Staff have read-only operational access within scope because QR,
  registration, and attendance actions are not implemented yet.

Later stages may activate already accepted staff and admin operational actions
without changing the membership ownership model.

Stage 1 does not implement in-app notifications. Invitations use their own
acceptance workflow and Stage 1 administrative actions rely on audit records.
Implement `user_notifications` with the later internal-registration stage.

Email in Stage 1 is limited to Supabase Auth messages and store-membership
invitation delivery. VortexHub does not send event, activity, lifecycle, or
marketing email.

Stage 1 does not implement scheduled store or branch closure plans. It supports
owner-only immediate closure with a minimal affected-event preview and an
auditable bulk cancellation of future events. Scheduled closure with
`effective_at` is a later capability.

Stage 1 audit scope is intentionally limited to critical actions:

- Store activation, suspension, and closure.
- Owner and membership changes.
- Invitation creation, revocation, and acceptance.
- Branch activation, closure, and reactivation.
- Event and series publication, date or time changes, and cancellation.
- Premium banner upload, removal, selection, and moderation.
- Entitlement grant, expiry, and revocation.

Minor edits such as title or description changes are not audited during Stage
1. Expand audit coverage only for a documented operational, security, or legal
risk.

Stage 1 platform administration uses roles separate from store memberships:

- `platform_admin`: manages the global game and platform-banner catalogs,
  grants or revokes entitlements, suspends or restores stores, and performs
  moderation.
- `platform_moderator`: moderates custom banner content but cannot manage
  entitlements, suspend stores, or administer platform roles.

Platform roles are assigned only through a secure internal operation unavailable
to normal user interfaces. Assignment and every platform administrative action
are audited.

Stage 1 weekly series support one or more weekdays. Every Sunday, generate and
publish the following Monday-through-Sunday occurrences in the series timezone.
Concrete occurrences may be edited or cancelled independently. Series edits
affect only dates not yet generated, and ending a series stops future generation
without altering generated occurrences.

Activating a series also generates and publishes every eligible remaining
occurrence in the current local Monday-through-Sunday week immediately. The next
Sunday job resumes normal generation for the following week. Activation and
scheduled generation are idempotent.

Stage 1 does not implement series pause or special bulk
deletion/cancellation when ending a series. More complex recurrence patterns
remain out of scope.

Stage 1 calendar-domain jobs include event auto-completion, weekly occurrence
generation, and logical archival of completed or cancelled events after 12
months. Archival never physically deletes events. Required maintenance jobs
handle invitation expiry, premium-asset grace removal, account anonymization,
and audit retention.

The accepted designs for those capabilities remain future implementation
requirements and must not be silently simplified when later stages begin.

**Reasoning:** A publishing-only first stage proves the core store and community
value before investing in identity and registration workflows.

### ADR-000: Use Supabase Auth For The MVP

**Status:** Accepted

Supabase Auth owns credentials, sessions, email verification, and account
recovery during the MVP. VortexHub does not store password hashes.

`user_accounts.id` uses the same UUID as `auth.users.id` and references it.
Domain authorization and player identity remain in VortexHub tables rather than
in authentication-provider metadata.

**Reasoning:** This reduces authentication risk and implementation scope without
coupling player or store-domain records to Supabase-specific user metadata.

### ADR-001: Separate Authentication From Player Identity

**Status:** Accepted

`user_accounts` represents authentication and account-level identity.
`player_profiles` represents the reusable player identity.

A normal player profile belongs to an authenticated account. Stores cannot
create guest, unclaimed, or unauthenticated players.

**Reasoning:** This keeps authentication concerns separate while preserving one
global player identity across stores.

### ADR-001A: Create Player Profiles Lazily Through Progressive Onboarding

**Status:** Accepted

An authenticated active user account does not require a player profile merely
to operate a store. Create the single allowed player profile only when the user
first performs a player action, such as registering for an event or opening
their personal QR.

The player-action flow must provide short progressive onboarding:

1. Preserve the user's original intended action.
2. Request the minimum required profile data, initially `nickname` and optional
   avatar.
3. Create the player profile and first QR credential transactionally.
4. Resume and complete the original action automatically when still eligible.

At most one active player profile may exist per account. Profile onboarding must
not silently create a profile before the user initiates a player action.

**Reasoning:** Lazy creation minimizes unnecessary player data for store-only
operators while keeping event registration and QR activation comfortable.

### ADR-001B: Use Non-Unique Nicknames With Immutable Player Tags

**Status:** Accepted

Player nicknames are not globally unique and are never treated as verified legal
identity. Each player profile also receives a globally unique, random,
immutable, non-personal `player_tag` for disambiguation in authorized contexts.

The tag contains exactly six characters generated from
`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, excluding visually ambiguous characters.
Generation retries on the unlikely event of a uniqueness collision. Display it
separately from the nickname, for example `Kaiba · K7M4Q9`.

The tag does not expose the internal UUID, cannot authenticate or authorize any
action, does not replace the QR secret, and cannot be used for public player
lookup during the MVP.

Public events do not expose participant nicknames or tags. Where an authorized
operator must distinguish players, display nickname and tag together.

VortexHub reserves platform, store, and official-looking names as needed and may
require a nickname change after an impersonation report through an audited
moderation action. Verified-player badges and identity-verification workflows
are future capabilities.

Players may change their nickname once every 30 days. VortexHub moderation may
require or apply an immediate change. Previous nicknames are not public and are
not permanently reserved. Retain a minimal internal nickname-change history for
12 months for abuse investigation; stores cannot access it.

Nicknames contain between 2 and 40 allowed characters and are validated against
reserved names and moderation rules.

Player avatars are optional public-facing media within authorized player
contexts. Allow JPEG, PNG, and WebP source uploads up to 2 MB with minimum
dimensions of 256 by 256 pixels. Generate a square optimized WebP variant.

Stores may view only the optimized variant when an authorized action permits
profile display; they cannot access the source upload. VortexHub may remove an
inappropriate avatar through an audited moderation action. Account deletion
removes avatar media after the 30-day deletion grace period.

**Reasoning:** Tags resolve legitimate nickname collisions without making
nicknames scarce or falsely presenting them as verified identity.

### ADR-002: Support Guardian-Managed Dependent Profiles

**Status:** Accepted as a future update; excluded from the MVP launch

Dependent minor profiles may be managed by authenticated guardian accounts using
`player_guardianships`. They are the only player profiles allowed without their
own login account.

Guardian relationships and consent must be versioned, revocable, and auditable.
The MVP launch is restricted to users who declare that they are at least 18
years old. Do not enable dependent profiles or collect minor-related data until
the required legal review and workflows are complete.

**Reasoning:** Restricting the platform to adults would exclude an important TCG
audience. Allowing minors to self-register without controls creates privacy and
consent risk.

### ADR-002A: Use A Versioned Adult-Age Declaration For The MVP

**Status:** Accepted

The MVP requires each user to explicitly accept a versioned declaration that
they are at least 18 years old before their VortexHub account becomes active.

VortexHub does not collect a birth date, birth year, age category, or identity
document for this purpose. The declaration acceptance is retained as immutable
evidence.

**Reasoning:** This supports the adult-only MVP while minimizing collection of
sensitive identity data. Documentary age verification is not justified for the
current product scope.

### ADR-003: Restrict Sensitive Logistics Data To Store Owners

**Status:** Accepted

Only store owners receive access to restricted player logistics data by default.
Admins and staff do not inherit it.

Access must be tied to a specific event or operational purpose and recorded in
the audit log.

**Reasoning:** Stores may occasionally need private information for logistics,
but permanent broad access violates data minimization.

### ADR-003A: Keep MVP Player Profiles Minimal

**Status:** Accepted

MVP player profiles contain only a required `nickname` and an optional avatar.
VortexHub does not collect legal first or last names, birth information, or
restricted logistics data during the MVP.

Stores receive the minimum identity required for an authorized action. Future
collection of private player data requires a documented purpose, retention
policy, and explicit access rules.

**Reasoning:** Calendar registration and QR identification do not justify
collecting legal identity data.

### ADR-003B: Make Store Membership Scope Explicit

**Status:** Accepted

Every store membership has an explicit scope:

- `store`: authorized actions may apply across the store, subject to role.
- `branches`: authorized actions are limited to explicitly assigned branches.

Owners always use `store` scope. Admins and staff may use either scope. An
active membership with `branches` scope must have at least one active branch
assignment.

Removing the final branch assignment must be rejected or atomically disable the
membership. It must never broaden the membership to store-wide access.

**Reasoning:** Explicit scope prevents missing or accidentally deleted
assignments from silently expanding authorization.

### ADR-003D: Require At Least One Active Store Owner

**Status:** Accepted

Every active store must have at least one active `owner` membership. A store may
have multiple owners.

The final active owner cannot leave the store, be demoted, have their membership
disabled, or complete account deletion until another active owner exists. Adding
or removing owners requires an authorized owner action and an audit event.
Changes that could affect the final-owner invariant must be enforced
transactionally.

**Reasoning:** A store without an active owner cannot safely administer
memberships, ownership, or future restricted operations.

### ADR-003E: Use Fixed MVP Store Roles

**Status:** Accepted

The MVP uses fixed store roles interpreted within each membership's explicit
store or branch scope:

- `owner`: manages the entire store, ownership, memberships, branches, events,
  and registrations.
- `admin`: manages branches and events within scope and may perform QR-assisted
  registration, but cannot cancel registrations or add, remove, promote, or
  demote owners.
- `staff`: views operational event information and may perform QR-assisted
  registration, manually cancel registrations, and approve or reject
  reinstatement requests within scope. Staff cannot create or edit events or
  branches.

No role may act outside its membership scope. Sensitive actions and material
event changes require audit events. A granular permission builder is outside the
MVP.

**Reasoning:** Fixed roles are easier to understand and authorize safely while
covering the required store workflows.

### ADR-003N: Separate Platform Administration From Store Memberships

**Status:** Accepted

Platform administration uses `platform_admin` and `platform_moderator` roles
that are independent of store memberships.

`platform_admin` manages global games and platform banners, entitlements, store
suspension and restoration, moderation, and platform-role assignment.
`platform_moderator` may moderate custom banner content only.

Roles are assigned through a secure internal operation unavailable to normal
users. Platform-role changes and administrative actions are audited.

**Reasoning:** Platform authority must not be inferred from ownership of any
store or exposed through store membership workflows.

### ADR-003L: Invite Store Members Through Expiring Opaque Tokens

**Status:** Accepted

Owners and admins may invite a person by email to become a store member:

- Owners may invite `owner`, `admin`, or `staff`.
- Admins may invite only `admin` or `staff`, and only with a scope they are
  authorized to grant.

An invitation stores the normalized intended email and a hash of a
high-entropy opaque acceptance token. The plaintext token is never persisted or
logged. Invitations expire after seven days and may be revoked or replaced by a
new invitation.

VortexHub delivers the plaintext invitation link by email without persisting
it. This email exception is limited to membership onboarding and is separate
from product notifications.

Acceptance requires authentication through Supabase Auth with the same verified
email. The membership remains `invited` until acceptance. Sending or accepting
an invitation must not reveal whether the email already had a VortexHub
account, and inviting never creates an account automatically.

Invitation creation, revocation, and acceptance are audited.

**Reasoning:** Expiring authenticated invitations support practical onboarding
without exposing account existence or allowing unverified role assignment.

### ADR-003M: Snapshot Intended Branch Scope In Membership Invitations

**Status:** Accepted

A branch-scoped membership invitation stores its intended active branch
assignments before acceptance.

- A `branches`-scoped invitation requires at least one active branch from the
  same store.
- A `store`-scoped invitation has no intended branch assignments.
- Acceptance creates the membership and all assignments atomically.
- If any intended branch becomes inactive or otherwise ineligible before
  acceptance, the invitation cannot be accepted and must be corrected or
  replaced.

**Reasoning:** Snapshotting intended scope makes the invitation explicit and
prevents partially activated or unexpectedly broad memberships.

### ADR-003F: Close Branches Through A Scheduled Two-Phase Workflow

**Status:** Accepted for a later stage; excluded from Stage 1

A branch closure is scheduled with an `effective_at` timestamp instead of
immediately changing the branch to inactive. Only an owner may schedule, cancel,
or execute a branch closure early.

Before scheduling, the owner receives a preview of affected event series,
concrete events, and registrations. While a closure is scheduled:

- The branch remains active until `effective_at`.
- Public pages may display the scheduled closure date.
- Events before `effective_at` continue normally.
- Creating, publishing, moving, or generating events whose `starts_at` is at or
  after `effective_at` is blocked.
- Recurring occurrence generation stops before the effective closure boundary.
- The closure plan may be cancelled before execution.

At `effective_at`, an idempotent job:

1. Marks the branch inactive.
2. Ends its active recurring series at the closure boundary.
3. Cancels all non-cancelled events with `starts_at >= effective_at` through one
   auditable cancellation batch.
4. Preserves all prior events and registrations.
5. Records the closure and event cancellation reasons.

An event that starts before `effective_at` may finish afterward unless an owner
or authorized admin cancels it separately.

The MVP does not support reassigning events or series from a closing branch to
another branch. Affected future activity remains associated with the closing
branch and is cancelled at execution. Stores may create replacement events or
series at another active branch as new activity.

**Reasoning:** A scheduled two-phase workflow supports announced closures and
final events while preventing new commitments beyond the closure date and
preserving a traceable bulk-cancellation history. Excluding reassignment avoids
complex participant and series migration for an uncommon MVP case.

### ADR-003G: Use Explicit Branch Lifecycle States

**Status:** Accepted

Branches use these lifecycle states:

- `draft`: not public and cannot host published events.
- `active`: publicly available and operational; it may have a scheduled closure.
- `inactive`: closed and available only where historical context requires it.

Scheduled closure remains a separate `branch_closure_plans` workflow and is not
a branch state.

Only an owner may reactivate an inactive branch. Reactivation is audited and
does not automatically restore ended series, cancelled events, or prior staff
assignments.

**Reasoning:** Explicit states describe branch visibility and operation more
clearly than a boolean while keeping scheduled closure as its own auditable
process.

### ADR-003I: Treat Active Branch Location As Immutable

**Status:** Accepted

After a branch first becomes active, its physical identity and location fields
are immutable:

- `name`
- `slug`
- `address_line`
- `city`
- `region`
- `country_code`
- `latitude`
- `longitude`
- `timezone`

Moving or materially renaming a branch requires scheduling closure of the
existing branch and creating a new branch. Events and historical references
remain attached to the original branch.

Operational metadata that does not change branch identity may be introduced and
edited separately in the future.

**Reasoning:** An immutable branch represents one stable physical venue,
preserves event history without location snapshots, and makes moves explicit.

### ADR-003J: Keep Branches Optional For Stores

**Status:** Accepted

A store may become active and operate without branches. Such a store may publish
custom-location and online events.

Branch-location events require an active branch. A `branches`-scoped membership
cannot become active unless it has at least one assignment to an active branch.
Creating a store's first branch does not alter existing events or memberships.

**Reasoning:** Online and off-site organizers should not need to invent a
physical branch, while branch-scoped authorization must still reference a real
active venue.

### ADR-003H: Use Explicit Store Lifecycle And Scheduled Closure

**Status:** Accepted

Stores use these lifecycle states:

- `pending`: configuration is incomplete and the store is not public.
- `active`: operational and public.
- `suspended`: administratively blocked by VortexHub. Existing public pages
  remain visible, but new registrations and store operations are blocked.
- `closed`: owner-requested closure has completed. Historical context remains
  available, but new activity is blocked.

Owner-requested store closure uses a scheduled two-phase workflow equivalent to
branch closure, but affects the entire store. Before execution, owners receive a
preview of affected branches, series, events, registrations, and memberships.
At the effective time, an idempotent job closes the store, makes its branches
inactive, ends active series, cancels future events through auditable
cancellation batches, and disables non-historical memberships.

Store suspension is a VortexHub administrative action, not an owner closure. It
must be audited and must not rewrite the store as closed or erase history.

During the MVP, `closed` is a terminal state and a closed store cannot be
reactivated. Owners who resume operations must register a new store. A
`suspended` store may be restored to `active` only through an audited VortexHub
administrative action.

**Reasoning:** Suspension and owner-requested closure have different authority,
intent, and recovery behavior and should not share one ambiguous state.

During Stage 1, owner-requested store and branch closure is immediate rather
than scheduled. The owner receives a minimal preview of affected future events,
then closure atomically changes lifecycle state and cancels future events
through auditable cancellation batches. Implement closure plans and
`effective_at` in a later stage.

### ADR-003K: Activate Stores Through Self-Service

**Status:** Accepted

A pending store may be activated immediately by an owner when it has:

- A valid name and globally unique slug.
- A valid IANA timezone.
- At least one active owner.
- An owner whose account is active and has accepted the current adult-age
  declaration.

Logo and description are optional. Store activation does not require manual
VortexHub approval during the MVP and must create an audit event. VortexHub may
later suspend an active store through the separate administrative suspension
workflow.

**Reasoning:** Self-service activation minimizes onboarding friction while
preserving explicit eligibility and post-activation administrative controls.

### ADR-003C: Exclude Event Logistics Data Collection From The MVP

**Status:** Accepted

The MVP does not support event requirements or responses for age category,
guardian confirmation, emergency contacts, event-specific terms, or arbitrary
custom registration questions.

Any future structured logistics requirement must define its operational
purpose, collected response, consent or legal basis, authorized viewers,
disclosure behavior, retention period, and deletion workflow before
implementation.

**Reasoning:** Requirement flags without complete response and privacy workflows
create misleading product behavior and unnecessary data-protection risk.

### ADR-004: One Game Per Event

**Status:** Accepted

Each event references exactly one `game_id`.

- Use `Miscelaneo` for deliberately multigame, mass, or open-play events.
- Use `Otros` when the relevant game is absent from the catalog.

**Reasoning:** This keeps calendar filtering and event creation simple during the
MVP. A many-to-many `event_games` model is not currently justified.

### ADR-004A: Manage A Global Game Catalog With Structured Fallbacks

**Status:** Accepted

Only VortexHub administrators manage the global `games` catalog. Stores cannot
create game records.

- `Otros` represents one specific game that is not yet in the catalog. Events
  and series using it must provide `other_game_name`.
- `Miscelaneo` represents deliberately multi-game or open-play activity and
  must not use `other_game_name`.
- Inactive games remain referenced by historical events but cannot be selected
  for new events or series.

**Reasoning:** A controlled global catalog preserves consistent filtering while
allowing uncatalogued and genuinely multi-game events without store-created
duplicates.

### ADR-004B: Keep One Representative Store Per Event

**Status:** Accepted

Every event and event series belongs to exactly one representative organizing
store. That store owns event administration, registrations, authorization,
audit scope, and future point attribution.

The MVP does not support multi-store event ownership or co-administration.
Other stores may share a public event link but receive no event permissions or
registration access.

If future collaboration metadata is introduced, one representative store
remains the sole owner and source of truth.

**Reasoning:** A single responsible store preserves clear authorization,
registration ownership, audit scope, and point-ledger boundaries.

### ADR-005: Hybrid Registration With One Source Of Truth

**Status:** Accepted

Each event has one registration mode:

- `internal`
- `external`
- `disabled`

Internal and external registration cannot be active simultaneously for the same
event.

Internal registration is part of the MVP. It supports free registration,
capacity, and cancellation. Waitlists and payments are out of scope.

**Reasoning:** Internal registration gives the global player identity and QR
immediate value. External mode allows stores to keep using official tournament
or payment systems without splitting the source of truth for one event.

### ADR-005A: Do Not Store External Registration Participants Or Counts

**Status:** Accepted

For events with `registration_mode = 'external'`, VortexHub stores only the
external registration URL and public event information. It does not store
external participants, mirrored registrations, manually reported participant
counts, or other non-authoritative aggregates during the MVP.

**Reasoning:** External counts become stale easily and can be confused with
authoritative internal registration and capacity data.

### ADR-005B: Define Internal Registration Window Semantics

**Status:** Accepted

For internal-registration events:

- A null `registration_opens_at` means registration opens when the event is
  published.
- A null `registration_closes_at` means registration closes at `starts_at`.
- Registration is never allowed after `starts_at`.
- Players may cancel their own registration.
- Authorized staff and owners may manually cancel registrations from the
  event's operational registration list, before or after event start, through
  an audited action.
- A player who cancelled may request reinstatement while registration remains
  open. Authorized staff or owners must approve it before participation is
  restored.

When both timestamps are present, require:

```text
registration_opens_at < registration_closes_at <= starts_at
```

When only `registration_opens_at` is present, it must be before `starts_at`.

**Reasoning:** Explicit null semantics keep event creation simple while avoiding
ambiguous or permanently open registration windows.

### ADR-005C: Keep Entry Fees Informational

**Status:** Accepted

Event and series entry fees are informational only during the MVP:

- `entry_fee_amount` and `entry_fee_currency` must both be null or both present.
- Amount must be non-negative.
- Currency uses an ISO 4217 code.
- An amount of zero explicitly means free; null means the fee is not provided.
- Changing a fee after registration activity requires explicit confirmation and
  an audit event.
- Discounts, payment records, collection status, refunds, and internal payment
  processing are outside the MVP.

**Reasoning:** Informational fees help players understand events without
introducing payment-source-of-truth and financial-compliance complexity.

### ADR-006: Registration And Attendance Are Separate

**Status:** Accepted

`event_registrations` records intent to participate. Future
`event_attendances` records actual presence.

Do not encode attendance as a registration status.

**Reasoning:** The system must distinguish registered attendees, no-shows, and
walk-ins for future analytics and point awards.

### ADR-006A: Exclude Waitlists From The MVP

**Status:** Accepted

Internal event registrations support `confirmed`, `cancelled`, and
`reinstatement_requested`. The request state is not a waitlist and does not
consume capacity. When a defined capacity is full, new registration and
reinstatement approval attempts are rejected. Cancelling a confirmed
registration immediately releases one slot for a later atomic registration or
approval attempt.

A null event capacity means unlimited capacity.

**Reasoning:** Excluding waitlists removes promotion responsibility and workflow
complexity while preserving simple reusable capacity through cancellation.

### ADR-006B: Reuse Registrations And Preserve Immutable Status History

**Status:** Accepted

A player has at most one `event_registrations` row per event. After
cancellation, an eligible player may request reinstatement. Authorized staff
within event scope or a store owner may approve the request, transitioning the
existing row back to `confirmed` subject to current capacity and registration
rules, or reject it back to `cancelled`.

Every registration status change, including initial registration,
cancellation, reinstatement request, approval, and rejection, creates an append-only
`event_registration_transitions` record. The current registration row remains a
query-friendly projection of the latest state.

**Reasoning:** Reusing the registration row preserves uniqueness while an
immutable transition history retains operational and audit context.

### ADR-006C: Expose Capacity Without Exposing Participants

**Status:** Accepted

Public internal-event pages show a derived occupancy progress bar when capacity
is defined. Occupancy is `confirmed registrations / capacity` and includes the
exact aggregate count, such as `16 of 20 occupied`.

Public pages never expose registered player names, profiles, individual
registration records, or player identities. An authenticated player may view
their own exact registration state. Authorized store operators may view
registrations only within membership scope.

Unlimited, external-registration, disabled-registration, cancelled, and
completed events do not show an occupancy progress bar. Public occupancy is
informational and may become stale during concurrent activity. Exact capacity
eligibility is always determined atomically when registration is attempted.
The confirmed count and percentage are derived from registrations and are never
stored as editable event counters.

**Reasoning:** Availability helps players decide whether to register without
creating a public participant directory or weakening capacity concurrency.

### ADR-006D: Allow Self-Cancellation With Approved Reinstatement

**Status:** Accepted

Players may cancel their own confirmed registration. Self-cancellation
immediately releases capacity and does not require a reason.

A player who later wants to participate must submit a reinstatement request.
The request does not consume capacity. Authorized staff within event scope or a
store owner may approve it subject to the current registration window and
capacity, or reject it. Admins cannot approve or reject reinstatement requests.

Staff within event scope and store owners may also manually cancel a
registration from the operational list without a fresh QR scan. Store-initiated
cancellation requires one structured reason: `duplicate`,
`invalid_registration`, or `other`. `other` may include a brief internal note.
Players see that the store cancelled the registration but not the internal
note. Admins cannot cancel registrations.

Every cancellation, reinstatement request, approval, and rejection creates an
immutable transition. Store actions are audited.

When the effective registration window closes, every remaining
`reinstatement_requested` registration transitions automatically to
`cancelled` with reason `registration_closed`. This expiration is idempotent,
does not consume or release capacity, and does not require store action.

The MVP does not impose a numeric limit on self-cancellations or reinstatement
requests for one event. Required operator approval and immutable transition
history provide the abuse-control mechanism.

When deciding a reinstatement request, authorized staff and owners may view only
the transition history of that player's registration in the current event. They
cannot view the player's behavior in other events or stores.

Rejecting a reinstatement request returns the registration to `cancelled` but
does not block another request while registration remains open. Every later
request and decision creates its own immutable transition.

Reinstatement rejection uses one structured reason: `no_capacity`,
`registration_closed`, `repeated_changes`, or `other`. `other` may include a
brief internal note. Players may see the structured reason but never the
internal note.

An approval attempt that loses a concurrent capacity race fails without changing
the request state. The operator may then explicitly reject it with
`no_capacity`, or leave it pending while registration remains open.

**Reasoning:** Self-cancellation releases capacity conveniently, while approved
reinstatement discourages repeated abusive reservation churn without
introducing a waitlist.

### ADR-007: QR Is An Identifier, Never Authorization

**Status:** Accepted

The player QR contains a random opaque token. It cannot resolve a public profile
and cannot authorize any operation.

QR resolution requires:

1. An authenticated account.
2. An authorized store-scoped action.
3. Permission to perform that action.
4. An active QR token.
5. An audit record.

**Reasoning:** A photographed or leaked QR must not expose a player or permit
actions outside a participating store workflow.

### ADR-007A: Allow Store-Assisted Registration Only Through Contextual QR Scan

**Status:** Accepted

During the MVP, a player may register only themselves through self-service.
Authorized owners, admins, and staff may register another player only by
scanning that player's active QR within the context of a specific internal
registration event.

The operator must have permission for the event's store and branch. The scan
resolves only the minimum player identity required to complete the registration
and must be audited. Stores cannot search the global player directory, enter a
player by email, name, or internal UUID, or create a player profile.

The QR is the identification channel; the authenticated operator account and
store membership provide authorization.

**Reasoning:** This gives the QR immediate operational value without creating a
public or store-visible player directory or weakening the prohibition on
store-created players.

Store operators may also be players. They may register themselves through
self-service or scan their own QR through the operational interface. The
recorded channel reflects the actual flow. Store role never bypasses capacity,
registration windows, event eligibility, or other registration rules; an
operational self-scan is audited like every other QR-assisted action.

### ADR-007B: Store Only A Hash Of The QR Secret

**Status:** Accepted

Each player QR contains a cryptographically secure, high-entropy opaque secret.
The secret is not a UUID and must never be stored in plaintext, written to logs,
or included in audit metadata.

VortexHub stores only a deterministic cryptographic hash of the secret. On scan,
the presented secret is hashed and matched against an active QR credential.
Rotating or revoking a QR immediately invalidates the previous credential. Only
one active QR credential may exist per player.

**Reasoning:** Hashing prevents a database or log disclosure from directly
exposing reusable player QR credentials.

### ADR-007C: Resolve QR With Minimal Event-Scoped Disclosure

**Status:** Accepted

QR resolution for MVP event registration returns only:

- The optimized avatar variant when present.
- `nickname` and `player_tag`.
- The player's current registration state for the contextual event.
- The actions the authenticated operator is currently authorized to perform.

It never returns email, internal UUIDs, multi-store history, other events,
memberships, a complete player profile, or future point information.

The resolution result is short-lived, limited to the current event and intended
action, cannot be used to navigate to a player profile, and must be audited.

**Reasoning:** Event-scoped minimal disclosure supports QR-assisted operation
without turning QR scanning into player lookup or cross-store surveillance.

### ADR-007D: Allow Rate-Limited Player QR Rotation

**Status:** Accepted

An active authenticated player may rotate their QR credential at any time,
limited to one successful rotation every five minutes.

Rotation atomically revokes the previous credential and creates a new one.
It does not require an additional password challenge during the MVP. Signing
out or changing nickname does not rotate QR. Account suspension, deletion, or
anonymization revokes active QR credentials.

Every rotation is audited without storing the plaintext secret or token hash.

**Reasoning:** Self-service rotation lets players respond quickly to a copied QR
while a short rate limit prevents accidental or abusive churn.

### ADR-007E: Require Online QR Resolution In The MVP

**Status:** Accepted

MVP QR workflows require connectivity to the VortexHub backend. The QR contains
only its opaque secret and no readable player identity or offline-verifiable
profile data.

Clients do not cache player identities for offline QR resolution. When
connectivity is unavailable, the operation fails safely and may be retried
later. Offline scanning requires a separate future security, privacy, expiry,
and synchronization design.

**Reasoning:** Online resolution preserves immediate revocation, current
authorization, minimal disclosure, and consistent registration capacity.

### ADR-007F: Never Infer Attendance From QR Resolution

**Status:** Accepted

Each QR resolution belongs only to its explicit contextual action. The MVP does
not store a mutable player `last_scanned_at`, create attendance from a scan, or
interpret QR-assisted registration as presence.

Audit records may retain that an authorized QR resolution occurred without
storing the secret or hash. Future attendance uses separate
`event_attendances` records and must not be inferred retroactively from past QR
resolutions or registrations.

**Reasoning:** QR identification, registration intent, and physical attendance
are separate facts with different authorization and evidentiary meaning.

### ADR-008: Public Resources Use Slugs

**Status:** Accepted

Stores, branches, games, and events use slugs in public URLs. Event and branch
slugs are scoped to their store, supporting routes such as
`/stores/{store_slug}/events/{event_slug}`. Internal UUIDs remain internal
identifiers.

**Reasoning:** Slugs make shared calendar and event links understandable and
avoid exposing implementation identifiers.

### ADR-008A: Generate Stable Slugs And Freeze Them After Publication

**Status:** Accepted

Slugs are generated automatically from the initial visible name or title by
lowercasing, removing diacritics, normalizing separators to hyphens, collapsing
repeated hyphens, trimming, and enforcing a maximum length. Reserved route words
must be rejected.

When a generated slug collides within its scope, append a short random
non-sequential suffix. Do not expose internal UUIDs or sequential identifiers in
public slugs.

Slugs may be edited before first publication or public activation. They become
immutable after that point and are not regenerated when the visible name or
title changes. Cancelled and archived resources retain their public slug.

Store slugs are globally unique. Branch, event series, and event slugs are
unique within their store. Generated recurring occurrences use:

```text
{series-slug}-{YYYY-MM-DD}
```

using the occurrence's scheduled local date. Collisions still use the standard
short random suffix.

**Reasoning:** Stable readable URLs support sharing while avoiding redirect and
slug-history complexity during the MVP.

### ADR-009: UTC Storage With IANA Display Timezones

**Status:** Accepted

Store timestamps as PostgreSQL `timestamptz` values in UTC. Store and branch
records contain IANA timezones used for display and event creation.

**Reasoning:** This avoids ambiguous timestamps while supporting branches in
different locations.

### ADR-009A: Model Event Location Explicitly

**Status:** Accepted

Events and recurring series use one explicit location mode:

- `branch`: requires `branch_id` and does not use `location_text`.
- `custom`: requires `location_text`; `branch_id` is optional and represents the
  organizing branch when present.
- `online`: requires `location_text` containing the public URL or joining
  instructions; `branch_id` is optional and represents the organizing branch.

Every event still belongs to one store. When an event has an organizing branch,
branch-scoped authorization uses it. When `branch_id` is null, only active
store-wide memberships may operate the event.

**Reasoning:** Explicit location semantics avoid ambiguous nullable fields and
define authorization consistently for off-site and online events.

### ADR-009B: Keep MVP Calendar Discovery Non-Geospatial

**Status:** Accepted

The public MVP calendar supports filtering by game, date, city, and store.

Branch coordinates remain available for future discovery capabilities but are
not used for radius search, distance ordering, user geolocation, or maps during
the MVP.

**Reasoning:** Structured filters cover initial discovery needs without adding
geospatial indexing, location permissions, or map-provider complexity.

### ADR-009C: Derive Calendar City From Effective Event Location

**Status:** Accepted

Stores do not have a single city because their branches may operate in
different cities. Calendar city filtering uses the event's effective location:

- `branch` events use the referenced branch city.
- `custom` events store their actual city and country explicitly, regardless of
  whether an organizing branch exists.
- `online` events have no city and appear under a special `Online` filter.

Custom-event region is optional. Branch-based events do not duplicate branch
city fields into the event row.

**Reasoning:** Effective-location filtering represents where the event actually
occurs without inventing a misleading store-level city or duplicating branch
addresses unnecessarily.

### ADR-010: Future Points Use An Immutable Ledger

**Status:** Accepted for future design

Points will be represented by append-only ledger entries scoped to a store.
Balances are derived or cached projections, not the sole record.

Future ledger entries reference `store_id` and `player_profile_id`, may
optionally reference `event_id` or a future `event_attendance_id`, contain a
positive or negative movement and structured reason, and use compensating
entries for corrections.

Points and future rewards belong strictly to one store. There is no global
VortexHub point balance, cross-store visibility, or transfer between stores.
All branches of the same store share that store's ledger and future reward
catalog.

The MVP does not add point balances or point-related columns to players, stores,
events, registrations, QR credentials, or other current domain tables.

**Reasoning:** A ledger supports auditability, corrections, expiration, and
reward redemption safely.

### ADR-011: Model Weekly Recurrence As Series With Concrete Occurrences

**Status:** Accepted

The MVP supports basic weekly recurring event series. An `event_series` stores
the local-time recurrence template. Each generated date is stored as a concrete
`event` occurrence with its own registrations, capacity, status, cancellation,
and future attendance and point references.

Weekly series may select one or more ISO weekdays; they are not limited to one
day per week.

Recurrence rules are evaluated in the series' IANA timezone and converted into
UTC `timestamptz` occurrence timestamps. Do not model weekly recurrence as a
fixed UTC duration.

Occurrence generation is idempotent and publishes one calendar week at a time
instead of materializing the complete lifetime of a series. Every Sunday at
00:00 in the series' IANA timezone, a scheduled job generates and publishes
eligible occurrences for the following Monday-through-Sunday week. A uniqueness
constraint on series and scheduled local occurrence prevents duplicate
generation.

When a series becomes active, generate and publish all eligible remaining
occurrences in the current local week immediately. The next scheduled Sunday
job continues with the following week.

Editing one occurrence does not mutate the series. Editing a series may update
or regenerate only future occurrences that have no registrations or other
dependent activity. Occurrences with activity must be changed or cancelled
explicitly.

**Reasoning:** Concrete occurrences keep calendar queries, registration,
capacity, cancellations, attendance, and future point attribution simple.
Weekly generation limits unnecessary storage while preserving predictable
public schedules.

### ADR-011C: Treat Series Occurrences As Independent Exceptions

**Status:** Accepted

Editing a concrete occurrence never changes its source series. An individually
edited occurrence may change its permitted schedule and event fields and remains
subject to normal activity and audit restrictions.

Editing a series changes future occurrences that have not yet been generated.
It may update already generated occurrences only when they remain unpublished,
unmodified, and have no dependent activity. It never overwrites published,
individually modified, or active occurrences.

Deleting a series means ending it, not physically deleting its history:

- Stop future generation.
- Delete only future draft occurrences with no activity.
- Cancel future published occurrences or occurrences with activity through an
  auditable cancellation batch.
- Preserve past occurrences and all historical references.

Pausing a series stops new generation without cancelling existing occurrences.

During Stage 1, ending a series only stops future generation and leaves every
already generated occurrence independently managed. Pausing and special bulk
deletion or cancellation on series end are deferred.

**Reasoning:** Series are reusable templates, while each occurrence may become
an independent public commitment.

### ADR-011D: Offer Platform And Premium Custom Event Banners

**Status:** Accepted

Every public event has either a VortexHub-managed platform banner or a
store-owned custom banner. Platform banners are available to all stores. Custom
banners require the store's current premium entitlement when uploaded or
selected.

Owners and admins of entitled stores may upload custom banners to Supabase
Storage after validating file type, dimensions, size, and store ownership.
Custom banners are public media and must not contain private player or
operational data.

Series store their default banner selection and generated occurrences snapshot
it. Editing an occurrence banner does not modify the series. Changing a series
banner affects only newly generated occurrences.

Subscription or entitlement state is not stored in event rows. It is checked at
the upload and selection action boundary.

When a store loses premium entitlement:

- Future and currently active published events retain their snapshotted custom
  banner during the 30-day grace period.
- New events and occurrences use the applicable platform banner.
- Custom assets cannot be selected for new activity.
- Custom assets are retained for a 30-day grace period before removal.
- Past events do not prevent removal. After an asset is removed, any event that
  referenced it displays the applicable platform default instead.

**Reasoning:** Banners provide a visible premium branding benefit while
keeping commercial entitlement separate from event history. Historical event
identity does not depend on retaining custom presentation assets.

### ADR-011E: Authorize Premium Features Through Store Entitlements

**Status:** Accepted

Premium feature access is represented by store-scoped entitlements rather than
subscription or payment fields on domain records. During the MVP, VortexHub
administrators grant, expire, or revoke entitlements manually.

The initial entitlement feature is `custom_event_banners`. Upload and selection
functions verify an active entitlement at the action boundary. Existing event
history does not change when entitlement state changes.

Entitlements record their source so a future external billing provider can
manage the same capability without changing events, series, or media ownership.
VortexHub does not store payments or subscription transactions during the MVP.

**Reasoning:** Feature entitlements provide a stable authorization boundary for
premium capabilities while keeping billing integration out of the MVP.

### ADR-011F: Apply Initial Custom Banner Limits And Moderation

**Status:** Accepted

Custom event banners use these initial MVP limits:

- Allow JPEG, PNG, and WebP source uploads.
- Maximum source size is 5 MB.
- Recommended aspect ratio is 16:9.
- Minimum dimensions are 1200 by 675 pixels.
- Generate an optimized WebP calendar variant.
- Permit at most 20 active custom banner assets per store.

Owners and admins may upload and remove custom banners while the store has the
required entitlement. Removing an asset causes referencing events to fall back
to the applicable platform banner.

VortexHub administrators may remove inappropriate content through an audited
moderation action.

**Reasoning:** Explicit limits control storage and rendering cost while
maintaining predictable calendar presentation and a basic moderation path.

### ADR-011A: Restrict Event Changes After Registration Activity

**Status:** Accepted

Before an event has registrations, authorized operators may edit its mutable
configuration subject to normal state-transition rules.

After the first registration exists:

- `store_id`, `game_id`, and `registration_mode` are immutable.
- Description and location remain editable.
- Changes to start or end time, branch, capacity, or informational entry fee
  require explicit operator confirmation and an audit event.
- Capacity cannot be reduced below the current number of confirmed
  registrations.
- Cancelling the event preserves all registrations and marks the event as
  cancelled.
- Series-wide changes never overwrite an occurrence that has registrations or
  other dependent activity.

Material changes must be visible to affected participants. Notification delivery
is a separate product capability and is not implied by the data-model rule.

**Reasoning:** Registration creates participant expectations and historical
facts that must not be silently reinterpreted by later edits.

### ADR-011G: Require A Public Cancellation Message

**Status:** Accepted

Cancelling a published event requires a brief public cancellation message of at
most 240 characters. The message remains visible on the event's direct
historical page. Cancelling a draft may omit the message.

Immediate store or branch closure uses one required public message for every
affected published future event. Internal audit context remains separate from
the public message. Every published-event cancellation is audited.

**Reasoning:** A public explanation gives visitors clear context without
exposing internal operational or audit details.

### ADR-011B: Complete Events Without Inferring Attendance Or Points

**Status:** Accepted

A published event is completed automatically after `ends_at`. When `ends_at` is
null, it is completed automatically six hours after `starts_at`.

Owners and authorized admins may complete an event early through an audited
action. Staff cannot change event lifecycle state. Cancelled events never
transition to completed.

Completing an event describes only the event lifecycle. It does not create or
imply attendance, registration outcomes, points, rewards, or payment status.

**Reasoning:** Automatic completion keeps operational calendars current while
preserving the explicit boundaries between event state and future participation
facts.

### ADR-012: Retain Historical Events And Archive Them Logically

**Status:** Accepted

Past event occurrences remain durable historical records. They are not soft
deleted or moved out of PostgreSQL merely because they are old.

Normal public calendar queries exclude old events by date and use partial or
date-oriented indexes. Completed historical events may be marked with an
explicit archival timestamp or archival state so operational interfaces can
hide them without losing references.

During the MVP, completed or cancelled events are archived logically 12 months
after their end time, or after their start time when no end time exists. The
archive operation sets `archived_at`; it does not delete or move the event or
its dependent records. Published historical pages and account history may still
resolve archived events according to product visibility rules.

The public calendar lists only future and currently active events. Published
past and archived events remain resolvable through their direct stable URL but
show only basic event information and lifecycle state. They do not expose
occupancy or registration data and may use the applicable platform banner.
The MVP does not provide a public historical-event explorer.

If measured database growth later justifies physical archival, use PostgreSQL
time-based partitioning and detach or move old partitions according to an
approved retention policy. Do not introduce physical archival before metrics
show it is necessary.

**Reasoning:** Approximately 52 occurrence rows per weekly series per year is
small compared with registrations, audit records, and future point ledger
entries. Preserving event identity is important for history and references.

### ADR-013: Apply Explicit MVP Retention Periods

**Status:** Accepted subject to legal review before production

The MVP uses these initial retention rules:

- `event_registrations` remain available while their event exists and are not
  automatically deleted during the MVP.
- `legal_acceptances` and their referenced legal document versions are retained
  permanently as immutable evidence.
- General `audit_events` are retained for 24 months.
- Audit events concerning QR use, security, restricted disclosure, or other
  sensitive actions are retained for 36 months.

At the end of an audit retention period, records must be deleted or irreversibly
anonymized by an auditable retention job. Metadata must not contain secrets or
unnecessary personal data. These periods require legal review before production
and may be changed without altering the core domain model.

**Reasoning:** Explicit retention avoids indefinite audit-data accumulation
while preserving sufficient operational and security history.

### ADR-014: Delete Accounts Through Deactivation And Anonymization

**Status:** Accepted subject to legal review before production

Deleting a VortexHub account does not physically remove domain records that are
required for historical integrity. The deletion workflow must:

1. Soft-delete and deactivate the `user_account` and `player_profile`.
2. Revoke Supabase Auth sessions and access according to provider capabilities.
3. Revoke every active player QR credential.
4. Disable active store memberships.
5. Anonymize account display name, player nickname, avatar, and any other
   non-required visible profile data after the approved operational period.
6. Preserve internal UUIDs and required relationships for registrations,
   audits, and future point-ledger history.
7. Retain legal acceptances according to their retention policy.

The workflow must be transactional where possible and idempotent. An anonymized
profile cannot be reclaimed or linked to a newly created account. Restoring a
soft-deleted account is not supported after anonymization.

The MVP uses a 30-day grace period between a deletion request and irreversible
anonymization. Account access, Supabase Auth sessions, QR credentials, and store
memberships remain disabled throughout the grace period. Support may reverse an
accidental request before anonymization under an audited process. A legal
obligation may require immediate anonymization.

**Reasoning:** This supports deletion rights and data minimization without
breaking historical or immutable records.

### ADR-015: Enforce Integrity With Constraints, Transactions, And RLS

**Status:** Accepted

VortexHub uses three complementary PostgreSQL enforcement layers:

- Database constraints and partial unique indexes prevent invalid persisted
  states regardless of caller.
- Transactional PostgreSQL functions implement multi-row operations such as
  capacity consumption, QR-assisted registration, ownership changes, scheduled
  closures, recurring occurrence generation, and account deletion.
- Row Level Security (RLS) controls which rows `anon` and `authenticated`
  clients may read or modify through Supabase APIs.

RLS must be enabled explicitly on every table in an exposed schema. Policies are
deny-by-default and must be tested for visitors, players, every store role,
branch scope, suspended accounts, and administrative access.

Clients may directly read public calendar resources and their own permitted
profile and registration data under RLS. Relevant domain writes and sensitive
operations must use explicitly authorized transactional RPC functions. QR
credentials, audit records, legal evidence, transition histories, closure
plans, and cancellation batches have no general direct client access.

Authorization uses current domain tables and `auth.uid()` as the caller
identity. Membership roles and branch assignments are not stored as the
authorization source of truth in JWT claims because those claims can become
stale.

Use `security invoker` functions by default. Any required `security definer`
function must validate caller identity and authorization explicitly, set a safe
`search_path`, use schema-qualified references, restrict execute privileges, and
have dedicated authorization tests. Secret or service-level Supabase keys must
never be exposed to clients.

Index every column used in RLS authorization paths and verify representative
policies and RPC functions with query plans and load tests.

**Reasoning:** These layers prevent invalid states, partial operations, and
cross-store disclosure without requiring a separate backend service for simple
client queries.

### ADR-016: Keep Audit Events Contextual, Append-Only, And Data-Minimal

**Status:** Accepted

Audit events record the authenticated actor, optional membership and branch
scope, stable action, subject, optional operational context, outcome, request
correlation identifier, and minimal action-specific metadata.

Audit events are append-only and have no general client read access. Sensitive
denied and failed attempts are audited as well as successful actions.

Metadata is not arbitrary JSON. Each stable action defines an allowlisted
metadata shape. Audit records must never contain QR secrets or hashes,
authentication tokens, email addresses, or unnecessary personal data.

During Stage 1, audit only the critical actions defined in ADR-000A. Do not
audit every minor content edit.

**Reasoning:** Contextual audit records support security investigations and
accountability without turning the audit log into an uncontrolled copy of
sensitive application data.

### ADR-017: Use In-App Notifications Only During The MVP

**Status:** Accepted for the later internal-registration stage; excluded from
Stage 1

The MVP delivers all product notifications inside VortexHub. It does not send
transactional email, SMS, or push notifications.

Relevant domain operations create persistent in-app notifications in the same
transaction or through an idempotent transactional outbox. Initial notification
cases include:

- Store cancellation of a player's registration.
- Reinstatement approval or rejection.
- Date or time changes to an event with confirmed registrations.
- Event cancellation.

Location, capacity, informational fee, title, description, format, and banner
changes do not generate player notifications during the MVP, even when the
underlying operation requires confirmation or auditing.

Reinstatement requests notify owners and staff authorized for the event's
branch. For events without an organizing branch, notify owners and store-wide
staff. Admins do not receive reinstatement-request notifications because they
cannot decide them.

Repeated pending reinstatement requests are grouped by event for each recipient
rather than generating one notification per request.

Grouped reinstatement notifications distinguish `read_at` from `resolved_at`.
They resolve automatically when no pending reinstatement requests remain for
the event. A later request reopens the existing grouped notification for each
still-authorized recipient.

Notifications use a stable type and structured payload rather than storing
rendered message copies. A user may mark notifications as read. Notification
delivery state is separate from audit records.

Retain in-app notifications for 12 months, then delete them through an
idempotent retention job. The source domain facts and required audit history
remain governed by their own retention rules.

**Reasoning:** In-app notifications cover the MVP workflow without introducing
external delivery providers, consent preferences, cost, or channel reliability
complexity.

## Privacy And Minor-Safety Baseline

The platform must follow these design constraints before enabling dependent
minor profiles:

- Collect only data required for a stated purpose.
- Prefer `age_category` over exposing a full birth date.
- Do not store identity documents for routine age validation.
- Keep consent version, timestamp, status, and revocation history.
- Explain why each logistics field is collected and who may access it.
- Define retention and deletion rules for player and guardian data.
- Provide access, correction, deletion, opposition, and portability workflows.
- Obtain Chilean legal review before production release involving minors.

## Future Update: Minor And Dependent Support

Before enabling dependent player profiles:

- Complete Chilean legal review.
- Define the minimum age for independently authenticated accounts.
- Define guardian identity and relationship verification.
- Version guardian consent and support revocation without deleting its history.
- Define data retention, deletion, access, correction, opposition, and
  portability workflows.
- Decide whether age category is sufficient; do not collect full birth dates
  without a documented operational and legal need.
- Ensure stores cannot create or claim dependent player identities.
- Audit all sensitive disclosure and guardian-managed actions.

The model anticipates Chilean Law 21.719, which introduces special protections
for children's and adolescents' personal data and is scheduled to take effect
on December 1, 2026.

## Known Risks

### Capacity Concurrency

Two users may attempt to claim the final event slot simultaneously. Internal
registration must use a transaction and locking or another atomic capacity
strategy.

### Hybrid Workflow Confusion

Allowing more than one registration source for an event would cause duplicated
participants and unreliable capacity. Enforce one mode at both database and
application layers.

### Overcollection By Stores

Arbitrary custom registration fields encourage collection of unnecessary
personal data. The MVP does not support logistics requirements or custom
registration fields.

### QR Replay Or Photography

A QR may be copied. Treat scanning as identification only, require authenticated
staff action, and log the operation. Higher-risk future actions may require an
additional confirmation step.

### Soft Delete And Uniqueness

Normal unique constraints can prevent reuse after soft deletion or allow
unexpected duplicates. Use partial unique indexes and define restoration rules.

### Slug Mutation

Changing published slugs breaks shared links. The MVP freezes slugs after first
publication or public activation. Redirects and slug history are future
capabilities.

## Open Decisions To Validate Before Implementation

1. Exact text and initial version identifier for the adult-age declaration
   before production release.

## References Reviewed

- Melee registration workflows:
  `https://help.melee.gg/docs/player-enrollment-and-registration-overview/`
- Melee registration-only events:
  `https://help.melee.gg/docs/registration-only-tournaments/`
- Melee check-in and waitlist behavior:
  `https://help.melee.gg/docs/why-would-i-not-want-to-use-the-check-in-feature-for-my-event/`
- Melee accounts for users under 13:
  `https://help.melee.gg/docs/account-creation-for-users-under-the-age-of-13/`
- start.gg registration and attendee management:
  `https://help.start.gg/en/collections/891879-tournament-configuration`
- Chilean Law 21.719:
  `https://www.bcn.cl/leychile/navegar?idNorma=1209272`
