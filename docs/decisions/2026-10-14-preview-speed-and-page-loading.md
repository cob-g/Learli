# Preview speed and a page-loading bar

Date: 2026-10-14. Approved by the owner in session ("ok do it both").

## What was wrong

Clicking a link in the local preview felt slow. Measured against the running
preview, pages that read no data returned in about 20 ms. Pages that read the
development database took about half a second when clicked again at once, and
1.2 to 4.4 seconds after a 13-second pause. The time was in the database path,
not in rendering:

- The development pool closed idle connections after 10 seconds, and opening a
  new one to the hosted database took 0.8 to 1.9 seconds from the owner's
  machine. A page that needed two connections paid that twice.
- Every guarded query runs three verification queries first, so one query is
  four round trips (about 40 ms each to the Singapore region).
- Pages await their data, so nothing changed on screen during the wait.

## Decisions

1. **The development runtime pool keeps idle connections for four minutes.**
   Set in `src/lib/db/neon-operation-config.ts` for the `runtime` purpose,
   which is development only. Four minutes is shorter than the five after
   which Neon suspends an unused compute. Operator purposes (inspect, migrate,
   bootstrap) and the staging pool keep ten seconds. Every query is still
   verified exactly as before.
2. **A page-loading bar shows while a navigation is pending.**
   `NavigationProgress` in the root layout, described in
   `context/ui-context.md`. It is started by the router's own
   `onRouterTransitionStart` hook (`src/instrumentation-client.ts`) and held as
   optimistic state inside that transition, so React clears it when the
   navigation ends.

## Not decided

- **Verifying a connection once when it opens, instead of before every
  query.** It would remove most of the steady half second, but it changes the
  rule that every query validates transport, role, identity and privileges.
  Left as the owner's decision.
- **The tutor profile loads twice for a visitor.** After arriving, the page
  adds the browser's time zone to the address and fetches itself again. The
  bar shows both loads. Not changed here.
- **Hosted speed.** The same verification runs in staging and production. Its
  cost depends on hosting the app in the database's region (Singapore). Not
  measured.
