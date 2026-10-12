# Local support assignment recovery

Authority: AUTHORIZED — build-feature delegation, Task D M5.6/M5.9 OPS-05/ADM-03.
Baseline0494f6b4, own uncommitted synthetic local checkout only. No real data,
booking/schema change, provider operation, external message or reset.

## R1 — same-agent read-only Review findings

Mode: Targeted Fix. Recommendation: CHANGES REQUIRED, two Important UI findings.

- `src/app/(workspace)/admin/support/page.tsx`: sequential loadPrivatePage calls
  swallow every first-load error; dispatch authority could render an empty review
  list after a transient review-service failure. Expected only explicit missing
  reviewer capability permits the dispatcher-only shell. Actual source treats
  outages, invalid page and permission denial identically. This is confirmed by
  source inspection; no failing runtime experiment claimed by Review/Recover.
- `src/features/support/assignment-form.tsx`: when final candidate is assigned,
  refreshed choices can become empty and the conditional early return removes
  success status/focus. Expected committed result remains visible/focusable.
  Actual conditional hides the notice. Existing23 lightweight cases cover ordinary
  success with available alternatives but not props changing to empty/closed.

Preserve exact scope, current permission checks, unknown/stale blocking, case
status rules, SQL history/grants and original report/reviewer paths. Repair only:
use one private-page loader with explicit403 handling and exact nonempty dispatch
scope before an empty reviewer shell; all other errors propagate. Move assignment
notice to stable output outside conditional controls, retaining commit-based focus.
Add component prop-change acknowledgement regression; full checks, actual browser
and PostgreSQL remain separate Verify responsibilities. Recovery executes none.
Status: ready for authorized separate implementation, not yet verified.

## R2 — full check1 formatting failure

Observed: `npm run check` exit1 stopped at format:check for this recovery note and
support dispatch tooling. No lint/types/unit ran in that command. Mode: Targeted
Fix, formatting only on the two owned files; preserve behavior, original log,
checks and scope. Separate implementer formats; Review checks whitespace-only
runtime diff and separate Verify repeats full check. No tests run by Recover.

## R3 — check2 lint failure

Observed: formatting passed; lint stopped on nine errors (repeated static-anchor
Next performance rule reports on three native links, one synchronous hydration
state effect) and one unused test import. No typecheck/unit ran in check2.
Mode: Targeted Fix. Existing support case/meeting-link forms use
useSyncExternalStore client/server hydration snapshots. Existing subject-name and
email recovery use documented narrow native-link lint exceptions because document
replacement is intentional privacy recovery. Adopt those exact patterns locally,
remove unused import, preserve native navigation and all security checks; no global
lint/config change. Review then full check and actual no-JS/browser navigation.
No execution by Recover; original check2 retained.

## R4 — check3 inherited staging migration-count failure

Observed: format/lint/typecheck PASS; unit/component918 PASS, one inherited test
FAIL at tests/unit/staging-migrations.test.ts:19 (expected17, actual18). The new
contiguous migration is the authorized cause; all own tests passed. Mode: Targeted
integration compatibility handoff, root-owned by dispatch and msg_735f289b7606.
Do not alter/skip/weaken this shared test or staging verifier. Preserve full failed
command and continue separate owned feature verification. Root reconciles counts,
function/grant compatibility and runs final combined check. Root notified through
Orca status msg_2cc3310135b5. No recovery code executed by this worker for R4.

## R5/R6 — pg1 source read failure and migration-proof timeout

Observed: own24 assignment cases20 PASS/4 FAIL, inherited support cases/bookings
40 PASS; migration proof timed out30s. Original private log pg-1 retained.
R5 root cause confirmed: `eligible(sql\`a.reviewer_user_id\`)`embeds an outer
assignment alias into a subquery that also names user_access`a`, shadowing the
outer reference. PostgreSQL reports column a.reviewer_user_id does not exist.
Targeted fix renames only the inner access alias; no predicate/data/grant change.
R6 migration proof root cause UNKNOWN; no residual proof database/connection
observed after process exit. Instrument safe phase markers and finite statement
and connection deadlines within owned test harness before another run; do not
extend product lifetime or mask permission/migration assertions. Preserve original
30s timeout and classify with fresh evidence. Separate re-Review/Verify required.

### R6 follow-up — evidence after two attempts

pg2 assignment24/24 PASS after alias repair. Migration instrumentation itself failed
ReferenceError (phase declaration was omitted), masking the underlying timeout;
no application defect is inferred from that test failure. Reassessed as an isolated
harness defect, not polluted application/schema or wrong product foundation.
Read-only pool descriptor inspection shows pg intentionally makes the password
non-enumerable: spreading pool.options into a disposable connection omits its
credential. Proposed correction copies named validated local connection fields,
including password, directly (never output), declares the phase helper explicitly
and keeps finite statement deadlines. Preserve both failures, verify fresh/upgrade
proof under a new heavy lease, reclassify again if this supported repair fails.

## R7/R8 — browser1 history-provenance and native-read failures

Observed: build1 PASS; browser1 8/10 PASS. Two failures retained: no-JS dispatch
page shows only inherited Loading support cases; original owner-tooling reassignment
history incorrectly reads as local dispatcher. Original suite assertions unchanged.

R7 confirmed source cause: Drizzle single-table selection rewrites interpolated
Column AST references to unqualified names even inside nested SQL. The EXISTS
correlation therefore becomes inner d.case_id=case_id and d.revision=revision,
which is true whenever any assignment receipt exists. A separate own isolated
read probe observed boolean true for both created and owner-assigned events that
have no dispatcher receipt. Permissions/writes/audit data are unaffected; label
provenance is wrong. Proposed targeted repair uses explicitly schema-owned outer
SQL identifiers in this one correlation and adds actual-PG false/true regression.

R8 confirmed native HTML cause: inherited admin/support/loading.tsx supplies an
automatic parent Suspense fallback across the new dispatch routes. Without scripts,
resolved content remains hidden. Coordinator decision requested: remove only this
owned support boundary, preserve guarded awaited SSR and existing form pending
feedback. No broader rendering/style/auth change or permission weakening.
Original eight passes remain historical until affected source is rebuilt/tested.
Recover runs no code/tests and does not claim resolution. Lease1 returned.

R8 coordinator answer on2026-10-12 authorizes only admin/support/loading.tsx
removal and requires existing reviewer/support-booking native/delayed/privacy
checks. Separate implementation removes that inherited boundary. No global
layout, cache, auth or streaming rule changes. Fresh Review/Verify pending.

### R8 native-form audit — coordinator instruction

The coordinator's next-lease answer explicitly required auditing all forms in the
newly awaited admin/support subtree and authorized analogous narrow SSR/POST/
noscript protection. Observed: old StatusForm defaulted to native GET with enabled
unhydrated submit and no no-JS guidance; only a bounded status enum was collected,
no learner/report/meeting/contact field. AssignmentForm already uses POST and
SSR-disabled submit. Separate implementation adopts existing hydration snapshot
guard for StatusForm, explicit POST, disabled pre-hydration submit, native guidance
and immediate control colors. Hydrated status API, pending busy gate and revision/
authorization are unchanged. Actual no-JS reviewer regression now asserts disabled
submit, POST and truthful guidance; full original status browser path must pass.
No new external/production/customer policy scope.

## R9/R10 — browser2 observation and permitted return-path assertions

Runtime PG4 66/66 and build2 PASS. Browser2 all7 original support/booking-context
cases + own pending/stale case PASS; two new test-only assertions fail after the
actual no-JS dispatcher/reviewer read and original history label behavior pass.

R9 observed locator call waits for navigation to complete while the test itself
holds the native response. This is a harness synchronization deadlock, not missing
core SSR. Keep the same expected previous heading until response resolution, use
current document evaluation rather than navigation-waiting locator assertions,
and always release the gate in finally; then assert actual destination loaded.

R10 observed opaque case reference remains only in five explicit sign-in `next`
link/route/validated-return occurrences after Back. No case DTO is retained in
these contexts. The test incorrectly forbade the approved return-path identifier
itself; identifiers are not authority, and existing auth continuation allows these
paths. Preserve required private record checks: reviewer IDs/names/emails, report
subject/body and serialized private case/choices/history must be absent. Explicitly
assert return-path intent and forbid case ID as a serialized record field. This
corrects the test criterion without weakening identity/privacy or runtime code.
Original browser2 private log/context copied under worker evidence; lease1 returned.
Separate test implementation, read-only Review and Verify only; no runtime repair.

## R9 reclassification after two unsuccessful observation repairs

Browser3 9/10 PASS: corrected Back/return-path/private-bootstrap test now PASS,
all7 baseline cases PASS; direct old-document evaluation also blocked during native
navigation, timing out the deliberately held request test. Exact log/context retained.
The source and held request itself are not defective. Reclassify as an incorrect
test foundation: native navigation may discard or make the old execution context
unavailable before the response; old-document introspection is not a Learli
acceptance invariant. No product architecture/reset is needed.
Propose coordinator-approved held exact-GET/pending-navigation proof with a real
case-grant revocation before continuation, then current denied/empty awaited HTML
and API privacy. This strengthens current-permission coverage without weakening
SSR/privacy/timeouts or changing runtime. Coordinator decision pending; no third
DOM-inspection patch/check loop. Lease1 returned again.

Coordinator approved the held exact GET + real dispatcher-grant revocation +
fresh denied/empty HTML/404 scenario as meaningful current-authority navigation
coverage, preserving final navigation and no private bootstrap. No CDP experiment
is required. Separate test implementation replaces only the incorrect old-DOM
assumption; runtime unchanged. Browser rerun queued for a heavy slot.

## R11 — root supported-schema metadata audit

Root read-only audit found supported Drizzle metadata names/shapes differed from
own immutable SQL: composite PK/default FK names, source/status suffixes and
combined grant-event check instead of two SQL checks. Actual catalog25constraints
is recorded privately; database behavior/rows/grants are unchanged. Targeted fix
matches only supported metadata to existing SQL/catalog, preserving field names,
types/nullability/defaults, column PK flags, foreign columns and referential
behavior. Root explicitly authorizes focused typecheck and applicability bridge;
no redundant PG/build/browser rerun for naming-only declarations. Root combined
build/snapshot generation owns assembly confirmation. Original pre-metadata schema
copy retained privately. No SQL rewrite or database mutation by this repair.

## Final accepted applicability

R11 metadata names now match all25 actual constraints; focused tsc PASS and no
SQL/field/default/nullability/query/grant change. Root accepts retained PG66/build2/
browser4 evidence for this metadata-only bridge and owns combined snapshot/build.
Final screenshot QA inspected320/390/1440, empty-phone and native-desktop states.
One empty native-select placeholder clipped at320; coordinator authorized only
Choose a reviewer literal polish, retaining behavior evidence with focused
format/type checks and final root combined build/browser. No broad rerun requested
for this literal. Original screenshots document the before-polish state, not a
fresh final-copy capture. All original failures remain in this note and logs.
