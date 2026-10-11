# Local synthetic booking exercise

This flow is available only with local Better Auth, loopback development/test,
synthetic `.test` accounts and fixture-owned learners. Open `/bookings/demo` after
signing in as an authorized parent or fixture College Support learner; choose the
learner, tutor, subject, display zone, and an actual server-generated time.

The response is a **simulated reservation**, with an explicit expiry. It is never
a confirmed/paid lesson. There are no meeting links, notifications or commercial
cancellation controls. Current server demo policy is in
`src/features/bookings/demo-policy.ts`; real terms stay OPEN.

Each create request carries a UUID retry key. The server stores an actor-scoped
semantic fingerprint and rejects changed payloads on that key. The form retains
the exact attempted payload after an unknown network/server result, so retry
recovers the same logical reservation. Expired same-key retries never renew it.
Starting another simulation gets a new key and still obeys overlap protection.

Expiry is materialized inside an authorized read/create transaction under the
tutor profile lock. Candidate queries also exclude elapsed rows independently.
Thus an abandoned test cannot block the next valid operation indefinitely; no
worker or clock-dependent database index is required. History is retained as
`demo_expired` with a minimal event. Runtime can neither delete history nor edit
the original learner/tutor/subject, UTC time, key, expiry or fingerprint. A database
trigger refuses early expiry and reactivation.

The generated booking migration has reviewed supplemental `btree_gist`, tutor
interval exclusion and immutable-field trigger statements that Drizzle snapshots
cannot express. Preserve these when integrating migration histories. Use forward
migrations; do not rewrite this branch's applied migration. Rollback means disable
the local route/use the reviewed baseline in a separate checkout; preserve the
owned cluster and synthetic history. Existing isolated browser fixture cleanup is
test-only and never a production retention process.

Private artifacts, environment files, captures, PostgreSQL data and local memory
are ignored. The source exercise owned DB55451/development3011/browser3111. The integrated
premerge candidate exclusively owns DB55461/development3021/browser3121.
No other checkout credentials or database are used. The coordinator-verified
time-off source was imported at fingerprint
`b4ad887b08ff9896ddf37b74200dcfc668436e4f1233195967cd900e56e6406d`.
Combined next migration `0009_typical_queen_noir.sql` retains its schema exactly;
booking0008 remains unchanged. Addition rejects overlap with an unexpired
simulated reservation under the shared tutor lock and preserves booking history.

Premerge authorization recovery uses READ COMMITTED fresh post-wait checks,
tutor-first conflict locking and actor serialization for the technical quota.
Provider-resolved sessions are rechecked on the transaction connection; role,
access, guardian-link and support capability grants remain restricted. Creation
and expiry events use the captured current database clock. See
`five-feature-premerge.md` for candidate evidence and the original failures.
