# M1.5 — Dedicated workspace shell

Status: AUTHORIZED — build-feature delegation
Authority: owner's 2026-10-14 request, dispatched as task_3c5184458f2c /
ctx_f116eb75550c. The owner approved same-tab dedicated role workspaces with
no landing navbar, mobile marketing dock or footer. This records delegated
execution authority, not independent approval of this generated blueprint.

## Outcome and requirement mapping

Parents, eligible students, tutors and administrators use the existing private
routes within a responsive task-oriented shell. Public and auth routes retain
their existing marketing presentation. M1.5 owns shared shells; related M5.3–6,
AUTH-02/03/04, PUB-01, NFR-01/02/05/07/09 preserve current behavior.

Repository: /Users/cob/learli, branch fix/e2e-test-env, HEAD c4c28fb115fd334ac542eee9f6967f2b4de6d207.
No branch change is proposed. The very dirty pre-existing tree is preserved in
ignored .local/workspace-shell/baseline, baseline-manifest.json and baseline Git
status/diff/staged evidence, including relevant pre-existing untracked files.
Read AGENTS.md and all eight canonical context files in their specified order;
consult the brand-kit, document-lifetime and signed-in navigation decisions.

## Decisions, scope and invariants

- One root document retains fonts, metadata, skip link and shared providers.
  Marketing/auth group shells own SiteHeader, main and SiteFooter. Workspace
  owns its main, solid desktop sidebar/compact topbar and responsive menu.
  Root not-found/error recovery retains a valid main/skip target.
- Use existing routes only. Parent/student: bookings, learners and Find a tutor.
  Tutor: bookings, profile, availability, time off and existing screening route.
  Admin: existing review/catalog/support/account areas plus existing admission,
  safeguarding and dispatch destinations. No invented general admin booking list.
- Assigned roles come only from existing guarded GET /api/account/[userId],
  after the provider identifies a current session. No new endpoint or server
  authorization behavior. Navigation has no authority over page/data access.
- Current workspace role requires both an explicit role path and a matching
  trusted grant. Shared /account, /bookings, /learners, /support and other shared
  paths use neutral account context, even for single-role accounts. No arbitrary
  precedence, localStorage role or query-string assertion. The role chooser
  offers only real grants; one-role accounts have a workspace link.
- Provider pending/refetch/error and guarded account read failure show neutral
  recovery without stale name/roles. Cancel outdated reads on identity, session
  or path change. Refresh when navigating and on provider focus/cross-tab events.
  No redirect in the shell: existing page guards retain correct return paths,
  admin MFA enrollment and denial behavior without new redirect loops.
- Keep PrivateDocumentBoundary, PublicAuthDocumentBoundary, native account/auth
  crossing, signout document replacement, no-index metadata, exact ownership,
  permissions and all synthetic/production gates.
- Reuse current brand tokens and existing account disclosure/signout. Desktop
  sidebar, compact topbar with full wrapping name/current role; mobile keyboard
  menu with Escape/focus restoration. Visit website is secondary and same-tab.
- Remove duplicate family/tutor/admin page-level navigation from rendered pages;
  preserve contextual recovery/actions and security settings. Marketing header
  geometry repair remains unchanged; scope dock scroll/footer spacing to pages
  actually containing that shell.
- No schema, dependency, business rule, real user, Neon or production operations.
  No commit/push/deploy/stash/reset or stopping the user's port3000 server.

## Implementation sequence and affected areas

1. Move marketing chrome/main into a reusable public shell and group layouts;
   retain auth boundary around that shell and private metadata in workspace.
2. Add client workspace shell and a small tested navigation model. Fetch the
   current account through the existing endpoint with cancellation; derive
   presentational navigation only from current results. Share the existing
   signed-in disclosure with public header, preserving its behavior.
3. Reuse admin navigation inventory, remove duplicate page nav rendering; add
   responsive CSS using existing tokens, nonfixed mobile topbar and readable
   wrapping. Add scope rules to public dock padding and fallback main.
4. Add focused component and actual-browser regression tests for role grants,
   neutral shared paths, current-page markers, failures, same-tab navigation,
   menu keyboard behavior, roleless/denied/MFA and session privacy states.
   Adapt the existing account-to-public auth test via Visit website.
5. Update UI/architecture/build plan and progress tracker truthfully, preserving
   previous entries; read-only self-review, separate verification and Recover
   for defects, then Remember save. Root additionally reviews independently.

## Verification plan (not executed in Architect)

- npm run check: existing formatting/lint/typecheck/unit/component checks.
- Isolated local test-environment production build with with-test-env.mjs;
  Next16 keeps production .next output separate from user's .next/dev. Preserve
  next-env.d.ts baseline after generated type references and do not run two builds.
- Focused actual Chromium foundation/auth/header-navigation/workspace tests at
  desktop and320/390px; actual provider sessions and loopback learli_test only.
- Existing account/auth/permission integration tests against loopback PostgreSQL.
- Axe, keyboard/menu Escape focus, long names and200% text; screenshots opened
  for desktop/mobile; no horizontal page overflow. Confirm no .site-header,
  .site-dock or marketing footer in workspaces, public chrome still present.
- Check API failure, invalid/unassigned role, unauthenticated, suspended/expired,
  cross-account signout/history and actual admin MFA. No permission hiding claim.
- Feature-only diff against saved baseline, including untracked files. Record
  exact commands/results, failures/recovery and limits in ignored report.md.

Risks: retained client identity across navigation, role guesswork on shared paths,
MFA redirect loops, duplicate nav, broad CSS dock spacing and sidebar width reducing
existing content area. No unresolved material policy blocks this shell. Rollback
is a scoped reversal against saved baseline; never discard other dirty work.

## Sidebar regression repair — 2026-10-14

Status: AUTHORIZED — build-feature delegation. Actual owner request: “theres a
bug on the side bar its chaning nav bar can you find it”; existing authorization
covers scoped reversible repair of same-tab role workspaces. Dispatched task
`task_a4cc76ba1522` / `ctx_bdfafd5ed196` owns implementation. This is not a claim
of separate human blueprint review. Baseline copies/hashes include dirty and
untracked source in `.local/workspace-sidebar-repair/`.

This amendment supersedes the neutral-shared and all-pending-navigation rules
above. Explicit role routes require a matching current grant and take precedence.
Within the same mounted session, retain the selected granted role on shared
routes. Direct shared entry with one actual grant is unambiguous; a fresh
multi-role shared entry stays neutral. Do not persist role choice in browser
storage, infer role from untrusted query data, or change permissions.

Keep AccountChrome mounted by provider user/session identity, not pathname.
Guarded account GET revalidates each pathname/scope and retry without an additional
route-triggered provider request. It already resolves the current server session,
active account and roles. Pending navigation retains only previously validated
presentation links; unchecked account names are hidden. Provider initial/refresh,
error/anonymous, identity/session change, account failure and revoked grants
invalidate display evidence; abort old reads and reject late responses. Preserve
provider focus/online/cross-tab behavior, account-update refresh, page guards,
private documents, native account entry and signout. Do not retain/cache private
page content to conceal loading.

Remove Availability/Time off inline role nav and Profile's redundant workspace
return link; keep profile prerequisite, time-off explanation and denied-state
recovery actions. Mobile disclosure closes on navigation and Escape restores
focus. Sidebar owns one copy of role destinations.

Separate verification must assert actual link labels/count/content throughout
held account requests and settled destinations, rather than geometry alone.
Cover tutor Availability → Profile → Time off → Account settings → Support → Back,
parent/student Learners/shared navigation, multi-role switching and neutral direct
entry, roleless/denied, account failure/retry, late reads, provider error/refresh,
logout/expiry/suspension/revocation/account switch. Check actual local synthetic
provider/PG boundaries, focused component races, desktop keyboard and320/390
mobile long-name/200% layouts. Run npm run check, local production build, focused
workspace/auth/header/foundation browsers and auth/admin-security PG tests. No
new backend/dependency/schema or external operation. Reconcile UI, architecture,
decision and tracker, then separate read-only Review → Verify → Remember save.

Sidebar refresh detail: a selected role enum may survive an ordinary provider
refresh within the same user/session, but no name or granted-role links display
until fresh guarded account data validates it. Error/denial and identity/session
changes clear the context. Shared booking current-page markers require the exact
matching scope; query scope never grants or selects an arbitrary workspace.
