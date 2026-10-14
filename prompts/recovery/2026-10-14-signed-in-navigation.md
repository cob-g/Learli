# Learli Recovery — Signed-in navigation

- Status: diagnosis complete; subsequent scoped implementation independently verified locally (see continuation below).
- Mode: Failure Mode 1 — Targeted Fix.
- Type: UI/session presentation; preserve server authorization.
- Severity/environment: user-visible account-navigation defect in the local
  preview; no observed evidence of a breach, lost session, or data loss.
- Inspected checkout: `/Users/cob/learli`, branch `fix/e2e-test-env`, HEAD
  `c4c28fb115fd334ac542eee9f6967f2b4de6d207`, with existing dirty/untracked work.
- PRD: AUTH-02, AUTH-03, AUTH-04, AUTH-05; NFR-01/02/05/09/11; preserve PUB-01.
- Build plan: M1.5 shared shell; M2.3 sign-in/out; M2.6 privacy/cache boundaries;
  M2.9 auth UX. This does not close any whole milestone or launch gate.
- Authority: the user's explicit fix request and supervised Orca dispatch
  `task_7c6b99e8a6d3` / `ctx_b748ca3f3d0d`, dated 2026-10-14. Routine reversible
  repair is already authorized. This is **not** build-feature delegation or
  separate human approval of a generated blueprint/diagnosis.

## Expected versus reported

After successful sign-in, public navigation should visibly identify the current
account and offer account/workspace access and sign-out on desktop and mobile.
The reported behavior is that some signed-in accounts still see only Sign in.

No account was signed into or reproduced during this read-only diagnosis. Source
inspection proves that the current shared header always renders Sign in,
regardless of account, route, or successful authentication. Whether the reported
accounts additionally experienced an actual session failure remains unknown.

## Evidence and confidence

Line references describe the inspected working tree, before this repair.

| Observed source evidence                                                                                                                                                                                                                                                                                                      | Implication                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/shared/site-header.tsx:43` reads pathname and browser/scroll state only; lines 93–99 render an unconditional `/sign-in` link. There is no session hook or identity prop anywhere in the component.                                                                                                            | High-confidence root cause: authenticated navigation state was never wired into the shared header. A refresh or successful sign-in cannot alter this markup.            |
| `src/app/layout.tsx:54` mounts the same `<SiteHeader />` above every route. Header desktop links are at lines 78–92; the five mobile dock links at lines 105–125 contain no account entry.                                                                                                                                    | The symptom affects the shared desktop/mobile shell, including private workspaces. Preserve the existing mobile dock and put the account control in the shared top bar. |
| `src/features/auth/auth-form.tsx:40` validates the return path; lines 60–81 call `authClient.signIn.email`, handle MFA continuation, and replace the document on success.                                                                                                                                                     | Successful authentication already reloads the destination. Replacing this with another refresh is not the repair.                                                       |
| `src/lib/permissions/return-path.ts:1` defaults to `/account`; `src/features/bookings/selection.ts:109` preserves only validated booking continuation.                                                                                                                                                                        | Keep current post-auth routing and selected tutor/slot behavior. Do not redirect every login to a single role dashboard.                                                |
| `src/app/(workspace)/account/page.tsx:22` calls `readAccount`; lines 39–40 show identity, lines 62–82 render trusted role links or the truthful no-role state, and line 116 provides SignOut.                                                                                                                                 | The account destination already exists for all roles, including roleless and multi-role accounts. A generic account link avoids new client-side role logic.             |
| `src/features/account/service.ts:22` requires current identity and exact ownership; `src/lib/permissions/access.ts:23` checks provider session, permitted email, verification, current account status and trusted roles.                                                                                                      | Presentation is separate from permission. Retain all existing guards and admin assurance.                                                                               |
| `src/lib/auth-client.ts:2–5` creates the same-origin Better Auth React client with its MFA plugin. `src/app/api/auth/[...all]/route.ts:5` delegates to the existing runtime/handler. `src/lib/auth-handler.ts:47` permits sign-out; lines 163–169 permit get-session; lines 12–17 and 259–260 apply private/no-store headers. | Existing provider client and endpoints support this repair; no new identity store or public account endpoint is needed.                                                 |
| `src/features/auth/sign-out.tsx:11–20` uses `authClient.signOut`, reports failure, and on success replaces the document with `/sign-in`. `src/features/auth/document-boundary.tsx:12–46` preserves private-document and restored-history safeguards.                                                                          | Reuse logout and retain full document replacement; do not downgrade it to `router.push`, only local state clearing, or manual cookie deletion.                          |
| `tests/components/site-header-glass.test.tsx:14–90` covers shell, destinations and dock but supplies no session states. `tests/e2e/auth.spec.ts:60–62` signs in, checks the public return URL, then directly visits `/account`.                                                                                               | Existing tests can pass while the public header remains anonymous. Add explicit signed-in header assertions.                                                            |

Installed package manifests were read: Better Auth **1.7.7**, Next **16.4.0**,
React **19.3.0**; they agree with `package.json`. Installed
`node_modules/better-auth/dist/client/react/index.d.mts:26–33` exposes
`useSession()` with `data`, `isPending`, `isRefetching`, `error`, and `refetch`.
Installed `client/config.mjs:22,74–80` invalidates provider session state after
auth actions and broadcasts sign-out. `client/session-refresh.mjs:12–14,53–66`
provides broadcast/focus/online refresh behavior; default interval polling is off.
The official [Better Auth client documentation](https://better-auth.com/docs/concepts/client)
also documents the hook and its error/refetch handling. Installed source is the
version-specific evidence; current vendor documentation is supporting guidance.

`src/lib/auth-options.ts:24` disables provider cookie caching. The app's current
dirty permission optimization still reads current status/roles on each call.
Neither setting causes the unconditional header link.

## Root cause and alternatives

The public header is a static anonymous navigation component. It has no connection
to the successfully established Better Auth session. The existing account page's
identity and role navigation do not propagate into the root header.

This is not evidence that only a particular role or fixture is broken: the header
source cannot distinguish any accounts. No account/provider/database repair is
justified from this symptom alone. Actual cookie/origin failures, intermittent
development database errors and the specific reported account sessions were not
examined or excluded. Verify those only if the focused repair exposes a separate
failure. No earlier targeted repair attempt for this header was found; historical
private-bootstrap recovery must be preserved, not repeated or reversed.

## Smallest recovery recommendation

1. Replace only the unconditional header Sign in slot with a small client account
   control using the existing `authClient.useSession()`. Keep public discovery,
   header glass behavior, mobile dock and route destinations intact. Do not add
   synchronous session/database reads to every public page or serialize a raw
   session into root-layout HTML.
2. Represent distinct states: unresolved session, successful anonymous response,
   authenticated response, and request failure. A neutral native Account link to
   `/account` is a safe server/no-JavaScript/loading fallback. Only a successfully
   resolved absent session should produce Sign in. A failed read should expose
   concise retry feedback and a usable account link, without presenting stale
   identity as freshly confirmed or hiding the failure as logout.
3. For authenticated users, visibly show their current display name with a clear
   Account affordance and optional initials; no photo uploads or email address is
   needed in the top bar. An accessible disclosure can contain Your account
   (`/account`) and Sign out. Use native links/buttons, wrapping names and existing
   tokens, a minimum 44px target, keyboard operation and appropriate focus
   behavior. Do not add ARIA menu roles without their keyboard interaction model.
   The same account control must remain visible below the desktop breakpoint.
4. Reuse SignOut, adding only optional presentation props if needed to remove its
   page-specific margin in the header. Keep its pending/error semantics and full
   document replacement. A hidden/collapsed header action must not break existing
   account-page logout selectors; scope new browser assertions to the header.
5. Keep `/account` as the workspace chooser. No-role users remain signed in;
   multiple roles remain available there; admin access still requires current
   MFA. A valid provider session is not a claim of an active/bookable account.
   Suspended users may still need a logout control even when `/account` denies
   restricted access. Do not grant permissions from header/session display data.
6. Use provider refresh behavior, with deliberate revalidation when needed for
   route changes/session recovery. Avoid private provider atom internals,
   aggressive polling, custom persistent identity storage or global caches.
   Account display-name saves currently use the app PATCH followed only by
   `router.refresh()` (`src/features/account/account-form.tsx:29–46`), outside
   Better Auth's mutation signals: check that a subsequent public navigation
   updates the header. If immediate same-page refresh needs an extra hook,
   coordinate that narrow additional file with the implementer owner first.

## Preservation, risks and rollback

The pre-diagnosis tree contained **40 modified tracked files**, no staged diff,
and untracked work. Preserve it all. Relevant overlapping dirty files include
root/auth/workspace layouts, `site-shell.css`, `context/ui-context.md`,
`context/progress-tracker.md`, `context/architecture.md`, permission access/workspace
helpers, and auth/profile browser tests. Other existing work covers SEO modules,
navigation progress, time-zone preference, database/performance optimization,
test environment tooling, documentation and `.claude/worktrees/`. SiteHeader,
SignOut and the header component test themselves had no baseline diff. No reset,
stash, broad formatting, migration, dependency change, commit or deployment is
part of this handoff.

The closing status read additionally showed a concurrent change to
`tests/e2e/booking-notifications.spec.ts`; this worker did not edit it. Preserve
that change too and re-inventory ownership before implementation/verification.

Relevant decisions read: local M2, mandatory admin assurance, local-preview
performance, and search-indexing/SEO. UI context's small-screen dock description
currently says the top bar contains Sign in; the implementation owner should
update that statement for anonymous versus authenticated states. Preserve
private-document protection and current indexing rules.

Risks: initial/loading flash, false logout on fetch failure, long-name overflow,
disclosure clipping against the glass header, duplicate accessible logout
controls, stale names after account edits, and stale state after another tab
logs out or a session is revoked. Do not expose email, raw session records,
tokens, roles, learner details or meeting information in screenshots, logs,
metadata or persistent browser storage. Rollback, if needed, is limited to the
new account-control hunks and their documentation/tests; preserve all unrelated
work and data. No database rollback or operational containment is indicated.

## Verification required from separate owner

Status: **NOT RUN BY RECOVER**. No build, lint, typecheck, test suite, browser
journey, account mutation or service restart was performed in this diagnosis.
Historical passing checks in the tracker are not proof of this repair.

Before verification, inventory current test/build processes and obtain the shared
environment slot from the coordinator. Its 2026-10-14 follow-up reports an existing
full E2E run, PID 73272, using `.next` and `learli_test`; that is coordinator
evidence, not a newly checked liveness fact. Do not interrupt it or overlap builds,
fixture setup or database tests. Use the repo's test wrapper and isolated loopback
PostgreSQL; never the owner's seeded preview accounts or production data.

- Add component tests for pending, anonymous, authenticated, error/retry,
  long/empty-name fallback, and logout success/failure. Keep shell/dock assertions;
  replace any whole-header no-button assumption only where genuine account
  controls require it. Assert that session errors do not masquerade as anonymous
  success and that no identity is persisted or server-serialized by this change.
- Add a real Better Auth browser regression: synthetic sign-in returns to a
  public route, the header shows that account and no Sign in, Account opens the
  existing chooser, and header logout returns to Sign in. Cover parent, student,
  tutor, admin/MFA, roleless and multi-role access without changing their gates.
- Exercise client public navigation, reload, current display-name refresh,
  focus/cross-tab logout refresh, session expiry/revocation and fetch failure.
  Verify actual logout failure retains a usable retry and never falsely reports
  success. Backend denial remains authoritative even before the header refetches.
- Retain account-switch/Back privacy regressions in
  `tests/e2e/four-feature-integration.spec.ts:416,516,605`, auth logout/history at
  `tests/e2e/auth.spec.ts:89`, session revocation tests, and AUTH-05 selected-booking
  return tests. No private payload from actor A may survive into actor B's view.
- Check 320/390/768/1024/1440 widths, 200% text, keyboard/focus, reduced motion and
  forced colors, account disclosure over scrolled content, no horizontal overflow,
  and the native Account fallback without scripts. Run axe where applicable and
  report the actual browser engines; anonymous public shell remains usable when
  auth is unavailable.
- After implementation, run `npm run check` and
  `NEXT_TELEMETRY_DISABLED=1 npm run build`. Once the shared environment is free,
  focused browser projects include `auth`, `account-sessions`, `account-password`,
  `four-feature-integration`, `profile-booking`, `desktop`, `phone`, and `narrow`.
  Add explicit phone authentication coverage rather than assuming the existing
  `auth` project (desktop-only) supplies it. Because the header mounts everywhere,
  run the full standard browser suite after the focused checks; coordinate its
  timing with the existing performance verification owner.
- Retain/run relevant provider integration tests as needed to substantiate logout
  and expired/revoked-session denial (`tests/integration/auth.test.ts:235,262` and
  `account-sessions.test.ts`). Broad database/migration retesting is unnecessary
  for a presentation-only patch unless source changes or new failures justify it.

## Concrete implementation handoff

Implement the small session-aware shared header control in
`src/components/shared/site-header.tsx`, preferably with a focused adjacent
component. Use existing Better Auth 1.7.7 `authClient.useSession` and existing
SignOut; allow only necessary SignOut presentation and local shell-style changes.
Keep role selection in `/account`, all guards/MFA and full document replacement,
the five-tab mobile dock, and safe booking return paths. Add focused component
and real-session browser coverage, update the UI-context sentence, and append
actual implementation/verification evidence to the tracker after verification.
Preserve the current dirty performance/SEO/test-tooling work and coordinate
shared `.next`/test-database ownership before running checks. If a separate
session failure remains after navigation is wired, return its sanitized evidence
for a new diagnosis rather than weakening authentication.

## Approval and outcome at diagnosis handoff

- Approval: explicit user repair request, conveyed by the coordinator; no further
  routine repair approval required. No human review of this diagnosis claimed.
- Implementation: **NOT PERFORMED BY RECOVER**.
- Independent verification: **NOT PERFORMED BY RECOVER**.
- Diagnosis output: this recovery note only; no other files changed by this worker.
- Remaining owner: coordinator dispatches scoped implementation and verification.

## Subsequent implementation and verification — 2026-10-14

The coordinator dispatched implementation separately under the explicit user repair
request (`task_8f4114e70b21` / `ctx_9b692fba5dd0`), followed by independent review
and verification (`task_9f1e5f872cc3` / `ctx_7fe9ce512575`). Neither activity was
performed by Recover or labeled build-feature delegation.

The header now reads the existing provider session, showing a native Account
fallback during pending/refetch/error, Sign in only after successful anonymous
resolution, and current name/initials with existing account settings and SignOut.
Navigation refetch handles app-saved names. Server authority, native account entry,
sign-in/out document replacement, public destinations, dock and glass remain.
No new backend, dependency, schema, persistent identity or business decision.

Independent browser verification found and closed two defects: pending SignOut's
disabled-button blur unmounted its failure feedback; and narrow enlarged text
squeezed long names into an unusable column. Null-target blur now preserves pending
state, and width/container reflow preserves complete readable identity. The original
browser assertions pass; 17 scoped component cases include the blur regression.

Final independent review PASS with no remaining finding. `npm run check` passes
1,440 tests in 95 files plus formatting/lint/typecheck (one inherited unused-import
warning). Production build through `scripts/with-test-env.mjs` passes. The isolated
local Chromium runs pass 31 focused repository cases and 4 independent acceptance
cases, covering six role configurations, actual admin MFA, identity/session
transitions, error/retry/logout, privacy/history, five widths, keyboard/axe,
no-script access, forced colors/reduced motion and 320px/200% text. Ten final
screenshots were visually inspected. Exact commands, source hashes, initial
failures and final evidence are in ignored `.local/signed-in-navigation/report.md`
and the task entry in `context/progress-tracker.md`.

The coordinator explicitly selected focused verification instead of the broader
suggestion above. Full unrelated E2E/database suites, hosted/Neon/production,
Firefox/WebKit, real devices and screen-reader audit were not run for this repair.
The verifier restarted only the stopped owned local test cluster. No development
fixture mutation, migration, dependency change, commit, deployment or production
operation occurred. Source remains uncommitted; no local repair blocker remains.
