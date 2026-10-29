# M4.4 — Automatic parent-managed child onboarding

Status: **AUTHORIZED — build-feature delegation**

Authority: the owner's 2026-10-18 request replaces routine Admin approval for a
verified-email Parent adding their own new child profile, adding more children,
updating ordinary child details/grade, and booking for their own authorized child.
The requested flow is Add Child → minimal details, level/optional grade, explicit
parent/authorized-guardian declaration and guardian consent → Save → immediately
private, accessible child profile on Parent Dashboard/My Children → booking,
without Pending Approval or routine Admin verification. Existing-account claims,
guardianship/access disputes and suspicious unauthorized linking are separate
exceptions. This authority is the actual feature request; it is **not** a claim
that the owner separately reviewed this generated blueprint.

Repository: `/Users/cob/learli`. Observed branch/commit: local `main`, `3ad1933`;
working tree was clean at inspection. No branch creation, commit, push, deployment,
runtime stop, environment edit, test or database write belongs to Architect.
Suggested working branch: none required by this request; the coordinator owns
the existing checkout and reviewable local diff.

## Implementation Plan — Automatic parent-managed child profiles and bookings

### What we are building

A current active, email-verified Parent can create a new private child profile
without staff involvement by explicitly declaring that they are the child's
parent/authorized guardian and consenting to create/manage the profile and arrange
tutoring. The server allocates a new child record and records that declaration,
versioned notice/consent receipt and authorized guardian relationship atomically.
The child immediately appears in My Children, Parent Dashboard and the parent's
learner selector. Normal detail/grade edits retain current authority. Booking an
eligible available tutor for that child atomically creates a confirmed no-money
local booking without an Admin confirmation task. Existing independent College,
reviewed admission and historical booking receipts retain their original behavior.

This is the existing ordinary local application. It does not select a launch
market or establish jurisdictional legal compliance/public-launch readiness.

### Requirement and milestone mapping

- Primary build item: **M4.4**. Related: M4.5–M4.10, M5.1–M5.5, M5.6/M5.9
  exceptional support, M8.3 environment isolation.
- PRD: **AUTH-01/03/05, FAM-01/03/04, BKG-01–07, MEET-01/02, OPS-02/03/04/05**;
  invariants BR-01–08, BR-11/12/14–18. FAM-02 remains independent and unchanged.
- Read `AGENTS.md`, then the eight canonical lowercase context files in their
  prescribed order. Read the Oct18 ordinary-local, Oct17 parent-children and
  Oct16 assigned-Tutor-completion decisions. The latest owner instruction
  supersedes routine review language for this new ordinary-parent slice.
- This is Both/UI + Backend + Database. No new package, service or hosted
  integration is required.

### Current repository evidence

- `src/app/(workspace)/parent/children/new/page.tsx` currently sends persistent
  local Add Child through `AdmissionForm`; its copy explicitly promises pending
  assigned admission review. `createAdmission` calls
  `create_learner_admission_with_grade`, allocating an inactive profile/pending
  request without a guardian link.
- `has_current_learner_authority` and `has_current_booking_beneficiary` require
  active profile + authorized admission + current original policy + complete
  evidence + exact Parent role/guardian link. A UI-only change cannot meet the
  requested outcome.
- Current immutable `local-admission-v1` fixes `local_guardian_review` and
  `local_independent_review`; evidence excludes subject=reviewer. Parent
  self-declaration must not be written as fictional Admin review evidence.
- Current immutable `local-booking-v1` fixes assigned-MFA-Admin confirmation.
  `create_policy_booking` creates provisional rows and `workflow_provisional`
  events; create replay and both TS/SQL receipt guards assume that result.
- `learner_admission_policy_state` is keyed by source/market. Booking head has
  one row per source. Replacing either current head naively makes older receipt
  authority unavailable. `prepareLocalPolicies` verifies exact v1 bytes and
  refuses incompatible/revoked heads; editing v1 constants is unsafe.
- Existing confirmed booking conflict/expiry, participant/private-link,
  reschedule/cancel and assigned-Tutor post-end completion paths already exist.
  Preserve this engine and its database conflict/exclusion rule.
- Applied migrations `0000`–`0037` are historical. All changes use the next
  reviewed forward migration(s), cumulative snapshot/journal and explicit grants.

### Language we agreed on

- **New child profile**: a newly allocated parent-managed profile without an
  independent login, not a claim to any existing learner or student account.
- **Authorized guardian declaration**: the parent's explicit assertion and
  consent under this owner-approved local product policy. Email verification
  proves control of the email address; neither proves legal identity/guardianship.
- **Immediate access/bookable**: current server-authorized ownership and learner
  selection after Save. Actual booking still checks tutor screening/approval,
  offered subject/level, current schedule, slot conflicts and current account.
- **Confirmed**: the committed local no-money booking state under new parent
  policy; no payment, delivered email or external attendance is implied.
- No terminology clarification or additional routine approval is required.

### Decisions made

1. Preserve the owner-approved guardian declaration/consent for ordinary creation;
   no routine Admin admission, extra-child or grade-update approval.
2. Add a **new immutable local guardian policy**, proposed name
   `local-guardian-admission-v2`, in a distinct local guardian market key. Keep
   the original `local_operation` v1 admission head and receipt bytes intact for
   independent College and historical reviewed/pending requests.
3. Add a **dedicated immutable parent declaration/consent receipt**, proposed
   table `learner_guardian_attestations`, linked to the admission, newly allocated
   learner, requester, request fingerprint and exact policy/notice version. Store
   affirmative declaration/consent, server time and minimal provenance; do not
   collect documents, DOB, school, address, child email or alleged proof material.
   Never masquerade as `learner_admission_evidence` recorded by staff.
4. Add a **new immutable parent booking policy**, proposed name
   `local-parent-booking-v2`. Keep the current local booking-v1 head unchanged.
   The bounded SQL acceptance branch for this exact new policy additionally
   requires the enabled original local-booking-v1 head, the enabled new guardian
   admission head and exact validated v2 policy terms. No generic policy framework
   or unrestricted alternative-head bypass is introduced. Disabling either gate
   denies v2. Original v1/synthetic policy acceptance remains byte/behavior intact.
5. New parent booking-v2 terms bind the exact two accepted local guardian
   admission receipt IDs: newly attested v2 and already authorized reviewed v1.
   Server/SQL select the actual learner's original receipt; no caller-supplied
   policy/source/state may confer authority. New self-managed College bookings
   remain v1 and use their existing review/confirmation path.
6. New parent booking-v2 creation inserts **confirmed + matching confirmation
   event + notice intents in one transaction**. It has no awaiting-Admin stage.
   Existing local timing remains 60-minute lessons/30-minute starts/60-minute
   notice/14-day horizon/60-minute change cutoffs. Preserve stored expiry columns
   for schema compatibility; confirmed rows never expire by provisional TTL.
7. Historical pending requests stay pending; rejected/revoked links stay denied.
   No bulk conversion, inferred attestation, existing-record claim or automatic
   revival occurs. Existing v1 bookings retain v1 actor/status rules.

### Scope and system invariants

- Included: parent-only automatic new-child Save, multiple children, optional
  grade1–12 with existing level/grade rules, current owner edits, current family
  reads/selectors, parent booking-v2, original receipt routing, safe exceptions,
  migrations/grants, isolated tests, existing-design UI and governing docs.
- Excluded: existing-student linking mechanism, independently signed-in minors,
  new child accounts, public intake activation, market-specific legal language,
  payment/fees/refunds, independent College policy changes, tutor screening
  changes, review publication, external email, LMS features or data cleanup.
- A new-child API accepts no target learner/account ID, child email or claimed
  role. It always allocates a fresh opaque learner ID and guardian link for the
  authenticated Parent. Never search/merge/link by name/email. An existing-account
  claim receives a truthful secure-linking/support state with no access grant.
- Every read/write requires current exact session, active verified account,
  trusted role and exact current ownership. Parent A cannot view/edit/book for
  Parent B's child, including guessed IDs and direct SQL. Tutor visibility remains
  assigned-booking minimum. No blanket Admin child-data read scope.
- Admission authority and booking-beneficiary predicates consume complete evidence
  according to the exact original version: staff evidence for v1, authentic
  declaration/consent receipt for guardian-v2. Missing/revoked consent/relationship,
  inactive profile/account, removed role, disabled policy or invalid session denies.
- Staff moderation is for exceptions, never a successful creation prerequisite.
  Preserve existing scoped support/account restriction and assigned admission
  revocation. Add only a narrow exact-target exceptional assignment/revocation
  operation if required to revoke a new attested relationship: current MFA,
  explicit staff capability and legitimate exact assigned support/review scope,
  self-review exclusion, current policy and audited revision checks. Do not put
  every ordinary authorized child into an Admin queue or authorize by UUID alone.
  No new secure existing-account-link workflow is implied.
- Historical immutable policies, receipts/events, links, synthetic/local fixture
  source guards, private composition and disabled hosted defaults stay intact.
- Preserve READ COMMITTED, established lock order, post-wait fresh authorization,
  logical booking chain, exclusion constraint, idempotency, immutable history and
  after-commit mail behavior. Support/reporting access never exposes meeting URLs.

### Affected areas and data/authorization changes

- Policies/composition: `src/features/learner-admission/{policy,context,authority,
service,input}.ts`, `src/features/booking-workflows/{policy,composition,service,
model,input}.ts` as needed. Add a focused child-creation service/validator rather
  than extending old `createAdmission` into a misleading staff-review API.
- DB schema: `src/lib/db/schema/learner-admission.ts`,
  `src/lib/db/schema/booking-workflows.ts`, booking lifecycle reason constraints
  in `src/lib/db/schema/bookings.ts`, next migration/snapshot/journal,
  `scripts/runtime-grants.ts` and explicit owner policy preparation in
  `scripts/local-workflow.ts`.
- SQL functions: retain historical functions in old files; forward-replace only
  applicable current definitions. Add narrow new-child create function; update
  policy-specific authority/evidence-completeness/integrity logic. Cover
  `has_current_learner_authority`, `has_current_booking_beneficiary`,
  `check_learner_admission_integrity`, admission protection as needed, and
  booking policy-current/create/insert/receipt/event/authority guards. Existing
  update-with-grade must authorize either accepted original receipt. Give runtime
  EXECUTE only for exact scoped functions; no raw protected-table writes.
- Family composition must list/read/update using each authorized learner's actual
  accepted original admission receipt, not one globally selected policy ID.
  Historical local reviewed learners and new attested learners coexist.
- Booking service chooses parent-v2 from current trusted guardian management;
  independent-v1 remains separate. Reads/actions/receipt checks use the booking's
  stored original policy, so old provisional/confirmed/history records remain
  visible and retain their original actions. Adapt current-choice, private
  participant, staff, notification and meeting queries only where global exact
  policy equality would hide valid stored records. Keep all final SQL guards.
- API/UI: existing parent Add Child/My Children/edit, Parent Dashboard, safe
  booking continuation and shared learner selector; a proposed dedicated
  parent-child POST endpoint/form is specified below. Ordinary Parent entrypoints
  at `/learners/new` and `/learner-admission/new` must lead to Add Child/the same
  consent form, preserving canonical public selection. Their old ordinary public
  guardian POST path must deny with an actionable Add Child recovery unless it
  uses the dedicated full consent contract; it must not create a new pending
  guardian request. Preserve existing independent College and historical/private
  v1 service contracts. Reuse native fields/tokens,
  responsive shell, private document boundary, no-index/no-store and current
  request feedback. No new dependencies or design language.
- Also route ordinary Parent links from the generic `/learners` page and the
  booking `AdmissionDetour` to the same Add Child flow, retaining strict canonical
  tutor/slot or public tutor/subject discovery continuation. Replace their
  ordinary guardian “for review” instructions; independent College and old
  private/historical flows keep truthful review wording.

### Exact dedicated child creation contract

- New route: `POST /api/parent/children` (proposed file
  `src/app/api/parent/children/route.ts`). Authenticate/current-verify/Parent-check,
  exact same-origin check and existing bounded body/error contracts apply.
- Strict JSON input: `requestId` UUID, `displayName` existing normalized bounded
  learner string, `level` existing learner-level enum, optional `grade`1–12 or
  null, `timezone` valid IANA zone, `policyVersion`, `policyDigest`, `noticeVersion`,
  `guardianConfirmed: true`, `consentConfirmed: true`, optional canonical `next`.
  Reject unknown fields; management is always server-fixed `guardian`. Level and
  optional grade retain existing College-grade restrictions and no inferred age.
- No `learnerId`, `userId`, child email, management, role, source or state input.
  Resolve policy ID from the registered local guardian capability; never accept
  one from the client. Policy/notice mismatch returns stale-policy conflict before
  storing child data. Both declarations, notice/policy identity and every normalized
  field/selection enter the stable request fingerprint.
- Minimal success JSON: `{id: learnerId, admissionId, state: 'authorized',
replayed: boolean}`. The UI uses `id` as a learner ID, never the admission ID.
  Success comes only after the transaction and final authorization checks commit.
- Proposed SQL function `create_parent_child` receives authenticated actor/session,
  request ID, trusted policy ID, notice version, normalized name/level/grade/zone,
  canonical selection and both true declarations; it returns outcome,
  learner/admission IDs and original revision. No new parent role is granted.
  Keep this new contract separate from old `create_learner_admission*` functions.
- Intake props include the exact policyVersion/digest/noticeVersion and account
  zone. Use an independent pending-request storage scope, synchronous busy guard,
  field error/focus associations and same-payload retry on uncertain responses;
  do not claim persisted success before the response establishes it.

### Workflow and failure states

1. Add Child requires active verified Parent and enabled exact guardian-v2
   capability before collecting fields. Show minimal display name, education
   level, optional grade and IANA zone. Two explicit unchecked controls identify
   guardian authority and consent; the server requires both actual `true` values
   bound to exact displayed policy/notice version. No prechecked/implicit consent.
2. Save validates strict inputs and a stable idempotency key. Under current
   identity/policy locks allocate fresh learner/admission, declaration/consent
   receipt, authorized guardian link and minimal truthful audit event atomically.
   Final post-write authority checks run before commit. A revision0 explicit
   `guardian_profile_created`/equivalent origin event may lead directly to
   authorized; do not fake a staff `authorized` decision/assignment.
3. Successful response returns minimal owned learner ID/current state; redirect
   to My Children or the existing canonical tutor/slot continuation. No pending
   review success screen. Refresh shows the persisted child and bookable selector.
   In `src/features/bookings/read-query.ts`, the family overview learner aggregate
   must accept this original guardian-v2 admission/authority even with zero
   bookings; historical admitted learners still use their own original receipts.
4. Same key/same fields/declarations/policy replays the one original result;
   changed payload/policy/consent with the same key conflicts. Retry after lost
   response does not create another child. Existing technical capacity limits
   remain technical bounds. Suspended/unverified/expired-session/wrong-role,
   stale policy, incomplete consent and foreign targets fail before commit.
5. Edits preserve optional-grade omission/null behavior, College-grade restriction
   and current ownership. No review request is created for name/zone/grade edits.
6. New guardian booking revalidates learner receipt, authorized link, tutor
   screening/offer, schedule, actual date/DST and shared conflicts. Atomically save
   confirmed row and matching confirmation event/notice intents. Use a truthful
   new reason such as `local_parent_booking` bound by the v2 guard, never imply
   an Admin prerequisite review occurred. Replay returns its original confirmation
   event. Both SQL receipt guards and TS receipt expected state distinguish v2.
7. Stale/conflicting slot yields existing friendly unavailable state and leaves no
   partial booking/event/notice. Reschedule preserves original state/receipt,
   atomically replaces and retires old private link; failed move preserves original.
   Cancel, post-end assigned-Tutor completion, private links and notifications keep
   original rule checks. A parent cannot complete/no-show or claim Admin tasks.

### How to build it

1. Coordinator records the latest owner decision in governing docs/dated decision
   before policy-dependent implementation. Freeze original receipt constants and
   historical migration hashes for preservation review.
2. Data owner adds the attestation schema and new policy constraints, narrow atomic
   child create/current-authority/integrity functions and v2 booking branches in
   forward SQL. Preserve v1 heads/rows and legacy branches. Add exact grants and
   isolated migration/SQL-denial/concurrency tests.
3. Domain owner adds strict new policy variants/digests and trusted composition,
   child service/API boundary, per-original-receipt family selection and parent-v2
   booking routing. Do not read a foreign record to choose an error response or
   let caller policy decide an authorized path. Extend explicit owner preparation
   without modifying/reviving old policies/heads.
4. UI owner adds the declaration/consent form and immediate saved-child behavior,
   removes routine pending/review wording only on this new ordinary path, preserves
   old pending cards with truthful labels, and updates selectors/booking feedback.
   Include the child in Parent Dashboard even when it has no bookings.
5. Separate read-only Review checks full blueprint alignment/security/history and
   unintended changes. Separate Verify runs actual checks on isolated targets.
   Recover any observed failure with a scoped plan; do not weaken safeguards.
6. Only after reviewed/tested forward migration and preservation evidence may the
   coordinator apply the necessary additive update to the owned operating local
   database under the existing authorized task scope. Preserve all values, accounts,
   histories and v1 heads; no reset/reseed. Coordinate any final app rebuild/restart
   without interrupting the running manual test during development. No cloud or
   production apply/push/deployment is authorized.

### Verification plan for the separate verification stage — DO NOT EXECUTE HERE

- Existing scripts: `npm run check`, `npm run test:integration`,
  `npm run test:e2e`, `npm run build`. Scope expensive checks to relevant suites
  first, then required final integration checks. Use configured test isolation;
  never point fixture reset or test SQL at operating `learli_dev`.
- Unit/component: strict consent booleans, absent/false/malformed attestation,
  policy/notice stale/mismatch, fixed new digest tampering, unchanged v1 digests,
  grade bounds/null/omission, management/role/target injection, pending/error/retry
  feedback, immediate profile state and no staff-review labels on new path.
- Actual PostgreSQL: verified Parent create/additional child/direct immediate
  authority and bookability; role/account/session/consent/policy revocation before
  and during lock waits; Parent A/B reads/edits/bookings; no learner/account linking
  by ID/email/name; atomic rollback and raw runtime write/function denials.
- Concurrent idempotent child retries produce one profile/link/attestation/event;
  changed request conflicts; multiple children do not require assignment. Missing
  or mismatched receipt cannot authorize through generic reviewed functions.
- Parent-v2 confirmed creation with no staff/grant; double-submit/replay same event;
  overlapping concurrent bookings at most one succeeds. No partial audit/notice;
  confirmed past original hold still blocks and is visible. Reschedule both orders,
  failed-move preservation, cancel, private link participant isolation, old-link
  retirement, Tutor-only after-end completion and email-failure independence.
- Populated/fresh migration evidence: existing values/history/receipt bytes/v1
  heads unchanged; old pending remains pending and unbookable; old authorized
  guardian/independent and v1 provisional/confirmed/history still work under their
  original policy; old synthetic/private suites retain source separation. New
  independently managed College path is not automatically confirmed.
- Exceptional restriction/revocation denies current family access/booking without
  broad Admin read scope; direct unknown UUID must not manufacture assignment.
- Browser: actual provider verification → Parent → Add Child → unchecked required
  declarations → save → My Children and Parent Dashboard → add second child →
  edit Grade8 → tutor selection → confirmed booking without Admin. Refresh and
  safe sign-in/tutor continuation preserve state. Wrong Parent/Tutor and anonymous
  URLs deny. Check desktop/phone, keyboard, focus/errors, Axe/overflow and private
  HTML/metadata/client privacy. Keep explicit historical pending UI where needed.
- Capture source Review separately from executed Verify, exact commands/results,
  migration/grants/preservation evidence and actual screenshots. A same-record
  external lesson/physical-device/provider-delivery/public-launch claim requires
  separate actual evidence and is not manufactured by automated fixtures.
- Verification status: **NOT RUN — Architect planning only.**

### Context updates

Coordinator/implementer updates `context/prd.md` FAM-01/FAM-03/BKG-03 plus top
ordinary-local override; `context/architecture.md` guardian policy/authority and
parent booking receipt boundaries; `context/ui-context.md` Add Child and local
pending/confirmed wording; `context/build-plan.md` M4.4/M4.6/M5.4 supplement;
dated `docs/decisions/2026-10-18-automatic-parent-child-onboarding.md` (proposed),
`docs/operations/local-workflow.md` if preparation changes, and verified
`context/progress-tracker.md` after meaningful implementation/checks. Preserve
historical notes as historical; make supersession clear. No broad rewrite or
new market/legal/payout decision is implied.

### Risks, rollback and open decisions

- Policy equality and post-lock receipts are the primary integration risk; inspect
  all consumers rather than relaxing authority globally. Original v1 bytes/head
  preservation and mixed-version regression evidence are required acceptance.
- Local consent is an actual parent declaration/consent receipt, not proof of
  legal identity or compliance in an unselected jurisdiction. Public market/legal,
  real-family operational safeguarding, commerce and external delivery gates stay.
- Rollback retains additive schema/new records and original immutable receipts;
  disable the new guardian policy capability/intake and restore a compatible prior
  runtime only after preserving records. Never delete children/bookings or replace
  the operating database to conceal a failure. A destructive restore is separate.
- No unresolved product/safeguarding decision blocks this authorized local new
  parent-managed profile slice. Secure existing-account linking is deliberately
  absent; its future mechanism requires its own design, not name/email inference.

### Approval / handoff gate

- Status: **AUTHORIZED — build-feature delegation**, dated2026-10-18, from the
  actual owner request quoted in this authority record.
- Ready for separate implementation and verification stages coordinated by
  build-feature; no separate generated-blueprint approval is claimed or required.
- Architect wrote only this canonical blueprint and executed no implementation,
  tests, migrations, service changes, tracker edits or operational mutations.

Blueprint ready.
