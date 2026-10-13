# Daily local development

The primary checkout uses synthetic accounts and the separate
`learli-local-development` Neon branch. Automated tests use the checkout-owned
loopback PostgreSQL `learli_test` database on port 55432. Production is not an
application or test target. Real workflow policies and payments remain disabled.

## Start and verify

Use the pinned Node 24 and npm 11 versions from the repository:

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:3000>. Account email is captured locally, not delivered.
`npm run mail:open` opens the private development capture directory. Use only
fictional `.test` identities. New accounts receive no administrative authority;
test roles must be explicitly provisioned by owned fixture tooling.

The ignored `.env.local` selects `APP_ENV=development`, `AUTH_MODE=local` and
`DATABASE_MODE=neon-development`. Its private runtime packet contains only the
restricted development runtime connection; no migration credential belongs in
the app environment. The packet is currently retained under
`.local/development-readiness/recovered/`. Do not publish that directory.

The former loopback development settings are backed up under
`.local/development-readiness/baseline/`; the old local development database is
preserved. Changing source branches does not change database schema. Do not switch
back to that older database until its migrations are deliberately reconciled.
`local:setup`, `db:migrate` and `db:seed` are the original loopback-development
commands, not Neon setup commands. The old `.local/fixtures.json` belongs to the
former local database and is not a source of Neon login credentials.

## Automated tests

Stop competing build/browser jobs before checks that share generated output or
the test database. `.env.test.local` remains independent of `.env.local`.

```sh
npm run db:start
npm run db:migrate:test
npm run check
npm run test:integration
npm run build
npm run test:e2e
```

The regular suites retain their loopback-only guards. Never replace their database
URLs with a Neon or production connection. The separate Neon acceptance exercise
uses explicit development target validation, owned synthetic fixtures, actual
application requests and private evidence. It does not run the normal resetting
test suite against the cloud database. See the progress tracker for executed
checks and remaining acceptance work; these command examples are not pass claims.

## Verified preparation, 2026-10-13

- The owned test database advanced from 22 to 29 migration stamps. A private
  custom backup was taken first; every prior row and column value in its 44
  baseline public tables matched immediately after migration. Subsequent tests
  intentionally operate on synthetic test fixtures.
- `npm run check` passed: formatting, lint (one pre-existing warning), types and
  1,338 unit/component tests in 84 files. Nine selected PostgreSQL suites passed
  198 tests: auth, learners, learner creation, bookings, booking reads/lifecycle/
  meeting links, availability and public availability.
- The production build and offline Drizzle/Better Auth generation passed. Drizzle
  found no schema changes. The dependency worker separately passed 17 direct
  legacy-loader checks with caching disabled, including TS/TSX, dynamic imports
  and source maps.
- Actual Neon development acceptance combines 43 successful core assertions in a
  retained failed run and 24 assertions in a successful targeted follow-up, with
  overlap. It covers synthetic identity/learner/tutor setup, positive reservation,
  idempotency, concurrent overlap prevention, reschedule/cancel history, independent
  College booking, private-link access and foreign read/mutation denials. Browser
  booking rendering passed at 390/1440 pixels; public tutor privacy/mobile checks
  passed in the follow-up. This is not 67 unique tests or full PRD acceptance.
- Both workers used GPT-6.1 SOL High effort. Independent scoped reviews found no
  remaining implementation finding after the README/local-guide correction;
  verification is recorded separately from review.

Private evidence lives under `.local/development-readiness/`: `check.log`,
`integration.log`, `build-1.log`, offline generation logs, dependency-worker
results, migration preservation reports and acceptance attempt reports. Synthetic
account credentials remain in private `acceptance-*/identities.json` files; these
are not public demo credentials. The acceptance tutor was suspended after checks,
so its temporary public listing is intentionally absent afterward.

Earlier attempts are preserved: fixture-connection failures, one generic app
sign-in 503, a response-shape mistake in the helper and browser observation races.
Later targeted checks succeeded; the transient connection/503 cause is not proven
fixed. Fixture retries run only before a SQL callback starts. No application guard
or timeout was weakened. Investigate recurring availability failures instead of
using production credentials or blindly repeating uncertain writes.

The broader Firefox/WebKit coverage gap, real-user policy activation, production
authentication, live email and deployment remain separate work. Payments remain
paused. The owner subsequently authorized publication: the reviewed source was
committed as `5e0e9d1`, merged into main as `3d4db95`, and pushed with an exact
remote-ref readback. That Git operation performed no additional database work.

## Dependency maintenance, 2026-10-13

A scoped npm override moves `@esbuild-kit/core-utils` from esbuild 0.18.20 to
0.25.12, a version already used by the pinned Drizzle Kit. The obsolete build-script
allowance is removed; direct framework, auth, ORM and UI package versions remain
unchanged. Clean installation, production build and offline Drizzle/Better Auth
schema generation passed. Generated compatibility outputs are private and do not
replace historical migrations or the committed auth schema.

The fresh audit moved from 13 findings (four moderate, nine high) to nine high
development-tool findings. `npm audit --omit=dev` reports zero findings. The nine
remaining dependency entries trace to the same `braces` stack-exhaustion advisory,
through micromatch/fast-glob and ESLint/shadcn tooling. They are not nine distinct
underlying flaws. The current published braces release is 3.0.3, and the advisory
lists no patched release. Do not run these tools on untrusted glob patterns or
unreviewed third-party registries; revisit the upstream fix before public release.
No audit finding is suppressed and no clean full-audit claim is made.

References: [esbuild maintainer advisory](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99),
[braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
[npm overrides](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides).
