# W4a — Resend transport and account-message provider foundation

Status: **AUTHORIZED — build-feature delegation**, 2026-10-12 dispatched W4a
task `task_f9bbb4062d30`; baseline `2fa0294c5e6cad895754b3c10a703a6c6f6ef00a`.
Authority is the user-approved eight-workstream readiness request and narrow
worker contract, not separate human policy approval. Parent blueprint is pending
root delivery. PRD AUTH-01/02/04, OPS-04; build packages M2.3, M5.7/M5.8,
foundation only. This does not complete W4 or email end-to-end acceptance.

## Scope and preserved boundaries

Add only two server-only providers, their discovered unit tests, this blueprint,
distinct W4a operations/recovery documentation and private evidence. Preserve
auth callbacks, local captures, configuration, routes, authorization, booking
queue/services/schema, dependencies/lockfile, migrations and shared test config.
No real mail, domain/DNS/provider action, DB setup, deployment, payments, commit,
push, merge, cleanup or nested worker is authorized. Checkout is initially clean
on `cob-g/m5-resend-transport` at the stated baseline.

## Provider contract

- `createAuthMessageConstructors({appOrigin, identitySecret})` supplies strict
  verification, passwordReset, emailChangeCurrent and emailChangeNew functions.
  Their input is server/provider-issued recipient and proof plus an opaque UUID
  eventId and durable firstAttemptAt epoch milliseconds. No arbitrary subject,
  body, header or recipient override API exists. Constructors validate exact
  HTTPS origin, installed Better Auth route shape, proof and safe callback.
- Return sanitized constructor failure or opaque immutable `ValidatedMessage`.
  Secret-bearing body lives in a WeakMap; enumerable/JSON/inspect projection
  contains only template, opaque keyed identity/fingerprint and firstAttemptAt.
  HMAC fingerprint avoids exposing a brute-forceable hash of six-digit OTPs.
- `createResendTransport(config).send(message)` returns only accepted/providerId,
  retryable/rate_limited|unavailable, rejected/configuration|recipient|payload,
  or uncertain/timeout. API acceptance never implies delivery.
- Missing/invalid/disabled configuration fails closed before SDK construction
  or I/O. Explicit environment, exact HTTPS origin, sender attestation bound to
  sender/environment/origin, explicit recipient allowlist and API key required.
  All environments stay allowlisted in this foundation. No ambient env lookup.
- Immutable per-event/recipient/template identity and content fingerprint;
  transport refuses changed material under one identity in-process.
  Each in-process entry expires at the key deadline; no lifetime accumulation.
  Consumer must durably pin sender/config version, template version, event, provider proof,
  recipient, firstAttemptAt and fingerprint before dispatch and reconstruct the
  same material on retry; no regeneration or recipient redirection. Shared
  secret must remain stable across retries. Authentication provider still owns
  issuance, verification, expiry and single use; adapter establishes no auth.
  Current/new five-minute text assumes installed emailOTP expiresIn=300;
  consumer must preserve or reconcile that setting, not infer transport expiry.
- Retry deadline is conservatively firstAttemptAt + 24h. At/beyond it, stale
  or ambiguous work returns uncertain without I/O and remains operator-blocked.
  Consumer must never reset firstAttemptAt after a crash or blind-resend under
  another key. Auth proof expiry can require an earlier consumer stop.
- Installed SDK6.32.1 request construction is used. Its public fetchRequest is
  overridden in a narrow class because default development error handling logs
  raw provider responses. Fixed Resend origin, sanitized parsing, bounded abort
  timeout, no global logger/env patch. Test fetch injection is test-config-only.
  Changed-payload409 is rejected/payload; concurrent409 is retryable/unavailable;
  429 rate limited; 5xx unavailable; ambiguous network/timeout/malformed success
  uncertain. No raw errors/headers leak and no logs are emitted.

## Implementation and separate verification plan

Implement strict materialization first, then sanitized actual-SDK transport,
then owned unit tests and consumer operations contract. Same-agent read-only
Review compares all untracked source/tests and scoped tracker changes against
this contract; separate Verify executes discovered two-file Vitest tests,
scoped Prettier/ESLint, repository typecheck and production build sequentially
under assigned heavy slot B. Inspect scripts before executing. No unchanged
PostgreSQL/browser suite for this adapter stage. W4b owns committed-booking
authorization/outbox integration and actual Playwright account+booking journeys
against local simulation. Test positive templates, denials, stable retries,
no-I/O disabled/stale cases, privacy, SDK request serialization and failure maps.
Recover diagnoses any failure before scoped repair; final Remember saves ignored
local memory. Root reconciles bounded tracker contribution and architecture
integration docs. Freeze exact SHA256 sources for W3/W4b early handoff and final
report at `.local/hosted-readiness-wave/report.md`.

Official sources inspected 2026-10-12:
[send](https://resend.com/docs/api-reference/emails/send-email),
[idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys),
[errors](https://resend.com/docs/api-reference/errors), plus installed Resend
and Better Auth route source. No public delivery/operational gate is resolved.

Blueprint ready. Verification status: NOT RUN — architecture stage only.
