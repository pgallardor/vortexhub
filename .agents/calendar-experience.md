# VortexHub Calendar Experience Refinement

## Status

**Proposed product direction.**

This document refines public discovery and organizer calendar requirements that
are not fully defined in the accepted architecture decisions. It does not
silently change accepted Stage 1 scope, permissions, event lifecycle, recurrence,
audit, or physical schema requirements.

The initial experience should be validated with stores and players before any
promoted-placement or direct-manipulation behavior becomes accepted scope.

## Problem

Large visual event cards are useful for promotion and for explaining an
individual event, but they become inefficient when a city, game, or store has
many events on the same day or week.

Operators have the opposite problem. They need to understand schedule density,
conflicts, branches, drafts, and publication state. A card or table list can
support CRUD operations, but it does not provide a strong planning overview.

The public and operator experiences therefore should not share one presentation
or optimize for the same task:

- Public Home optimizes for discovery and promotion.
- Public calendar and store calendars optimize for scanning and comparison.
- Operator calendar optimizes for planning and operational navigation.
- Event forms remain responsible for explicit, validated mutations.

## Public Discovery Surfaces

### 1. Home As A Curated Overview

Home is a discovery landing page, not the complete event catalog. It should
contain up to three sections in this order:

1. **Promoted events happening today**
   - Uses large, image-forward cards.
   - Contains only events that are both eligible for public discovery and
     explicitly selected by a future promoted-placement policy.
   - Is omitted when no promoted events are available.
   - Must never imply that a custom-banner entitlement also grants promoted
     placement.

2. **All events happening today**
   - Uses a compact agenda or list presentation rather than large cards.
   - Sorts by effective local start time, then by stable tie-breakers.
   - Shows the minimum comparison information: time, title, game, store,
     effective location, and registration mode.
   - Allows the user to open the event detail page.

3. **Events during the current local week**
   - Uses a compact agenda grouped by day.
   - Covers the current Monday-through-Sunday week in the discovery timezone.
   - Excludes events already shown in the today section or clearly marks them
     without duplicating full content.
   - Provides a clear action to open the complete public calendar.

Filters applied on Home affect all visible event sections consistently. A
filtered Home may hide the promoted section when none of its events match.

### 2. Complete Public Calendar

The complete public calendar is the exhaustive public discovery surface for
future and currently active published events.

- Preserve accepted filters by game, date, city, and store.
- Default to a compact agenda grouped by day.
- Keep results suitable for high event density and incremental pagination.
- Allow a user to move to another date or date range without depending on the
  Home sections.
- Use event detail pages for descriptions, banners, and complete information.
- Do not expose drafts, internal UUIDs, unpublished events, or historical event
  browsing.

A visual month grid may be explored later, but it must not replace the compact
agenda as the only mobile or accessibility-friendly representation.

### 3. Public Store Calendar

A store calendar should use the same compact agenda principles as the complete
public calendar, scoped to one store.

- Filter by game, date, and branch when applicable.
- Group dense results by day.
- Keep banners and large cards for selected promotional content or event detail,
  not for every occurrence.
- Continue using stable public slugs and direct event links.

### 4. Future Official Share Links

VortexHub should eventually provide official short share links for store
calendars and individual events. These links optimize for posters, QR codes,
social posts, chat messages, and other places where canonical public URLs can
become too long or visually noisy.

This is future scope and must not replace canonical public routes. Canonical
store and event URLs remain readable slug routes such as
`/stores/{store_slug}` and `/stores/{store_slug}/events/{event_slug}`. Official
short links are an additional sharing layer that redirects to the canonical
route.

Use a dedicated short domain only after VortexHub has selected and secured an
appropriate domain. The short domain should be treated as an official product
surface, not as a third-party URL shortener. Candidate domains must be assessed
for availability, renewal cost, ccTLD policy risk, brand clarity, and user
trust before launch.

Recommended future link shapes:

- Store calendar default: `https://{short-domain}/s/{code}`.
- Event default: `https://{short-domain}/e/{code}`.
- Store vanity alias, when approved: `https://{short-domain}/{store_alias}`.
- Event vanity alias, when approved:
  `https://{short-domain}/{store_alias}/{event_alias}`.

Default event links should use short opaque codes because event titles can be
long, repeated, edited before publication, or date-specific. Vanity aliases are
a convenience layer for stores or selected events, not the source of truth.

Rules:

- Do not permit arbitrary external redirect destinations in the initial
  implementation.
- Resolve only to VortexHub-owned canonical public destinations.
- Do not expose internal UUIDs, sequential identifiers, draft resources, hidden
  stores, unpublished events, or private player/profile data.
- Cancelled published events may continue resolving to their canonical event
  page with the cancellation state visible.
- Hidden, closed, deleted, or unauthorized destinations should return a neutral
  not-found or gone state rather than leaking private status details.
- Reserve platform route words and brand-sensitive aliases such as `admin`,
  `api`, `auth`, `stores`, `events`, `login`, `support`, and official-looking
  names.
- Custom vanity aliases must be moderated or otherwise controlled to avoid
  impersonation, offensive terms, and confusion with platform-owned surfaces.
- Short-link analytics should start with minimal aggregate counts. Any storage
  of IP address, user agent, referrer, or location-derived data requires a
  privacy and retention decision before production.

## Meaning Of "Promoted"

VortexHub currently has no accepted definition or Stage 1 schema for an
"important", "featured", or promoted event. This concept must not be inferred
from event size, custom banners, store status, or arbitrary client ordering.

Before promoted placement is implemented, define and accept:

- Who may select promoted events: VortexHub editorial staff, an entitlement,
  a paid product, or a combination.
- Eligibility and moderation rules.
- Placement duration, ordering, and geographic or game targeting.
- Labeling so users can distinguish promoted placement from organic relevance.
- Fairness rules and behavior when more eligible events exist than available
  positions.
- Required audit and entitlement changes.

Until then, the promoted Home section is optional and Stage 1 may render only
the compact today and week sections. The existing
`custom_event_banners` entitlement grants banner customization only.

## Date And Time Semantics

Public day grouping must use an explicit discovery timezone.

- A store calendar uses the store or relevant event timezone for display.
- An event detail uses the event timezone.
- A city-filtered calendar should use the effective location's local timezone
  when that can be represented unambiguously.
- A mixed-location Home needs one clearly displayed discovery timezone and must
  not silently group events using the server timezone.
- Online events retain their event timezone and appear under the accepted
  `Online` location filter.

The initial implementation may derive the discovery timezone from an explicit
user-selected city or configured market. Automatic geolocation is out of MVP
scope.

## Organizer Calendar Workspace

### Goal

The organizer calendar is the primary overview for an authorized store
operator. It helps answer:

- What is happening today and this week?
- Are two events competing for the same branch or time?
- Which occurrences are drafts, published, cancelled, or completed?
- Which events are independent occurrences and which came from a weekly series?
- What can this operator view or manage within membership scope?

### Initial Views

1. **Agenda**
   - Required and the default on small screens.
   - Groups events by day and works well for dense schedules.

2. **Week**
   - Recommended default on larger screens.
   - Displays events across the week with time and branch context.
   - Makes parallel events easy to distinguish without presenting overlap as a
     warning or invalid state.

3. **Month**
   - Optional planning overview after agenda and week views are validated.
   - Shows event density and opens a selected day or event.
   - Is not the primary editing surface.

The workspace should preserve the selected date, view, and filters when the
operator opens an event and returns.

### MVP Navigation Decision

For Stage 1, the organizer experience should make **Calendar** the primary
store workspace for planning, while keeping event occurrences and weekly-series
templates as distinct concepts.

Use three connected admin surfaces:

1. **Calendar**
   - Primary planning surface.
   - Shows concrete event occurrences in week or agenda form.
   - Provides actions to create a one-time event, create a weekly series, edit a
     concrete occurrence, or jump to the series template.
   - Uses the full available workspace width for the calendar grid on larger
     screens.
   - Marks occurrences generated by weekly series directly on the event card.

2. **Events**
   - Operational list or table of concrete event records.
   - Best for scanning statuses, editing a known occurrence, and later bulk or
     search workflows.
   - Does not edit weekly-series templates directly.

3. **Series**
   - Management surface for recurrence templates.
   - Used when the operator wants to change future generation rules rather than
     one concrete occurrence.

This keeps the organizer's mental model centered on dates without hiding the
important domain boundary: a series is a template; a generated occurrence is an
event. Calendar actions must name that distinction explicitly, for example
`Editar evento` versus `Editar serie`.

Do not use a persistent series side panel in the MVP calendar. Series context is
shown where it is actionable: the event card indicates that an occurrence comes
from a series, and the event edit screen provides a direct link to the source
series template for convenience.

### Required Filters And Visual States

- Branch, subject to the operator's membership scope.
- Game.
- Event lifecycle status.
- One-time occurrence versus series-generated occurrence.

Each visible event must distinguish:

- `draft`, `published`, `cancelled`, and `completed`.
- One-time events and series-generated occurrences.
- Individually edited series exceptions.
- Branch, custom-location, and online events.

Cancelled and completed events may be hidden by default from the active
operational view, but must remain available through explicit status filters
while retained and authorized.

### Interaction Boundaries

Selecting an event opens an operational summary with explicit actions such as
view, edit, publish, or cancel according to role and scope.

For the initial organizer calendar:

- Keep event creation and editing in validated forms.
- Allow creation from a selected date or time only by pre-filling a new-event
  form.
- Do not change event dates or times through drag-and-drop.
- Do not resize events to change duration.
- Do not bulk-edit concrete occurrences from the calendar.
- Keep weekly-series templates in their own management flow; generated
  occurrences appear on the calendar as concrete events.

Direct manipulation may be reconsidered only after defining confirmation,
authorization, timezone, series-exception, audit, and rollback behavior.

### Parallel Events And Resource Conflicts

Overlapping events are valid and common. A smaller community may share a store
with a larger community while both events run in parallel. The organizer
calendar must not present time overlap by itself as a warning, error, or
exceptional state, and Stage 1 must not reject an event solely because its time
overlaps another event.

When several events overlap, the calendar should present them neutrally as
parallel events and keep their game, branch or effective location, and lifecycle
state easy to distinguish.

Only warn about a conflict when VortexHub has an explicitly modeled resource
that cannot support both reservations, such as a specific room, table group, or
assigned operator. Stage 1 has no such resource model, so it has no automatic
schedule-conflict warnings.

## Stage 1 Delivery Recommendation

Deliver the refinement incrementally without changing the Stage 1 physical
schema:

1. Replace the all-card Home result grid with compact, date-grouped today and
   current-week sections.
2. Introduce a complete public agenda route using the existing public calendar
   query and accepted filters.
3. Change public store calendars to a compact date-grouped agenda.
4. Add an organizer Calendar route as the primary store planning workspace,
   backed by authorized store event reads.
5. Keep Events and Series as separate operational management routes connected
   from the Calendar through explicit actions.
6. Add organizer agenda and week views, validating timezone grouping and
   parallel-event presentation before attempting direct manipulation.
7. Defer promoted placement, organizer month view, drag-and-drop, and inline
   series editing until their unresolved decisions are accepted.

Stage 1 organizer views must respect existing owner, admin, staff, store, and
branch scope rules. Staff remain read-only.

## Acceptance Criteria For The First Refinement

- A user can scan every matching event happening today without opening large
  cards one by one.
- A user can scan the remaining current-week schedule grouped by day.
- A user can open the complete public calendar when Home is insufficient.
- A dense day with many events remains usable on mobile.
- Home, complete calendar, and store calendar use consistent filters and event
  detail links.
- An operator can view an authorized store schedule as an agenda grouped by day.
- An operator can distinguish status, branch, series occurrence, and series
  exception without opening each event.
- An operator can understand parallel events without the calendar presenting
  valid time overlap as a problem.
- Calendar navigation never bypasses explicit event lifecycle actions,
  validation, authorization, or audit requirements.
- No promoted placement is implied or implemented without a separately accepted
  policy and entitlement model.

## Validation Questions

- What timezone or market should the general Home use before a visitor selects
  a city?
- Should the current-week Home section show all remaining events or a capped
  preview followed by a complete-calendar action?
- Which information is essential in a compact public agenda row on mobile?
- Do stores understand the distinction between a weekly-series template and its
  generated occurrences?
- Do operators prefer agenda or week view as the desktop default?
- Which cancelled or completed events must remain visible in daily operations?
- Is promoted placement an editorial tool, a premium entitlement, a paid
  product, or intentionally excluded from the initial launch?
