# M5.7–M5.8 — Local captured reservation-created notices

Status: **AUTHORIZED — build-feature delegation** for independent modules;
shared outbox/schema/grants authorized by coordinator `msg_3f2f42a57212`, with
the independent-pool refinement in `msg_89d6247b1c4f`. Migration **0012** allocated
exclusively to this worker. No separate human blueprint review claimed.
Date: 2026-10-11. Actual request: the six-feature wave dispatched this worker to
build local captured booking notifications with safe retries (OPS-04), creator
and assigned tutor only, with no email/network delivery or confirmed lesson.
This is execution authority, not separate human blueprint approval.

## What we are building

Backend/database/local integration slice: a committed synthetic reservation
creation event queues one minimal notice for each distinct creator/tutor account.
An explicitly invoked, bounded local command captures eligible pending notices in
ignored private files. A stale recipient or elapsed reservation suppresses the
notice with safe internal state. Auth verification/reset captures stay intact.

## Requirement and baseline

- PRD OPS-04, BR-03/04/07/12/15/16; build plan M5.7 and M5.8.
- Clean own worktree `/Users/cob/orca/workspaces/learli/m5-7-booking-notifications`,
  branch `cob-g/m5-7-booking-notifications`, HEAD
  `0c078bf50f9f967b20391ef3640353a7b3897e62`.
- Existing local capture: `src/lib/email/local-mail.ts`; booking service commits
  immutable `local_simulation` rows and `demo_reserved`/`demo_expired` events.
  Twelve baseline migrations and restricted runtime grants exist.
- Read AGENTS.md and the canonical eight context files; consult local M2 and
  synthetic booking decisions. Existing no-notification statement describes the
  prior baseline, not a prohibition on this newly requested local slice.

## Language and scope

No terminology clarification needed. Only **Simulated reservation created**;
capture says local capture, no email sent, no confirmed lesson. Minimal catalog
subject, stored UTC start/end/expiry rendered in recipient current IANA zone
(recipient-owned zone only; invalid recipient zone suppresses the notice),
and protected detail link. No learner name,
learner ID, school, age, guardian contact, meeting URL, token, or payment field.
No confirmation/expiry/cancellation messages, reminders, real users/minors,
Resend/provider call, Redis, always-on worker, or real commercial/consent policy.
Existing 60min/30min-step/60min-notice/14day/10min-TTL simulation stays fixed.

## Proposed transaction and authorization contract

1. New `booking_notification_deliveries` references the actual creation-event ID,
   recipient account ID and one fixed kind. Composite uniqueness prevents
   duplicate creator/tutor notices, including a legitimate multi-role account.
2. Additive AFTER INSERT creation-event trigger queues creator and assigned tutor
   with UNION in the booking transaction. It neither changes the existing booking
   mutation algorithm nor dispatches. A rollback removes its pending rows.
3. Dispatcher receives a real pg Pool, environment and origin; checks local-only
   gate, checks out its own connection and starts a separate READ COMMITTED
   transaction. It cannot see uncommitted event/outbox rows from an outer booking
   transaction. No DB transaction object is accepted as a dispatch connection.
4. Claim pending rows with FOR UPDATE SKIP LOCKED, bounded limit 1..25 per
   invocation. Fresh recipient eligibility/ownership and expiry projection runs
   after the claim using the same connection. Provider must supply a minimal
   account-ID notification projection with current verification/status/trusted
   role/exact relationship and synthetic gate; no session token is involved.
   New tutor notices require current approved review status; pending/rejected/
   suspended tutors are suppressed. This differs from historical detail access.
5. Fixed SHA256 event/recipient/kind filename; atomically publish one private HTML
   artifact using a same-directory temporary file and rename. Capture before DB
   acknowledgement may be retried; stable file identity avoids duplicate local
   artifacts. No exactly-once delivery claim: filesystem and PostgreSQL do not
   share one transaction. Existing captures are historical authorized snapshots.
6. Capture failure persists only a safe fixed failure code/attempt count and
   remains pending; booking state is untouched. Suppressed/captured terminal state
   records internal reason/time, not external delivery. No raw exception logging.

Runtime grants: SELECT(id, booking_id, event, created_at) on booking_events,
SELECT on deliveries and column-limited UPDATE of
state/attempt metadata only. Trigger alone INSERTs through a narrowly scoped
SECURITY DEFINER function with fixed search_path and revoked public execution.
No role/access/link/learner/booking-field grants added. Immutable delivery identity
and terminal state transitions protected by checks/trigger as needed. Schema
generation is offline after parent allocates the migration; baseline0000–0011
never change.

## Affected areas and dependencies

Proposed own files: `src/features/booking-notifications/{template,local-capture,dispatch}.ts`,
`src/lib/db/schema/booking-notifications.ts`, `scripts/local-booking-notifications.ts`,
unit/integration/browser tests, decision and operations document.
Shared own-checkout edits: schema/index, migration journal/snapshot/new migration,
scripts/migrate-local grants, default Playwright discovery, canonical docs.
No auth/global CSS/dependency/lockfile changes. No booking service edit planned;
announce unavoidable overlap before editing. Agent1 owns read/detail and final
protected link/auth contract; parent must authorize exact frozen file/hash import.
Agent4 owns public availability extraction; no overlap planned there.

## Incremental implementation

1. Save blueprint; obtain parent freeze/allocation for shared design.
2. Implement pure minimal HTML template and deterministic local capture adapter;
   validate inputs, escaping, loopback detail URLs and synthetic-only dispatch.
3. Add allocated delivery schema/atomic event trigger/restricted grants and manual
   dispatcher command; preserve baseline reservation algorithms.
4. Import only approved Agent1 bundle into this checkout; wire current recipient
   projection and protected detail route. Final acceptance never relies on stubs.
5. Author rollback, failure/retry, dedup/concurrent drain, stale authorization,
   expiry, privacy, timezone/DST and negative local-gate cases.
6. Same-agent read-only Review, separate executed Verify, Recover for failures,
   factual docs and Remember save; report frozen per-file/aggregate hashes.

## Verification plan (NOT RUN — architecture stage)

- Pinned npm ci, assigned cluster55476/dev3036/test3136 with PG17.11; full fresh
  migration chain in both owned databases. No main/sibling/hosted DB.
- npm run check, all real PostgreSQL integration suites, production build,
  default baseline browser suite plus discovered new notification cases, workers1.
- Create/retry/race notice dedup; actual creator/tutor pair; self/guardian current
  authorization; multi-role dedup; outsider/admin denied; stale link/role/account/
  verification/tutor eligibility and expired reservation suppressed.
- Separate-connection dispatch during outer creation transaction sees no notice,
  including rollback; capture failures leave booking/event correct; capture-before-
  acknowledgement crash retry reuses one file. Runtime denied identity/terminal
  edits and insert/delete; creation/expiry booking regressions remain selected.
- Auth verification/reset capture remains functional; no real-email/network calls.
- Browser open private local artifact, inspect narrow/desktop screenshots, axe,
  keyboard detail-link action and authenticated route denial. HTML encoding and
  negative private-value scans; date/offset across DST and midnight.
- Record first failures and exact commands/counts/logs; no unrun acceptance claim.

## Documentation and risks

Update PRD OPS-04 local exception, architecture email/outbox note, build-plan local
status and tracker actual evidence; separate decision records local authority
without changing real email/commercial/consent/safeguarding gates. Operations
document explains owned bounded invocation, retries/suppression and crash limits.
Rollback expectation: stop manual invocation; existing bookings/history persist;
do not delete evidence or rewrite historical migrations. Main merge, deployment,
commits, pushes and provider delivery remain unauthorized.

Material dependencies: parent schema/trigger contract freeze and migration number;
Agent1 account-ID projection + protected detail route and hash-authorized import.
Continue independent capture/template work while these are pending.

### Resolved execution dependencies

Coordinator froze the event trigger/manual-independent-Pool contract and allocated
0012 before schema/grant edits. `msg_f406991d29b1` authorized the 16 exact files
from frozen `m4.9-read-v2+notice-v1.1`, including authenticated detail routes;
`.local/provider-imports.json` records exact hashes and prior v1 provenance.
Imports stay unchanged; only additive approved event SELECT and delivery grants
are authored locally. No creation-service or availability-module edits required.

Coordinator `msg_449366bec7ba` subsequently authorized the exact 15-file v3 UI
candidate and two hash-verified deletions of provisional loading boundaries.
Final active imports are `m4.9-read-v2+notice-v1.1+detail-v2`; the six core/notice
hashes are unchanged. Baseline `bookings/demo/loading.tsx` stays intact. This
provider's full own milestone acceptance is separate from this consumer's linked
route verification; no peer-wide acceptance is inferred from import authorization.

Final provider freeze: `msg_6ec4d4d63cb2` authorized only
`src/features/bookings/read-controls.tsx` replacement to
`6f048472fc276722ad399675c80003358067560b9ba04dbb0ac88d82a4a2e3ac`.
Active version is `m4.9-read-v2+notice-v1.1+detail-v3`; the other 14 files and
two verified deletions remain unchanged. Provider focused controls evidence
does not substitute for this worker's actual final static/build/browser checks.
