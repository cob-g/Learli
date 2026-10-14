# Development build cache turned off

Date: 2026-10-14. Approved by the owner in session ("ok add that line").

## Problem

Under `npm run dev` pages sometimes reloaded about 30 times a second, clearing
forms and tripping sign-in rate limits. Turbopack answered the browser's HMR
subscription with a `restart` for the main client entry although no file had
changed, and Next replied "HMR hash mismatch", so the page reloaded again.

## Evidence

Measured on the loopback test environment, Next 16.4.0:

- A start → edit → restart sequence looped in 3 of 6 runs with the persistent
  Turbopack development cache (`.next/dev`, on by default) and in 0 of 5 runs
  (0 of 120 page loads) with it turned off.
- Live edits without a restart never looped (0 of 75 page loads).
- Deleting `.next/dev` always cleared a loop.

The trigger is restarting `next dev` on that cache after source files changed,
which coding sessions do constantly. No upstream report was found.

## Decision

`experimental.turbopackFileSystemCacheForDev: false` in `next.config.ts`.
Production builds are unaffected. Cost measured: after a restart, the first
`/tutors` request took 2.2 s instead of 1.8 s; repeat visits ~0.04 s either way.

Revisit when a newer Next release fixes the persistent cache.
