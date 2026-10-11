# Local notification check recovery

Status: **AUTHORIZED — build-feature delegation** for targeted own-test repair.
Mode: Targeted Fix. Local synthetic M5.7–M5.8/OPS-04 only, own branch at
`0c078bf50f9f967b20391ef3640353a7b3897e62`.

## Expected versus observed

`npm run check` should pass formatting before lint/typecheck/unit execution.
First run stopped at Prettier on `tests/integration/booking-notifications.test.ts`;
log `.local/check-first.log`. The newly appended within-invocation authorization
race test was added after the prior scoped formatting pass. No application or
database failure; notification PostgreSQL tests independently passed26/26 first.

## Diagnosis and recommendation

Observed localized formatting drift, not polluted state or wrong architecture.
Format only the own test after the next authorized additions; preserve source
provider hashes, booking mutation code, migrations, dependencies and all data.
Re-review the actual diff, then rerun check. No reset or extra authorization needed
beyond the actual build request. Recover executed no repair or verification.

## Additional provider dependency

Coordinator `msg_9ed3c8f9e02c` narrows creation-notice tutor status to approved;
pending/rejected/suspended must suppress. Historical detail semantics stay
separate. Add own negative tests, but replace provider only from hash-authorized
frozen bundle; do not patch an imported provider copy. This is a scoped accepted
contract refinement, not real policy or booking-state change.

Verification required: format/lint/typecheck/units, final provider PostgreSQL
negative/race cases and all baseline integration/build/browser checks. No checks
were executed by Recover; outcomes belong in final tracker/report.

## Read-only review finding after frozen detail import

Observed source contract: the detail page renders learner name and level in one
`dd`; `loadPrivatePage` catches denied reads into a generic unavailable page.
The API preserves 404 for denied records. Own browser tests incorrectly assumed
an exact name-only DOM element and page-level 404. Targeted repair: assert the
name-containing `dd`, generic unavailable heading, and actual API denial with no
private value. Preserve all provider hashes and authorization behavior. This
finding was caught before running browser checks; no fabricated test failure.

## First full browser failure — protected detail without JavaScript

Observed `.local/browser-full-first.log`: 50/51 pass, all49 baseline pass. Actual
CLI/template/keyboard detail and stale-denial acceptance passed; authenticated
no-JS detail contains the authorized `dd` but Playwright repeatedly observes it
hidden (own test line206). Imported detail/list loading boundaries produce App
Router Suspense streaming. Likely cause: hidden streamed content needs script
execution to reveal. This is a provider route defect/dependency, not a missing
record or notification mutation failure; final root cause/repair belongs to Agent1.
Preserve first failure and provider hashes; request coordinator-authorized versioned
no-JS-safe repair, re-review import and rerun linked acceptance/full baseline as
appropriate. Never weaken the visibility assertion or patch peer-owned files.

Coordinator `msg_449366bec7ba` authorized a tested provider UI candidate with
exactly two former loading-boundary deletions and skew-safe server snapshot/
monotonic elapsed display. Imported all 15 exact hashes and verified old hashes
before those two deletions; baseline demo loading and all core/notice hashes
remain unchanged. Re-review found no new issues. Separate consumer verification
must establish the linked no-JS repair; provider full acceptance remains separate.

Consumer v3 check (495), build and full default browser (51/51) passed, including
the retained no-JS visibility assertion. Root then flagged a separate provider
history-filter pending UX issue, not a failing notification test. Coordinator
`msg_6ec4d4d63cb2` authorized only the final controls replacement to
`6f048472fc276722ad399675c80003358067560b9ba04dbb0ac88d82a4a2e3ac`;
old hash, unchanged 14 other files and both deletions verified. Own consumer
test now follows the notice through history filtering, Back restoration and
native no-JS filtering. Re-review found no new issues; final executed evidence
is recorded separately in tracker/report. No provider file was edited locally.
