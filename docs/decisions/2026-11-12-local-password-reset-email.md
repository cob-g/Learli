# Owner-only local password-reset delivery

Date: 2026-11-12. Authority: user requested Resend for Forgot password and reset
links, using their personal email until a sending domain exists. This extends
the earlier verification-only decision; it does not imply separate blueprint
review or production authorization.

Reuse the current private local verification key/recipient settings for both
verification and reset mail. Send only a genuine Better Auth proof to its exact
configured recipient through the fixed Resend test sender. Do not substitute
recipients, expose links in logs or capture a failed live send. Provider failure,
unknown accounts and excluded recipients retain a generic accepted reset
response and bounded timing; validation and rate limits remain authoritative.

Better Auth retains token creation, 30-minute lifetime, single use, password
validation, callbacks and session revocation. Reset email shares the Learli
wordmark, action, plain text, fallback and privacy guidance. Default local mail,
email changes and booking notices retain their existing behavior. No domain,
hosted activation, additional recipient, database migration or personal-account
password change is authorized.

One reset request to the already configured personal mailbox may verify live
provider acceptance. Inbox receipt and completion require separate observation;
the automated reset test uses a synthetic account and intercepted provider.

Sources: [Better Auth email/password](https://better-auth.com/docs/authentication/email-password),
[Resend test-sender restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).
