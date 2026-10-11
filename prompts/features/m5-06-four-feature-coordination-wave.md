# Implementation Plan — Four-feature coordination and account-safety wave

## Status and authority

**AUTHORIZED — build-feature delegation; combined candidate independently reviewed and verified locally; uncommitted and unmerged.**

Requested on 2026-10-11: define the four features for the next wave. The user has
previously delegated in-scope product choices to the coordinator and requested
GPT-6.1 Sol with extra-high effort and `$build-feature` for feature workers. This
planning request was followed by the explicit execution request on 2026-10-11:
"ok lets do it and spawn agents what you need to spawn". This authorizes the four
bounded features, local verification, scoped repairs and supervised coordination.
It is delegated blueprint authority, not separate human blueprint review or
approval of production policies, remote services or deployment.

Repository: `/Users/cob/learli`. Observed branch: `main`, HEAD
`024dd4d7ce885da7ca391aefeaf4096fc75fc91e`, clean before this planning document.
Only main remained before this wave started. Main development and test
databases are migrated through 0012; workers use their own isolated
databases. Branches and new paths below are dispatch targets; actual creation and
worker receipts are recorded in `.local/four-feature-wave/manifest.json`.

Run `run_e7e3caaaac99` has four accepted, observed starts in separate worktrees
at the baseline above. Every launch receipt confirms effective `gpt-6.1-sol`
and `xhigh`. All four workers succeeded and were released after root checked
source hashes and verification evidence. Combined integration, two independent
reviews, scoped recovery and final independent re-review are complete locally.
All nine supervised workers succeeded and were released; worktrees are preserved.

Primary owner: build-plan M5.6. Related work: M5.1, M5.2, M5.9, M5.11 and M2.9.
This is four independent vertical slices, not a claim to complete those entire
milestones or to authorize real-user operations.

## Required context and language

Read root `AGENTS.md`, then the canonical context in its prescribed order:
`project-overview.md`, `architecture.md`, `ui-context.md`, `code-standards.md`,
`ai-workflow-rules.md`, `progress-tracker.md`, `prd.md`, `build-plan.md`, all under
`context/`. Recheck the local identity, synthetic booking, support reporting and
booking-notification decisions under `docs/decisions/`.

No terminology clarification is needed. A reservation here is the existing
`local_simulation` record, never a confirmed lesson. Support means the existing
unmonitored synthetic workflow. Account restriction is a reversible local access
state, distinct from a tutor profile's eligibility review status. Password change
requires a signed-in owner who knows the current password; password reset already
exists and remains separate.

## Inspected repository evidence

- `src/lib/validation/meeting-link.ts` and its tests already validate the narrow
  supported Zoom/Meet formats. Private storage and participant UI are absent.
  `prompts/features/m5-01-private-meeting-link-integration.md` is a historical
  BLOCKED real-integration draft. Booking, learner and private-detail prerequisites
  now exist, but that draft's real-use policy gates are not silently approved.
- `src/features/bookings/read-service.ts`, `read-query.ts`, `read-projection.ts`
  and `src/app/(workspace)/bookings/[bookingId]/page.tsx` provide current
  participant-only reads, demo lifecycle and protected details with no admin bypass.
- `src/features/support/service.ts`, `input.ts`, the requester/admin support
  routes and `src/lib/db/schema/support.ts` implement exact assigned-case access.
  Reports have no booking association. Owner tooling alone grants review access
  and assigns cases; runtime staff cannot claim arbitrary cases.
- `user_access` in `src/lib/db/schema/app.ts` already has active/suspended states.
  `src/lib/permissions/access.ts`, `recheck.ts` and the auth session-create hook
  enforce active accounts. There is no scoped account-restriction UI/workflow.
  The runtime cannot directly UPDATE account status under current grants.
- Account settings currently edit name/timezone. Session listing/revocation and
  password reset exist. There is no signed-in password-change UI or route.
  The installed Better Auth 1.7.7 `changePassword` endpoint checks the current
  password and an authoritative session, but its sensitive-session middleware
  does not enforce session age. Learli must explicitly reuse the installed
  configured `sessionConfig.freshAge` check to satisfy stale-session denial.
  `revokeOtherSessions: true`
  deletes existing sessions and issues a new cookie/session; its response also
  contains a token that must be stripped by Learli's boundary.
- `src/lib/auth-handler.ts` deliberately allowlists provider routes and does not
  expose change-password. Preserve that restriction unless a narrowly reviewed
  boundary change is necessary; do not enable all provider endpoints.

## Agent 1 — Private meeting links for local reservations

**Outcome:** an assigned tutor can add or replace a validated test meeting link;
the reservation's currently authorized participants can access it privately.

- Mapping: M5.1/M5.2/M5.11; MEET-01/02/03, AUTH-03, BKG-04, NFR-05.
- Type: UI + backend + database. Proposed branch: `cob-g/m5-private-meeting-links`.
- Local design choice: one separate link record per reservation, no tutor-wide
  default, automatic copying or provider-room-uniqueness claim. A normalized URL
  is allowed on another explicitly edited booking; storage does not verify room
  uniqueness, validity at the provider, safety settings or attendance.
- Entry, replacement and reads require `local_simulation`, `demo_reserved`, and
  `expires_at >` authoritative database time. No new TTL or real access window.
  The tutor must still own the assignment and be active, verified and approved.
  A reader must be that eligible tutor, the eligible self-managed college learner,
  or a currently authorized guardian, with current active account and roles.
  Every read/write rechecks permission at the database boundary.
- Expired or denied reservations disclose no URL. Retain stored records without
  inventing deletion/retention policy. No admin/support override. Hiding access in
  Learli cannot retract a link already disclosed outside the application.
- Own a proposed `src/features/booking-meeting-links/` module, private schema,
  minimal endpoint under `/api/bookings/[bookingId]/meeting-link`, and the meeting
  section on the existing private booking-detail page. Lists, dashboard DTOs,
  notifications, metadata, logs and audit records never contain the URL/passcode.
- Use the existing validator unchanged. At most one row per booking, a monotonic
  revision, and safe actor/time/revision audit records without URL values.
  Replacement races and repeated requests cannot overwrite a newer revision or
  duplicate audit events. Do not modify immutable booking fields or event states.
- Show explicit local-test wording and missing, expired, denied, conflict and
  service-error states. An external action must say it opens a test link, never
  call the simulation a confirmed lesson. No provider preview or request occurs
  before user navigation. Automated checks must not visit Zoom/Meet.
- Acceptance: correct tutor save/replace and participant read; malicious URLs,
  wrong tutors, unrelated/multi-role admins, revoked guardians, suspended users,
  expired holds and concurrent stale edits denied; no URL leaks across surfaces.
- Dependency: existing main participant data/authorization only; no new worker
  dependency. Coordinator integrates its detail-page extension with Agent 2's CTA.

## Agent 2 — Booking-linked support and case-scoped investigation

**Outcome:** a participant can report an issue from an accessible reservation;
the exact assigned reviewer can inspect the minimum booking context for that case.

- Mapping: M5.6/M5.9; ADM-03, OPS-05, AUTH-03, BKG-04, NFR-05.
- Type: UI + backend + database. Proposed branch: `cob-g/m5-booking-support`.
- Add an optional immutable booking association to a new report, verified against
  the requester's current participant permission inside submission. A guessed ID
  or stale guardian relationship cannot create a valid association. Existing
  standalone reports and their status/assignment workflow remain unchanged.
- Save the case, association and creation history atomically. Idempotency compares
  the associated booking as well as current report fields; a replay cannot attach
  a different reservation. No retargeting a submitted case to another booking.
- Requesters need current booking permission for the live booking section on later
  reads. Reviewers need their current verified active admin identity, existing
  support capability, exact case assignment and a still-authorized requester
  relationship to that booking. Losing assignment or participant authority removes
  the live booking projection; the existing case remains a case, with a generic
  booking-unavailable state. Do not turn this into broad historical learner access.
- Show only subject, tutor display name, recorded UTC times rendered in the
  viewer's zone, effective simulation status and minimal status-event history.
  Omit learner name/level, guardian contact, credentials, meeting links, notification
  artifacts and unrelated reservations. Audit successful reviewer booking reads
  using minimal identifiers/action/time, never case text or private link content.
- Own proposed `src/features/support-bookings/`, association/access-audit schema,
  support form/service integration and requester/reviewer detail sections. Provide
  a small proposed `BookingSupportAction` component for coordinator insertion in
  booking details; do not independently rewrite Agent 1's detail page.
- Preserve local unmonitored/not-emergency disclosures. No replies, chat, internal
  notes, automatic case claiming, email, cancellation or refund actions.
- Acceptance: participant-to-case-to-assigned-reviewer flow; wrong owner, forged
  booking ID, revoked guardian, reassignment race and admin-without-capability
  denials; one case per idempotent retry, no partial associations or metadata leaks.
- Dependency: existing main support and participant contracts; independent of
  Agent 1's link storage and Agent 3's restriction capability.

## Agent 3 — Scoped, audited local account restrictions

**Outcome:** an explicitly authorized staff fixture can suspend or restore a
specific synthetic account, with clear consequences and an immutable audit trail.

- Mapping: M5.6; ADM-04, AUTH-03, NFR-05.
- Type: UI + backend + database. Proposed branch: `cob-g/m5-account-restrictions`.
- Use the existing `user_access.active/suspended` state. Introduce the smallest
  exact staff-to-target authorization record and minimal action history. Only
  trusted owner fixture tooling can grant/revoke that authority; the browser
  cannot claim a target, grant staff roles, edit reviewer capability or search all
  users. This capability is separate from ordinary support case assignment.
- Limit targets to explicitly provisioned local fixtures, exclude self and admin
  targets, and require a currently active verified admin actor with exact current
  target authorization. List only authorized target summaries, not private learner
  records, bookings, contact details, credentials or notification contents.
- A restriction changes only account access, with a required bounded reason code,
  actor, time, prior/new status and revision. Use local-only reasons with no implied
  legal or real misconduct finding. No free-form sensitive incident notes here.
- Status transition and audit must be atomic with current authorization rechecked
  after locks. Reject stale revisions; an identical retry must not duplicate history.
  Do not grant the runtime blanket account-status UPDATE. Design a narrow reviewed
  database mutation function if needed, with fixed search path, explicit capability
  checks and tightly scoped grants; caller identity is provider-derived server-side.
- Existing sessions remain records but cannot authorize Learli restricted reads or
  writes while the account is suspended; new sign-in is refused by the existing
  session hook. State this accurately rather than claiming provider-wide logout.
  Restoration re-enables account access subject to every other current permission.
  It does not reapprove a tutor, change roles/guardian links, revive expired holds,
  cancel reservations, issue refunds or erase history.
- Own proposed `src/features/account-restrictions/`, scoped schema/function/audit,
  trusted fixture tooling and `/admin/accounts` target/detail surfaces. Provide
  an additive admin-navigation patch for coordinator reconciliation.
- Acceptance: authorized restrict/restore and audit, forbidden self/admin/foreign
  targets, capability revocation and stale-write races; already-signed-in restricted
  users denied by booking, participant reads, profile editing and new password flow;
  future public discovery/bookability reflects the account state. Historical data
  remains intact. Test the existing application boundaries before claiming coverage.
- Dependency: existing main access guards and identity. No need to wait for Agent 2.
  Agent 4 supplies additional password-change integration coverage at assembly.

## Agent 4 — Secure signed-in password changes

**Outcome:** a verified active user can change their own password from account
settings and end other sessions through Better Auth's supported flow.

- Mapping: M2.9 with M2.3/M2.5/M2.7; AUTH-02/03/04, NFR-05.
- Type: UI + backend/provider integration. Proposed branch:
  `cob-g/m2-account-password-change`. No new schema or dependency is planned.
- Add current password, new password and confirmation fields using existing
  accessible form conventions, password-manager autocomplete and paste support.
  Reuse the installed 12–128-character password policy. Do not add email changes,
  account deletion, MFA, role selection or a second credential store.
- Require current active verified owner identity, the provider's sensitive-session
  checks and valid current password. Force `revokeOtherSessions: true` server-side;
  do not accept a user ID or a client override that keeps other sessions alive.
- Use a narrow proposed `/api/account/password` boundary and
  `src/features/account-password/`. Preserve origin/CSRF protections, small bounded
  input and provider-backed or explicitly verified request throttling. A server API
  call must not accidentally bypass the provider HTTP rate-limit path.
- The installed flow returns a new session cookie and a token-containing body.
  Forward the provider cookie correctly, including multiple Set-Cookie headers,
  but return only a minimal safe status to the client. Never log/store entered
  passwords or serialize provider session tokens in Learli JSON/UI/test artifacts.
- Other sessions lose access after success; the current browser receives the
  replacement cookie. Require freshness at Learli's boundary using the existing
  provider-configured age, then use a safe return
  to account settings if sign-in is needed. If a partial provider failure occurs,
  report uncertainty truthfully: do not promise the old password still works or
  claim a rollback without evidence. Use the existing reset flow for recovery.
- Own only the new password feature/boundary, account-settings entry, narrowly
  scoped auth options if required, and its tests. Avoid edits to Agent 3's new
  restriction service or broad changes to the existing auth allowlist.
- Acceptance: wrong current password, mismatched confirmation, invalid length,
  stale/expired/unverified/suspended session and cross-origin denial; old password
  rejected after success, new password accepted, other sessions invalidated and
  replacement cookie working; token/body/trace privacy and throttling exercised.
- Dependency: existing installed provider and own-session functionality. Can start
  independently; combine with Agent 3's restriction tests before acceptance.

## Coordination and ownership

All four can start their own complete slice from the same clean, current main
after implementation is requested. Each worker uses `$build-feature`, GPT-6.1 Sol
extra-high effort, its own branch/worktree and its own database/dev/browser ports.
Do not reuse main's database or archived worktree services.

The coordinator owns shared-file reconciliation: migration numbering and journal
history, schema exports/runtime grants, Playwright project registration, admin
navigation, the shared booking-detail integration points and canonical context.
Workers propose narrow patches and freeze versioned contracts instead of racing
to overwrite shared files. No worker rewrites migrations 0000–0012. Isolated
branch migrations must be reconciled and tested as one additive integration
chain; never apply several competing 0013 histories to the same database.

The default is independent work. A worker waits only for a concrete missing
contract needed by its current step and continues unrelated authorized work.
Do not split a single feature into an unsecured UI and a later security task.

Suggested integration order: password change, meeting links, booking support,
account restrictions. Order manages schema and shared surfaces, not a reason to
leave workers idle. Final cross-feature checks cover suspension versus link read,
case-linked lookup, notification capture and password change; guardian revocation
and support reassignment; password rotation versus old sessions. Preserve existing
booking locks, overlap constraints, immutable history and monotonic TTL behavior.

## Incremental handoff and separate verification plan

1. Once the user requests implementation, each worker's `$build-feature`
   coordinator refreshes its own narrow architect blueprint and records
   `AUTHORIZED — build-feature delegation` for that actual request. Record the
   local decisions above in affected PRD/architecture and a concise decision record
   before implementing behavior that relies on them. Do not claim human approval
   of a generated blueprint or any real-world safety policy.
2. Build each service/data boundary and complete its role-specific UI, denial,
   empty, error and conflict behavior. Reuse `LessonTime` and existing design
   conventions; no unrelated dashboard or design-system rewrite.
3. Each worker conducts scoped Review and separate Verify in its isolated database.
   Existing scripts: `npm run check`, `npm run test:integration`, `npm run build`,
   `npm run test:e2e`. Run affected permission/race cases and retain applicable
   baseline coverage. Never reset another worker/main database; serialize
   database-mutating suites sharing one worker's database.
4. UI verification: desktop and phone, 320px overflow, keyboard/focus, accessible
   errors/status, private no-cache/metadata, and genuine no-JS behavior where the
   existing flow promises it. No fabricated evidence from source-worker reports.
5. For schema owners, prove fresh migration and actual upgrade from 0012 with
   preserved existing row values, restricted runtime grants, required constraints
   and triggers. Rollback is disabling the new surface while preserving data;
   no automatic destructive down migration or deletion of history.
6. Coordinator assembles the candidate, then two independent reviewers cover
   backend/authorization and user flows/privacy. Resolve findings, run the combined
   affected verification and preserve baseline discovery/booking/support/auth
   behavior. Work is not accepted on worker assertions alone.

**Verification status: FOUR LOCAL SLICES VERIFIED; COMBINED CHECKS PENDING.**
Each source passed its check, real PostgreSQL suite, production build and all83
default browser cases: meeting links581/284, support579/275, account
restrictions582/273, password591/267 (unit/component and PostgreSQL counts).
Root accepted frozen source manifests in `.local/four-feature-wave/imports/`.
Separate combined integration and independent review are still required. No commit, merge, push, deployment or production operation is included.
Actual verified tracker updates belong downstream.

## Context updates and policy boundaries

If implemented, update the relevant local-slice notes in PRD MEET-01/02,
ADM-03/04, OPS-05 and AUTH-04; architecture private-link/support/access/auth
boundaries; build-plan partial local status; UI context only for approved new
patterns; and verified progress/handoff after actual execution.

The proposed local link lifecycle and account restriction exercise do not decide
production link access windows, guardian consent, real tutor screening, safety
incident ownership, account appeals, retention or emergency response. Real
confirmation, cancellation/refunds, payments, ratings, provider email, reminders,
Neon/Railway deployment and real-minor onboarding remain outside this wave.

No unresolved real-world policy is needed to implement these four **bounded local
demonstrations**. If a worker finds that a requested behavior requires crossing
those boundaries, return that specific decision to the coordinator before changing
scope. User delegation supports routine/local product choices, not invented legal
or safeguarding approval.

## Execution authority

Status: **AUTHORIZED — build-feature delegation** on 2026-10-11 by the user's
explicit request to execute and spawn agents. Each worker must refresh and save
its narrower blueprint, then continue its complete `$build-feature` workflow.
The coordinator owns shared integration and independent review; workers do not
commit, merge, push, deploy or change another checkout's files or database.

## Integration execution contract — 2026-10-11

Status: **AUTHORIZED — build-feature delegation**, actual dispatched local
integration request based on the user's 2026-10-11 execution request. Own clean
checkout `cob-g/m5-four-feature-integration` at baseline
`024dd4d7ce885da7ca391aefeaf4096fc75fc91e`. This stage assembles the accepted
frozen source manifests supplied by root in sources.json; no source checkout,
main, archived evidence or another cluster may be modified.

Verified manifest/file/report hashes precede any imports. Reconcile shared paths
against baseline, preserve exact unique source files, import password first,
meeting links second, support third, and restrictions last. Keep immutable
0000–0012, append0013 meeting/0014 support/0015 restrictions with cumulative
snapshots and journal, preserve custom SQL and least-privilege grants. Insert
BookingSupportAction only in authorized detail navigation, preserve password
settings and all four sensitive browser projects in a serial dependency chain.

Owned database55485/dev3045/test3145, PostgreSQL17 and pinned own dependencies.
Prove fresh combined migration and real0012 upgrade with all baseline row values
preserved. Same-agent read-only Review precedes separate Verify: full check,
real PostgreSQL integration, build, default browser suite and combined actual
restriction/old-session/link/support/password/restore/expiry journeys, privacy
and accessible320px/phone/desktop feedback. Keep failure commands and exit
codes; Recover diagnoses before scoped repair. Final local report, source
provenance, tracked+untracked changed-file hashes, runtime fingerprint, exact
logs and ignored memory hand off to root. Root's two independent reviews remain
pending; no commit/merge/push/deployment/production authority is implied.

Rollback: disable new local surfaces while preserving data/history; no destructive
down migration or broad reset. Real-user, consent, legal, commerce, provider email
and external meeting policy remain gated. Verification: NOT RUN for this combined
checkout at blueprint creation.

### Scoped integration repair — native report entry

The combined browser run exposed prior authorized booking inlineRSC data retained after client navigation into support. The report action uses a native anchor with the same booking-ID-only target/text/classes to clear that previous document payload. This implementation detail preserves all existing server authority and minimal support DTOs; no new business or privacy policy is decided. Test private-value assertions use booleans to avoid dumping sensitive HTML. See the scoped Recover record and retained sanitized failure evidence.

Root msg_c29ef19f246a additionally authorizes a smallest sign-out transition repair if an actual same-browser actor probe finds retained private payload. The probe confirmed retention after sign-out/different-parent sign-in/Back with server401/404 denials. Successful SignOut now replaces the full document; the combined regression retains all absence and server-denial checks.

Root msg_0c6aeb57d0d0 extends the same observed retention diagnosis to actual
revoked-session reauthentication without explicit SignOut, in the same browser
with a different actor. Exercise it before freeze, retain observations, and if
reproduced repair only successful sign-in's document transition while preserving
validated returnTo. Keep the meaningful regression in default discovery.

The real revoked-session probe reproduced old payload after different-parent sign-in and Back, with server401/404 intact. The conditional root-authorized repair changes only successful sign-in to a full document replacement with the same validated returnTo. Both actual actor-transition regressions remain in the default combined suite.

### Final local execution evidence —2026-10-12 Asia/Manila

Same-agent read-only Review PASS (READY FOR VERIFICATION), followed by separate executed finalcheck600/realPG337/build/defaultbrowser99/99; fresh and actual0012 upgrade schema/grant proofs PASS. Safe visual inspection and strict privacy scan PASS. Exact private source/final manifests and failure/recovery evidence accompany docs/operations/four-feature-premerge.md. Independent root reviewers remain pending; no commit/merge/push/deploy or launch clearance.

### Accepted independent findings — delegated final recovery (2026-10-12)

Both independent reviews settled with exactly F1 (Important retained private
bootstrap before reauthentication) and F2 (Minor missing three-error password
summary). Root activated the bounded recovery under the actual2026-10-11
execution authority, **AUTHORIZED — build-feature delegation**. The canonical
Recover section in prompts/recovery/2026-10-11-four-feature-integration.md owns
the diagnosis and targeted handoff. Private/auth document layouts replace the
preceding private document before public auth children render; restored private
bfcache reloads current server authority. The password form adds the existing
UI-required focusable linked summary. No server/data/provider/dependency/schema
change or policy expansion. Strict original pre-signin absence, revoked/expired
Back without successful auth, failed-auth absence and actual three-error
keyboard/phone/corrected submission join separate check/build/default-browser
Verification. Historical600/337/99 remains historical; root owns independent
scoped re-review, final acceptance/refreeze and any separately authorized release.

Final targeted local Verify: check601/build/focused10/default101 PASS after
same-agent read-only Review and scoped re-reviews. Prior337realPG/fresh/upgrade/
grant proof applicability is tied to exact unchanged relevant hashes, not rerun.
Original before/failed-auth/Back-without-reauth and summary regressions pass.
Exact new evidence/report/manifests are under recovery-final; root scoped
independent re-review/acceptance/refreeze remains pending. No release clearance.

## Coordinator disposition — 2026-10-12

The four-feature candidate and scoped privacy/accessibility repairs are locally
verified and independently reviewed with no remaining confirmed findings in scope.
See `docs/operations/four-feature-premerge.md` and the current progress tracker for
exact evidence, retained historical results and limitations. The integration branch
remains uncommitted/unmerged; main database migration, cleanup and release actions
are separate subsequent work. This disposition changes status, not the delegated
product boundary or unresolved production/commercial/safeguarding decisions.
