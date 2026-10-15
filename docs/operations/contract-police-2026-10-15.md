# CONTRACT POLICE — 2026-10-15

Completed: **one confirmed Low contract defect fixed**, 25 regression cases added,
and two independent post-fix audits accepted. One timeout-epoch lead is deferred
because the intended contract is ambiguous and a naive fix would break prepared
queue compatibility. Work is uncommitted on `cob-g/contract-police-20261015`, based
on local main `961c8753fbf2704817f0bd4ab418d259316db34e`.

## Exploration and evidence

Fourteen GPT-6 Luna **high** launches produced thirteen completed read-only
investigations: eight domain inventories, three cross-boundary audits and two
post-fix audits. One initial tutor explorer stopped before reading repository
source because it used a broken CLI path; an explicitly tracked retry completed
that task. Two GPT-6.1 Sol **high** workers handled one implementation and the
separately requested DATA cleanup. Launch receipts verify the actual model and
effort; at most three workers ran alongside the coordinator.

Inventory: **31 feature directories, 56 route handlers, 22 schema source files,
32 forward migrations**. Investigators traced actual producer/consumer paths,
Zod inputs, typed projections, SQL enforcement, provider adapters and documented
semantics. This is architectural coverage, not a claim that every source line or
migration snapshot was exhaustively proved correct. Existing OpenAPI/generated
client infrastructure was not invented; established typed/schema mechanisms
remain authoritative.

| Task               | Investigation                                                                     | Outcome                                                                        |
| ------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| A                  | Auth forms, Better Auth composition/client/adapter, sessions, account projections | No confirmed mismatch                                                          |
| B                  | Tutor profile/onboarding, subjects, languages, eligibility and public catalog     | No confirmed mismatch; routing retry completed                                 |
| C                  | Availability, time off, DST, discovery, matching, pagination and selection        | No confirmed mismatch                                                          |
| D                  | Booking create/read/resume/lifecycle, revisions, private links and notices        | No confirmed mismatch                                                          |
| E                  | Learners, admission, guardian/self modes, family dashboards and DTOs              | No confirmed mismatch                                                          |
| F                  | Support, assignments, screening, safeguarding, private/public reviews             | No confirmed mismatch                                                          |
| G                  | Account/booking mail, Resend adapter, queue/drain, meeting syntax and privacy     | CP-G-001 lead, subsequently deferred                                           |
| H                  | Schema/model, migrations, runtime/configuration/build and operator contracts      | CP-H-001 identified                                                            |
| X                  | Scheduling → both page adapters → workflow SQL → lifecycle/read/notification      | No new mismatch                                                                |
| Y                  | Identity → admission/family/support, restrictions and admin assurance             | No new mismatch                                                                |
| Z                  | Configuration/schema/operator → delivery/runtime consumers                        | CP-Z-001 duplicates H; G remains ambiguous                                     |
| Sol implementation | Independently verify H, reproduce with mocks, focused fix and tests               | Completed and integrated                                                       |
| K                  | Independent integrated CLI boundary/import/caller audit                           | Accepted exact hashes; no residual                                             |
| L                  | Independent regression, isolation and compatibility audit                         | Accepted exact hashes; no residual                                             |
| Sol cleanup        | Prior DATA integration/child worktrees and branches                               | Initial partial report; coordinator later completed cleanup after process exit |

Luna reports are source evidence; they ran no tests, DB queries, app/browser or
provider operations. Executed results below came from Sol and the coordinator.
No live/production environment or external API consumer was exercised. The
previously blocked admin-SQL investigation was not reattempted. Real admission,
screening, commercial terms and hosted operation gates remain in force.

## Findings and severity

Three formal records reduce to **two unique candidates**: H and its Z duplicate,
plus G. One is confirmed and fixed; one requires contract clarification.

| Classification                           |         Count |
| ---------------------------------------- | ------------: |
| Unique suspected mismatches              |             2 |
| Confirmed, fixed                         |             1 |
| Unresolved high-confidence defect        |             0 |
| Proven false-positive finding            |             0 |
| Ambiguous/deferred candidate             |             1 |
| Confirmed Critical / High / Medium / Low | 0 / 0 / 0 / 1 |

### CP-H-001 / CP-Z-001 — Unsupported migration selectors could choose development

**Confirmed Low; fixed.** Producer: named npm migration commands and operator
argv. Consumer: `scripts/migrate-local.ts`. Authority: the two package commands,
CI/setup callers, the local-development runbook and dev/test separation rules.
Originally, `process.argv.includes("--test")` ignored every other argument.
A direct invocation with `--tset` therefore loaded the development environment
and proceeded toward its migration. The documented test npm command already
supplies the exact flag; merely appending a typo to that command did not switch
targets. This is a local operator-targeting defect, not a production/remote
migration bypass.

The entrypoint now accepts exactly `[]` for development or `["--test"]` for test.
Other shapes emit a fixed usage message and exit unsuccessfully before environment
loading or database construction, without echoing potentially sensitive argv.
The known package/CI/setup calls retain their supported forms. Migration folder,
grant SQL, execution order, success/error text, setup-error behavior and awaited
pool cleanup are preserved. No selector helper, dependency or framework was added.
The operator guide documents this exact grammar.

The actual entrypoint was dynamically imported through tests with the entire DB
factory and Drizzle migrator mocked, env loading replaced, and inherited direct
credentials replaced by non-URL synthetic sentinels. **Identical test bytes**
failed 16 invalid-input cases and passed 9 compatibility/error cases on original
source; all 25 passed after the fix. No real migration or data mutation was used
to demonstrate the defect. Post-fix reviewers inspected the real import graph and
found no pre-validation environment load, pool construction or network side effect.

### CP-G-001 — Timeout and prepared-delivery epoch ownership is ambiguous

**Deferred; not a confirmed defect.** `bindTransactionalDelivery` accepts a
transport timeout but omits it from the immutable prepared-delivery configuration
fingerprint. Broad runbook language says configuration changes block replay;
accepted W4 material specifically binds sender/origin/template/identity epoch and
identical content/key, without specifying timeout mutability. Independent Z review
confirmed the omission and the ambiguity. No body/key change or duplicate-delivery
risk was established by this lead.

Adding timeout to the existing digest tuple would invalidate every already-prepared
fingerprint, including rows whose effective timeout did not change. Their stored
fingerprints are immutable and no reconciliation/reset is authorized. The safe
follow-up is to establish whether timeout is mutable or frozen; if frozen, define
a version/compatibility plan for existing prepared rows and focused retry tests.
No queue rows, fingerprint algorithm, provider settings or runbook policy were
changed based on this uncertain interpretation.

## Implementation and compatibility

One Sol worker implemented the contract correction in an isolated checkout and
the coordinator integrated exactly the accepted two file hashes. Another Sol
worker performed DATA cleanup. Six repository paths changed in this checkout:

- `scripts/migrate-local.ts` — exact supported argv validation.
- `tests/unit/migrate-local.test.ts` — 25 actual-entrypoint mocked regressions.
- `docs/operations/local-development.md` — supported invocation/error contract.
- `docs/operations/data-integrity-police-2026-10-15.md` — actual cleanup status.
- `context/progress-tracker.md` — verified work and next step.
- This operation report.

Producer corrected: one local CLI. No application API consumer, persisted field,
shared type, generated client, compatibility adapter, dependency, schema or
migration needed changing. Valid known callers remain compatible; previously
ignored unsupported/duplicate/positional arguments now intentionally fail. No
public wire contract or business policy was altered. No external caller
compatibility guarantee is inferred from repository-only inspection.

## Executed validation

| Check                                                      | Observed result                                                                  |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Pre-change `npm run check`                                 | Formatting, lint, strict types and 1,648 tests / 112 files passed                |
| Fresh owned test migrations/grants                         | Existing reviewed migration chain applied successfully to isolated `learli_test` |
| Pre-change non-truncating PostgreSQL integration selection | 930 tests / 63 files passed, 409.59s                                             |
| Pre-change production build                                | Passed                                                                           |
| Same focused regression suite on original source           | Expected failure: 16 failed, 9 passed                                            |
| Same suite on final worker source                          | 25 / 25 passed; scoped formatting, lint and strict types passed                  |
| Integrated `node scripts/with-test-env.mjs npm run check`  | Formatting, lint, strict types and **1,673 tests / 113 files passed**            |
| Integrated `node scripts/with-test-env.mjs npm run build`  | Passed                                                                           |
| Independent audits K and L                                 | Both accepted; source-only, no extra execution claimed                           |
| Final documentation/diff/source-preservation checks        | Passed                                                                           |

The database suite predates the CLI-only fix; application, schema, grants and
integration-test source bytes remained identical, so that seven-minute suite was
not redundantly rerun. The new entrypoint tests cover the changed behavior with
mocks. No new migration/restore proof was necessary for unchanged database code.
Five existing TRUNCATE-fixture suites (`auth`, `availability`, `teaching-languages`,
`time-off`, `tutor-catalog`) and generic browser setup were excluded to honor the
no-truncation constraint. No browser/E2E, hosted acceptance or deployment was run.
The same three baseline jsdom navigation notices remain; no new warning/failure
was introduced. An intermediate worker source-format warning was corrected and
final checks passed. No tests or safeguards were weakened.

Owned root PostgreSQL/TLS ports 56101/56103 are stopped with no listeners or
postmaster PID files; synthetic data and private evidence are preserved. No
original development/test or production database was touched. The original user
checkout's 1,210 regular files, 12 symlinks, protected security notes and branch/
HEAD/status match baseline. In this checkout, 1,209 unrelated baseline files and
all immutable schema/migration/package bytes remain unchanged. Integrated source
hashes match implementation and both independent audits.

## DATA INTEGRITY worktree cleanup

Cleanup is **complete**. The one assigned Sol cleanup worker first archived all
three DATA evidence trees and removed the stopped integration checkout/merged
branch. Its initial partial/failed receipt correctly retained two children with
live unknown-ownership Claude sessions. Following the owner's status request,
the coordinator positively verified all six recorded process IDs had exited,
no target open files or running DB remained, only the exact already-committed
signup patch was present, and all 1,990 signup / 11,253 proof evidence files still
matched the verified private archives. No process was killed to enable removal.

Orca removed the remaining children using exact selectors and `--force` only for
the known archived dirty checkout contents; no forced branch deletion or archive
hook override was used. Filesystem absence, Git worktree absence and branch-ref
absence confirm removal of all three:

- `data-integrity-police-20261015`
- `data-signup-atomicity-20261015`
- `data-restore-proof-20261015`

Their three `cob-g/` branches are gone. Local main remains exactly `961c8753`, with
`e0bf67f` and merge `4fe8d7e` retained. Original security/Claude work and current
CONTRACT worktrees remain preserved. Archives/checksums remain private under
`/tmp/learli-data-integrity-police-20261015/cleanup-archive/`. The worker's earlier
partial receipt is preserved; coordinator completion is a separate evidence trail.

## Outcome, remaining work and evidence

The migration selector now refuses incompatible input at its trusted entrypoint,
while known command consumers preserve target, migration/grant and error semantics.
No forced standardization or new contract system was introduced. One delivery-epoch
ownership decision remains deferred; hosted/external and excluded reset-based
scenarios were not certified. Review/commit is the next requested action, not an
automatic merge. No commit, push, merge or live operation occurred in this sweep.

Private run evidence: `/tmp/learli-contract-police-20261015/`, Run
`run_191f2368fc9c`. Key artifacts: `explore-A`–`H`, cross `X/Y/Z`, audits `K/L`,
`implementation-migration-cli/report.md`, `verification.json` and red/green logs,
`integrated-source-manifest.json`, baseline/final check/build logs, integration
command/exclusions/log, preservation/resource receipts and `cleanup-*` completion
receipts. Thirteen Luna review tasks and the implementation task completed; the
cleanup worker's initial partial task remains accurately recorded as failed even
though the coordinator subsequently completed the user-requested cleanup. All
sixteen launched worker resources are released, with no pending/reclaimable worker.
