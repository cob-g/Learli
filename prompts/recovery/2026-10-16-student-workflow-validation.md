# Student workflow validation — controlled local recovery

- Authority: **AUTHORIZED — build-feature delegation**, owner-approved M8.9
  Student recommendation; no production/provider/reset authority.
- Branch: `feature/staging-interface-cleanup-20261016`, base `572cf4d`, preserved
  mixed dirty baseline under `.local/student-workflow-20261016/`.
- Mode: targeted test-environment correction; no application or test repair.

## Full-check filesystem fixture mismatch

Observed: first `npm run check` completed format/lint/typecheck and ran127
unit/component files.1942 tests passed; one failed in
`hosted-auth-private-capture.test.ts`, the existing exposed-capture permission
case. It expected a rejection but capture returned successfully.

The coordinator launched the command under shell `umask 077` to protect its log.
That setting propagated into the test runner. The fixture requests mode0644 to
exercise rejection of exposed files, but umask077 turns the actual file into 0600. Capture correctly accepts that private file. The unchanged test therefore
did not exercise its intended exposed-file condition. Baseline/source inspection
establishes the setup mismatch; this is not evidence of a new capture bypass.

Recommendation: preserve the failed log, create the new log explicitly as0600,
and rerun under the normal shell umask rather than changing test expectations or
weakening filesystem checks. Keep all source, test, fixture assertions and data
unchanged. This correction is within authorized isolated verification.

Recover performed diagnosis only. A separate Verify stage must execute the
unchanged suite under the intended settings and report its actual result.
No reset, code repair or hosted operation is proposed.

## Outcome

Separate Verify reran unchanged source/assertions with normal umask022 and a
pre-created0600 log. `npm run check` PASS:127 files/1943 tests plus formatting,
lint and TypeScript. Initial failure remains in `check-final.log`; corrected
result is `check-corrected.log` under the private evidence directory.

## Student browser selected-time URL assertion

Observed: first combined private browser run passed Parent/Tutor but stopped the
Student case during the later signed-in Science/College profile selection.
The assertion expected URL `startAtUtc`; it received null. Earlier anonymous
selection through signup/verification/admission had already passed.

Source diagnosis: ProfilePicker's native GET submits `time=start|end`.
NewBookingPage parses this supported input without redirecting authenticated
visitors. Anonymous access redirects to sign-in with a canonical public choice
using split start/end fields. The test incorrectly assumes both URLs have the
same serialization. No application selection-loss defect is established by this
failure. The existing parser, hidden booking fields and selected radio preserve
the interval for the subsequent learner/available-time form.

Recommended targeted repair: assert the complete supported native interval,
subject and level, then retain the subsequent selected-radio and persisted UTC
booking assertions. Do not remove selected-time verification or change working
application serialization merely to match a test. Browser author is independently
checking this diagnosis; separate implementation and browser rerun are required.
No new production source change is proposed. First run: `playwright-first.log`.

## Student browser response capture during navigation

Observed: the second combined browser run passed Parent/Tutor again. Student
reached booking creation and received HTTP200, then Chromium rejected the test's
late `response.json()` read: the response resource was unavailable after navigation.
The helper awaited the real double-click before reading the body. Application
booking submission parses its own response and immediately navigates to details.
No application rejection or false success is established by this failure.

The browser author independently confirmed this response-lifecycle race from
source and the preserved `playwright-second.log`. Mode1: targeted test helper
repair. Register request-input and response-status/body capture before the action;
start the actual click/double-click and await all three together. Preserve exact
receipt, same-key retry, single-record/event and saved-state assertions. Do not
substitute database output for the actual response or add arbitrary waits.

Repair authority: **AUTHORIZED — build-feature delegation**, test-only within
M8.9. Recover ends with this recommendation; separate implementation, read-only
Review and browser verification follow. This is distinct from the earlier URL
serialization mismatch; neither failure justifies an application change.

### Response-capture repair1 did not resolve the browser lifecycle race

The third combined run still received HTTP200 and failed while reading the
response body, now from the eager callback. Parent/Tutor passed again. Preserved
log: `playwright-third.log`; final TypeScript after this test-only repair passed.
Reading earlier does not guarantee Chromium retains a body across the page's
immediate navigation. This repair was insufficient; do not repeat it unchanged.

Recover recommendation for independent review: intercept only the exact mutation
POST and forward it once to the actual server, capture that real response before
returning it unchanged to the browser, then remove the handler. Keep request,
status, receipt, actual click/double-click, retry and database/event assertions.
No fabricated response, mutation replay, database-derived receipt, arbitrary wait,
production change or reset. The browser author is checking the narrow passthrough
approach before separate implementation and Review. This is the first failed
repair of this response-lifecycle issue, distinct from the resolved URL contract.

## Student conflict feedback locator

The fourth combined browser run passed create/double-click, exact retry and
saved-state checks, then received the expected409 for another Student's stale
slot. Its feedback assertion used unfiltered `getByRole("alert")`, matching both
Learli's conflict paragraph and Next.js's empty route-announcer element. The
strict locator failed despite the correct visible conflict message. Parent/Tutor
passed again. Evidence: `playwright-fourth.log`.

Mode1 test locator repair: filter the alert by the existing complete conflict
message, require it visible and assert that exact text. Retain409 and unchanged
reservation/state checks. No application behavior change is indicated. Recover
ends with this diagnosis; the coordinator authorizes separate scoped test repair,
Review and verification under the existing build-feature delegation.

## Final separate verification outcome

The fifth combined normal-build browser run passed both cases: Student12.5s,
Parent/Tutor6.9s,21.3s total. The deterministic passthrough resolved body capture;
exact visible conflict feedback then allowed the remaining security, reschedule,
cancel, historical completion and logout checks to execute successfully.
Scoped cross-author Review passed all test repairs. The historical completion
fixture remains separate; no real video/mail or newly elapsed lesson is claimed.
Failed attempts are retained; no application behavior or security assertion was
weakened for these test repairs.

Final integrated `npm run check` rerun after all test repairs PASS:127 files,
1,943 tests, format/lint/TypeScript. `check-closeout.log` retains the actual result.
No production source changed after the passing build and affected database run.
