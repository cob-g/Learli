# W8 — Assigned tutor screening and safeguarding response

Date: 2026-10-12. Primary work package: **M8.10**, with **M3.3,
M5.6/M5.9, M8.7/M8.8** and M6 D-08/09/10; safe meeting guidance also
depends on D-13. PRD: **TUT-01/02, ADM-01/03/04, OPS-05, PUB-03/04,
MATCH-02, BR-01/02/16, AUTH-03, NFR-05**. This covers bounded software
preparation, not complete milestone acceptance.

Status: **AUTHORIZED — build-feature delegation**. Authority is the user's
eight-area software build request dispatched by root, dated 2026-10-12; this is
not separate blueprint approval or screening/legal/real-human-response approval.
This dispatch is **Architect only**: no implementation, review of implemented W8,
test execution, migration, provider action or activation has happened here.

Repository: `/Users/cob/orca/workspaces/learli/m8-screening-safeguarding`.
Observed branch `cob-g/m8-screening-safeguarding`, clean initial HEAD
`2fa0294c5e6cad895754b3c10a703a6c6f6ef00a`. No branch creation proposed or needed.
Parent: `prompts/features/m8-10-hosted-workflows-wave.md`, original accepted
SHA256 `cc8a9677aef73717494233d1493921a88c0a4aac03cdd087803dedf208b80014`.
Root's formatting-only revision is SHA256
`80e76571d47f2d4c9ad51467e58c5cc87587f5ca5cabedde770dd6f6c0bbb610`;
root reported identical normalized content and unchanged authority. This checkout
copies the current parent unchanged. Root's read-only decision source is
`m8-hosted-workflows-integration/docs/decisions/2026-10-12-hosted-workflows-software.md`.

## Root technical refinement — 2026-10-12

This revision records root's three technical corrections under the same delegated
build authority; it changes no user scope or real-human/legal gate. Use
feature-owned validated screening/safeguarding capabilities with the actual
`AuthRuntime` from `src/lib/auth-factory.ts`, following W5's consumed-capability
pattern. Root/W3 supplies hosted composition later; no generic runtime/policy
engine, activation-receipt service or new shared runtime-module prerequisite.
Only disabled/synthetic_test paths are consumed in this wave. Operational intake,
screening approval and visibility remain denied; real activation is a separate
decision and implementation change, not configuration supplied to this slice.

Ordinary screening/support/restriction reads and mutations use W1 current
assurance (currently `ADMIN_ASSURANCE_SECONDS=28800`, eight hours), with exact
current session/factor/epoch/role and domain predicates rechecked after every
lock wait. Fresh authorization means a new database evaluation, not a factor
challenge within five minutes. W1's five-minute fresh-factor window belongs to
credential/factor controls. No extra domain step-up is proposed for this slice.

Reuse existing support reviewer, dispatch/choice, assignment/history and exact
restriction records, retaining their PK/FK and explicit historical local checks.
Remove the proposed parallel response staff/grant registries. Root reports W1's
actual-provider core-v1 snapshot and21 provider tests as provisional, with full
verification ongoing; this worker neither reruns nor independently accepts them.
No implementation/import permission is granted by this architecture dispatch.
Root owns the cumulative0023/0024 migration bridge.

Downstream required reading: AGENTS.md; context/project-overview.md,
architecture.md, ui-context.md, code-standards.md, ai-workflow-rules.md,
progress-tracker.md, prd.md and build-plan.md in that order; repository
build-feature/architect Orchestrated mode; this blueprint, unchanged parent,
applicable decisions and root-accepted provider handoffs.

## What we are building

A tutor submits their existing basic application. A deliberately provisioned,
exactly assigned MFA-assured reviewer records bounded evidence references and
check results under an immutable screening policy version, then makes a current
approval/rejection/suspension/reinstatement decision. Discovery and booking
consume one minimal screening predicate. An authorized synthetic requester can
report a concern through the existing support system; exact dispatch authority
assigns a responsible reviewer, who acknowledges and can request an authorized
escalation. A separate exact-target safety permission can restrict an account.
Every readiness screen says synthetic exercise; software never asserts a human
screened an actual person, reviewed an actual document, attended a lesson or
monitors emergencies.

No terminology question is necessary. Screening means an auditable human
decision supported by policy-required checks, not the previous profile approval
alone. Acknowledged means the current assigned staff actor recorded receipt of
this assignment, not resolved or responded to the reporter. Escalated means an
authorized transfer to an eligible escalation reviewer, not an emergency-service
notification. Provenance describes the data, independently of runtime mode.

## Current repository evidence

- `src/features/tutors/service.ts` grants only own tutor role, creates pending
  profiles and preserves approved edits; rejected resubmission returns pending.
  `review.ts` currently permits any current admin to list/read applications and
  conditionally transition expected status, with self-review denial and audit.
  It has no exact reviewer grant, evidence policy, MFA or final post-wait recheck.
- `review-rules.ts` already defines pending→approved/rejected,
  approved→suspended, suspended→approved and rejected→pending. Preserve these
  profile statuses and approved editing decision of 2026-10-11.
- `eligibility.ts` centralizes approved + active/verified + tutor role + active
  offering; batched public availability calls this module. Private link and
  lifecycle SQL still have their own eligibility fragments. Root/W6 must compose
  the new predicate there; a public DTO must remain unchanged.
- `support/service.ts`, `dispatch-service.ts`, `support-bookings/query.ts` and
  migrations0011/0014/0019 provide requester-only content, exact assigned reviewer,
  exact dispatcher/choice grants and safe booking context. Local dispatch returns
  case UUID/category/status/revision/assigned/reviewer label, no text or booking
  join. `change_local_support_assignment` locks case, serializes actor/key, then
  rechecks live actor/grants/target and appends both histories atomically.
- `change_local_account_access` in0015 uses exact staff-to-target permission,
  rejects self/admin targets, rechecks after locks, preserves sessions/history and
  has no broad runtime account-status UPDATE. Do not conflate case assignment
  with restriction authority.
- `scripts/runtime-grants.ts` currently grants broad tutor profile INSERT/UPDATE,
  case INSERT and status/revision UPDATE, while assignment/capability writes are
  forbidden. New protected workflow fields require narrower grants/functions.
- Existing PG concurrency tests in `support-assignment.test.ts` explicitly wait
  on actual locks, revoke grants/roles/accounts, test stale/replayed keys,
  former-reviewer access and rollback on failed audit. Reuse that pattern rather
  than a mock or arbitrary timer. Existing migration proof has fixed22/24/21
  counts; root owns cumulative inventory updates, not an invented W8 count.
- Actual `AuthRuntime` is the return type of `createLocalAuth`, with auth/db/pool,
  origin/environment/emailProofBinding; preserve this API and compose domain
  capabilities alongside it. W5's admission blueprint uses that pattern without
  a generic engine. W1 assurance/source is read-only provisional planning context,
  not an accepted import; implementation needs root's exact accepted manifest.

## Scope and invariants

Included: assigned screening read/action/evidence workflow and UI; a narrow
consumed policy packet; immutable decision/check receipts; current eligible
predicate; readiness support intake, acknowledgment, transfer/escalation,
closed/reopen rules and independent exact-target restrictions; additive fixture
tooling and discovered PG/browser tests. New persisted authority is synthetic
readiness only; operational intake/eligibility remains disabled in this wave.

Excluded: real screening criteria or evidence, personal documents/uploads,
legal wording, real intake/staff provisioning, notes/replies/chat, emergency
promises, automatic moderation/response, all-family or all-user lookup, payments,
changes to W1/core auth, admission policy, W6 booking mutations, W7 publication,
dependencies or cloud. Preserve unrelated EduSphere and all historical demo data.

- Runtime identity comes from Better Auth. MFA assurance composes with exact
  assignment/capability, ownership, source, policy and current relation checks.
  Never use a submitted reviewer/source/policy version as authority.
- No reviewer reads or decides their own tutor application or requester case;
  a dispatcher cannot assign themself or the requester. Account restrictions
  retain self/admin-target denial and separate deliberate target grants.
- No production public response contains synthetic tutors. Never relabel existing
  local approvals as screened or backfill them to new-source records.
- No evidence reference, check history, private case text, learner/account ID,
  session, private meeting URL or private booking association enters public tutor
  DTOs/HTML/metadata, dispatcher queues, ordinary audit text or diagnostics.
- Preserve booking rows, obligations and private history on deny/suspension;
  future bookability and link opening fail closed. Account restoration does not
  approve screening, renew evidence, revive a reservation or resolve a case.

## Operating policy contracts

Use feature-owned validated packets, not a generic policy editor/engine.
Proposed feature contexts compose `{ runtime: AuthRuntime, screening:
ScreeningCapability }` and `{ runtime: AuthRuntime, safeguarding:
SafeguardingCapability }`. Each capability is a discriminated disabled or
synthetic_test record, validated by its feature's policy module; enabled records
bind immutable policy version/reference and `synthetic_readiness` provenance.
Root installs the concrete capability at the application boundary; owned test
composition exercises the same services with actual local AuthRuntime. No
unchecked AuthRuntime cast, new async auth factory, request-supplied capability
or generic loader is required. Root/W3 later composes accepted hosted auth with
these feature-owned inputs. Production rejects synthetic_test; operational is
unsupported and denied before private intake. Runtime cannot provision policy or staff.
Disabled denies before rendering/accepting report body or other new private
intake fields. A `.test` address or environment value is never policy authority.

**Screening policy:** immutable version and opaque reference, provenance
`synthetic_readiness` in this wave, valid-from/valid-until finite UTC instants,
required distinct check codes (1..20, `[a-z][a-z0-9_]{0,47}`), evidence reference
format `screening:<UUID>` (opaque token only; no URL/path/name/document content),
permitted decision actions, required reviewer capability and explicit expiry
rule. Every required check must have explicit checked-at and expires-at; no
missing-expiry default. Re-review on changed policy/evidence is software behavior;
approved profile edits still do not invalidate unrelated evidence. Any future
policy tying a specific professional fact to a check must enumerate that fact and
the invalidation rule before implementation; no broad profile checksum now.

**Incident policy:** immutable version/reference/provenance, finite validity,
named responsible owner and escalation-owner references to deliberate
`support_reviewers` rows, approved reporting/meeting-guidance references, allowed assignment,
acknowledgment, escalation, reopen and safety-restriction actions, exact eligible
reviewer capability, exact dispatch/reviewer/escalation choices and independent
restriction grants, and configured reason codes. No fabricated SLA, auto timer,
external contact or response promise. Missing/revoked/inactive owner or escalation
owner, incomplete guidance, disabled packet or source mismatch denies new intake.
Closure/reopen depends on current policy and current assignment; previous policy
receipts remain history. Existing requester can still read their stored report
with current account/session/ownership if intake is subsequently disabled.

Synthetic fixtures use intentionally named `synthetic_check_a/b` and fictional
owner references with short test-owned expiries; they exercise these same rules
without pretending to define a launch screening threshold. Future real use
requires actual D-08/09/10/13 owner/policy evidence and separately authorized
activation design/change. This wave supplies no operational packet/source factory,
activation receipt schema/service or live staff provisioning. A policy string is
an operator attestation, not legal approval. Validate without logging values.

## Proposed schema delta — migration0024

These are proposed names, not existing tables. All FKs are RESTRICT and times
are finite timestamptz. Provenance, original owner, policy receipts and audit
history are immutable. Runtime cannot directly INSERT/UPDATE/DELETE protected
rows. Integer revisions are nonnegative and reject overflow.

`tutor_screening_cases` has BEFORE UPDATE/DELETE protection: tutor_id and
provenance cannot change and DELETE is rejected even for the ordinary owner
tooling path. Request receipt and provenance marker are created atomically, so
deleting/recreating a revoked or expired record cannot regain local_demo. New
readiness fixtures use distinct new tutor accounts rather than relabelling an
existing local approval/assignment. Current case state/revision/head may change
only by the protected functions; immutable history and FK links cannot be cleared.

| Table                             | Columns, constraints and responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tutor_screening_policies`        | PK(provenance,version), provenance synthetic_readiness only, reference, required_check_codes text[], valid_from/until, allowed_actions text[], authority_reference. Immutable bounded consumed packet; no check code criteria invented.                                                                                                                                                                                                                                                                                                                                       |
| `tutor_screening_policy_heads`    | PK(provenance), version FK, status enabled/revoked. Owner-only current selection; policy change never mutates historical packets.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `tutor_screening_cases`           | PK tutor_id FK tutor_profiles, provenance synthetic_readiness, policy_version composite FK, round>=1, revision>=0, state pending/approved/rejected/suspended/revoked, current_decision_id nullable FK decisions, created/updated_at. One irreversible readiness marker per tutor; no local fallback once enrolled. Cross-row trigger validates decision belongs to same tutor/round/provenance/version.                                                                                                                                                                       |
| `tutor_screening_assignments`     | PK tutor_id, reviewer_user_id FK user, provenance local_fixture/synthetic_readiness, status authorized/revoked, assignment_revision>=0, updated_at. Exact current reviewer; FK case required for readiness provenance, nullable case relationship allowed only for historical local fixture grants. Staff/tooling assignment/revocation events are recorded, not a runtime self-claim.                                                                                                                                                                                        |
| `tutor_screening_staff`           | PK(user_id,provenance), provenance local_fixture/synthetic_readiness, status authorized/revoked, valid_until, capability `screening_reviewer`. Source-matched active verified admin required; no ordinary runtime writes or automatic admin grants.                                                                                                                                                                                                                                                                                                                           |
| `tutor_screening_checks`          | UUID PK, tutor_id FK case, provenance/policy_version/round, check_code, expected_revision/case_revision, outcome passed/failed/revoked, opaque evidence_reference, checked_at/expires_at, actor_user_id, assignment_revision, request_key. Unique(tutor_id,case_revision), unique(actor_user_id,request_key); case_revision=expected+1. Latest receipt per round/code is authoritative. No overwrite: amendment/revoke appends new receipt and advances case revision. Code must belong to referenced immutable policy; future check time/nonfinite/reversed expiry rejected. |
| `tutor_screening_decisions`       | UUID PK, tutor_id, provenance/policy_version/round, action approve/reject/suspend/reinstate/reopen/revoke, expected_revision/revision, actor/session proof reference as minimal W1 assurance receipt identity where available, assignment_revision, request_key, decision_at. Unique(actor_user_id,request_key), unique(tutor_id,revision); revision=expected+1. No secret/session cookie/MFA code stored.                                                                                                                                                                    |
| `tutor_screening_decision_checks` | PK(decision_id,check_code), check_id FK checks. Positive decisions bind the exact current passed receipt for EVERY required code; cross-row validation enforces same tutor/round/policy/code and complete set.                                                                                                                                                                                                                                                                                                                                                                |
| `tutor_screening_events`          | UUID PK, tutor_id, revision nullable for tooling assignment events, kind request/check/decision/assignment/revocation, actor, request_key, check_id/decision_id nullable FKs with kind-specific shape, assignment_revision, created_at, bounded identifiers only. Immutable; runtime histories project safe action/time/status, not internal actor/evidence identifiers. Check/decision receipts share actor/key replay namespace via serialized key and lookup in both tables, preventing cross-action key reuse.                                                            |
| `support_response_policies`       | PK(provenance,version), provenance synthetic_readiness only, immutable incident packet fields above, explicit finite validity, responsible/escalation owner user IDs FK existing support_reviewers(user_id), bounded allowed actions/reason codes. Source checks bind both owner rows to packet provenance. No body/learner fields.                                                                                                                                                                                                                                           |
| `support_response_policy_heads`   | PK(provenance), current version FK, enabled/revoked. Deliberate owner-only selection.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `support_case_responses`          | PK case_id FK existing support_cases, provenance synthetic_readiness, policy_version composite FK packet, assignment_revision nullable, acknowledged_assignment_revision nullable, acknowledged_by FK support_reviewers nullable, acknowledged_at nullable, escalation_requested_at nullable, escalation_target_user_id FK support_reviewers nullable, response_cycle>=1. No second case body/status/assignment; those remain in existing support_cases/assignments. Acknowledgment requires all-or-none shape and exact current assignment revision.                         |
| `support_response_events`         | UUID PK, case_id FK, action intake/acknowledge/request_escalation/assign/reassign/escalate/close/reopen, actor, request_key, expected_revision/revision, provenance/policy_version composite FK packet, response_cycle, assignment_revision, safe timestamp. Unique(actor,key), unique(case_id,revision) for runtime actions; immutable, no body/learner/meeting content.                                                                                                                                                                                                     |

Extend existing `support_cases.source` check to local_synthetic and
synthetic_readiness; default remains local_synthetic and source is
immutable. Existing local authority joins still match only local_synthetic.
Nonlocal cases require a matching `support_case_responses` row created in the
same transaction; deferred constraint trigger denies orphan/source mismatch.
Existing `support_case_assignments` remains the sole current assignment.

### Reuse existing support capability and exact grant records

Inspected `schema/support.ts`, `support-dispatch.ts`, `account-restrictions.ts`,
migrations0011/0015/0019 and the corresponding service/owner tooling. The
current reviewer PK is user_id; assignments, reviewer choices and previous/next
reviewer history already FK to that key. Keep ALL those keys and FKs. There is
no need to weaken them to user FKs or create another staff registry.

- Extend `support_reviewers.source` from local_fixture to
  local_fixture|synthetic_readiness; source/user identity immutable and owner-only
  current status/expiry. Add nullable finite valid_until, required for readiness
  and unexpired at use, null for preserved legacy fixture rows. Its existing
  authorized/revoked status is the reviewer capability. Source is single-valued
  per user_id: readiness fixtures use distinct staff accounts; reject a source
  collision rather than relabel an existing local reviewer or expand the PK.
  A future need for one human in multiple sources requires a separate reviewed
  key design; it is not needed for this consumed synthetic slice.
  Preserve/add explicit local_fixture predicates in legacy owner tooling too;
  it cannot provision, revoke or renew readiness rows through its local entry points.
- Reuse `support_reviewer_events` for provision/renew/revoke history with
  nullable expiry/tooling-actor snapshots on new events, old rows unchanged;
  source derives from the immutable referenced reviewer. Existing action
  authorized records provision/renew, revoked records revoke. Every actual
  current-capability change appends one event atomically; no new staff_events.
- Extend `support_dispatch_grants.source` and `support_reviewer_choices.source`
  to the same two values; keep PK(dispatcher_user_id,case_id) and
  PK(case_id,reviewer_user_id). Add finite valid_until required for readiness,
  null for legacy. Source is immutable, with local_fixture mapping ONLY to
  local_synthetic cases and synthetic_readiness ONLY to matching readiness
  cases. Readiness reviewer choices also require matching support_reviewers
  source/current capability. Enforce source joins/expiry in final SQL and
  owner-side constraint triggers, not just forms.
- The exact current dispatch grant itself is the dispatcher capability; it
  requires current active verified admin assurance and packet permission, but
  no new global dispatcher registry. Add `can_escalate` boolean default false
  to existing reviewer choices, immutable historical receipt of each tooling
  change. Readiness escalation needs an authorized unexpired exact choice with
  can_escalate=true, current matching reviewer capability, and the policy's
  named escalation owner. Assign/reassign uses the existing choice; a choice
  alone never permits reading content before current assignment. Existing local
  escalation keeps its explicit local checks and ignores the new flag.
- Reuse `support_dispatch_grant_events` for dispatcher/reviewer_choice and new
  escalation_choice changes; retain its case/user FKs and append-only trigger.
  New events snapshot expiry and choice flag/tooling actor as applicable, legacy
  fields remain null. Source derives from immutable case.source. Provision,
  expiry renewal, revoke and escalation-flag changes append receipts atomically;
  no parallel support_response_grants table or global case registry.
- Policy's responsible/escalation owner references require current source-matched
  authorized/unexpired support_reviewers and active verified admin accounts.
  Named ownership permits no case reads/assignment by itself. Dispatcher may
  be a distinct exact-granted actor; case review and account restriction remain
  separate capabilities represented by their existing relations.

Four new support response tables remain: policies, policy_heads, case_responses,
response_events. They store newly consumed policy/acknowledgment receipts only;
none duplicates content/status/current assignment. Screening's own staff/assignment
records remain separate because tutor review is a different exact resource domain.

Add nullable immutable provenance/policy receipt columns to existing assignment
events only if needed by the chosen function; prefer `support_response_events`
for new source action details. Extend case-event shape for `acknowledged` and
`escalation_requested`: escalation request has null status/reviewer fields;
acknowledgment has null reviewer fields and either open→in_review status fields
or both null when already in_review. Actor is required, revision>0, shape checks
require TRUE. Ordinary close/reopen retains status_changed. Every new response
action increments existing case revision and writes one matching existing case
event plus its response receipt atomically. Assignment actions also retain the
existing support_assignment_events kind/request/history FK. Derive assignment
revision from that exact current assignment's latest assignment event; the
response state's assignment_revision is a validated receipt pointer, never a
second assignee or independent authorization system. Post-transfer clears old
acknowledgment/escalation fields; current reviewer/policy/cycle checks remain.

Serialize response actor/key in one namespace and compare all action payloads
across response and assignment receipts before replay. Existing local assignment
request handling stays unchanged; case source isolates the flows. No action may
reuse a key for a different resource/action even if another receipt table owns it.

Extend `account_restriction_targets.source` to local_fixture,
synthetic_readiness (immutable). Keep target PK(user_id), exact grant
PK(staff_user_id,target_user_id), its RESTRICT target FK and grant-history
composite FK. Add immutable source default local_fixture and nullable finite
valid_until to exact `account_restriction_grants`; readiness requires matching
target source, explicit unexpired expiry and bounded permitted actions. Those
exact grants ARE the independent restriction capability; no support reviewer,
dispatcher, policy-owner or case assignment grants account power. The actor
requires current active verified admin/W1 assurance but need not be in
support_reviewers. Reuse restriction grant events for all current grant changes
with new expiry/action/tooling snapshots; old rows/values unchanged.
Extend restriction-event reason constraint only to exact allowed new safety codes,
record incident policy version/reference on new receipts with source-bound
composite FK to the packet, leave old values/nulls unchanged. New function
requires current exact target grant, packet/action permission and all current
target/account exclusions, with no case body or arbitrary staff search.

No new column/source on learner or bookings is owned here. Root/W5/W6 own that
bridge. No migration0022/0023 SQL/snapshot byte is guessed or copied from an
unaccepted provider.

## Screening transactions, state and lock contract

Proposed feature module `src/features/tutor-screening/` contains policy/input,
queries/service, handler and native forms/presentation; schema module proposed
`src/lib/db/schema/tutor-screening.ts`. Preserve existing tutor routes/forms;
add unique evidence endpoint proposed
`/api/admin/tutor-applications/[profileId]/screening/checks` and render the assigned
check workflow in `/admin/tutors/[profileId]`. Own `/tutor/profile` displays only
own synthetic state/missing-check labels, never opaque evidence or staff IDs.

In explicit readiness application composition, validate enabled screening packet
before rendering/accepting the new workflow. Proposed
`request_tutor_screening(actor,session,tutor,key)` runs inside the existing own
profile submission transaction: fresh exact owner/tutor identity, source selected
by trusted packet, pending case round1/revision0 plus immutable request receipt.
It grants no reviewer capability or assignment. Existing local application path
does not create this marker. A deliberate owner tooling action provisions the
exact assigned staff row; application waits truthfully until that happens. Later
resubmissions cannot change provenance and use the protected narrow resubmit
function described below.

For legacy demo review use a narrow `review_local_tutor_application` function:
same transitions/self-exclusion/audit, accepted W1 MFA, exact local_fixture
assignment and current capability, post-lock checks and existing expected-status
conflict semantics. Keep the legacy strict `{action}` endpoint; a repeated action
after its allowed source status has changed returns409 without a duplicate audit.
Historical
already-approved tutors need no screening receipt solely to keep demo browsing.
Fixture setup provisions exact grants deliberately for existing application tests;
do not automatically give every admin access to every tutor.

For new screening use proposed SQL functions
`record_tutor_screening_check(actor,session,tutor,expected_revision,key,code,outcome,reference,checked_at,expires_at)`
and `decide_tutor_screening(actor,session,tutor,expected_revision,key,action)`.
Service derives provenance/policy/round/assignment from trusted rows, not form
fields. Strict bodies reject forged role/source/user/policy/assignment/decision ID.

1. Resolve identity and `requireAdminAssurance(runtime,headers)`; ordinary reads
   and mutations use accepted W1 `ADMIN_ASSURANCE_SECONDS` (currently8h). The
   five-minute `ADMIN_FRESH_FACTOR_SECONDS` is for credential/factor controls,
   not review/check/decision mutations. No additional domain step-up is needed
   here; exact assignment, current evidence, revision and policy remain required.
2. READ COMMITTED transaction: lock tutor_profiles first FOR UPDATE, then screening
   case, then exact assignment, then policy head/current packet and staff rows
   FOR SHARE in deterministic order; finally serialize actor/request key. Every
   writer (including evidence revocation/reassignment/provisioning) takes the same
   tutor-first order; policy-head provisioning never locks tutor afterward.
3. After ALL domain/grant/key waits, run separate fresh commands using
   `recheckAdminAssurance(tx,identity)` or SQL
   `public.has_admin_assurance(actor,session,28800)`, then exact current assignment,
   staff/source/status/expiry, self-exclusion, tutor identity/status, policy head
   and validity. READ COMMITTED is explicit; no pre-lock identity boolean reuse.
   Preserve every W1 predicate: receipt tied to exact live provider session/user,
   active verified account and two_factor_enabled, verified exact factor ID,
   current security epoch, current admin role's exact granted_at, nonfuture
   verified_at inside the accepted assurance window and live session expiry.
   Do not reproduce weaker role/MFA booleans or use a caller-selected max age.
   Factor age six minutes is not a denial while all current predicates hold;
   any revocation during a wait still denies immediately on the final commands.
4. Replay lookup occurs only after authorization. Same key+same complete normalized
   payload returns prior minimal result without appending. Key reused with any
   other tutor/check/action/input gives409. Revoked authority denies old replay.
5. Expected case revision and relevant profile status must match. Approve requires
   pending; reinstate requires suspended; reject requires pending; suspend requires
   approved. Reopen rejected/revoked starts a new round pending; a policy refresh
   can explicitly begin pending review under current packet even if profile was
   formerly approved. Evidence edits after approval clear the positive decision
   pointer/move screening pending before any eligibility can be returned. Profile
   status does not need to be relabelled pending to enforce this screening denial.
6. Positive action requires every current policy code's latest receipt passed,
   unexpired/unrevoked, checked under same policy/version/round, with exact bound
   receipt IDs. Missing/failed/expired/stale policy or check denies approval and
   reinstatement. Other deny actions still require scoped current authority;
   disabling intake cannot create a global emergency admin bypass.
7. Decision, receipt links, case revision/head, allowed profile status transition
   and minimal audit commit together. Failed receipt/audit writes roll back all.
   Suspend/revoke immediately denies eligibility; reinstate never just flips a
   profile status. Revoking staff stops future access/writes; it does not silently
   falsify past human decisions. Revoking a decision/evidence/policy explicitly
   denies future eligibility. Assignment rotation does not require routine tutor
   re-review or retroactively rewrite evidence actors.

Close the direct-write bypass: replace broad tutor profile UPDATE with columns
headline,bio,teaching_background,timezone,availability_version,updated_at. INSERT
excludes review_status (default pending); default identity/slug insert columns
remain sufficient. Refactor own rejected resubmission through narrow
`resubmit_tutor_application(actor,session,tutor)` under existing tutor lock and
fresh ownership/tutor identity; only rejected→pending, no approval, and advances
new screening round when present. This is a required bounded service.ts hunk,
not a core-auth change. Legacy review also uses the narrow function after W1.

## Proposed minimal current eligibility provider v1

Root accepted this seam **for architecture planning only** in message
`msg_f5c26f6e4b46` on2026-10-12: trusted server capability/provenance determines
scope, marker deletion/grants must prevent demo fallback, and W6 retains booking
authority. This is not accepted source/SQL or real policy activation.

Server-only proposed `src/features/tutor-screening/eligibility.ts` exports:

```ts
type ScreeningScope = "local_demo" | "synthetic_readiness";
screeningEligibilityPredicate(tutorId: SQL | string, scope: ScreeningScope): SQL;
// Builds public.has_current_tutor_screening(tutorId, scope), no private DTO.
```

SQL proposed `public.has_current_tutor_screening(uuid,text) RETURNS boolean`
is a read-only STABLE security-definer with fixed pg_catalog search path and
fully qualified relations; explicit EXECUTE, no PUBLIC. Invalid/missing scope
returns false, as does an unknown tutor UUID. Evaluate against one statement
snapshot and database time. Runtime scope is selected by root, never a public
query/form parameter. This callable SQL boolean cannot enable an unsupported
operating mode. Operational/unknown input returns false unconditionally in this
wave; no speculative operational eligibility or activation-receipt branch.

- local_demo: true only if NO `tutor_screening_cases` marker
  exists. Caller must independently enforce root local loopback demo mode and
  baseline approval/account/role/actual offering; this never authorizes hosted.
- synthetic_readiness: exact synthetic case approved, current positive decision
  tied to the same case/policy/round, enabled matching current policy head valid
  now, complete bound required check set whose latest receipts equal bound IDs
  and are passed/unexpired. Synthetic root runtime allowed explicitly; no
  arbitrary application flag can choose this in production.
- operational is deferred and absent from the typed capability/scope and current
  schema source values. A later approved change must define real evidence,
  provenance/activation and exclusion of demo/readiness profiles before enabling it.

It is ONLY screening eligibility: caller must still enforce approved profile,
active verified tutor account/current tutor role, active subject and same-offering
level, learner/guardian/admission, booking state and participant checks. No public
check code/evidence/decision ID or unsupported “verified” badge.

Root introduces explicit scope at composition boundaries while preserving existing
`listEligibleTutors`, `findEligibleTutor`, `listEligibleTutorsBySlugs` APIs for
local callers. W8 can add an optional validated scope argument/internal provider;
all queries, including search and public-availability batches, use the same
predicate before counts/pagination. Do not union demo and readiness automatically.
Tests explicitly select readiness data and label screens. Predicate exceptions
are unavailable, not false empty or legacy fallback.

W6/root add predicate to eligibleContext/create/move/confirm and exact final link
read/write/open query; lock tutor first as existing lifecycle/link services do and
recheck after waits. A shared tutor lock serializes screening suspend/revoke with
booking; a separate fresh final predicate observes policy/evidence/account changes
that committed while waiting. Check profile/source under that same transaction.
No W8 edits to W6-owned booking mutations. Retain history without implying every
historical private view requires new bookability.

## Safeguarding workflow, authorization and SQL

Extend existing support code/services and routes rather than cloning a support
system. Proposed new feature module `src/features/safeguarding/` owns narrow
policy/access/response service and forms; existing support owns case content,
lists, status, dispatch and booking context. Separate source checks choose the
matching authority explicitly; a nonlocal source never joins local_fixture grants.

New intake: policy authority before fields/body parse/storage; require current
active verified requester and validated feature capability/source match.
Owner-provisioned incident packet must have responsible/escalation owners current
in source-matched support_reviewers. Create
existing support_case + policy receipt + response event atomically. Optional booking
association retains requester current participation and immutable association;
until W6 current booking provider is accepted, safe no-association readiness
reporting works and new booking association remains denied. A synthetic report
is not monitored and shows no real response promise.

Provision exact dispatch grant/eligible choices deliberately with trusted tooling;
do not automatically grant the named owner all family access. A policy owner alone
gets no arbitrary case body. The owner tooling can route a newly created synthetic
case to its configured dispatcher by provisioning THAT case's grant; current
application requester never supplies recipient/grant. Runtime has no self-claim.

Keep local support service INSERT/UPDATE working while closing new-source direct
writes: source is immutable, and source-sensitive BEFORE INSERT/UPDATE triggers
deny new-source case/status/revision writes when current_user is the restricted
runtime role. New-source writes occur only in the authorized SECURITY DEFINER
functions owned by the deliberate migration owner. No writable custom GUC or
application boolean bypasses this guard. New response rows/events and existing
owner-provisioned capability/grant/choice rows have no
runtime write grant at all. Verify both runtime direct SQL denial and each valid
function path; retaining local table rights cannot permit forged readiness or operational
cases, current response pointers or acknowledgment-free close/reopen.

Proposed SQL functions `create_response_support_case`,
`change_response_support_assignment`, `record_support_acknowledgment`,
`request_support_escalation`, `change_response_support_status`,
`change_response_account_access`; exact signatures finalized in implementation
manifest, all actor/session/key/expected-revision parameters explicit. Fixed
pg_catalog search path, REVOKE PUBLIC, runtime EXECUTE only, no runtime capability
or assignment write grant. Policy/action/value inputs derive from trusted rows.

Proposed SQL parameter/type contracts to freeze with implementation:

```text
request_tutor_screening(text actor,text session,uuid tutor,uuid key)
record_tutor_screening_check(text actor,text session,uuid tutor,integer expected,
  uuid key,text code,text outcome,text reference,timestamptz checked,timestamptz expires)
decide_tutor_screening(text actor,text session,uuid tutor,integer expected,
  uuid key,text action)
review_local_tutor_application(text actor,text session,uuid tutor,text action)
resubmit_tutor_application(text actor,text session,uuid tutor)
create_response_support_case(text actor,text session,uuid key,text category,
  text subject,text body,uuid nullable_booking)
change_response_support_assignment(text actor,text session,uuid case,
  integer expected,text recipient,text kind,uuid key)
record_support_acknowledgment(text actor,text session,uuid case,
  integer expected,uuid key)
request_support_escalation(text actor,text session,uuid case,
  integer expected,text recipient,uuid key)
change_response_support_status(text actor,text session,uuid case,
  integer expected,text next_status,uuid key)
change_response_account_access(text actor,text session,text target,
  integer expected,text next_status,text reason,uuid key)
```

Mutation return tables contain outcome saved/replayed/conflict/invalid/forbidden/
not_found/unavailable plus nullable revision and needed status/opaque own created
resource ID only. No case/evidence payload returned on denials. Creation source
comes from the current enabled synthetic packet and validated feature-owned
capability composed with AuthRuntime; SQL refuses ambiguous current packets,
source mismatch and ALL operational writes. Runtime passes no
provenance/version/grant override. Functions create/consume only source-matched
synthetic_readiness authority and derive the policy head from trusted rows;
service also requires its selected validated packet to match that head. Owner
policy provisioning alone does not expose a disabled application intake. No
operational packet, source value, SQL activation switch, receipt service or
future real activation machinery is implemented here. Ordinary admin SQL
functions use fixed accepted W1 current-assurance age28800, never caller-selected;
reads and mutations share the complete W1 predicates and final post-wait rechecks.

| Action                   | Required current authority and state                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List/read dispatcher     | Current W1 assurance + exact current support_dispatch_grants capability + source/current packet/expiry. Queue/detail contains UUID/category/status/revision, assigned reviewer safe label, acknowledgment/escalation timestamps. Never subject/body/requester/learner/booking/meeting data. Choices only exact provisioned eligible choices, no all-staff picker.                                                    |
| Assign/reassign          | Current W1 assurance + above + exact support_reviewer_choices grant and source-matched support_reviewers capability. Actor/requester excluded from chosen recipient. Not closed. Existing assignment pointer is sole authority; increment case and assignment revision, clear acknowledgment/escalation request, append exact receipts.                                                                              |
| Reviewer read            | Current W1 assurance + active verified role/capability + exact current assignment; not requester. Return existing bounded case content/minimal permitted booking context, never family lookup. Query includes session assurance predicate, not a preflight-only check.                                                                                                                                               |
| Acknowledge              | Current W1 assurance, exact current assigned reviewer, open or in_review. Bind acknowledged_assignment_revision=current assignment revision; open→in_review if first acknowledgment. New revision/event; same key retry no duplicate. Reassigned reviewer must acknowledge again.                                                                                                                                    |
| Request escalation       | Current W1 assurance + current assigned reviewer + existing acknowledged current assignment + not closed + target exact current reviewer choice with can_escalate=true and current source-matched reviewer capability/named policy escalation owner. Store bounded request/time/target only, no notes/body copy; dispatcher receives metadata. Reviewer has no authority to choose arbitrary staff or self-transfer. |
| Escalate transfer        | Current W1 assurance + exact dispatcher grant + pending matching request/eligible current escalation choice (or explicitly policy-allowed dispatcher escalation). Transfer assignment atomically, clear old acknowledgment, new recipient must acknowledge. Old reviewer immediately loses reads/writes/booking context. Kind stays `escalate`, not an invented dispatch side effect.                                |
| Close                    | Current W1 assurance + current assigned acknowledged reviewer + current packet permits closure + in_review. No report reply/resolution narrative, timestamps/audit only. No closure claim on behalf of a staffed incident service.                                                                                                                                                                                   |
| Reopen                   | Current W1 assurance + current exact assigned reviewer + current packet permits + closed. closed→in_review, response_cycle+1, clear acknowledgment/escalation; current reviewer must acknowledge again. Former reviewer or dispatcher-only actor cannot reopen. Reassign closed case requires authorized reopen first, preserving existing denial.                                                                   |
| Restrict/restore account | Current W1 assurance + independent current exact staff-target restriction grant/action/expiry and matching provisioned target source/policy; not self/admin. Does not require support reviewer membership or exposing learner/case body to restriction queue. Restore preserves separate screening deny.                                                                                                             |

READ COMMITTED lock order for case-only actions: case FOR UPDATE, current response
and assignment, exact grants/staff/current policy head FOR SHARE in stable key
order, actor request key; then separate current assurance and all source/assignment/
grant/policy checks after waits. Content read uses case FOR SHARE then fresh
authorization before minimal projection; list uses a single current-auth statement.
Owner provisioning/revocation/reassignment must share case lock. Global policy/staff
revocation locks policy/staff only and never subsequently case, preventing cycles.
Actor assurance revocation is observed in fresh final commands, no cached receipt.

For any action involving booking use the existing tutor→booking→case order
(support case content reads only hold case; their minimal booking query must not
acquire tutor later). Never add case→tutor locking. Account restriction targeting
a tutor locks tutor first, then target/access/grants/request key, then final checks;
non-tutor restriction uses target/access directly. Do not hold case while locking
account target. Supporting audit/reference to a case does not authorize it and
must not introduce a cycle. Cross-feature waited-lock tests are required.

Replay compares complete normalized action, case/target, expected revision,
recipient/status/reason. Recheck authority before replay. Concurrent equal actions
commit one event; differing stale action gets409; unassigned/foreign/revoked exact
resource gets404; missing global assurance403; policy disabled/unavailable503.
Use existing privateJson/no-store, safe RuleError/AccessError, strict bounded JSON,
same-origin/POST protection. Hosted origin plumbing belongs to accepted root/W3,
never weaken `sameLocalOrigin` to support new data.

## Shared edit ownership and migration bridge

W8 implementation may edit its new modules/schema/tests and these bounded hunks
in its OWN checkout per `w8-ownership-followup.txt`:

- Tutor review.ts/review-rules.ts/review-actions.tsx and handler: exact assignment,
  accepted assurance, check/decision routing and truthful copy; existing admin
  tutor list/detail and tutor application/profile routes, unique check routes.
- Required service.ts rejected-resubmission/protected-column hunk identified
  above; do not alter approved edits or subject/timezone behavior.
- eligibility.ts/public.ts/search.ts/directory-availability.ts: explicit validated
  scope/predicate only, unchanged public DTO/filter/availability semantics.
- support service/handler/dispatch-service/dispatch-handler and presentation/forms:
  explicit source authority, acknowledge/escalation controls and safe metadata;
  support-bookings/query.ts current reviewer assurance only, W6 owns booking-state
  provider changes. Account restriction service/source checks/route/UI bounded.
- Schema index export, proposed screening/safeguarding schema, existing support
  source/expiry/choice/event hunks with retained PK/FKs, account restriction
  source/policy hunks; scoped runtime
  grants/protection/fixture and registration additions prepared for root.

Root owns final shared navigation, actual hosted runtime composition/core
auth/network helper,
cross-branch inventory/protections expectations, grants merge, journal and
cumulative snapshots. W8 never edits W1 provider/assurance or copies mutable
provider files. Proposed0024_screening_safeguarding follows accepted W1
0022 and W5 admission0023; exact cumulative W5 snapshot/journal bridge must
arrive before supported metadata generation. Domain SQL/tests can be prepared
without fabricated metadata, but migration execution/completion requires bridge.
Root reconciles function allowlists and table/trigger/grant counts from actual
accepted DDL. Historical0000–0021 unchanged, including SQL/hash ledger.

## Incremental implementation handoff

1. Receive root-accepted W1 assurance0022 manifest and implementation dispatch;
   compare accepted hashes. Compose actual AuthRuntime with feature-owned
   disabled/synthetic_test capabilities. Author own screening/schema/policy/input/
   eligibility and meaningful denial tests; no mutable/provisional import or
   generic runtime prerequisite. Hosted composition remains root/W3's later input.
2. Add SQL protected screening transitions/check receipts, exact grants/current
   assignment tooling and legacy exact demo reviewer provisioning. Narrow tutor
   grants and safely resubmit rejected applications. Build existing-route tutor
   application→assigned missing-check→evidence→decision UI, not CLI-only evidence.
3. Publish frozen eligibility v1 with manifest and actual affected PG results;
   root/W6 integrate create/move/confirm/link/discovery. No promise of API
   acceptance from this proposed architecture report.
4. Extend existing support reviewer/source/expiry/choice/history and restriction
   grants while retaining PK/FKs and local checks; add four response receipt/state
   tables. Implement synthetic policy-gated intake and current-content reads,
   acknowledgment, escalation request/transfer, close/reopen, independent account
   restriction controls. Keep local fixture flows through unchanged local source.
5. Obtain root/W5 exact migration bridge; compose0024, add discovered test/config
   hunks and affected docs. Then separate read-only Review→Verify→Remember under
   new implementation dispatch, with independent combined root acceptance later.

## Verification plan — separate verifier, DO NOT EXECUTE here

NOT RUN for all W8 execution. Exact later commands use existing scripts:
`npm run check`, `npm run test:integration`, `npm run build`,
`npm run test:e2e`, affected `npm run test:e2e:cross-browser`, and root full
`npm run test:restore`. Own ports55908/3098/3198, TLS56008/3298 only after
ownership/free-port check and root heavy lease. No install, browser/PG process,
target/provider/cloud or live mail operation is authorized in this architecture
dispatch. No dependency additions expected.

**Discovery:** unit paths tests/unit/_.test.ts and component paths
tests/components/_.test.tsx already discovered by vitest.config.ts; PG
tests/integration/**/*.test.ts already discovered by integration config. Proposed
tests/unit/tutor-screening.test.ts, safeguards policy/input tests,
tests/components/tutor-screening.test.tsx and safeguarding forms;
tests/integration/tutor-screening.test.ts, safeguarding-response.test.ts,
screening-safeguarding-migration.test.ts. Proposed E2E tutor-screening.spec.ts and
safeguarding-response.spec.ts require additive default playwright.config.ts
projects in existing sequential dependency chain; root owns merge. Cross-browser
registration must include actual critical journeys on Firefox/WebKit, not only
Chromium or a private one-off config. List/discovery evidence required later.

**PG/service acceptance:**

- Complete/missing/failed/wrong-policy/future/expired/revoked check; stale receipt
  after edit; wrong policy head/round/source; policy expired/revoked; operational
  capability/scope/source rejected unconditionally. No demo fallback for enrolled tutor.
- Every review action and check write rejects unauthenticated, role-only,
  unassigned, self, foreign capability, inactive/unverified/suspended, stale
  revision and expired/revoked assurance. Ordinary actions with a valid receipt
  older than five minutes but inside accepted eight-hour age succeed; a receipt
  at/outside accepted age or nonfuture/session/factor/epoch/role mismatch denies.
  No credential/factor endpoint or fresh-factor semantics is changed. MFA factor/epoch/role/session receipt
  changes while blocked on tutor/assignment/policy/key locks deny without writes.
- Two review/approve/reinstate vs revoke/evidence change requests using independent
  connections; observed lock waits, fresh final denial and one consistent decision
  head. Same-key same/different request tests, revoked replay denial, audit failure
  rollback. Direct review_status/check/decision/policy/assignment writes denied.
- Screening suspend/revoke vs W6 create/move/confirmation/link open after accepted
  integration: tutor-first locks, no double authority, public query/count/profile/
  matching/availability prompt denial. Bookings/history stay intact.
- Policy disabled incident intake collects/stores no body; missing named owner,
  expired/revoked staff/guidance/packet/source denies. Requester reads only own;
  dispatcher never reads body/subject/learner/booking context, even via direct URL.
- Acknowledge binds current assignment, clear on transfer/reopen; cannot close
  unacknowledged or wrong cycle; escalation target exact eligible choice; old
  reviewer cannot read/status/ack/escalate/book-context/reopen after transfer.
  Parallel transfer/ack/reopen/staff/grant/assurance revocations after actual waits.
- Populated extension preserves reviewer/choice/assignment/history PK/FKs and
  local_synthetic/local_fixture joins. Existing local escalation works without
  can_escalate; readiness needs that exact flag, current choice and named owner.
  Readiness staff source collision refuses provisioning; local grants/roles,
  unrelated policy owners and reviewer capability alone confer no new authority.
  Expired/revoked reviewer/dispatch/choice/restriction grants deny; renewal/revoke
  appends existing histories with snapshots, never rewrites old events. Dispatcher
  needs no reviewer registry entry and restriction actor needs no case capability.
- Restriction operation needs independent exact target grants/capability, denies
  self/admin, serialization and post-wait rechecks, idempotent audited revision;
  restore does not reinstate screening. Direct account status/grants denied.
- Fresh full chain and populated0021→0022→0023→0024 forward proof preserving all
  44 baseline public tables/rows/values and historical hashes. Check actual grants,
  functions, triggers, FK/event/source shapes, PUBLIC/membership/parameter ACLs and
  grant options. Owner cannot rewrite append-only history. No invented final count.

**Actual browser journeys:**

1. Fictional tutor register→captured verification→sign in→start application→native
   profile/offerings submit. Assigned reviewer signs in through actual W1 MFA;
   queue shows only assigned application, approve missing-check failure observed.
   Record synthetic references/checks using page form, approve, then readiness
   discovery/profile/matching/slot view shows real stored synthetic profile with
   synthetic notice. Tutor approved edit stays eligible; revoke/expire evidence
   removes directory/profile/slot/bookability. Reinstate without valid checks fails.
2. Fictional requester report concern through real form. Exact dispatcher MFA
   queue contains metadata only; assign from exact choices. Assigned reviewer MFA
   opens existing case, acknowledges, requests escalation. Dispatcher transfers;
   old reviewer direct page/API and Back/bfcache fail closed; new reviewer
   acknowledges and performs allowed close/reopen. Full audit/revision shown
   without case text in dispatcher history. Unrelated admin/requester denied.
3. Same response journey plus independent restriction actor suspends exact tutor;
   other browser's stale slot/create/link rejects, history remains. Restoring account
   alone cannot bypass revoked/expired screening. Root owns combined
   admission→screening→booking→link→mail→outcome→review journey.
4. Same browser actor switches/logout/failed reauth/revoked sessions/roles/grants,
   Back/Forward/bfcache: inspect stale inline RSC/bootstrap and actual fresh page/
   API denials. Preserve document-boundary.tsx/full-document replacement semantics.
   Public/auth HTML, API errors, logs/client assets and reports contain no prior
   case body/private evidence/learner IDs/meeting/MFA secrets.
5. Actual320/390/1440, relevant768/1024 layouts, keyboard/native dialogs/fields,
   pending/conflict/error focus, axe, no-JS readable private states and safe native
   POST fallback or honest JS-required mutation state (never false success),
   reduced motion/forced colors; selected W1/security journeys in Firefox/WebKit.
   Screenshots visually inspected later; physical/hardware-device limitations
   reported honestly. No live email/document/provider required for this slice.

Evidence: exact source manifest, accepted imports/migration bridge, command/env/
exit logs, independent-connection lock observations, permission probes,
discovered spec lists, bounded redacted results and private screenshots at0700/
0600 ignored paths. Preserve original failures and repairs. Same-agent Review is
not independent review; root supplies combined independent review. A passed build
or fixture function does not replace UI/PG journeys or actual human operations.

## Context updates, risks and gates

Implementation/root later update architecture for screening receipts/predicate,
case response authority and lock/grant contracts; PRD for bounded software
readiness behavior under TUT-01/ADM-01/03/04/OPS-05; build-plan without completing
M6/M8 gates; UI context only for truthful policy-disabled/synthetic statuses using
existing navy/teal tokens/native controls; operations docs for deliberate staff
provisioning, packet selection/revocation, disabled intake and human ownership;
tracker only after actual changes/checks, no updates by this architect.

Primary engineering dependencies: accepted W1 manifest, feature-owned validated
capabilities composed with actual AuthRuntime, W5 exact0023 cumulative snapshot/
journal, W6 source/booking/link consumer integration and root discovery/protection/
test registration. Root/W3 supplies hosted composition later; no generic runtime
or activation-receipt dependency. No current
missing software decision prevents this plan; implementation waits for frozen
inputs rather than guessing. Function signatures marked proposed become exact
at provider freeze and are reviewed together with grants/metadata.

Real gates remain **OPEN/disabled**: actual launch-market screening minimum and
qualification/identity evidence, privacy/retention/consent/guardian policy,
actual staffed accountable response/escalation owners, meeting guidance,
incident/appeal actions and real-user activation authorization. The real plan
must include a responsible human response channel, coverage and escalation
procedure; database assignment is not that plan. Payments idle. Existing13
dependency advisories are inherited separate risks. No production/deploy/provider/
main/peer writes, commit/merge/push or nested agents in this dispatch.

Rollback: disable new-source packet/composition paths and deny new intake or
bookability; retain records/audit and legacy local demonstration. Reviewed forward
migration with preservation proof; no destructive down migration. Restore only in
an explicitly owned local rehearsal under its later authorized task.

Blueprint ready. Architect output is complete; W8 implementation, Review and
Verification are **NOT RUN**. Return to root for its automatic implementation
dispatch after accepted prerequisites, not routine user confirmation.

## Resumed implementation authority — 2026-10-12

Root dispatched full Implement→Review→Verify→Remember on task_b39ae000fd7b,
ctx_d5ce53bac77b under AUTHORIZED — build-feature delegation. The earlier
Architect-only stage is historical; this resumption receives the exact accepted
119-file provider baseline, aggregate
0f0dd8511da6629e67b1252641c13131bbaa2337c6f26b84b69f903801f615ec.
All119 imported source hashes were checked before edits. Root allocated own-checkout
shared tutor/support/restriction, grants/fixture/registration and route hunks;
final cross-branch integration remains root-owned. Shipped feature-owned
getScreeningContext and getSafeguardingContext factories always return disabled.
Root separately permits a private complete-source test mirror overriding only
those two factories with strict fixed fictional policy packets, preserving every
other actual runtime byte.0024 generation requires root's accepted cumulative
W50023 metadata bridge. No new real-human/legal/policy approval follows.

### Root independent F1/F2 correction authority — 2026-10-12

Root messages msg_b94c7c8887f0 and msg_a6ee037a2102 hold source/provider acceptance
pending actual enrollment/resubmit last-FK authority loss, positive decision last-FK
expiry and nested outer-function expiry regressions. These are technical correctness
repairs within **AUTHORIZED — build-feature delegation**, not new human policy.
The latest explicit root direction supersedes the earlier STABLE/statement-time
provider recommendation: `has_current_tutor_screening(uuid,text)` is **VOLATILE**,
using fresh database clock and current query semantics after an outer function waits.
The TypeScript predicate signature/scopes and minimal public DTO remain unchanged.
Enrollment/resubmission and positive decisions need post-write exception rollback;
outer profile save needs final current identity after audit writes. Original source,
functions, candidate stamp, all68 public digests and prior24 stamps must be preserved
for the authorized owned test55908 candidate-only reconciliation, followed by real
fresh/populated proof and affected domains. Full source freeze1/2 and original failed
attempts remain immutable; no root/production/peer database action or0023 edit.

### Root-approved final browser harness refinement — 2026-10-12

Root msg_813558e27cf6 authorized CLI-only webpack diagnosis after actual CDP
Turbopack reload initiators; msg_8ce2d3860005 then authorized serial next build/start
for the complete-source3098 mirror after retained browser9 missing-button failure.
This affects only test harness runtime selection and keeps exact application bytes,
shipped configuration, two versioned synthetic factory overrides, normal registration
and all business/privacy/keyboard/native-form assertions. Current ordinary3198
production build and mirror real-browser evidence remain distinct from hosted
TLS/provider delivery or human policy approval.
