# M5.5 — Automatic tutor booking updates

Status: AUTHORIZED — build-feature delegation. The owner requested on
2026-11-10 that the Tutor bookings page automatically reflect Student
cancellations and rescheduling. This records authority for this scoped build,
not separate approval of this blueprint.

## Outcome and trace

On the open Tutor bookings page, committed booking changes become visible
without a manual refresh. PRD TUT-06, BKG-04/05/06 and OPS-02; build-plan
M5.5, related M4.10. The current `/tutor` route is dynamic and loads an
authenticated, participant-scoped overview; it currently provides a manual
native GET / client router refresh. Existing unrelated uncommitted admin review
and QR work, plus pre-existing `designs/` and `next-env.d.ts`, are preserved.
Observed baseline: main at cbc55d7, with the prior uncommitted work in git status.

## Design and scope

- Use a bounded client refresh every five seconds while the page is visible and
  online, with an immediate refresh when it becomes visible or reconnects.
  This is near-real-time polling, not a WebSocket or a guarantee of instant
  delivery. Avoid overlapping refresh transitions and clean up timers/listeners.
- Reuse the existing dynamic server-rendered page, current identity/role and
  exact tutor ownership checks on every read. No new endpoint, client-visible
  private data, shared cache, schema, socket service, or booking mutation.
- Keep manual and no-JavaScript refresh; indicate the automatic behavior and
  connection state without announcing every routine refresh. The refresh should
  preserve browser state and not change meeting-link or booking authority.
- Automatic checks consume one full Tutor page request per visible tab per
  interval. Production load and any future push architecture require separate
  capacity evaluation; this slice does not claim hosted readiness.
- Offline, hidden, and unmounted pages stop periodic requests; returning online
  or visible triggers a fresh read. Network/server errors cannot guarantee a
  timely view; manual refresh remains available. No financial, child access,
  screening, cancellation, or rescheduling policy changes.

## Implementation and verification

Update `src/features/tutors/booking-refresh.tsx` and focused tests. Component
tests exercise periodic refresh, hiding, showing, offline/reconnect, overlap and
cleanup. Browser acceptance on an isolated test database checks a committed
booking status change becomes visible without clicking refresh and keeps other
tutors' data private; preserve the existing no-JavaScript/manual path. Exercise
real cross-account cancellation/rescheduling in browser when safely available.
Run repo check, relevant browser and production build checks; report actual
environment, failures and limitations. Review the exact change read-only before
execution of verification. Update progress tracker and architecture documentation
for the deliberately scoped refresh and operating cost; save local memory.
