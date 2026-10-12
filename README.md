# Learli

Learli is a one-to-one tutoring marketplace and booking intermediary. Tutors
teach through Zoom or Google Meet. The repository has a responsive app foundation
and **local-only identity, marketplace coordination and synthetic booking development**.
Live customer booking remains disabled.

## Run locally

Use Node **24.20.0**, npm **11.19.0**, and PostgreSQL **17** (`initdb`/`pg_ctl` on
PATH). PostgreSQL 17.11 is installed on the current development machine.

```sh
npm ci
npm run local:setup
npm run dev
```

Open [127.0.0.1:3000](http://127.0.0.1:3000). Setup starts a repository-owned
loopback database with separate dev/test data, applies reviewed migrations, and
creates synthetic role fixtures. It generates private, ignored environment files
without overwriting existing configuration. No hosted database, deployment or
external email service is contacted. The public shell can also run without auth
configuration; account features then report that they are unavailable.

```sh
npm run fixtures:open   # private local test-account credentials
npm run mail:open       # latest local verification/reset message
npm run db:status
npm run db:stop         # preserves data
```

New signup accepts synthetic `.test` addresses and grants **no roles**. Verification
and password reset use Better Auth with private local mail capture. `/account`
requires a verified, active session; role workspaces check server-side grants.
Account settings enforce ownership even for admins. Real-minor onboarding and
public account enrollment remain gated by project policy.

Detailed setup, migration, credential and recovery instructions:
[Local development](docs/operations/local-development.md).

## Installed stack

| Area           | Tools / actual state                                                              |
| -------------- | --------------------------------------------------------------------------------- |
| App            | Next.js 16.4, React 19.3, strict TypeScript 6                                     |
| UI             | Tailwind 4.3, Poppins, proposed Learli tokens, shadcn CLI/config, native controls |
| Local data     | PostgreSQL 17, node-postgres, Drizzle ORM/Kit, reviewed SQL migrations            |
| Auth           | Better Auth 1.7.7 with generated Drizzle schema, verification/reset/session flows |
| Access         | Server role and ownership checks, account status, limited audit events            |
| Mail           | Private local capture only; Resend package reserved for later                     |
| Quality        | ESLint, Prettier, Vitest/Testing Library, PostgreSQL integration tests            |
| Browser        | Playwright Chromium and axe; desktop, phone and narrow layout checks              |
| Hosted targets | Neon/Railway/Resend remain planned and unconnected                                |

Versions and installation-script policy are pinned in package/lockfile; do not
mix package managers or force incompatible peers. Next's automatic agent-rule
writing is disabled to preserve `AGENTS.md`. Its installed documentation is in
`node_modules/next/dist/docs/`. Request URL logging is disabled because auth URLs
can contain private verification/reset tokens.

## Checks

After local setup:

```sh
npm run check              # format, lint, typecheck, unit/component tests
npm run test:integration   # real isolated PostgreSQL, synthetic records only
npm run build
npx --no-install playwright install chromium
npm run test:e2e           # default Chromium projects; own loopback test server
```

Do not run integration/browser suites simultaneously against `learli_test`.

Additional local readiness commands are explicit and separate from the default
Chromium/Docker CI suites. Follow the owned-environment requirements in the
[restore](docs/operations/local-backup-restore.md),
[deployment preflight](docs/operations/deployment-runbook.md),
[cross-browser](docs/operations/cross-browser-acceptance.md) and
[performance](docs/operations/performance-baseline.md) runbooks before using
`test:restore`, `db:restore:drill`, `deployment:preflight`,
`test:e2e:cross-browser` or `performance:baseline`. The
[readiness report](docs/operations/readiness-wave.md) records actual outcomes and
remaining gates; these commands do not authorize hosted or production operations.
The browser suite refuses to reuse an unrelated server. CI is configured with
an ephemeral PostgreSQL service but has not been run remotely for this work.
A clean build downloads Poppins through `next/font/google`, then serves fonts
from this app; package/font downloads are build-time dependencies.

Other commands include `npm run format`, `npm run lint`, `npm run typecheck`,
`npm run test:watch`, `npm start`, `npm run auth:generate`, `npm run db:generate`,
`npm run db:migrate`, and `npm run db:migrate:test`. Review generated SQL before
applying it. Local scripts reject remote DB targets; no destructive reset exists.

## Current boundaries

- `/tutors`, `/tutors/[slug]`, `/subjects` and the home page list only publicly
  eligible tutors (approved, active verified account, active subject) and show
  truthful empty states otherwise. `/get-matched` asks level and subject and
  lists the tutors who teach that pairing; it is rule-based. Live customer booking
  remains unavailable. No invented tutor inventory, prices, ratings or lessons.
- Local M3.1–M3.3 and the M3.4 entry: any verified account can start a tutor
  application from `/become-a-tutor`, which grants the `tutor` role only. A tutor
  submits and edits one application at `/tutor/profile`; an `admin` reviews it at `/admin/tutors`
  and manages the catalog at `/admin/subjects`. Approving lists the tutor
  publicly in this local environment. The tutor screening policy is undecided.
- Student and parent workspaces link to private, fixture-provisioned learner
  list/detail/edit pages. Runtime can edit only display name, level and time zone;
  creation, ownership and guardian links stay in trusted synthetic fixture tooling.
  Run `npx --no-install tsx scripts/seed-local-learners.ts` after `db:seed`;
  see [local learner setup](docs/operations/local-learners.md). Real onboarding
  and bookings remain unavailable.
- The standalone Zoom/Meet URL validator is pure syntax validation only. It makes
  no network requests and provides no storage, meeting access or attendance proof.
  The private meeting integration draft remains blocked on product decisions.
- `/api/health` is uncached process liveness, not a database/email readiness claim.
- Pages remain excluded from indexing. Local auth is rejected in staging/production.
- Final brand artwork and generated shadcn primitive approval remain open.
  `new-york` is a provisional CLI setting, not final design approval.
- No payment, cloud provisioning, deployment or external message sends.

## Staging database preparation

The separate `npm run staging:database -- <operation>` operator tool supports
`inspect-config`, read-only `inspect`, `plan` and explicitly selected `apply`.
It requires private configuration and an exact approved Neon staging target;
ordinary application requests and local tools keep their existing local guards.
See [staging database operations](docs/operations/staging-database.md) for input
formats, role separation, plan binding and recovery requirements.

This wave prepares and locally verifies the tool. A named, authorized provider
rehearsal must establish actual Neon compatibility; hosted auth, email and release
remain separate gates. The full hosted deployment preflight remains blocked.

## Dependency maintenance

Rechecked 2026-10-12: **13 audit findings (4 moderate, 9 high)** remain in two
underlying advisories: `braces` (dev lint/shadcn) and nested legacy `esbuild`
(Drizzle Kit). `--omit=dev` still reports four moderate findings through Better
Auth's optional Drizzle Kit peer. The audit is **not clean**; filtered optional-peer
omission is not a fix. No compatible stable upgrade resolves these findings, so
exact pins and lockfile are retained. Drizzle Studio and esbuild development
servers are not used by this app or its migration runner. See the
[dependency maintenance report](docs/operations/dependency-maintenance.md) for
each advisory, installed path, exposure, mitigation and current evidence.

ESLint 9 is pinned because installed Next lint plugins' peers exclude ESLint 10;
its deprecation remains visible. Do not hide peer failures using `--force` or
`--legacy-peer-deps`. See the foundation recovery handoff under `prompts/recovery/`.

## Project context

Read `AGENTS.md` and the eight canonical files under `context/` before implementing.
`context/build-plan.md` owns sequencing; `context/progress-tracker.md` records
actual evidence and outstanding work. Local-only M2 authority is recorded in
`docs/decisions/2026-10-11-local-m2.md`; the blueprint is
`prompts/features/m2-01-local-identity-foundation.md`.

Use `$build-feature <feature>` in Codex. The local `memory.md` handoff is ignored;
never commit it. Official references:
[Better Auth/Next.js](https://better-auth.com/docs/integrations/next),
[Drizzle adapter](https://better-auth.com/docs/adapters/drizzle),
[Email/password flows](https://better-auth.com/docs/authentication/email-password),
[PostgreSQL/Drizzle](https://orm.drizzle.team/docs/get-started/postgresql-new).

### Separate worktree development

Each concurrent session needs its own checkout and local PostgreSQL cluster.
On a new worktree, choose unused loopback ports before initial setup, for example:

```sh
LEARLI_DB_PORT=55441 LEARLI_DEV_PORT=3001 LEARLI_TEST_PORT=3101 npm run local:setup
npm run dev -- --port 3001
```

Defaults remain 55432/3000/3100. New clusters remember their selected ports in
private local state, so subsequent `npm run db:start` needs no overrides. Setup
rejects changes to those stored ports and preserves existing environment files;
these settings are for a fresh cluster, not moving an existing cluster's port.
Browser tests use `APP_URL` from that worktree's `.env.test.local`. Credentials,
mail captures and cluster files stay in its ignored local directories. Never copy
another worktree's database configuration or run concurrent test suites against
one database. Weekly availability is managed at `/tutor/availability`; booking
and public candidate-slot display remain unavailable.

The combined migration chain preserves availability as `0006` and adds learners
as `0007`. Use fresh databases when combining source branches that each had their
own `0006`; do not reinterpret or renumber an already-applied source history.
See [integration evidence](docs/operations/m4-m5-integration.md) for source commits,
isolated ports, verification and the remaining main-merge checkpoint.

### Five-feature local integration candidate

`npm run test:e2e` now discovers all baseline and booking/time-off/language/support/
account-session suites, with ordered fixture-mutating projects. Dedicated feature
configs remain available for focused recovery runs. Run owned `local:setup` before
checks; do not reuse a source branch database with colliding migration history.
The combined chain preserves0000–0009, then adds languages0010 and corrected
support0011. See `docs/operations/five-feature-premerge.md` for exact source and
migration identity, local-only limits and fresh/upgrade evidence.
