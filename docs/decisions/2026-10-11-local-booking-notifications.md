# Local captured reservation-created notices

Date: 2026-10-11. Authority: **AUTHORIZED — build-feature delegation** under the
actual six-feature request for M5.7–M5.8 (OPS-04). Coordinator messages
`msg_3f2f42a57212` and `msg_65462e40fda7` freeze the event-trigger/manual-capture
contract and allocate migration 0012. This is local implementation authority, not separate
human blueprint approval or real commercial/consent/email policy.

Only the existing committed `demo_reserved` creation event queues notices. Its
creator (currently authorized guardian or eligible self learner) and assigned
tutor are resolved as a distinct account union. Queue rows carry event/account/
kind identity and safe delivery state, never learner details or message content.
The additive event trigger runs atomically with creation; it does not send or
capture, alter booking locks/status/immutable fields, or queue expiry notices.
The existing synthetic booking decision's no-notification wording describes the
baseline before this new request.

An owned manual invocation checks out an independent loopback `learli_app` Pool
connection. Only committed queue rows are visible; it processes at most 25 rows,
optionally for one exact creation-event UUID, with SKIP LOCKED claims. Final
recipient authorization and elapsed expiry are checked on that connection after
the claim. Revoked/ineligible/elapsed notices are suppressed with a generic safe
audited reason. Current recipient time zone is used; another participant's
display preference is never a tutor fallback. No public retry endpoint exists.
The recipient SQL statement is the current authorization/expiry snapshot, not a
promise that future revocation can retract a captured file. New tutor notices
require approved status; pending/rejected/suspended tutors are suppressed.
Historical authenticated detail access is a separately scoped provider contract.

Private ignored HTML files use one stable SHA256 event/account/kind identity and
atomic rename. Captured state means a local artifact, never email delivery.
Filesystem capture failure leaves booking/history intact and a pending retry;
safe fixed failure codes replace raw errors. A crash after publication before DB
acknowledgement can retry the same file. This is not an exactly-once guarantee
across filesystem/database or hardware crash windows.

Every notice says **local capture only**, **no email was sent**, and **not a
confirmed lesson**. Its subject/time/expiry and authenticated detail link include
no learner name/ID/level, guardian contact, meeting URL or token. Historical
captures remain private snapshots; subsequent revocation blocks new delivery
and protected detail access, not deletion of already captured local files.
Verification/password-reset local capture remains unchanged.

Alternatives rejected: capture inside the booking transaction (rollback leak),
untracked post-commit promises (lost failures), Redis/always-on delivery workers
(not needed for this bounded local exercise), real Resend delivery (unauthorized).
Real email, confirmation/change/cancellation messages, scheduled reminders,
payments, real users/minors and commercial/legal/safeguarding policies stay gated.
