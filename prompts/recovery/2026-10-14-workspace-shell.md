# Workspace shell recovery

Status: AUTHORIZED — build-feature delegation, owner's 2026-10-14 dedicated-shell
request. Mode: Targeted Fix. Local uncommitted M1.5 UI; no production/data impact.

## R1 — Shared booking history scope

Self-review observed that a new generic /bookings link would invoke the existing
student default on parent/tutor accounts (bookings/page.tsx). Expected navigation
must work for actual assigned roles without guessing current role on shared pages.
Root cause is a presentation link lacking the existing explicit scope parameter,
not a server guard defect. No implementation/test was performed in Recover.

Separate implementer: expose labelled Parent/Student/Tutor booking-history links
only for actual grants, each retaining the existing guardian/student/tutor scope.
Use exact explicit scope for current-page indication but keep shared shell role
neutral. Preserve all endpoint guards/defaults. Separate verifier: component link
contract plus browser parent/tutor history navigation, shared neutral state and
existing denied-role checks. No additional decision or destructive operation.

Verification: NOT RUN BY RECOVER; actual outcomes belong in the tracker/report.

## R2 — Verification authoring and focused UI follow-up

Initial npm run check stopped at TypeScript: the new component test used
Playwright's exact option in Testing Library's getByRole. Remove that unsupported
option without changing the string-name assertion. New effect warnings come from
accessing session.refetch through the object while depending only on its method;
destructure the stable provider method. The coordinator also requested measuring
provider-held then account-held actual route transitions and reducing unnecessary
mobile topbar stacking. Use visible Menu plus its full accessible name and an
inline role label, preserving wrapping for long/enlarged text. These are targeted
M1.5 repairs; rerun check and planned browser layout/keyboard assertions.

## R3 — Independent current-area finding and error test harness

Coordinator source review found /admin/support was marked exact, losing the old
current=support indication on assigned case details. Targeted repair: exclude only
the dispatch subtree, test both kinds of details. No authorization change.
Check2 passed typecheck and1446 tests, but the root error component test now renders
its new public shell without router/provider context. Preserve the retry/privacy
assertions and supply a pathname and pending provider mock for that test; do not
change SiteHeader's established navigation behavior. Rerun full check and build.

## R4 — Inherited family footer

Browser1 passed all36 existing foundation/auth/navigation cases, then the new
parent acceptance found one footer. Source inspection identifies DashboardHelp's
semantic footer inside the family page, not the moved marketing shell. The owner
explicitly requested no footer in workspaces. Remove duplicate normal-page help
footers/closing support navigation; keep Contact support/Report a concern in the
shared sidebar and contextual Contact support alongside unavailable retry. Preserve
all current help destinations. Rerun no-footer/role/browser cases after rebuild.

## R5 — Narrow enlarged-text reading measure

Browser2 passed45 cases, including no horizontal overflow. Opened screenshots show
320px/200% family content still wastes width in inherited rem gutters and panel
padding, breaking ordinary heading words. This is a visual readability defect,
not a reason to reduce enlarged font sizes. Apply bounded narrow workspace-only
horizontal gutters/panel padding, preserving font sizes and document scrolling.
Recheck320/390/desktop,200% text, keyboard and full scoped browser checks after
build; record original screenshots. Public styles remain unchanged.
