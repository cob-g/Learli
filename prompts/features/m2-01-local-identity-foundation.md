# M2 — Local data, identity and authorization foundation

- Status: **AUTHORIZED — build-feature delegation**
- Date: 2026-10-11
- Authority: User requested proceeding to M2 with everything local. They confirmed
  no further restriction beyond no cloud services, deployment or external email.
- Baseline: `main` at `4503177` plus the uncommitted, verified M1 application and
  earlier skills. Preserve all pre-existing work; record a local file digest
  manifest before implementation because HEAD alone does not contain M1.
- Primary package: M2.1; related M2.2–M2.9.
- PRD: AUTH-01/02/03; AUTH-04 basic self settings, AUTH-05 safe return paths;
  relevant NFR-01/02/05/06/09/11. Future learner/booking ownership remains M4.

## Outcome and decisions

Build working local registration, verification, login/logout, password recovery,
private account settings, trusted multi-role access and database-backed tests.
Run PostgreSQL 17 already installed on this machine in a repository-owned cluster
bound to loopback, with separate development/test databases and a restricted app
role. Use Drizzle's node-postgres driver locally. Neon stays the agreed future
hosted provider; do not provision/connect it or claim Neon-specific TLS verification.

Use Better Auth 1.7.7's supported adapter/CLI schema generation and provider-owned
password/token/session flows. Apply reviewed Drizzle SQL, never a blind schema
push. Keep database configuration server-only, bounded pools, safe errors, foreign
keys and indexes. Reject remote connection URLs in all local runtime/tools paths.

Local-only authentication is explicitly opt-in and unavailable in staging or
production APP_ENV. Default dev/start commands bind loopback. Permit synthetic
`.test` addresses only; no real minor enrollment or eligibility/consent policy is
invented. Verification and reset mail is captured in private, ignored local files
and opened with a local helper, never sent to Resend or logged with tokens. Disable
request URL logging that could expose verification/reset tokens.

New public registrations receive **no roles**. Only the trusted local fixture
script grants the fixed synthetic role accounts; no client admin/self-approval
path. Store multi-role grants separately from Better Auth user records. Add app
account status and minimal audit events; suspended users are denied at session
creation and every protected boundary. Role membership does not confer record
ownership; admin is not an ownership bypass. Do not add tutor, guardian, learner,
booking or payment schema before those milestones need it.

## Scope and proposed files

1. Local PostgreSQL start/stop/setup scripts, private generated env files,
   migrations/config, `src/lib/db/` connection/schema modules and fixture scripts.
2. Better Auth configuration/factory, constrained `/api/auth/[...all]` handler,
   local mail sink, server permission helpers and self-account service/API.
3. Sign-up, sign-in, verification notice, forgot/reset-password, account page,
   guarded role workspaces and logout. Accessible native controls matching the
   current theme; no unapproved generated shadcn primitives. No fabricated lesson
   dashboards: role pages explain which actual account is signed in and that
   scheduling/learner features are not built yet.
4. Safe relative return paths preserving selection query parameters without
   accepting external/protocol-relative redirects. Selection still requires
   revalidation when booking is implemented.
5. Unit, real PostgreSQL integration, and browser tests; update M1 assertions only
   where routes now intentionally have auth behavior. Preserve unrelated tests.
6. README, progress tracker, architecture/local-only decision note, build-plan
   local substitute annotation and operations instructions. No remote CI run.

## Important implementation boundaries

- Better Auth handles hashing, verification/reset tokens, cookie sessions, CSRF
  and origin validation. Require verification before login; revoke sessions on
  password reset; no session-cookie cache that hides suspension/revocation.
- Enable database-backed auth throttling in local mode too. Normalize the direct
  local client's IP instead of trusting arbitrary forwarded headers.
- Validate every settings mutation server-side, require an exact same-origin
  browser request, reject extra fields, and check both current status and record
  ownership. Never expose passwords/session tokens through custom account APIs.
- Private pages are dynamic/no-store and noindex. Unconfigured auth returns a
  truthful unavailable state; it never becomes an auth bypass.
- Local scripts create only their own cluster/databases; do not reset existing
  databases, alter unrelated services, or overwrite user secrets. Migrations
  use the dedicated local owner; runtime uses restricted privileges.
- No cloud resources, deploy/push/commit, external messages, analytics, payment
  gateway, real personal records, or production migration under this request.

## Planned verification — not yet executed

- Clean local database initialization; migration application and idempotent rerun;
  reviewed generated SQL, runtime role privileges, transaction rollback and
  constraint checks against PostgreSQL. Explicit remote/test-target rejection.
- Signup validation, duplicate-account response, synthetic address restriction,
  email verification, invalid/expired/single-use reset, old-password denial, new
  password login, session expiration/revocation/logout and safe cookie flags.
- Client role/status injection denied; trusted multi-role fixtures; unauthenticated,
  unverified, suspended, wrong-role, cross-account and admin-without-ownership
  denial. Actual DB reads/writes and HTTP handlers, not only mocked guards.
- Trusted-origin/CSRF rejection, rate limiting, safe redirect preservation/rejection,
  private cache/metadata behavior and no secrets in client assets/logs.
- Unit/component/integration checks, lint/format/typecheck, production build,
  browser local-mail verification/reset journeys and responsive/keyboard/axe QA.
- Safe DB-unavailable/unconfigured behavior and zero external mail/provider calls.

## Gates, risks and handoff

Business and safeguarding decisions stay open. This local synthetic-account mode
is not public enrollment. Final shadcn preset/artwork approval remains open; native
controls extend the existing foundation. Existing tooling audit advisories must
be rechecked; use Drizzle's migration runner, not an exposed tooling server.
Rollback: stop the owned local cluster/app; keep data and existing migrations.
Do not provide a destructive reset as the default recovery strategy.

Read AGENTS and all eight canonical context documents before implementation. The
coordinator owns implementation, scoped review, verification, recovery and the
local Remember handoff. Record local success separately from unrun Neon, email
provider, deployment and real-user launch acceptance.

Blueprint ready.
