# Learli Recovery — Family dashboard checks

Status: AUTHORIZED — build-feature delegation for scoped local repairs under actual 2026-10-11 task. Mode: Targeted Fix. Baseline 0c078bf50f9f967b20391ef3640353a7b3897e62, branch cob-g/m5-3-family-dashboard, M5.3/M5.4 OPS-01/OPS-03/FAM-03/BKG-04.

## Expected versus observed

First `npm run check` passed formatting and stopped at ESLint react/no-unescaped-entities, states.tsx line22. Exact retained output: .local/check-independent.log. Focused16 component/model cases passed before this check; no runtime authorization or data failure observed.

## Diagnosis and recommended repair

Observed root cause is one JSX body apostrophe in new unavailable copy. Escape it using &apos; without changing displayed text or permission behavior. No polluted checkout, package, database or foundation issue; preserve all existing runtime checks, fixtures and failed logs. No secrets or real data involved.

## Separate execution and verification

Recover performs no code edit/test. Build-feature implementation owns the reversible JSX repair; scoped read-only re-review then lint/component verification must follow. Final full check runs only once the pending provider import/adapter is present. No extra human approval is required for this in-scope local repair. No destructive reset, external/provider action or policy change.

## Review finding — device clock, 2026-10-11

Read-only Review confirmed ExpiryRefresh scheduled its refresh using absolute device Date.now. A clock behind the server could retain a stale active display; a clock ahead could refresh before TTL elapsed. This is a targeted implementation timer bug, not an authorization/query or architecture issue. Recommendation: schedule elapsed delay from expiresAt minus the provider snapshotAt, refresh only through server reads, and add a browser regression with a one-hour skew. Build-feature owns implementation and separate verification; provider detail countdown is a distinct peer-owned repair that requires coordinator-authorized hashes.

## First real PostgreSQL run — fixture status

`.local/integration-final-1.log` records 167 passed and one failed test across ten files. The failure violates existing learner_profiles_status because own fixture used archived, while the applied schema permits active/inactive. Archived in the task means an unavailable profile, represented by inactive in this repository. Targeted Fix recommendation: change only the own integration/browser fixture updates to inactive, keeping all revoked/inactive visibility and direct-filter denial assertions. No schema or application permission change is needed. Retain first failure, inspect revised tests in read-only Review, then rerun the full PostgreSQL suite.

## Verification execution overlap

The second PostgreSQL run and first browser run were mistakenly launched against the same owned isolated test database. Browser global setup truncates synthetic tutor inventory, and the concurrent booking suite reported a waited-authorization assertion failure (167/168 overall). Browser was stopped with exit143; original logs remain `.local/integration-final-2.log` and `.local/browser-final-1.log`. This is polluted verification evidence, not evidence requiring a booking mutation repair. Recommended controlled execution recovery: preserve source/data/logs, run the unchanged full integration suite alone, then browser suite alone; no reset or baseline test edits.

The first serialized rerun (`.local/integration-final-3.log`) found stale synthetic auth throttle counters at booking beforeAll, producing a missing signup user (113 passed, 55 skipped; suite failed). Existing auth browser/integration setup already resets these counters; bookings runs first and does not. Prepare only owned test throttle counters with an ignored helper, without changing auth configuration or throttle assertions, then run full integration alone. Record the safe aggregate peak in `.local/prepare-verification.log`; no fixture records or credentials are printed. No user/tutor/booking rows are reset.

## No-JavaScript automatic loading boundary

`.local/browser-final-2.log` records52/53 browser cases passing, all49 baseline cases and three own cases. Own parent no-JS All learners assertion fails because the automatic loading.tsx Suspense boundary leaves completed server content in a hidden streamed segment without browser JavaScript. Provider peer observed the same detail behavior. Coordinator msg_2c08fade8596 authorizes removing only own newly added automatic student/parent loading boundaries, fully awaiting core server content, and preserving native GET plus meaningful client pending feedback (useLinkStatus/form submission). Keep visible no-JS assertions; verify pending through a real client control with owned SQL blocked, then inspect narrow/desktop states. No global Next configuration, provider bytes or authorization changes proposed. Separate Implementation applies and Review/Verification assess this targeted repair.

## Native pending navigation harness / progressive enhancement

V3 `.local/browser-final-3.log` records52/53 passing, all49baseline and own no-JS parent/detail/student, scope and denied-state assertions. Pending locator reports "waiting for navigation to finish" while the native document request is deliberately SQL-blocked; this proves harness coupling, not absent submitted React state. Own form already synchronously commits state, but visible paint/Back behavior is unverified. Coordinator msg_4b2a3b252e09 reports provider alignment to hydrated useTransition/router.push with native method=get retained. Targeted own recovery recommendation: use the same progressive navigation approach, preserve strict server query/permissions and no-JS assertions, key form by authoritative selected learner for Back radio restoration, and verify actual pending DOM/screenshot while controlled SQL waits plus Back reset. No provider edits. Retain original failure; execute separate read-only re-review and affected/full checks after implementation.
