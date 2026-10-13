# Hosted synthetic account preparation

This software is opt-in, staging-only and synthetic-only. It establishes neither
real customer eligibility nor Railway ingress or Resend delivery acceptance.
Payments and real onboarding remain disabled. Preserve ordinary local setup,
`npm start` and `npm run build` for existing local demonstrations.

The separately selected account runtime uses `AUTH_MODE=hosted-synthetic`,
`APP_ENV=staging`, equal canonical HTTPS `APP_URL`/`BETTER_AUTH_URL`, a strong
`BETTER_AUTH_SECRET`, independent `HOSTED_INGRESS_SECRET`, and an absolute
`HOSTED_AUTH_CONFIG_FILE` below this checkout's private `.local` directory.
Production and local database fallbacks are refused. Configuration changes
require restarting the process; a failed initialization cleans its database and
permits retry after a short bounded cooldown without changing configuration.

The strict version1 packet uses purpose `hosted_synthetic`, realIntake `disabled`,
1–100 explicit lower-case `.test` accountEmails, a restricted
`STAGING_DATABASE_URL` and the existing exact ApprovedStagingTarget runtime
attestation. No migration credentials belong in this packet. File and private
ancestor ownership/permissions, regular-file shape, symlink refusal and a64KiB
bound are enforced. Errors omit values and paths.

Ingress defaults to `{mode:"disabled"}`. An enabled `trusted-proxy` contract
requires exact trustedPeerAddresses, `httpsHeader:"x-forwarded-proto"`, and
clientIp `shared-bucket` or `overwritten-single-header`. The latter accepts one
valid overwritten x-forwarded-for literal. The Node entry checks the actual
socket peer and raw duplicate headers, strips forwarding/internal headers,
and mints a private envelope that account requests validate. Host and mutating
Origin must exactly match the configured HTTPS origin. An assertion in JSON is
not proof of Railway network isolation or overwritten-header behavior; keep
real ingress disabled until those properties are independently established.

Mail defaults to `{mode:"disabled"}`. `resend-single-attempt` consumes the
accepted ResendTransportConfig plus an identitySecret. The staging sender/
origin/environment attestation and bounded recipient list must exactly match
the configured account set. Account callbacks await one SDK attempt; accepted
does not mean delivered. Failed/uncertain sends may follow an already persisted
unverified account or proof operation. Recover through native verification/reset
requests; no proof token queue, blind retry or rollback claim is introduced.

After building normal non-standalone Next output, the optional `npm run
start:hosted` uses the existing pinned tsx runtime dependency and same-process
Node entry. Supply explicit PORT and HOSTNAME (`127.0.0.1` or deliberately
configured `0.0.0.0`). Startup performs no migration/seed. `/api/health` remains
data-free process liveness. SIGTERM/SIGINT stop accepting and drain requests,
pending account initialization and the single guarded pool within a bound.
This command and packaging are software preparation, not deployment authority.

Account/auth/security routes select this runtime; unrelated tutor/family/booking/
support/private-review domains retain their existing local-only selector.
Secure, HttpOnly, SameSite=Lax, host-only cookies, provider CSRF and origin checks,
runtime-owned email proof binding, W1 MFA and document replacement guards remain.
New accounts receive no roles. Both current/new email addresses must be selected.

The normal Playwright command registers hosted-auth alongside local tests.
Its fixture defaults to HTTP backend3093, TLS DB56003 and HTTPS3293. A coordinator
can assign separate validated ports through `LEARLI_HOSTED_BACKEND_PORT`,
`LEARLI_STAGING_TEST_PORT` and `LEARLI_HOSTED_HTTPS_PORT`; all three must differ.
The ordinary local server uses the test `APP_URL`. Every listener remains on
loopback and refuses an occupied port; no existing service is stopped or reused.
Direct hosted database tests require an explicit TLS port assignment.
It records exact candidate/mirror hashes and only three test-owned
export substitutions: parseHostedAuthConfig, stagingPoolConfig and createHostedAuth.
The real parser/factory remains separately tested for refusal. The fixture keeps
real W2 leases/transactions, Better Auth/W1 proofs and W4a SDK serialization;
supported test transport captures privately and sends nothing externally.
Playwright certificate tolerance is confined to the exact loopback HTTPS context;
owned TLS clients separately verify the CA and reject the wrong CA. No global
trust or TLS environment weakening is used. This proves local behavior after
fixture admission, not real hosted/provider activation.

Execution outcomes, failures, exact source and remaining checks belong in the
worker's ignored report and tracker; this runbook is not a verification claim.

Hosted mode refuses ambient BETTER_AUTH_SECRETS so provider cryptographic identity
stays bound to the explicit single configured secret. Versioned-key rotation needs
a separate reviewed design; local behavior is preserved.

For scoped actual browser-engine acceptance, the ordinary hosted-auth project can
be selected with LEARLI_HOSTED_BROWSER=chromium, firefox or webkit; the default is
Chromium and each invocation creates a fresh owned fixture. Test targets remain
the assigned exact loopback origins/ports. The production-only packaging rehearsal
is `node scripts/with-test-env.mjs node --import tsx
tests/support/hosted-auth-packaging.ts` after a reviewed build, under a heavy lease.
It installs exact production dependencies in a private owned copy, starts the real
entry with ingress/mail disabled, verifies liveness/denial/shutdown and production
refusal, and performs no provider connection/send.
