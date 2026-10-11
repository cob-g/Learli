# Targeted recovery — queued authorization and booking history

Authority: **AUTHORIZED — build-feature delegation**, premerge integration request2026-10-11. Independent reviewer findings relayed by coordinator messages `msg_b3f4fcb00ced` and `msg_f1851159ac4f`. Scope is this candidate only, synthetic databases; frozen sources remain untouched.

## Diagnosis (Recover, read-only)

Mode1 targeted implementation defect. Booking SERIALIZABLE establishes a snapshot at its tutor-lock SELECT before any wait; independent guardian-link/role/access revocations do not modify that row and may remain invisible to subsequent authorization predicates. Time-off/profile/availability authorize before a domain lock without a post-wait identity check. Shared public eligibility omits trusted tutor role. Booking history defaults now() while reservation timestamps use a post-lock DB clock.

Existing assembled485 unit/126 PostgreSQL checks passed but lack these queued cases. No production or real-person impact was exercised. This is not polluted state, and no reset is indicated.

## Proposed scoped repair and verifier handoff

Use READ COMMITTED for the tutor-serialized booking transaction so statements after a lock wait observe committed revocations. Keep tutor-first row serialization, database exclusion/idempotency constraints, atomic history and bounded retry. Freshly recheck exact provider session and current verified active role plus ownership after the tutor lock for queued tutor mutations. Shared public eligibility requires an actual trusted tutor-role record. Use the captured post-lock DB clock explicitly for booking creation/expiry events.

Authorization linearizes at the fresh post-lock check: a revocation committed before that check must deny; a request already authorized can complete as an in-flight request. This does not grant role/access/link writes, add a broad lock framework, or change next-request provider revocation. Inspect support's READ COMMITTED post-case-lock predicates and session provider rechecks for equivalent issues; repair only demonstrated holes. Tutor-only profile/availability paths share the same wait boundary and need focused rechecks, preserving their existing grant/order behavior.

Separate implementation authors deterministic queued tests for guardian revocation, parent/student/tutor role deletion, actor/tutor suspension/unverification, caller session expiry/deletion and history timestamps; observe waiters with pg_stat_activity before committing revocation. First execute regressions against the original candidate to retain failure evidence, then apply repair, read-only re-review and execute affected/full candidate checks. Both original booking/time-off race orders, rollback, overlap and idempotency must still pass. Source histories/grants and commercial/safeguarding gates remain unchanged.

Verification status: NOT RUN by Recover. Diagnosis and proposal only; implementation and verification return to build-feature coordinator stages.

## Implementation and verification returned to build-feature

Original candidate regressions: `.local/authorization-repro.log` records nine failures
(queued guardian/role/access, tutor mutations and creation clock); one session case
already denied. Residual subject wait reproduced three read failures while create
rolled back correctly (`.local/subject-wait-repro.log`). Added final read authorization
before expiry/output. Nested runtime identity checks introduced pool starvation at
max5; `.local/support-repaired-attempt1.log` records unexpected503 for the sixth
quota request. Rechecks now SELECT the provider-resolved session ID on the existing
transaction connection; no token ownership or grants changed. Affected61 checks
passed (`.local/authorization-repaired-attempt2.log`).

Expanded53 booking checks initially had52 PASS and one invalid session-deadline
fixture (`.local/bookings-repaired-attempt3.log`): Better Auth normally refreshed the
artificially short pre-request deadline. The discriminating test now establishes
the deadline after provider resolution while waiting, then lets it actually pass.
No app workaround disables provider refresh. Final full-candidate evidence pending.

The independent repair reviewer identified an actor user FOR UPDATE / subject
admin audit-FK cycle for legitimate admin+parent/student users. A controlled test
executes the same subject UPDATE then audit INSERT order: the original booking
retry hid a40P01 victim until transaction-attempt instrumentation discriminated
it (`.local/actor-fk-deadlock-repro3.log`). The first draft fixture used an invalid
audit action and failed23514; corrected SQL is preserved in repro2/repro3. Only
the actor quota lock was narrowed to NO KEY UPDATE, compatible with audit FK
KEY SHARE while still serializing actor quota. PostgreSQL17
[row-lock documentation](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS)
supports that choice. All54 booking checks then passed, including no hidden retry
in this cycle (`.local/bookings-repaired-attempt5.log`). No admin behavior changed.

Distinct coverage is finite: tutor/subject/actor-user/learner waits; both parent
guardian and self student branches; actor/tutor verification and roles/access;
provider session deletion and a deadline established after provider resolution
then passing during a wait; time-off add/remove/effective reads; five authorized
concurrent transactions through max5 for profile/weekly/time-off/effective reads;
the support six-request quota through max5; cross-tutor atomic actor20/min limit;
creation and expiry timestamps after waits; public homepage/directory/profile/
matching/language inventory role removal. Shared transaction recheck paths need
no Cartesian duplication. Source overlap, rollback, retry/idempotency and both
time-off acquisition orders remain selected.

A final minor expiry boundary was confirmed: another reservation expires during
the subject wait, interval filtering ignores it, but its unswept demo_reserved
state still triggers exclusion409 (`.local/subject-expiry-repro.log`). Creation
now repeats expiry materialization after final fresh authorization and DB clock,
before overlap insertion. The existing early sweep preserves expired old-key
idempotent retry semantics. Unauthorized subject-wait tests assert no state or
history mutation; queued tutor denials now assert exact401/403 AccessError so a
connection failure cannot falsely satisfy a negative test.
