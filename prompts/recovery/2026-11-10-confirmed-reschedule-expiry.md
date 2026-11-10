# Confirmed reschedule after provisional deadline

Status: AUTHORIZED — build-feature delegation, scoped verification recovery.
Mode: Targeted Fix. Environment: owned synthetic local performance copy only.

The requested performance verification submitted a real Parent reschedule after
the fixture's original ten-minute provisional deadline. HTTP returned 503.
Direct current and SHA-256-verified pre-performance service calls both reproduce
PostgreSQL 23514, bookings_expiry_valid. Both attempts rolled back. No production
or walkthrough booking was mutated by these attempts.

Migration 0039's current change_policy_booking correctly preserves b.expires_at
while giving the replacement a current created_at. The older 0008 check requires
expires_at > created_at for every row. Thus an already confirmed booking, which
is explicitly supposed to survive its provisional hold, cannot reschedule after
that hold. This is an inherited invariant mismatch, not formatter/SSE regression.

Proposed minimal correction: a new forward migration and matching Drizzle check
allow a finite original deadline preceding a replacement's creation only for
non-provisional workflow replacement states (confirmed and its legitimate
terminal descendants). Root reservations, provisional/expired states and legacy
local_simulation keep strict expiry-after-creation. Existing protected column
grants, transition/history guards, immutable original expiry, authority, cutoff,
screening, overlap exclusion and receipt checks remain. No rows or receipts are
rewritten, no hold is renewed, and no public/commercial policy is chosen.

This is a narrowly necessary correction to BKG-03/05 under the user's current
build request and established confirmed-booking semantics, not a new business
approval. Amend the performance blueprint to disclose the forward constraint
correction. Separate implementation owns code/migration, review and verification.

Required verification: confirmed future booking with an elapsed original hold
can reschedule/retry/cancel while retaining exact expiry and audit history;
expired provisional remains denied, root/provisional malformed expiry remains
rejected, existing concurrency/ownership/screening checks pass. Fresh/populated
migration preservation and protection checks, production build and browser flow
must pass before any local operating-database apply. Preserve a private local
backup first; production remains untouched. No verification executed by Recover.
