# Implementation Plan — W2 pooled hosted database runtime

Status: **AUTHORIZED — build-feature delegation** for the dispatched W2 scope;
guarded public pool contract refinement authorized by coordinator reply to the
W2 contract question on 2026-10-12 (record retained in private report).
Date: 2026-10-12. Baseline: `2fa0294c5e6cad895754b3c10a703a6c6f6ef00a`, clean.
Branch: `cob-g/m8-hosted-runtime-foundation`.
Repository: `/Users/cob/orca/workspaces/learli/m8-hosted-runtime-foundation`.
Authority: dispatched task `task_b3b956915365`, dispatch `ctx_744e40c196bb` asks
to use build-feature for W2 of the authorized eight-workstream readiness wave.
This records delegated execution authority, not separate human policy approval.

## Outcome and trace

Prepare a reusable pooled Drizzle runtime on the existing safe staging boundary.
M2.1/M8.3; NFR-05/06/11. Ordinary application/local test routing is unchanged.
Read AGENTS.md and its eight canonical context files, ORCHESTRATION-LESSONS.md,
the staging preparation decision and staging foundation/connection blueprints.
The existing local adapter creates pg+Drizzle on loopback; the explicit staging
operator adapter deliberately destroys a client after each callback. Neither is
a hosted application runtime today. Installed pg8.23.1 and Drizzle0.45.4 remain.

## Language, decisions and scope

Pooled means a bounded in-process pool on the existing approved direct endpoint,
not a new provider pooler. Staging means the existing opaque operator-attested
dedicated synthetic target, not production or a label proving provider ownership.
Factory accepts only a parser-issued runtime config. No arbitrary pool/URL/CA,
fallback parser, migration identity, env loading or exported synthetic bypass.

Authorized refinement: keep the native pool private and expose a guarded bounded
pool façade. Native pool events expose unverified clients, mutable driver settings
and Submittable objects expose raw transport, so a full raw Pool is unsafe.
Support SQL string/config query promise/callback forms, connect promise/callback,
release, end/close, read-only counts and sanitized errors. Exclude native client
events/options and Submittable/cursor/COPY transport APIs. Drizzle must recognize
the façade as a pool and keep a transaction on one leased connection.

Ownership: new `src/lib/db/hosted-runtime.ts`,
`src/lib/db/hosted-runtime-validation.ts`,
`tests/unit/hosted-runtime.test.ts`,
`tests/integration/hosted-runtime.test.ts`, this blueprint and distinct W2
operation/recovery files. Append only a bounded own-checkout tracker entry.
Root owns environment/auth/routes/shared integration and canonical reconciliation.
API: `createHostedRuntimeDatabase(config: StagingDatabaseConfig): Promise<{
db: Database; pool: HostedRuntimePool; close(): Promise<void> }>` and
`verifyRuntimeLease(client: ClientBase, config: StagingDatabaseConfig): Promise<void>`.
The internal named pool adapter follows installed Drizzle's constructor-name
recognition branch; no prototype spoofing or public native-pool injection.
No migrations, schema, grant policy, packages/lockfile, test discovery or peers.
No nested workers, commits, pushes, merges, cloud/Neon/Resend/Railway calls,
real users, payments, production operations or worktree cleanup.

## Invariants and failure behavior

Before each checkout (new and reused), verify actual database, current/session
role, TLS, origin replication setting; safe login role flags, every membership,
database/schema creation and schema/table/function ownership; effective parameter
ACLs including PUBLIC and unsafe replication defaults in role/database catalogs.
Use pg_catalog-qualified validation queries. Only verified leases reach app SQL.
Any rejected checkout destroys its native client. Initial failure closes the pool.
No raw errors, DSNs/passwords or raw transport appear on public errors/events.
SQL failures retain only bounded SQLSTATE and constraint names for existing
transaction/conflict handling. A released façade cannot issue later SQL.

Normal release asynchronously rolls back unfinished work, resets session state
and clears advisory locks/temp state before returning the native client to idle;
failure or requested destroy removes it. Named prepared statements must remain
compatible (do not DISCARD ALL while pg retains its prepared-name cache).
Close is idempotent and drains borrowed leases; borrowers must release in finally.
No schema/data authorization changes. Guard checks cannot prevent privileged
operator changes made after verification while a lease is in flight; documented
operator drift response is stop/recover, never grant escalation or fallback.

## Implementation sequence

1. Resolve exact guarded contract with root and save authority in this blueprint.
2. Implement read-only lease validation and private pooled lifecycle/façades.
3. Author glob-discovered unit and owned TLS PostgreSQL tests, with test-only
   module substitution of stagingPoolConfig as in existing staging tests.
4. End implementation; same-agent read-only Review; separate executed Verify;
   Recover for real failures, preserve failures and rerun affected checks.
5. Freeze API/file hashes for W3/root consumption, record report and Remember.

## Verification plan — NOT RUN (Architect)

Unit: forged/non-runtime config, TLS weakening, promise/callback rejection,
query objects, no raw pool/client exposure, use-after-release, cleanup failures.
Real TLS PG: verified identity/reuse; Drizzle single-client commit/rollback/nested
transaction and locks/two-client concurrency; reused privilege/membership/
ownership/parameter/default drift denies before app SQL; invalid issuer/expired/
hostname certificates; bounded connection failure and zero leaked sessions.
Formatter, lint, strict types, scoped unit/integration checks and production
build through actual repository scripts. Existing local/operator adapter
regressions are scoped checks, not gratuitous whole-suite repetitions.
No UI: browser/responsive/Playwright NOT APPLICABLE. Hosted/auth browser journeys
belong to integration, actual provider checks remain NOT RUN.

Ports: own local55902/dev3092/browser3192/TLS56002. Check unused before starting;
supported LEARLI_* vars only, do not borrow main env/data or default55432.
Heavy slot A allocated by root msg_dd7041f913ed for sequential install/setup/
verification; no concurrent heavy jobs in this checkout. Raw/private evidence
belongs under ignored `.local/hosted-readiness-wave/`.

## Docs, risks and rollback

Root reconciles architecture/build plan only after accepted provider integration;
worker operation doc explains the bounded API and drift/cleanup semantics.
Tracker records exact observed outcomes, not complete M2/M8 or hosted readiness.
Remove new unused provider imports/files to roll back code; no database migration
or data rollback is introduced. Real policy/launch gates remain untouched.
Known inherited dependency advisories remain unwaived. Coordinator contract
refinement is resolved; the parent blueprint will be reconciled when delivered.

Blueprint ready.
