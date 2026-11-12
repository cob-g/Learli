# Owner-only local booking lifecycle email

Authority: explicit 2026-11-12 request to implement provisional booking, expiry,
completion and no-show updates using the personal email until a domain exists.
Blueprint: `prompts/features/m5-07-resend-booking-lifecycle.md`.

Extend existing capability-bound local queue delivery only. Exact current owner
participant only; never substitute a recipient. Reuse the fixed Resend test
sender and existing idempotency, retention, permissions and safe failures.
Provisional says not confirmed and includes persisted expiry. Outcomes describe
recorded status, not verified attendance. No payments, refunds or child/meeting
information in these messages. Existing old three immutable bodies stay stable.

The established expiry function remains authoritative. Bounded activity-driven
maintenance and the existing explicit recovery command process overdue holds
and queued lifecycle work. This does not change policy, install a clock job,
automatically infer attendance, or activate general/hosted delivery. No activity
means delivery may wait for recovery. Tutor-scoped expiry may expire other overdue
holds for a selected tutor; emails still require exact current owner authority.

Verification status and operational limitations belong in the progress tracker.
Migration0049 narrowly admits the actual persisted deadline for local provisional delivery material; all existing identity/claim/immutability guards remain. No table, dependency or production activation change.
