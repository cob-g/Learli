# Parent dashboard discovery and Step 5 mismatch

- Status: UX/navigation correction resolved by separate implementation and verification; account-specific record remains unverified.
- Mode: Targeted UX/navigation correction plus environment clarification.
- Scope: existing development preview, source read-only investigation.
- Branch: `feature/desktop-navbar-reference-20261017`, HEAD `616e8c7`.
- Related requirements: AUTH-05, FAM-01/03, BKG-04; existing parent workflow.

## Original diagnosis — expected and observed

The user could not find a Parent Dashboard and supplied Step 5: open Upcoming
Sessions, compare child/tutor/Mathematics/date/time/status, open details and refresh.

Observed source: `/parent` exists and renders the shared family dashboard. Its
sidebar entry and default page heading are **Bookings**; a selected child changes
the heading to **Bookings for …**. Workspace/account links call it **Parent
workspace**. These labels do not match the approved checklist's Parent Dashboard.
The nearest future booking is deliberately shown separately as **Next session**;
the Upcoming sessions agenda omits it, so one booking yields **No other upcoming
sessions**. This is a discoverability mismatch, not evidence of a missing route.

Cards expose authorized child, tutor, subject, local interval/time zone, duration,
status and a guardian-scoped View booking link. Reads reuse participant booking
queries, and refresh reloads the dynamic route. No account-specific booking was
inspected or recreated; no runtime pass for the user's record is claimed.

The active preview configuration is development/local-auth/Neon-development with
no private-workflow packet. Its default dashboard uses development reservation
wording. Confirmed private-session presentation exists in source but cannot be
enabled merely by changing labels. Do not treat the configured development
preview as staging or a completed confirmed-booking QA journey.

## Evidence

- `src/app/(workspace)/parent/page.tsx` — existing dynamic parent entry.
- `src/components/workspace/navigation.ts` — parent Bookings link.
- `src/app/(workspace)/account/page.tsx` — workspace and parent setup entry.
- `src/features/parent-onboarding/continuation.ts` — successful setup defaults to
  `/parent`, preserving a selected tutor/booking destination.
- `src/features/family-dashboard/dashboard.tsx` — headings, nearest-booking
  extraction, card fields, private versus development mode and empty states.
- `src/features/family-dashboard/read.ts` and booking read service/query — current
  guardian authority, scoped records, shared persisted booking fields.
- `docs/qa/parent-tutor-session-checklist.md` — approved Step 5 labels and historical
  status. Its simulation-only source-gap statement needs environment-specific
  clarification; it is not evidence of a current private-session test failure.
- Existing component, PostgreSQL and browser tests were inspected, not executed.
  Earlier verification evidence is separate and does not prove this user's flow.

## Recommended separate implementation and verification

1. Establish the reached page when account-specific diagnosis is needed. The
   approved source/navigation correction can proceed without inspecting a private
   user record; no credentials or private details are requested.
2. Align the parent dashboard entry and heading with **Parent Dashboard**, add
   discoverable Upcoming Sessions/History navigation, and keep the nearest booking
   findable under the approved checklist without inventing records or statuses.
3. Preserve selected learner/booking continuation, explicit enrollment, current
   guardian checks, private links, booking policy gates and UTC/local-time rules.
4. Clarify current development versus approved staging/private workflow. Do not
   switch databases, enable real intake, grant roles, fabricate confirmed status
   or deploy automatically to make a checklist pass.
5. Verify navigation, actual participant-scoped card/detail equality and refresh
   using an authorized isolated synthetic booking. Include cross-family denial,
   provisional versus confirmed, empty/error and mobile/desktop states. Actual
   Step 5 remains NOT TESTED for the user's account until observed.

- Original Recover stage implementation/verification: NOT PERFORMED.
- Original Recover stage changed no source, tests, schema, environment, accounts,
  data or servers.
- Any subsequent implementation should use its own bounded authorized blueprint;
  destructive/production actions retain their explicit operation gates.

## Subsequent authorized outcome — 2026-10-17

The owner authorized the bounded correction and explicitly retained separate
Bookings. Blueprint: `prompts/features/m5-04-parent-dashboard-discovery.md`,
**AUTHORIZED — build-feature delegation**. Separate Implementation now supplies
Parent Dashboard entry/heading, guardian Bookings entry, query-preserving section
navigation and first-booking containment. Booking queries, policies, permissions,
status semantics and Student composition were not changed.

Independent read-only Review is READY FOR VERIFICATION with zero open findings.
Separate coordinator Verification passed full check (2,097 tests plus format,
lint/typecheck),37 actual local PostgreSQL tests, normal production build,
27 normal-build auth/family/workspace browser tests and the existing single
private confirmed guardian journey extended with Step5 assertions. Card/details
match saved identities, subject, UTC/local interval/zone and confirmed status;
refresh and section navigation preserve selected child and no booking/event/notice
writes occur. Captures/Axe/overflow/keyboard checks cover1440/390/320px;200% text
and forced-colors/reduced-motion states captured. Private evidence:
`.local/parent-dashboard-20261017/`.

Failed attempts retained: blueprint formatting, unsupported component-test role
query options and stale account-link label expectations. Focused test-only
repairs preserve the original assertions and were re-reviewed. No live data or
configuration repair was required. Build retains four existing filesystem tracing
warnings;144 actual traces exclude environment files and private local artifacts.

The original preview was rebuilt/restarted at loopback3000 with its unchanged
development/local-auth/Neon-development configuration. It remains simulation-only
outside an explicitly activated private workflow. No deployment/remote data
mutation, policy activation, role grant or Git operation occurred. The owner's
particular account and confirmed booking have not been observed; those remain
unverified. This outcome resolves the scoped source UX mismatch, not that unknown
account/environment condition or a launch gate.
