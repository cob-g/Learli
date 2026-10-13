# Transactional delivery operator contract

Authority: AUTHORIZED — build-feature delegation, W4 software preparation only.
Blueprint: `prompts/features/m8-10-transactional-delivery.md`. Implementation and
execution evidence belong in the worker report/tracker; this runbook is not a
claim of completed queue migration, live delivery or launch acceptance.

Real workflows remain disabled. Native account verification/reset/current-new
email callbacks await the supported SDK acceptance boundary synchronously. They
retain no raw proofs in a speculative durable queue. Failed/uncertain callbacks
return safe unavailable recovery, preserve cookies and acknowledge that account
changes may already have committed. Use native sign-in/verification/reset recovery.
Acceptance is not delivery. This task contacted no provider and sent no live mail.

Booking queue identities originate exclusively from W6's atomically committed
notice intents. The seven event kinds map to minimal versioned booking updates.
No child, meeting, authentication or support-report payload is accepted. Historical
local capture stays separate. Each queue item binds one immutable recipient
snapshot, template material, SDK key/fingerprint, sender/origin/configuration epoch
and original first-attempt instant. A changed address, participant authority or
material suppresses rather than reuses the key with altered content. Configuration
change blocks replay. Existing accepted notices cannot be recalled by revocation.

An explicitly invoked owner drain runs independently after booking commit, with
a 1–25-item bound. It takes short token claims, commits prepared attempt identity,
and releases transaction locks before awaiting the actual SDK. It repeats accepted
current recipient authority in preparation and immediately before sending. A later
revocation may race an already authorized send; no external recall is promised.
CAS acknowledgment requires the current unexpired claim. Concurrent drains and
crash recovery preserve exact identity, but do not establish exactly-once email.

The registered operator command is `npm run delivery:drain -- 25` with
the explicit validated hosted-synthetic packet and target. It is never called from
a booking request, scheduler, web resend endpoint or startup. Missing/disabled
mail configuration refuses sending. Any actual hosted target, migration or send
requires separate operation authorization; this wave exercised test-owned local
SDK HTTP boundaries only. Do not borrow another checkout's environment or secrets.

States are `pending`, short-lived `claimed`, `retryable`, `uncertain`,
`provider_accepted`, `suppressed` and `blocked`. Provider IDs establish API acceptance
only. Safe reasons contain no raw errors. Bounded429/5xx/concurrent-key409 retries
use identical payload/key; altered-key409 is terminal. Timeout/network/malformed
response or acceptance-before-ACK is uncertain. Original first-attempt time survives
all process restarts and claims. Every unresolved attempt at or beyond24h blocks
blind resend, as do exhausted attempts or changed configuration/material.

An operator seeing uncertainty must preserve the queue/event/provider evidence and
reconcile with the authorized provider and original recipient context before any
new action. No reset/replay/reconciliation UI/API is supplied by this work. Do not
reset timestamps, edit immutable payloads or delete history to make a retry pass.
Use a separately reviewed forward change for any future reconciliation capability.
SDK acceptance-before-ACK remains uncertain until an identical safe retry within
the retention window obtains and durably stores an accepted response.

Provider references checked2026-10-13 PHT:
[Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys) and
[API errors](https://resend.com/docs/api-reference/errors). Installed SDK is pinned
6.32.1; no dependency was added or changed by W4.
