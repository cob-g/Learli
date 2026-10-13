# M8.7 — accepted synthetic readiness restore rehearsal

Date: 2026-10-12. Status: **AUTHORIZED — build-feature delegation**.
Authority: task_82ec2947734a / ctx_d3cc75755dc8, scoped root integration support
under `prompts/features/m8-10-hosted-workflows-wave.md`; no separate human
blueprint approval. Backend/operations only; M8.4/M8.7, NFR-05/NFR-11/NFR-12,
FAM-01/02, ADM-01/03/04 and OPS-05 restore preservation support.

## Outcome and inspected baseline

Extend the existing checkout-owned local test backup/restore drill to the exact
synthetic provenance accepted through0024. Preserve the legacy populated
local_simulation booking collision proof and all full schema, row, migration,
sequence, role, ACL, function, trigger and failure/cleanup proofs. The baseline is
2fa0294c5e6cad895754b3c10a703a6c6f6ef00a on cob-g/m8-restore-integration;
233 source-only files imported after every hash and aggregate8bd364092127371ec6d0cd5d2dcb87b8a4cf6c5f602c2d24f75250b1cafaaea6
matched the frozen provider-baseline-v2. Private import manifest records originals.
Inspected0024 snapshot has68publictables and journal25stamps; actual DB evidence
will establish the additional drizzle migration table, never assume45/22.

## Decisions, ownership and invariants

No material product decision or terminology clarification is needed. Owned paths:
`scripts/local-backup-restore.ts`, `tests/unit/local-backup-restore.test.ts`,
`tests/operations/local-backup-restore.test.ts`, this focused blueprint/runbook,
and a bounded verified tracker append plus ignored report/memory. Root owns
shared configuration, application/domain/providers, schema, grants/migrations,
canonical reconciliation and final whole-wave verification. No historical SQL edit.
Root msg_3901e73d866e allocated only the integration-style node:url import and
@→./src resolve alias in vitest.restore.config.ts; include/serial/timeouts remain.

Source must remain the private marked checkout's loopback learli_test database, with matching generated local test config, PG17 identity and
postmaster path. Target must be a distinct newly initialized empty private owned
cluster, with unique token, no overwrite/reuse, verified process cleanup and all
artifacts preserved. Reserved source55929/restore55529 only; no main/peer DB,
cloud, live mail/payment, real-person operation, reset, commit/merge/push/deploy.
A .test address is a synthetic hygiene guard, not legal eligibility evidence.

## Implementation plan

1. Derive the exact table inventory from the last journal snapshot, compare it
   with actual application tables plus the Drizzle migration table, and reject
   unexpected/missing tables or uncovered source/provenance columns.
2. Use an explicit per-table/per-column inspected provenance allowlist: historical
   local_fixture/local_synthetic/local_simulation only where accepted; new
   synthetic_readiness only where0023/0024 accept it; legacy optional restriction
   policy provenance remains nullable only on its inspected column. Validate
   synthetic admission policy authority/market. Refuse unknown/operational/real
   provenance, malformed/real-looking non-test email without emitting values.
3. Populate actual admission requests/evidence/decisions, screening policies,
   assignments/checks/decisions and safeguarding policies/cases/responses/history
   through existing test-owned fixture helpers and accepted services. Preserve
   the existing raw synthetic legacy booking fixture/collision probe. Retain new
   append-only readiness history in this exclusively owned test database; do not
   disable immutable triggers to clean it up.
4. Assert exact source/target rows and hashes for every populated readiness table,
   exact schema/catalog/roles/grants/sequences, rollback-preserving trigger and
   permission failures, no source changes across success or injected failures.
   Unit negative provenance coverage uses mock query output; real PG rejects
   unsafe constrained insertion without weakening constraints and refuses an
   isolated fictional non-test-address account before producing a backup.

## Separate verification plan

Same-agent read-only Review first; then obtain root heavy-job lease before pinned
npm ci, own DB initialization/migrations, check/restore/build. Inspect tooling and
verify both reserved ports free before initialization. Run current npm run check,
focused npm run test:restore on owned55929/55529, and npm run build. Preserve
commands/exit statuses/source hashes and failure history privately. No browser/UI
change: browser QA not applicable. Exact restored schema SQL covers functions,
triggers/exclusion constraints; operational probes provide actual runtime denial
and legacy overlapping booking failure. New readiness immutable-history denial
probes must roll back and preserve source and target row hashes.

Verification status: NOT RUN — architecture stage. A scoped baseline failure
must be preserved and reported to root; repair only owned paths.

## Applicability and next owner

This slice applies to accepted0024 schema/provenance, not pending W6 booking0025,
W7 publication0026 or W4b delivery0027. Root must explicitly reconcile new source
columns/contracts and run a final populated full-wave restore after accepting
those schemas; this result never proves full-wave success or hosted recovery.
All human/legal/policy and external launch gates remain. Rollback is source-code
reversion only; dumps/failures and owned synthetic state remain preserved.

## Observed local verification and operator handoff

Root granted heavy B in msg_6b4f3c7d1174. Pinned Node24.20.0/npm11.19.0,
PostgreSQL17.11 and npm ci PASS;13 inherited dependency advisories retained.
Fresh private owned source55929 used TCP-only startup to avoid long Unix socket
paths; source token/path/system and both initially free reserved ports verified.
Repository db:start and both reviewed migrations PASS; no shared state copied.

Same-agent read-only Review PASS/READY FOR VERIFICATION; separate Verify:
`npm run check` PASS1177tests/67files, scoped `npm run test:restore` PASS1/1,
`npm run build` PASS. Restore used
`PG_BIN=/opt/homebrew/opt/postgresql@17/bin LEARLI_RESTORE_PORT=55529 npm run test:restore`.
One actual populated restore proved69tables/25stamps/53populated tables, exact
full-row/schema/ACL/grant/role/sequence equality and source preservation. Nine
populated readiness histories reject owner deletion/runtime deletion and roll
back. Four injected failure records retain backup/tool/server evidence as
applicable; every started target was stopped, no failed target has PASS. Existing
foreign target sentinel and reuse/occupied-port refusals remain.

The initial check failed only TS18048 narrowing at new rule/tag access; targeted
nullish coalescing to the same fail guard repaired it, followed by read-only
re-review and the full successful checks. Original check-1.log remains private.
All evidence and final source manifests are under .local/restore-readiness.
This section supersedes the earlier NOT RUN architecture checkpoint only; it
never promotes whole M8 or real-operation readiness.

Readiness fixture history intentionally remains in the exclusively owned test
source: the existing runbook's dedicated-test cleanup wording now describes the
legacy removable booking fixtures only. Root must reconcile that wording and
later0025–0027 contracts in the final combined operations runbook. Broad imported
application integration and browser suites were not rerun by this scoped worker;
root owns final wave acceptance. No UI change requires browser QA for this delta.

## Root integration extension through0025 — 2026-10-13

Authority remains **AUTHORIZED — build-feature delegation** under the parent
eight-area workflow. Root accepted the exact W6 provider v5 after independent
bounded Review resolved R1–R6 and its matching64 PostgreSQL tests passed. The
integration checkout now owns the follow-up, source55919 and new target55519;
the original support worker and its source55929 are unchanged.

The explicit restore allowlist now includes the two accepted booking sources
and the synthetic-only booking policy head. Unknown source contracts still fail
closed. Preserve both new immutable booking policy and notice-intent histories
with their actual23514 owner/42501 runtime denial codes; existing history checks
retain55000/42501. Exact table and migration sets derive from the accepted
canonical snapshot/journal, preserving row and hash comparisons as schemas grow.
The populated fixture uses actual W6 admission/screening/availability/reservation,
exact admin grant and confirmation services with all history guards enabled.

Root scoped read-only review found no issue in the two-file guard/unit change;
separate focused unit verification passed61/61. The new populated fixture and actual0025 restoration passed1/1 in5.98s on
source55919 to a fresh55519 target:73tables,26stamps,68populated tables, exact
records/schema/roles/grants/sequences, eleven immutable histories and source
preservation. Both own databases applied0025 with restricted runtime grants;
target55519 stopped and private evidence retained. Final
0026/0027 contract reconciliation and full populated restore still follow those
accepted sources; no full-wave or hosted-recovery result is claimed here.
