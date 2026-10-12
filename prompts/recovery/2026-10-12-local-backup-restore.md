# Local backup/restore recovery history

Authority: AUTHORIZED — build-feature delegation, Worker2 task_055dbc98ef0e /
ctx_0c842ac9f465, isolated baseline5634e44. M8.4/M8.7,NFR-11/12.
Mode: Targeted Fix. No reset, schema/provider/product change or new permission.

## Initial read-only Review F1

Observed: drill writes result.json PASS inside try before finally stops target;
a connection-end rejection can also skip stop. Impact: misleading success or
an unnecessarily live newly owned disposable target. No actual restoration has
run at this point. Initial Review CHANGES REQUIRED, not independent review.

Proposed repair: settle both connection closures without short-circuiting, attempt
owned target stop even when closure fails, record cleanup failure and withhold
PASS until target stop and closures succeed. Preserve source/target files, guards,
archive, fixture assertions and history. Review revised code then run actual
restoration/refusal/check/build verification in a granted slot. NOT RUN BY RECOVER.

Recover only diagnosed/wrote this handoff; implementation/verification are separate
build-feature stages. Future failed attempts append sanitized evidence here.

## Authoring correction

The first textual repair command could not match a formatter-adjusted function
boundary and exited1 before writing the source. A scoped patch then applied the
planned cleanup ordering; this is an authoring failure, not a test/restore result.
The original inspection result and command failure remain in private evidence.

## Verify attempt1 — explicit subprocess environment

Observed: npm run check exit2 after format/lint PASS; TypeScript TS2769 requires
NODE_ENV in the repo-augmented ProcessEnv type. Unit tests were not reached.
Evidence: .local/readiness-wave/check-1.log. Targeted tooling compatibility fix:
set subprocess NODE_ENV explicitly to test (no inherited runtime/credentials).
Re-review scoped environment then rerun complete check. NOT RUN BY RECOVER.

## Restore attempt1 — address representation

Observed: dedicated restore test exit1 before its missing-tool failure.json
assertion; no restore directory/archive created for that attempt. Read-only owned
server diagnosis shows all path/port/listener/owner/version/PID checks true except
inet_server_addr()::text comparison. PostgreSQL inet text includes its mask;
use PostgreSQL host(inet_server_addr()) to compare the exact canonical127.0.0.1
address. Preserve strict loopback equality; no host acceptance expansion. Earlier
source fixture cleanup completed. Evidence restore-1.log; diagnostic booleans
only, no secrets/rows. Targeted address normalization, re-review and actual retry
with fresh ids required. NOT RUN BY RECOVER.

## Restore attempt2 — owned socket path length

Observed: source snapshot/archive succeeded; new target initialization succeeded,
pg_ctl startup failed before target restore. Private server log identifies Unix
socket path too long under the deeply nested worktree/run directory. Target PID
is absent; no target server is live. Original archive/data/tool/server/failure
files retained. Injected missing-tool failure also produced expected FAIL/noPASS.
Evidence restore-2.log and private proof-2c3c72c5-81a2-40d3-b481-155d9ca99740.
Mode1 targeted fix: disable Unix sockets for this TCP-only loopback target;
keep127.0.0.1/ownedport/data/system/PID proofs and fresh target invariant. No source
or shared setup change. Re-review then run a new target; no cleanup/reset/deletion.
NOT RUN BY RECOVER.

## Restore attempt3 — PostgreSQL CHECK reparse normalization

Observed: actual restore completed, target was stopped, and strict schema
comparison rejected eight CHECK lines; both dumps have1683 normalized lines and
all differing lines flatten nested AND groups generated from BETWEEN. No rule,
operand, operator or constant differs. Original failed target/archive retained;
restore-3.log. Reclassification remains Mode1 evidence/canonicalization defect,
not polluted data or wrong foundation; no blind retry or assertion removal.

Proposed fix: canonicalize source CHECK definitions using PostgreSQL's own parser
on the fresh restored target inside a transaction (drop/readd exact source CHECK,
read pg_get_constraintdef, rollback). Compare the complete source schema with only
those named definitions replaced by parser output against the actual restored
schema. Preserve every rule and exact other schema/ACL/row/migration assertion;
revalidate actual check/FK/exclusion/immutability and post-probe unchanged snapshot.
Do not strip parentheses by regex or ignore constraints. Review then new-target
Verify. No source writes, preserved targets overwritten or historical migrations.
NOT RUN BY RECOVER.

## Restore attempt4 — comparison remains unresolved

Observed: actual target restored and stopped; canonicalized source CHECK proof
completed, but overall restored-comparison still rejected. No success. Reclassify
before another repair: Mode1 remains possible, but the exact remaining component
is UNKNOWN because the first implementation retained source/schema output but
not the restored catalog snapshot. Preserve this failed target; diagnose its
read-only catalog using positive owned path/system/port identity in a separate
Verify inspection. Do not rerun restoration or ignore mismatches without evidence.
Root msg_fa86bbc4acb4 explicitly accepts bounded parser normalization and requires
material-rule negative proof plus original/normalized comparisons preserved.

## Remaining comparison diagnosis — effective owner ACL

Separate owned-target diagnostic1 failed startup because its temporary command
omitted LC_ALL=C; no target server remained live. Corrected diagnostic2 used the
same locale as tooling, positively checked persisted system/data/port identity,
read catalogs and stopped the target. No existing target was restored/overwritten.
Actual target snapshot equals source in rows, columns, sequences, migrations,
roles, database ACL and constraint flags. Only two relations differ: source has
explicit default owner-only ACL; restore represents the same privileges as NULL
(default ACL). pg_dump emitted no different grant SQL. Evidence diagnostic-target.json
and comparison-diagnosis2.log. No access expansion is indicated.

Targeted fix: compare exploded effective ACL entries using acldefault only for
NULL relation ACL, preserving grantor/grantee/privilege/grant-option and owner/RLS
flags. Keep actual denial probes and complete schema equality. Add the root-required
negative material CHECK change: canonicalize CHECK(true) instead of the actual
subjects rule under rollback, require inequality to restored actual schema. Save
original/canonical/changed schemas and comparison booleans privately. Re-review
then one new-target proof; no assertions ignored or catalog/grant rewrites.

## Restore attempt5 — JavaScript replacement metacharacters

Observed: all catalog/row/grant/migration/role/sequence comparisons now equal.
Canonical-schema comparison still rejects five lines. Retained canonical text
shows `$'` regex anchors were expanded by JavaScript String.replace's replacement
string semantics (suffix insertion). PostgreSQL parser output is correct; only
our serialized replacement corrupted the comparison text. Target constraints
were rolled back unchanged and target stopped. Mode1 confirmed localized tooling
bug; this is the reclassification before another repair. Use a replacement callback
to retain literal `$` characters, with full schema equality still mandatory.
Evidence restore-5.log, comparison.json and both saved SQL files. Re-review then
fresh-target actual proof; no source data rewrite or assertion loosening.

## Restore attempt6 — missing diagnostic SQL alias

Observed: catalogsEqual=true, canonicalSchemaEqual=true, changed CHECK negative
completed; probe-wrong-failure follows. Separate owned target rollback diagnostic
proved all nine statements reject with expected42501/23514/23503/23P01, then
stopped target. Our generated duplicate SQL query lacked AS sql; typed row.sql
was undefined, so Client.query rejected before PostgreSQL. Targeted result-alias
fix; no assertion/constraint changes. Evidence restore-6.log/comparison.json and
probe-diagnosis.log. Original failed files remain. Re-review then new-target
operations Verify and final check/build. NOT RUN BY RECOVER.

## Final check attempt3 — CHECK lookup type narrowing

Observed: latest restore-7 PASS; full check exit2 after format/lint PASS because
TS18048 cannot narrow the optional find result through the const fail helper.
Targeted type-safe expression: find(...) ?? fail(...) makes the required CHECK
value explicit, retaining the same refusal and material-negative behavior. No
unsafe cast/non-null assertion. Re-review then final check/build and current-state
operations proof; all earlier logs remain. NOT RUN BY RECOVER.

## Independent Review A F1 — post-start evidence failure (2026-10-12)

Status: AUTHORIZED — build-feature delegation, bounded repair dispatch
task_e2bcafb8b671 / ctx_d56c731f95c7. Mode1 Targeted Fix; Important local
operational defect. All nine input hashes match the accepted root import manifest
and baseline5634e44; preserved before-state copies are under the private
.local/readiness-wave/repair-f1/before directory. Earlier evidence is unchanged.

Observed: runTool invokes pg_ctl before exclusively writing its private log.
A log-write failure after successful startup prevents started=true, so finally
skips stopping the live new target. A pg_ctl timeout/nonzero exit can likewise
leave PostgreSQL alive; PostgreSQL17 documents continued background startup.
Root cause: cleanup authority depends on command/evidence success rather than
positive identity of the exclusively created target. No application data path
or production capability is affected; no false PASS was established.

Recommendation: record startup attempt before invoking the tool; generate a
fresh per-run cluster_name token, and reconcile actual postmaster PID/data/port/
loopback plus live process command/token during cleanup, independently of logs
or command outcome. Only the newly created owned directory is eligible; mismatch
must refuse stop. Preserve all files and successful restore assertions.
Verifier must simulate one filesystem log-write failure after real PG startup,
and startup nonzero/timeout reporting with a live real target; prove PID absent,
port reusable, FAIL/no PASS, retained archive, source intact and foreign target
untouched. No production injection switch. NOT RUN BY RECOVER.

## F1 separate executed Verify — 2026-10-12

Root granted Slot B for the reviewed repair; released immediately after checks.
Current npm run check exit0: format/lint/strict types plus685 tests in36 files.
Test-env production build exit0. Explicit operations suite exit0,1 case, with
three real new target startups before injected persistent pg_ctl log ENOSPC,
nonzero exit and timeout result. Each actual PID disappeared, postmaster.pid was
absent, port55512 could be rebound, archive/server log remained, failure.json was
FAIL and no result.json existed; source fixture and foreign sentinel survived.
A subsequent fresh complete33-table/17-migration restoration passed unchanged
catalog/schema/row/ACL/role/sequence and nine enforcement/material-negative probes.

Status: RESOLVED BY SEPARATE VERIFY stage for local behavior; independent root
re-review pending, not claimed. Same agent performed sequential Recover,
implementation, read-only Review and executed Verify stages. No independent
verification is implied. Evidence: .local/readiness-wave/repair-f1/{check-1.log,
build-1.log,restore-1.log,review.md}; all earlier evidence remains. No source/
shared config/package/migration changes or data overwrite/reset. Hosted recovery
and launch gates remain outside this local repair.
