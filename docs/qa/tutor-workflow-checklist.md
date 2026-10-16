# Approved Tutor Workflow Checklist

The owner approved the recommended corrections on 2026-10-16:
“okay lets do ur recommendation”. This records expected acceptance behavior,
not a passed Tutor journey or permission to activate open operating policies.
Blueprint: [M8.9 Tutor workflow acceptance](../../prompts/features/m8-09-tutor-workflow-acceptance.md).

The current application uses registration followed by **Become a tutor → Start
tutor application**. It does not offer Tutor in the signup account-type selector.
Photos and pricing are **Not Applicable**; use broad learner levels, not exact
school grades. Name changes belong in Account Settings; education, qualifications
and teaching experience share Teaching background. These are checklist corrections,
not a request to add unsupported fields or bypass approval.

## Prerequisites and result record

- [ ] Record the isolated environment, application version and enabled operating
      policy. Use fictional data unless real-family participation is separately
      authorized with its required safeguards.
- [ ] Keep Tutor A, unrelated Tutor B, Parent A, unrelated Parent B and the
      authorized admin/reviewer in distinct authenticated browser contexts.
- [ ] Use only safe booking references and generic participant labels in shared
      evidence; omit credentials, learner records and private meeting URLs.
- [ ] Record the learner level, subject, UTC start/end, participant timezones and
      expected status. Compare the same learner and booking throughout Steps 5–8.
- [ ] Establish an authorized guardian relationship and confirmed booking under
      the selected policy before claiming the later normal-flow steps passed.
- [ ] If using a Parent test, verify that it actually created this booking. The
      [2026-10-16 Parent attempt](parent-workflow-playwright-results-2026-10-16.md)
      stopped at Add Child and supplies no normal booking for this checklist.

Use PASS / FAIL / BLOCKED / NOT RUN / NOT APPLICABLE. Record an observed result
per step; a feature existing in source is not an executed test. The current
default admission and policy-booking compositions remain disabled.

## Step 1 — Register and start a Tutor application

Role: New Tutor A.

- [ ] Open Learli and create an account through Sign Up. Use Choose later for
      the current generic signup path; do not expect a Tutor account-type option.
- [ ] Verify the email using the approved environment's delivery mechanism.
- [ ] Sign in and open Become a tutor.
- [ ] Click Start tutor application and reach the Tutor profile form.
- [ ] Open the Tutor workspace and confirm the current account has Tutor access.
- [ ] Verify registration/application grants neither Admin access nor automatic
      public approval or booking eligibility.
- [ ] Verify a pending/rejected/suspended or otherwise ineligible Tutor cannot
      appear as bookable or receive a new valid reservation.

Expected: the verified account can prepare its own application. No Tutor booking
acceptance action is required by this checklist; none exists in the normal flow.
Use the approved eligibility/screening review before public bookability.

## Step 2 — Set up the Tutor profile

Role: Tutor A.

- [ ] Update Display name in Account Settings when needed, then open My Profile.
- [ ] Enter Headline, Introduction and Teaching background. Use Teaching
      background for education, qualifications and teaching experience.
- [ ] Select Math and the learner levels genuinely supported by this Tutor:
      Elementary, Middle School, High School and/or College Support.
- [ ] Select available specialized subjects and describe a specialty if relevant.
- [ ] Select teaching languages if desired; these are Tutor declarations.
- [ ] Select the Tutor's IANA teaching timezone.
- [ ] Save/submit, refresh and verify the persisted field values and offerings.
- [ ] Verify invalid required fields are rejected without losing valid input.
- [ ] Record profile-picture upload and session pricing as **NOT APPLICABLE**.

Expected: saved profile data persists. An application submission is not an
approval or verification of self-written credentials. An approved Tutor's edit
retains the existing review rules; a rejected application may be resubmitted.

## Step 3 — Check the public Tutor profile

Role: Visitor or Parent A, after Tutor A is currently publicly eligible.

- [ ] Open Find a Tutor, select Math and a supported learner level.
- [ ] Find Tutor A and open the public profile.
- [ ] Compare the display name, headline, introduction, teaching background,
      subjects, levels, specialty and declared languages with saved values.
- [ ] Verify the initials avatar; do not require an uploaded photograph.
- [ ] Verify self-written background/language information is not presented as
      independently verified qualifications or proficiency.
- [ ] Compare displayed dated availability and timezone with the saved schedule.
      Previewing a slot does not reserve it or establish a confirmed lesson.
- [ ] Confirm private email, learner/booking details and meeting links are absent
      from the public page and its metadata.
- [ ] Record pricing checks as **NOT APPLICABLE**.
- [ ] Verify a subsequently ineligible/suspended Tutor is no longer discoverable
      or bookable, including through a previously copied profile/booking URL.

Expected: public information is accurate and limited to eligible public fields.

## Step 4 — Manage Tutor availability

Role: Tutor A.

- [ ] Open Availability and verify the named teaching timezone.
- [ ] Add a day/time range, save and verify it after refresh.
- [ ] Add another range, edit one and remove one; save and refresh each result.
- [ ] Verify invalid/reversed/overlapping ranges are rejected. Valid adjacent
      ranges may be accepted; overnight/week-boundary ranges must be handled
      consistently with the existing scheduler.
- [ ] Open a second tab and verify a stale save cannot silently overwrite newer
      hours. Verify network failure preserves edits and provides recovery.
- [ ] With an existing booking, edit/remove weekly hours and verify the saved
      booking reference, UTC instants and status remain unchanged.
- [ ] Verify a blocking booking is still excluded from new candidate slots and
      another requester cannot reserve an overlapping active booking.
- [ ] Separately test dated time off against an active booking; verify the
      conflict is rejected without cancelling or moving that booking.

Expected: availability changes persist without corrupting saved bookings. Current
weekly-hour removal itself is allowed even when booked hours are removed; this
checklist does not invent a new rejection policy. Dated time off has its own
active-booking conflict guard.

## Step 5 — Receive the same booking

Roles: Parent A, then assigned Tutor A.

- [ ] Create a valid booking for Parent A's authorized fictional learner under
      the selected policy; record its reference and actual status.
- [ ] Open Tutor A's dashboard and locate that same booking.
- [ ] Compare permitted learner label/level, subject, date, start/end and status
      with Parent A's saved booking. Different local clock times must represent
      the same UTC interval, with each timezone shown.
- [ ] Open details, refresh/reopen and verify the same persisted result.
- [ ] Test any Tutor acceptance action only if the selected workflow implements
      it; otherwise record **NOT APPLICABLE**, not a missing confirmation.
- [ ] Check notification outcome separately: distinguish queued, captured,
      provider-accepted, failed and observed receipt. A local capture is not email
      delivery; a committed booking must remain correct if email fails.

Expected: the assigned Tutor sees the correct booking, with minimum learner data.
If normal admission/confirmation is unavailable, mark this step **BLOCKED** rather
than substituting an unrelated seeded reservation or claiming the Parent test passed.

## Step 6 — Supply and open the private meeting link

Roles: Tutor A and Parent A with the guardian-managed learner.

- [ ] Tutor A opens the same eligible booking and supplies a valid allowed HTTPS
      Zoom/Google Meet URL. Learli does not create the external meeting.
- [ ] Save and refresh; verify the private meeting information persists.
- [ ] Parent A opens the same booking while current access policy permits it.
- [ ] Verify unrelated accounts cannot read, replace or open the private link.
- [ ] Open the external meeting from both authorized browser contexts.
- [ ] Record application access/redirect separately from actual connection.
- [ ] If an authorized manual live-call check is arranged, verify both parties
      connect to the same meeting. Otherwise mark that subcheck **NOT RUN**.

Expected: authorized participants can reach the Tutor-supplied meeting. For this
guardian-managed scenario use the Parent account, not a separate child login.
Meeting reuse policy remains a separate open decision; do not imply Learli
controls provider settings or can recall a URL already shared externally.

## Step 7 — Record session completion

Role: assigned Tutor A; Parent A observes the result.

- [ ] If the live-call subcheck was authorized, conduct a short test session and
      end it. Ending the call alone must not update Learli status.
- [ ] Verify early call ending does not permit completion before the saved end.
- [ ] After scheduled end, Tutor A performs the supported manual completion.
- [ ] Verify completed status and exactly one event identifying the Tutor actor.
- [ ] Refresh/reopen and retry the same action; verify no duplicate transition
      or audit event and no false success for an unauthorized actor.
- [ ] Verify Parent A sees the same persisted final status in booking details.

Expected: assigned Tutor completion after scheduled end records an administrative
outcome, not attendance. This actor is already approved. The implemented v2 path
has isolated evidence; older v1 remains admin-only and the default factory remains
disabled. No-show authority or other test-policy terms are not approved here.

## Step 8 — Check Tutor booking history

Role: Tutor A.

- [ ] Open Booking History and find the same completed booking reference.
- [ ] Open details and compare learner-safe label, subject, UTC/local interval,
      timezone and final status with Steps 5–7 and Parent A's record.
- [ ] Refresh and sign out/in; verify the completed record still appears.
- [ ] In a separate scenario permitted by the selected cancellation policy,
      verify cancelled bookings are identified accurately and remain in history.
- [ ] Distinguish expired/no-show outcomes where supported; never label a
      cancelled, provisional or expired record completed to satisfy this test.

Expected: history reflects saved outcomes without losing records or changing times.

## Step 9 — Security and edge cases

| Scenario                                                | Required result                                                    | New complete-journey result |
| ------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------- |
| Tutor A attempts another Tutor's workspace/records      | Own workspace only; no foreign private records                     | NOT RUN                     |
| Tutor A opens another Tutor's private booking           | Denied without private record disclosure                           | NOT RUN                     |
| Tutor-only account opens Admin Dashboard/actions        | Denied; preserve legitimate separately granted multi-role accounts | NOT RUN                     |
| Tutor submits overlapping availability                  | Rejected or correctly normalized under existing schedule rules     | NOT RUN                     |
| Tutor removes weekly availability covering a booking    | Saved booking stays intact and blocks conflicting reservations     | NOT RUN                     |
| Tutor requests unauthorized learner data                | Denied; assigned booking reveals only necessary learner context    | NOT RUN                     |
| Tutor logs out and revisits protected pages/Back        | Authentication required; old private document is cleared           | NOT RUN                     |
| Tutor refreshes/retries booking management              | No duplicate/lost mutations; stale revisions conflict safely       | NOT RUN                     |
| Parent/unassigned Tutor attempts completion             | Denied; no changed status or event                                 | NOT RUN                     |
| Session, role, guardian or Tutor eligibility is revoked | Current server authority removes prohibited access                 | NOT RUN                     |

## Overall execution record

| Step                                       | New complete Tutor journey                                          |
| ------------------------------------------ | ------------------------------------------------------------------- |
| 1 Registration/application                 | NOT RUN                                                             |
| 2 Profile setup                            | NOT RUN                                                             |
| 3 Public profile                           | NOT RUN                                                             |
| 4 Availability                             | NOT RUN                                                             |
| 5 Same booking received                    | BLOCKED — normal Parent admission/booking prerequisites unavailable |
| 6 Private link and shared external meeting | BLOCKED for this journey; live connection NOT RUN                   |
| 7 Same booking completed                   | BLOCKED for this journey                                            |
| 8 Same booking history                     | BLOCKED for this journey                                            |
| 9 Security against these actors/records    | NOT RUN                                                             |

Overall: **INCOMPLETE / BLOCKED**, not a passed manual test.

Existing isolated evidence is separately scoped in the
[Parent Playwright report](parent-workflow-playwright-results-2026-10-16.md)
and progress tracker. The earlier 63 feature tests include Tutor application,
discovery, dashboard/access, history, meeting links and a historical v2 completion
fixture. They did not execute this new complete Tutor checklist; availability and
booking-notification browser suites were not in that selection. Do not count
test definitions as executed checks or a 303 redirect as a successful call.
