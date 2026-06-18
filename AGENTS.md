# VortexHub Agent Instructions

## Project Context

VortexHub is an MVP platform for trading card game stores. Its primary purpose is
to provide a unified, shareable event calendar and a reusable player identity
across multiple stores.

Read these files before proposing architecture or implementing product behavior:

- `.agents/product-context.md`
- `.agents/calendar-experience.md`
- `.agents/data-model.md`
- `.agents/architecture-decisions.md`
- `.agents/stage-1-data-model.md` when implementing MVP Stage 1

Treat the decisions marked as accepted in those files as requirements. Do not
silently replace them with simpler alternatives.

For MVP Stage 1 implementation, `.agents/stage-1-data-model.md` is the physical
schema and delivery source of truth. Do not create later-stage tables or columns
during Stage 1.

## MVP Priorities

Build and optimize for these capabilities:

1. Store registration.
2. Store visual identity, including uploaded logos and event banners.
3. Branch administration.
4. Event creation and editing.
5. Public calendar with filtering by game.
6. Authenticated user registration.
7. Player profiles and personal QR identifiers.
8. Internal event registration, with external registration supported per event.

Attendance, points, rewards, tournament pairings, and payment processing are not
MVP features. Keep the model ready for them without implementing them early.

## Domain Rules

- Use PostgreSQL and UUID primary keys.
- Store timestamps as `timestamptz` in UTC.
- Every mutable domain table must include `created_at` and `updated_at`.
- Use `deleted_at` for soft deletion where historical identity or references
  matter.
- Authentication accounts and player profiles are separate concepts.
- A regular player profile must belong to an authenticated user account.
- A dependent minor profile may instead be managed by an authenticated guardian
  through `player_guardianships`.
- Stores must never create unclaimed or unauthenticated player profiles.
- A user account may be a player, belong to store staff, or both.
- Players do not belong directly to stores. Their relationships with stores are
  established through registrations, attendance, and future point activity.
- An event belongs to exactly one game. Use the seeded games `Miscelaneo` or
  `Otros` when a specific game does not apply.
- Each event must use exactly one registration mode: `internal`, `external`, or
  `disabled`.
- Do not allow simultaneous internal and external registration for one event.
- Attendance is distinct from registration and must eventually use a separate
  table.
- Points must eventually be represented as an immutable ledger, never as only an
  editable balance.

## Authorization And Privacy

- Public pages may expose store, branch, event, game, and calendar information
  through slugs.
- Do not expose internal UUIDs as public resource locators.
- A player QR is an opaque public identifier, not an authentication credential
  and not an authorization mechanism.
- Resolving a player QR requires an authenticated session and an authorized
  store-scoped action.
- QR scans and sensitive actions must be auditable.
- Only a store owner may access restricted player logistics data. Staff and
  admins must not receive that access by default.
- Share the minimum player information required for a specific event or action.
- Never expose a player's profile through a public QR URL.
- Avoid collecting identity documents or unnecessary sensitive information.

## Implementation Guidance

- Prefer database constraints over application-only guarantees.
- Use partial unique indexes for uniqueness among non-deleted records.
- Use transactions and row-level locking or an equivalent atomic strategy when
  consuming event capacity.
- Model state transitions explicitly. Do not infer attendance from registration
  or registration from QR scans.
- Version legal agreements and consent records.
- Keep event registration questions structured and purpose-specific. Do not add
  arbitrary custom data collection during the MVP.
- Any implementation involving minors, consent, data retention, or disclosure
  must be checked against `.agents/architecture-decisions.md` and flagged for
  legal review before production release.

## Out Of Scope Unless Explicitly Requested

- Tournament brackets, pairings, deck lists, and match results.
- Internal payment processing and refunds.
- Automated waitlist promotion.
- Public player lookup or public player profiles.
- Store-created guest players.
- Granular permission-builder systems.
- Multi-game event relationships.
