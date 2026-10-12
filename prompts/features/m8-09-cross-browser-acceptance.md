# M8.9 — Firefox and WebKit acceptance

Status: **AUTHORIZED — build-feature delegation** (2026-10-12).
Authority: actual supervised Worker 5 request, task `task_2327e1fceb07`,
dispatch `ctx_cef83e683724`; no separate human blueprint approval.

## What we are building

A separate, reproducible local browser acceptance harness for Firefox and WebKit.
It exercises meaningful existing discovery, authentication, simulated reservation,
private history, participant meeting access and same-browser privacy paths.
This is test/configuration/documentation work, with no application or policy change.

## Requirement and milestone mapping

Primary: M8.9; NFR-01/02/05/09. Supporting: PUB-03/04, MATCH-01/02/03,
AUTH-01/02/03/05, BKG-01/04, FAM-02/03, MEET-02, QA-04/05/07/14/19/20.
The 117-case Chromium result in the tracker is historical, separate evidence.

Repository: `/Users/cob/orca/workspaces/learli/m8-cross-browser-acceptance`.
Observed clean branch: `cob-g/m8-cross-browser-acceptance`; baseline
`5634e44fd71e8851400e004de6bbe3554e65eae1`. Read AGENTS.md and all eight canonical
context documents in the required order, local child skills, and the root-owned
uncommitted orchestration lessons/readiness blueprint in place.

## Decisions and assumptions

No terminology or business clarification is needed. Use installed Playwright,
its real Firefox/WebKit binaries and existing supported utilities by import.
Run projects serially, with no global truncation or inherited fixture reset.
Configure only loopback test origins, APP_ENV=test/AUTH_MODE=local, and the owned
database; worker environment ports are 55505/3065/3165.
Use desktop 1440×900, phone-size 390×844, narrow 320×720, tablet 768×1024 and
1024×768, plus 640×400 reflow/reduced-motion spots. These are viewport emulations,
not physical device/Safari/iOS or literal browser zoom proof.

## Scope and invariants

Owned new files: `playwright.cross-browser.config.ts`, narrowly named
`tests/e2e/cross-browser*.spec.ts` and support helpers,
`docs/operations/cross-browser-acceptance.md`, this blueprint and factual isolated
tracker entries. Root owns shared Playwright registration/CI and document integration.
Worker 1 owns package/lockfile; accepted frozen dependency import requires root authority.

No source, schema, historical migration, shared fixture, package script, main/peer
checkout/database, production, external mail, provider visit, real-user or policy edit.
No worker spawning, staging, commit, merge, push or deploy. Application defects
are reported to root, without relaxed assertions.

All fixture identities use .test addresses. Register/verify/sign-in through the
real provider for browser auth; trusted owner tooling grants synthetic roles and
relationships only. Tutor eligibility is server-controlled. Public URLs carry only
public selections; learner selection occurs after auth. Existing UTC/timezone,
60-minute elapsed duration, 30-minute grid, 60-minute notice, 14-day horizon and
10-minute expiry are local simulation inputs, not real-user policy.
Recheck expiry near link assertions. Preserve immutable bookings/events; teardown
suspends only owned tutor profiles, revokes only owned sessions and closes contexts.
Wait for real auth throttle windows when needed; never rewrite inherited counters.
Disable trace, automatic screenshot/video and HTML report payloads. Use boolean
private-value assertions so failure messages never print tokens/meeting URLs.
Block off-origin ordinary workflow traffic; same-browser privacy contexts retain
normal caching and observe/assert zero off-origin requests. External redirect
tests stop at the local response; provider navigation is never attempted.

## Implementation sequence

1. Author independent serial engine config with guarded loopback setup and privacy-safe artifacts.
2. Add owned fixture/support helpers with guaranteed teardown and real auth preconditions.
3. Add explicit public filtered/empty/matching/native-no-JS paths with keyboard/axe/reflow.
4. Add registration/verification/sign-in/settings/sign-out and public selection continuation.
5. Add explicit parent and independent college reservation creation, retry/error recovery,
   private history, native no-JS reads, current ownership/meeting denials.
6. Exercise same-context logout/account switching and revoked/expired sessions,
   failed sign-in and Back before successful reauthentication.
7. Document acceptance matrix, runnable commands, engine identities and manual limits.

## Planned acceptance matrix

Each engine must discover and execute every owned scenario, with no silent skips:

| Area             | Required proof                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public discovery | Actual eligible subject/level filters, profile time/zone, matching and honest no-match; pending/suspended owned tutor omitted                        |
| Native public    | JavaScript-disabled GET filters and profile radio→safe auth continuation                                                                             |
| Auth             | Real browser registration/local verification/sign-in/settings/logout; no self-assigned roles; no-store                                               |
| Guardian booking | Public selection survives sign-in, linked learner only, explicit mutation; lost-response retry creates exactly one booking                           |
| College/errors   | Self-owned College Support without guardian; failed candidate read recovers; stale selection rejected without booking                                |
| Private history  | Current participant detail/history, native no-JS read/filter, account-local times, noindex/no-store                                                  |
| Ownership/links  | Foreign guardian/learner/booking denial; participant-only link; public HTML/metadata exclude private fields; native redirect does not visit provider |
| Same browser     | Logout and other-actor login clear old document; Back reauthorizes                                                                                   |
| Session loss     | Revocation and expiry clear auth document; failed sign-in and Back cannot restore old private payload                                                |
| Accessibility    | Keyboard radios/submit, focus and axe WCAG tags; narrow/phone/tablet/desktop overflow checks, reduced-motion/reflow spots                            |

## Planned verification (NOT RUN at architecture stage)

After slot grant: pinned npm ci, owned local setup and Playwright engine install.
Final acceptance waits root-approved dependency import. Execute scoped discovery,
format/lint/typecheck and existing `npm run check`, production build, then owned
Firefox/WebKit suite through `npm run test:e2e -- --config playwright.cross-browser.config.ts`.
Whole PostgreSQL/117-case Chromium suites are retained baseline evidence only;
no domain/schema/application logic changes require new broad backend tests here.
Browser-created booking DB invariants and private ownership are checked directly.
No build/typegen or integration/browser concurrency. Every heavy phase requires
root slot grant and release. Record exact commands, exits, engine versions, source
hashes, failures, actual viewports and unrun manual limits separately from Review.

## Context updates, risks and handoff

Update isolated progress tracker after meaningful implementation and final results;
do not mark whole M8 or launch gates complete. Other governing product documents
need no changes. Run same-agent read-only Review then separate Verify; label review
as same-agent. Recover diagnoses failures before repair, with application findings
assigned by root. Save ignored sanitized report, SHA256 manifest and memory.
Rollback: remove only newly added harness/docs; no application/data rollback required.
Risks: browser installation/runtime support, root dependency freeze, auth throttle
and expiring fixture timing, engine-specific navigation privacy. Human screen-reader,
physical device, branded Safari, hosted provider/production launch checks remain NOT RUN.

## Root-allocated R3 compatibility repair — 2026-10-12

Root msg_33183702628d explicitly expands Worker5 ownership to the narrowly
necessary src/app/globals.css .field native select sizing repair and relevant
UI-context/progress/recovery records. First full engine evidence16/18 exposed
the auth-history harness precondition, repaired with genuine private sessions
history and unchanged Back/privacy/server401 expectations. Subsequent geometry
confirms WebKit30px versus required44px. Proposed targeted appearance:none lets
existing tokens size actual HTML selects; all native functionality/no-JS/global
focus, data and permission invariants stay. No custom control or new token/asset.
Send exact reviewed CSS hash for root acceptance; final check/build/full18 must
run on that accepted repair. Existing compile/browser evidence is historical
pending affected renewal; all failures are preserved in the canonical Recover note.

Root followup msg_21e135a68e2e requires a visible dropdown affordance. The final
CSS uses two hard-stop transparent/currentColor triangles as a flat functional
marker, with existing spacing values8/12/20/32 and reserved inline text space.
This narrowly allocated control indicator is the only use of gradient syntax
allowed here; decorative gradients remain prohibited. CurrentColor follows the
existing foreground or disabled muted token; no new hue, asset or widget.
Only single-value dropdowns (no size or size0/1, not multiple) receive it.
Multi-selects/listboxes receive no marker. Disabled select fields use existing
subtle/muted/border tokens. Forced-colors mode restores native painting/marker
and clears background images; global focus and native HTML behavior remain.
The earlier marker-less draft was not accepted/frozen and is superseded.

### Root-authorized verification followups

Independent Review C F-C1 allocates `tests/e2e/cross-browser-privacy.ts` and
`tests/unit/cross-browser-privacy.test.ts`: fixed private SDK failure projection,
real injected raw proof/cookie precondition and retained child failure exit1
with neither value in the list report. All original assertions remain external.
Root separately owns booking/email focus repairs; exact four-file snapshots are
imported for final-runtime compatibility, never edited by this worker. Original
Firefox committed-result focus failure remains in recovery/evidence, repaired
heading focus assertion is unchanged. Root owns final combined CI/registration,
independent review, integration and public launch gates.
