# Parent Dashboard

Targets: `/parent`, its Account → Your workspaces entry and the parent workspace
navigation; existing `FamilyDashboard` and `DashboardUnavailable` components.
Mode: Operate. A focused extension of the incumbent Learli workspace world.

## Direction contract

THESIS: Make the existing parent overview discoverable and place the nearest
booking within Upcoming Sessions, with its child, tutor, subject, local time and
actual status together.

OWN-WORLD: Reuse the original Learli wordmark, Lexend interface, Paper ground,
White working surfaces, Navy hierarchy/current navigation and Deep teal links
and focus. `DESIGN.md`, `.impeccable/design.json` and `context/ui-context.md`
remain the incumbent system. This surface adds no tokens, fonts, artwork,
decorative motion or elevation.

FORM: Parent Dashboard is the stable page title, h1, sidebar entry and Account
workspace entry. Selected-child or all-authorized-learners context follows the
h1; multiple learners retain native GET radio selection. A separate Bookings
sidebar item opens `/bookings?scope=guardian` and alone becomes current on
guardian-scoped booking lists/details. Student and Tutor behavior is unchanged.

The native Upcoming Sessions and Booking History links retain the current
learner/history-page query and point to `#active` and `#history`. They render
only when their authorized-learner sections exist. Upcoming Sessions is h2;
its nearest future booking appears once in the existing flat bordered White
card, whose next-session title is h3. Remaining active bookings use dated rows;
Booking History retains its existing rows and pagination. The parent active
empty state appears only when the whole active list is empty. Student keeps
its existing next-card placement and heading level.

The card uses the shared surface radius and 24px padding, increasing to 32px
from the medium breakpoint. Its date/time and booking details occupy two
columns there and stack on phones. Section links, actions, names, time-zone
context and status text wrap in normal flow; the existing desktop sidebar and
narrow Menu/account header remain intact.

STATE: Preserve the explicit default local-simulation notice and simulation
badges/deadlines. Private provisional requests still await review and can
expire; actual confirmed bookings state that confirmation does not expire.
Keep account-local `LessonTime`, status-check disclosure, query-preserving
Refresh bookings and guardian-scoped View booking. No meeting URL appears in
the dashboard. No-authorized-learner, empty history and unavailable/retry states
retain their real explanations and recovery actions; navigation grants no access.

ACCESS: Retain visible focus, native anchors/radios, labelled sections and
44px minimum link targets. Confirmed status has text and an icon alongside
color. Enlarged text and forced colors retain readable content and controls.

Authority: [approved blueprint](../../prompts/features/m5-04-parent-dashboard-discovery.md),
recorded as **AUTHORIZED — build-feature delegation**. Source inspection covered
`src/app/(workspace)/parent/page.tsx`, `src/app/(workspace)/account/page.tsx`,
`src/components/workspace/navigation.ts`, and
`src/features/family-dashboard/{dashboard,states}.tsx`, with shared tokens
checked in `src/app/globals.css`.

## Evidence provenance

This documentation pass compared source and all six actual captures under
`.local/parent-dashboard-20261017/captures/`: `parent-empty-1440.png`,
`parent-confirmed-1440.png`, `parent-confirmed-390.png`,
`parent-confirmed-320.png`, `parent-confirmed-text-200.png` and
`parent-confirmed-accessible.png`. They show the empty and confirmed fictional
private-harness states, desktop/phone wrapping, 200% text and forced-colors /
reduced-motion presentation. They are local evidence, not a hosted deployment.

The coordinator supplied separate observed verification: format/lint/type checks
and 2,097 tests passed; 37 PostgreSQL tests, the normal production build, 27 local
browser checks and one existing connected private guardian workflow with the
new Step 5 assertions passed. Axe, page-overflow and keyboard-anchor checks
passed at 1440/390/320px. Build inspection covered 144 traces with `.local` and
environment files excluded; four existing filesystem warnings remain. The detector exited 0 with
empty output; no finding count is inferred. The independent finish reviewer
reported **SHIP**, no material fixes and six valid captures. This documenter
ran no checks, detector or build.

No defect is canonized as a design rule and no global system repair is made.
Owner-account Step 5, staging deployment and video attendance remain unverified
by this evidence.
