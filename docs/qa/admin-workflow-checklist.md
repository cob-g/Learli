# Admin workflow acceptance — private fictional scope

This corrects the owner's ten-step checklist to the implemented scoped operating
model. It defines acceptance, not a completed execution. Refer to the
[decision](../decisions/2026-10-16-scoped-admin-workflow.md) and
[results record](admin-workflow-results-2026-10-16.md).

## 1. Admin authentication

Use an explicitly trusted fictional Admin, not a public Admin signup. Open
`/admin` or sign in with a validated Admin return path. Complete actual MFA setup
or challenge; password alone must not open protected Admin data. Confirm own
identity, refresh, and later use real Sign out. Logged-out protected pages must
request authentication; role-only or stale/revoked MFA requests must be refused.
Default ordinary sign-in may return to Account; this is not an Admin denial.

## 2. Admin workspace

Check identity and navigation to assigned Tutor/learner reviews, subject catalog,
assigned bookings and supported account controls. In private mode, gated private
reviews/publication and safeguarding are not advertised as operational tools.
Account controls require the owned local-test packet; hosted support is deferred.
Platform-wide user/role/booking counts and charts are NOT IN THIS SLICE.

## 3. Scoped account management

Owner provisions each exact permitted nonself/non-Admin target and staff grant;
packet membership alone must not make an account appear. Search by literal name,
filter actual assigned role and active/suspended status, and traverse populated
pagination while preserving filters. Display roles read-only, with account state,
revision and attributed history. Test empty/no-match, invalid and duplicate query
fields. An in-packet ungranted account and an outside-packet granted account must
remain unavailable. No arbitrary role/profile changes, account creation or delete.

On a permitted fictional target, choose the existing fictional test reason,
inspect/dismiss/confirm the dialog, suspend and restore, refresh and verify one
attributed event per actual transition. Replay the same key safely; stale revisions
must conflict. Verify roles, sessions, existing bookings and unrelated accounts
remain stored. A failed post-wait packet/permission check must roll back both the
status change and its event. Reasons are QA inputs, not real safety findings.

## 4. Basic Tutor administration

Use assigned applications and the current evidence-based screening flow. Check
profile, subjects, levels, review status and current policy/evidence; no advanced
Tutor performance or curriculum controls. Status filtering/pagination operate on
assigned applications, not an all-Tutor directory. Verify incomplete evidence and
unassigned/outside-audience records are denied. The private old local-review API
must not approve or suspend a Tutor through retained legacy assignments.

Suspend/restore Tutor account access through its exact permitted account target.
During suspension verify public bookability/new valid-slot booking is denied and
saved bookings remain stored. After restore, current screening, active offerings,
verification and other independent eligibility gates must still pass. No deletion
or automatic new approval should occur.

## 5. Subject catalog

Verify actual seeded Math, Science, English, test preparation and academic-support
entries. Specialized entries are added/renamed with fixed ID/slug/category;
core launch names remain fixed. Exercise duplicate/invalid input, save/refresh,
activate/deactivate and audit/retry behavior. A new active subject is selectable
by Tutors; public discovery requires an actually eligible offering. Retain Tutor
references and booking/event records through changes. Historical displays use the
current name; no original-name snapshot is promised.

## 6. Assigned booking lookup

Owner supplies exact current workflow grants for the relevant logical bookings.
Find an assigned opaque booking ID, filter state, traverse real populated pages,
open details and refresh. Verify minimal permitted Tutor, learner, requester and
self/guardian context, level, subject, saved UTC/local time and state. No emails,
contact details or meeting credentials may appear in staff read payloads.

Inspect confirmed/upcoming and separately cancelled/replaced/completed history
where available. Check unchanged action restrictions and immutable revisions;
replacement rows are versions of one logical booking, not duplicate lessons.
A separate already-ended synthetic fixture may test actual Tutor completion only
when explicitly recorded as such. Unassigned/expired/revoked grants, other packet
records, role-only and stale-MFA requests must not reveal details or mutate data.

## 7. Reviews and ratings

NOT APPLICABLE to this private connected journey. Legacy local private moderation
is not public publication. Normal public review/rating composition remains gated;
no public review or rating is fabricated or enabled for this acceptance.

## 8. Payments

NOT APPLICABLE: payments disabled. No checkout, charge, refund, payout or payment
report is implied by confirmation or any Admin action.

## 9. Server permissions and audits

Use separate Admin/other-Admin/Parent/Student/Tutor/anonymous sessions. Verify page
and API denials, not only hidden navigation. Other Admins need their own exact
assignments. Test current verification/access/role/MFA and packet changes, outside
legacy grants, self/Admin account targets and foreign records. Audit actual
status, subject and workflow mutations with correct actor/target and safe retry;
do not claim every ordinary read or failed login is universally audited.

Also check current assigned learner admission: inactive pending profiles have no
Student/guardian authority; exact reviewer/evidence authorization creates only
intended access. Required support/safety operation and dispatch remain separately
scoped and policy-dependent; this checklist does not activate real safeguarding.

## 10. UI and navigation

At narrow/phone/desktop widths check menu, correct destinations and current markers,
labelled native search/filters, preserved pagination, tables/rows and long text.
Check keyboard focus, real validation/conflict feedback, confirmation and dismissal,
loading/unavailable/no-results states, refresh and actual logout/private-page/API
revisit. Run bounded Axe/overflow checks and report their exact page/viewport scope;
no full accessibility or visual audit follows from a few automated pages.
