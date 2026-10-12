# Controlled staging migrations and operator tooling

Status: AUTHORIZED — build-feature delegation, 2026-10-12.
Authority: user "ok lets proceed on the current wave lets do that", root dispatch task_ceba478450a4 / ctx_3a11e1a1d92f; no separate human blueprint approval.
Parent: /Users/cob/learli/prompts/features/m8-03-staging-database-foundation.md, read directly; root owns combined blueprint.
Baseline: clean 0d7f2ddba07b05a72c8a995428e29c3584224ebe, own cob-g/m8-staging-migrations worktree.

## Outcome and requirements

Operator gets inspect-config (configuration parsing only, no filesystem/database I/O in its pure primitive), explicit read-only inspect, plan, and explicit apply commands. M2.2, M8.1/3/4/8; NFR-05/06/09/11; preserve AUTH-03, BKG-02, BR-06/18. All provider checks remain NOT RUN; local code preparation only.

## Inspected reality

Seventeen unchanged SQL files0000–0016 and v7 journal; explicit learli_app grant batch in scripts/migrate-local.ts. Installed Drizzle0.45.4 hashes exact SQL text, splits statement-breakpoint, reads only last target timestamp and creates metadata before its transaction. Staging wrapper must validate the entire ordered target history before delegating, use the same checked-out client throughout, and retain honest partial receipts. SQL/journal/schema changes prohibited.

## Scope, ownership and invariants

Own scripts/staging-database.ts, scripts/staging-migrations/* supporting modules, shared scripts/runtime-grants.ts, narrow local-migration call substitution, focused unit/integration tests, docs/operations/staging-database.md and this child blueprint. Root owns package/config/dependencies/canonical documents except append-only truthful own tracker evidence. No application auth/env/URL changes, provider/production operations, seed/reset/down/drop, new dependencies, commit/push/merge, peer or main database use.
Consume root-accepted Builder A stagingDatabaseConfig/openStagingConnection exact interface; never implement second production connector. A owns target/config/TLS/identity/runtime role gate. Root msg_328afea09dd7 accepts one withClient callback spanning session advisory lock, revalidation, Drizzle(client), grants and verification. Loopback test adapter exists only in tests and uses owned isolated PG55702; normal suites use owned55602 sequentially.

## Plan and failure behavior

1. Extract grant text byte-identically; existing local command behavior/grants unchanged.
2. Pure journal inventory validates contiguous indexes/tags, increasing unique timestamps and SQL files/hashes; bounded fixed candidate digest includes journal, SQL, grant policy and runner source identity. Keep captured migration statements immutable in memory for execution.
3. Read-only transaction inspects exact current database/session user, schema shape/history and migration prerequisites. Empty database has no application objects/history; unknown/divergent/newer/non-prefix histories fail closed. Existing application schema requires known history and ownership. Runtime role must exist before chain; extension/function language prerequisites and owner rights checked, no widening fallback.
4. Serializable plan data binds target fingerprint, source candidate, prior complete ordered history, empty/populated classification and pending entries; hashed plan requires explicit exact expected digest on apply. Populated apply additionally requires private target/plan-bound operator recovery attestation with restore-point/verification references; these are attestations, not observed provider evidence.
5. Acquire session pg_try_advisory_lock; recheck target/history/schema and candidate under lock, refuse stale plan/concurrent runner. Use captured Drizzle migration inputs on same client; refresh unchanged grants and verify effective table/column/function parity. Runtime rollback-only probes use separate restricted credentials. Stop after failed stage.
6. Close both lifecycles and release lock even after errors. Fixed bounded receipt exposes only categories/hashes/counts/stage outcomes, never URLs, SQL/errors/private rows. Migration metadata creation, committed migrations, committed grants and runtime-probe outcome remain separate; failure may require inspection/recovery, never auto retry/reset.

## Verification plan (NOT RUN during Architect)

Pinned npm ci; hash pins/SQL/journal. Unit tests for journal/hash/order validation, history divergence/newer, plan/target/candidate binding, malformed plan/recovery and bounded privacy. Discovered normal integration test owns separate disposable loopback cluster on55702 with no production gate bypass: fresh chain, populated0015 upgrade and exact synthetic row preservation, no-op rerun, stale hash/target/history, concurrency lock, required-role/preflight failures, injected migration/grant failure, cleanup and actual effective grant parity/runtime denials. Full npm run check, normal real-PG suite including auth/bookings/grants on55602, sequential production build through test wrapper. No UI/runtime application edits: browser expansion not needed; preserve local remote refusals and hosted preflight BLOCKED in existing tests. Independent combined review remains root-owned. Neon/TLS/privileges/migrations/transactions NOT RUN; A supplies local real-TLS harness evidence.

## Documents and remaining gates

Staging operator procedure with explicit private files, named-target packet, exact reviewed candidate, expected mutations, backup/recovery prerequisites, stop conditions, separate authorization and provider NOT RUN list. Propose root updates to architecture/build plan/deployment runbook/README/.env.example/package scripts. Human operator/resource identifiers/budget must be supplied before provider execution; do not invent them. Local Review/Verify/Remember evidence records scope independently from parent integration acceptance.

## Root-authorized verification repair scope

Root msg_56ce42bbfeab / msg_f2887788a6e9 expands B ownership only to tests/integration/booking-read.test.ts for the confirmed clock-dependent synthetic default-slot collision with its fixed DST reservation. Reserve that fixed interval in the default fixture helper; advance its unique-day counter for every skip. Preserve fixed DST instants and all assertions/constraints, app source/booking policy unchanged. Retain full failing run, rerun affected29 cases and required local regressions; root also owns fresh combined suite. No separate product decision or human blueprint approval is claimed.

Root msg_db0599b6cc41 / msg_75aee87fa17b supersedes the incomplete default-slot skip with per-case fixed-DST tutor/profile isolation. Optional test-only profile override, existing real synthetic verified provisioning and assigned-tutor headers preserve exact DST/read assertions; original unrelated tutor denied. Ordinary date helper restored. This authorization remains confined to the inherited test fixture file; earlier passes/failures retained.
