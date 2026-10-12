# Staging database foundation — 2026-10-12

Status: **COMMITTED, MERGED LOCALLY AND CLEANED UP**.
Reviewed feature commit `55885fd1021f0c64c4ce43b95cb7f67d3122c4ce` was fast-forwarded
into local `main` from `0d7f2ddba07b05a72c8a995428e29c3584224ebe` after the user approved
the proposed commit, merge and cleanup step. This is the bounded M8.3 code-preparation
slice, not complete M8, hosted application readiness or launch approval.

## Delivered scope

- Separate explicit Neon staging target/configuration boundary, verified TLS and
  bounded connection lifecycle, exact database/user identity and runtime checks.
- Private JSON config inspection, read-only target inspection, hash-bound plans
  and deliberate migration application under one session's advisory lock.
- Existing17 migrations and journal/snapshots preserved; exact original runtime
  grant SQL extracted for reuse. No new schema migration or application routing.
- Partial/unknown failure receipts, rollback-only restricted probes, operator
  runbook and CI host PostgreSQL17/OpenSSL prerequisites.

Parent blueprint: [M8.3 staging database foundation](../../prompts/features/m8-03-staging-database-foundation.md),
**AUTHORIZED — build-feature delegation**. Two isolated builders used
`$build-feature`; an independent reviewer found F1/F2, root repaired them, and
a second independent reviewer closed both findings on the frozen repair. Every dispatched
worker's requested/effective model was GPT-6.1 Sol / High.

## Review and recovery

Original candidate-v3 passed its 895 unit / 430 PG/build checks, but independent
review identified two Important gaps. F1 repairs deny effective parameter ACLs
(including PUBLIC) and non-origin runtime/inspection/migration sessions. F2
repairs reject unapproved grant options across inspected object/database rights.
The original grant batch and SQL history remain unchanged;22 real-PG regression
cases were added. Follow-up review confirmed F1/F2 closed, plan alignment and unintended-change audit PASS, and zero remaining/new confirmed findings. Review itself ran no tests.

Retained recovery notes preserve initial builder matcher/type/harness/receipt
failures, the clock-sensitive DST fixture collision, root blueprint-format and
private-directory fixture failures, and six stale pool-mock failures after F1.
Repairs isolate fixed-DST tutors and private CLI roots, reset mock queues and
preserve business/permission assertions. See
[integration recovery](../../prompts/recovery/2026-10-12-staging-integration.md) and
[migration recovery](../../prompts/recovery/2026-10-12-staging-migrations.md).

## Executed local verification

All final check/integration/build receipts match the 35-file candidate-v4 manifest
`1a325c64d91e80ec150f043990ca763d235ee950f9c2f0819cc3b9ab1ad0944f`.
Node 24.20.0 / npm 11.19.0; owned PostgreSQL 17.11, normal integration 55603 and
disposable staging test 55703. Main database 55432 was not a test target.

| Check                                                    | Observed result                                                                                                                        |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                          | PASS formatting/lint/typecheck and 895 unit/component tests,46 files                                                                   |
| Full `npm run test:integration` with owned55703 override | PASS 452 tests,27 files, including 25 TLS and 37 migration cases                                                                       |
| `node scripts/with-test-env.mjs npm run build`           | PASS                                                                                                                                   |
| Focused repair TLS/migration run                         | PASS 62, including 22 new cases; final full 452 supersedes its broad applicability                                                     |
| Migration/lock/runtime pin and grant parity              | PASS 37 immutable files; original grant batch byte-identical                                                                           |
| Scoped privacy scan                                      | PASS 0 matches across 98 source/log/browser-JS files against 11 actual owned secret patterns; private config/certs/PG storage excluded |
| Hosted preflight                                         | Expected BLOCKED, exit 2; no network probe                                                                                             |
| CI workflow                                              | Local format/shell syntax checked; remote execution NOT RUN                                                                            |

Browser/UI checks were not rerun: this slice changes operator tooling, with no
user-facing application behavior change. This is not a new browser or physical
device certification. Test adapters are local-only; successful real CLI network
inspect/plan/apply on Neon is not established by primitive loopback tests.

Private evidence originally lived in integration `.local/staging-database-wave/`, especially
`candidate-v4.json`, source snapshots, `final-verification-summary.json`, original
and follow-up `review/` reports and exact command/source receipts. Root retains
accepted builder reports under the same private wave directory in main. Final
status-only documentation has separate coordinator review/source applicability
evidence; do not claim those later prose bytes were in the earlier runtime run.

## Local merge and cleanup

- Commit and post-merge checks matched all 36 frozen candidate files, aggregate
  `ae9d4f64fdc4c8ca53a35616827b8f21bd9af3ce09bb446ea5b5420bdb9c3e34`.
  Main's three coordinator documentation mirrors were verified and backed up
  before the fast-forward. No runtime source changed during the merge.
- All four workers were independently observed as succeeded/completed with
  released terminals before cleanup. The integration's remaining idle shell was
  closed through its exact Orca terminal handle.
- The three owned synthetic PostgreSQL clusters on 55601, 55602 and 55603 were
  stopped after verifying their process, data-directory and port identities.
  Main's cluster on 55432 was preserved. This wave requires no new schema migration.
- All three worktrees' source, ignored evidence, local handoffs and stopped
  synthetic database snapshots were archived and every archived file/link was
  verified. Reproducible `node_modules`, `.next` and Git metadata were excluded.
  Private archives and receipts are under main's
  `.local/staging-database-wave/merge-closeout/`; use the corresponding worktree
  archive for former integration and builder evidence paths.
- Orca removal completed for `m8-staging-connection`, `m8-staging-migrations` and
  `m8-staging-database-foundation`, including their three `cob-g/` branches.
  Physical paths, Git and Orca were checked: only main remains.
- The test/build results above are retained evidence for identical source, not
  newly executed post-merge tests. This closeout changes status documentation only.

## Remaining work

Actual Neon resource/isolation/TLS/roles/extensions/migration/concurrency/recovery
checks and remote CI are **NOT RUN**. A named target/operator, bounded budget,
recovery evidence and specific provider-operation authorization remain required;
the [operator packet](staging-database.md) deliberately retains invalid placeholders.
No provider resource, deployment, email, production or real-user operation occurred.

The 13 inherited dependency findings (9 high, 4 moderate) remain unresolved with no
waiver. Hosted auth/email/deployment and commercial/guardian/consent/legal/safety/
device/pilot/public-release gates remain open. Local commit, merge and cleanup are
complete. No remote push or deployment was performed. Actual provider rehearsal
is a separate subsequent operation requiring the concrete target and authority above.
