# Neon schema activation and local development

This operator boundary supports the explicitly authorized production schema
migration and separate local development branch. It does not enable a production
application, real participants, live mail, payments or deployment. The existing
staging parser/commands and ordinary local/test setup retain their contracts.

The deliberate `npm run neon:database -- inspect-config|inspect|plan|apply`
commands use the existing source-bound Drizzle runner and exact grants/protection
checks. Supply private `--config` and `--target` files under this checkout's
0700 `.local` tree, with0600 regular files. Plan requires `--out`; apply requires
`--plan` and `--plan-hash`, plus `--recovery` for every production apply (including empty/up-to-date targets)
and for populated development/staging migrations. No implicit
Neon context, dotenv loading, schema push, branch creation, bootstrap or seed runs.
URLs never belong in arguments or terminal output. Inspection/configuration
attestations must correspond to observed provider metadata and actual operation
approval, not fabricated staging labels.

The production/development target includes version1, provider neon, truthful
environment/project/branch/endpoint/hostname/database, runtimeRole learli_app,
migrationRole learli_migrator, bootstrapRole neondb_owner, approvedPurposes and
operatorApproval. Production uses isolation production-schema-operation and its
own sourceBranchId; development uses schema-only-development and a different
explicit source branch. Production rejects runtime purpose; inspect-runtime is
metadata-only and cannot enter an application factory. Exact direct endpoints
and role/database URL matching, system certificate and hostname verification,
channel binding and process TLS guards apply. Node's native pg Client/TLSSocket
is checked before every lease; backend pg_stat_ssl is diagnostic because Neon's
proxy terminates client TLS. A caller's ssl=true assertion grants nothing.

Operator configuration contains only APP_ENV, NEON_RUNTIME_INSPECTION_URL and
NEON_MIGRATION_URL. Production acceptance uses read-only runtime queries; negative
write/integrity probes run on isolated development targets. Source identity binds
SQL, journal, grant policy, runner, operator and transport/parser bytes. Refuse
unrecognized schema/ledger, changed source/plan/target, unsafe runtime role or
uncertain commit. Preserve receipts and enter Recover; do not blindly retry/reset.

Before provider apply, independently review the exact source, rehearse it on
schema-only dev and retain a real backup/recovery receipt. PostgreSQL18 targets
require pg_dump18 or newer, with direct verified TLS and private process env.
Installed local tooling is /opt/homebrew/opt/libpq/bin/pg_dump, pg_restore and psql
18.6. Do not use the local PG17 backup script for cloudPG18. Provider history
retention is bounded and is not a durable backup. Never restore/reset production
without its separate authority. Runtime roles created through Neon APIs inherit
neon_superuser; use reviewed SQL-created runtime/migration identities instead.
No branch role/password or schema mutation follows merely from this runbook.

## Local app on isolated Neon development

Keep the default `DATABASE_MODE=local` and unchanged `npm run local:setup` for
loopback development/tests. The explicit alternative uses APP_ENV=development,
AUTH_MODE=local, DATABASE_MODE=neon-development, loopback HTTP APP_URL and matching
BETTER_AUTH_URL, the existing strong BETTER_AUTH_SECRET, and an absolute
NEON_DEVELOPMENT_CONFIG_FILE under this checkout's private `.local` tree.
DATABASE_URL/DATABASE_URL_DIRECT, hosted ingress/config and Resend credentials
must be absent. `.env.test.local` remains byte-identical on its original loopback
learli_test target; never run test/setup/seed/restore scripts against cloud URLs.

The private runtime packet has exactly version1, purpose local-neon-development,
realWorkflows disabled, databaseUrl for learli_app, and the observed schema-only
development target. No migration/bootstrap URL belongs in the packet. The factory
reuses existing synthetic `.test` account admission, Better Auth/MFA and local
captured email. All SQL passes the same guarded native pool validation; allocation
is synchronous and performs no unchecked network query. Current selector callers
need no async rewrite. Existing domain authorization/ownership and disabled real
policy factories stay intact. A changed mode/packet/cryptographic/origin fingerprint
requires a process restart; failures never fall back to migration/local credentials.

Start using ordinary `npm run dev -- --port <assigned-free-port>` with that private
configuration, or the reviewed local Node start command after a build. No startup
migration/seed or cloud service is added. A data-free health result alone is not
connection proof: smoke actual public catalogue reads, synthetic auth/capture and
private owner/foreign denials on the separate dev branch. Production app selection
and real policy activation are always refused by this seam. Existing local-only
owner fixtures/notice/restore tools keep their loopback guards.

Relevant references: [pg SSL](https://node-postgres.com/features/ssl),
[Node24 TLS](https://nodejs.org/docs/latest-v24.x/api/tls.html),
[Neon SQL roles](https://neon.com/docs/manage/roles),
[schema-only branching](https://neon.com/docs/guides/branching-schema-only),
[PostgreSQL18 dump](https://www.postgresql.org/docs/18/app-pgdump.html).
Executed results and exact source belong in the tracker/private activation report;
this runbook is not an activation or launch acceptance claim.

## Exact bounded bootstrap and recovery sequence

The accepted empty production precondition is rechecked before backup/bootstrap:
no application tables, migrations, custom functions/enums or existing Learli roles;
public is owned by pg_database_owner/neondb_owner and the database remains owned
by neondb_owner. A conflict refuses the operation. Bootstrap is never a role
reset or an idempotent password overwrite. The two generated SQL identities are
independent LOGIN/NOINHERIT with no elevated attributes and no memberships.
CREATE ROLE gives its creator ADMIN-only membership; temporarily permit only
neondb_owner to SET learli_migrator, transfer the initially empty public schema,
SET that restricted owner to revoke PUBLIC/create runtime USAGE, RESET, and
remove the temporary self-grant (or restore its original SET option if the
creator grantor was itself). Exact original grantor/ADMIN/INHERIT/SET are checked
before commit. Database and provider roles/ownership remain preserved.

After separate coordinator provider GO, use the frozen reviewed checkout; every
command below takes file paths only. Capture CLI stdout/stderr privately, inspect
only sanitized metadata, and do not choose defaults/context or print credentials.

1. Re-read explicit project/production branch/endpoint/database/role metadata.
   Retrieve direct neondb_owner URL into a0600 private file via subprocess output,
   create observed production target/config files, verify source manifest and all
   29 immutable SQL hashes. No production application credentials enter local env.
2. Run `node --import tsx scripts/neon-recovery.ts backup --config <private-prod-owner-config> --target <private-prod-target> --out <new-private-backup-directory>`.
   PG18.6 custom dump uses explicit private libpq process env, verify-full/system
   trust/channel binding, no URL/password arguments, no owner globals/password
   dump, no tool details printed. It verifies empty schema before/after, no TABLE
   DATA entries, SHA256, actual branch WAL LSN/time and reviewed candidate identity.
   Keep the preceding sanitized provider/role/schema ACL inventory with this dump.
3. Create ONLY the user-requested schema-only dev branch from explicit production:
   `neon branches create --project-id withered-grass-51575984 --parent br-bitter-hat-az6vm3mg --name learli-local-development --schema-only --no-secrets --output json`.
   Keep inherited/default compute sizing and autosuspend; no upgrades/extra service,
   Auth/Data API, production default/context switch or resource deletion. Observe
   returned branch/endpoint and explicit SQL inventory; all real rows must be zero.
4. Retrieve that branch's direct operator URL privately and create its observed
   development target/config. Restore the empty original backup ONLY there:
   `node --import tsx scripts/neon-recovery.ts restore-empty --config <private-dev-owner-config> --target <private-dev-target> --production-config <private-prod-owner-config> --production-target <private-prod-target> --backup <private-backup-directory> --out <new-private-restore-directory>`.
   Hash/candidate/source/project/branch checks, no-owner/no-acl single transaction,
   no clean/drop/reset. Production restore is always refused. Require actualPG18
   restore receipt; localPG17 tests do not substitute for this cloud rehearsal.
5. Create0600 reserved credential output containing only version1/status reserved;
   run `node --import tsx scripts/neon-bootstrap.ts --config <private-dev-owner-config> --target <private-dev-target> --credentials-out <private-dev-credentials>`.
   Credentials are durably retained before DDL commit using an already validated
   private regular-file descriptor; uncertain commit retains evidence and stops.
   Inspect exact role/membership/schema/database ownership, build private operator
   runtime/migration config, run inspect/plan/apply via neon:database. Rehearse all
   exact29 migrations/grants/protections/nativeTLS plus negative/synthetic workflows
   on this separate development branch; no seed/fixture/reset scripts.
6. Refresh explicit production inventory and source hashes. Bootstrap production
   through the same reviewed script/private reserved output, inspect exact identities,
   then create production-specific plan. Bind recovery JSON to its actual targetHash
   and planHash, durable dump/WAL reference, actual successful development restore,
   operator authorization. Run one deliberate apply with both hashes/recovery.
   Migration0002 contributes eight static subject catalogue rows, separately
   disclosed immutable reference data; no fake customer/tutor/learner/review rows.
   Production runtime validation/read probes stay read-only. Inspect29 exact ledger
   hashes, constraints/trigger bodies, grants, original provider/database owner and
   original row counts afterward. Any uncertainty enters Recover without retry.
7. Create runtime-only private dev packet, wire ONLY this reviewed checkout's
   .env.local using existing local synthetic AUTH_MODE, DATABASE_MODE neon-development
   and its loopback origin. Keep .env.test.local bytes/hash and loopback target.
   Run reviewed compiled local app/public catalogue/synthetic auth and ownership
   smoke against dev. Root owns integration/main reconciliation; older main preview
   remains its preserved local database until the reviewed wiring is reconciled.

The production dump intentionally excludes role passwords/global provider roles;
retain pre/post sanitized catalogue/ACL inventory and privately generated identities
alongside it. The exact point-in-time branch reference is a bounded six-hour Neon
recovery option, not a durable dump substitute. A future production restore, role
removal, schema rollback or provider branch reset requires its own operation
review/authorization and never runs from these helpers. A failed bootstrap/apply
is not permission to reset roles or reapply a divergent ledger.

Credential SQL/logging boundary: before password generation/retention, bootstrap
refuses statement/duration/sample/debug logging, nonzero error parameter logging,
or optional nested query/audit/auto-explain tracing. Passwords are separately bound
into a transaction-local custom setting; CREATE ROLE runs inside constant
password-free DO text with an inner fixed-error handler that discards private
utility SQL/context. Clear the setting on success; rollback/destroyed lease on
failure. No privileged logging parameter/role grant is added. Observed operator
settings must satisfy the guard; a refusal is a technical compatibility blocker,
never permission to expose credentials or silently weaken this boundary.

The inner fixed-error handler explicitly includes QUERY_CANCELED and ASSERT_FAILURE
as well as OTHERS (which PostgreSQL excludes by default). Actual owned role-catalog
lock/cancellation proof preserves production statement_timeout10000 and rolls back
all new roles; cancellation cannot bypass credential SQL/context scrubbing.

## Observed activation — 2026-10-13T10:08:59+08:00

The reviewed sequence completed against the explicitly identified project and
production branch, with a separate `learli-local-development` schema-only branch.
PG18.6 production custom backup and actual empty development restore passed before
provisioning. Each branch now has29 exact reviewed migrations/grants/protections;
production has78 public tables, the29-row Drizzle ledger and eight static subjects,
with zero rows in all other application tables. Original provider roles/database
ownership were preserved; SQL-created runtime/migration roles have no elevated
attributes or memberships. Metadata/grant/protection/runtime transport acceptance
is recorded separately from provider metadata. No seeded fake production records.

The reviewed worker checkout's local app is connected ONLY to development on
loopback3039. Its24 actual smoke assertions preserve synthetic account/capture,
account ownership/foreign denial and real-email refusal. Positive cloud booking
was not exercised: ordinary new accounts retain no workspace role, so the booking
preview correctly refuses them; no cloud fixture role/tutor/learner was seeded.
Positive preview regression remains the distinct owned local TLS verification.
The byte-identical testenv remains loopback55939/learli_test; main3000 preview was
preserved independently. Root owns later source/private-env reconciliation into
main. Private evidence/archive/credentials stay in ignored0700/0600 storage.
No deployment, live mail, real participant/payment/policy activation or database
reset follows from these observed schema/local-development results.
