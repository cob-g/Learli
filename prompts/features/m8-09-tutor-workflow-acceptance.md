# M8.9 — Tutor workflow acceptance and connected booking handoff

## Authority and current scope

Subsequent owner choice, 2026-10-16: private fictional staging, payments disabled.
This resolves the initial audience blocker below. Part A has since passed its
scoped Review/Verify. Continue dependent software under
[m8-03-private-fictional-workflow.md](m8-03-private-fictional-workflow.md); exact
hosted activation and real-family policy remain separate. Historical planning
status below is not the latest execution record.

- Date: 2026-10-16, Asia/Manila.
- Request: after the Tutor workflow cross-check, the owner said
  “okay lets do ur recommendation”.
- **AUTHORIZED — build-feature delegation** for the checklist corrections and
  preparation of the connected Parent/Tutor workflow. This is not separate human
  inspection of this generated blueprint, approval of real-family policies or
  authorization to deploy, purge accounts or migrate a hosted database.
- Part A: ready for implementation as a documentation-only acceptance unit.
- Part B: **BLOCKED — operating audience and dependent policies unresolved**.
  Record the answer before implementing the affected intake/booking behavior.

## Outcome and requirement mapping

The Tutor checklist must follow the actual registration/application path and
compare one authorized learner and one booking across Parent/Tutor views, private
meeting coordination, manual completion and history. It must distinguish source
implementation, isolated feature evidence and a passed complete journey.

- Primary owner: M8.9 acceptance matrix.
- Related: M2.4/2.9; M3.2/3.4/3.5; M4.1–4.4 and M4.5–4.11;
  M5.1–5.5/5.7/5.8; target-specific M8.2/3/4/10.
- PRD: AUTH-01/02/03/04/05, TUT-01–06, PUB-03/04, FAM-01,
  BKG-01–07, MEET-01–03 and OPS-02/03/04.
- Repository: `/Users/cob/learli`, branch
  `feature/staging-interface-cleanup-20261016`, HEAD `572cf4d` plus existing
  uncommitted onboarding/interface/completion changes. Preserve the entire
  pre-existing diff, including migrations0032/0033 and previous QA evidence.
- No new branch is proposed for Part A. Isolation for Part B is a later routine
  implementation choice after scope/ownership are known.
- Read AGENTS.md and all eight canonical context files in its prescribed order;
  do not treat old mixed-case path examples as canonical files.

## Repository evidence and agreed language

- Signup offers Choose later and Parent, not Tutor. A verified active account
  starts its own Tutor application at `/become-a-tutor`; the service grants only
  that account's Tutor role. Role membership does not confer public eligibility.
- Tutor profile fields are headline, introduction, combined teaching background,
  subjects/levels/specialty, teaching languages and IANA timezone. Display name
  is edited in Account Settings. Photos and pricing are unsupported.
- Public profiles use initials, disclose tutor-written background as unverified,
  and expose a deliberately limited eligible public DTO.
- Weekly availability has ownership, overlap, version and transaction safeguards.
  Removing weekly hours does not cancel/move saved bookings. It is not rejected
  merely because a booking lies outside the new hours. Dated time off separately
  rejects active booking overlap. Do not invent stronger rejection behavior.
- Tutor dashboard/history and meeting controls remain simulation-oriented.
- Admission and booking composition are disabled. Admission policy is explicitly
  synthetic; booking validation accepts enabled policy only in environment test,
  with literal test durations, cutoffs and assigned-admin confirmation. Enabling
  these factories or renaming their labels is not a normal staging integration.
- Assigned Tutor completion after scheduled end with an audit record is already
  approved and implemented under a distinct v2 capability. Do not reopen this
  actor decision or alter immutable older v1 receipts.
- The last default Parent attempt passed registration and stopped at Add Child.
  It produced no normal booking for this Tutor checklist. The separate 63 feature
  passes did not include availability or booking-notification browser suites.

## Decisions and assumptions

The owner accepted the recommended checklist adjustments: current application
entry, real field names, broad learner levels, photos/pricing Not Applicable,
guardian-managed child access through Parent, and one shared booking reference.
Approval of expected behavior is not a test result or approval of open policies.
No new terminology decision is needed for Part A.

Unresolved first decision for Part B: private staging with fictional accounts
only, or a pilot involving real families. Recommend private fictional staging,
payments disabled. This recommendation is not an approval of operating terms.
The exact staging target and any dependent confirmation/hold/consent/screening/
meeting-access policies must then be made explicit; never silently promote fixed
test terms to real customer terms. No company-wide payment decision is needed to
finish Part A.

## Part A — implementation now

1. Save `docs/qa/tutor-workflow-checklist.md` with the corrected nine steps and
   the user's eight security scenarios, plus meaningful retry/authority checks.
2. Require the same booking reference, participant identities, subject, UTC
   instants/local zones and final status throughout. A previous successful
   Parent booking must actually exist; otherwise mark dependent steps BLOCKED.
3. Separate observable application completion from external meeting connection.
   No Zoom/Meet connection or attendance can be inferred from a 303 redirect.
4. Record source/evidence limitations without marking a new Tutor journey PASS.
5. Record the actual owner approval in a focused decision file, link acceptance
   scope from the existing PRD Tutor requirements and M8.9 work package, and
   update the progress tracker truthfully.
6. Review the exact documentation delta; then run scoped formatting, local-link
   and whitespace checks. Application checks are not required for this unit if
   source/test/configuration hashes remain unchanged. Preserve historical results
   separately rather than claiming to rerun them.

### Part A invariants and compatibility

No app routes, features, authentication, database, tests, provider settings,
business policies or dependencies change. The checklist is not a requirement to
add a Tutor signup selector, grade engine, photo upload, pricing or Tutor booking
acceptance. Historical Parent checklist and QA results retain their meanings.
Existing assigned-Tutor completion approval remains resolved.

## Part B — connected normal booking integration, not yet authorized in detail

Once the necessary audience/policy decisions are answered, the coordinator must
return to Architect for this dependent vertical slice. Reuse the existing
admission, screening and booking engine rather than a second reservation system.

1. Define the permitted audience/data and versioned operating policy. Real
   families require the applicable consent/guardian proof, eligibility and staffed
   safety process; fictional testing must remain explicitly isolated and honest.
2. Connect current Parent enrollment to minimal learner intake, pending review,
   explicit authorized guardian linkage and revocation. A typed name or Parent
   role must never automatically authorize a child.
3. Connect approved eligible Tutor discovery and actual-date selection to the
   same authorized booking engine with the approved confirmation actor/rule and
   bounded pending state. Preserve DB overlap exclusion and retry idempotency.
4. Integrate source-correct Parent/Tutor dashboards/history and private meeting
   link controls. Retire legacy simulation entry points only when their supported
   replacement is usable; do not hide a gate by deleting a disclaimer.
5. Reuse the approved assigned-Tutor completion after scheduled end with one
   actor-attributed event. No external attendance, automatic call completion or
   payment claim. Keep no-show/cancellation actor and cutoff rules explicit.
6. Define notification dispatch and observable provider outcome separately from
   booking commit. A booking must remain accurate when email fails.
7. Verify one same-Parent/same-child/same-Tutor/same-booking browser scenario with
   positive and negative cases, real PostgreSQL conflict/retry checks and correct
   time zones. Capture truthful blocked/failure states and resulting history.
8. Only after an exact isolated target and deployment/migration operation are
   explicitly authorized, run target-specific staging acceptance. Account purge
   needs its own concrete preservation/recovery preview; do not include it in a
   generic integration change.

### Part B affected areas and data boundary

Actual existing boundaries include `features/learner-admission`,
`features/tutor-screening`, `features/booking-workflows`, participant booking
queries, family/Tutor dashboard composition, private meeting links and
transactional delivery. No specific migration or schema redesign is authorized
by this blocked outline. Assess whether additive changes are needed after the
operating policy is selected; preserve all historical SQL, events and runtime
least-privilege grants.

## Review and verification handoff

Part A separate Review must compare this blueprint with the exact new doc delta,
not all prior uncommitted implementation. Check optional fields/actions, gate
preservation, scope terminology, evidence labels, link targets and documentation
consistency. Recommendation is not runtime verification.

Part A separate Verify: scoped Prettier check of the new/changed QA, decision and
blueprint files, local Markdown link resolution, `git diff --check`, and source
hash comparison with the baseline. Do not run builds, databases or browsers just
to substantiate doc-only changes. Verification status here: **NOT RUN — planning**.

Part B needs a new exact verification plan covering affected unit/components,
real isolated PostgreSQL/migrations, mandatory booking concurrency/ownership,
Playwright same-record lifecycle, typecheck/lint/build and narrow/wide layout
checks. Live meeting connection remains a separately authorized manual action.

## Context, rollback and blockers

- Part A changes only documentation; rollback is an isolated textual diff, with
  no user-data restoration. Save the pre-existing doc state before implementation.
- Update `context/prd.md`, `context/build-plan.md` and
  `context/progress-tracker.md` for accepted scope/actual status only. No
  architecture/UI standard change is needed for checklist corrections.
- Part A is **AUTHORIZED — build-feature delegation** and may proceed.
- Part B remains **BLOCKED** on the first audience decision, followed by whatever
  exact operating terms and target prerequisites that answer actually requires.
  General approval of this recommendation does not choose those missing rules.

Return to the build-feature coordinator. Do not implement, verify, update the
tracker or invoke another skill from the Architect stage itself.
