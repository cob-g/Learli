# M8.3 — Manual persistent-booking preview

- Status: **AUTHORIZED — build-feature delegation**.
- Date: 2026-10-17, Asia/Manila.
- Authority: The owner requested the complete workflow for manually testing real
  persisted booking behavior, then selected the recommended separate preview:
  “okay approve the separation private view so the old simulation is gone right?
  but same workflow?” on 2026-10-17. This selects a separate full-workflow private
  preview with fresh fictional accounts and payments disabled. It is execution
  authority within `build-feature`, not separate human inspection of this
  generated blueprint. Preserve the existing Neon-development accounts/history
  outside the new preview; do not migrate or delete them.
- Existing decisions: `docs/decisions/2026-10-16-private-fictional-staging.md`
  already selects finite fictional accounts, payments disabled and the existing
  QA policy. Assigned-Tutor completion after the saved end is already selected.
  Do not ask either decision again or infer real-family/production activation.
- Primary work: M8.3; related M8.9, M4.6–M4.10, M5.1–M5.6/M5.11.
- PRD: BKG-01–07, MEET-01–03, FAM-01–03, TUT-01/06, OPS-01–04,
  ADM-01/03; preserve AUTH-03 and all current assurance/ownership controls.
- Repository: `/Users/cob/learli`, branch
  `feature/desktop-navbar-reference-20261017`, HEAD
  `616e8c734acebec0f7b51c5f96fb182dc4001d93`.
  Substantial prior uncommitted UI/auth/Parent work must be preserved.
- Working checkout/branch: **proposed** isolated Orca-managed manual-preview
  checkout; coordinator selects its exact name after inventory. Architect does
  not create it.

### Required implementation context

Read repository-root `AGENTS.md`, then the eight canonical files in its required
order: `context/project-overview.md`, `context/architecture.md`,
`context/ui-context.md`, `context/code-standards.md`,
`context/ai-workflow-rules.md`, `context/progress-tracker.md`, `context/prd.md`
and `context/build-plan.md`. Read the private-fictional decision above and this
blueprint. Earlier mixed-case links do not select alternative context copies.

## Implementation Plan — Manual persistent-booking preview

### What we are building

A manually usable private preview in which Parent/eligible College Student
requests create genuine persisted workflow records, an assigned MFA-admin can
confirm them, confirmed records survive the provisional deadline, the assigned
Tutor provides a private Zoom/Meet URL and completes the lesson after its saved
end, and authorized dashboards/history reflect the same record and transitions.
All active public/role entry paths in this preview use the same persisted
workflow and ordinary provisional/confirmed/completed/cancelled language within
one clear private-test notice. The old ten-minute simulation creation path is
absent from this active preview. Historical simulations remain preserved outside
it with their original provenance; they never become confirmed lessons. The user
still follows discovery → account/learner eligibility → slot request → assigned
Admin confirmation → private meeting → Tutor completion → shared history.

### Language and established decisions

- Actual workflow means actual database transactions, authorization, saved
  statuses, audits, overlap prevention, retries, private links and cross-role
  reads, exercised with fictional accounts. It does not establish attendance,
  delivered email, payment or public launch.
- Reuse the already approved QA inputs: 60-minute lessons, 30-minute starts,
  60-minute notice, 14-day horizon, ten-minute provisional holds and 60-minute
  cancellation/move cutoffs. Confirmation outlives the provisional deadline;
  pending requests still have a real bounded deadline.
- Confirmation remains assigned MFA-admin review. Completion belongs to the
  assigned Tutor after the saved end; no-show retains its existing scope.
- Payments and real-family intake remain disabled. There is no new commercial,
  consent, review-publication or safeguarding policy.

### Evidence from the current repository

- `src/features/booking-workflows/composition.ts` remains disabled without an
  explicit private packet. `/bookings/demo` then uses the legacy local engine.
- `src/features/bookings/service.ts` writes `local_simulation` / `demo_reserved`
  in that engine. Old reservations expire; relabeling them cannot confirm them.
- `/bookings/new`, `WorkflowRequestForm`, policy services and PostgreSQL already
  implement provisional/confirmed/completed/cancelled/replaced states. Reuse
  this engine, not a second booking implementation.
- `src/features/private-workflow/config.ts` and `runtime.ts` bind private authority
  to an owned loopback `learli_test` runtime or registered hosted staging.
  Ordinary development/Neon-development is intentionally refused.
- `src/lib/env/schema.ts` and `src/lib/db/neon-development.ts` enforce that
  separation. The latter's `realWorkflows=disabled` is not a switch to flip.
- `scripts/private-workflow.ts` and `private-workflow/operator.ts` support owned
  local-test preparation and exact review metadata. Each provisional booking
  currently requires `grant-confirmation` before its assigned Admin can act.
  Account role alone cannot discover or confirm arbitrary bookings.
- Private queries intentionally exclude legacy fixture learners/simulations.
  Activating a packet without preparing its audience would hide older records
  rather than migrate them.
- Existing independent Student profiles have unique immutable user/provenance
  association; admission in migration0034 refuses an existing self profile.
  Existing approved Tutors cannot request pending-only screening through an
  ordinary profile edit. Do not rewrite source/status to manufacture eligibility.
- `package.json` defines `check`, `build`, `test:integration`,
  `test:e2e:private` and `private-workflow:operator`. Private Playwright global
  setup rotates its own audience/packet and may prepare destructive fixtures;
  it must never target the long-lived manual database. Its historical completed
  booking is separate from the new future booking exercised in the same suite.

### Selected decisions and assumptions

- **Separate full-workflow preview, fresh fictional accounts — selected by owner.**
  Use the existing supported owned local private composition and a new local
  PostgreSQL cluster. Keep the current Neon-development accounts/history and
  configuration intact. No Neon-development private binding, eligibility rewrite
  or legacy-history migration is authorized or needed.
- **Exact local topology — delegated engineering choice.** Inventory listeners,
  active checkouts, database markers and existing processes before choosing the
  checkout path, database port and app origin. Its `learli_test` database belongs
  to its own cluster, separate from the root automated-test cluster and from all
  automated acceptance targets. The product's hosted targets remain Neon/Railway;
  this reuses the already approved local development exception.
- **Same guarded workflow — established decision.** Fresh Parent/College/Tutor
  onboarding, fictional evidence, current assigned MFA-admin review, atomic
  booking and assigned-Tutor completion remain actual application operations.
  A new test Admin may receive only the explicit finite owner bootstrap grant;
  no browser-selected role, user self-approval or general runtime role write.
- **Repeatable owner preparation — delegated engineering choice.** Keep the
  current exact per-record operator actions and add one bounded, explicit manual
  dispatch command for newly created work. It prepares assignments/grants only;
  the assigned Admin still reviews and confirms through the actual UI.
- No additional terminology clarification or material product decision is
  required for this private fictional slice. Finite packet/evidence/grant expiry
  remains enforced; expiration is a truthful maintenance state, not a reason to
  silently replace immutable policies or extend booking holds.
  Reuse the current finite 24-hour screening preparation window; record its exact
  expiry prominently. Changing the window or policy is a separate explicit
  maintenance operation, never an implicit startup/dispatch side effect.

### Scope and invariants

- Included: isolated normal-build preview, finite new fictional accounts, private
  configuration/credentials, reviewed onboarding and booking, bounded operator
  preparation, accurate active-path wording, persistent role views and concise
  manual operations/checklist handoff. Reuse the authored Parent Profile/My
  Children/Grade and Parent Dashboard changes, current public discovery and auth.
- Excluded: live payments, real people, mail delivery/provider activation, actual
  video attendance, hosted resources, public launch, a second booking engine,
  automatic approval, broad Admin access, uploads/LMS, redesign, dependency churn,
  source-factory replacement, legacy conversion, and deletion/reset of old data.
- Preserve Better Auth identity, verification, current roles/account/session,
  exact guardian/self ownership, finite audience, current policy/evidence,
  assigned current MFA, packet continuity after waits, UTC/IANA time behavior,
  tutor-first locks, database conflict constraints, idempotency, append-only
  events and committed notice intents. Meeting links stay participant-private.
- No schema/migration or runtime privilege expansion is planned. Owner metadata
  preparation uses the existing reviewed operations; no direct writes of
  admission/screening outcomes, beneficiary links, booking states or timestamps.
  Retain original synthetic receipt identities and QA parameters unchanged.

### Affected areas

Reuse `src/features/private-workflow/{config,runtime,operator,notice}.ts*`,
`scripts/private-workflow.ts`, local database/migration tooling and the existing
admission, screening, booking workflow and participant services. Proposed
`scripts/manual-preview-dispatch.ts` is a thin owner-only wrapper, not a web
route or service. Its strict dispatch-only guard may narrowly extend the existing
operator to recheck unassigned/current-authorized metadata after its exact locks;
the existing deliberate exact-ID CLI operations retain their behavior. Limit
other application edits to required private-mode presentation and routing across
public discovery/continuation, role dashboards, booking
detail/change forms, Tutor profile/screening/time-off, assigned Admin and support
surfaces. Preserve legacy/default copy when no private packet is selected.

### Incremental implementation

1. Capture the exact current authored state, dirty/untracked ownership and runtime
   configuration hashes. Preserve the existing preview and populated Parent
   rollout backup. Use Orca-managed isolation if another checkout is required;
   carry the current authored application state accurately, including approved
   uncommitted source/assets/tests/docs. Exclude environment files, `.local`,
   `.next`, dependencies and private artifacts; generate new local secrets and
   compare an explicit source manifest. Do not copy the HEAD-only application,
   replace factories or commit/merge implicitly.
2. Prepare an independently owned loopback cluster/checkout and private packet
   using the installed local tooling and exact current migrations. Its owned
   test database must be separate from the ordinary automated test target so
   later verification cannot erase manual sessions. Choose and record exact free
   ports and origin only after inventory; no hosted provider operation is needed.
   Use a separate browser host/profile or verified cookie boundary so the manual
   and original preview cannot share an authenticated browser session. Keep
   long-lived manual credentials in private operator/runtime files, with an app
   runtime role and a separate owner connection for explicit preparation. Do not
   leave default automated runners pointed at this database; segregate their
   environment files and refuse an automated fixture/reset run against the manual
   target. A restart must preserve accounts, policies, bookings and history.
3. Provision finite fictional identities through the actual auth/onboarding
   interfaces, retaining supported roles and current-MFA setup. Prepare dedicated
   Parent, College Student, Tutor, Admin and unrelated-denial accounts; document
   the narrowly scoped owner bootstrap of the new test Admin. Prepare policy
   metadata and exact review assignments through the existing owner operator.
   Tutor screening and learner authority must follow the real guarded services;
   do not pre-label fixture source as reviewed or expose credentials in reports.
   Use the current radio-based signup controls rather than obsolete test-helper
   selectors. Enroll MFA through the actual provider and preserve owner-usable
   setup/recovery material in an owned 0600 ignored private account artifact, or
   let the owner enroll from `/account/security` before Admin acceptance. Never
   discard the only factor after scripted setup, export browser session state,
   or disclose credentials/factors in chat, screenshots, logs or Git.
4. Implement the bounded manual preparation contract below. An Admin dashboard
   with no assignment is not a working confirmation workflow. Run preparation
   explicitly after pending onboarding/screening or a provisional request; then
   use current-MFA Admin UI for the actual decision. No automatic dispatch,
   grant loop, role bypass or browser-only self-service claim.
5. Start the normal application build with the explicit private packet and verify
   all Parent/Student/Tutor/Admin entry points use the persistent workflow and
   ordinary state labels. Audit marketing discovery, selected-slot continuation,
   tutor time-off notices, page metadata and other visible simulation copy in this
   active mode, including support/account/admission/screening surfaces. Active
   paths cannot fall back to `/bookings/demo` legacy semantics; any retained URL
   must route through the private workflow or deny safely. Identify QA proof and
   private-only policy limits truthfully without scattering simulation labels.
   Preserve truthful test scope, actual status and original historical provenance.
6. Hand over the working URL, private account sheet, required Admin setup/review
   actions and one concise same-booking manual checklist. Do not hand over only
   preconstructed outcomes or automatically run a full fixture suite against the
   long-lived manual database.

### Bounded manual preparation contract

Use the existing CLI for exact records from the manual checkout, with privately
loaded manual test/owner environment and the explicit packet path:

```text
npm run private-workflow:operator -- --test --apply --config <private-packet> --action prepare --reviewer <test-admin-email>
npm run private-workflow:operator -- --test --apply --config <private-packet> --action assign-admission --reviewer <test-admin-email> --admission <pending-admission-id>
npm run private-workflow:operator -- --test --apply --config <private-packet> --action assign-screening --reviewer <test-admin-email> --tutor <pending-tutor-id> --valid-until <bounded-ISO-expiry>
npm run private-workflow:operator -- --test --apply --config <private-packet> --action grant-confirmation --reviewer <test-admin-email> --booking <provisional-booking-id> --valid-until <bounded-ISO-expiry>
```

The handoff must replace placeholders in a private local account/operations
sheet and supply an executable wrapper for its exact environment. The existing
CLI deliberately loads no dotenv; `with-test-env.mjs` clears private composition
for automated tests, so merely exporting an ambiguous default is insufficient.

For repeat use, the proposed thin `scripts/manual-preview-dispatch.ts` command
accepts explicit `--test --apply --config <private-packet> --reviewer
<test-admin-email>` and privately reads only this checkout's dedicated manual
environment. It must:

1. Reuse exact owned-cluster/marker/role/origin and packet admission, refusing
   hosted/Neon/production, foreign paths/ports, missing or replaced packets and
   reviewers outside the finite audience. Require the already bootstrapped,
   active verified test Admin; create no account, role or MFA receipt.
2. Take one bounded owner-metadata snapshot of at most 20 total eligible records:
   pending current-policy admissions, pending current-version screening cases
   and latest unexpired provisional bookings, with all requester/Tutor accounts
   in the packet and self-review excluded. Skip records already correctly
   assigned/granted; do not revive revoked grants or replace another reviewer's
   assignment. A larger/ambiguous set refuses before mutation.
3. Invoke `runPrivateWorkflowOperation` sequentially for each exact ID; retain
   its own current-state, ownership, locks, policy and expiry checks. No broad SQL
   grant, booking confirmation, evidence submission or status update. Bound each
   `validUntil` by the existing packet window and report an expired request as
   unavailable; do not renew its hold or construct a replacement automatically.
   Snapshot filtering alone is insufficient: strict dispatch mode must recheck
   absence or the same still-authorized assignment/grant after the operation's
   locks, before any mutation. A concurrent reassignment/revocation must refuse
   rather than invoke the ordinary owner override to reverse it.
4. Exit after that finite batch, with safe counts and explicit partial/refused
   outcome. Keep per-record receipts/identifiers privately for review; emit no
   credentials, MFA material, child fields or meeting links. A partial failure
   stops the batch and is safe to retry; never undo completed review decisions.

This command is owner-invoked when new tasks need assignment, not a scheduler,
startup hook, browser mutation or always-on worker. Repeat the actual sequence:
submit request → run manual preparation → Admin reviews; request slot → run
manual preparation → Admin confirms within the existing ten-minute deadline.
Rescheduling uses the existing replacement semantics and requires a new exact
preparation only if the resulting current state requires assigned confirmation.

### Verification plan for a separate Verify stage

- Read-only Review compares the selected plan, exact scoped diff and data/role
  preparation. Review is separate from executed verification.
- Run applicable format/lint/type/unit/build checks if source changes; add
  meaningful regression safeguards for any new dispatch, target binding or copy
  behavior. Validate preparation/configuration without weakening existing tests.
- Use a different owned database for automated PostgreSQL/browser checks. Reuse
  current private Parent/Student/Admin suites and concurrency/authority tests for
  affected services. Assert exact cross-role IDs/statuses, retries, overlap denial,
  safe cancellation/replacement, private link access and refresh consistency.
  Cover the new helper's finite scope, repeatability, refusal/partial outcomes,
  expiry, foreign account/reviewer/target, no reassignment/revoked-grant revival,
  no automatic approval and current-state rejection after a real lock wait.
- On the manual target, create one fresh booking through the actual UI, prepare
  its required exact review assignment, confirm with current MFA and compare all
  authorized role views. Record the actual transition and scope, not inferred
  delivery or meeting attendance. Do not mutate timestamps to fake elapsed time.
  Observe that the same confirmed booking remains active after its original
  ten-minute hold deadline and after an app restart/refresh; compare stored state,
  event/notice counts and all Parent/Student/Tutor/assigned-Admin views as relevant.
- For a fresh lesson, manual completion requires its actual scheduled end. The
  existing browser suite's separately historical completed fixture is useful
  regression coverage but is not proof that the newly created session elapsed.
- Check desktop/phone, keyboard/focus, loading/error/empty states and ordinary
  state wording in the active private composition; no visual redesign.
- Verify original accounts/history/config remain intact and only intended preview
  processes are running. Preserve all failed attempts and exact check evidence.
- Verification status: **NOT RUN — architecture planning only**.

### Context updates by the downstream implementation owner

Record the chosen target/account scope in a dated decision before implementation.
Update architecture/PRD/build-plan only for this approved local operating setup;
record actual implementation/Review/Verify separately in the progress tracker.
Add concise manual-preview operations and accurate UI surface documentation as
needed. Save a sanitized local handoff preserving the existing Feature History.

### Risks, open decisions and approval boundary

No unresolved material decision blocks this selected slice. Exact topology is
inventory-dependent engineering work. Long-lived manual data must be protected
from automated fixture teardown; finite packet/evidence expiry must be explained
and maintained explicitly. An operator assignment step remains part of this
manual private setup. Neither ordinary labels nor Admin confirmation imply real
attendance, delivery, payment or approved customer terms.

Payment, real participants, real email delivery, external meetings, hosted
deployment and production actions retain their separate operation gates.
Git commit/merge/push and destructive cleanup are not authorized by this plan.
Architecture planning changed only this canonical Markdown; no code/config,
database, service, branch, test/check or progress-tracker operation was executed.
The coordinator owns separate implementation, read-only Review, executed Verify
and Remember stages. No separate blueprint inspection or completed verification
is claimed.
