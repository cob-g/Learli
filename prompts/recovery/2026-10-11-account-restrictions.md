# Account restriction recovery notes

Authority: AUTHORIZED — build-feature delegation, actual four-feature request
2026-10-11. Own branch cob-g/m5-account-restrictions at024dd4d. Local only.

## Attempt 1: baseline upgrade fixture setup

Observed: db:migrate:test exit0 applied through0012. Invoking development-only
seed-local.ts through with-test-env exited1: "Fixtures are development-only."
No seed mutation ran, no data loss or remote target. Logs in
`.local/four-feature/baseline-migrate.log` and `baseline-seed.log`.
Mode: Targeted Fix (invocation), high confidence from script's explicit guard.
Recommendation: leave script unchanged; use existing isolated test account helper
and owned test fixture SQL for upgrade preservation, use db:seed for development.
Next verifier must inspect actual0012 history, compare all baseline row hashes
after0013 and confirm both target ports. No test/migration/repair executed by
Recover; implementation coordinator owns the corrected invocation.

## Attempt 2: test learner fixture

Observed: isolated helper account creation succeeded, but learner INSERT refused
missing required fixture_key (23502). Root cause: incomplete fixture SQL, confirmed
against existing learners schema. Targeted correction adds the required unique
synthetic key; preserve the created account and schema. No product change or reset.
Original private log retained; no verification performed by Recover.

## Attempt 3: code formatting check

Observed: npm run check exit1 in format:check, identifying only new snapshot0013
and account restriction integration file. Diagnosis: generated JSON and final
fixture edits were not formatted. Targeted Fix: format the exact two files and
this note, then inspect affected diff and rerun check; no schema/data change.
Recover performed no repair or test execution.

## Attempt 4: participant read denial expectation

Observed: integration exit1 (272 pass, one new failure). Existing read-service
uses provider identity then a final account/role query, returning private404 for
suspended participants. The test expected403, unlike the actual preserved contract.
Targeted Fix: assert exact404 for participant reads, retain403 for mutations,
prove pre-suspension read200 and unchanged private learner/account values, then
rerun full integration. Remove three unused test imports. Tighten new GET paging
against duplicate/unsupported query fields consistent with baseline handler.
No existing permission behavior is weakened. Recover ran no checks or repairs.

## Attempt 5: remaining booking contract and isolated throttle cleanup

Observed: integration-2 exit1, 260 pass, one new assertion failure plus12 baseline
learner cases skipped after provider signup throttle. Tutor booking eligibility
returns the existing safe409 RuleError, not404; direct discovery remains null.
New suite creates many provider accounts, so restore its test-only throttle count
in afterAll to avoid leaving consumed shared fixture quota for later suites.
Keep actual provider throttling enabled and baseline assertions unchanged.
Targeted Fix, no environment reset/data deletion. Recover executed no tests.

## Attempt 6: preserve booking transition rules

Observed: integration-3 exit1. The remaining new case tried expiring a live
15-minute reservation; immutable baseline trigger correctly refused23514.
Targeted Fix: preserve that reservation and create a distinct aged synthetic
reservation, then transition only after its already elapsed deadline and retain
actual event history across restoration. No trigger bypass or baseline rewrite.
Repeated full-run provider fixture setup also encountered persisted test-only
throttle quota; clear count before the next isolated full suite, preserving the
provider rules and all test assertions. First prove the focused feature suite.
Recover performed diagnosis only; implementation/Verify own subsequent actions.

## Attempt 7: browser selectors and native explanation

Observed: default browser exit1, all79 baseline cases plus one new case pass,
three new cases fail. Native list/detail/history rendered correctly but client
noscript explanation was absent from parsed page. Next route-announcer also
matches role=alert, making two test selectors ambiguous. Targeted Fix: ordinary
server-rendered explanation of JavaScript confirmation; scope assertions to the
feature paragraph alerts. Add explicit private-read loading feedback to local
navigation/refresh using existing useLinkStatus/useTransition conventions,
preserving native links and all current visible content. Verify real read lock
loading, native content, scoped alerts, accessibility and full default suite.
Recover diagnosed only; no repairs or tests executed in this stage.

## Attempt 8: pending dismiss wording

Visual Review found Minor misleading dismiss label after action submission:
"Keep current access" cannot cancel an in-flight transaction. Targeted Fix:
pending label "Close confirmation" plus explicit no-cancellation explanation.
Exercise closure and repeat-click denial while real DB action remains blocked.
Owned default browser run2 deliberately interrupted for the final UI correction;
PID35415 cwd was verified as this checkout before SIGINT. No broad kills, data
reset, schema or permission changes. Rebuild and rerun full default suite.
Recover performed diagnosis only; no repair/test execution within this stage.
