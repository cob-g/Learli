# Approved Parent–Tutor Session Checklist — Steps 5–9

Acceptance scope approved by the owner on 2026-10-16:
“ok appporove hte recommended checklist”. At approval, execution status was
**NOT RUN** for the complete journey below. Approval of expected behavior is separate from evidence
that the application implements or passes it.

Latest actual Playwright attempt, 2026-10-16: **BLOCKED at Add Child** in the
default application. New Parent registration passed; normal admission is
unavailable, no exact Grade 8 entry exists and ordinary booking remains
simulation-only. The separate **63/63 feature passes** use isolated scenarios
and do not complete this same-account journey. See the
[nine-step results](parent-workflow-playwright-results-2026-10-16.md). No live
Zoom/Meet connection was tested. The historical table below remains the result
at approval.

This continues the approved registration → linked child → tutor discovery →
booking journey in the [parent blueprint](../../prompts/features/m2-04-parent-onboarding.md).
It covers BKG-04/07, MEET-01–03 and OPS-02/03; build-plan M5.1/2/4/5/11.

## Prerequisites and test record

- [ ] Identify the approved isolated environment and exact application version.
- [ ] Use fictional learner data and dedicated test identities. Keep the Parent,
      assigned Tutor, unrelated Parent and unassigned Tutor accounts distinct.
- [ ] Complete registration, email verification and explicit Parent enrollment.
- [ ] Establish an authorized guardian relationship for the fictional child.
- [ ] Complete a booking under the approved confirmation policy with the selected
      tutor, learner, subject, start/end instants and participant time zones.
- [ ] Record the booking reference and expected status for comparison throughout
      the test. Keep private meeting links and account credentials out of reports.
- [ ] Record the permitted completion actor/action and when it may occur.

The exact staging target, real-family versus private-fictional operating model,
guardian/booking policies remain open. The assigned-tutor completion actor was
approved separately on 2026-10-16; the software/operating gates remain. Until the
relevant prerequisites are supplied, mark dependent checks **BLOCKED**, never
passed. Payments remain disabled; this checklist supplies no payment terms.

## Step 5 — Verify Parent Dashboard

Role: Parent A.

- [ ] Return to the Parent Dashboard.
- [ ] Open Upcoming Sessions and select Student A when a learner filter exists.
- [ ] Find the booking created in the preceding booking step.
- [ ] Compare booking reference, Student A, tutor and subject with the selection.
- [ ] Compare date, start/end time, duration and explicit time zone. The displayed
      local time must represent the saved booking instants.
- [ ] Check the actual status; a provisional/requested record must remain
      distinguishable from a confirmed session.
- [ ] Open booking details and repeat the identity/schedule/status comparison.
- [ ] Refresh or reopen the page and verify the same persisted result appears.

Expected: Parent A sees accurate information for an authorized linked child.

Current source gap: the family dashboard still exposes simulation-oriented
reservations; these checks are the normal-workflow acceptance target.

## Step 6 — Verify Tutor Receives Booking

Role: the assigned Tutor.

- [ ] Sign out of Parent A and sign in as the selected tutor, or use a separate
      authenticated browser profile.
- [ ] Open the Tutor Dashboard and upcoming bookings.
- [ ] Find Student A's same booking reference.
- [ ] Check the learner-safe label, subject, status and scheduled interval.
- [ ] Compare the scheduled instant with Parent A's booking; local clock times
      may differ when their account time zones differ.
- [ ] Open booking details and verify only the required learner information.
- [ ] Perform a booking-acceptance action only if the approved workflow actually
      implements one. Otherwise record that action as not applicable.

Expected: the assigned tutor can read the same booking with the proper scope.

Current source gap: assigned-booking reads exist, but the normal tutor acceptance
action does not. This checklist does not introduce an acceptance requirement.

## Step 7 — Provide and Join the Tutoring Session

Roles: assigned Tutor, Parent A with their guardian-managed child; an eligible
self-managed learner uses their own account in a separate applicable scenario.

- [ ] Tutor opens the same booking and saves a valid allowed HTTPS Zoom/Google
      Meet link in its private meeting field.
- [ ] Verify the save succeeded and the booking still has the correct identity.
- [ ] Parent A opens the confirmed session when the approved link-access policy
      permits it.
- [ ] Click Join Session and verify the intended external meeting opens.
- [ ] Tutor opens the same booking in a separate authenticated browser session
      and joins the same external meeting.
- [ ] Manually verify both authorized participants can connect to that meeting.
- [ ] If the link is missing, invalid, unavailable or no longer permitted, verify
      Learli gives an accurate state and does not offer an unusable join action.

Expected: both participants reach the tutor-provided meeting for the same booking.
Link validation/opening and successful connection are separate checks. Learli
provides coordination; it does not host or observe the external call.

For a guardian-managed child, use the Parent account. Do not require a separate
child login for this scenario. Meeting reuse/per-booking safety policy remains
subject to the governing MEET-01 decision; saving a booking link does not decide
that wider policy.

## Step 8 — Record the Session Outcome

Role: the assigned Tutor, as explicitly approved on 2026-10-16, with current
identity and eligibility. Parent and unrelated Tutor accounts must be denied.

- [ ] Conduct a short test lesson and end the external call.
- [ ] Return to Learli. Verify that ending the call alone did not mark attendance
      or automatically complete the booking.
- [ ] If the call ended before the scheduled booking end, verify the early call
      ending did not prematurely complete the booking.
- [ ] After the scheduled end, the authorized actor performs the supported manual
      completion action under the approved policy.
- [ ] Verify the saved final status and the audit/history event identifying the
      actor and transition time.
- [ ] Refresh the record and verify the outcome persisted.
- [ ] Verify a repeated submission does not create duplicate outcome events.

Expected: the booking has the accurate, manually recorded administrative outcome.
“Completed” does not assert verified Zoom/Meet attendance.

Operating gate: the older immutable v1 policy remains admin-only; the approved
assigned-tutor behavior is implemented as a distinct v2 capability. The shipped
policy factory remains disabled. Isolated software test results, once recorded
in progress tracker, do not establish a passed normal journey or live call. Leave
this full-journey step blocked until its environment/booking prerequisites exist.

## Step 9 — Verify Booking History

Role: Parent A.

- [ ] Sign in as Parent A and select the correct authorized learner.
- [ ] Open Booking History and find the same booking reference.
- [ ] Open details and compare learner, tutor, subject, date/time and time zone.
- [ ] Verify the persisted final status agrees with Step 8 and its saved event.
- [ ] Confirm a completed record remains accessible after refresh/sign-out/sign-in.
- [ ] In separate appropriate cases, distinguish cancelled, expired and no-show
      outcomes from completed records; never relabel one as another.

Expected: history accurately records what Learli persisted for that booking.

## Required access-denial checks

- [ ] Unrelated Parent B cannot read Student A's booking or private meeting link,
      including through a copied detail URL or a direct API request.
- [ ] An unassigned Tutor cannot read or change that booking's private link.
- [ ] An anonymous, expired or suspended account cannot retain protected access.
- [ ] Revoked guardian authority and no-longer-permitted booking states remove
      access according to the current authoritative policy.
- [ ] A role switch or sign-out clears the previous account's private screen.
- [ ] The guardian-managed child's details/link remain absent from public pages.

## Execution record

Record PASS / FAIL / BLOCKED / NOT APPLICABLE with the observed environment,
version and non-sensitive evidence. Optional actions being unavailable are not
evidence that required workflow steps passed.

| Check                            | Result at approval | Evidence                              |
| -------------------------------- | ------------------ | ------------------------------------- |
| Step 5 Parent dashboard          | NOT RUN            | None for the complete new journey     |
| Step 6 Tutor dashboard           | NOT RUN            | None for the complete new journey     |
| Step 7 shared external meeting   | NOT RUN            | No live call conducted                |
| Step 8 authorized manual outcome | BLOCKED            | Operating prerequisites unresolved    |
| Step 9 resulting history         | NOT RUN            | Depends on the recorded outcome       |
| Cross-account denials            | NOT RUN            | Must run against the selected journey |

Existing local feature tests and previous Parent enrollment results retain their
own documented scope. They do not constitute a passed execution of this entire
checklist. Full-journey readiness remains **INCOMPLETE**.

## Scoped software evidence — assigned Tutor completion

The separate completion capability was verified on isolated historical synthetic
fixtures on 2026-10-16: assigned Tutor action after the saved end, one audit event,
HTTP retry, denied other actors and matching Parent detail/history. Actual
PostgreSQL and selected Chromium evidence is in `context/progress-tracker.md`
and `.local/tutor-completion-20261016/verification.json`. The shipped factory
remains disabled. This closes the actor decision/software subset; it does not
turn the complete journey table above into PASS, establish external attendance,
or authorize staging activation under the other unselected booking terms.
