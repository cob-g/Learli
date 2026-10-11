# M4.9 — Private local simulated booking detail and history

Status: AUTHORIZED — build-feature delegation.
Authority: actual 2026-10-11 dispatched user request to build M4.9 (BKG-04,
AUTH-03, FAM-03), within the approved six-feature local synthetic wave. This is
execution delegation, not separate human approval of this blueprint.
Repository: `/Users/cob/orca/workspaces/learli/m4-9-booking-history`.
Observed clean branch: `cob-g/m4-9-booking-history`.
Baseline: `0c078bf50f9f967b20391ef3640353a7b3897e62`.

## Outcome and scope

Build reusable participant read DTOs/services, protected GET handlers and private
detail/history pages. An eligible self-managed college learner, currently
authorized guardian, or assigned tutor sees only corresponding simulated records.
Show actual tutor/subject and minimum learner label, current viewer-local UTC
times, truthful expiry/status and persisted history. No clarification is needed.
Read AGENTS.md and the eight canonical context documents in their required order.

Excluded: dashboard landing pages, admin support access, notifications, meeting
storage/access, live booking/commercial/consent policy, new states, writes,
schema/migrations, dependencies, hosted services and production actions.

## Decisions and invariants

- Explicit `student`, `guardian`, `tutor` scope selects a permission path, never a
  granted role. No caller user ID or actor ID is accepted. DB role/current session,
  verification, active synthetic identity and exact relationship remain required.
- Active local fixture learner is required. Student: exact self ownership and
  College Support; guardian: current authorized local link; tutor: exact profile
  assignment and non-suspended profile. An admin alone has no read capability.
- One final SQL statement reads authorization, booking fields and persisted events
  together. Preliminary identity resolution is not final authority. Reads acquire
  no domain row locks and perform no mutation, so there is no domain lock wait to
  cross. Revocations committed before the final statement deny access; already
  authorized in-flight statements may finish under the established boundary.
- Expiry is a read projection at database statement time: elapsed TTL is
  `demo_expired` even when persisted state is `demo_reserved`. DTO distinguishes
  persisted state and expiry materialization. Reads invent no event and do not
  materialize expiry. Existing candidate/create expiry writes continue under the
  tutor-first lock protocol unchanged. Immutable fields and conflict races remain.
- Time zone comes from the current authenticated account at the final query, not
  booking display zone, learner zone or another participant. Use existing shared
  formatter/LessonTime with offset-aware DST and midnight presentation.
- Strict list input: scope, page (1–10000), pageSize (1–50, default20),
  filter (`all` default, `active`, `history`), optional learner UUID for family
  scopes only. Active means effective unexpired simulated reservation and future
  end time; history is its complement, never proof of attendance/completion.
  Active order start UTC/id ascending; all/history descending. Bounded offset
  pagination hasNext; no global count. Current authorization repeated every page.
- Minimal summary excludes auth/session/account identifiers, booked-by identity,
  request fingerprint/key, emails, guardian contacts and private integration data.
  Detail adds actual ordered events only. No sensitive values in metadata/logs.
- Coordinator refinements (2026-10-11, messages msg_d532f5abc5d8,
  msg_70817996ac99, msg_480e70183d45): BookingPage includes authorized learner
  selector summaries from the same final SQL snapshot, including empty results.
  Add listParticipantBookingOverview(runtime,headers,input) with strict
  scope/page/pageSize/learnerId input and active/history BookingPage results from
  one statement; active first page ASC, history requested page DESC. Both share
  snapshot, current zone and learner context; next-reservation callers additionally
  require start>snapshot. This prevents consumers joining inconsistent reads.
- Separately internal readSimulationNoticeRecipient on the notification owner's
  READ COMMITTED transaction takes committed booking/event/recipient IDs, derives
  scope and allows only actual creator or assigned approved tutor, with current
  synthetic verification/access/role/relationship and live TTL. Creation event
  only, no expiry notices. Creator student/guardian scope precedes tutor scope for
  multi-role deduplication. Return recipient email and safe subject/viewer-local
  times/detail path, no learner fields. No sessionless web bypass or delivery.

## Proposed files and contract

- `src/features/bookings/read-model.ts`: client-safe BookingReadScope,
  BookingReadFilter, BookingSummary, BookingDetail, BookingPage.
- `src/features/bookings/read-service.ts`: Node-only listParticipantBookings
  (runtime, headers, unknown input), readParticipantBooking(runtime, headers,
  bookingId, scope). Internal query/projection/input helpers remain private.
- `/bookings?scope=...`: server-rendered history/filter/pagination with GET forms.
- `/bookings/[bookingId]?scope=...`: protected reusable detail route.
- GET `/api/bookings` and `/api/bookings/[bookingId]`: no-store minimal JSON;
  safe malformed/foreign/missing outcomes. All route scope inputs validated.
- Shared presentation/status and pending/error/unavailable states. Native GET
  forms and detail/pagination links progressively report pending navigation while
  retaining visible content. No new automatic loading.tsx boundary: actual browser
  evidence showed its streamed private HTML remained hidden without JavaScript.
  Plain SSR filters/detail work without JavaScript. Normalize only exact guardian
  empty learnerId from the native All option; service/API inputs remain strict.
  Hydrated GET uses useTransition/router.push to retain content while pending;
  inner form key keeps learner/filter inputs aligned with URL Back/Forward.
  Coordinator authorized repairs msg_4f1d287d15f3, msg_070bf53eb7dd and
  msg_ab6f5fef3d85. Expiry display
  uses server duration plus monotonic elapsed time, never device wall-clock time;
  persisted event history stays distinct from elapsed TTL.
- Meaningful unit, real PostgreSQL authorization/race/projection and browser tests.
  Add one project to existing Playwright config; retain default baseline selection.
- Necessary local grant: preserve INSERT on booking_events and add SELECT of
  id,booking_id,event,created_at in scripts/migrate-local.ts; parent authorized
  msg_169f9269cd7e. No UPDATE/DELETE grant, applied migration rewrite or new schema.

## Implementation order

1. Publish proposed DTO/service/route contract to coordinator for dependent owners.
2. Implement strict inputs, single-statement current authorization and projection.
3. Implement private read APIs, no-JS history and accessible detail UI states.
4. Author permission/revocation/expiry/ordering/time tests and responsive E2E.
5. Update architecture expiry note and tracker factually, review read-only, execute
   required checks, repair via Recover if needed, save Remember and report hashes.

## Verification plan — defined in Architect; execution recorded separately

Use pinned npm ci and assigned owned cluster55471/dev3031/test3131, full0000–0011
migration chain. Run npm run check, full real PostgreSQL integration suites,
production build and all default browser projects plus new M4.9 cases with one
worker. Preserve baseline booking concurrency and both time-off race orders.
Test foreign family/student/tutor/admin, revoked link/role/session/account/profile,
late preliminary-auth resolution, expiry boundary without mutation/events, actual
materialized history, immutability, strict input, bounded pagination and changing
viewer preference/DST. Inspect narrow/desktop screenshots and axe/keyboard/no-JS;
scan client artifacts for private values without printing them. Record exact
commands/counts/logs; same-agent Review is not independent review.

## Documentation, dependencies and handoff

Update `context/architecture.md` and the local expiry decision to distinguish
read-only detail projection from existing read/create mutation paths; update
`context/progress-tracker.md` with verified M4.9 scope only. No policy change.
Coordinator approves/freezes exact public import manifest for family/tutor/
notification owners; no peer import required to complete this independent slice.
Rollback removes new routes/modules/tests and reverts scoped doc/config additions;
no data reset. Final ignored memory/report records provenance and per-file hashes.
Open launch policy remains gated; no new blocking product decision for this slice.
