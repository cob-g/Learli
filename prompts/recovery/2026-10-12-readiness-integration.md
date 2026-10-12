# Readiness integration verification recovery

Authority: AUTHORIZED — build-feature delegation for the local readiness wave.
Mode: Targeted investigation; no runtime repair chosen. Base `5634e44`, isolated
`cob-g/m8-readiness-integration`; main and all user data are preserved.

## Observed failure

Combined `npm run check` attempt 1 passed formatting, lint and typecheck, then
reported 759 passed / 1 failed across 40 unit/component files. The unchanged
`tests/components/account-email.test.tsx:114` code-only validation case timed out
waiting for the initial safe status to receive focus: the submit button retained
focus. The email form and this test exactly match the baseline. Original command,
source hashes and log remain in `.local/readiness-wave/verification/check-1*`.

The component schedules status focus with requestAnimationFrame after async state
updates. A scheduling/commit race is a hypothesis, not yet a confirmed cause;
CSS is not imported by this component test. There is no evidence of a provider,
database, authorization, data-integrity or private-information failure.

## Separate verifier handoff

Run the unchanged eight-case component file in isolation, retaining every result,
then the unchanged full check if the isolated result warrants it. Preserve actual
focus assertions, response/validation semantics, and existing test timeouts.
Do not retry blindly or call a later pass a repaired implementation. If the
failure reproduces, obtain evidence for a bounded implementation repair and
independent review. Browser focus checks remain part of combined acceptance.

Recover performed read-only source/baseline/log inspection and wrote only this
note. No test or code change was made in Recover; execution belongs to Verify.
Status: investigation open; no test success or root-cause certainty claimed.

## Dispatched bounded diagnosis — 2026-10-12

Authority remains AUTHORIZED — build-feature delegation, now explicitly bounded
by the coordinator to the email form, its component test, this recovery note and
a factual tracker append. The readiness blueprint is
`prompts/features/m8-01-readiness-wave.md`; related criteria are M8.9 and NFR-01/02.
A second unchanged full check failed the same initial focus assertion in a different
parameter row (both fields), while the isolated eight cases passed. Source hashes
remain `32a1be4ad2cc7f62b723e6f493b9859013bba77d8b78c791fbdc2b0b44288a47`
and `74cc9796e98613bbf1523528d8664c8bdba5126f8ec5ce9adbdd2544dc37c7c1`.

Mode 1 / Targeted Fix investigation: the result focus callback reads a React ref
from a frame timer after async state setters, without a commit dependency. Installed
jsdom queues frame callbacks using an interval, while installed React flushes async
act work through a distinct task queue. Their relative scheduling is not a React
commit guarantee. The exact callback/commit order in the historical failures is
unknown. There is no application repair attempt yet.

Separate implementation/verifier handoff: preserve originals and instrument only
owned component tests to observe whether an ordinary frame sees a mounted notice
under the full suite; then add a bounded fast-response/early-frame reproduction
that keeps observable focus assertions. If this establishes a missing ref at the
focus attempt, move only result-notice focus to a post-commit React lifecycle.
Preserve field-validation focus, auth/request contracts, codes, uncertainty locks,
recovery links and hydration/no-JS behavior. Do not change timeouts or assertions.
Recover has not executed this handoff or modified source/tests.

## Recovery conclusion after separate diagnostic verification

The ordinary instrumented full suite passed760/760; that pass is not a repair
and did not reveal timing (successful-test console output was suppressed).
A controlled asynchronous early-frame regression then failed3/11 in isolation
and3/763 in the full suite, while every760 existing case passed in that full run.
The preserved callback observations show `noticeMounted:false` and active
`BUTTON` for fast200,400 and503 responses. Thus the precise reproduced cause is
the one-shot frame focus attempt before the result notice/ref has committed.
The historical failures have the same missing-focus symptom, but their exact
callback ordering was not instrumented and cannot retrospectively be proved.

Targeted repair authorized by the existing delegation: focus result notices in a
React effect dependent on the notice, which executes after its DOM ref commits.
Keep validation-field frame focus unchanged. Add the three controlled behavioral
regressions, without retaining temporary filesystem/console instrumentation.
The regression models an available asynchronous frame during batched async
response work; it does not claim to replay a captured historical event trace.
No resets, dependencies, business/auth/privacy changes or broader source repairs
are justified. Separate Review and Verify are still required after implementation.
Evidence: `.local/readiness-wave/email-focus-repair/early-frame-baseline*`,
`early-frame-full-baseline*`, and `early-frame-observations.ndjson`.

### Browser selection recovery

The first bounded browser command exited1 with `No tests found`; no selected test
ran. Its anchored grep assumed the test name began the full Playwright title,
but Playwright includes project/file context. This is a targeted verification
selection error, not a new application defect. Retain `repaired-email-browser*`;
separate Verify will use the same approved config and an unanchored exact-name
selection. No assertion/source/config change or additional scope is required.

## Separate implementation, Review and Verify outcome

Status: bounded repair VERIFIED locally; root independent review and combined
acceptance pending. No claim that the whole readiness wave or launch is complete.
Implemented result-notice focus via `useEffect([notice])`; every original business,
privacy, validation, code-clearing, uncertainty and no-JS path remains unchanged.
Added three fast-result/early-frame focus regressions; all eight original tests,
assertions and timeouts remain. Same-agent read-only Review ran separately before
Verify: alignment/integrity/unintended-change PASS, READY FOR VERIFICATION, no
confirmed findings. This is not independent review.

Separate Verify passed `npm run check` (format/lint/types,763/763 in40files),
`NEXT_TELEMETRY_DISABLED=1 node scripts/with-test-env.mjs npm run build`, and the
coordinator-approved bounded existing Chromium email selection (3/3). It covered
real synthetic proof/native recovery at1440/390/320, uncertain alert focus and
no-JS/stale/suspended/origin/raw-provider denial. Private local config omitted
inventory globalSetup/dependencies and disabled trace/video/screenshots; the two
explicit-screenshot inline cases were excluded from this bounded selection and
remain with root's full acceptance. No test assertion was changed. Each command,
exit code, exact config/source hashes and historical failure is retained in the
private report. The first empty browser selection is preserved as a discovery
failure, not a test pass. Slot B is released.

Frozen repaired source SHA256:
`5f3a88f0dcb37c459a8c89d7ac0db564c2fa0b0a4065eb0d450406083096534e`.
Frozen repaired test SHA256:
`6bb8ff3bf5fa147ef555e4c5678704a34bfad9c85a9c44b90298bd887094356d`.
Root's later performance-script/test imports are outside the worker full-check
snapshot and require root's final complete check. No broader runtime repair,
package/config/migration changes, resets, external delivery or production action.

## Booking result-focus recovery — 2026-10-12

The later Firefox/WebKit full run passed17/18 and failed the Firefox guardian
lost-response retry at its existing saved-heading focus assertion. Root's full
Chromium run passed117/117 on the same application inputs. Both outcomes remain
preserved; a Chromium pass does not close the Firefox failure.

Root owns only `demo-booking-form.tsx` and a new focused component regression.
Read-only diagnosis found a one-shot animation-frame callback immediately after
`setResult`. Separate diagnostic Verify added three asynchronous early-frame
cases for saved, expired and unknown-result retry responses. All three fail on
the unchanged component because the rendered result does not receive focus;
the retry case still proves identical request arguments. Evidence:
`.local/readiness-wave/verification/booking-focus-baseline*`.

Recover classification: targeted timing fix. An early frame can precede the
result ref's commit; this controlled reproduction does not establish the exact
historical Firefox frame order. Proposed implementation: focus the result from
an effect dependent on `result`, after the heading/ref commits. Preserve all
candidate loading, notice focus, idempotency keys, uncertainty, expiry and server
contracts. No timeout or browser assertion changes. After implementation, obtain
independent Review C and focused component/check/build plus affected browser
verification; performance must import the final runtime before timing.

The first broad check passed formatting/lint but failed TypeScript because the
new Testing Library regression used Playwright's unsupported `exact` option in
two role queries. Remove only that option: string accessible-name matching is
already exact in this API. No expectation, timeout or production code changes
follow from this test-authoring error. Preserve `check-booking-repair` and rerun
the complete check on the corrected test.

### Booking focus repair verification checkpoint

Separate implementation adds only result-dependent effect focus; all three
regressions pass. Independent Review C's source inspection found no confirmed
finding. Root full check passed788/788 in42files after correcting the test API
option, and the production build passed. Existing booking and public-profile
Chromium projects passed9/9 using a private config with no inherited inventory
setup/dependency suites and unchanged assertions; owned DB55507/application3167.
The earlier complete default run passed117/117 before this result-only repair;
this is retained unchanged coverage plus an affected rerun, not a second full117
run. Final selected Firefox/WebKit proof and combined harness acceptance remain.
Command/source receipts: check-booking-repair-2, build-booking-repair,
booking-browser-discovery and booking-browser-repaired under ignored verification.
