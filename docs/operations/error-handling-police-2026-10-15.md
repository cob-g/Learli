# ERROR HANDLING POLICE — 2026-10-15

One existing error-handling defect was reproduced and fixed: the local database
CLI could report a stopped server after an unknown subprocess result. An
introduced test typing issue was caught by aggregate validation and independent
audits, corrected, and independently cleared. The owner subsequently authorized
commit, merge into local main and cleanup. Commit `00be982` contains exactly the
four reviewed paths; merge `eac4489` preserves the same tree on local main.

Run: `run_e24bc4d884e9`. Private evidence, exact commands, hashes, original
failures and lifecycle receipts: `/tmp/learli-error-handling-police-20261015/`.
No deployment, remote push, production mutation or live provider test occurred.

At the integration follow-up, that temporary evidence directory was no longer
present. All four reviewed file hashes still matched. Fresh aggregate validation
again passed all 1,746 tests, formatting, lint and full project types; the ordinary
production build passed with the same one tracing warning. Database suites were
not rerun for the merge. New logs, preservation/merge receipts, a verified review
checkout archive and final cleanup results are retained under
`/Users/cob/orca/archives/learli/error-handling-police-20261015/local-merge/`.
The earlier raw investigation evidence has not been recovered or recreated; the
historical outcomes below remain the recorded results of the original operation.

## Exploration and failure model

Eleven GPT-6 Luna high worker launches produced ten completed read-only
investigations/audits: five domain investigations, two cross-boundary reviews and
three post-implementation audits. One initial cross-runtime attempt stopped
before investigation because it invoked a broken PATH alias. Its final stopped
turn was inspected, its exact worker was closed, and the same Task was retried
successfully. That attempt contributes no source coverage. Two GPT-6.1 Sol high
workers implemented the CLI fix and the subsequent test-only correction.
Requested and effective models match every launch receipt. At most three workers
ran concurrently. Twelve Tasks completed successfully across thirteen attempts;
twelve successful dispatch resources were released, and the stopped attempt was
explicitly closed. No reclaimable terminal or pending question remains.

The repository inventory contains 31 feature modules, 56 API handlers, 22 schema
source files and 32 migrations. Coverage spans booking/learner mutations and
readback, frontend forms and error boundaries, account/auth/MFA/admin controls,
public catalog/matching/availability, support/reviews, database leases and
transactions, durable notification delivery, provider adapters, diagnostics and
operator/startup/shutdown tooling. `coverage-map.json`, `repository-inventory.json`
and the reports list actual inspected paths and limits; inventory coverage is
not a claim that every source line or failure scenario was executed.

Cross-boundary reviews traced UI uncertainty to API/domain transaction outcomes,
and booking events through intents, delivery claims, recipient revalidation,
transport and durable acknowledgment. Expected validation/permission/conflict
errors remain distinct from private unavailable responses. Ambiguous committed
writes retain operation identity or require state inspection; provider acceptance
is distinct from delivery. Optional capture failure does not reverse committed
booking state. Policy-gated capabilities, current authorization checks, bounded
retries and framework recovery remain intentionally preserved.

## Findings and disposition

Two initial unique candidates were investigated: one confirmed existing defect
and one false positive. The first post-implementation audits identified one
additional, introduced test-only verification defect. Overall: three unique
candidate groups, two resolved issues, one false positive, no remaining
high-confidence or unverified error-handling candidate. The existing operational
defect and introduced test issue are Low severity; Critical, High and Medium
confirmed findings are zero. Baseline test/environment issues below are tracked
separately and are not counted as application defects.

| ID      | Boundary                                       | Evidence and outcome                                                                                                                                                                                                                                    |
| ------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EH-C-01 | Local process status and recovery              | Confirmed and reproduced. Missing/non-executable/signalled `pg_ctl` or unexpected status could become exit-0 stopped output or allow follow-up startup work. Fixed with explicit recognized status results and strict success for other commands.       |
| EH-B-01 | Root-layout error fallback                     | False positive after F and I inspected installed Next 16.4 loader/default global-error source. The framework already supplies a safe full-document reload/back fallback; no custom handler was added.                                                   |
| EH-H-01 | New test versus project TypeScript environment | Introduced acceptance blocker, found by root and H/I. Standalone Node-only typing missed Next's required `ProcessEnv.NODE_ENV`. Corrected with one explicit test value, retaining isolated environment and every assertion; J independently cleared it. |

### EH-C-01 root cause and correction

`scripts/local-db.mjs` formerly used an unrestricted `allowFailure` flag. A
`spawnSync` launch error or signal returns a null status, while other nonzero
statuses can indicate a failed diagnostic. Those results were treated as
ordinary stopped state. The CLI now rejects launch errors, signals and statuses
outside a call-specific allowlist before subsequent commands or SQL setup.

Only `pg_ctl status` accepts 0/3; start, stop and initialization require 0. The
[PostgreSQL 17 command reference](https://www.postgresql.org/docs/17/app-pg-ctl.html)
distinguishes the not-running result 3 from inaccessible-directory result 4.
Known running/stopped behavior, owned-cluster checks, existing private
configuration, no-reset behavior and fixed sanitized diagnostics are preserved.
Child stdout/stderr is not exposed. No application route, authentication,
ownership, schema, transaction, dependency or provider behavior changed.

One new file, `tests/unit/local-db-failures.test.ts`, contains 34 subprocess
regressions for launch/permission/signal/unexpected-status failures, failed stop,
recognized state controls, successful start/stop and ownership guards. Each case
uses a unique temporary cwd, fake executables and a recording `pg.Pool`
replacement; no fault is injected into a real PostgreSQL process. Assertions
check observable output/exit status, no unsafe follow-up, preserved fixture
files, private-output suppression and cleanup. The child environment contains
only synthetic `PG_BIN` and explicit `NODE_ENV: "test"`.

The exact final test bytes produce 16 failures / 18 passes against the original
CLI and 34 passes against the fixed CLI. The final test SHA-256 is
`e588b399e36460ccc3bfdef9cacb4e853f120ade8250c09180e8064e182ffba7`;
the CLI SHA-256 is
`c0c64b8f5c4700c720f0b413967f261bccb1f2cce2fb8259b0364e57b7289c93`.
The second Sol changed only the explicit environment value; it did not change
assertions or the CLI. Original and corrected red/green/compiler evidence is
retained in `implementation-local-db/` and `implementation-test-env/`.

## Validation and remaining failures

| Executed check                                                   | Observed outcome                                                                                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Fresh baseline `node scripts/with-test-env.mjs npm run check`    | PASS: format, lint, Next route type generation, strict TypeScript, 1,712 tests / 116 files                                                 |
| Baseline ordinary production build                               | PASS                                                                                                                                       |
| Baseline selected failure-boundary PostgreSQL suites             | PASS: 183 tests / 9 files                                                                                                                  |
| Initial integrated aggregate check                               | Formatting/lint passed; typecheck failed TS2769 at the new test's restricted child environment; unit phase did not run                     |
| Corrected aggregate `npm run check` through the test-env wrapper | PASS: format, lint, full project types, 1,746 tests / 117 files                                                                            |
| Corrected ordinary production build                              | PASS, with one filesystem-tracing warning described below                                                                                  |
| Post-integration selected PostgreSQL run                         | PASS: 199 tests / 11 files, including hosted auth and native TLS                                                                           |
| Final corrected subprocess regression bytes                      | Original CLI: 16 failing / 18 passing; fixed CLI: 34 passing                                                                               |
| Independent audits H and I                                       | CLI source accepted; introduced typing blocker identified honestly                                                                         |
| Independent closure audit J                                      | PASS on exact corrected bytes, raw red/green, full check/build and PostgreSQL evidence                                                     |
| Coordinator's native known-state cleanup smoke                   | PASS: running status, successful stop, stopped status on this operation's owned loopback cluster; PID/listener absence separately verified |

Final PostgreSQL coverage includes booking lifecycle, account password/email/
sessions, booking/lifecycle notices, policy bookings, learner creation, support,
hosted auth and native TLS. It uses synthetic fixtures and real loopback
PostgreSQL 17.11 with the existing sequential-file test configuration and an
explicit threads pool/assigned TLS port. No test assertions were weakened.

The full configured baseline database run was interrupted after approximately
403 seconds. It had reported a failure in
`tests/integration/bookings.test.ts:1367` and hosted/TLS setup skips. A bounded
unchanged-source rerun reproduced the booking failure before concurrent calls:
the test assumes its first two candidate slots overlap, but the current
one-hour-notice window puts them on different days. No application concurrency
failure follows from that assertion. This pre-existing clock-sensitive fixture
is deferred; selecting explicitly overlapping fixture slots is a separate
targeted follow-up. No complete database-suite pass is claimed.

A bounded TLS rerun separately passed eight hosted-auth cases and exposed a
missing `.local/neon-activation/` output directory before native-TLS assertions.
Creating only that owned private test-output directory allowed the final 199-case
selection, including all eight native-TLS cases, to pass. The original failures,
interrupt receipt and setup preparation are preserved; no TLS guard was relaxed.

The corrected build emitted one Turbopack broad-file-pattern warning in unchanged
`src/lib/email/local-mail.ts:20` after local test artifacts accumulated; the
baseline build did not emit that warning. Source verification confirms all 543
application/schema/dependency/configuration paths inspected for identity remain
byte-identical. The warning is retained, not presented as warning-free acceptance
or repaired through unrelated bundling changes. Existing JSDOM document-navigation
notices appear in both passing unit runs. Worker test-directory alias and
standalone-compiler invocation corrections are also recorded with original logs.

Full browser E2E, root-layout runtime fault injection, Windows executable-mode
portability, real external provider failures, deployment acceptance and production
recovery are unverified. No general resilience certification follows from these
scoped tests. Native start failure modes were tested with controlled executables;
the coordinator's real cluster smoke covered only normal status/stop cleanup.

## Task accountability

All twelve Tasks completed; paths below are relative to the private evidence root.
`agent-ledger.json`, `final-tasks.json` and `final-workers.json` bind lifecycle and
requested/effective model identities.

| Task                                  | Model     | Outcome / evidence                                                                                                                                      |
| ------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A booking/learner failure propagation | Luna high | No retained defect; `exploration/explore-A-booking-failures.md`                                                                                         |
| B client recovery/boundaries          | Luna high | One structural lead later disproved; `exploration/explore-B-client-recovery.md`                                                                         |
| C delivery/operations                 | Luna high | EH-C-01; `exploration/explore-C-delivery-operations.md`                                                                                                 |
| D account/auth/admin                  | Luna high | No retained defect; `exploration/explore-D-account-admin.md`                                                                                            |
| E public/catalog/support              | Luna high | No retained defect; `exploration/explore-E-public-support.md`                                                                                           |
| F UI/API cross-boundary               | Luna high | EH-B-01 disproved; `exploration/explore-F-cross-ui-api.md`                                                                                              |
| G runtime/delivery cross-boundary     | Luna high | EH-C-01 corroborated, no new defect; `exploration/explore-G-cross-runtime-delivery.md`; initial stopped attempt and successful same-Task retry retained |
| CLI implementation                    | Sol high  | Reproduced/fixed EH-C-01; `implementation-local-db/report.md`                                                                                           |
| H CLI/evidence audit                  | Luna high | Runtime fix sound; EH-H-01 blocker; `audit-H-cli.md`                                                                                                    |
| I contract/integration audit          | Luna high | Boundaries sound; same blocker; `exploration/audit-I-contracts.md`                                                                                      |
| Test environment correction           | Sol high  | One-line correction, full types and renewed red/green; `implementation-test-env/report.md`                                                              |
| J independent closure                 | Luna high | PASS; `exploration/audit-J-final-closure.md`                                                                                                            |

## Preservation and outcome

Four paths change: the CLI script, its new test, this report and the progress
tracker. The original checkout's branch, HEAD, status, 1,210 tracked file bytes,
12 symlink targets and uncommitted security report were unchanged by the
investigation. During the owner-authorized integration follow-up, local main
advanced through the verified merge; unrelated branches and the original dirty
checkout remain protected. No secrets, database migrations, existing tests or
business rules were changed.

All owned database/test processes are stopped and synthetic data is preserved.
The shared Sol helper worktree/branch was removed after exact integration and a
verified private archive of every non-regenerable file hash/mode and symlink
target. The owner subsequently authorized removal of the committed and merged
review worktree/branch after archive verification. The durable integration receipt
records final removal and original-checkout preservation; see the evidence
availability limitation above for the original temporary investigation artifacts.

The result is truthful local operator failure handling with bounded regression
coverage. Existing failure contracts and legitimate graceful degradation remain.
Remaining follow-up is the clock-dependent booking test and any separately
justified tracing/portability assessment; no open confirmed application
error-handling defect remains within the investigated evidence.
