# VortexHub Product Context

## Product Goal

VortexHub helps TCG stores publish events in a unified, shareable calendar while
giving players one reusable identity across participating stores.

The MVP should prove that stores can publish useful calendars and that players
will use one authenticated profile and QR to register for events. Future
attendance, points, and rewards should extend this foundation without requiring
the core identity model to be replaced.

For proposed public and organizer calendar presentation requirements, read
`.agents/calendar-experience.md`. That document refines experience direction
without overriding accepted Stage 1 scope or physical schema decisions.

## Actors

### Visitor

- Browses the public calendar.
- Filters events by game.
- Opens public store, branch, and event pages using slugs.
- Cannot resolve player QR codes or view player information.

### Authenticated User

- Owns an account.
- Has a player profile, unless acting only as the guardian of dependent players.
- Can register for internal-registration events.
- Can display their personal QR.
- May also hold roles in one or more stores.

### Dependent Player

- Represents a minor managed by an authenticated guardian.
- Does not require an independent login.
- Is never created or owned by a store.
- Can have a player QR and event registrations controlled by the guardian.
- Is not available in the MVP launch. Dependent-player support requires legal
  review and a complete guardian verification and consent workflow before it is
  enabled.

### Store Owner

- Registers and manages a store.
- Manages branches and store memberships.
- Creates and edits events.
- May access restricted player logistics information only when required for a
  specific event or store action.

### Store Admin

- Manages branches and events and may perform QR-assisted registration within
  membership scope.
- Cannot cancel registrations.
- Cannot manage store owners.
- Does not receive restricted player logistics access by default.

### Store Staff

- Views operational event information and performs QR-assisted registration,
  manual registration cancellation, and reinstatement approval or rejection
  within membership scope.
- Cannot create or edit events or branches.
- May eventually scan QR codes for event check-in or reward redemption.
- Does not receive restricted player logistics access by default.

## MVP Delivery Stages

### MVP Stage 1: Public Calendar And Store Publishing

Stage 1 validates store adoption and public calendar usefulness before
implementing player identity or registration workflows.

Implement only:

- Supabase Auth for store operators.
- Adult-age declaration and minimal `user_accounts`.
- Require every operator to accept the current adult-age declaration before
  performing store actions.
- Store registration, self-service activation, memberships, and fixed roles.
- Store visual identity uploads, including optimized public store logos for all
  active stores and custom event banners as Stage 1 media.
- Complete invitations and store-or-branch membership scope; staff are
  read-only during Stage 1.
- Send email only for Supabase Auth and store-membership invitation delivery.
- Validate Stage 1 with real multi-operator and multi-branch store workflows.
- Optional branches and owner-only immediate store or branch closure.
- Global game catalog.
- One-time and weekly recurring event publishing.
- Weekly series may include one or more weekdays; ending a series stops future
  generation without altering generated occurrences.
- Activating a series immediately publishes its remaining eligible occurrences
  for the current week before normal Sunday generation continues.
- Branch, custom, and online event locations.
- Public calendar filters by game, date, city, and store.
- Stable public slugs and direct historical event links.
- Platform banners, store logos, and custom event banners. During the pilot,
  custom event banners are open to tester stores as an adoption hook; after
  official launch they are controlled by manually granted premium entitlement.
- Store visual media Storage validation, optimization, fallback, and
  moderation. Custom event banners remain available to testers during pilot and
  additionally support premium grace-period removal after official launch.
- RLS, audit, retention, and scheduled jobs required by Stage 1 operations.
- Keep Stage 1 calendar-domain jobs limited to event completion, weekly
  occurrence generation, and 12-month logical archival; run only the maintenance
  jobs required for invitations, premium assets, anonymization, and retention.
- Limit Stage 1 audit to critical lifecycle, access, publication, banner, and
  entitlement actions.
- Separate internal platform admins and moderators from store memberships.

Do not implement during Stage 1:

- Player profiles, player tags, player avatars, or player QR credentials.
- Internal event registrations, capacity, occupancy bars, cancellation,
  reinstatement, or registration notifications.
- In-app notifications.
- Scheduled store or branch closure plans.
- Attendance, points, rewards, payments, or dependent profiles.

During Stage 1, event registration mode is limited to `external` or `disabled`.
`disabled` is the default; `external` requires a valid external registration
URL. Stage 1 does not create internal-registration or capacity fields.
External registration URLs require HTTPS and are opened only through an
explicit public action that indicates the user is leaving VortexHub.
Preserve the accepted boundaries for future internal registration, identity,
QR, attendance, and points without creating their tables or user flows early.

### Later MVP Stages

After evaluating Stage 1 community usage:

1. Player identity and QR.
2. Internal registration and capacity.
3. Attendance, points, and rewards as separately approved capabilities.

## Target MVP Capabilities

### Store Management

- Register a store.
- Activate eligible stores through an audited owner self-service action without
  manual VortexHub approval.
- Optionally manage multiple branches; stores may operate using only custom or
  online event locations.
- Upload and manage a public store logo as a core Stage 1 capability. Store
  logos are part of basic store identity and do not require a premium
  entitlement.
- Associate authenticated accounts as owner, admin, or staff.
- Invite store members through seven-day opaque invitations accepted by the
  same verified authenticated email.
- Snapshot intended branch assignments in branch-scoped invitations and create
  them atomically on acceptance.
- Explicitly scope admin and staff memberships to the whole store or to
  specific branches. Owners always have store-wide scope.
- Require every active store to retain at least one active owner and audit
  ownership changes.
- Close branches through an owner-controlled scheduled workflow that allows
  final events before the effective date and cancels later events through an
  auditable bulk operation.
- Do not reassign events or series between branches during closure in the MVP;
  replacement activity is created separately.
- Use explicit draft, active, and inactive branch states. Reactivation is
  owner-only and does not restore cancelled activity automatically.
- Treat an active branch as one immutable physical venue; relocation requires
  closure and creation of a new branch.
- Use explicit pending, active, suspended, and closed store states. Owner
  closure is scheduled and auditable; VortexHub suspension is a separate
  administrative action.
- Treat closed stores as terminal during the MVP; only administrative
  suspensions may be reversed.
- Manage premium capabilities through store entitlements granted manually by
  VortexHub during the MVP, without storing payment transactions. During the
  pilot, tester stores should receive active custom-banner access by default;
  after official launch this access becomes the premium entitlement gate.

### Events And Calendar

- Create, edit, publish, cancel, and complete events.
- Require a brief public message when cancelling a published event.
- Assign every event and series to one representative organizing store, even if
  future collaboration metadata is introduced.
- Create basic weekly recurring event series that generate concrete,
  independently manageable event occurrences.
- Publish the following Monday-through-Sunday occurrences automatically every
  Sunday according to each series' timezone.
- Protect events with registrations from silent material changes and preserve
  registrations when an event is cancelled.
- Complete events automatically after their end while keeping completion
  separate from attendance, points, rewards, and payment state.
- Support branch, custom-location, and online events with explicit location
  semantics and authorization scope.
- Provide free VortexHub-managed event banners and store-owned custom banners.
  Custom banners are open to tester stores during pilot and become premium
  after official launch. Past events may fall back to a platform banner after
  custom media is removed.
- Validate, optimize, limit, and moderate store logo and custom banner uploads.
- Archive completed or cancelled occurrences logically after 12 months without
  deleting their history.
- Keep the public calendar focused on future and active events while preserving
  basic direct-link pages for published past and archived events.
- Publish one public event page identified by a slug.
- Generate readable public slugs automatically and keep them immutable after
  first publication or activation.
- Browse a public calendar.
- Filter the public calendar by game, date, city, and store.
- Derive city from the event's branch or explicit custom location; online
  events use a dedicated `Online` filter.
- Use `Miscelaneo` for deliberately broad or multigame gatherings.
- Use `Otros` with a required specific game name when the applicable game is not
  represented in the VortexHub-managed catalog.

### Player Identity

- Register and authenticate an account.
- Require users to declare that they are at least 18 years old during the MVP.
- Store immutable, versioned evidence of the adult-age declaration without
  collecting a birth date or identity document.
- Maintain a separate minimal player profile containing a nickname and optional
  avatar, without collecting legal names or restricted logistics data.
- Assign each player an immutable random public tag for authorized
  disambiguation without enabling public lookup or claiming verified identity.
- Allow nickname changes every 30 days with reserved-name checks and internal
  temporary moderation history.
- Support optional moderated player avatars with optimized contextual display
  and no store access to source uploads.
- Create the player profile lazily through a short onboarding step when the
  user first registers for an event or opens their QR, then resume that action.
- Generate and rotate a personal QR containing a high-entropy opaque secret,
  while persisting only its hash.
- Allow QR resolution only during authenticated, authorized store actions.
- Limit QR resolution to short-lived event-scoped identity and authorized
  actions without exposing a navigable player profile.
- Allow players to rotate QR credentials through rate-limited self-service with
  immediate revocation of the previous credential.
- Require online QR resolution during the MVP without offline player caches or
  embedded identity data.
- Never infer attendance from QR resolution or registration; future attendance
  remains a separate explicit fact.

### Registration

Each event declares exactly one mode:

- `internal`: VortexHub is the source of truth for registrations and capacity.
- `external`: an external system is the source of truth; VortexHub links to it.
- `disabled`: the event is informational or registration occurs outside a
  tracked workflow.

Internal registration is a later MVP stage and is not implemented in Stage 1.

For internal registration:

- A player can register once per event.
- A player may cancel their own confirmed participation.
- A cancelled player may request reinstatement while registration remains open;
  staff or owners must approve it subject to current capacity.
- Pending reinstatement requests expire automatically when registration closes.
- Do not impose a numeric cancellation or reinstatement-request limit; operator
  approval and transition history control repeated abuse.
- Limit operator review for reinstatement to the target registration's
  transition history in the current event.
- Allow another reinstatement request after rejection while registration remains
  open, preserving each request and decision in history.
- Use structured reinstatement rejection reasons visible to the player while
  keeping optional internal notes private.
- A player may register themselves through self-service.
- Authorized store operators may register another player only by scanning the
  player's active QR in the context of the event.
- Store operators may register themselves as players, but their role never
  bypasses registration rules.
- Stores cannot search a global player directory, manually identify a player,
  or create player profiles.
- Capacity must be enforced atomically.
- A null capacity means unlimited capacity.
- When a defined capacity is full, new registration attempts are rejected until
  a confirmed player cancels and releases a slot.
- Active internal events with defined capacity show a public occupancy progress
  bar and exact aggregate count, but never participant identities.
- Registration opens at publication when no explicit opening time exists and
  closes at event start when no explicit closing time exists.
- Authorized staff and owners may manually cancel registrations from the
  event's operational list without a new QR scan, using a structured store
  cancellation reason.
- Payments are handled outside VortexHub.

Entry fees are informational only. VortexHub does not store discounts, payment
status, collections, or refunds during the MVP.

For external registration, VortexHub stores only the external URL and public
event information. It does not mirror participants or participant counts.

### Notifications

- Deliver notifications only inside VortexHub during the MVP.
- Notify affected users about store registration cancellation, reinstatement
  decisions, event date or time changes, and event cancellation.
- Notify authorized owners and staff about reinstatement requests, grouped by
  event; do not notify admins.
- Resolve grouped reinstatement notifications automatically when no requests
  remain and reopen them if a later request arrives.
- Do not send transactional email, SMS, or push notifications.
- Retain in-app notifications for 12 months.

## Future Capabilities

These are anticipated but not part of the MVP:

- Event attendance and QR check-in.
- Store-scoped point ledgers.
- Rewards and redemptions.
- Guardian-managed dependent player profiles, after legal review.
- Structured event logistics requirements, only after completing their privacy
  and retention design.
- More complex recurrence rules beyond weekly schedules.
- Radius search, distance ordering, user geolocation, and maps.
- Waitlists and automated promotion.
- Tournament operations such as pairings and results.
- Payment processing.

## Core Product Invariants

1. There are no anonymous or store-created player identities.
2. Player identity is global across VortexHub, not duplicated per store.
3. A QR identifies a player but grants no permissions.
4. Public resources use slugs; internal UUIDs remain internal.
5. Registration and attendance are separate facts.
6. One event has one game and one registration source of truth.
7. Private player data is disclosed only for a specific, authorized purpose.
8. Exposed database tables use deny-by-default RLS; complex domain writes use
   explicitly authorized transactional RPC functions.
9. Audit records are append-only, action-specific, and contain no secrets or
   unnecessary personal data.
10. Future points use store-scoped immutable ledger movements; MVP tables do not
    carry editable point balances.
11. Points and rewards never transfer across stores; branches share only their
    parent store's future ledger.

## MVP Retention Baseline

- Event registrations remain while their event exists.
- Legal acceptances are retained permanently as immutable evidence.
- General audit events are retained for 24 months.
- QR, security, restricted disclosure, and other sensitive-action audits are
  retained for 36 months.
- Expired audit data is deleted or irreversibly anonymized by an auditable
  retention process.
- Retention periods require legal review before production.

Account deletion deactivates and anonymizes the account and player profile,
revokes QR credentials and store memberships, and preserves only the internal
references required for historical integrity and retained legal evidence.
Irreversible anonymization occurs after a 30-day grace period while all access
remains disabled.
