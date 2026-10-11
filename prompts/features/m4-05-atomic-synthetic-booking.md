# Atomic synthetic booking core — M4.5–M4.8 / V10

**Integration amendment (AUTHORIZED — build-feature delegation, 2026-10-11):**
The frozen source plan below records original intent. In the premerge candidate,
READ COMMITTED post-wait authorization replaces SERIALIZABLE snapshot reads;
tutor/actor locks and database exclusion retain atomicity. Event timestamps use
the captured mutation clock. Recovery rationale and regressions are in
`prompts/recovery/2026-10-11-integration-authorization-freshness.md`.

Status: VERIFIED — local synthetic combined booking/time-off slice;
AUTHORITY: AUTHORIZED — build-feature delegation.
Execution authority: AUTHORIZED — build-feature delegation, dispatched 2026-10-11;
this is not separately reviewed human blueprint approval.
Baseline: clean `cob-g/m4-5-booking-core`, `3a055deff54149be48a91b44237d0e28b26f3405`.

## Outcome and scope

A verified active synthetic parent selects an authorized fixture learner, or an
eligible fixture self-managed College Support learner books for themselves, using
the tutor's stored weekly schedule translated into UTC. The database accepts one
logical test reservation despite overlapping requests and network retries.
PRD BKG-01, BKG-02, simulated BKG-03; preserve BR-01–07 and BR-15–18.
Only loopback development/test and `.test` identities; no real confirmation,
payments, commercial holds, meeting storage, email, cancellations, broad
dashboards, real consent or production approval.

## Inspected foundation

Read AGENTS.md and eight canonical context files. Existing reusable pieces:
`requireIdentity`, private mutation handlers, local-mode gates, real PG test
support, `listMyLearners`/`readMyLearner`, `findEligibleTutor`/`filterTutors`,
`generateSlots`, weekly schedule whole-replacement with tutor row lock.
Existing tracker describes historical pre-merge status; dispatched baseline is
the reviewed merged main. No existing booking tables or routes.

## Coordinator-authorized demo-only decisions

60 elapsed minutes, start step 30 minutes, minimum notice 60 minutes, selection
within the next 14 days. Test state `demo_reserved` transitions only to
`demo_expired` after 10 minutes from creation. Lazy expiry under tutor lock before
candidate reads or booking writes releases blocking rows; immutable expired
records and events remain. Same-key retry always returns that same result, even
after expiry, and never renews it. No timer or contractual offer is displayed.
Coordinator authorized this local policy in durable ask reply and
`msg_782abd4d7a63` on 2026-10-11. Display simulated reservation and its expiry,
never confirmed or paid. Real duration, notice, confirmation, hold and commercial
rules remain OPEN.

## Invariants and proposed data

`bookings`: opaque UUID, fixture source, tutor/learner/booked-by/subject FKs,
UTC instants, display timezone, immutable SHA256 payload fingerprint,
idempotency UUID, state, created/expiry timestamps. Unique (actor,key), interval
and demo-state checks; reviewed GiST exclusion on tutor and `[start,end)` only
for `demo_reserved`. `booking_events`: created/expired records and time, no PII.
No runtime deletion or rewriting immutable booking data; grants SELECT/INSERT
and state-only UPDATE; events INSERT only. Reviewed migration generated next
from baseline; custom exclusion SQL supplement documented, no renumbering.

Mutations authenticate, validate strict input, enter a bounded-retry SERIALIZABLE
transaction, lock tutor_profiles FOR UPDATE before other domain writes, then
revalidate current actor/learner authorization, tutor eligibility through shared
query, subject-level fit, schedule and exclusions. Serializability handles
concurrent account/role/link/subject changes without granting writes on trusted
identity records. Profile/schedule/status writes already conflict on tutor row.
Repeated key with changed payload gets safe 409 and no second write; errors
return no private resource details. Transactions keep reservation/event atomic.

## Time-off dependency contract and authorized integration

Sibling owns exceptions. Proposed `readTutorTimeOffIntervals(tx,tutorId,from,to)`
returning half-open UtcInterval[] for generateSlots. Both writes lock the tutor
profile first. Time-off rejects overlap with unexpired demo reservations under
that lock. Missing adapter is a real dependency; do not substitute a no-op.
Coordinator authorizes exact-file handoff before checkout copying/integration.
Combined booking/time-off acceptance needs combined verification.
Coordinator supplied VERIFIED manifest on 2026-10-11, source fingerprint
`b4ad887b08ff9896ddf37b74200dcfc668436e4f1233195967cd900e56e6406d`.
Rechecked all 29 files and both patch hashes; imported 22 scoped application,
test, UI/configuration/feature-document files and selective shared grants/exports.
Booking0008 and metadata remain intact. Generated next
`0009_typical_queen_noir.sql` is byte-identical to source time-off SQL hash
`e433cf938fc50195d8f6c7b15836a611fdcea9e154bbae26a30bf98860baae72`.
The coordinator authorized this checkout's time-off guard and both queue-order
tests, active rejection, exactly adjacent acceptance, expired history retention
and failed-add rollback checks; imported source was never edited in its checkout.

## Ownership / implementation

New `src/features/bookings`, booking schema, `/bookings/demo`, private booking
API routes, booking tests, this blueprint and decision/operations docs. Minimal
shared changes: schema exports, migration grants, transaction-capable shared
eligibility/learner query types, Playwright project. No broad auth/CSS changes.
Private UI shows learner, eligible tutor/subject, server candidates with complete
local date/zone and test-only result, empty/error/loading states, stable retry key.
Native labeled controls, one primary action, semantic tokens and private metadata.

## Verification plan (original architecture contract)

- Assigned owned local PostgreSQL 55451, dev 3011, browser 3111; inspect port
  availability and setup scripts, then fresh migrations and idempotent rerun.
- check (format/lint/typecheck/full units), full real PostgreSQL integration,
  production build, full browser suite at one worker.
- DB cases: overlapping distinct requests one winner, same key duplicates,
  changed payload/actor scope, adjacency, stale schedule/time-off, foreign
  learner, revoked/inactive/unverified/wrong-role, suspended/disabled tutor or
  subject, eligibility/schedule races, DST/gap/repeated hour, transaction rollback,
  direct DB constraints, lifecycle expiry/retry/no orphan blocking rows.
- Browser: parent and self flow, keyboard, errors/empty/no-access, retry after
  lost response, private no-store/noindex, axe, widths 320/390/768/1024/1440 and
  reduced-motion/forced colors/reflow. Inspect saved local screenshots.
- Read-only same-agent Review, separate executed Verify, ignored memory.md;
  record exact counts/commands and diff fingerprint, no independent QA claim.

## Executed outcome

Same-agent read-only combined Review passed alignment, integrity, unintended
changes and docs, with zero confirmed findings; separate Verify stage passed
format/lint/typecheck, 424 unit tests, 91 PostgreSQL tests, production build,
35 baseline/booking browser cases and 3 time-off browser cases. Owned PG55451
and HTTP3111 only; all test execution used one worker. Both queued lock orders,
expired and adjacent reservation behavior and rejected-add preservation passed.
Deterministic DST generation/labels are unit-tested; actual dated UTC persistence
and timezone display are checked against PostgreSQL and browser respectively.
Screenshots/axe cover phone/desktop, forced colors and reduced-motion reflow.
Recovery notes retain the initial Intl label, metadata format and raw database
clock decoding failures; affected checks were rerun after targeted repairs.
No independent review, remote CI or release/production approval is claimed.

## Documentation and handoff

Record coordinator demo policy in a dated decision, architecture and PRD local
notes, progress tracker only with own actual evidence. Local operations explains
expiry and test cleanup without deleting historical data. Preserve all OPEN real
policy decisions. No commit/push/merge/reset/deployment or other checkout writes.
