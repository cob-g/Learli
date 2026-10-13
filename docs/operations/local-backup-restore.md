# Local synthetic backup and restore rehearsal

This runbook covers only the checkout-owned local PostgreSQL 17 test database.
It supports the local M8.4/M8.7 and NFR-11/NFR-12 slice. It does not establish
Neon provider backup coverage, production retention, RPO/RTO, an SLA or release
readiness. Real incident contacts and hosted recovery remain launch gates.

## Prerequisites and responsibility

The operator owns this checkout and its `.local/postgres` cluster. The readiness
coordinator owns acceptance and any later integration. Run with pinned Node
24.20.0/npm 11.19.0, `npm ci` and PostgreSQL 17 tools (`pg_dump`, `pg_restore`,
`initdb`, `pg_ctl`) on PATH; optional `PG_BIN` selects their installed directory.
Use existing local setup with assigned `LEARLI_DB_PORT`, `LEARLI_DEV_PORT`,
`LEARLI_TEST_PORT`; do not inherit another checkout's credentials or data.
Use the current checkout's recorded ports; the examples below use an explicitly
assigned free restore port. Never reuse a former worker's database by its number.

The script reads its own private `.env.test.local` and `.local/database.json`.
It requires APP_ENV=test, AUTH_MODE=local, exact loopback `learli_test` URLs and
setup credentials/ownership marker. It checks actual running server data path,
listen address, port, PostgreSQL major version and postmaster identity. It rejects
remote, dev, peer and malformed configuration; runtime connection rules stay
unchanged. It rejects non-`.test` users and values outside the exact reviewed
source/provenance inventory. The accepted inventory currently covers0024; new
provenance columns fail closed until separately reviewed and integrated. This is
not blanket permission to restore every value labelled synthetic.
Only source reads occur. Pause migrations and other test writers for the rehearsal;
ordinary row writes are captured at the exported consistent snapshot, but schema
changes and sequence updates should not run concurrently with the drill.

## Execute and collect evidence

The source must already have reviewed migrations and a synthetic active booking.
The dedicated test creates both legacy and readiness synthetic fixtures. It removes
only the exact legacy fixture identifiers it owns. Readiness policy, admission,
screening and response histories are append-only and remain in that owned source
database; the test does not disable protection to erase them. Unit discovery uses
the normal glob; restoration uses the dedicated
vitest.restore.config.ts operations configuration. Docker CI owns a different
fixture contract and cannot satisfy local cluster ownership; no guard is weakened.
The registered `npm run test:restore` command and these direct commands run the
same dedicated operations suite:

```sh
npm test -- tests/unit/local-backup-restore.test.ts
node scripts/with-test-env.mjs node_modules/.bin/vitest run --config vitest.restore.config.ts
node_modules/.bin/tsx scripts/local-backup-restore.ts drill my-new-drill 55512
```

Every run id must be new, simple lowercase letters/digits/hyphens, at most64
characters. Every restore port must be free, above1023 and different from source.
The operations test accepts an assigned `LEARLI_RESTORE_PORT` when the coordinator
allocates a different unused port. Heavy checks require a wave slot. Run database
and browser suites sequentially if they share the source database.

The drill exclusively creates `.local/backup-restore/<run-id>` with mode0700 and
records ownership before target initialization. Existing paths are refused even
if they appear empty. It never adopts an existing cluster. Before creating the
restore database it verifies the fresh cluster has only its three standard
empty databases, the expected owner, and a system identity different from source.
Target roles receive fresh random passwords; no global-role dump or original
password-hash replay occurs. No application env file is changed.

A repeatable-read read-only transaction exports the snapshot used by the custom
archive and schema dump. Ordered full row hashes include every public/Drizzle
table, migration rows and sequence values. Dumps preserve object ownership,
functions/triggers, indexes, foreign keys, checks, exclusion constraints and
schema/object/column grants. Separate evidence records database ACL and safe role
attributes, excluding passwords. Source migration journal entries must match every
committed migration SQL hash and timestamp.

Restoration runs with `--exit-on-error --single-transaction`, without clean/drop,
into the new target. The target's actual schema, full row hashes, ACLs, sequence
values, role attributes and migration state must match. PostgreSQL reparses
nested AND CHECK groups, so source CHECK definitions are canonicalized by the
server on the new target under rollback. Every operand/rule remains compared;
a material CHECK(true) change must produce inequality. NULL/default relation ACLs
are compared as exploded effective grants including grantor/grantee/grant option,
owner and RLS flags. Original/canonical/actual/changed schema evidence is retained. Runtime probes must reject
role assignment, account-status updates, booking deletion, audit reads and schema
creation. Owner probes must demonstrate check/foreign-key rejection, actual
booking overlap exclusion and immutable-booking trigger enforcement. All probes
roll back; a second snapshot proves they changed no restored records.

Success prints only counts and the local evidence location. The target is stopped
in final cleanup; its data and archive remain intact. `result.json` is PASS only
when restoration and all comparisons/probes succeeded. A readable archive alone
never qualifies. Current implementation bounds row hashing to100000 rows/table
and each subprocess to120seconds; larger datasets are refused, not partially
certified. This deliberately small local rehearsal does not cover tablespaces,
replication, external secrets, extra roles or arbitrary hosted configurations.

## Privacy and retained artifacts

Dumps, row hashes, full private schema output and tool/server logs remain under
ignored `.local/backup-restore` (private files0600, directories0700). These may
contain synthetic protected values. Keep raw dumps/logs out of Git/chat/public
reports. PostgreSQL passwords enter private passfiles, not argv. Subprocess
PostgreSQL environment overrides are not inherited. Fresh target credentials are
in private `target-state.json`; never paste them or use them for an application.
Sanitized reports include command, exit status, environment, source identity and
artifact hashes. Preserve original failure evidence even after a successful retry.

## Refusal and recovery procedure

1. Stop dependent test jobs; preserve the archive, ownership manifest, failure
   record and raw logs privately. Record the command/status and a sanitized cause.
2. If no run directory exists, the guard failed before backup/target creation.
   Check own private test config, modes, marker, source identity, migration state,
   active synthetic booking and allocated port. Do not loosen guards or copy
   credentials from main/peers.
3. If initialization/restore/proof failed, inspect local files without publishing
   contents. The drill attempts to stop only its positively owned new target.
   If interrupted, verify `ownership.json`, exact data path and `postmaster.pid`
   port/PID against the owned process before using `pg_ctl -D` on that directory.
   Ask the coordinator if ownership is uncertain. Never stop a system/peer service.
4. Classify tool/configuration, interrupted state or actual schema/data/grant
   mismatch. Correct the bounded cause, re-review changed tooling, and rerun with
   a new id/free port. Existing targets are preserved and cannot be overwritten.
5. Do not promote a failed target, rewrite source data or perform a down-migration.
   Any deletion or recovery into existing/shared/production data needs separately
   authorized planning. Report unresolved mismatch; archive readability is not a
   fallback PASS.

A failure leaves the source intact. This rehearsal has no delete/reset command or
production restore mode. A later hosted runbook needs provider-specific verified
recovery, explicit data/operation authorization and a responsible human operator.

## References and verification boundary

PostgreSQL17 [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html),
[pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html) and
[snapshot functions](https://www.postgresql.org/docs/17/functions-admin.html)
were consulted for synchronized snapshots, custom archives and transactional
restore. Actual executed evidence belongs to the progress tracker and private
readiness report. Same-agent Review is not independent acceptance.

## Startup failure cleanup (independent-review F1 repair)

The drill records startup intent before running pg_ctl. Cleanup reconciles the
actual private postmaster file and OS process against the new target's data path,
port, loopback address and fresh cluster_name token in ownership.json. It stops
only that positively identified process, even if pg_ctl reports a timeout/nonzero
exit or the post-start private tool log cannot be written. A missing process is
not adopted; an identity mismatch refuses stop and leaves a failure for inspection.
A stop/evidence failure withholds PASS. Files remain preserved for a fresh-id retry.

The operations regression uses test-only Vitest module mocks after a real owned
PostgreSQL startup to simulate persistent pg_ctl log ENOSPC and nonzero/timeout
results; it checks OS PID disappearance, reusable port, preserved archive, FAIL
and absent PASS, intact source fixture and foreign sentinel. No fault-injection
option exists in the CLI. Runtime evidence for the revised state must be recorded
separately from the original successful drill.
