# Local synthetic booking exercise

Use local Better Auth, loopback development/test, synthetic `.test` accounts and
fictional learner profiles only. Open `/bookings/demo` as an authorized parent
or independent College Support learner, or choose a dated slot from a tutor's
public profile. The server rechecks the exact learner, tutor, subject and time.
Creating a missing fictional learner retains a valid public time selection.

A saved result is a **simulated reservation**, never a paid or real confirmed
lesson. The local defaults remain60minute duration,30minute step,60minute notice,
14day horizon and an original10minute expiry. These are demonstration settings,
not approved customer booking or cancellation terms.

Open **View booking details**. Before the scheduled start, an eligible current
family participant can cancel or choose a different eligible time. Cancellation
remains available if the tutor or offering later becomes ineligible; a move must
revalidate all current slot and tutor/subject constraints. The server serializes
competing changes and rechecks current authorization after lock waits.

Rescheduling creates an immutable replacement row with the same logical booking
ID and original expiry. It keeps the old schedule in history, does not renew the
deadline, and rolls back fully if the replacement conflicts. Actor/request UUIDs
and canonical payload identity make retries safe; a differing request cannot
silently overwrite a saved action. Browser uncertainty requires current reload
or the recorded retry path, never an assumed success.

The states are explicitly synthetic: reserved, expired, cancelled, replaced and
owner-controlled confirmed/completed fixtures. Terminal outcomes are not later
relabeled expired. Runtime users cannot confirm or complete a fixture, claim
attendance, renew expiry or edit original ownership/schedule fields. Ended
historical fixture completion belongs to guarded owner tooling only.

A tutor may supply a validated private Zoom/Meet test link for authorized
participants. Cancellation, replacement and other inactive states make the old
link unavailable immediately; a replacement never inherits it. Learli does not
arrange the meeting or verify attendance. Notification capture, when invoked,
uses private local files and never sends email; see
[Local booking notifications](local-booking-notifications.md).

Expiry and booking changes preserve audit history. PostgreSQL exclusion and
logical-head constraints protect overlapping active bookings; narrow runtime
grants and immutable-field/event triggers preserve original rows. Supplemental
constraints/functions/triggers exceed what Drizzle snapshots represent, so apply
the reviewed SQL chain rather than regenerating or replacing old migrations.
Rollback means disabling the affected local surface while retaining records,
not dropping history or resetting another checkout's database.

Each worktree owns its own ports, environment, PostgreSQL data and test artifacts.
Do not copy credentials, run tests against another worktree, or enter real learner
information. Commercial cancellation/refund/no-show policies, payment handling,
guardian verification and public launch remain separately gated.
