# Local owner-only email-change delivery

Authority: 2026-11-12 user request to add Resend email changes using the existing
personal mailbox until a sending domain exists. Blueprint:
`prompts/features/m5-07-resend-email-change.md` (AUTHORIZED — build-feature
delegation; AUTH-02/03/04, M2.9/M5.7).

The optional LOCAL_VERIFICATION_RESEND_KEY/LOCAL_VERIFICATION_RECIPIENT pair now
also sends current-address and new-address confirmation codes. The exact
configured owner is the sole live recipient using Learli <onboarding@resend.dev>.
An email-change counterpart with a synthetic .test address uses deliberate
private local capture. Other real recipients are refused, never redirected to
the owner. Provider failure never falls back to capture. Verification/reset
routing and capture-only defaults stay unchanged; booking notices are excluded.

Messages reuse the Learli branded shell, text alternative and CID wordmark,
with distinct current/new purpose, a displayed six-digit code, five-minute and
one-use guidance. The account navigation URL contains no proof. The existing
Better Auth current/new proof, owner/session/address binding, hashed storage,
three attempts, expiry, freshness, origin/throttle controls and other-session
revocation remain authoritative. No schema or dependency change is needed.

Local form copy describes inbox versus synthetic capture without claiming
delivery. Automated tests use synthetic owners and intercepted provider traffic
on the isolated test database. No personal account's saved email is changed by
automation. A live current-address code may be requested for the existing owner
only in an admitted local environment; it must not be consumed automatically.

No hosted/general-recipient activation, domain/billing or production operation
is approved. Remove both settings and restart to return to capture only.

References: [Resend test sender](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain),
[Better Auth email OTP](https://better-auth.com/docs/plugins/email-otp).
