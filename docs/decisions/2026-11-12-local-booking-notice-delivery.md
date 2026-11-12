# Owner-only local booking emails

Authority: user requested Resend confirmation, reschedule and cancellation
notices using the existing personal mailbox until a domain exists (2026-11-12).
Blueprint `prompts/features/m5-07-resend-booking-notices.md` is
AUTHORIZED — build-feature delegation, OPS-04/M5.7/M5.8.

The optional local account-mail key/recipient pair also enables these three
booking events. A distinct admitted-local composition uses the fixed Resend test
sender and loopback app origin without weakening hosted HTTPS/domain guards.
Only the exact configured owner, currently an authorized participant of an
ordinary local_operation booking, may receive an email. Other recipients are
never substituted; their rows and unrequested lifecycle kinds remain untouched.

Reuse the existing transactional delivery queue and independent fresh participant
checks. The booking service must commit before the handler schedules a bounded
event-specific Next after callback. Failure never changes a booking response or
rolls back its record. Queue claims, immutable body/fingerprint, configuration
binding, provider idempotency, retention/attempt bounds and retry state remain.
Next after is best effort; explicit bounded delivery:local recovery handles
missed or retryable sends. No periodic worker or public resend route is added.

Branded messages identify the outcome, genuine subject, current saved schedule
and recipient timezone; reschedule follows the replacement booking. Include a
sign-in-protected record link, text and embedded wordmark. No learner identities,
meeting links, payment or attendance claims. Preserve truthful local-test copy.
Provider acceptance is distinct from inbox delivery. Existing auth mail and
hosted booking template semantics remain unchanged.

No migration, dependency, booking-policy or hosted/general-recipient activation.
Provisional, expiry, completion and no-show delivery remain excluded. Automated
tests use an explicitly owned isolated ordinary-local cluster and synthetic
participants with provider interception; never change a personal account or
replay arbitrary personal historical bookings to obtain email evidence.

References: [Resend test sender](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain),
[provider idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys),
[Next after](https://nextjs.org/docs/app/api-reference/functions/after).
