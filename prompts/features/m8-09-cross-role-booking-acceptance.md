# M8.9 — Cross-role booking lifecycle acceptance

## Authority and baseline

**AUTHORIZED — build-feature delegation**, 2026-10-16. The owner approved the
preceding cross-role recommendation with “ok approve recommendation”: verify two
supported journeys, connected booking changes and privacy, interrupted submission
recovery and a same-slot race between two distinct eligible learners. This is
authority for the bounded tests/documentation work, not separate human inspection
of this generated blueprint or permission to deploy, activate hosted intake,
purge accounts, commit, merge or push.

Observed repository `/Users/cob/learli`, clean local `main`,
`7d2b155df45e0780e64235b95b0561cc5f5a7d4f`. A working branch, if the coordinator
chooses one, is **proposed** `feature/cross-role-booking-acceptance-20261016`.
Preserve any changes appearing after this baseline. Architect creates no branch
and runs no checks.

Read `AGENTS.md`, then these canonical context files in order:
`project-overview.md`, `architecture.md`, `ui-context.md`, `code-standards.md`,
`ai-workflow-rules.md`, `progress-tracker.md`, `prd.md`, `build-plan.md`, all under
`context/`. Reuse unchanged context already read by the coordinator and inspect
the applicable Parent/Tutor, Student, Admin and assigned-Tutor completion decisions.

## What we are building

Targeted actual-build Playwright acceptance and actual PostgreSQL assertions for
the existing private fictional composition. Each booking is followed through its
permitted role views, exact assigned Admin confirmation, Tutor meeting updates,
rescheduling, cancellation and history. Completion uses separately disclosed
already-ended synthetic fixtures and the actual Tutor control; it does not claim
that a newly scheduled lesson elapsed. No product behavior is added by this plan.

## Requirement and milestone mapping

- Primary existing work item: **M8.9**, end-to-end acceptance matrix.
- Related: M4.7/M4.8/M4.9/M4.10; M5.1/M5.2/M5.3/M5.4/M5.5/M5.6/M5.8/M5.11;
  M8.3/M8.8 environment and permission safeguards.
- PRD: AUTH-03, FAM-01/FAM-02/FAM-03/FAM-04, TUT-04/TUT-05/TUT-06,
  BKG-01–07, MEET-01–03, OPS-01–04, ADM-03; QA-04/05/06/07/09 and applicable
  private-link/role-denial criteria. No full milestone is completed by this slice.

## Language and decisions

No terminology clarification is needed. Existing decisions remain governing:

1. A **guardian-managed child** is a learner profile without its own login.
   Journey G is **Parent → assigned Tutor → exact assigned, current-MFA Admin**.
   A separate Student account must not see this booking.
2. An **independent College Student** has their own eligible self-managed learner.
   Journey S is **Student → assigned Tutor → exact assigned, current-MFA Admin**.
   A Parent account gains no authority over it automatically.
3. A request is **provisional** until the assigned Admin confirms its prerequisites.
   Private audience membership and Admin role alone do not grant record access.
4. Cross-role synchronization means matching authoritative fresh reads after
   commit. Refresh/reopen each page or use **Reload meeting link** as applicable;
   this slice does not add real-time push, polling or cache infrastructure.
5. A reschedule produces a new physical version of one logical booking; the old
   version/link is retired. A replacement needs new meeting information.
6. Assigned-Tutor completion is permitted only after the saved scheduled end.
   Ending or opening Zoom/Meet is not attendance or automatic completion.
7. Prior private-fictional-only, payments-disabled scope and synthetic policy
   values are reused exactly. They are not real booking, consent or commercial
   terms. Independent minor login, real email/video and hosted activation are
   excluded.

## Existing repository evidence

- `playwright.private-workflow.config.ts` runs three existing private cases against
  this checkout's actual production build at loopback3121, one worker/no retries,
  with private traces/screenshots/video off and no fixture mirror.
- `tests/support/private-workflow-browser-setup.ts` creates a finite, run-unique
  fictional audience and the existing immutable v2 test booking packet.
- `PrivateStudentBrowser` in `tests/support/private-student-browser.ts` supplies
  actual signup/verification, MFA, independent admission and Tutor approval.
  `PrivateAdminBrowser` in `tests/support/private-admin-browser.ts` adds actual
  guardian admission, booking UI/double-click/replay, exact confirmation and
  intercepted fictional external destinations. Its owner connection is metadata
  bootstrap/inspection, not a shortcut for eligibility decisions.
- `tests/e2e/private-fictional-student.spec.ts` already checks Student moves,
  cancellation and separate historical completion. The Parent/Tutor case and
  Admin case cover connected booking/link and assigned lookup respectively, but
  do not establish both complete proposed cross-role lifecycles.
- `src/features/bookings/read-query.ts` deliberately separates guardian-managed
  from self-managed College Student records. Staff reads in
  `src/features/booking-workflows/staff-read.ts` expose assigned minimum context,
  never private meeting credentials.
- `tests/integration/policy-booking.test.ts` has same-requester parallel overlap
  coverage. It does not alone prove the exact two-distinct-learner scenario.
- `workflowFixture`, `admittedFixture`, `grantWorkflowTask` and the guarded
  `historicalWorkflowBooking` in `tests/support/booking-workflows-fixtures.ts`
  provide actual policy/eligibility setup and disclosed historical fixtures.
- `tests/support/readiness-placement.ts` proves this checkout owns the loopback
  test database. `vitest.integration.config.ts` serializes integration files.

## Scope and affected areas

Included: focused extensions to the existing Parent/Tutor and Student browser
journeys, new database acceptance, corrected checklist/results and verified
tracker/context records. Existing finite accounts/configuration should suffice;
avoid shared helper/audience changes unless independently justified. Proposed database file:
`tests/integration/cross-role-booking-integrity.test.ts`.

Excluded: application/schema/migration/runtime-grant changes, new dependencies,
child login, provider calls, real personal information, delivery drain, real
Zoom/Meet sessions, payments/callbacks, global Admin access, hosted preparation,
deployment, owner-preview reconfiguration and blanket account cleanup.

There are **no planned data or authorization changes**. If deterministic new
coverage exposes a production defect, preserve the failing reproduction and ask
the coordinator to approve a focused correction under the existing contract.
Do not silently broaden this tests-only slice or change an expected outcome to
match incorrect behavior. A new material policy decision remains deferred.

## Implementation sequence and acceptance criteria

1. **Preserve the current harness.** Extend
   `tests/e2e/private-fictional-workflow.spec.ts` for Journey G and
   `tests/e2e/private-fictional-student.spec.ts` for Journey S. Reuse each case's
   existing accounts/setup and real helpers; keep the third Admin case unchanged.
   No new config registration or shared helper changes are expected. Keep
   owned-DB assertions, serial execution and safe artifact settings.
2. **Two real browser journeys.** Register/verify the required actors through the
   actual provider; bootstrap only initial Admin role and exact metadata grants.
   Reuse actual current-MFA admission/screening decisions and fresh Tutor slots.
   Journey G uses a guardian learner and Math/appropriate existing supported level;
   Journey S uses a self-managed College learner and an offered subject/College
   Support. Do not hardcode nonexistent inventory or pre-authorize learner links.
3. **Shared reference and minimum projections.** Submit through the existing
   booking UI, verify one provisional record, grant exact Admin work and confirm
   through its real UI. In all permitted role dashboards/details and Admin exact-ID
   lookup compare subject, appropriate learner/Tutor/requester labels, UTC start/end,
   local timezone context, state and logical booking identity. Refresh each view.
   Do not compare different time zones as identical wall-clock strings.
4. **Meeting update and denial.** Assigned Tutor saves fictional allowed link A,
   then updates to B using the real UI. Fresh authorized participant reads and
   protected Join route open B, with external navigation intercepted. Foreign
   Parent/Student/Tutor and unassigned Admin requests cannot reveal the link or
   private record. Assigned Admin payload/DOM must omit meeting credentials too.
5. **Reschedule then cancel, per journey.** Move a confirmed future booking to a
   distinct actual available slot through the supported participant UI. Compare
   replacement across authorized role views and exact assigned Admin list/detail;
   old physical row remains replaced, same logical ID, one current active head,
   correct event actor/history, preserved old UTC interval and new interval.
   Confirm fresh candidates release the old interval and exclude the replacement
   interval. Old protected meeting open is unavailable; replacement initially has
   no link. Tutor saves its new link, then cancel through the authorized Parent or
   Student UI. All permitted fresh views/history show cancelled; Join is denied,
   slot releases and no active duplicate exists. Compare persisted notification
   intents to the committed transition without claiming actual email was sent.
6. **Completion, clearly separate records.** For each management model use the
   existing historical fixture helper with owned guards/history and that journey's
   authorized learner/Tutor/policy. Give Admin only exact fixture grant metadata.
   Through the actual assigned-Tutor UI complete after its saved end; verify
   completion/event/authorized history and assigned Admin state. Verify an early
   completion attempt on the newly booked future record is rejected and leaves it
   unchanged. Never edit current booking times or the production clock to pass.
7. **Interrupted submission.** Deterministically intercept only the new browser
   create POST, forward it exactly once with `route.fetch({maxRetries:0})`, wait
   for its actual committed receipt, and gate response delivery. Reload the page
   before the receipt reaches the document. Reopen the authoritative dashboard and
   find exactly that booking; retry the captured unchanged payload/key through the
   real API and verify the same booking/event and unchanged row/intent counts;
   a different key for the still-occupied interval must return a conflict.
   Use explicit promises/signals and cleanup, not arbitrary sleeps. Treat a
   discarded response as uncertain completion, not a failed transaction. This
   protects recovery without promising that a component's in-memory key persists
   across hard reload or inventing automatic resubmission behavior.
8. **Distinct-learner PostgreSQL race.** Use one actual screened Tutor/current
   booking policy and two separate self-managed admitted College accounts with
   distinct learner IDs and keys. `workflowFixture(...,"self", "tutor")` can
   establish the first; `admittedFixture(...,"self")` reuses the existing immutable
   admission policy for the second. Point both choices at the same offered Tutor
   subject and same fresh UTC interval. Hold the Tutor row lock with the owner
   connection, launch both actual service calls, observe both lock waits through
   PostgreSQL locks, then release it. Assert exactly one valid provisional success,
   a safe conflict for the other, one active interval/logical head, one creation
   event and its expected intents, correct winner ownership and no loser record.
   Replay winner unchanged, then ensure both learners' fresh scoped reads remain
   isolated. After authorized cancellation, the losing learner may retry using a
   fresh key and acquire the released slot. A winner must not be chosen by test
   timing or assumed identity.
9. **Security/availability safeguards.** Reuse neighboring exact authorization,
   same-key/double-click, conflicting reschedule rollback and booked availability
   protection suites. Add focused missing assertions only; do not duplicate whole
   existing suites. Retain all current MFA, policy/audience, revision/idempotency,
   transaction/exclusion, ownership and post-wait authority checks.

## Parallel ownership

- Worker A: **only** `tests/e2e/private-fictional-workflow.spec.ts`: connected
  Parent move/cancel, fresh assigned Admin reads, meeting/history and committed
  interrupted-response/hardreload recovery. Add local file helpers as needed.
- Worker B: **only** `tests/e2e/private-fictional-student.spec.ts`: fresh assigned
  Admin synchronization after Student lifecycle and separately labeled completion;
  strengthen existing identity boundaries without changing shared helpers.
- Worker C: **only** proposed
  `tests/integration/cross-role-booking-integrity.test.ts`: two-distinct-eligible-
  learner controlled contention and focused available-slot preservation evidence.
- Coordinator: all shared files only if necessary, docs/tracker, source
  inspection/integration and independent Review/Verify orchestration. Workers
  propose shared fixture changes first. No file collisions are planned.

Tests using policy heads/auth counters share state. Authoring can overlap, but
database/browser execution must be serialized; never run competing acceptance
commands against the same checkout-owned database/build.

## Verification plan for the separate verifier — DO NOT EXECUTE IN ARCHITECT

- Inspect current owned local DB/service status without printing secrets. Start
  only the isolated checkout-owned test cluster if needed; production/Neon and
  the owner's preview are not test targets. Record existing owned services and
  stop only services started by this operation after clients close.
- `npm run check` for format, lint, TypeScript and unit/component checks.
- `node scripts/with-test-env.mjs npm run build`, with existing warnings/limitations
  recorded. Preserve the actual normal build; no copied-source mirrors.
- `npm run test:integration -- tests/integration/cross-role-booking-integrity.test.ts`
  plus affected existing policy-booking, policy-booking-acceptance,
  policy-booking-boundaries, private-admin-bookings, booking-read-scope,
  booking-meeting-links and Tutor-completion files after verifying their exact
  current filenames. Record selected-file scope rather than claiming the full
  integration suite passed.
- `npm run test:e2e:private`: the extended Parent/Tutor and Student cases together
  with the unchanged Admin case, one worker/no retries. A focused run is
  useful during development but cannot replace final integrated private-suite
  acceptance. Record actual discovered counts, failures and durations.
- Check representative lifecycle details/history at phone/desktop widths using
  existing accessible controls; reuse current Axe/overflow helpers where useful.
  Do not claim physical-device, full screen-reader or hosted verification.
- Independent read-only Review compares the exact delta to this blueprint and
  checks assertions would fail on incorrect ownership/status/link/version counts.
  Review is separate from execution; rerun affected checks after final repairs.
- Keep raw captures, owner evidence, cookies, factor/verification information and
  private links only in ignored restricted local artifacts. Final docs include
  safe aggregate results, source identity and exact evidence scope.

Verification status: **NOT RUN — architecture planning only**.

## Context, results and limitations

Coordinator creates proposed `docs/qa/cross-role-booking-checklist.md` and
`docs/qa/cross-role-booking-results-2026-10-16.md`, with two valid journeys and
distinct Implemented/Executed/Not Applicable/Not Run labels. Update the M8.9
acceptance note and progress tracker only with observed outcomes. Existing PRD
contracts already own these invariants; a concise acceptance reference may be
added without changing product policies. No architecture/UI/standard change is
planned. Do not mark launch or hosted-readiness gates complete.

Rollback is the scoped test/documentation delta only; never reset unrelated work
or delete retained QA/customer records. Real hosted activation, delivered Resend
email, actual Zoom/Meet participation, full elapsed fresh-booking completion,
independent minor login, payments and final launch approval remain unverified or
gated separately.

## Handoff

Blueprint ready. Scope is **AUTHORIZED — build-feature delegation** for separate
implementation, read-only Review, executed Verify and accurate Remember stages.
No unresolved product decision blocks these tests. Any new actual production bug
or material decision returns to the coordinator before expanding implementation.
