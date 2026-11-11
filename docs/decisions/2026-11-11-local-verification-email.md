# Optional local verification email

- Date: 2026-11-11.
- Authority: the owner requested Resend Free configuration, then narrowed this
  task to email verification first and confirmed Gmail-only testing. The owner
  will provide the API key later. No separate human blueprint review is implied.
- Scope: a separate worktree, explicit opt-in ordinary loopback development,
  one privately configured recipient matching the Resend account and the actual
  Better Auth verification recipient. No recipient substitution. The fixed
  `onboarding@resend.dev` sender is for testing, not a verified owned domain.
- Default and other flows: local capture. Password reset, email changes and
  booking email activation are outside this slice. Hosted sender/origin checks,
  account permissions, existing records and rate limits remain authoritative.
- Failure behavior: one bounded provider attempt; no automatic retry. Resend
  acceptance does not establish inbox arrival. Verification resend responses
  avoid account-state disclosures while retaining validation errors, throttling,
  private cache/referrer headers and a bounded local timing mitigation.
- Activation: requires a private Sending API key and confirmation that the
  configured recipient owns that Resend account. Links target this computer;
  general-user sending requires a verified owned domain and separate activation.
- Verification and provider access: record actual results in
  `context/progress-tracker.md`; source or this decision alone proves neither
  live configuration nor delivery.

Reference: [Resend test-sender restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain),
read through the owner's Obscura browser during this task.
