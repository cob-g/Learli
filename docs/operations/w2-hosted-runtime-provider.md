# W2 pooled hosted database provider

This provider prepares M2.1/M8.3 on the existing staging-only target boundary.
It does not activate application routes/auth, provision a provider, migrate,
send email or authorize real accounts, production, payments or deployment.
Blueprint: `prompts/features/m8-03-w2-hosted-runtime-provider.md`,
**AUTHORIZED — build-feature delegation**. Root owns shared integration.

## Consumer contract

```ts
const runtime = await createHostedRuntimeDatabase(runtimeConfig);
// runtimeConfig is the exact opaque object from stagingDatabaseConfig.
await runtime.db.transaction(async (tx) => {
  // One verified leased client for the complete transaction.
});
const client = await runtime.pool.connect();
try {
  await client.query("SELECT 1");
} finally {
  client.release();
}
await runtime.close();
```

The factory accepts only staging runtime-purpose config for restricted
`learli_app`. It reuses the target parser's direct endpoint, strict certificate
and hostname TLS, bounded five-connection pool and driver timeouts. No runtime
URL/env/parser fallback, migration identity, arbitrary CA/pool injection, local
fixture flags or provider provisioning is exported. Operator target attestation
does not replace actual authorized provider ownership/isolation verification.

`HostedRuntimePool` is a bounded interface, not the raw pg Pool: SQL string/config
queries (including values, named queries and array rows) with promises/callbacks;
promise/callback checkout; end/close; read-only counts/status; sanitized error
events. Returned leases support queries, release and sanitized error events.
Raw driver options, transport, client-bearing pool events, Submittable/cursors,
COPY and operator tools are outside this contract. `db.$client` is the same
guarded adapter. Local fixture tools retain their original separate raw-pool API.

Installed Drizzle0.45.4 recognizes the internal normal named `GuardedRuntimePool`
adapter through its documented-in-source constructor-name branch in session.js.
Its constructor name is explicitly preserved for server bundle minification.
Its TypeScript signature expects full Pool, so the one driver compatibility cast
targets only this guarded adapter. It never passes a private native client/pool.
Reverify actual transaction identity/rollback/locks on a driver upgrade.
References consulted 2026-10-12: [pg Pool API](https://node-postgres.com/apis/pool),
[pg transactions](https://node-postgres.com/features/transactions),
[Drizzle PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql).

## Verification and cleanup behavior

Each checkout verifies current database/current user/session user, actual TLS,
origin trigger enforcement, role login/safe attributes/all memberships,
database/schema creation and ownership, application table/function ownership,
effective parameter ACLs (direct/PUBLIC), and non-origin applicable role/database
catalog defaults. Catalog defaults are checked even if an old connection retains
safe startup values. No app query or transaction callback runs on rejection.
The initial factory probe uses the same checkout path; failure closes its pool.

Normal `release()` immediately invalidates the lease for further queries, then
keeps its native session borrowed until asynchronous rollback/reset completes.
Unfinished transactions, role/session settings, cursors, listeners, advisory
locks and temporary/session sequence state are cleared. Named prepared statements
remain to match pg's cached names; DISCARD ALL is deliberately avoided.
`release(true)` or `release(error)` destroys instead; release twice throws a fixed
cleanup error. Query failures preserve only fixed messages and bounded SQLSTATE/
constraint names needed by existing conflict helpers, never raw driver details.
Pool queries automatically clean their lease; explicit borrowers use finally.
Close is idempotent and drains outstanding borrowers; an unreleased explicit
borrower prevents shutdown, following pg lifecycle semantics.

Verification is a per-checkout observation. A privileged operator can change
catalogs while a legitimate lease is in flight; this adapter is not a substitute
for the operation policy or SQL least-privilege grant review. Exact migration/
table/function grant parity remains the staging inspection/migration foundation's
gate. No new grant policy is introduced here.

## Drift and failure response

Stop dependent requests on fixed staging validation errors, check the exact named
target and reviewed privileges through authorized operator tooling, and restore
the approved state deliberately. Do not grant additional rights, change TLS,
switch to migration credentials, fallback to local DB or reset history.
Rejected checkouts and failed cleanup remove their session; a later checkout
can recover after verified operator repair. Idle driver errors are sanitized and
consumed safely; borrowed-session/cleanup failures also forward only sanitized
errors to pool monitoring. Callers may subscribe to bounded error monitoring.

Rollback of unused W2 code is removing its imports/new files; no migration or
stored-data rollback exists. Root integrates auth/environment routing separately.
Local verification and exact source hashes belong in the worker report/tracker;
actual authorized Neon checks and hosted/auth browser journeys remain separate.

## Local evidence commands

Use checkout-owned local database55902/app3092/test3192/TLS56002 and check port
availability before setup. Existing discovery globs include both W2 test files.
The TLS fixture uses private module substitution of stagingPoolConfig inside
Vitest; production never imports the test helper or has a test switch. Heavy
checks run sequentially under the coordinator's allocated lease.

```sh
LEARLI_DB_PORT=55902 LEARLI_DEV_PORT=3092 LEARLI_TEST_PORT=3192 npm run local:setup
node_modules/.bin/vitest run tests/unit/hosted-runtime.test.ts tests/unit/staging-config.test.ts
LEARLI_STAGING_TEST_PORT=56002 npm run test:integration -- tests/integration/hosted-runtime.test.ts tests/integration/staging-connection.test.ts
npm run lint
npm run typecheck
node scripts/with-test-env.mjs npm run build
```

No UI changes: Playwright/phone/desktop checks are NOT APPLICABLE to W2.
Shared integration owns actual hosted application/auth journey verification.
