# Owner-only local booking confirmation and change emails

Status: AUTHORIZED — build-feature delegation.
Authority: 2026-11-12 user request to implement booking confirmation,
reschedule and cancellation notices using the existing personal email until
a sending domain exists. This does not claim separate human blueprint review.
Baseline: main 0caa817; untracked designs/ and private configuration preserved.
Proposed branch: feature/resend-booking-notices.

## Outcome and requirements

OPS-04, BKG-01/04/05, M5.7/M5.8: automatically attempt owner-only local booking
confirmed/rescheduled/cancelled email after a successful committed workflow
mutation. Use the existing durable transactional_deliveries queue, current
participant authority, claim lease, immutable payload, stable idempotency and
bounded retry states. Preserve booking success independently of email failure.
Read AGENTS.md and the eight canonical context files before implementing.

## Scope and decisions

- Only ordinary admitted loopback local_operation bookings and the three
  requested event kinds are eligible. Existing exact
  LOCAL_VERIFICATION_RESEND_KEY/LOCAL_VERIFICATION_RECIPIENT settings enable the
  feature; verification/reset/email-change behavior stays unchanged.
- The configured recipient must itself be a current authorized participant.
  Never substitute another participant's email. Leave excluded destinations and
  provisional/expired/completed/no-show notifications untouched and unsent.
- Fixed Learli <onboarding@resend.dev> sender, existing SDK safe HTTP/error and
  timeout handling, stable per-event/recipient/kind provider idempotency. Keep
  hosted HTTPS/verified-domain and synthetic allowlist guards unchanged by
  providing a distinct capability-bound local composition path.
- Branded current-kind-specific subject, text/HTML and CID wordmark, actual
  subject and localized schedule with timezone; reschedule uses replacement
  booking time. Cancellation describes the cancelled slot. Private record link
  requires sign-in; omit names, child details, meeting URLs and payment claims.
  Local test nature remains truthful; provider acceptance is not inbox receipt.
- After the service transaction resolves, the existing workflow handler schedules
  one bounded event-specific Next after callback. No synchronous provider I/O in
  booking transactions, response rollback or automatic periodic worker. Current
  queue supports retries through a bounded explicit local CLI; document this.
- Existing source/beneficiary/screening/status and latest-revision checks remain
  authoritative before prepare and before send. Suppress obsolete messages.
- No schema migration, new dependencies, business-policy changes, hosted or
  general-recipient activation, personal account/profile changes, production,
  commit/push/merge, or unrelated provisional/lifecycle delivery.

## Implementation steps

1. Add local branded booking rendering and a capability-bound local message
   constructor without changing hosted template semantics/fingerprints. Escape
   dynamic copy in the shared branded shell; preserve current auth templates.
2. Reuse the existing Resend SDK transport's send/error/retry implementation from
   a separate exact-owner local factory. Retain its public strict HTTPS schema.
3. Bind local queue delivery to actual admitted runtime and current private
   configuration; limit candidate selection to owner, local source and three
   events. Reuse the existing drain and independent post-commit database reads.
4. Add post-commit workflow-handler scheduling and explicit bounded retry CLI.
5. Add tests and update decision, context, runbook and progress documentation.

## Acceptance and verification (not executed during planning)

- Unit: three messages, exact times/DST/timezone, subject escaping, text/CID,
  proof-free record URL, no private learner/meeting data; invalid/local/hosted
  boundaries, exact owner, unsupported source/kinds, safe errors and timeout.
- Scheduler/handler: only successful committed supported workflow mutations
  schedule; refused/rolled-back changes do not. Callback/fetch failure cannot
  turn booking success into failure. Default/test/hosted paths stay disabled.
- Real isolated PostgreSQL queue integration: confirmed/rescheduled/cancelled
  events, replacement schedule, non-owner no-send, committed-row visibility,
  concurrent drain/no duplicate, replay/idempotency, provider failure leaves
  booking correct, lost-response retry same immutable key, stale and revoked
  recipient suppression. Reuse existing mature drain regression coverage.
- Actual owned local runtime check with synthetic participants and intercepted
  provider, plus production-build route/browser confirmation/change checks.
  No personal account mutation; at most bounded live owner-notice requests for
  legitimate current owner-participant events if safely available. Never replay
  arbitrary historical personal notices to manufacture delivery evidence.
- Lint, typecheck, relevant existing auth/transport/delivery/booking tests,
  production build (documented command-only 12 GB heap if needed), 390/1440 email
  preview checks. No broad unrelated full CI/browser loops.
- Same-agent read-only Review, separate executed Verify and local memory save.

## Documentation, risk and rollback

Update architecture, PRD, UI context, M5.7/8 build plan, progress tracker,
docs/operations/local-workflow.md and a scoped decision record. No migration.
Disable both optional settings and restart to stop local live delivery. Pending
queue rows/history remain; retries respect current authority, immutable material,
attempt limits and provider key retention. Next after is best effort, not a durable
scheduler; explicit recovery drain handles missed/retryable work. General-user
and hosted activation remain separate domain/operations gates.

References: Resend test-sender restrictions and idempotency documentation;
Next.js after documentation. No unresolved business decision blocks this slice.
