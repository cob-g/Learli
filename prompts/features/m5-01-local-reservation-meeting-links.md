# Implementation Plan — Private meeting links for local reservations

## Authority and baseline

**AUTHORIZED — build-feature delegation**, 2026-10-11. The actual user request
"ok lets do it and spawn agents what you need to spawn" authorizes the bounded
Agent 1 slice in `/Users/cob/learli/prompts/features/m5-06-four-feature-coordination-wave.md`.
This is delegated execution authority, not separate human blueprint approval.
Checkout: `/Users/cob/orca/workspaces/learli/m5-private-meeting-links`; branch
`cob-g/m5-private-meeting-links`; clean baseline `024dd4d7ce885da7ca391aefeaf4096fc75fc91e`.

## Outcome and mapping

An assigned active, verified, approved synthetic tutor saves/replaces a validated
test Zoom/Meet URL on one live simulated reservation. Its currently eligible
tutor, self-managed college learner or authorized guardian can access the link.
PRD MEET-01/02/03, AUTH-03, BKG-04, NFR-05; build-plan M5.1/M5.2/M5.11, V12.
No terminology clarification or new material decision is needed: the wave
contract chooses separate per-reservation storage and existing simulation TTL.

## Inspected evidence and scope

Existing `meeting-link.ts` validator is retained byte-for-byte. Booking detail
uses participant read services; general booking DTOs intentionally omit links.
Existing local identity, synthetic learner, booking and notification decisions
remain governing. Read AGENTS and eight canonical context files in prescribed
order; use existing UI tokens, native controls, private headers and JSON boundary.

Proposed owned module `src/features/booking-meeting-links/`, private schema
`src/lib/db/schema/booking-meeting-links.ts`, additive local migration0013,
`/api/bookings/[bookingId]/meeting-link`, scoped unit/PG/browser tests.
Shared patches: schema export, migrate-local runtime grants, Playwright project,
booking-detail page and its presentation section slot, canonical context notes.
Root reconciles these with other workers. No peer imports or nested workers.

## Data and authorization invariants

One private row per booking: normalized URL/provider, monotonic revision,
last request UUID, actor and timestamp. Separate append-only safe edit history
contains booking/revision/request/actor/time only, with unique booking+revision
and booking+request constraints. No URL, passcode or URL hash in audit.
Initial revision1; expected revision0 creates. Stale writes return409. Exact
immediate retries return current safe revision without another event; older
retries cannot overwrite newer revisions. Same request with changed input conflicts.

READ COMMITTED write locks tutor profile first (existing reservation protocol),
then booking state; final fresh SQL statement rechecks session expiry, active
verified synthetic account, current roles, exact tutor assignment, approved tutor,
active fixture learner, source/state and database clock after all waits. No
booking immutable fields/events or TTL changes. Read uses one current-authority
SQL snapshot with database time; denied/expired queries never select a URL.
No admin/support override, including unrelated multi-role staff.

## UI and endpoint behavior

Separate meeting section prop, never general booking DTO. Tutor sees bounded
labelled URL editor, revision and explicit save/replace action. Participants see
missing/present/expired/unavailable states. Errors, pending and stale conflict
are announced; conflict requires explicit reload before resubmission. Native
external action opens a test link in a new tab through a fresh authorized GET
redirect (`?open=1`), rechecking TTL/permissions at navigation, with no provider
preview/prefetch. JS-disabled users retain read/expiry states and native external
action; editor clearly requires JavaScript. No real lesson/attendance/safety
settings claim. Links already disclosed cannot be retracted outside Learli.

## Implementation sequence

1. Record local delegated decisions in PRD/architecture/decision doc.
2. Add private schema and reviewed additive migration plus column-limited grants.
3. Add input/model, current-authority query, locked service, safe GET/PUT boundary.
4. Integrate separate private meeting UI and tests; update partial tracker.
5. End Implement; read-only same-agent Review; separate Verify; scoped Recover
   if needed; final verified tracker and ignored memory/report handoff.

## Verification plan — NOT RUN, Architect only

Pinned npm ci, owned PostgreSQL17 DB55481/dev3041/test3141 only. Fresh migration
and actual0012→0013 upgrade compare prior row values and prove restricted grants.
Run npm run check, full test:integration, build, default test:e2e serialized on
owned test DB. New PG cases: participant/tutor saves and reads, wrong tutors,
unrelated/multi-role admins, role removal, guardian revocation, suspended/
unverified/expired sessions, pending/rejected/suspended tutors, expiry under
waited lock, both concurrent stale-edit orders/retries, atomic safe audit.
Privacy: general booking/list/public/profile/metadata/notifications/logs/client
assets omit stored URL. Browser project disables trace/screenshots of sensitive
state; captures only sanitized fixtures. Check320/390/768/1024/1440, keyboard,
axe, reduced motion and reflow, no-JS read/open. Never visit provider URLs.
Retain commands/exit statuses/failures/logs/hash manifest in ignored local report.

## Gates, rollback and handoff

Synthetic loopback local simulation only. No live provider visits, external mail,
production/remote operation, commit/push/merge or destructive reset. Real
guardian/legal/retention/commercial/incident/meeting-safety launch policies remain
OPEN. Rollback disables new surface while preserving rows/history. Root owns
combined migrations/grants/shared surfaces and independent review. No whole
milestone or launch-readiness claim.
