# M5.4 — Parent Dashboard discovery and Step 5 consistency

- Status: **AUTHORIZED — build-feature delegation**
- Date: 2026-10-17
- Authority: The owner reported a missing Parent Dashboard, supplied the approved
  Step 5 checklist, and answered “okay” to the coordinator's bounded navigation
  correction and verification proposal after the read-only recovery diagnosis.
  This is delegated execution authority, not separate human blueprint approval.
  Latest owner steering: retain a separate parent Bookings navigation item.
- Type: UI; existing server-authorized read composition is preserved.
- Primary work package: **M5.4**; related M5.3 shared composition, M4.9 details.
- PRD: **FAM-03, OPS-03, BKG-04**; preserve FAM-01 and AUTH-05 boundaries.
- Repository: `/Users/cob/learli`.
- Observed branch/HEAD: `feature/desktop-navbar-reference-20261017` / `616e8c7`.
  The checkout contains substantial earlier uncommitted work; preserve it.
- Working branch: retain the coordinator's current checkout; no branch operation
  is required by this plan.
- Diagnosis: `prompts/recovery/2026-10-17-parent-dashboard-discovery.md`.

Blueprint ready.

## Implementation Plan — Parent Dashboard discovery

### What we are building

A parent can find **Parent Dashboard** and a separate **Bookings** destination,
navigate to **Upcoming Sessions** and **Booking History**, see the first/only authorized booking within Upcoming
Sessions, open its existing guardian-scoped details, and refresh without losing
the selected learner. Child, tutor, actual subject, local date/time/zone and
server status stay consistent across the overview and details. The ordinary
development preview continues to identify its simulations honestly; confirmed
presentation is verified separately using the existing isolated private harness.

### Requirement and milestone mapping

- FAM-03/OPS-03 and M5.4 own authorized learner context, upcoming/history and
  coordination. BKG-04/M4.9 own participant-scoped actual detail/history.
- Existing `/parent` is dynamic and calls `FamilyDashboardPage`; metadata,
  sidebar entry and default h1 currently say Bookings. A selected learner changes
  h1 to Bookings for a name. Parent setup already returns to `/parent`.
- `FamilyDashboard` removes the nearest future booking from its agenda and puts
  it in a separate Next session card. A sole future booking therefore leaves
  Upcoming sessions with No other upcoming sessions. The route/data exist;
  discovery and containment are the identified mismatch.
- `readFamilyDashboard` already consumes one authorized booking overview,
  guardian scope, current account zone, selected authorized learners, and real
  active/history DTOs. No new query or authorization implementation is needed.

### Language we agreed on

- Parent Dashboard: the existing `/parent` coordination page, not a new portal.
- Upcoming Sessions: the section containing all displayed active coordination
  rows, including the highlighted nearest future row once. Existing simulation
  notices and state labels remain explicit outside private workflow mode.
- Booking History: the existing history section and pagination, not academic
  history or attendance verification.
- No terminology or business-policy clarification is required for this slice.

### Decisions made

- Keep the existing visual system and layout. Correct parent entry, hierarchy,
  section navigation and composition only; no broad redesign.
- Use a stable parent h1 **Parent Dashboard** and retain unmistakable selected
  child context as adjacent text. Multiple-authorized-learner GET selection,
  sole-learner naming and All learners remain available.
- Name the parent `/parent` sidebar destination and page metadata **Parent
  Dashboard**. Also name the parent link in Account → Your workspaces Parent
  Dashboard. Existing role chooser labels such as Parent workspace may remain;
  they describe role context. Student, Tutor and Admin entries remain unchanged.
- Retain **Bookings** as a separate parent sidebar link to the existing
  `/bookings?scope=guardian` list. The dashboard is the overview; Bookings opens
  the full authorized list/details/history and existing permitted actions. This
  adds no booking service or permission. On guardian booking lists/details,
  only the new Bookings item is current, not Parent Dashboard. Its current-page
  match requires exact guardian scope. Student/Tutor historical current-page
  behavior stays unchanged; unknown/foreign scopes match no parent item.
- Add parent-only native section links **Upcoming Sessions** and **Booking
  History**, using existing `#active` and `#history` anchors and preserving the
  current query via `dashboardHref` or same-document fragments. Do not add query
  tabs, route aliases, storage, new fetches or a second sidebar navigation model.
  Render those links only when authorized-learner sections are rendered, so the
  no-authorized-learner state never links to missing fragment targets.
- In the parent view, put the existing next-session card inside `#active` before
  the remaining agenda. Keep it once, retain its real fields/detail action, and
  remove the parent sole-booking “No other…” message. An empty message is shown
  only when the whole active list is empty. Student composition is unchanged.
- Parent section headings may read Upcoming Sessions and Booking History in
  both modes; the existing prominent local-simulation notice, factual simulation
  badges/expiry wording and development empty-state explanation must remain.
  This wording never grants confirmation or private-workflow capability.

### Assumptions

- The supplied Step 5 asks to verify actual persisted booking fields, not rename
  the actual subject catalog from Math to Mathematics. Render the stored name.
- The user's specific account/record has not been inspected; do not claim its
  booking is confirmed or that Step 5 passed on that account.

### Scope

- Included: parent dashboard and separate full Bookings entry/title, stable selected-child context, native upcoming/
  history navigation, nearest-card containment, existing refresh/details and
  truthful empty/unavailable states; focused regression and responsive checks.
- Excluded: private-workflow activation, environment/database/config changes,
  new fixtures in Neon, schema/migrations, role/guardian grants, booking state
  changes, policy/prices/payments, meeting behavior, server permissions, broader
  workspace redesign, deployment, commit/merge/push and unrelated dirty work.

### System invariants

- Parent role alone grants no child access. Current authorized guardian
  relationship, eligible account and participant read checks remain mandatory.
- Parent and Student records stay separate on a multi-role account; no Admin
  bypass, cross-family disclosure or new private metadata is introduced.
- Retain guardian-scoped `bookingDetailPath`, UTC instants, current account-local
  display, expiry projection, active/history grouping/paging and refresh semantics.
- Real server states remain real: default development simulation, private
  provisional/confirmed, cancelled/expired/completed are never relabelled into
  approval. Read/navigation does not mutate bookings or emit lifecycle events.
- No direct meeting URL appears in dashboard cards or shareable QA artifacts.

### Affected areas

- `src/components/workspace/navigation.ts`: parent dashboard and Bookings
  destinations, plus precise guardian-only list/detail current-page matching.
- `src/app/(workspace)/account/page.tsx`: parent Your workspaces link label only.
- `src/app/(workspace)/parent/page.tsx`: parent metadata only.
- `src/features/family-dashboard/dashboard.tsx`: parent-only presentation and
  hierarchy; small local next-card extraction is acceptable if it preserves all
  existing fields/semantics and avoids duplicate rendering. Parent Upcoming
  Sessions is h2; a nested next-card title is h3. Student title levels remain.
- `src/features/family-dashboard/states.tsx`: only if necessary to name the
  parent unavailable page consistently; retain real failure/recovery behavior.
- Existing affected tests: `tests/components/family-dashboard.test.tsx`,
  `tests/components/private-workflow-presentation.test.tsx`,
  `tests/components/workspace-shell.test.tsx`,
  `tests/e2e/family-dashboard.spec.ts`, `tests/e2e/workspace-shell.spec.ts` and
  `tests/e2e/private-fictional-workflow.spec.ts`. Update other exact heading
  assertions only where the intentional parent copy change requires it.
- No read-service, route/API contract, permission, SQL, dependency or runtime
  configuration changes are planned.

### Data and authorization changes

None. Reuse `readFamilyDashboard`, `listParticipantBookingOverview`,
`bookingDetailPath`, current strict query validation and existing private guards.
An unrelated/invalid learner selection still fails safely; current granted
role/guardian changes are rechecked on navigation/refresh.

### Workflow and failure states

- Parent workspace → Parent Dashboard → Upcoming Sessions → existing View
  booking → guardian detail. Parent Dashboard links/refresh retain selected
  learner and history-page query; Back/Forward retains existing GET restoration.
- The nearest future booking is inside the upcoming section; ongoing active rows
  remain in its agenda. History and active overflow links retain current scope.
- No learner: retain Add Child/review guidance and no invented records. Section
  links may be omitted while no authorized sections are rendered.
- No active/history rows: show truthful mode-specific empty states. Query/load
  failure retains safe unavailable/retry/account/support guidance.
- Refresh rereads current persisted status/instants. Existing expiration refresh
  and provisional deadlines remain unchanged. No new retry/concurrency rule is
  necessary for this read-only presentation change.

### How to build it

1. Capture/preserve the coordinator's dirty baseline. Apply parent-only sidebar,
   metadata and h1/context changes, then parent section navigation/containment.
   Keep the existing styling utilities and all native/pending/recovery behavior.
   Retain a separate `/bookings?scope=guardian` Bookings entry and update its
   exact active match, preserving other role behavior. Verify no dashboard link
   becomes current on a booking list/detail.
2. Update focused parent assertions and add one meaningful component regression:
   with one future confirmed private row, Upcoming Sessions contains that row's
   real child/tutor/subject/time/status and its exact guardian detail href once;
   no misleading empty/No other state. Cover provisional/default simulation,
   selected-child query/anchors, zero rows and unchanged Student composition.
   Cover both parent sidebar destinations, account entry label and correct
   current-page behavior for dashboard, guardian list/detail, absent/other scope,
   Student and Tutor.
3. The root coordinator owns extending the already constructed confirmed-booking point in
   `tests/e2e/private-fictional-workflow.spec.ts` (after `sameViews(...,
"confirmed")`, currently near lines1105–1115). Avoid constructing another
   huge onboarding fixture: navigate via Parent Dashboard, use Upcoming Sessions,
   compare its single nearest card with the current saved/API detail, open its
   guardian link, return/refresh and compare again. Keep its existing unrelated
   Parent/Tutor denials and all cross-role assertions. Test phone/desktop and
   keyboard section navigation at that point without changing workflow state.
   The implementation worker owns source/components/docs and affected existing
   label-observation E2E assertions elsewhere; do not concurrently edit the root's
   private-fictional-workflow file.
4. Separate Review/Verify own the checks below. Record outcomes/limits, update
   the checklist and tracker, and restart only the existing3000 preview with the
   verified source under the coordinator's current authority.

### Verification plan for the separate verification stage (DO NOT EXECUTE)

- Run focused existing component files above, then `npm run check` and
  `npm run build`. No dependency update is required.
- Run `npm run test:integration -- tests/integration/family-dashboard.test.ts
tests/integration/booking-read.test.ts` against the existing owned loopback
  test placement: role separation, current guardian/learner selection, read/detail
  fields, denied foreign IDs, timezones and read-only behavior. Do not point
  automated tests at Neon development or production.
- Run focused `family-dashboard.spec.ts` / `workspace-shell.spec.ts` through the
  existing normal test entry for native GET, labels, selected-child restoration,
  empty/error, guardian scopes and unchanged other roles. Preserve the existing
  no-JavaScript family test and its safeguards.
- Run `npm run test:e2e:private -- tests/e2e/private-fictional-workflow.spec.ts`
  against the existing dedicated normal-build private config/owned loopback
  harness. This file contains one existing connected journey; extend its actual
  confirmed fixture rather than presenting component data as database evidence.
- In that confirmed journey, compare child, tutor, actual Math subject, current
  status, exact `time[datetime]` UTC instants and viewer-local rendered context
  with detail/saved data. Check exact guardian href, section containment/no
  duplicates and equality after native reload/Refresh bookings. Existing
  provisional/confirmed/history and unrelated-account assertions stay intact.
- Inspect1440/390/320 widths, keyboard/visible focus, one h1/ordered headings,
  no horizontal page overflow and existing Axe support. Keep safe screenshots
  in ignored local artifacts with no credentials/private meeting URLs.
- Smoke the updated original3000 preview after the coordinator restarts it:
  route/metadata and actual active development environment are reported honestly.
  No staging/confirmed-booking claim follows from its simulation-only mode.
- Evidence: exact commands/counts/results, reviewed diff scope, responsive
  observations/capture references, isolated database target, and any failed or
  unrun check. Verification status: **NOT RUN — architecture planning only**.
- Operational checks: no migration/provider operation; retain existing3000
  account/data/environment and stop only task-owned alternate test processes.

### Context updates

- After verified implementation, update `context/progress-tracker.md` with exact
  evidence and remaining account/hosted limitations. Do not mark M5 complete.
- Add a brief parent-discovery clarification to `context/ui-context.md` because
  parent entry/title/section hierarchy now has a stable convention. No new tokens.
- Update `docs/qa/parent-tutor-session-checklist.md` Step5 source-gap wording to
  distinguish current development simulation from isolated private confirmed
  acceptance. Preserve historical results and leave the user's account-specific
  Step5 unverified unless it was actually observed.
- No PRD/architecture/business decision change is needed; this implements the
  established dashboard requirements and approved checklist.

### Risks and open decisions

- A shared component can accidentally alter Student behavior: branch only the
  parent presentation and retain an unchanged Student regression.
- Duplicate nearest-card rendering or broken heading levels can make tests pass
  while discovery stays confusing: assert containment and exact one detail link.
- Development and private confirmed evidence must stay separate. No unresolved
  material decision blocks this UI slice; real launch/policy gates remain open.
- Rollback: revert only this slice's presentation/tests/docs while preserving
  earlier dirty work; no database or environment rollback is necessary.

### Approval gate

- **AUTHORIZED — build-feature delegation**, 2026-10-17, bounded by the owner's
  reported discovery issue, supplied Step5 and “okay” navigation/verification
  acceptance. No separate blueprint review is claimed.
- Ready for coordinator implementation; separate Review and Verify follow.
- Production/destructive/provider operations, private activation, real intake,
  deployment and Git publication retain their explicit authorization gates.
