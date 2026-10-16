# M8.3 — Private fictional Parent/Tutor workflow composition

## Authority and outcome

2026-10-16: after approval of the corrected Tutor checklist and connected-flow
recommendation, the owner selected the recommended **private staging, fictional
test accounts only, payments disabled** (“chooos e recomendedn”). That audience
question is resolved. Do not ask it or the assigned-Tutor completion question again.

**AUTHORIZED — build-feature delegation** for software implementation, isolated
verification, review and handoff. This is not separate human approval of this
generated blueprint or permission to provision/migrate/deploy an unspecified
hosted target, remove accounts, process money or accept real families.

Build one explicit, disabled-by-default private workflow composition for existing
admission, screening, booking and participant coordination. The normal build,
not copied source with replaced factories, must exercise it. Display a clear
private-staging notice: fictional data only, payments disabled. Do not present
synthetic eligibility/evidence as real guardian consent or verified qualifications.

## Requirement and baseline

- Owner: M8.3; related M8.9, M2.4/2.9, M3.2/3.4/3.5, M4.1–11 and M5.1–8.
- PRD: AUTH-01–05, TUT-01–06, FAM-01/02, BKG-01–07, MEET-01–03,
  PUB-03/04 and OPS-02/03/04. Payment requirements remain gated.
- Branch `feature/staging-interface-cleanup-20261016`, HEAD `572cf4d` plus the
  preserved dirty baseline at `.local/private-fictional-workflow-20261016/`.
  Preserve prior interface cleanup, Parent enrollment0032, completion0033 and QA.
- Read AGENTS.md and its eight canonical context files in order. Reuse unchanged
  context from the preceding acceptance unit; the new audience decision changes
  only this explicitly bounded operating scope.

## Existing constraints and decisions

The domain accessor is local-only; hosted account runtime is asynchronous.
Domain HTTP/session preflights, public candidates and workflow validators have
independent loopback/test restrictions. Those must be adapted through an explicit
private capability, preserving signed ingress and current server authorization.
Changing a factory or passing staging unconditionally is insufficient.

Use the existing immutable synthetic admission/screening identities and v2
booking/completion policy as fictional QA inputs. Existing60-minute lessons,
30-minute starts,60-minute notice,14-day horizon,10-minute hold and60-minute
change cutoffs remain test parameters, not customer terms or new commercial
promises. Confirmation remains exact assigned MFA-admin review. Completion is
assigned Tutor after the saved end with an audit. No automatic approvals,
guardian links, email verification or payment states.

## Minimal design and ownership

### 1. Private workflow configuration

Add a bounded, private server-only packet, absent by default, selected via
`PRIVATE_WORKFLOW_CONFIG_FILE`. Reject production and ordinary development.
Allow an owned local test rehearsal and separately validated hosted staging.
Bind version/purpose, fictional-only audience, real intake/payment disabled,
origin, exact database target and finite synthetic account allowlist to the
actual runtime. Bind enabled admission, screening and v2 booking receipts to each
other. Reject missing, unsafe, changed/incompatible or mismatched configuration
without fallback. Reuse private file ownership/mode/symlink checks.

Implementation module contract (proposed new files):
`src/features/private-workflow/runtime.ts` exports
`getPrivateWorkflow(runtime)` returning a validated packet or null,
`isPrivateWorkflow(runtime)` and
`privatePolicyEnvironment(runtime, kind, capability)`. The last returns test
validation context only for a matching explicit private packet; otherwise it
returns the actual runtime environment. It never alters runtime.environment or
loosens the existing standalone policy validators. Invalid active configuration
throws a sanitized error. No database credentials are stored in this packet.

### 2. Domain runtime, HTTP and session composition

Add asynchronous `getDomainAuthRuntime()` in `src/lib/auth.ts`: legacy local
behavior is preserved; hosted staging is admitted only through the explicit
private packet and the existing validated account runtime. Apply it to connected
domain page/API/discovery entry points, retaining the ordinary account accessor.
Do not rely on page/layout execution order or mutable initialization timing.

Use a new explicit same-domain-origin path: local semantics remain unchanged;
private hosted requests reuse signed account ingress/Host/Origin controls.
Do not weaken `sameLocalOrigin` globally. Participant read/link preflight must
use current provider identity, allowlist, role and existing final SQL authority.
Existing server ownership, MFA, evidence, policy/head and post-lock checks remain.
Public eligibility derives readiness scope from private workflow, independently
of review publication. No publication/safeguarding capability is implicitly enabled.

### 3. Operator preparation and captured account mail

Provide separate bounded target-bound operator preparation for policy/head
metadata, existing reviewer identities, explicit admission/Tutor assignments and
per-logical-booking expiring confirmation grants. Do not loosen fixture tooling's
local-owner guards or grant general runtime table writes. No command may create
guardian authority, mark evidence passed, approve a Tutor, confirm a booking,
enroll a factor or set email_verified. Actual provider/domain actions do those
steps with current MFA and evidence. Hosted execution requires its exact target
and explicit apply authorization; only local test operations run in this task.

Add explicit private captured-mail mode for hosted fictional accounts if needed
for verification; validate exact origin, allowed .test recipient and private
directory/file permissions. No public capture endpoint, token logging or real
notification send. Keep existing Resend/disabled behavior. Verification remains
an actual provider link; no auto-verification. Document operator-only retrieval
and ephemeral-hosting limitations without claiming delivery.

### 4. Connected UI and compatibility

Reuse current layouts/tokens/native controls. Private mode prioritizes reviewed
learner admission and pending status over local fixture creation. Point Parent,
Tutor, learner/discovery and booking navigation to the connected path. Add
`/bookings/new` as the normal private entry, preserving strict public selection
and old validated continuation semantics; historical demo URLs may redirect in
private mode. Retain legacy behavior and evidence outside private mode.

Private-mode labels describe test-staging bookings/status honestly, with one
clear fictional-data/payments notice, rather than falsely presenting real
lessons or repeating legacy simulation controls. Display pending/provisional,
confirmed, cancelled and completed accurately. Meeting URLs remain private and
Tutor-provided; administrative completion never claims external attendance.
Preserve Account Settings name, combined teaching background, broad levels and
photos/pricing Not Applicable. Do not add unsupported Tutor acceptance or uploads.

## Invariants and data changes

- Parent enrollment is not guardian authority; pending intake must grant no link.
- Only current exact assigned MFA review with required evidence authorizes.
- Approved Tutor status alone cannot substitute for current screening.
- Existing PostgreSQL atomic overlap, immutable history, revisions, retries and
  post-write authority remain; no second booking engine or global serialization.
- No real users, money, production data, remote notification or external call.
- Do not rewrite applied migrations. Prefer no migration where existing schema
  suffices. Any demonstrated need for additive SQL must be scoped/reviewed with
  real isolated PostgreSQL/grant/migration checks before acceptance.
- Keep old default behavior disabled without the private packet; deny invalid
  packets, production, mismatched targets/origins/accounts/policies and revocation.

## Implementation sequence

1. Coordinator records audience approval in decision/context and preserves baseline.
2. Implement validated private configuration and negative tests.
3. Integrate async domain boundary and exact HTTP/session/policy preflights.
4. Add target-bound preparation and safe account capture as required by the flow.
5. Wire private-mode admission/discovery/booking/dashboard/navigation presentation.
6. Review the exact integrated diff, repair supported findings, then verify.
7. Document runtime prerequisites, actual results and remaining target acceptance;
   preserve all work and save local memory. No automatic commit/merge/deployment.

## Verification plan — separate stage

- Unit/component: packet and file admission, mode/target/allowlist/policy denial,
  existing defaults, exact current fields/navigation and honest UI states.
- Actual isolated PostgreSQL: pending intake without link, reviewer/evidence/
  screening, confirmed booking conflicts/retries, assigned-Tutor completion
  denials/audit, protected links/history and unprivileged runtime boundaries.
- Normal-build Playwright without factory source overrides: UI registration and
  verification, explicit Parent enrollment, pending child, actual assigned review,
  Tutor application/profile/availability/screening, discovery, same-booking request/
  confirmation across Parent/Tutor, private link save/access/denial and history.
- Current test policy requires about two hours from fresh booking to completion.
  A separate historical fixture cannot prove that same future booking completed.
  Use existing deterministic completion tests and disclose this temporal limit,
  or explicitly record any controlled-clock test; never fabricate a full pass.
- Scoped/broader check, typecheck/lint, build and affected browser suites; visual
  narrow/wide/keyboard/contrast checks for modified user flows.
- No real Zoom/Meet connection, Resend receipt or hosted target acceptance claimed
  without separate actual authorized execution. Payments remain disabled.
- Plan status: NOT RUN — Architect only. Matching Review is separate from Verify.

## Gates and handoff

Software/private test preparation may proceed under this request. Exact Neon/
Railway target, hosted apply/deployment, capture retrieval and any account cleanup
remain concrete operational prerequisites, not grounds to invent a target or
purge existing users. Real-family consent/screening/business rules are out of scope.

Update architecture, PRD, UI context where presentation changes, build plan,
progress, decision and operations documentation only for approved facts. Keep the
accepted checklist and historical failed/default attempts intact; current results
must name their explicit composition. Return to build-feature coordinator for
implementation; Architect itself performs no implementation or verification.
