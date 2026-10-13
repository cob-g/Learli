# Learli Neon operational activation

Date: 2026-10-13. Owning work: M8.3/M8.4/M8.7, related M2.1/M2.2;
PRD NFR-05/06/11/12. Status: **AUTHORIZED — build-feature delegation**;
execution awaits the coordinator's immutable-source acceptance and explicit GO.

## Outcome and authority

Apply the reviewed Learli schema, without seeds, to the existing production
branch and connect a local application to a separate schema-only development
branch. Actual user instruction: “Migrate production, but keep the local app on
a separate development branch”. This supplies production migration authority;
the remaining gate is a technical dependency, not a request for reapproval.

This worker owns only m8-neon-activation (branch cob-g/m8-neon-activation,
baseline 2fa0294c5e6cad895754b3c10a703a6c6f6ef00a) and its ignored private
.local/neon-activation evidence. Root owns main, integration, accepted source,
reconciliation and the heavy-job lease. No nested agents, install/login/deploy
repeat, Railway action, live mail, real users, payments, push/merge/commit,
resource deletion, plan upgrade or destructive reset is authorized.

## Observed Phase A inventory

Explicit project withered-grass-51575984, production branch
br-bitter-hat-az6vm3mg, endpoint ep-cold-unit-azgb936u, database neondb.
Provider reads confirmed Learli/aws-ap-southeast-1, PostgreSQL18.6, ready primary
default production branch, unprotected, one branch/database/API-managed owner.
Project history retention is21600seconds; no recovery SLA is inferred.

Two read-only transactions found no application tables, sequences, custom
functions, constraints, application rows or drizzle migration ledger. Public
schema belongs to pg_database_owner; only plpgsql is installed, btree_gist1.8
is available. neondb_owner has neon_superuser membership and powerful provider
attributes; it must remain an operator identity, never application runtime.
The runtime and migration identities do not yet exist. No existing-data conflict
was found; inspection must be repeated before any write.

Credentials were retrieved privately through authenticated CLI8.3.5. The pg8.23.1
socket has encrypted=true, authorized=true, verified certificate hostname and
channel binding enabled. Backend pg_stat_ssl reports ssl=false. This is a
provider observation, not evidence of an unencrypted client connection.

Prospective integration source has29 SQL migrations0000–0028,78 declared public
tables and a final exact-grant verifier expecting86 non-extension functions.
It is not yet the accepted immutable apply source. Phase A hashes are inventory,
not authorization to apply a changing integration checkout.

## Required compatibility work

### Phase B accepted implementation plan — coordinator reply, 2026-10-13

Coordinator accepted this blueprint under AUTHORIZED — build-feature delegation
and assigned this worker the three bounded compatibility changes in its own
checkout. Base source1039 files aggregate
3969681f16f2fcf659df66cf573cf81ee8ef1fc2bdc02553bae2eec900506b6f;
manifest `.local/neon-activation/accepted-base-v1.json`. Provider operations
remain gated. Heavy lease B authorizes scoped local execution on owned PG55939,
dev3039/test3190/TLS56039/backend3339/HTTPS3439/restore55539.

Add `DATABASE_MODE=neon-development` (default `local`) and
`NEON_DEVELOPMENT_CONFIG_FILE` as an absolute private packet under this checkout's
`.local`. The development seam requires APP_ENV=development, a loopback HTTP
APP_URL, AUTH_MODE=local, no ambient DATABASE_URL/DATABASE_URL_DIRECT,
and disabled real workflows. It preserves existing synthetic local account, tutor, learner and booking-preview
workflows using the existing Better Auth composition and local mail capture;
real policy-dependent factories stay disabled. Ordinary synthetic local
auth/capture and test URLs retain their original loopback parser. The packet
contains only the development runtime URL and truthful schema-only-development
target, never migration credentials. Document `npm run dev` with the opt-in
private env and `npm run neon:database` deliberate operator commands.

Add a separately opaque Neon operational target/config parser for development
and production. Production packet permits metadata/schema operations only;
production runtime purpose is always rejected. Reuse the existing captured
Drizzle plan/apply engine, grant verifier and protection checks from a separate
operator CLI. Keep the staging parser and its environment contract unchanged.
Bind new operator/parser/transport bytes into candidate source identity.

Actual native pg Client and authorized TLSSocket/certificate/hostname are the
transport evidence at every operator/runtime checkout, including reused leases.
No caller boolean, SQL ssl hint, arbitrary pool option, CA or local URL may admit
a production client. TLS tests include a test-owned TLS-terminating proxy to
plain local PostgreSQL so backend ssl=false succeeds only over genuine verified
client TLS; wrong CA/hostname/plain socket and identity/role/session drift deny.

Local changes require same-agent read-only Review then executed checks/build,
focused real PostgreSQL/TLS/operator tests and meaningful dev-seam regression
tests under the lease. Root independently reviews frozen delta before provider GO.

1. Both staging-connection.ts and hosted-runtime-validation.ts currently reject
   ssl=false in pg_stat_ssl. For Neon, enforce actual native TLSSocket encryption,
   authorization, certificate hostname and exact target before guarded leases;
   keep database/current-user/session-user/replication-role/membership/parameter
   ACL/ownership validation. Do not remove TLS enforcement or introduce caller
   supplied success flags. A local real TLS fixture and wrong-CA/hostname/plain
   socket denials must cover the correction before provider apply.
2. stagingDatabaseConfig hardcodes environment=staging and APP_ENV=staging.
   Its attestation is dedicated-synthetic-staging. Production and development
   must use separately reviewed truthful target packets and operation scopes,
   not fabricated staging labels. Reuse source-bound migration/grant/protection
   internals behind a distinct operator boundary.
3. Ordinary local auth/environment/database parsing admits only loopback
   learli_dev/learli_test. W3 admits staging HTTPS hosted-synthetic account routes
   only, while other domain selectors retain local guards. A distinct dev-only
   local Neon application seam is required; preserve existing local/test parsers,
   synthetic identity/mail capture, loopback HTTP origin, disabled real workflow
   factories and production refusal. A DATABASE_URL replacement alone cannot
   satisfy local app connection.
4. W2's documented pooled provider is a bounded node-postgres Pool over the
   direct Neon endpoint. Its parser refuses -pooler and its cleanup uses session
   state. Retain direct transport for this bounded long-lived local app unless
   a separately reviewed transaction-pool design is explicitly supplied.
5. CLI connection strings include sslmode=verify-full plus channel_binding=require;
   parse explicitly and construct pg TLS options rather than passing a URL that
   can replace them. Preserve exact endpoint/database/role, reject arbitrary URL
   options and process-wide TLS weakening.

## Data and identity invariants

Create a schema-only Neon development root branch from the explicit production
source after GO, before any production migration or provisioning. No production
rows are copied; verify init_source=schema-only, endpoint and row counts. The
branch is retained for local use, with current tier and bounded auto-suspend
settings; do not make it production default or add services.

On each explicit branch separately, bootstrap SQL-created learli_app and a
separate learli_migrator with distinct generated private passwords and no
neon_superuser membership. API-created roles inherit elevated provider rights,
so avoid that path for runtime. Grant the migration owner only required database
and public-schema CREATE/USAGE/language rights, never grant role membership to
runtime. Preserve neondb_owner and existing provider roles. Validate effective
role attributes, all memberships, parameter ACLs, schema/database/table/function
ownership and exact accepted runtime column/table/function rights.

Only the migration owner owns new application objects/functions/ledger. Apply
exact historical SQL without rewriting, drizzle-kit push, seed or data backfill.
Both targets must have exact29 hashes/timestamps in the ledger,78 public tables,
accepted protection definitions and runtime grant parity. Existing production
row counts and all preexisting objects remain preserved; currently empty does
not eliminate the fresh preflight requirement. Stop on unrecognized schema,
ledger/hash conflict, new records, changed source or uncertain commit.

## Ordered execution after coordinator GO

1. Receive root's accepted immutable migration/runtime source, SHA256 manifest,
   review results and heavy-job lease. Import only that accepted source into own
   checkout with root permission; verify every required byte before execution.
2. Capture existing env/testenv privately and hash them. All evidence ancestors
   0700, files0600; no secret/URL argv, terminal output, Git or public artifact.
3. Repeat named production metadata/catalog inventory and record recovery point.
   Use installed /opt/homebrew/opt/libpq/bin PG18.6 pg_dump/pg_restore/psql;
   PG17 pg_dump cannot back up PG18. Full custom archive uses direct connection
   through process environment, system certificate verification and channel
   binding, with private stderr. Keep archive hash/catalog/LSN/time receipt.
   Restore only into an isolated owned target; never restore/reset production.
   A provider snapshot is optional only if availability and cost fit the current
   plan; a6h restore window is not a durable backup.
4. Create/inspect schema-only dev branch, privately retrieve credentials and
   provision separated SQL roles per reviewed bootstrap. Rehearse baseline
   archive recovery on the isolated empty dev target before migrations; compare
   catalog/role invariants. Do not use production rows for application testing.
5. Construct truthful dev-only and production-only private operation packets.
   Use accepted source-bound plan/apply internals with exact target, migration
   owner, source/journal/runtime-policy hashes, fresh schema hash, explicit plan
   hash, retained recovery receipt and captured migration statements.
6. Rehearse all migrations/grants on dev first; exact ledger/protections/grants,
   restricted runtime identity/TLS and rollback-only negative probes must pass.
   Rehearsal fixtures, if required, are synthetic dev-only and separately tracked.
7. Only after current source-bound dev rehearsal passes, recheck production
   backup/target/source/empty schema and apply once. Verify ledger/constraints/
   definitions/grants, row preservation and read-only runtime identity/TLS.
   Any transaction uncertainty stops dependent actions and routes to Recover;
   never blindly retry or reset. Production receives no seed or app smoke writes.
8. Wire only own local application to dev through the reviewed seam and private
   configuration. Keep migration URL out of runtime packet. Local app binds an
   assigned unused loopback port; auth/mail and policy-dependent workflows stay
   disabled unless the accepted explicit synthetic dev seam covers them.
   Smoke actual database-backed empty public reads and safe failure/production
   refusal, rather than data-free /api/health alone.
9. Run scoped reviewed wiring tests and required build/checks under lease on
   isolated loopback test DB only. Verify .env.test.local remains byte-identical
   and parses to the original local test target. No cloud test runner or seed.
10. Separate same-agent read-only Review, executed Verify, exact final manifests,
    private credential/URL scan, factual tracker and ignored Remember handoff.
    Root reconciles main/integration; worker does not edit either checkout.

## Required source handoff and readiness gate

Receive all29 migration SQL files, drizzle/meta/_journal.json and cumulative
metadata; scripts/runtime-grants.ts; complete scripts/staging-migrations files;
the reviewed truthful-target operator entry/bootstrap/recovery tools; corrected
db/staging-config.ts, staging-connection.ts, staging-runtime-guard.ts,
hosted-runtime.ts, hosted-runtime-validation.ts and any new transport/config
modules; accepted dev-local selector/auth/env wiring and affected consumers;
package.json/lockfile, relevant tests/config/runbooks and root source manifest.
No dependency install or build before lease. Private inspection may continue.

Readiness blockers: immutable integration source/review still pending; provider
TLS predicate correction, truthful production/dev operation packet and local
dev runtime wiring must be accepted. Existing empty schema removes data-conflict
blockers, not these software gates. Production migration user authority is already
present. No policy, deployment or live provider-mail activation is inferred.

## Evidence and context reconciliation

Private Phase A evidence: .local/neon-activation/production-sql-inventory.json,
prospective-migrations.json, provider metadata before receipts and official docs.
Credentials remain private and must never be copied into this blueprint.
Checks/build/rehearsal/migration/local-smoke status: **NOT RUN — technical gate**.
Observed provider/catalog reads are inspection, not migration acceptance.

Root/authorized implementer should update architecture, build plan, operations
runbook/env example and progress tracker only for accepted wiring and observed
activation outcomes. Policies/real-user release gates remain unchanged.
Official references: https://neon.com/docs/guides/branching-schema-only,
https://neon.com/docs/cli/branches, https://neon.com/docs/manage/roles,
https://www.postgresql.org/docs/18/app-pgdump.html.

Phase B correction: root msg_72809a666269 explicitly preserves synthetic sign-in,
account and booking previews. The synchronous dev factory uses the existing
GuardedRuntimePool allocator (no unchecked SQL), composeAccountAuth(hosted:false)
and current getAuthRuntime/getAccountAuthRuntime selectors. Only the workspace
callback type gains the local-or-Neon-development union; no async consumer rewrite.
Production operator runtime inspection is a distinct inspect-runtime purpose;
applyPlan runs only read-only runtime SQL there, with negative write/integrity
probes retained on isolated development targets. New parser/transport/operator
bytes are included in source-bound candidate identity. SQL history/grants unchanged.

Phase B observed operator compatibility correction: the native/TLS proxy rehearsal
found guarded owner search_path=pg_catalog,public makes historical unqualified
CREATE TABLE target pg_catalog. The accepted runner now sets migration-owner
search_path=public only after lock/source/plan checks and before captured SQL.
pg_catalog remains implicitly first for builtin lookup; runtime/configured
search paths, fixed SECURITY DEFINER paths, SQL bytes and grants remain unchanged.
Two failed diagnostic receipts and precise source evidence are retained in the
canonical recovery note. This correction is part of actual operator preparation.

Observed static migration data: immutable0002_launch_subjects.sql inserts eight
approved launch catalogue subjects. Production apply includes that reviewed SQL
and must disclose those rows explicitly; no seed/fixture command and no fake
user/tutor/learner/review is part of production. The original empty-production
inventory remains valid pre-apply; post-apply total application rows are not zero
because of this catalogue bootstrap. Existing original rows remain preserved.
Coordinator notified before provider GO; historical migration bytes stay fixed.

Independent Root review N1: every production apply, even pending=[] grant refresh,
requires source/target/plan-bound recovery. Production reference catalogue rows
from immutable0002 are explicitly included in migration authority; no separate
seed/fake customer records. Corrected gate/tests/runbook retain staging/development
behavior. Root recommendation for v1 is CHANGES REQUIRED until v2 acceptance.

Phase B bounded bootstrap/recovery implementation: root explicitly accepted empty
public schema ownership transfer to restricted migration owner while preserving
provider/database ownership. Matching nonsuperuser owned rehearsal established
creator ADMIN-only memberships and temporary operator SET/grantor restoration.
No new role gains any membership. Exact sequence/argv and private PG18 backup plus
development-only empty restore are in docs/operations/neon-activation.md. Recovery
must execute successfully on actual separate PG18 dev before production apply;
no role reset, seed, production restore, cost upgrade or automatic context change.
Review/provider GO remain technical dependencies, not renewed user authorization.

## Executed acceptance — 2026-10-13T10:08:59+08:00

Independent root v4 Review PASS/zero open findings and technical GO
msg_72a656970b37, bound1056-file aggregate3fad7e6a9b29b44495727a141cce8f0f6c925215a06ef267803b7a43203ae1f9.
Explicit user production migration authority applied without additional service,
policy, deployment or launch approval. PG18 production backup → separate schema-only
dev/actual empty restore → restricted dev roles/29apply → fresh empty production
preflight/restricted roles/recovery-bound29apply/read-only acceptance all PASS.
All immutable SQL/grant bytes are unchanged; production78 public tables plus29
ledger rows/eight static subjects, zero customer fixtures, original roles/owner
preserved. Only private dev runtime packet entered own local configuration;
loopback testenv byte-identical. Actual24 compiled app auth/capture/account ownership/
public/denied-preview assertions PASS, no seeded cloud role or positive cloud booking
claim. Main/integration reconciliation remains root-owned; operational activation
and local dev connection are complete in this owned checkout. Exact receipts,
archive/private files/source/evidence manifests and honest recovery history remain
under .local/neon-activation; final factual docs delta needs only scoped root review.
