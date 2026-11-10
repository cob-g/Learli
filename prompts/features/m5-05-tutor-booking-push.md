# M5.5 — Event-driven Tutor booking updates

Status: AUTHORIZED — build-feature delegation, 2026-11-10. The owner asked to
implement the recommended SSE + PostgreSQL notification design, with recovery
and fallback. This is execution authority for this scope, not an assertion of
separate blueprint review or of production deployment authorization.

## Scope and baseline

PRD TUT-06, BKG-04/05/06, OPS-02; M5.5 and M4.10. The local worktree at
`main` / `cbc55d7` already contains uncommitted admin/QR and M5.5 polling work;
all are preserved. Replace the Tutor dashboard's five-second polling with
event-driven updates; booking data stays authoritative in PostgreSQL and is
read through the existing participant-scoped server page. No payments, meeting,
booking policy, other roles' dashboards, external services, or deployment.

## Design and security

- An additive migration fires transaction-scoped PostgreSQL NOTIFY when an
  assigned booking is inserted or its state/time changes. Payload is only the
  tutor profile UUID; no learner details, URL, booking status, or credentials.
  Rolled-back transactions send no notification. Changes from all instances go
  through the database, not an in-process-only broadcaster.
- Each running app instance shares at most one lazily acquired, validated
  runtime DB listener among its local streams. A narrowly defined, sanitized
  notification forwarding path preserves the hosted guard's TLS/target/role
  checks and release cleanup. Do not use direct owner credentials or expose
  native pools. Release the listener after the last subscriber leaves. Listener
  failure closes affected streams; reconnect must re-establish LISTEN before
  issuing a fresh-read signal. No guarantee of durable notification delivery.
- An authenticated same-origin SSE endpoint identifies the current verified,
  active tutor and their own profile server-side, with no caller-chosen tutor.
  Recheck identity/session/role before signalling, terminate on denial and
  limit stream lifetime and idle resources. Send generic invalidations only;
  the existing authorized server read supplies booking details. Cross-account
  and role-denial responses must reveal no data. A fresh server read after each
  stream connection closes the LISTEN startup/reconnect race.
- Browser connects while visible/online; on open or notification refresh current
  authorized data, with manual refresh and slower periodic fallback for missed
  signals, connection errors and time-based expiry. Close on hide/unmount;
  reconnect with bounded retry. No event may grant booking access or change it.
- One listener lease per active app instance and long-lived HTTP connections
  have operational costs and can keep Neon compute active. Hosted streaming,
  replica fan-out, production migrations, cost and capacity remain unverified
  until an isolated staging load test. Do not treat local success as launch.

## Verification

Read-only same-agent review, then isolated owned PostgreSQL and browser checks:
committed versus rolled-back NOTIFY; unrelated Tutor and revoked-session denial;
two app listeners; connection failure/reconnect/startup race; no stale data on
return; stream cleanup; cross-role Student cancel/reschedule without manual
refresh; no-JS/manual and offline fallback; UI a11y; full check and isolated
production build. Update architecture, tracker and handoff with observed results.
Forward migration application to the user's existing dev database is separate
from isolated tests and requires data preservation; no production migration,
provider activation, production traffic or destructive action is authorized.
