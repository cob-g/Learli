# W4a consumer contract — provider foundation only

Authority: **AUTHORIZED — build-feature delegation**, 2026-10-12 W4a readiness
dispatch. Blueprint: `prompts/features/m5-07-w4a-resend-provider.md`. This stage
adds no configured delivery path. Existing local account/booking capture stays
unchanged. No real mail/domain/DNS/provider operation occurred or is authorized.

## Trusted materialization

Import the two `src/lib/email/` modules only on the server. Construct a factory
with `{ appOrigin, identitySecret }`; appOrigin must be the exact HTTPS origin
(no trailing slash/path/userinfo), identitySecret a stable server-only secret
32–512 characters. Consumer may use its existing server secret with a stable
version; do not expose it. The HMAC namespaces are distinct. The factory returns
`verification`, `passwordReset`, `emailChangeCurrent`, `emailChangeNew`. Each
returns `{ok:true,message}` or `{ok:false,code}`. Input has an opaque UUID eventId,
durably stored firstAttemptAt (epoch milliseconds before initial dispatch), and
provider `{email,url}` or `{email,otp}`. No subject/body/header overrides exist.
Only provider-issued URL/code and trusted server/domain recipient context are
permitted; these functions validate format, not authentication or ownership.

Verification URL is installed Better Auth `/api/auth/verify-email` with exactly
one token and callbackURL; reset is `/api/auth/reset-password/:token` with exactly
one callbackURL. HTTPS origin must match, credentials/hash/backslash/control
characters/foreign redirect/extra parameters are denied. Verification callback
is `/`, `/sign-in` or `/account`, with optional verified=1 and safe local next;
reset callback is exactly `/reset-password`. Email change uses the fixed
token-free `/account/email` path, single-use six-digit provider code and existing
five-minute provider expiry. Provider continues to own proof lifecycle and
session/context checks. A new Better Auth base path or callback shape needs
explicit provider-contract reconciliation before use.

The five-minute text assumes installed emailOTP configuration expiresIn=300;
transport does not enforce proof expiry. W3 must preserve that provider setting
or reconcile the versioned template before sending. Proof age/expiry checks
remain consumer/provider-owned.

`ValidatedMessage` is frozen and opaque at runtime; copying/deserializing its
safe projection does not create a valid message. Projection holds only template,
HMAC idempotencyKey, HMAC payloadFingerprint and firstAttemptAt. HMAC avoids a
plain hash oracle for low-entropy OTPs. Private material is kept in a WeakMap;
`readValidatedMessage` is an internal adapter bridge and must never be logged or
returned to clients. Only the intended email body contains proof/link/code.

## Configuration and SDK transport

`createResendTransport(config).send(message)` returns:

| status    | fields                              | Consumer meaning                                                         |
| --------- | ----------------------------------- | ------------------------------------------------------------------------ |
| accepted  | providerId                          | API accepted request; never call it delivered                            |
| retryable | rate_limited / unavailable          | bounded retry with same immutable material                               |
| rejected  | configuration / recipient / payload | permanent for this material/config; investigate                          |
| uncertain | timeout                             | possibly accepted or past deadline; retain ambiguity, never blind resend |

`config` is strict: enabled=true, environment development/test/staging/production,
appOrigin, apiKey, sender (single bare mailbox), verifiedSender with the identical
sender/environment/appOrigin tuple, explicit allowedRecipients (1–100 bare
addresses), optional timeoutMs (1–30000; default10000). All environments remain
allowlisted. Attestation is an input requirement, **not proof the adapter verified
a domain**, authorization for real sends or production readiness. Missing/invalid
config or disabled flag returns rejected/configuration before I/O. No environment
variables/default credentials are read. SDK base URL is fixed to Resend and
redirects are denied; injected fetch/clock only works with test configuration.

Resend6.32.1 is already pinned. Real SDK send/create/post build the request,
including Idempotency-Key. Public fetchRequest is narrowly overridden to omit
the default SDK's raw development error logging. Errors have fixed safe messages;
provider headers/message/cause are discarded. HTTP status is taken from the
actual response, not a body-supplied statusCode. Changed-payload409 is permanent;
concurrent409 is retryable. Unknown409 fails closed. 429 is rate limited, other
5xx unavailable, 408/504 ambiguous; connection/timeout/invalid JSON/malformed
success ambiguous. Only a valid UUID response ID is accepted. Abort and local
deadline bound each attempt; timeout can still follow remote acceptance.

## Durable consumer requirements — W3/W4b

Before first dispatch durably record the immutable event identity, authorized
recipient, exact provider proof material, template version, application origin,
stable identity-secret version, sender/config version, fingerprint and
firstAttemptAt. Sensitive proof/body must use an approved private persistence
design and retention, never queue diagnostics/plain logs/public artifacts.
Alternatively invoke synchronously once and handle ambiguous results through the
provider's native recovery without automated retries; do not claim durability.
Consumer must regenerate **the same** constructor material and compare the
fingerprint with its pinned record before every retry, including after process
restart. Keep firstAttemptAt even if process crashes before acknowledgement.
Different proof/recipient/template/sender is a different logical message and
requires explicit new provider/domain event; changing the identity to evade a
409 or ambiguity is forbidden. Provider proof expiry can be earlier than retry
deadline and must be checked by the consuming provider workflow.

The adapter additionally detects changed fingerprint/firstAttemptAt in-process.
Each cache entry is evicted at its first-attempt+24h deadline by an unreferenced
cache timer; eviction performs no send or I/O and introduces no quota/worker.
That map is defense in depth, not a durable outbox or exactly-once guarantee.
Resend's documented key retention is24h. At/beyond firstAttemptAt+24h, send
returns uncertain/timeout without I/O; consumer retains an operator-blocked state.
Never reset the timestamp or automatically create a new key after expiry.
Accepted result acknowledgement/dedup belongs to consumer storage, not this
adapter. Do not schedule generic workers or claim exactly-once delivery.

W4b must resolve booking recipients only after committed mutation and recheck
current ownership/eligibility before dispatch. Booking templates/outbox wiring
are absent here. W4b owns actual Playwright account+booking journeys against
local provider simulation and failures after committed transitions. W3 owns
hosted config integration. Neither should alter provider source after freeze
without root reconciliation and affected re-review/verification. This foundation
does not clear commercial, legal, safeguarding, domain or public-mail launch gates.

Official source inspection2026-10-12:
[send API](https://resend.com/docs/api-reference/emails/send-email),
[idempotency retention](https://resend.com/docs/dashboard/emails/idempotency-keys),
[409/error distinctions](https://resend.com/docs/api-reference/errors).
Observed verification and exact source hashes are in the private W4a report.
