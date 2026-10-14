# Recovery — workspace sidebar changes during navigation

Status: AUTHORIZED — build-feature delegation (2026-10-14 local bug repair)
Mode: Targeted Fix; M1.5, AUTH-02/03/04, OPS-01/02/03, NFR-01/02/05/09.
Branch fix/e2e-test-env at c4c28fb; existing dirty work must survive.

The owner reported “theres a bug on the side bar its chaning nav bar can you find it” after authorizing same-tab dedicated role workspaces. The supplied screenshot shows both the new sidebar and old inline tutor navigation. Source inspection confirms AccountChrome is keyed by pathname/scope and removed during provider refetch; each route therefore discards all navigation grants and reloads them. currentWorkspace recognizes explicit role routes only, so shared pages permanently replace the role links. Availability and Time off retain duplicate Tutor work areas nav; Profile has a redundant workspace return link.

Recovery recommendation: preserve a session-bound display-only role context across shared navigation; explicit valid role routes/switches win, a sole current grant can resolve a direct shared entry, and ambiguous multi-role entries remain neutral. Separate navigation revalidation from identity changes: use the guarded account GET on each destination, cancel late reads, retain only presentation links during same-identity navigation, and hide account identity while unchecked. Provider refresh/failure, account denial, identity/session change and revoked grants invalidate display evidence. Preserve all current server guards and private-document boundaries. Remove duplicate tutor chrome while retaining contextual actions.

No executable reproduction or verification is performed by Recover. Separate Verify must reproduce actual delayed requests and settled link-content changes before repair, then prove tutor/family/shared/switching, failure/race/logout/revocation and responsive keyboard flows. No schema/backend permission/dependency or live-service changes. No new material decision or additional approval required within the dispatched repair; blueprint must reconcile the previous neutral-shared restriction. Rollback uses scoped saved pre-edit bytes, never HEAD/reset.

## Read-only review follow-up

The same-agent review found a test-only boolean-attribute mistake (`open` is an
empty string when present) and stale neutral-shared wording in M1.5 build plan.
Targeted repair: compare the attribute to null and reconcile that sentence with
the authorized amendment. No runtime foundation or permission change required.

## Verification attempt 1

npm run check stopped at formatting in the edited decision and blueprint only.
The separate implementation stage applies Prettier to those two owned Markdown
files; no application/test behavior or earlier assertions change. Re-review of
the formatting-only diff is scoped; repeat check before build/browser acceptance.

## Browser attempt 1 — old disclosure interaction

Focused production Chromium passed50/51; the old multi-role test timed out after
unconditionally clicking an already-open Switch workspace disclosure following
navigation. The repaired shell intentionally stays mounted, so that click closes
the disclosure and hides the next target. Source inspection and the browser error
context establish a test interaction assumption, not a role-grant failure. New
multi-role/refresh and all link-content, revocation and cross-tab cases passed.
Repair the old test to open the native details only when closed, preserving all
role/denial assertions. Runtime source/build/PG evidence is unchanged. Scoped
read-only re-review of this test change remains READY FOR VERIFICATION; execute
the focused suite again and preserve the original failed log.

## Coordinator follow-up — preserve chooser dismissal

After the test-only correction passed all51 cases, coordinator message
msg_3f5e5f5989f9 requests preserving the prior role-chooser dismissal instead of
only adapting the test. Separate implementation will close an open native details
on sidebar link selection (and restore summary focus if it contains focus), with
a component and actual-browser assertion. This is scoped interaction behavior,
not an authorization or data change. Re-review and repeat check/build/focused
browser against the revised source; existing PG coverage remains applicable.

## Final separate verification outcome

Resolved by the separate Verify stage: check1457/96, production build, actual PG
48/48, focused Chromium51/51 and desktop keyboard1/1 passed. Final observer
snapshots23/23/15 at320/390/1440 retained all five tutor links; duplicate leaf nav
is absent. Same-agent scoped review and coordinator independent source/visual
review accepted the final correction. Logs, screenshots, hashes and report live
under `.local/workspace-sidebar-repair/`; no production/release authority implied.
