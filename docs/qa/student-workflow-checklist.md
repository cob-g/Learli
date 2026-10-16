# Student workflow acceptance — independent College Support

Scope: private fictional accounts, payments disabled. An eligible independent
College learner is the first Student case. Real-family/age/consent policies and
independently signed-in minors remain gated. This checklist specifies acceptance;
an implementation or a historical test does not mark a step passed.

## 1. Registration and independent admission

- Open Sign Up and choose College Student; supply fictional allowlisted details.
- Verify through the configured private test mailbox and sign in.
- Open College Student setup and request Independent College Support admission.
- Confirm the request stays pending with an inactive learner, no Student grant
  and no guardian link before review.
- Assigned MFA admin records current independent-eligibility evidence and
  authorizes the request through the existing application workflow.
- Refresh current status and open Student workspace. Confirm the trusted Student
  grant, owned active self profile and zero guardian links/automatic Parent role.
- Repeat with an unrelated Student B for meaningful ownership-denial checks.

## 2. Profile settings

- Use Account settings for account display name/timezone and Learners for the
  admitted learner's display name/timezone.
- Save, refresh and verify persistence and unchanged trusted roles.
- Confirm the reviewed learner level stays College Support and cannot be changed
  by a forged update. Do not add school, DOB, year or uploads for this test.

## 3. Find a Tutor

- Use actual directory filters Science and College Support.
- An actually eligible, approved Tutor must offer that same subject/level pair.
- Open the profile; inspect biography, combined teaching background, subjects,
  level and actual available times. Pricing/photo uploads: Not Applicable.
- If no matching Tutor is available, record the truthful empty state rather than
  claiming a discovery pass or inventing a result.

## 4. Request and confirm a session

- Select an open date/time and review the correct own learner, Tutor, Science,
  UTC interval and participant-local timezone display.
- Request booking; verify one provisional hold. A request is not confirmation.
- Repeat the exact request/idempotency key and check the same receipt, one
  reservation and one initial transition. A competing overlap must be rejected.
- An exactly assigned MFA admin confirms under the private QA prerequisites.
- Confirm status only after this server action. Checkout: Not Applicable.

## 5. Student dashboard

- Open Student workspace, compare the same booking, Tutor, Science, interval and
  state; open details, refresh and verify persistence.
- Student-only views contain only owned independent learner records.
- A legitimate Parent+Student account has separate Parent/Student lists, learner
  options, details, upcoming/history and pagination; grants do not merge views.

## 6. Private Zoom/Meet coordination

- Assigned Tutor saves a valid private link on the confirmed unended booking.
- Refresh and verify persistence; authorized Student and Tutor open the same
  destination. Public profile and unrelated Student must not reveal the link.
- An intercepted fictional destination tests Learli authorization/navigation only.
  Mark a real two-party Zoom/Meet connection separately NOT RUN until observed.

## 7. Completion

- Ending an external call alone does not change Learli status.
- Reject premature, Student-initiated or unrelated-Tutor completion.
- Assigned Tutor records completion only after the saved scheduled end; verify
  one attributed event and consistent Student/Tutor state after refresh/retry.
- If an already-ended historical fixture is used, identify it explicitly and
  report it separately from the newly scheduled future booking. No attendance
  claim or full-duration fresh-booking completion follows from that fixture.

## 8. Booking history

- Student sees correct Tutor, Science, date/time and final state after refresh.
- Check the completed historical record and cancelled/replaced records distinctly.
- History is not synonymous with completed: ended, expired, cancelled and replaced
  records retain their actual state and authorized detail/event history.

## 9. Cancellation and rescheduling

- Use separate eligible time(s), outside the private QA cutoff, not commercial
  terms. Current private changes require more than one hour before saved start.
- Reschedule through Student UI; verify a new row ID, same logical booking ID,
  next revision, old record replaced and exactly one current reservation.
- Confirmed remains confirmed; provisional retains its original deadline.
- Old meeting access retires; replacement needs a new private link.
- Cancel the current booking; verify Student/Tutor status, released slot/history,
  retired meeting access and safe identical-request retry.
- A failed conflicting move preserves the original valid booking and history.

## 10. Security and edge cases

| Check                                                         | Expected outcome                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------ |
| Student B reads Student A's learner, admission or booking     | Denied without private data                                  |
| Student B opens A's meeting link or changes A's booking       | Denied                                                       |
| Student B submits A's learner ID                              | Denied; no reservation                                       |
| Student-only account enters Admin/Tutor workspace             | Denied; legitimate additional roles are separately respected |
| Student attempts confirmation, Tutor link edits or completion | Denied                                                       |
| Unavailable/already reserved time                             | Rejected atomically                                          |
| Repeated booking/change with same request key                 | Same result; no duplicate reservation/event                  |
| Wrong Parent/Student scope on dual-role records               | Corresponding record excluded or unavailable                 |
| Logged out private page/API revisit                           | Sign-in required; no stale private record                    |
| Refresh/back/history after authorized operations              | Correct current state, no duplicate/lost records             |

## Result record

Record actual commands, branch/source state, passing/failing/not-run cases,
test mode/fixtures, real-delivery/video limitations and responsive/accessibility
scope in `student-workflow-results-2026-10-16.md` after execution. Hosted target
acceptance and deployment are separate; this checklist does not complete M8.
