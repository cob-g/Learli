# M8.9 — Bounded local security and edge-case acceptance

## Authority and baseline

**AUTHORIZED — build-feature delegation**, 2026-10-16. The owner approved the
preceding recommendation with “okay approve rommendedation”: execute focused local
security acceptance for existing authentication, ownership, booking, scheduling,
validation and recovery behavior, and document the exact verified scope. This is
the execution authority for this bounded test/documentation slice. The owner did
not separately inspect this generated blueprint. It authorizes no hosted
activation, real provider operation, account purge, commit, merge, push or deploy.

Observed repository: `/Users/cob/learli`, clean local `main` at `794fe61`. A
working branch is **proposed** `feature/security-edge-case-acceptance-20261016`;
the architect creates no branch and runs no checks. Preserve unrelated changes.
Earlier recorded evidence is 1,990 unit/component tests, 169 selected PostgreSQL
tests and three normal-build private Chromium cases. Those historical counts are
not a pass claim for this new acceptance matrix.

Read `AGENTS.md`, then the eight canonical files in required order under
`context/`: `project-overview.md`, `architecture.md`, `ui-context.md`,
`code-standards.md`, `ai-workflow-rules.md`, `progress-tracker.md`, `prd.md`,
`build-plan.md`. Reuse unchanged context already read by the coordinator. Also
read the existing private fictional, Student, Admin and cross-role blueprints
and the current account/session/password, availability and delivery boundaries.

## What we are building

Meaningful missing acceptance for the existing private fictional normal build,
plus deterministic local PostgreSQL failure/recovery assertions. New coverage
proves negative authentication and actual reset/session recovery, distinct
participant Account timezones, protected confirmed instants during Tutor
schedule changes, rejection of past slots and safe database-failure responses.
Reuse existing targeted suites rather than duplicate every security assertion.
No new product behavior, schema, provider integration or security framework is
planned. Verification and review remain separate downstream stages.

## Requirement and milestone mapping

- Primary existing work item: **M8.9**, end-to-end acceptance matrix.
- Related work: M2.3/M2.5/M2.6/M2.7/M2.9; M4.1/M4.2 and booking-integrity
  work; M5 participant coordination; M8.3/M8.8 environment/security safeguards.
- PRD: AUTH-01/02/03/04, TUT-02/04/05/06, BKG-01/02/04/05/06,
  OPS-01–04, MEET private-access requirements, NFR-03/04/05/09/11 and applicable
  QA role, schedule, recovery and private-link criteria.
- This slice does not close M8.9 or establish staging/public-launch readiness.

## Language and decisions

No clarification or material business decision is needed for this bounded slice.

1. **Authentication recovery** means provider-supported reset/reauthentication
   with truthful feedback, safe failures and refreshed server authority. It does
   not promise that expiry, transient 503 or persisted 429 can never occur.
2. **Duplicate registration protection** means one actual account and a safe,
   non-enumerating response; an explicit “already registered” disclosure is not
   a required success criterion.
3. **Account timezone** is the user's persisted display preference. Tutor weekly
   availability has its separate IANA recurrence timezone. Setting the latter
   does not establish the former. Configure both explicitly when relevant.
4. **Booking protection** means stored UTC instants, current logical identity,
   state/history and participant access survive recurrence/timezone edits. A
   harmless weekly edit need not be forbidden merely because a booking exists.
5. **Failure versus uncertainty:** a failed precommit database request must not
   persist success. A committed-but-lost response may have succeeded; retain the
   existing cross-role authoritative-read and same-key replay assertions.
6. A guardian child still uses the Parent account; an independent College
   Student uses their own account. Do not create independent minor login.
7. Trusted multi-role authority is legitimate. Deny actors lacking the relevant
   trusted role/ownership, and preserve exact current-MFA Admin assignments.
8. Existing fictional-only policies, finite audience and payments-disabled
   composition stay unchanged. Real lesson attendance, email delivery, Neon
   wake-up and hosted operation are not inferred from local evidence.

## Inspected implementation and test evidence

- `playwright.private-workflow.config.ts` selects three current normal-build
  private cases, one worker/no retries at owned loopback3121, with captures off.
- `tests/support/private-workflow-browser-setup.ts` writes the finite run-unique
  fictional audience. It currently contains 14 account prefixes. The shared
  `CollegeAccount` union in `tests/support/private-student-browser.ts` is also
  finite; additional actors require coordinated allowlist/union registration.
- `PrivateStudentBrowser` supplies actual UI registration, local-capture
  verification, Admin MFA/admission and Tutor eligibility; existing
  `resetPrivateBrowserAuthAttempts` is a guarded between-case preparation only.
- Legacy `tests/e2e/auth.spec.ts` and `account-password.spec.ts` contain separate
  fixture/counter conventions, including direct verified-state setup. They
  cannot serve as evidence that this actual private composition completed real
  verification/reset. New normal-build coverage must not copy those shortcuts.
- `tests/e2e/private-fictional-student.spec.ts` already checks two independent
  learners, role/privacy denials, rescheduling, cancellation, separate historical
  completion and actual guarded Account logout. It reads the viewer Account zone
  but has not explicitly configured distinct Manila/New York account zones.
- `handleBookingRead` in `src/features/bookings/read-handler.ts` catches database
  failures as private safe 503. `handleWorkflowMutation` and the shared
  `src/lib/mutation-handler.ts` protect writes and map unexpected failures to safe 503. Test those existing boundaries, not an invented bypass endpoint.
- `tests/integration/auth.test.ts` already covers non-enumeration, password reset
  single use, invalid/expired tokens, expired sessions, logout, role/ownership,
  suspension, bounded settings, origin checks, persisted throttling and safe
  disconnected errors. `account-password`, `account-sessions` and
  `account-restrictions` cover focused provider/lifecycle boundaries.
- `tests/integration/transactional-delivery*.test.ts` use controlled provider
  failures and persisted delivery outcomes. They do not establish real sending.
- `tests/integration/hosted-runtime.test.ts` uses the existing owned loopback TLS
  harness through test-only module substitution. Rerunning that suite proves
  local transport/runtime behavior, never actual Neon suspend/resume.

## Scope and affected areas

Included: proposed `tests/e2e/private-fictional-security.spec.ts`, focused
extensions of `tests/e2e/private-fictional-student.spec.ts`, proposed
`tests/integration/security-booking-recovery.test.ts` only if existing coverage
does not already prove the exact protected-read/mutation/recovery contract,
minimal shared test registration, checklist/results and accurate context notes.

Excluded: production source/schema/migrations/grants, dependency updates, new
infrastructure, new child login, real Resend/Zoom/Meet/Neon/Railway operations,
delivery drain, payment callbacks, customer records, owner-preview changes,
hosted activation, production fault injection and broad account cleanup.
Historical provider-blocked SQL audit leads and dependency-upgrade findings are
outside this approved acceptance slice; do not reopen or call them resolved.

No data-model or authorization change is planned. Existing isolated test records
and precise metadata setup may be used with ownership guards. If a test exposes
an unambiguous production defect, retain the failing reproduction and return the
root cause to the coordinator before a separately scoped correction. Do not
change expectations to fit incorrect behavior or expand a public policy.

## Implementation sequence and acceptance criteria

1. **Minimal shared registration.** Coordinator adds proposed finite prefixes
   `security-a` and `security-b` to the actual setup and matching shared
   account union, and adds the new security browser filename to private testMatch.
   Use exact prefix matching. Keep one worker/no retries, real production build,
   loopback-only database checks, private captures off and provider policies on.
   Do not add a fixture mirror or production injection/configuration seam.
2. **Actual normal-build negative auth and reset.** In the new security file,
   register/verify through real UI and captured local verification messages.
   Reject wrong credentials without creating a session; prove duplicate signup
   cannot add a second user or alter the original credential/role record and
   does not expose unnecessary address existence. Submit password-recovery UI,
   read only its exact synthetic recipient's private local capture and complete
   the provider reset UI. Verify new password works, old password and old session
   fail, reset replay fails, and successful reauthentication restores the same
   permitted account. Use existing dedicated PG suites for invalid/expired reset
   variants rather than adding redundant browser variants.
3. **Expiry, logout and validation.** Expire only the exact synthetic actor's
   session in the owner-guarded test database; this is disclosed controlled
   fixture fault injection, never a production shortcut. Fresh protected document
   and API reads must require authentication. Reauthenticate through the actual
   form and prove recovery, then use guarded Account logout and verify protected
   revisits. Exercise representative required, email, bounded text and invalid
   time/range inputs at meaningful existing boundaries; retain submitted state,
   safe visible errors and unchanged records. Do not promise zero optional chrome
   429s; never clear counters or relax rate limits during a case. A reset action
   must not be conflated with signed-in password change.
4. **Explicit participant Account zones.** Student-file owner sets Tutor Account
   to `Asia/Manila` and Student Account to `America/New_York` through supported
   Account UI/API with their own session. Persist and refresh to verify. Keep the
   Tutor recurrence zone explicitly known. Assert same UTC start/end across the
   participant projections and correct date/time/offset/zone formatted separately
   for each participant before and after rescheduling. Compare full instants and
   actual-date Intl formatting, including date rollover; do not assume equal
   clock strings or a fixed offset. Existing DST suites supply transition-edge
   evidence; this short future browser journey is not itself both-season DST.
5. **Confirmed booking survives schedule edits.** On the existing confirmed
   future Student booking, save a real valid weekly availability edit and a Tutor
   recurrence-timezone change through the owned Tutor UI/API. After each save,
   compare exact persisted booking UTC instants, identity/state, event/intents
   and fresh authorized Student/Tutor/Admin reads. No booking rewrite,
   cancellation or duplicate is allowed. Actual candidate generation still
   excludes the occupied interval. Restore a suitable schedule for the existing
   reschedule steps through the same supported mutation, not direct SQL. Do not
   broaden the rule to reject all valid weekly changes.
6. **Past slot rejection.** Submit an explicitly past otherwise valid private
   workflow tuple with a fresh key through the actual endpoint under an admitted
   Student session. Expect safe rejection and zero rows/events/intents for that
   key, retaining the confirmed booking. Reuse existing stale/unavailable/occupied
   slot and distinct-learner race coverage. No production clock manipulation.
7. **Controlled local database failure and recovery.** Verify existing fixtures
   first. If the missing compound assertion remains, add the proposed PG file
   using actual runtime/handlers and owned fixture setup. Establish one accessible
   confirmed record and a separate current valid create tuple/key. Cause a
   deterministic unavailable test-only connection at the DB boundary (for
   example, close a separately created local runtime pool, matching existing
   account-session outage convention). Protected booking read and create must
   return private safe 503, never a misleading success; responses/log captures
   must omit credentials, connection strings, cookie values and internal SQL.
   With a healthy runtime reconnected to the same isolated database and valid
   cookie, the old booking must remain readable/unchanged and the same failed
   create tuple/key may succeed exactly once. Replay yields the same receipt;
   verify exact row/event/intent counts and foreign access denial. Close all test
   runtimes in finally and restore only setup state the case owns. No cluster
   stop, global role modification, production fault switch or network traffic
   outside loopback is needed. Label closed-pool/recreated-runtime evidence
   accurately; it does not prove automatic Neon wake-up or same-pool reconnection.
8. **Existing delivery and security suites.** Run the dedicated current suites
   below against isolated local targets and collect actual case counts. Retain
   existing delivery-failure/idempotency/retry safeguards; add no real send. The
   UI must show useful retry/uncertain-result guidance without implying failed
   mail rolled back a committed booking.

## Parallel ownership

- Worker A: only proposed `tests/e2e/private-fictional-security.spec.ts`; actual
  negative auth/reset/expiry recovery and representative validation assertions.
- Worker B: only `tests/e2e/private-fictional-student.spec.ts`; explicit Account
  zones, private past-slot rejection, confirmed weekly/timezone edit protection.
- Worker C: only proposed `tests/integration/security-booking-recovery.test.ts`
  if justified; safe actual-handler read/mutation failure then healthy recovery.
- Coordinator: shared setup/union/config, all documentation/context, integrated
  source inspection, isolated execution, read-only Review and final Verify.
  Workers request shared helper changes instead of editing shared files.

Authoring may overlap. DB/browser execution must remain serialized because
policies, provider counters and the normal build are shared. Never run concurrent
commands against the same checkout-owned cluster/build. Existing guarded
between-case preparation can remain; no within-case counter resets are allowed.

## Verification plan for the separate verifier — DO NOT EXECUTE IN ARCHITECT

- Record source identity and owned local process/database status without secrets.
  Preserve the owner's preview. Start only the isolated test services needed;
  stop only operation-owned services after all clients close, retaining data.
- `npm run check` for formatting, ESLint, TypeScript and unit/component tests.
- `node scripts/with-test-env.mjs npm run build`; record warnings, actual normal
  build identity and private artifact/trace exclusion checks as applicable.
- `npm run test:integration --` with exact explicit current files:
  `auth`, `account-password`, `account-sessions`, `account-restrictions`,
  `tutor-catalog`, `availability`, `transactional-delivery`,
  `transactional-delivery-hosted`, `hosted-auth`, `hosted-runtime`, plus
  `security-booking-recovery` if added, and all nine prior cross-role files:
  `cross-role-booking-integrity`, `policy-booking`, `policy-booking-acceptance`,
  `policy-booking-boundaries`, `private-admin-bookings`, `booking-read`,
  `booking-meeting-links`, `tutor-completion`, `private-student-read-scope`, all
  under `tests/integration/` with `.test.ts`. Include additional relevant existing
  validation/DST files if their exact missing contract warrants it. These are
  selected suites, not a claim that every integration test executed.
- Hosted-named transport suites must use only their current owned loopback TLS
  harness with safe test ports and cleanup; never substitute a hosted target.
- `npm run test:e2e:private`: all existing three cases plus the new security case,
  normal production build, one worker/no retries, captures off. Record actual
  discovered count, timing and status; do not assume the proposed count passed.
- Existing bounded phone/desktop, keyboard and Axe/overflow checks remain; add
  checks only where new visible form/error states need evidence. This is not a
  physical-device or full screen-reader audit.
- Independent read-only Review must compare exact changes to this blueprint,
  inspect meaningful assertions/mocks, side-effect ownership and counter
  behavior. It runs no verification commands. Fix confirmed test defects and
  rerun affected checks, then record the final integrated tested source hashes.
- Evidence includes command/result/duration, exact source identity, safe
  aggregate failure outcomes and known limits. Keep raw provider captures,
  cookies, tokens, private URLs and owner evidence in restricted ignored local
  artifacts only. Never include them in Git or public QA reports.

Verification status: **NOT RUN — architecture planning only**.

## Documentation, risks and rollback

Coordinator creates proposed `docs/qa/security-edge-case-checklist.md` and
`docs/qa/security-edge-case-results-2026-10-16.md`, with each original checklist
item marked by actual local evidence, partial scope, NOT RUN or N/A. Update
`context/progress-tracker.md` and a concise M8.9 build-plan acceptance note only
after observed implementation/verification. Current PRD owns these behaviors;
no architecture/UI/product-policy change is expected. Record no blanket “secure,”
“production ready,” all-forms or full milestone completion claim.

Potential risks: auth lookup bursts can hit legitimate rate limits; use the
existing guarded Account flow and minimize redundant navigation without
weakening assertions. Changing recurrence timezone can legitimately change future
candidates, so restore only through supported owned mutations before subsequent
steps. Synthetic outage setup must not touch the owner's preview or other
clients. Accurate closed-runtime recovery claims are narrower than actual
provider reconnection. None is an unresolved product decision.

Rollback is only this test/documentation delta. Do not reset unrelated work,
delete retained records, alter historical audit data or overwrite user changes.
Actual Neon idle-to-wake behavior, delivered email, actual video attendance,
payments, independently signed-in minors, hosted activation, full fresh-lesson
elapsed completion and final production readiness remain separately unverified
or gated. Historical deferred security findings remain explicitly deferred.

## Handoff

Blueprint ready. **AUTHORIZED — build-feature delegation** for separate
implementation, read-only Review, executed Verify and evidence-backed Remember.
No material decision blocks this bounded local acceptance work.
