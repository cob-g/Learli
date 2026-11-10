# M5.5 — Live Tutor booking detail

Status: AUTHORIZED — build-feature delegation, 2026-11-10. The owner reported
that an open Tutor booking detail remains confirmed after Student cancellation
and requested the same live updates as the Tutor dashboard. This is authority
for this bounded fix, not separate approval of the blueprint.

## Diagnosis and scope

PRD TUT-06, BKG-04/05/06, OPS-02; M5.5 and M4.10. The existing M5.5 SSE
subscription is mounted only on `/tutor`; the authenticated detail route
`/bookings/[bookingId]?scope=tutor` reads current data but has no live listener
for confirmed records. Preserve the dirty `main` / `cbc55d7` baseline, including
the uncommitted prior SSE, admin/QR and unrelated work.

Reuse the exact existing Tutor-only SSE client lifecycle on the authorized Tutor
detail page. On change or reconnect, refresh that current route through its
existing participant/meeting authorization and server reads; retain its same URL,
history and current-head link. Cancellation removes inactive private meeting
access; rescheduling displays the old record as rescheduled and links to its
replacement. Keep existing slower fallback, visibility, reconnect and session
rechecks. Mount only after an authorized Tutor detail read; no new endpoint,
permissions, migration, external service, booking policy, or other-role stream.
Do not erase unchanged in-progress meeting form input during unrelated events.

## Verification and documentation

Read-only same-agent review and separate isolated verification: actual browser
Student cancellation and reschedule while Tutor detail remains open; compare
dashboard and detail, history, inactive meeting state and current-head link;
negative ownership and no-JavaScript behavior remain guarded; component regression
for shared event/reconnect/cleanup. Run full check, production build and scoped
browser tests without altering the user's local test bookings. Update tracker
and architecture notes and save the local memory handoff. Hosted load testing,
deployment and production migration remain separately gated.
