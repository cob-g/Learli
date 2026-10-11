# Implementation Plan — Secure signed-in password changes

## Authority and baseline

**AUTHORIZED — build-feature delegation**, 2026-10-11. Actual user execution
request: “ok lets do it and spawn agents what you need to spawn”, dispatched as
`$build-feature Secure signed-in password changes`. Canonical wave contract:
`/Users/cob/learli/prompts/features/m5-06-four-feature-coordination-wave.md`
(read-only). This records delegated execution, not separate human blueprint
review or real-world policy approval.

Repository: `/Users/cob/orca/workspaces/learli/m2-account-password-change`.
Observed clean branch `cob-g/m2-account-password-change`, HEAD
`024dd4d7ce885da7ca391aefeaf4096fc75fc91e`. No existing local memory was supplied.
Read root AGENTS.md and the eight canonical lowercase context documents in its
required order; consult local identity, booking, support and notification decisions.

## What we are building

A verified active synthetic account owner changes their password from account
settings by supplying their current password and confirming a new 12–128
character password. Better Auth owns password verification, hashing and session
rotation; Learli enforces freshness using its installed session configuration.
Other sessions end; the current browser receives the replacement cookie.
No email change, deletion, MFA, new dependency, schema or remote operation.

## Requirement and milestone mapping

- Primary build-plan M2.9; related M2.3/M2.5/M2.7.
- PRD AUTH-02/03/04 and NFR-05.
- Existing account name/timezone UI, reset, own-session APIs and active/verified
  guards exist. Raw `/api/auth/change-password` is intentionally absent from the
  HTTP allowlist. Installed manifest pins Better Auth 1.7.7.
- No terminology clarification or unresolved product choice blocks this slice.

## Decisions and invariants

- Proposed `POST /api/account/password` accepts exactly `currentPassword`,
  `newPassword`, `confirmPassword` in bounded JSON; user IDs, role and
  revoke-other-sessions overrides are rejected.
- Use `requireIdentity` and a current transaction identity recheck. No role is
  required; no account may change another account's credentials.
- Dispatch to `runtime.auth.handler` at its internal `/api/auth/change-password`
  path, preserving cookie/origin headers and trusted local IP normalization.
  This executes provider HTTP throttling and sensitive-session checks rather
  than bypassing them through a direct server API call.
- Installed-source correction: sensitiveSessionMiddleware checks authoritative
  validity but not age. Learli additionally checks session createdAt against the
  installed context sessionConfig.freshAge to satisfy the wave's stale-session
  denial. This local freshness gate is explicit, not attributed to changePassword.
- Add only the exact provider change-password throttle: five requests per sixty
  seconds in existing database-backed rate-limit storage. No raw route exposure.
- Force `revokeOtherSessions: true`. Forward every provider Set-Cookie header,
  never return provider tokens/user/session payload. Responses are private,
  no-store and no-referrer. Never log passwords, cookies or response tokens.
- A nonblocking transaction advisory lock keyed by provider-resolved account
  prevents two overlapping changes through this boundary. A concurrent request
  gets a safe 409; no domain/auth row lock is held while the provider uses its
  own connection. Recheck identity after lock acquisition. This does not claim
  serialization against password reset or every provider operation.
- Before the account lock, an immediate global provider-capacity slot allows one
  wrapper provider call at a time. Competing accounts get409 instead of reserving
  all five runtime connections while the provider needs another from that pool.
  Prove bounded completion under five different simultaneous account requests.
- Provider failure can occur after a credential write. Any 5xx/unexpected
  response or transport failure reports uncertainty and offers sign-in/reset;
  it never claims rollback or that the old password remains valid.
- Local accounts only, existing launch/guardian/payment/support gates preserved.
  No booking, support, restrictions-service or baseline migration changes.

## Affected areas and implementation sequence

1. Record this delegated auth boundary in a dedicated decision and append narrow
   PRD/architecture/build-plan notes before relying on it.
2. Add proposed `src/features/account-password/` input, service, handler and
   accessible form plus `src/app/api/account/password/route.ts`.
3. Insert the form into existing `/account`; preserve name/timezone/session flows.
   Use labelled password inputs, password-manager autocomplete, paste support,
   field errors, pending feedback, focused status/error notice and safe reauth.
   The form explicitly needs JavaScript; no no-JS password submission promise.
4. Add meaningful unit/component, PostgreSQL and browser tests. Add only a narrow
   serialized sensitive browser project after baseline projects for root to reconcile.
5. Update tracker with observed partial status, then read-only Review, separate
   Verify, scoped Recover/repair if needed and ignored local Remember handoff.

## Workflow and failure states

Ready → validate → current identity → lock/recheck → provider → safe result.
Wrong current password, malformed/extra fields, mismatched confirmation, invalid
length, anonymous/expired/stale/unverified/suspended session and foreign/missing
origin or host are denied. A fresh sign-in returns safely to `/account`.
Busy concurrent change, throttling, unconfigured service and uncertain provider
failure have distinct bounded messages. Clear entered passwords after submission;
success announces changed password/other sessions ended, without token rendering.

## Verification plan — NOT RUN during Architect

- Pinned Node24.20.0/npm11.19.0 `npm ci`; own cluster on55484, dev3044,
  test3144 using scripts/local-db.mjs and PostgreSQL17 binaries. Confirm all ports
  and loopback environment without printing secrets before migration/seed/test.
- `npm run check`, full serial `npm run test:integration`, `npm run build`,
  default `npm run test:e2e -- --workers=1`, plus applicable new cases.
- Real provider proof: old password denied/new accepted; all old cookies denied;
  replacement cookie authorizes account; safe body excludes actual tokens;
  current/wrong owner/forged override, freshness, expiry, status and origin denials;
  actual persisted provider throttling and concurrent lock conflict/recheck.
- Failure injection verifies truthful partial-provider uncertainty and cookies;
  unit test multiple independent Set-Cookie preservation without token exposure.
- Browser phone390/desktop1440/narrow320, keyboard/focus/paste/autocomplete,
  axe, no overflow, pending/validation/reauth/error/success; sensitive trace and
  automatic screenshots disabled. Only empty-password sanitized UI captures.
- Retain exact commands/exit codes/logs/hashes. No schema change means fresh/0012
  upgrade and new grant proof NOT APPLICABLE; baseline migrations still run.
- No live mail/provider navigation, production, commits/push/merge or nested workers.

## Handoff, risks and rollback

Same-agent read-only Review is not independent review. Root provides independent
review and shared-file reconciliation; combined restriction UI tests are downstream.
Disable/remove new surface for rollback; preserve provider-managed credential and
session effects, and use existing reset for recovery. Provider partial failure is
the principal operational limitation. No additional production policy is decided.
Save ignored untracked memory.md preserving history and `.local/four-feature/report.md`
with final changed-file manifest/SHA256, shared hunks/contracts, review and actual
verification evidence and remaining integration concerns. Leave candidate uncommitted.
