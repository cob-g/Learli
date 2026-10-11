# M4.11 — Actual-date tutor picker and M2.9 auth continuation

Status: **AUTHORIZED — build-feature delegation**. Date: 2026-10-11.
Authority: actual dispatched `$build-feature Build M4.11 tutor-profile actual-date
slot picker and M2.9 sign-in continuation (PRD MATCH-03, AUTH-05, BKG-01)`
request in the authorized six-feature wave. This is execution authority, not
separate human approval of this generated blueprint.

## What we are building

A visitor selects an actual tutor offering (subject and level), previews dated
candidate times in their IANA time zone, and reviews a local simulated booking.
Only the public selection survives sign-in, account creation and verification.
An authorized learner is chosen after authentication. Resume and create both
revalidate; a stale time offers current alternatives and never creates a booking.

## Requirement and milestone mapping

- Primary M4.11; related M2.9, M4.2 and M4.6.
- PRD MATCH-03, AUTH-05, BKG-01; preserve MATCH-02/BR-01–08, AUTH-03.
- Clean baseline `0c078bf50f9f967b20391ef3640353a7b3897e62`, branch
  `cob-g/m4-11-profile-booking`, repository
  `/Users/cob/orca/workspaces/learli/m4-11-profile-booking`.
- Existing service owns atomic reservation/create/retry/expiry and learner guards.
  Existing time engine handles actual dates, DST, overnight windows and busy
  exclusions. Public profile currently has no candidate picker. Auth already
  uses safeReturnPath; demo page currently loses query selection.
- Read AGENTS.md and the eight lowercase canonical context files in its order.
  Consult the local synthetic booking and M2 decision records.

## Language and decisions

No terminology clarification needed. Preview is advisory and does not reserve.
Local simulation uses the existing immutable 60-minute elapsed duration,
30-minute start step, 60-minute notice, 14-day horizon and 10-minute TTL.
Commercial/consent/safeguarding/live booking rules remain OPEN.

Technical choices: separate public-availability module and single-tutor public
GET endpoint; batching up to 20 tutor slugs for the matching consumer; server
formatted safe UTC/date/time/zone projections; strict public selection schema;
native GET filters and radios for no-JS preview/review; optional client enhancement
detects browser zone and retains a visit's explicit zone in sessionStorage.
Saved signed-in account zone takes precedence when available. No zone is inferred
from a learner. No account-zone mutation is added by a public preview.

## Scope and invariants

Included: read-only local public candidate query, actual subject/level pair,
bounded dates, current eligibility/time-off/unexpired reservations, loading/error/
empty/unavailable states, accessible profile picker, privacy-safe booking return,
pending choice summary on auth screens, narrow demo prefill/revalidation, tests,
factual docs and local memory.

Excluded: matching UI, private booking history/dashboard pages, migrations,
dependencies, auth configuration, commercial booking/charges, meeting storage,
provider/email calls, learner onboarding, LMS, uploads or messaging. No commits,
pushes, merges, deployment, resets, peer writes or extra workers.

Only tutor slug, subject slug, visitor-selected level, start/end UTC and display
zone appear in the public selection URL. Never encode learner IDs/names, booking
IDs, participant/private records or auth tokens. No public query reads learner,
guardian, session or participant columns. No preview writes or expiry events.
Unknown and ineligible tutors share unavailable semantics; an eligible tutor
without candidates is empty; database failure/resource exhaustion is a failure,
never an empty result. Reserve/create remains authoritative and unchanged.

## Shared provider contract (approved and frozen by parent)

- Proposed `src/features/public-availability/input.ts`: strict
  `publicCandidateQueryInput`, public input/type and technical limits; 1..20 unique
  bounded tutorSlugs, subjectSlug, level, displayTimezone, optional ISO from/to.
  No public clock override. Requested from/to must be valid and increasing,
  then intersect the current local notice/horizon. Candidate starts use [from,to).
- Proposed `src/features/public-availability/service.ts`:
  `readPublicCandidates(runtime,input)` and `PublicCandidates`; source
  local_simulation, captured generatedAtUtc, effective from/to, duration/step and
  tutor results in requested order. Each result has tutorSlug, state
  available|empty|unavailable and safe times only. UTC starts sorted ascending,
  duplicates removed by the existing engine; output includes no internal IDs.
- One read-only consistent transaction captures database clock and eligibility;
  bounded eligibility by slug, profile lookup and three bulk IN reads cover
  weekly windows, dated time off and unexpired demo_reserved busy intervals.
  No per-tutor SQL. Bound input/output rows; refuse exhaustion instead of silently
  truncating. Load busy/time-off through the final candidate's end to avoid a
  horizon-tail overlap. Report exact limit numbers with the frozen contract.
- Narrow coordinated eligibility edit exposes `listEligibleTutorsBySlugs` using
  the existing single eligibility predicate. Proposed pure
  `src/features/bookings/demo-schedule.ts` centralizes policy + generateSlots
  inputs; existing service calls it without duplicating/changing reservation
  locking, authorization, writes or retries. Parent must reconcile unavoidable
  shared-file overlaps before another consumer imports.

## Workflow and failure states

1. Subject/level/zone GET filters yield real preview, optional browser zone
   detection, explicit fallback zone and local labels. Native radios choose one.
2. Review GET to `/bookings/demo` carries only validated public selection. The
   private guard sends anonymous callers to sign-in with safe canonical next.
3. Auth read-only pending summary displays current public tutor and choice; links
   and verification callback preserve safe next. No auth security changes.
4. Private page reloads current options and public candidates; invalid/ineligible
   selection is explained. Learner selection is owner-scoped and only after auth.
   Authorized private candidate read verifies learner level/subject on resume.
5. Stale slot clears selection, shows a focused helpful notice and current
   alternatives. Create uses the existing server mutation; conflict reloads
   alternatives while preserving tutor/subject/learner. Unknown results retain
   original idempotent request for safe retry.

## How to build it

1. Implement/test shared query/input/pure projection; send contract and frozen
   import list/hashes to parent early, independently of UI/auth work.
2. Add strict selection parser/canonical safe href, public endpoint, native picker
   and browser-zone enhancement. Replace only the obsolete booking section.
3. Wire private page query and form prefill/revalidation; add auth pending summary.
4. Add unit, real PostgreSQL and default-discovered browser acceptance tests.
5. Update scoped docs, read-only Review, executed Verify, Recover for failures,
   factual tracker/evidence and Remember.

## Verification plan (NOT RUN — Architect stage)

- Pinned npm ci, owned local PostgreSQL full 12 migrations, assigned ports
  DB55474/dev3034/test3134. Never use another environment.
- npm run check; full npm run test:integration including original concurrency,
  expiry, revocation and both time-off race orders; npm run build; default npm
  run test:e2e with conservative workers, baseline and new suite selected.
- New query tests: exact eligibility pair, disabled/suspended/missing role,
  window/time-off/busy/elapsed expiry, batch/no N+1, range/limit validation,
  read-only data preservation, privacy DTO, DST/overnight and stale create.
- Auth tests: unsafe returns/forged private fields, sign-in/signup/verification
  continuation, roleless account/no learner, learner mismatch, stale slot and
  create conflict with alternatives; no automatic writes on preview/resume.
- Browser keyboard/native GET/no-JS preview, loading/error/empty states,
  320/390/768/1024/1440 reflow, forced colors/reduced motion, axe. Capture and
  inspect narrow/desktop screenshots. Scan public/client output against actual
  private values without printing values.
- Same-agent Review is not independent; record separately from executed checks.
  Retain first failures and exact command/count/log evidence.

## Context updates, risks and handoff

Update progress-tracker after meaningful changes with actual evidence; architecture
and UI implementation notes describe public-query/privacy/visit-zone decisions.
No live policy change. Rollback removes additive modules and narrow integrations;
no schema/data change is required. Parent owns frozen matching imports and final
shared docs/config/service reconciliation. Shared-file overlap must be declared.
Final ignored `.local/worker-report.md` records provenance, changed per-file and
aggregate SHA256, review versus verification, failures, limits and next owner.
Remember saves ignored root memory.md; worker_done exactly once then freeze.

Provider release: parent msg_63de3a23b2c6 verified all five exact hashes and64/64 executed PostgreSQL cases, archived the bundle and authorized matching adoption on2026-10-11. Frozen local manifest `.local/provider-frozen.json`; no peer imports in this feature.

## Implemented local outcome — 2026-10-11

The delegated vertical slice is implemented and verified in this worker only.
Provider v1 remains frozen with no imports from peers. Picker HTML is fully
awaited after public eligibility so denied tutors retain404 and populated native
controls work without JavaScript. Client native GET pending feedback flushes
before submission and resets on pageshow; validated default keys and true local
start-date groups preserve zone/date consistency. Demo actions disable during
pending requests; server mutation/ownership algorithm remains authoritative.

Full same-agent Review PASS (not independent); executed506 unit/component,
170 PostgreSQL,55 default browser cases and production build PASS. Current
public screenshots inspected; source/client private-value scan0 matches.
Exact final logs, per-file/aggregate hashes, applicability and retained recovery
history are in `.local/worker-report.md`. This is local-only feature evidence,
not launch/policy approval or whole-milestone completion; parent owns integration.
