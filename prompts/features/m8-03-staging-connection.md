# Implementation Plan — Secure staging connection boundary

Status: **AUTHORIZED — build-feature delegation**.
Date: 2026-10-12. Baseline: `0d7f2ddba07b05a72c8a995428e29c3584224ebe`, clean.
Authority: user “ok lets proceed on the current wave lets do that”, dispatched
Builder A scope and root accepted API msg_929590b72742. Root canonical blueprint:
`/Users/cob/learli/prompts/features/m8-03-staging-database-foundation.md`.
No separate human blueprint review is claimed. Architecture stage only.

## What we are building

Separate Node-only configuration and pg/Drizzle lifecycle for an explicit operator
attested isolated Neon staging resource. NFR-05/06/09/11; M2.1, M8.3/8.8.
APP_ENV must be staging. Exact project/branch/endpoint/host/database/roles/purpose
binding occurs before I/O. Record labels are operator attestations, never provider
ownership proof. External resource verification and operation authorization remain
separate gates. Existing local adapter/auth/seed/migrate/restore/test behavior stays.

## Decisions and inspected evidence

Installed pg8.23.1 uses connectionString fields to override SSL objects; parse only
safe fields into explicit settings. Drizzle0.45.4 supports a single PoolClient.
Installed pg-pool supports async onConnect, allowing validation before use.
Root accepts API v1 in ignored `.local/staging-database-wave/interface-v1.md`.
Public config contains safe target/purpose/role metadata; passwords live privately.
Runtime role is exactly learli_app; owner role is separate and record-bound.
Runtime checks reject dangerous role flags, every inherited/SET-role membership,
database/schema creation and ownership of application database objects. B owns
exact table/function grant parity and migration-owner extension compatibility.
Pool max5, connection timeout3s, idle10s; verified certificate/hostname TLS;
no connectionString or arbitrary CA/SSL hooks at the production entry point.
withClient keeps the entire migration lock/recheck/migrate/grants operation on
one validated client and destroys the client after callback to avoid session leaks.
The lifecycle exposes only withClient/close: no pooled db escape. B constructs
Drizzle on that same client. Driver/callback failure details must be sanitized
at the operator boundary.

## Scope and ownership

A: new staging-config.ts, staging-connection.ts, narrowly named internal helper
if required, tests/unit/staging-config.test.ts, tests/integration/staging-connection.test.ts,
test-only helper under tests/support, this child blueprint and truthful tracker
append. No migration/schema/dependency/shared config/app auth/local-config edits.
Root owns shared scripts/env examples/configs and canonical documentation updates.
No Neon/provider calls, deployment, mail, commits, pushes, merge or real data.
Ports: local PG55601, TLS PG55701, dev3071, test3171; verify bind availability.

## Workflow and failure states

Parser rejects absent/malformed/extra record fields, non-staging environment,
wrong role/db/host/endpoint/purpose, pooled or arbitrary endpoints, unsafe URL
options/duplicates/fragments. Errors have fixed categories without raw causes.
Opaque registration prevents forged or mutated settings. Opening validates TLS,
current/session user and database through read-only SQL. Runtime privileges are
checked before handing connection to callers. Initial failures close the pool;
close is idempotent and withClient always releases/destroys its owned client.
No automatic migration or external side effect on import/configuration parse.

## Implementation sequence

1. Save accepted API/blueprint, verify exact pins, npm ci without changing lock.
2. Implement pure config/target validation plus opaque secret storage.
3. Implement bounded pg lifecycle and read-only identity/runtime probes.
4. Author discovered unit and real loopback PostgreSQL TLS tests. Private generated
   CA/server keys and owned TLS cluster remain ignored; only test mocks supply local
   settings/CA. Production never exports a test connection entry point.
5. End implementation, read-only same-agent Review; separate Verify; Recover on
   actual defects, repair then re-review/rerun. Root performs independent combined review.
6. Record precise evidence/hash manifest and ignored memory; hand off source to root.

## Verification plan — NOT RUN (Architect)

Pinned npm ci/hash, relevant discovery, npm run check, existing real PostgreSQL
regression suite, production build sequentially in this owned checkout. New TLS
suite establishes trusted success and actual rejection of untrusted/expired/
hostname mismatch certificates, safe failures, callback cleanup, runtime flags/
memberships/ownership and single-client session identity. Test fixtures owned and
cleaned; no arbitrary retries/weakened assertions. Pure tests prove malformed/unsafe
URLs and local remote-refusal guards. No UI change: browser/manual visual tests
not applicable unless shared runtime changes. All actual Neon/provider identity,
TLS, role/migration evidence is NOT RUN; root owns provider rehearsal packet.

## Context proposals and risks

Root reconciles architecture/build-plan/deployment docs to describe separate staging
capability while hosted auth/email/release stays blocked. Tracker records only
observed worker results. Known thirteen dependency advisories remain, no waiver.
No resource/operator/budget selected for provider operations; none needed locally.
No changes to safeguarding/commercial/booking policies. Blueprint ready.

## Coordinator refinement — 2026-10-12

Root msg_d32e7ef5fed5 authorizes test-only `LEARLI_STAGING_TEST_PORT`, strict decimal
integer1024–65535, default55701 here. Combined root checkout uses55703 sequentially.
This is confined to tests/support and cannot alter production target/TLS settings.
Root msg_065d093a4b5d owns shared CI PostgreSQL17/OpenSSL tool preparation; actual
remote CI is NOT RUN. These refinements preserve the accepted connection API.
