# Owner-only provisional, expiry and outcome email updates

Status: AUTHORIZED — build-feature delegation.
Authority: 2026-11-12 user request to implement provisional booking, expiry,
completion and no-show emails using the existing personal mailbox until a
sending domain exists. No separate human blueprint review is claimed.
Baseline main 74b0873; existing untracked designs/ and private state preserved.
Proposed branch: feature/resend-booking-lifecycle.

## Outcome and requirements

OPS-04, BKG-01/02/06, M5.7/M5.8: extend the existing owner-only local Resend
booking queue/delivery path to the four existing lifecycle events. Preserve the
three implemented messages, stable material/key behavior, booking rules,
current recipient ownership and hosted/production gates. Read AGENTS.md and the
eight canonical context files, reusing unchanged context from this session.

## Scope and decisions

- Same exact configured owner and fixed test sender. The owner must be a current
  participant; never redirect another participant's notice. Ordinary admitted
  local_operation only; default/test/hosted behavior stays unchanged.
- Branded provisional message says not confirmed and includes the actual stored
  confirmation deadline. Expiry says the provisional booking expired without
  claiming payment/refund. Completed/no-show are administrative records, not
  verified attendance; include existing support/dispute guidance and record link.
  No child names, private meeting URLs or unsupported attendance/financial claims.
- Existing mutation handler schedules after commit for complete/no_show as well
  as create/confirm/reschedule/cancel. Only persisted events may produce mail.
- Expiry is currently lazy: existing expire_policy_bookings commits the state,
  event and queue rows when invoked. Add a bounded local reconciliation before
  non-event-specific delivery drains: select up to 25 due tutors linked to the
  configured owner, use the existing function with tutor-first locking and a
  short lock timeout, then release transactions before sending. The function may
  expire other already-overdue holds for those tutors under its existing rule;
  only the configured owner's currently authorized emails are sent. No direct
  booking/proof rewrite, new policy or hold-duration change.
- Successful authenticated workspace renders and booking GET responses may
  schedule maintenance through Next after, at most once per minute per runtime
  pool. Rebind current config inside callback. A short in-process gate bounds
  repeated tab/refresh work; it is not authorization or a durable scheduler.
- Existing delivery:local also reconciles due holds and drains bounded work.
  Immediate mutation sends stay event-specific; maintenance/recovery handles
  other queued lifecycle work and due retries. No always-running loop, worker,
  timer-per-booking, cron activation or exact-deadline delivery promise. With no
  workspace activity, explicit recovery is still required.
- Preserve durable claim/immutable body/idempotency/attempt/retention safeguards,
  current recipient and latest-state checks. Email failure cannot alter a saved
  booking response. No automatic completion/no-show inference is introduced.

## Verified implementation discovery / scoped amendment

The first real provisional preparation was refused by the existing strict SQL
material allowlist. Migration0049 replaces only that guard function to permit
expiresAtUtc solely for local provisional notices, required to match the actual
booking deadline. Identity/claim/immutable/terminal guards stay identical; no
booking row, policy, table or existing snapshot is rewritten. This routine
technical repair is AUTHORIZED — build-feature delegation, not new policy.
The initial no-show denial test expected404 but current non-admin assurance
correctly returns403; test expectation is corrected without weakening access.

## Implementation

1. Extend local booking renderer/constructor and candidate kinds. Add an optional
   expiry instant to minimal booking material, projected only for local
   provisional messages; require it in the local constructor. Existing hosted
   snapshots and old three local message bodies remain unchanged.
2. Extend post-commit outcome scheduling. Add capability/config-bound expiry
   reconciliation and rate-bounded maintenance entry point; hook only guarded
   workspace/booking read boundaries, not domain read services.
3. Extend isolated ordinary-local fixtures/tests for provisional, true expiry,
   recorded completion/no-show, role/authority denials, concurrency/replay and
   stale-message suppression. Use existing queue/transport regressions.
4. Update governing docs, decision, runbook and verified progress; same-agent
   read-only Review, separate executed Verify and local memory handoff.

## Verification plan (not executed during architecture)

- Unit: seven-kind template/routing regression; truthful deadline/outcome copy,
  HTML escaping, timezone/DST and CID; unsupported/private inputs, missing
  provisional deadline, origin/exact-owner/hosted denial; outcome scheduling,
  maintenance gate/disabled behavior, callback and expiry failure isolation.
- Isolated owned PostgreSQL: genuine committed four-event queue creation and
  current recipient projection; no premature expiry; due expiry exactly once
  under concurrent maintenance; stale provisional suppressed; future/confirmed
  bookings unchanged; completion/no-show require existing actor and time rules;
  record link scope, no duplicates, old notification and durable failure cases.
  Historical synthetic fixtures may be inserted once with all guards enabled;
  do not shorten production policy or rewrite existing booking dates for tests.
- Production-build HTTP/browser maintenance and outcome behavior with provider
  interception; new email previews at390/1440 and relevant old regressions.
- Lint, typecheck, focused unit/database checks, production build with the known
  command-only12GB heap; no unrelated broad CI/E2E repeats.
- At most four explicitly labeled owner-mail previews may verify live provider
  acceptance if useful; no actual personal booking mutation or fake queue event.
  Inbox receipt and real committed-event delivery are distinct observations.

## Documentation and limits

Update architecture, PRD, UI context, build plan M5.7/8, progress tracker,
docs/operations/local-workflow.md and a decision record. Disable both optional
settings and restart to stop sends/maintenance. Pending history is retained;
automatic exact-time expiry/retries without activity and general-recipient
delivery remain separate scheduler/domain/operations work. No commit/push/merge,
deployment, dependency change, additional migration or production activation is implied.
