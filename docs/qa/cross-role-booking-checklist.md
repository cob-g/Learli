# Cross-role booking acceptance

Scope: the owned local test database, fictional private accounts and disabled
payments. See the [authorized blueprint](../../prompts/features/m8-09-cross-role-booking-acceptance.md).
Execution outcomes belong in the [results record](cross-role-booking-results-2026-10-16.md).
An implementation or earlier independent role pass is not a pass for this matrix.

## Two supported journeys

- **Guardian:** Parent books for an authorized guardian-managed learner; the
  Parent, assigned Tutor and exact assigned current-MFA Admin inspect the record.
  The child has no separate login. A Student view must not gain access.
- **Independent:** Eligible College Student books for their own admitted learner;
  that Student, assigned Tutor and exact assigned current-MFA Admin inspect it.
  A Parent role has no automatic authority over this record.

Use separate browser contexts. Match the logical booking and physical version,
subject, permitted learner/Tutor/requester labels, UTC instants, local timezone
context and state. Refresh/reopen each view after changes; live push is not part
of this acceptance. Admin receives minimum support context, never meeting URLs.

## Lifecycle, for each journey

| Step                 | Observable acceptance                                                                                                                                                                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Request           | Actual participant UI creates one provisional request for the selected learner, Tutor, subject and UTC interval. Assigned Admin confirms the prerequisites through the actual UI.                                                                                                                                |
| 2. Tutor view        | Assigned Tutor dashboard/detail and a fresh read agree with the participant's saved booking. Foreign Tutor cannot read it.                                                                                                                                                                                       |
| 3. Learner ownership | Guardian journey is visible through Parent; independent journey through Student. Opposite scope and foreign accounts are denied.                                                                                                                                                                                 |
| 4. Admin view        | Before assignment, packet membership alone exposes no booking. Exact assigned current-MFA Admin lookup/detail agrees with participant/Tutor records.                                                                                                                                                             |
| 5. Meeting changes   | Tutor saves and updates an allowed fictional meeting link. Authorized fresh reads/open route use the current destination; external navigation is intercepted. Admin and unrelated users receive no credentials.                                                                                                  |
| 6. Completion        | Future booking rejects premature completion. A separately labeled already-ended fixture completes through actual assigned-Tutor controls and appears completed in authorized history and assigned Admin view. This does not prove a newly booked lesson elapsed or anyone attended.                              |
| 7. Cancellation      | Participant cancels; refreshed participant/Tutor/Admin views agree, history remains, meeting access expires and the reserved interval releases. One mutation event and the expected requester/Tutor notification intents remain under replay.                                                                    |
| 8. Rescheduling      | Participant chooses another actual available interval. Replacement retains logical identity, increments physical version, preserves the original interval/history, releases the old slot and reserves the new one. Old link expires; replacement starts without meeting information. All authorized views agree. |
| 9. Integrity         | Distinct admitted learners cannot both reserve an overlapping Tutor interval. Double-click/replay and committed-but-unreceived response recovery leave one intact reservation. Booked-interval protection and cross-account denials remain enforced.                                                             |

The connected future-booking branch exercises reschedule before cancellation so
both transitions have an active valid source. Completion uses a separate ended
fixture instead of changing the future booking's timestamps.

## Submission recovery and concurrency

- Forward the actual create request once, wait for server commit, withhold its
  response, then hard-refresh. Recover the saved booking through the dashboard.
  Replay the captured original key and verify identical record/event and counts.
  A different key against the occupied interval must conflict. Do not promise
  automatic key persistence or automatic replay across a browser reload.
- For two distinct College learners, observe both real database transactions
  waiting behind a controlled Tutor lock before releasing it. Exactly one wins;
  the loser gets a conflict and cannot read the winner's private booking. After
  authorized cancellation, the loser may book the released interval with a new key.
- Reuse actual PostgreSQL booked-availability, ownership, rollback and meeting
  tests. Record the exact executed selection; never label the full security matrix
  passed solely because adjacent suites exist.

## Separate checks and launch limits

- Queued notification intents do not prove Resend sent or delivered email.
- An intercepted external destination does not prove Zoom/Meet connectivity,
  attendance or automatic completion. Shared external URLs cannot be recalled
  by denying subsequent Learli access.
- Real email/video, a full-duration newly booked lesson, hosted/staging acceptance,
  real-family safeguarding and production readiness remain separate verification.
- Payments and repeated payment callbacks are **NOT APPLICABLE** while payments
  remain disabled. Independent minor login remains unapproved.
- Prior Parent/Tutor, Student and Admin local passes retain their recorded scope;
  manual QA and new connected acceptance must be reported separately.
