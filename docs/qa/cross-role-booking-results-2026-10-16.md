# Cross-role booking acceptance — local results

**VERIFIED LOCAL — corrected cross-role acceptance passed.** This record concerns the corrected
[two-journey checklist](cross-role-booking-checklist.md), not a four-account
child-login model. Blueprint:
`prompts/features/m8-09-cross-role-booking-acceptance.md`, **AUTHORIZED —
build-feature delegation** following the owner's approval of the recommendation.

Baseline: clean local `main` at `7d2b155`; implementation branch
`feature/cross-role-booking-acceptance-20261016`. Baseline hashes and local evidence
are retained under ignored `.local/cross-role-booking-20261016/`.

## Scope

Extended two existing actual-build browser cases (Parent/Tutor and independent
College Student), retained the Admin case, and added one deterministic
two-learner PostgreSQL test. Nine changed/new files are tests and documentation;
application code, schema, dependencies, runtime grants and policies are unchanged.

The guardian-managed child uses the Parent account. Student views remain scoped
to the account's own independent eligible College learner. Admin needs current
MFA and the exact assignment and receives no meeting credentials.

## Corrected lifecycle results

| Check                                    | Result and evidence scope                                                                                                                                                                                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parent request and assigned confirmation | PASS: real UI request, one provisional booking, exact current-MFA Admin confirmation.                                                                                                                                                                                                                         |
| Tutor receives the booking               | PASS for both management models: current permitted learner, subject, UTC/timezone context and state agree after fresh document reads.                                                                                                                                                                         |
| Learner association                      | PASS under the approved model: guardian booking through Parent; independent College booking through Student. Opposite scope and foreign access denied. No separate child login.                                                                                                                               |
| Admin sees the record                    | PASS for exact assigned records; before assignment the record is absent. Minimal participant context and saved times/version/state match. No meeting credentials.                                                                                                                                             |
| Meeting updates                          | PASS: actual Tutor save/replace, fresh participant reads and intercepted protected navigation agree. Retired/missing/replaced/cancelled links and unrelated/Admin access are checked.                                                                                                                         |
| Completion                               | PASS for separate already-ended guardian and independent fixtures through actual assigned-Tutor controls, matching participant/Tutor/Admin history. Premature fresh-booking completion remains rejected. Full elapsed newly booked lessons and attendance are NOT RUN.                                        |
| Cancellation                             | PASS for both journeys: matching fresh participant/Tutor/Admin states, retained history, released interval, private-link denial and retry-safe events/intents.                                                                                                                                                |
| Rescheduling                             | PASS for both journeys: same logical identity, new physical revision, original UTC interval/history retained, one active head, old slot released/new reserved, replacement starts without a link.                                                                                                             |
| Integrity and recovery                   | PASS for tested scope: Parent double-click, committed-but-withheld response/hard reload, same-key replay/fresh-key conflict; actual distinct-learner lock contention has one winner/409 loser, isolation and released-slot acquisition. Neighboring booked-availability/rollback/ownership tests also passed. |

The original four-login child checklist is superseded only by this corrected
two-journey matrix. These results do not claim every proposed security scenario,
real provider operation or production condition has been tested.

## Review and executed verification

- Cross-author read-only Review PASS, **READY FOR VERIFICATION**, zero open
  confirmed findings. Student author reviewed Parent; PostgreSQL author reviewed
  Student; Parent author reviewed PostgreSQL and coordinator docs. Coordinator
  inspected the combined change. Subsequent test-only repairs were independently
  re-reviewed. Review ran no tests or service commands.
- Final `npm run check`: PASS for formatting, ESLint, TypeScript and **130 files /
  1,990 unit/component tests**, final test phase **12.65 seconds**. This ran after
  the last browser-test repair.
- `npm run test:integration --` followed by the nine explicit files below: **169
  tests PASS / nine files**, **105.02 seconds**, serialized against actual owned
  loopback PostgreSQL 17 `learli_test`. Includes the new controlled two-identity
  race, not merely a sequential stale-slot check or same-requester retry.
- `node scripts/with-test-env.mjs npm run build`: PASS; four existing dynamic
  filesystem tracing warnings. All **140 traces** exclude local state/environment
  files. The later repairs touched browser tests only; application/configuration,
  dependencies and PostgreSQL-test source hashes remained unchanged, so this
  build and database result apply to the accepted source.
- Final `npm run test:e2e:private`: **3/3 PASS**, normal production build,
  Chromium, one worker/no retries, **51.9 seconds**: Admin **17.4**, Student **15.8**,
  Parent/Tutor **16.9** seconds. Actual registrations, verification, MFA, reviews,
  booking mutations, fresh reads, private links, historical completion and
  real Student UI logout/protected revisits were exercised.
- Existing bounded phone/desktop Axe/overflow and keyboard checks ran within the
  cases; this is not physical-device, full visual or screen-reader acceptance.
- Existing **34 migrations** were current; none applied. Final **570 source
  hashes** match the accepted test run. No application/schema/dependency changes.

Selected PostgreSQL files: `cross-role-booking-integrity`, `policy-booking`,
`policy-booking-acceptance`, `policy-booking-boundaries`, `private-admin-bookings`,
`booking-read`, `booking-meeting-links`, `tutor-completion`, and
`private-student-read-scope`, each under `tests/integration/` with `.test.ts`.
This selection is not the entire integration suite.

## Failed attempts and recovery

Before execution, Review caught an incorrect Save/Replace meeting selector and
time assertions that would fail for valid cross-midnight displays; both were
corrected without changing application behavior. A plain-Node diagnostic also
needed the repository's installed TypeScript loader.

Browser attempt 1 passed Admin but failed Student logout and the Parent historical
grant reference. The reference now matches the existing synthetic fixture
constraint. Redundant navigate-plus-reload pairs became one fresh document load;
all state, identity, time and privacy assertions remain. Attempt 2 passed Parent
and Admin but still failed the final session-dependent Student account chip.
Status-only diagnostics observed **31 successful session lookups and seven HTTP
429 responses** in that Student page; no timeout DOM was retained. The final test
uses the existing server-authorized Account page, verifies the intended identity,
and clicks its dedicated main-content Sign out control. The actual provider POST,
redirect, protected-page and API denial assertions remain. It passed despite the
same recorded throttled lookups. No rate limit, within-case counter, production
behavior or authorization was weakened; no arbitrary delay was added.

Original logs/private error contexts are retained. See the
[recovery record](../../prompts/recovery/2026-10-16-cross-role-booking-validation.md).

## Remaining limits

Real email/video, fresh-booking full-duration completion, hosted activation and
manual production QA are NOT RUN. Completion fixtures are separately already
ended; external destinations are intercepted. Notification intent counts are not
email delivery. Payments are disabled/NOT APPLICABLE. Session lookup throttling
can temporarily replace optional account chrome under a burst; the guarded
Account page remains the verified logout route. The full proposed public/staging
security matrix and independent child login are not established by this pass.

After zero other cluster client connections were observed, the owned test cluster
was stopped with data retained. Browser 3121 stopped; owner preview 3000 retains
its original process and configuration. No hosted/provider operation, account
purge, commit, merge, push or deployment occurred. Changes remain uncommitted on
the feature branch. This is local acceptance, not M8 or production readiness.
