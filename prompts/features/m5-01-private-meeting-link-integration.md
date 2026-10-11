# Implementation Plan — Private meeting-link integration

## Status and authority

**BLOCKED — planning draft, not authorized for implementation.**

On 2026-10-11 the user accepted the recommendation to prepare an integration
blueprint with missing dependencies marked blocked. That authorizes this document
only. It does not approve a link-reuse policy, database change, UI, route or booking
implementation. The prior `AUTHORIZED — build-feature delegation` applies only
to `m5-01-meeting-link-validator.md`, not to this expanded slice.

Repository: `/Users/cob/orca/workspaces/learli/m5-meeting-link-validator`.
Observed branch: `cob-g/m5-meeting-link-validator`, HEAD `2803d1f`.
Keep this worktree for planning; no new branch is proposed now. Future integration
branch/base must be selected after the prerequisite changes are available here.
Do not edit another checkout or take over the other session's M4.1 availability.

Pre-existing work at planning start: modified `context/progress-tracker.md`;
untracked validator, validator tests, `docs/meeting-link-validation.md`, and
`prompts/features/m5-01-meeting-link-validator.md`. Ignored `memory.md` exists.
Preserve these files. This planning task adds only this blueprint.

## Required context

Read `AGENTS.md`, then these canonical files in order:

1. `context/project-overview.md`
2. `context/architecture.md`
3. `context/ui-context.md`
4. `context/code-standards.md`
5. `context/ai-workflow-rules.md`
6. `context/progress-tracker.md`
7. `context/prd.md`
8. `context/build-plan.md`

All are present and were read during this conversation; unchanged context is
reused. Recheck relevant decision records and actual code before implementation.
Canonical lowercase paths override historical mixed-case references.

## What we are building

Proposed future Backend + Database + UI slice: the assigned tutor supplies a
validated link privately for a booking; the eligible learner or authorized
guardian can retrieve it only when that booking's approved access rule allows.
The UI opens the lesson externally and handles missing or unavailable links
truthfully. A link never establishes attendance, existence or authorization.

## Requirement and milestone mapping

- Primary: M5.1 / MEET-01 protected storage and mutation; M5.2 / MEET-02 reads.
- Related: MEET-03 external boundary, AUTH-03, BKG-04, BR-08, BR-14, NFR-05;
  QA-13, QA-14, QA-19 and affected QA-20.
- Prerequisites: M4.4 authorized learner relationships, M4.5 booking data,
  M4.6/M4.9 booking ownership and lifecycle, a protected booking-detail surface.
  Availability alone does not supply these prerequisites.
- Full M5 dashboards, email, support and other milestone work remain separate.

## Current repository evidence

| Area | Observed evidence | Consequence |
| --- | --- | --- |
| URL validation | `src/lib/validation/meeting-link.ts`, unit tests and supported-format document | Reuse unchanged; do not add network probes |
| Identity | `src/lib/permissions/access.ts`: verified active identity, trusted roles, ownership helper with no admin bypass | Reuse identity checks; roles alone cannot authorize a booking |
| Mutation boundary | `src/lib/mutation-handler.ts`, `src/lib/auth-handler.ts`: bounded JSON, same-origin checks, private responses and safe errors | Follow existing local runtime conventions; do not relax CSRF/origin checks |
| Data | `src/lib/db/schema/app.ts` contains identity access/roles, subjects, tutors and audit events; migrations currently end at `0005_tutor_profile_slug` | No bookings, learner profiles or guardian links exist here |
| Feature surfaces | `src/features/` and `src/app/` contain account, tutor, catalog and matching work | No booking service/detail surface to extend yet |
| Audit | Existing audit events target users/subjects, not bookings | Needs a reviewed booking event/target model; never put URLs into audit metadata |
| Test environment | No worktree `.env.test.local` or owned isolated cluster was present at the validator handoff | Integration requires separate safe setup; do not borrow another session's database |

The validator's earlier check/build results apply to that library state only.
No integration implementation or verification is claimed by this plan.

## Language and decisions

No terminology clarification needed. A *booking link* is private joining data
associated with a booking. It is not a public tutor-profile field or proof that
Zoom/Meet will admit anyone.

Established decisions: external Zoom/Meet lessons, native URL validator, server
identity and exact-record checks, no attendance inference or public link exposure.

**Recommendation, not approval:** start with an explicit link record for each
booking, with no automatic tutor-level default or copying between bookings. This
makes ownership and changes traceable. It does not technically ensure that a tutor
created a unique provider room; URL validation cannot establish that fact.
If reusable configuration is chosen, revise this draft to define snapshot versus
live-reference behavior, replacement effects and access across bookings before
implementing it. Do not build both models speculatively.

## Blocking decisions and dependencies

| Blocker | Owner | Required before implementation |
| --- | --- | --- |
| D-13: per-booking versus reusable link | Founder/product | Record approved model and whether reuse is permitted; do not equate accepting numeric PMI syntax with approval |
| Read/write lifecycle | Product, with safeguarding review | Define tutor entry/replacement eligibility, learner/guardian access timing, cancelled/completed/expired behavior, reschedule effects and any removal operation; no guessed windows |
| Learner and guardian authorization | M4 implementation plus policy owner | Inspectable trusted relationships and eligible self-managed learner path; revoked relationships must lose access |
| Booking ownership and status | M4 implementation | Persisted assigned tutor/learner, approved or explicitly test-only lifecycle, reusable access checks and coordinated mutation locking |
| Booking-detail UI | Booking implementation | Protected detail surface with ownership checks and honest states; avoid building a parallel booking system here |
| Support access | Product/security | A task-scoped support capability and audit requirement before enabling support read/write; admin role alone never suffices |
| Isolated test services | Integration implementer | Owned disposable database/configuration and known-safe scripts/ports; no shared database resets |

Support operations may be deferred explicitly to their own slice; until then
there is no general admin override. Real-minor use remains gated by guardian,
tutor-screening and meeting-safeguarding approvals. No consent or safety copy is
invented here. These gates remain open even if local synthetic integration passes.

## Conditional data and authorization design

The following is the recommended per-booking design, pending the decisions above
and inspection of M4's real schema:

- Separate private `booking_meeting_links` table, at most one row per booking:
  booking foreign key/primary key, non-null provider and URL, updater and update
  timestamp, and integer revision for stale-edit detection. Absence means missing
  link. Derive provider from validation; never trust a submitted provider field.
- Review foreign-key deletion behavior against booking retention; do not introduce
  cascading deletion of booking history. Constrain provider, URL length and revision
  in SQL; the application remains responsible for the complete URL grammar.
- Keep links out of ordinary booking list DTOs. Fetch through a dedicated private
  service after exact-record authorization. Explicit selections prevent accidental
  propagation into public tutor queries or future booking summaries.
- Record a minimal booking event for a successful change: booking reference, actor,
  action, time and revision only. No old/new URL, passcode, request body or private
  provider token in history, errors, traces, analytics or notification payloads.
- Apply one transaction/locking contract shared with booking reassignment, status
  changes and relationship revocation. Recheck authoritative ownership, eligibility
  and status for the write; a detached earlier permission check is insufficient.
  Document how concurrent revocation is serialized in the actual M4 implementation.
- A replacement supplies the expected revision. Stale concurrent edits return a
  conflict; identical retries at the current revision may return unchanged without
  another audit event. A stale retry must never overwrite a newer link. Do not
  alter booking status, time, eligibility or payment state when saving a link.

| Actor | Read | Write |
| --- | --- | --- |
| Assigned tutor | Only under approved account/booking rules | Only their assigned booking under approved edit rules |
| Eligible independent learner | Only their own booking under approved status/time rules | Denied |
| Authorized guardian | Only the linked learner's booking under approved status/time rules | Denied |
| Unrelated user or tutor | Denied, same response as nonexistent booking | Denied, same response as nonexistent booking |
| Admin/support | Denied unless a specific approved support capability exists | Same; no role-only override |
| Signed out, unverified or suspended identity | Existing identity boundary denies | Existing identity boundary denies |

Authorized absence, policy-unavailable access and infrastructure failure must be
distinct domain outcomes. Never return a URL as part of a denied/missing response.

## Proposed affected areas and workflow

All new paths below are **proposed**, not existing components:

- `src/features/bookings/meeting-link-service.ts` and a focused handler/input
  module using the actual booking access service introduced by M4.
- `src/app/api/bookings/[bookingId]/meeting-link/route.ts`: private GET and PUT.
  PUT takes only URL and expected revision; reject extra identity/status/provider
  fields. Use existing bounded JSON and same-origin protections. Authenticate,
  validate, authorize, transact, then return minimal private data.
- Existing schema export/runtime grants/migration workflow, with a new migration
  number allocated after M4 integration, never editing applied migrations.
- A meeting-link form and provider-labelled join action on the future protected
  booking-detail page; exact location follows that page's actual structure.
- Unit, PostgreSQL integration and booking-detail browser tests.

GET/PUT responses use private no-store behavior. Do not place URLs in route/query
parameters or redirect through a Learli endpoint. Disable prefetch for the external
action, use a normal anchor with `target="_blank"`, `rel="noopener noreferrer"`
and `referrerPolicy="no-referrer"`; identify the provider and new-tab behavior.
Do not load embeds, previews or third-party resources before deliberate navigation.

The tutor form shows supported-format guidance and safe field validation without
echoing raw parser errors. A failed save preserves the entered value locally and
reports failure, never success. An authorized missing-link view says that no link
has been provided; denied access follows the existing private not-found pattern.
Policy-unavailable access and approved meeting-safety wording depend on the policy
decisions above. Existing shared tokens, labels, focus and mobile layouts apply.

## Scope exclusions

No availability changes or `src/lib/time` edits; no booking engine, guardian model,
payment rules, broad dashboards, notifications, public link fields, personal data
collection, OAuth/provider APIs, fetching/DNS validation, calendar integration,
video, attendance, recording or unrelated refactoring. No new dependencies planned.
No migration, test setup, application edit, commit, push, merge, deployment or
outside-worktree operation is authorized by this planning task.

## Incremental implementation handoff — after gates are resolved

1. Inspect the integrated M4 base and preserved validator; replace proposed paths
   with real extension points. Record product decisions in the governing documents
   and decision record; obtain implementation authority for the revised blueprint.
2. Add reviewed private link storage, minimal audit/event support and runtime grants
   against an owned isolated test database. No provider calls or real invitations.
3. Implement dedicated authorized read/write services, input validation, status
   policy, revision conflicts and safe errors; test database denial and race paths.
4. Wire the private endpoint and minimal booking-detail form/join/missing states.
   Keep broad booking lists and public pages free of the URL field.
5. Perform scoped read-only Review, then separate verification below. Update actual
   tracker evidence and local handoff in the implementation workflow only.

## Planned verification and acceptance — NOT RUN

- Existing scripts: `npm run check`, `npm run test:integration`, `npm run build`,
  `npm run test:e2e`, plus diff/secret review. Inspect their side effects first.
  Tests requiring a database cannot be waived as proof of an integrated feature.
- Valid Zoom/Meet save/read roundtrip, normalization/provider derivation, missing
  record, replacement, stale revision, duplicate retry, unsupported URL rejection
  and no data change on failure; preserve all standalone malicious-input tests.
- Real PostgreSQL cases for every actor row above: cross-tutor, cross-learner,
  wrong/revoked guardian, multi-role unrelated admin, unverified/suspended account,
  forged owner/provider/status fields, anonymous requests and cross-origin writes.
- Race replacement against replacement, reassignment, cancellation and guardian
  revocation using the actual booking lock contract. Assert committed rows/events
  and continued correctness of booking overlap, time and lifecycle invariants.
- Exercise each approved status/time boundary on reads and writes, including
  timezone-independent instant comparisons if an access window is approved.
- Assert no URL/passcode in public HTML/metadata, list DTOs, denied responses,
  request/error logs, audit events, analytics, shared cache or browser traces.
  Do not persist private tokens in test screenshots/reports; use synthetic data.
- Browser journeys for tutor save/replace, learner and guardian authorized join,
  missing/unavailable/failed states and unrelated-user denial. Assert link target
  and attributes without visiting the provider or inferring attendance.
- Mobile/desktop at 390 and 1440 pixels, 320-pixel overflow, keyboard/focus and
  relevant accessibility checks; approved copy and existing theme conventions.
- Apply the new migration to a fresh isolated schema and test constraints/grants.
  Rollback plan: stop exposing link reads/writes while retaining private data and
  history; no automatic destructive down migration. Never reset another cluster.

Expected evidence: exact commands, environment ownership, code revision, pass/fail
counts and sanitized artifacts. Remote/provider/production acceptance is separate
and requires its own authorization. No tests or builds ran in this planning stage.

## Context updates, risks and approval gate

After actual decisions, update PRD MEET-01/02 and relevant business rules,
architecture §13/private storage design, and a concise `docs/decisions/` record.
Update UI context only if the approved interaction changes its rules. Keep build
plan dependencies intact. Tracker changes belong to verified implementation work;
none are made for this draft.

Risks: provider URLs remain secrets after validation; already-disclosed links cannot
be revoked at Zoom/Meet by hiding them in Learli. Per-booking storage does not prove
unique rooms or meeting safety. Revocation/caching races and generic DTO leakage
must be tested. The validator's intentionally narrow subset may reject legitimate
provider variants; follow its documentation rather than silently stripping fields.

**Blueprint blocked — link model and lifecycle/access policy are unresolved, and
booking/learner ownership plus isolated integration services are absent here.**
Owner decisions and implementation prerequisites are listed above. Planning is
complete for this request; no implementation approval or M5 completion is implied.
