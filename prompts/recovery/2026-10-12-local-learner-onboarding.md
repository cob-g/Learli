# Task C local onboarding recovery history

Authority: AUTHORIZED — build-feature delegation, Task C local own scope only.
No production, peer or customer data involved. Baseline0000–0016 immutable.

## R1 — fresh fixture target guard

Observed: initial setup passed. Coordinator approved preserving initial own dev/
test databases under *_onboarding_initial on55813, then applying final unreleased
0017 to fresh exact targets. Both fresh migrations PASS, seed safely FAIL with
"Fixture setup stopped safely. Check the private fixture manifest; existing
accounts were not overwritten." Original logs remain in .local/local-completion-wave.
Diagnosis: specific owned setup mismatch, not application policy failure: previous
private fixture manifest refers to identities in the preserved initial DBs.
Mode: targeted setup fix. Preserve the original manifest under a unique private
archive name, then run existing seed for new exact targets. No overwrite/delete
or relaxed seed guard. Separate verifier must observe seed pass and fresh/forward
migrations/grants; prior initial setup remains historical, never final proof.

## R2 — initial static gate

Observed check-1 format PASS, lint FAIL at new form: synchronous hydration-state
set in effect; raw internal anchor for learners navigation. Type/tests not reached.
Diagnosis Mode1 targeted implementation convention defects. Use React installed
useSyncExternalStore hydration snapshot (false SSR/true client, no effect setState)
and Next Link with explicit native document replacement on successful own-profile
navigation. Preserve prehydration no-submit, request identity, current private reads
and value/error focus. No lint suppression or change to shared config. Re-review
revised form, rerun full check; original .local check-1.log retained.

## R3 — test helper overload type

check-2 format/lint PASS; typecheck FAIL in own PG test helper because ReturnType
of pg.Pool.connect selected its callback overload (void), not awaited PoolClient.
Mode1 targeted test typing defect. Import installed pg PoolClient explicitly; no
runtime change, unsafe cast, assertions weakening or compiler-option changes.
Re-review helper type; rerun full check. Original check-2.log retained.

## Integration-owned shared verifier mismatch

check-3 static gates PASS;899 unit/component PASS,1 unchanged staging journal
count FAIL (17 expected,18 actual). integration-1 has441PASS/27FAIL of468;
all16 own creation and inherited learner12 pass. Every27 failed case is in
unchanged staging-migrations.test.ts; root explicitly owns count/function/grant/
protection reconciliation for newly introduced custom functions. No shared test
or verifier assertion skipped/weakened by C. These full commands remain FAIL;
root must execute reconciled combined gates. Local feature checks continue
under root's acknowledged scope exception. Expanded own negative/orphan-row
coverage needs a separate focused real-PG run.

## R4 — automatic learner loading boundary hides no-JS explanation

Observed browser-1:5PASS/1FAIL. In no-JS case the explicit noscript paragraph
exists but is hidden; locator resolves14times with unexpected hidden value.
Existing learners/loading.tsx creates an automatic streaming Suspense boundary,
so resolved learner HTML needs inline scripts to reveal it. This matches the
already documented private booking/tutor-preview streaming limitation; disabled
controls and method=post still prevent private query submission.
Mode1 route rendering defect. Proposed smallest repair: remove owned automatic
learner loading boundary and fully await SSR HTML; preserve API GET/PATCH,
permissions and form pending/validation/uncertainty/retry behavior. NoJS warning
must become visible. Coordinator decision requested before changing route-loading
convention. No test assertion or JS requirement weakened. Original browser-1.log
and ignored error-context/screenshots preserved. After approval: re-review scoped
route change, static check/build and all6learner browser cases, retain unaffected
business29PG/forward-grant proof because SQL/service remain unchanged.

## R5 — awaited HTML reveals inherited edit GET fallback

Read-only pre-rerun privacy trace: LearnerForm's native form has no method/action,
SSR-enabled minimum private inputs and only JS onSubmit interception. Removing
inherited hidden loading segments in R4 would expose that existing no-JS form;
native Enter would submit minimum learner fields into the current GET URL.
Mode1 privacy-preservation repair required before candidate verification. Proposed
same scoped guard as coordinator-approved creation form: hydration snapshot,
SSR-disabled fields/submit, explicit noscript text, method=post/private API action.
Keep hydrated PATCH request/service/validation/ownership behavior unchanged.
Extend no-JS browser case to authenticated list/detail read and non-submission,
then create warning. Root technical approval requested; lease returned while
repair-only. Not claiming observed browser GET leakage; finding is source-backed
native form behavior, prevented before intentionally exercising a leak path.

## R6 — SSR regression DOM matcher realm

focused-unit-2 actually23PASS/1FAIL of24. A preceding status incorrectly said24PASS
because shell exit reflected the later lint command; immediate correction sent to
root and retained here. Failure: jest-dom toHaveAttribute rejects DOMParser-created
HTMLFormElement without an owner window even though the printed markup has
method=post and disabled fields/button. Mode1 test matcher realm defect, no runtime
failure observed. Assert native getAttribute/hasAttribute directly on parsed SSR
markup; preserve exact POST/disabled checks and real browser noJS assertions.
No matcher/config suppression. Re-review changed assertion semantics and rerun
focused guards; record actual command exit individually.

## R7 — navigation interception teardown ordering

Final check5 static gates PASS,900unit/component PASS/1 unchanged shared staging
count FAIL; build2 PASS; client secret/learner-SQL scan44files/8actual patterns zero
matches. browser2 has5PASS/1FAIL: noJS list/detail/create now PASS. New delayed
navigation assertion observed pending label but route.fulfill raised "Route is
already handled!" because test removed interception immediately after releasing
the gate, before the handler fulfilled. Title remained on old list; this is an
observed test teardown ordering defect, not evidence of broken production navigation.
Mode1 targeted test-only fix: await actual new page title before unroute, so response
fulfillment completes first. Preserve pending assertion/all actual journey/privacy
checks; no sleeps/timeouts/guards weakened. Re-review test ordering and rerun all6
learner cases. Runtime/source static/build/PG/grants remain byte-identical and their
scope-specific evidence stays applicable. Original browser2 artifacts archived.

R7 execution: browser3 observed6/6PASS after teardown waited for actual title. Root
also requested finally cleanup (msg_675a38429c62), so test now always releases gate
and uses installed Playwright unrouteAll({behavior:'wait'}) to await active handlers.
No suppression/ignoreErrors, timeout extension or runtime change; final browser4
covers the exact finalized test source. Review8 read-only readiness is separate.

## Final scoped outcome

browser4 observed6/6PASS on final finally-cleanup test source, after browser3 also
6PASS on the prior ordering repair. check5 static format/lint/types PASS,900PASS/1
shared staging journal FAIL; full integration1 shared27fail/441pass is retained,
not relabelled a green full run. Feature real-PG29PASS, focused unit/component24PASS,
build2 PASS, forward/fresh/grant proof PASS and client secret/SQL scan44files,
8actual patterns/zero matches. Domain/runtime applicability bridge and final file
manifest identify exactly retained versus fresh evidence. Same-agent Review8
readiness remains separate; root owns independent combined review and shared
staging reconciliation. No feature defect remains confirmed in owned scope.
