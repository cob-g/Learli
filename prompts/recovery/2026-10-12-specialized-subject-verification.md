# Learli Recovery — specialized-subject verification

Status: AUTHORIZED — build-feature delegation. Mode: Targeted Fix.
Scope: own local synthetic feature verification, M3.1/M5.6,
ADM-02/TUT-03/MATCH-02, branch cob-g/m5-specialized-subject-editing at
b6cf237554b3d46e1e4c58ce10e1ef3ebafe10c0 plus uncommitted scoped work.

## Attempt 1 — setup evidence and diagnosis

Observed: npm run check stopped at format:check for the newly authored
tests/integration/subject-rename.test.ts; lint/typecheck/tests did not run.
The separate ignored migration-proof harness stopped with TypeError at the
populated0015 checkpoint. Read-only inspection confirmed16 baseline migrations
and that array_agg(information_schema.columns.column_name) returns a JS string,
so calling .map is invalid. Source app migrations were not implicated.
Logs remain .local/next-wave/check-1.log and migration-proof.log.

Recommend formatting only the own integration file and casting column_name
to text before aggregation. Preserve the failed upgrade database; use a new
owned upgrade database for a complete fresh proof, never drop/reset/adopt it.
No secrets, users, production or peer state affected; no architectural rethink.
The authorized build-feature implementation stage owns these harness repairs;
Review must inspect changed source/tests before separate Verification resumes.

Required verification: current npm run check, corrected fresh/populated migration
proof, full real-PG suite, build and browser checks. NOT RUN BY RECOVER.
Implementation and verification NOT PERFORMED BY RECOVER. Earlier failed
attempts are retained; final outcome belongs to the separate verification report.

## Attempt 2 — lint boundary

Observed: corrected migration proof PASS (fresh17-migration dev/test and
populated0015 upgrade,32 original table projections unchanged). npm run check
passed formatting then stopped at Next no-html-link-for-pages for the intentional
native reload anchor; two own component mock parameters were unused warnings.
Full PG suite was already running and is unaffected by this UI/test-only repair.

Targeted recommendation: retain the blueprint's native reload so the entire
draft/revision state resets from a fresh server read after conflict; document a
single-line lint exception at that anchor, without changing shared lint rules.
Use a typed fetch mock rather than unused parameter names. No scope/permission
change. Re-review those lines and resume current check; preserve check-2.log.
NOT IMPLEMENTED OR VERIFIED BY RECOVER.

## Attempt 3 — inherited browser artifact precondition

Observed: default106-case browser run passed97, failed four inherited
four-feature-integration cases solely at writeFile ENOENT for the absent owned
.local/four-feature/recovery-final directory, and blocked the five dependent
subject cases. Auth/private-payload assertions were not all reached after the
artifact write. Preserve e2e-1.log and e2e-results; do not claim those four passed.
The inherited tests assume their artifact parent exists on a fresh checkout.

Targeted recommendation: create that ignored directory in this owned worktree,
without copying peer artifacts or editing the other builder's test ownership.
Run only the four failed cases plus the five blocked feature cases with no
dependencies; retain97 exact-state passes. Root should reconcile this inherited
fresh-checkout harness seam separately. No application/architecture change.

Inspection also identified a new pending-guard test authoring issue: Playwright
click waits for an aria-disabled button to become actionable while this test
holds the database lock. Use keyboard Enter to exercise the submission guard
instead, preserving the real lock and one-audit assertion. This case has not yet
executed; do not mislabel it an observed test failure. Re-review own test change
before verification. NOT IMPLEMENTED OR VERIFIED BY RECOVER.

## Attempt 4 — public-label selector

Observed: affected9-case run passed the four previously failed inherited cases
and four new cases. Only admin keyboard/public-reference case failed: the
unscoped getByText(name).first() resolved to a selected hidden option, not the
visible tutor offering. Retain e2e-2.log and e2e-recovery-results.
Diagnosis: a test selector error, not evidence of a discovery service defect.
Recommend scoping the visible-name assertion to the actual tutor list row and
keeping profile/matching label checks. No public service edit or weakened
eligibility rule. Re-review own test, run current check, then only this affected
browser case; preserve all105 unaffected browser passes. NOT RUN BY RECOVER.

## Attempt 5 — editor identity across refresh

Observed: single-case rerun failed locating status through the old display name.
Its safe DOM snapshot contains the corrected name and Subject name saved status;
the live locator's old-name filter no longer identifies the renamed row after
router.refresh. The preceding run happened to observe status before that refresh.
Retain e2e-3.log and e2e-final-case-results; no app defect established.

Recommend identifying the editor by the existing fixed subject UUID/input ID,
while keeping visible text and database reference assertions. The shared helper
is used by all five own cases, so re-review it and rerun those five, plus current
check. Reuse101 inherited browser passes, full PG/build/migration results for
unchanged application state. No sleeps or weakened assertions. NOT RUN BY RECOVER.

## Separate implementation / verification outcome

The authorized build-feature implementation stage applied only the diagnosed
formatting/mock/lint-explanation and test-selector/keyboard repairs plus owned
ignored artifact-directory setup. Same-agent read-only scoped re-reviews PASS.
Separate verification observed current check628 PASS, full real-PG354 PASS,
build PASS, corrected fresh/populated migration proof PASS, inherited four-case
recovery PASS and final own five-case browser project PASS. All106 discovered
browser cases have a unique passing result across retained runs; the initial
full run still records its failures. No application logic fix or reset was needed.
Resolved locally by the separate same-agent verifier; no independent signoff.
Exact commands, original failures and limitations: .local/next-wave/report.md.

## Handoff metadata probe

Observed: the first manifest bookkeeping command treated git ls-files
--error-unmatch on an added untracked path as success-only and threw on its
expected exit1. It wrote no manifest and changed no source/data. Targeted
recommendation: read git's tracked-path inventory once and test membership,
then hash the union of modified and new nonignored files. Application/test
results remain current; this is a handoff helper correction, not an app failure.
Preserve the sanitized error in .local/next-wave/manifest-first-failure.log.
The build-feature coordinator owns separate execution, not Recover.
