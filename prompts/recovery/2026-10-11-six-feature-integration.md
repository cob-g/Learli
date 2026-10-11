# Six-feature integration recovery

Status: AUTHORIZED — build-feature delegation, actual2026-10-11 integration
request. Mode: Targeted Fix. Local synthetic candidate on clean baseline
0c078bf50f9f967b20391ef3640353a7b3897e62; M4.9/BKG-04 combined acceptance.

## Read-only Review finding

Observed: new combined browser test expected simulation status as a heading and
"Booking unavailable" on denial. Frozen read-presentation.tsx instead renders
"Booking details", separate status text, and "We can't find that booking on this
account". No command failure or application defect is inferred. The integration
test's assumptions would produce false failures; source contracts are intact.

Recommendation: retain heading/status and denied API assertions independently,
align only the three new expected heading strings with actual frozen markup.
Preserve privacy/current-access assertions and all source tests/code. No product
decision, data reset or external action. Separate implementation owner applies
this reversible test-only repair, then read-only re-review and browser execution.
Recover performs no implementation or checks. Verification NOT RUN BY RECOVER.

## Independent-review correction

Parent message msg_cb1727dfd0d7 confirms the tutor-side assertion at
tests/e2e/six-feature-integration.spec.ts still expects the nonexistent heading.
The initial implementation correction fixed the guardian heading and denial
wording but missed the separately formatted tutor assertion. The initial
same-agent review's claim that all three expectations were repaired was inaccurate;
this finding supersedes that readiness conclusion for the combined browser case.

Runtime remains frozen at candidate c8dcc996c851b319080876da1a3c08bbb54519595e96445000c3696f74af1132
while both independent reviews finish. Parent directs no source repair yet.
Targeted handoff: after authorization, change the tutor detail assertion to the
actual Booking details h1 and independently assert visible simulated status in
both participant detail views. Preserve all meaningful saved-state, capture,
privacy and revocation checks. Re-review the exact repaired runtime and rerun the
affected combined browser case/default suite as failure evidence warrants.

## Observed first full browser failure

`npm run test:e2e -- --workers=1` failed at matching.spec.ts:125 after72 passes,
with6 later cases not run. All49 baseline and preceding23 feature cases passed;
the combined case did not execute. The page honestly reported that matching
times could not load. Preserved evidence `.local/browser-initial.log` and
`.local/matching-diagnosis.json`; no assertion weakening or reset.

Classification: polluted synthetic test inventory, requiring targeted test
isolation. Read-only actual-service reproduction on owned DB55477 finds one
approved profile-preview fixture with848 availability windows, intentionally
created by the profile overflow check. The840 global per-query window bound
correctly refuses the batch. Calling the same service while excluding only this
owned overflow fixture succeeds. Source matching behavior and the bound are
correct; increasing limits or hiding the error is unjustified.

Proposed handoff after parent authorization: track only tutor profile IDs created
by profile-booking.spec.ts; in its afterAll suspend those owned fixtures before
closing the pool. Preserve their records and every profile/overflow assertion.
This also stops unrelated preview fixtures affecting matching pagination. No
environment-wide deletion, schema change, real-user effect or product repair.
Re-review both changed test files and publish a replacement exact runtime
fingerprint; execute format/lint/typecheck and full sequential default browser
verification. Unchanged unit/domain/PG/build proof remains applicable unless a
new defect requires application changes. Parent reviewers must clear final tests.

## Authorized three-finding repair handoff

Parent msg_c1e87bad0cf5 confirms both full initial reviews finished and explicitly
authorizes F1/B1 locator/status, F2/B2 owned-profile teardown, and F3 family DST
label repair. Read both `.local/independent-flows-review.md` and
`.local/independent-backend-review.md`; initial recommendations CHANGES REQUIRED.

F3 classification: targeted presentation bug. Family agenda groups by local date
but labels the group with its first row's date-specific offset. Two reservations
before/after a same-date DST offset transition can therefore share a contradictory
group label despite correct per-row UTC/offset values. Smallest fix: group by both
date and formatted zone, use a stable unique combined group key and explicit group
zone, preserving existing row LessonTime/default and every underlying interval.
Add a two-row same-date opposite-offset regression including rendered grouping.
No SQL/auth/schema/policy behavior changes. Verification: affected presentation
cases, format/lint/typecheck, rebuilt affected UI and full sequential79 browsers;
unchanged PostgreSQL/migration evidence remains exact. Publish replacement runtime
and refreeze before parent independent follow-ups. Recover executes no tests or
source repair; separate implementation/Review/Verify own those stages.

## Additional combined fixture sign-in omission

Read-only source reinspection while the repaired browser suite runs finds the
combined tutor fixture signs up and receives trusted local verification/role
updates but never signs in. Existing auth-options.ts explicitly disables signup
autoSignIn and autoSignInAfterVerification, and all source tutor fixture helpers
perform the real sign-in step. Thus its tutor dashboard visit cannot carry an
authenticated tutor session. This is a test setup defect, not permission failure
or justification to alter auth settings. Repaired runtime2f44c83c57818d65b9bb21aa803aede6d7d8a12be7e62fd619bb79131bbd6130
remains frozen; parent notified and authorization requested before mutation.
Proposed minimal handoff: bind only its synthetic tutor email locally, sign in
through the actual provider with Origin after verified/role provisioning, assert
200, and preserve the complete private journey. Capture observed browser result
before repair, then re-review/refreeze and rerun the affected/default acceptance
as parent authorizes. No production, policy, session cache or provider change.

Observed second full default run:78PASS/1FAIL, solely combined test tutor dashboard
heading (`.local/browser-repaired.log`); all49 baseline and all29 source additions
passed, including matching after real preceding overflow and notification cases.
Parent msg_c6ea196e1741 explicitly authorizes the exact email/sign-in200 fixture
correction after preserving this result; both reviewers paused that test for the
replacement target.113 ignored artifacts preserved in browser-repaired-artifacts.
One test path changed; other98 runtime paths byte-identical, no app/build/PG scope
change. Replacement target f83f80976a63927e6699865f1113e7cb97980e1e018dd162a3cd7952cd6db402;
`.local/signin-delta.json`. Parent directs affected static and combined-only
browser validation, retaining other78 unchanged passes and production/PG proof.
No repetitive full rerun is required unless another shared-suite defect appears.
