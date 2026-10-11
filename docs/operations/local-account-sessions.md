# Local account-session management

Scope: AUTH-04, supporting AUTH-02/AUTH-03, build-plan M2.3/M2.9. Local synthetic
development only, under `AUTHORIZED — build-feature delegation` (2026-10-11).
Blueprint: `prompts/features/m2-09-account-sessions.md`. No production approval,
new auth store, schema, migration, dependency, role or password policy.

`/account` links to `/account/sessions`. Verified, active account holders see
their own active sessions, current session first. Reported browser/platform
labels are fixed descriptions derived from the self-reported user-agent and
may be missing or inaccurate. No IP, raw user-agent or location is displayed.
Timestamps show sign-in, provider session refresh and expiry, in the browser's
time zone with each instant's offset. Refresh time is not last activity.

## Private contract

- `GET /api/account/sessions` returns `{ sessions: [{ id, current,
reportedDevice, createdAt, updatedAt, expiresAt }] }` with ISO instants.
- `POST /api/account/sessions/revoke` accepts only `{ sessionId }`, bounded to
  128 opaque characters, in a bounded JSON body, from the exact local origin.
- The server requires the existing verified/active identity and calls Better
  Auth `listSessions` to resolve an own session ID to its token locally. It then
  calls supported `revokeSession` with authentication headers. No token is
  serialized in this feature's response, page props, URLs or logs.
- Foreign/missing/expired targets all return the same 404. Current-session
  targets return 409 with instructions to use existing Sign out. Admin has no
  ownership bypass. Anonymous/unverified/suspended callers are denied.
- Success/error responses use existing private/no-store/referrer headers. All
  unexpected provider/database errors map to a safe service-unavailable message.
  Raw `/api/auth/list-sessions` and revoke endpoints remain blocked by the
  existing auth-route allowlist; no broad auth-handler edit was necessary.
- Native confirmation, pessimistic pending state and explicit feedback accompany
  revocation. A network interruption says the outcome is unconfirmed; refresh
  before retrying. An expired/stale list never authorizes a mutation.

## Installed provider semantics

Checked pinned Better Auth **1.7.7** source/types in
`node_modules/better-auth/dist/api/routes/session.mjs` and `session.d.mts`, plus
[official session-management documentation](https://better-auth.com/docs/concepts/session-management).
`listSessions` uses `freshSessionMiddleware` and excludes expired sessions.
Default freshness is one day; it is not disabled. Our list-based ID resolution
means both operations preserve that requirement. `SESSION_NOT_FRESH` returns
safe instructions to sign out and sign in again. `revokeSession` independently
re-reads the authoritative caller with `sensitiveSessionMiddleware`, verifies
target ownership and deletes through the provider adapter. Its no-op behavior
allows two concurrently authorized removals to succeed safely; a request after
removal gets our same unavailable response.
Provider errors are recognized with supported `isAPIError`, rather than assuming
one constructor identity across the development and built Next.js runtimes.

Existing `cookieCache: { enabled: false }` remains unchanged. After provider
revocation, the removed cookie fails the next protected server request; already
rendered content on another browser is not remotely erased. Its next reload or
protected request requires sign-in. No secondary storage or stateless sessions
are configured.

## Verification and isolation

Own loopback PostgreSQL **55455**, development HTTP **3015**, test HTTP **3115**.
Private credentials/captured mail/fixture records are ignored; no other checkout's
environment or database is used. The dedicated
`playwright.account-sessions.config.ts` extends the unchanged standard browser
suite and adds a serial session project after learner checks; run with one worker:

```sh
npm run check
npm run test:integration
NEXT_TELEMETRY_DISABLED=1 npm run build
npm run test:e2e -- --config playwright.account-sessions.config.ts --workers=1
```

Tests cover two independent sessions, own-other revocation/immediate denial,
foreign IDs/token tampering/admin isolation, current sign-out, expired/freshness
gates, duplicate concurrent revocation, active/verified guards, origin/host/input,
safe outages/cache projection and browser loading/error/confirmation/accessibility.
Verification status is recorded in the branch tracker and ignored worker report;
test authoring alone is not passing evidence. Responsive captures are ignored.

Rollback: remove the feature routes/module and account link; no migration rollback
is needed. Removed provider sessions are intentionally ended and require sign-in.
Production, hosted providers, real identities, legal/safeguarding gates, external
email, commits/push/merge and combined-branch acceptance remain outside this task.
