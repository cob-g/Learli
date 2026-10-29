# M4.4 — Master workflow alignment and independent learner correction

Status: **APPROVED — 2026-10-18, with owner conditions recorded below**

Authority: the owner's 2026-10-18 Master Workflow Alignment
request establishes that Learli is a tutoring marketplace, ordinary new child
creation is self-service, and an eligible independent adult learner must not
require routine school-style admission or routine Admin booking confirmation.
College Support is an education level, not proof of adulthood or legal capacity.

Repository: `/Users/cob/learli`. Observed branch/commit: local `main`,
`3ad1933d3904a06bb11a8b37bc3251dd4106420d`. The working tree was materially
dirty during inspection because the automatic Parent-child feature, migration
`0038`, tests and context updates were present but uncommitted. This blueprint
plans from that exact snapshot and must not overwrite or silently discard it.
Suggested implementation branch after the existing work is safely preserved:
`feat/master-workflow-alignment` (**proposed only; Architect did not create it**).

Architect read `AGENTS.md`, all eight canonical context files in the required
order, relevant decision/feature handoffs, current routes, services, schemas,
migrations, tests, scripts and CI configuration. `PROJECT-MASTER.md` was absent.
No standalone implementation or verification skill is installed; `build-feature`
can coordinate those later if explicitly invoked. This planning pass changed
only this canonical blueprint and did not run tests, builds, browsers, database
commands, migrations or services.

## Implementation Plan — Learli workflow alignment

### What we are building

Align the ordinary independent College learner journey with the already-corrected
Parent journey while retaining Learli's security and data-integrity controls.
An active, verified user who expressly confirms that they are legally eligible
to manage their own tutoring account in the enabled operating policy can create
one private self-managed College Support learner profile and receive the Student
role atomically, without a routine Admin admission queue. They can then create a
confirmed no-money booking under a dedicated independent policy, subject to all
existing ownership, Tutor eligibility, availability, time-zone, idempotency and
database conflict checks. The same stored booking remains the source for Student,
assigned Tutor and exact scoped Admin views.

The change also corrects three proven booking presentation/receipt defects and
audits hidden Tutor mutation authority against the actual supported V1 contract.
Tutor cancellation/rescheduling behavior must not change without a separate
owner decision after that audit.
Historical admissions, reviews, bookings and audit events remain preserved.
Real-minor independent access, secure linking to an existing student account,
public-market legal eligibility, payments and real provider operation remain
separate approval gates.

### Requirement and milestone mapping

- Primary build item: **M4.4**. Related items: M2.3–M2.5, M2.9,
  M4.5–M4.11, M5.1–M5.6, M5.8–M5.9, M8.3, M8.5, M8.9–M8.10.
- PRD: **AUTH-01/03/05, FAM-01–04, TUT-01–06, BKG-01–07,
  MEET-01–03, ADM-01–04, OPS-01–05, NFR-03–05** and business rules
  **BR-01–08, BR-11/12, BR-14–18**.
- The latest owner instruction supersedes the current AUTH-03 wording that routes
  every independent College intent through assigned Admin eligibility review.
  Context updates belong to the implementation stage after this blueprint is
  approved; historical decision records must remain historical.

### Workflow alignment matrix

Statuses distinguish current static evidence from historical executed evidence.
No fresh checks were executed during architecture planning.

| Workflow                    | Expected                                                      | Current implementation                                                                                                                   | Status                                           | Risk / action                                                         |
| --------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| Parent registration         | Verified self-service Parent workspace                        | Better Auth rejects submitted role escalation; the locked enrollment operation grants only Parent and audits it                          | **PASS locally**                                 | Preserve                                                              |
| Parent adds a new child     | New private child, declaration/consent, no routine Admin      | Current dirty tree's guardian-v2 flow atomically creates active learner, attestation and authorized link without staff                   | **PASS for `local_operation`; PARTIAL globally** | Preserve and integrate; hosted activation remains policy-gated        |
| Adult learner registration  | Eligible adult self-service; College alone is not eligibility | Student is only signup intent; current admission creates inactive/pending learner and requires assigned MFA Admin evidence/authorization | **FAIL**                                         | Independent-v2 attestation and atomic self-profile creation           |
| Minor independent access    | Guardian and launch-market safeguards                         | Parent-managed new child is guarded locally; signed-in minor/existing-account linking and launch-country policy do not exist             | **NEEDS DECISION**                               | Keep disabled; design separately                                      |
| Tutor registration/profile  | Basic eligibility review, own profile only                    | Ownership-scoped application/profile and evidence-based Tutor screening exist                                                            | **PASS statically; runtime not rerun**           | Preserve basic screening; real policy remains launch-gated            |
| Tutor discovery             | Only currently eligible, approved, active Tutors              | Central eligibility predicate gates public directory and subject coverage                                                                | **PASS structurally**                            | Current empty results are truthful when no Tutor is eligible          |
| Parent booking              | Authorized child, server slot checks, no normal Admin         | Parent-v2 creates direct confirmed no-money booking with DB conflict protection                                                          | **PASS in current dirty local tree**             | Preserve                                                              |
| Independent Student booking | Eligible self learner books without routine Admin             | Local booking-v1 creates provisional booking requiring exact assigned MFA Admin confirmation                                             | **FAIL against latest rule**                     | Dedicated independent-booking-v2                                      |
| Tutor receives booking      | Assigned Tutor reads same record                              | Participant and Tutor queries read the same physical/logical booking chain                                                               | **PASS statically**                              | Preserve minimum learner disclosure                                   |
| Admin booking oversight     | Scoped operational view                                       | Exact assigned MFA Admin gets minimum fields; no meeting URL or general private-record bypass                                            | **PASS statically**                              | Preserve; platform-wide totals are intentionally out of current scope |
| Meeting access              | Assigned Tutor and current beneficiary only                   | Strict Zoom/Meet validation, one private link per physical booking and fresh participant checks exist                                    | **PASS for software boundary**                   | Actual provider meeting/attendance remains unverified                 |
| Cancellation                | One state change reflected on fresh reads                     | Atomic policy-driven change retains history                                                                                              | **PASS locally**                                 | Preserve; notification/provider operation remains gated               |
| Rescheduling                | Revalidate new slot, keep one logical chain                   | Atomic replacement and conflict handling exist, but stored `displayTimezone` is incorrectly forced to `UTC`                              | **PARTIAL**                                      | Correct trusted time-zone receipt                                     |
| Booking history             | Accurate ordered lifecycle                                    | Logical history exists; same-timestamp reschedule events sort by random UUID                                                             | **PARTIAL**                                      | Add deterministic semantic ordering                                   |
| Provisional meeting state   | Truthful pending message, no link                             | Provisional rows are returned/rendered as expired or “no longer active”                                                                  | **FAIL (UX contract)**                           | Add unavailable-until-confirmed state for legacy rows                 |
| Tutor cancel/reschedule     | Only explicitly approved actors                               | SQL allows assigned Tutor while the V1 UI intentionally hides the actions                                                                | **NEEDS DECISION / least-privilege mismatch**    | Remove hidden Tutor authority unless separately approved              |
| Notifications               | Commit-independent, correct scoped recipient                  | Durable/local capture and bounded adapter exist; real Resend delivery is not active evidence                                             | **PARTIAL / launch-gated**                       | No provider expansion in this slice                                   |
| Payments                    | Only after business approval                                  | Disabled; no payment schema/provider                                                                                                     | **NOT IMPLEMENTED by design**                    | Keep disabled                                                         |
| Reviews/ratings             | Only after policy approval and verified lesson                | Truthful publication is disabled                                                                                                         | **NOT IMPLEMENTED by design**                    | Keep gated                                                            |

Historical records document broad local test success for Parent, Student, Tutor,
Admin, cross-role, security and booking paths. Those records are evidence about
the tested earlier snapshots, not fresh verification of this dirty tree.

### Language we agreed on

- **Learner admission request**: the existing versioned eligibility/relationship
  review record. It remains valid historical and exceptional-review machinery;
  it is no longer the ordinary entry point for an eligible independent adult.
- **Eligible independent adult**: a verified account holder who affirmatively
  accepts the current independent-eligibility notice and declares they are an
  adult or otherwise legally able to manage the tutoring account independently.
  College Support alone never proves this fact.
- **Student role**: trusted server-side access granted only with successful
  self-profile authority, never from the signup radio, URL or request body.
- **One booking**: one database-backed logical chain shown through role-scoped
  projections. It is not copied into separate Parent/Student/Tutor/Admin records.
- **Confirmed local booking**: a committed no-money coordination record. It does
  not imply payment, email delivery, Zoom/Meet attendance or lesson completion.
- **Exceptional review**: a separate, scoped human path for disputed linking,
  suspicious activity, safeguarding, restrictions or genuine eligibility cases;
  it is not routine marketplace onboarding.

### Decisions proposed for approval

1. For the current local/staging synthetic workflow, use an explicit, versioned,
   unchecked-by-default declaration: **“I confirm that I am an adult or otherwise
   legally eligible to manage this tutoring account independently.”** Record its
   exact notice/policy receipt. This is a product assertion, not identity proof.
2. Limit automatic independent-v2 creation to one self-managed **College Support**
   profile per user, matching current schema and product scope. Do not infer age,
   admit other learner levels, collect DOB, or create a minor login.
3. Use a new immutable `local-independent-admission-v2` policy and dedicated
   attestation receipt. Do not edit/relabel v1 policy bytes or manufacture staff
   evidence.
4. Use a separate immutable `local-independent-booking-v2` policy for eligible
   self-managed learners. It creates a confirmed no-money local booking directly;
   Parent-v2 and old booking-v1 retain their original terms.
5. Preserve all old admission rows and states. New ordinary requests stop entering
   the legacy queue, but pending/rejected/revoked v1 rows are not auto-approved,
   deleted or rewritten. A case-specific legacy conversion is deferred until its
   authority/history model is separately approved; existing authorized v1 users
   and bookings continue to work unchanged.
6. Audit the current Tutor actor mismatch before changing it. Preserve all
   existing Tutor cancellation/rescheduling behavior during this implementation.
   If it is a supported feature, document the UI/API discrepancy and propose an
   alignment separately. If it is unsupported, present the behavior change for
   owner approval before removing database authority.
7. Real public activation remains blocked on launch jurisdiction, legal definition
   of independent eligibility, reviewed notice/consent wording, real Tutor safety
   operation and incident ownership. Local attestation does not claim compliance.

### Assumptions

- Migration `0038` and the current Parent-v2 work are the integration baseline,
  but must first be preserved and reviewed as an explicit diff because they are
  not yet a reproducible commit.
- `local_operation` remains the only enabled real-flow environment for this slice.
  The same architecture can later receive a separately approved hosted policy.
- Fresh reads/refresh are the synchronization contract; realtime push is not
  required.

### Scope

- **Included:** governing-context reconciliation; independent-v2 intake,
  attestation, role/profile authority and UI; direct Student booking-v2; legacy
  preservation inventory/tests; provisional meeting wording/state; reschedule
  time-zone receipt; deterministic history ordering; Tutor actor capability audit;
  two truthful low-risk Tutor/Admin/meeting copy corrections; regression tests.
- **Excluded:** real-minor independent accounts, linking/claiming an existing
  learner, identity-document uploads, broad Admin child access, auto-approval of
  legacy cases, platform metrics, payment/review activation, provider-created
  meetings, attendance verification, realtime infrastructure, LMS features,
  production deployment or data cleanup.

### System invariants

- Active verified Better Auth identity plus trusted DB role and exact record
  ownership are required at every server boundary. UI visibility is not authority.
- The independent endpoint accepts no user ID, role, source, state, policy ID or
  existing learner target. It can create only the caller's one new self profile.
- Parent A cannot read/book Parent B's child; Student A cannot read Student B's
  learner/booking; Tutor A cannot access Tutor B's booking; Admin has no universal
  private-data or meeting-link bypass.
- Child profiles remain private. Existing-account linking never occurs by name,
  email, guessed UUID or educational level.
- Original policy receipts/events remain immutable. Current authority is computed
  from the learner's actual original receipt and required attestation/evidence.
- Bookings retain UTC instants plus the relevant validated IANA zone, server-side
  availability revalidation, one logical chain, idempotent requests and database
  exclusion/transaction protection against overlap.
- Meeting URLs are private participant data and never enter Admin projections,
  public pages, metadata, logs or audit payloads. A link does not prove attendance.
- Email/provider failure cannot roll back or duplicate a committed booking.
  Payment remains disabled and cannot influence status.

### Affected areas

- Context/decisions after approval: `context/prd.md`, `context/architecture.md`,
  `context/build-plan.md`, `context/ui-context.md`, a dated decision record, and
  `context/progress-tracker.md` only after verified implementation work.
- Independent onboarding: `src/app/(workspace)/student/onboarding/page.tsx`,
  `src/features/student-onboarding/*`, `src/features/learner-admission/*`, a
  focused proposed `src/features/independent-learner/*`, and a proposed strict
  `POST /api/student/profile` endpoint.
- Schema/migration: admission policies/state/events, proposed immutable
  `learner_independent_attestations`, learner authority/integrity functions,
  Student role/audit operation, next forward migration/snapshot/journal, runtime
  function grants and local policy preparation.
- Booking: `src/features/booking-workflows/{policy,service,forms}.ts`, booking
  receipt/event constraints and forward SQL definitions; participant read/history,
  meeting state model/service/component and relevant APIs.
- Admin/Tutor copy: only stale local-screening and generic test-link wording;
  do not broaden capabilities.
- Existing unit, component, integration, local PostgreSQL and Playwright suites.

### Data and authorization changes

- Add one immutable independent policy in a distinct market key and one dedicated
  attestation table keyed to admission, learner, requester, request/fingerprint,
  exact policy/digest/notice, affirmative declaration and server timestamp.
  Attestation is not staff review evidence and cannot be updated/deleted normally.
- Add a narrow SECURITY DEFINER operation that locks current session/access,
  verifies active email-verified identity, exact policy and request idempotency,
  rejects an existing self profile, creates the active self-managed College
  learner, authorized admission/attestation, trusted Student role and truthful
  revision-zero event atomically, then rechecks current authority before commit.
- Add exact constraints/triggers/grants so raw runtime writes and caller-chosen
  policy/role/identity are denied. Keep v1 Admin review functions unchanged.
- Extend accepted-receipt routing with exact v2 branches; never use a broad
  “any current policy” check that revives or hides historical data.
- Add independent booking-v2 terms bound to the independent admission policy and
  existing schedule/conflict rules. Creation stores `confirmed` and a matching
  reason/event atomically. Existing v1 bookings retain provisional/Admin rules.
- Do not change Tutor cancel/reschedule predicates in this implementation. Record
  the audit evidence and return any proposed behavior change for owner approval.

### Workflow and failure states

1. A verified user chooses College Student. The page explains independent
   eligibility and displays the unchecked declaration, minimal display name and
   IANA time zone. It does not say “admission,” promise legal verification or
   grant Student access before commit.
2. Strict input validation binds the normalized fields, continuation, exact
   notice/policy and declaration to a UUID idempotency key. Unknown fields and
   role/source/state/learner injection fail.
3. The atomic operation creates one active self learner, authorized receipt,
   attestation, role and audit event. Same key/same input replays; same key/different
   input conflicts; concurrent different attempts yield at most one profile.
4. Success opens Student Dashboard or the canonical retained Tutor/slot journey.
   Refresh preserves state. Failures show actionable, non-enumerating messages and
   cannot leave a partial role/profile/admission.
5. Booking revalidates the exact self authority, Tutor screening/offering, dated
   availability, DST/UTC conversion and database conflict. Success directly
   confirms the local no-money booking and all role-scoped fresh reads see it.
6. Historical v1 pending/authorized/rejected/revoked records remain readable under
   their original contracts. Ordinary queues exclude automatic-v2 receipts; exact
   exceptional/safeguarding cases use scoped review rather than universal access.
7. Legacy provisional booking detail reports “awaiting confirmation” with no link,
   not expired. Reschedule records the same validated IANA zone shown to the user.
   History sorts lifecycle phases deterministically within each revision.
8. Stale slots, overlap, expired sessions, suspended accounts, policy disablement,
   declaration mismatch and mid-lock authority loss fail transactionally. No false
   success, duplicate booking, partial audit/notification or leaked private URL.

### How to build it

1. Preserve/review the existing dirty Parent-v2 work; record the owner-approved
   business-rule changes in governing context and a dated decision. Freeze v1 and
   guardian-v2 receipt bytes as migration-preservation fixtures.
2. Implement independent-v2 policy, attestation schema, atomic create operation,
   integrity/immutability guards and least-privilege grants in the next forward
   migration. Add populated migration fixtures for pending, authorized, rejected
   and revoked v1 self/guardian admissions, evidence, events, links and bookings.
3. Add the focused server validator/service/API and replace ordinary Student
   onboarding copy/continuation with self-service eligibility. Keep legacy detail
   and exceptional Admin screens available only for their actual records.
4. Add independent-booking-v2 routing based on the learner's trusted original
   receipt. Preserve Parent-v2 and all historical v1 behavior and receipts.
5. Correct provisional meeting state, reschedule zone provenance and history
   ordering. Audit Tutor cancel/reschedule authority and add narrow regression
   coverage for unchanged behavior. Update the two stale
   operational copy strings without changing permissions.
6. Run a separate read-only Review against this blueprint, then a separate Verify
   stage. Any observed defect returns through scoped recovery; do not weaken
   authorization, history or booking constraints to make checks pass.

### Verification plan for the separate verification stage — DO NOT EXECUTE HERE

- **Automated later:** relevant focused Vitest/component suites, actual isolated
  PostgreSQL admission/booking/meeting tests, then `npm run check`, applicable
  integration/e2e scripts and production build defined by the repository.
- **Admission/authorization:** verified eligible caller succeeds; unverified,
  suspended, wrong-role, injected target/policy/role, second self profile and
  foreign reads fail. Test declaration false/absent/stale, policy disabled,
  authority loss during lock wait, rollback, raw write denial and exact audit.
- **Idempotency/concurrency:** same request replays one learner/role/attestation;
  changed payload conflicts; concurrent attempts create at most one self profile.
  Two actors cannot reserve the same Tutor interval; double-click creates one
  logical booking and one initial event.
- **Legacy migration:** seed populated v1 pending/authorized/rejected/revoked
  self/guardian admissions plus evidence/events/links/bookings before the new
  migration; prove all old values and receipt bytes/history remain unchanged and
  their original access/action rules still work.
- **Cross-role:** one independent-v2 booking appears consistently for Student,
  assigned Tutor and exact assigned MFA Admin with role-appropriate fields;
  unrelated Parent/Student/Tutor/Admin requests deny. Parent-v2 journey remains
  green and Parent/Student records are not conflated.
- **Booking details:** provisional legacy meeting state is truthful and link-free;
  confirmed participant access works; Admin/foreign accounts never receive URL.
  Reschedule persists presented IANA zone and correct UTC instant across DST; event
  order is deterministic; Tutor cancel/reschedule behavior remains exactly as it
  was before this feature while Tutor completion remains allowed after the saved end.
- **Manual later:** desktop/mobile/keyboard/Axe Student registration → declaration
  → Dashboard → search → direct confirmed booking → refresh/history; Parent and
  Tutor regression journeys; clear unavailable/empty/error/retry states.
- **Operational later:** inspect migration rollback strategy, explicit runtime
  grants, Neon target isolation and Railway variables. Do not deploy or apply to
  production. Real Resend delivery and real Zoom/Meet attendance are separate.
- **Evidence expected:** exact commands/versions/results, selected DB state proofs,
  denied-case results, migration preservation evidence and browser captures. Mark
  every skipped/external category honestly.
- Verification status: **NOT RUN — architecture planning only**.

### Context updates after approval

- `context/prd.md`: replace ordinary assigned-review wording for eligible adults;
  preserve College-only independent scope and real-minor/public legal gates.
- `context/architecture.md`: document independent-v2 attestation/authority and
  booking-v2 receipt branches, legacy coexistence and exceptional review boundary.
- `context/build-plan.md`: supplement M2.4/M2.9, M4.4/M4.6/M4.8–M4.10 and M5.3–M5.5.
- `context/ui-context.md`: ordinary Student eligibility/dashboard wording and
  truthful pending meeting state.
- Add a dated decision record for independent adult self-service; update operating
  docs/grants if needed. Update `context/progress-tracker.md` only with actually
  implemented and verified evidence.

### Risks, rollback and open decisions

- The largest risk is broadening a policy predicate and accidentally reviving or
  hiding historical authority. Every branch must bind exact immutable receipt IDs,
  source, original actor/learner and current capability.
- The current dirty Parent-v2 baseline is not reproducible from HEAD. It must be
  preserved before implementation, and combined validation must target the final
  integrated tree rather than an intermediate worker snapshot.
- Public legal eligibility remains unresolved. Approval of this blueprint approves
  the bounded local declaration workflow, not launch-country compliance or real
  minor self-registration.
- Existing pending v1 adults are intentionally not auto-approved. A future
  conversion must require a new affirmative eligibility act and a separately
  reviewed immutable supersession model; ordinary Admin review may continue for
  those historical records meanwhile.
- Rollback disables new independent policy/intake and restores a compatible prior
  runtime while retaining additive tables, new learner/bookings and every audit
  record. Never delete data or rewrite history to simulate rollback.

### Approval and execution conditions

- Status: **APPROVED on 2026-10-18 by the owner** through the explicit response
  “Approve the master workflow alignment blueprint,” subject to fourteen stated
  conditions.
- Approval covers the bounded local adult/legal-eligibility declaration,
  College-Support-only initial scope, direct confirmed no-money independent
  booking, additive legacy preservation, the three booking corrections, context
  updates, and the separate Implementation → Review → Verification → Remember
  workflow.
- Tutor cancellation/rescheduling is audit-only until the owner separately
  approves a concrete behavior change. Existing behavior must be preserved.
- Preserve the full pre-existing Parent-v2 dirty worktree and historical records.
  No reset, overwrite, automatic legacy conversion, production mutation,
  deployment, payment activation or representation of self-attestation as proof
  is authorized.
- The approved implementation workflow may proceed in small reviewable slices.

Blueprint ready.
