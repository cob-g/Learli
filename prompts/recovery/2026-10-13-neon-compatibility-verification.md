# Neon compatibility verification recovery

Status: AUTHORIZED — build-feature delegation; targeted fix, local only.
Scope: M8.3/M8.4, NFR-05/06/11. Own m8-neon-activation checkout, accepted
implementation base1039 source files plus scoped compatibility delta.

## R1 — focused unit run

Observed: unit-1 exited1,156passed/7failed across6files. All new Neon operation/
development and W2 SQL units passed. Existing staging lifecycle units failed.
One confirmed implementation defect: openStagingConnection's new wrapper reads
config.target.environment before opaque registration validation, so an empty
forged object throws raw TypeError instead of fixed config_invalid. Remaining
lifecycle cases use a mock pg Client with no genuine socket, so new native TLS
validation correctly refuses it before its intended SQL assertion.

Mode: Targeted fix. Preserve old staging parser, no-pool forged-config denial,
all SQL/current-role/privilege/cleanup assertions, actual TLS enforcement and all
migration/grant bytes. Validate opaque registration before metadata in wrapper
and development/W2 entry factories. Isolate native TLS only in existing mock-SQL
unit file, as already done for W2 SQL units; genuine native TLS is separately
exercised on owned PostgreSQL and a TLS-terminating proxy, with wrong CA/hostname,
plaintext, forged-client, reused-role and production-runtime denials.

No production connection/mutation, test bypass, weaker real transport or reset.
Earlier private inspection rejected CLI channel-binding syntax before network;
that preparation error is retained separately. No repeated root-cause attempt.

Verifier must rerun focused units, real TLS/auth/operator cases, strict typecheck,
full check and build, then inspect current source and exact manifests. Recover
executes no tests or repair. Original log .local/neon-activation/unit-1.log retained.

## R2 — generic callback inference

Focused unit-2 passed163/163 in6files. Typecheck-1 exited2 at runner.ts:304:
the conditional production-read-only versus dev-probe callbacks return different
receipt shapes, and withClient<T> infers only the first. This is a targeted
TypeScript composition failure, not a runtime/protection finding. Execute the
selected callback inside one async void-returning wrapper; preserve exact branch
selection and query bodies. Re-review and rerun typecheck, then real operational
cases/full check. No mutation or verification executed by Recover.

## R3 — owned proxy migration setup receipt missing

pg-tls-1 exited1: existing staging connection, W2 and migration suites passed105
cases; the new8-case proxy suite failed its beforeAll migration receipt status
assertion, leaving all8unexecuted. No diagnosis can be made from FAIL alone.
Preserve original log and stopped owned fixture. Add a sanitized full runner
receipt to the test assertion/private evidence, then execute only this new suite
on a fresh owned TLS fixture to locate stage/category; do not change migration,
transport, grants or assertion requirements before that evidence exists.
Recover recommendation: targeted diagnostic evidence collection; source repair
not yet selected. No production/provider operation or destructive retry.

R3 diagnostic receipt identifies stage=migrate, migrations=unknown,
grants=not_started, cleanup=pass. Actual owned server logs from both stopped
fixtures show permission denied for schema pg_catalog. The guarded owner startup
uses search_path=pg_catalog,public; Drizzle's accepted historical CREATE TABLE
statements are unqualified, so PostgreSQL chooses pg_catalog as creation schema.
Prior migration-engine tests use raw local pools with default public search path,
which explains105passing baseline cases without covering this operator seam.
No production mutation happened. Two diagnostic runs establish the same cause;
classify as a targeted operator-session compatibility defect, not polluted state
or a new schema architecture. Use an explicit migration-owner-only public search
path immediately before captured migration execution, after lock/source/plan
checks. PostgreSQL searches pg_catalog implicitly first when it is absent from
the explicit path, preserving builtin resolution; existing SECURITY DEFINER
functions keep their fixed paths. No historical SQL, privilege/ownership, runtime
search path or local/test parser change. Re-review, then run real guarded proxy
apply/auth/negative cases and affected engine regression. Keep both failed logs.

## R4 — historical static catalogue assertion

pg-proxy-3 passed actual guarded29 migration/grant/runtime receipt, plus47cases
across the engine and proxy suites; one new auth journey stopped on expecting
zero subjects. Historical reviewed0002_launch_subjects.sql intentionally inserts8
static launch subjects, with no user/tutor/learner fixtures. Correct only the
new assertion to distinguish zero tutors from the eight persisted catalogue
rows, then execute that auth/preview path. No migration/runtime repair required.
Production operational plan must disclose this immutable migration data alongside
NO seed/fixture scripts; coordinator notified before provider GO. Original
production data remains preserved. Recover runs no tests or code changes.

## R5 / independent N1 — recovery required for every production apply

Root independently verified frozen v1 all1052 hashes and reviewed30delta files;
recommendation CHANGES REQUIRED, one Important N1: even pending=[] executes and
commits runtimeGrantsSql, so production needs bound recovery on every apply.
Other three compatibility boundaries had no confirmed finding in that source
inspection; this is not provider GO. Preserve staging/development behavior and
all existing grant/protection/query rules. Require recovery whenever identity
is production, including current/empty schemas, and add valid bound/no-pending
refusal/acceptance cases. Runbook must state every production apply. Root accepts
migration-owner-only public search path and immutable8subject reference rows.

## R6 — full-check new default field observation

check-1 passed format/lint/typecheck and1329unit/component cases, with one env
assertion failing because the deliberate DATABASE_MODE=local default is missing
from its expected parsed object. Update that existing expected default field,
retaining all original env/security assertions and the new isolated test guard
coverage. One inherited unused inArray lint warning remains. No runtime repair
or package change. Re-review N1/source and rerun affected/full checks.

## R7 — genuine non-superuser bootstrap owner transfer

pg-bootstrap-1 passed48 cases and failed3 bootstrap-dependent cases. Private
owned PostgreSQL ERROR lines show `must be able to SET ROLE learli_migrator`.
CREATEROLE grants the creator ADMIN permission but defaults to no SET/INHERIT;
ALTER SCHEMA OWNER requires SET authority for the new owner. Root independently
confirmed the evidence and authorized the bounded provisioning direction, pending
technical review. Preserve database/provider ownership and exact runtime guards.
Temporarily grant the operator SET on the freshly created restricted migrator,
transfer only the initially empty public schema, SET the schema owner for its
REVOKE/USAGE statements, RESET and restore the operator's prior membership options
before commit. Neither new role gains any membership. Rehearse with nonsuperuser
operator and default creator ADMIN-only memberships; assert final direction/options,
actual29migration/grant/read-only probe and duplicate-bootstrap refusal. No cloud
mutation, role reset or superuser substitute. Recover itself executes no repair.

R7 second owned rehearsal reached the restoration assertion and refused a second
grantor entry, preserving transaction rollback. PostgreSQL16+ separately records
the bootstrap-superuser creator grant and operator's own temporary grant. Explicit
GRANTED BY neondb_owner and removal of only that added grant preserves the original
creator ADMIN-only membership. Third owned rehearsal passed3/3 including actual
29 migrations/exact grants/read-only runtime probe and duplicate refusal. Original
failures retained. Neither restricted role has any membership; final operator
memberships on both new roles are ADMIN true, INHERIT false, SET false in this
matching local fixture. Actual provider rehearsal remains pending GO.

## R8 — explicit child-process environment typing

check-2 passed formatting/lint (one inherited warning) and stopped at typecheck:
Next's ambient ProcessEnv requires NODE_ENV on the deliberately minimal libpq
child environment. Add a fixed production NODE_ENV to that private tool process
and its exact-whitelist assertion; it changes no libpq connection or application
mode. No inherited options/credentials and no ambient DATABASE_URL. Review then
rerun full check/build and scope-owned PostgreSQL evidence. This is a targeted
compile failure; no provider action happened and no reset is indicated.

Read-only source review corrected an overescaped pg-tool version regex before any
provider/tool execution: use a literal PG18 regex. No historical migrations,
app/runtime semantics or guards changed. check-3 passed1338/84 and build-1 passed;
current frozen v2 requires final check/assigned-port evidence and independent
root acceptance. The quick bootstrap1–3 tests used a free default owned TLS port;
no existing listener was touched. Final scoped run explicitly uses assigned56039.

## R9 — plaintext utility SQL in potential server error logs

Read-only v2 credential review found plaintext generated passwords interpolated
into CREATE ROLE. Tool/client output was already sanitized, but PostgreSQL's
error-statement logging can retain a failed password-bearing utility statement.
Official PG18 logging documentation confirms this path. Actual read-only production
settings are log_statement none, duration/sample logging disabled, on-error bind
length0 and debug printing off; metadata-only receipt retained. No provider writes.
Preserve same restricted-role semantics and transaction/preconditions/ownership
checks. Guard all relevant statement/bind/debug/optional tracing settings before
secret generation; bind password into a transaction-local custom setting, execute
constant password-free DO text, and catch/re-raise a fixed inner error without its
utility SQL/context. Clear GUC on success; rollback and destroyed lease on failure.
Real owned ERROR-statement logging rehearsal injects a passwordless role conflict
after preflight, confirms rollback/fixed error and absence of both password values
in actual server logs; no superuser owner-transfer shortcut. Additional unsafe
tracing denial must occur before retention/DDL. Root notified and v2 is held despite
prior independent PASS; new source freezes/re-review precede GO. No role reset on
provider, source migration changes or weakened privilege guards.

## R10 — timeout exclusions in PL/pgSQL error scrubbing

Independent root v3 review verified all1056 hashes and accepted other boundaries,
but identified WHEN OTHERS excludes QUERY_CANCELED/ASSERT_FAILURE while the exact
operator has statement_timeout10000. Diagnose actual owned role-DDL cancellation
using a short test-only timeout and controlled pg_authid SHARE lock after empty
preflight/retention. Preserve production timeout/transaction/credentials and no
provider writes. If dynamic private SQL appears in server CONTEXT, explicitly
scrub query_canceled and assert_failure through the same fixed error, then prove
actual cancellation logs safe and rollback/catalog/ownership unaffected; freeze
successor and independent review. Never disable timeouts or global logging.

R10 actual diagnostic seven-case run passed its before-proof assertion: with the
role catalog lock and250ms test-only statement_timeout, the original v3 handler
allows generated never-valid role password into PostgreSQL error CONTEXT. No
provider secret or existing credential was used. Explicit query_canceled and
assert_failure are added to the same fixed scrubber; production timeout10000
unchanged. There is no ASSERT construct/helper/event trigger in the accepted empty
role-create path, so ASSERT_FAILURE is covered defensively without inventing
permanent helper objects or claiming an observed assertion path. Final scoped test
must assert cancellation-region fixed error, absence of new password and zero
Learli roles after rollback; subsequent valid bootstrap/apply remains required.

First after-repair run retained6passes/1test failure because the automated edit
left the old diagnostic expectation true rather than converting it to the final
security expectation false. Observed new password presence is already false;
correct the test-phase assertion and add cancellation-only fixed-error/zero-role
rollback assertions. Preserve this test authoring failure; no runtime/source guard
repair or timeout weakening is needed. Repeat only the scoped cancellation suite.
