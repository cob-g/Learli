# W5 — Learner and guardian admission

Date: 2026-10-12. Primary package: **M4.4**, within the parent **M8.10** wave;
related M2.4/M2.5/M2.9, M4.11, M5.2–M5.4 and M6 decision gates
D-01/D-09/D-10/D-12. PRD: FAM-01/02/04, AUTH-03/05, BR-03/04/05/15/16,
NFR-01/02/05/06/11/13; downstream BKG-01/04 and MEET-02.

Status: **AUTHORIZED — build-feature delegation**. Current full source is implemented and independently READY FOR VERIFICATION under task_748dd18035ac / ctx_7f63930491fa; all119 accepted provider hashes were verified before edits.
Real admission activation remains **BLOCKED** by actual policy and operating
evidence. Current scoped final verification: **PASS — local synthetic W5 scope**. Historical architecture-stage verification was NOT RUN. Root combined integration, restore and real activation remain separate.

## Authority, baseline and required inputs

The user authorized eight local software areas, GPT-6.1 Sol High builders, payments
idle, under the root coordinator. The original planning worker was dispatched only to Architect
W5, task `task_f49c72ea2681`, dispatch `ctx_6846d703cb64`. No separate human
blueprint approval, consent/legal approval, actual guardian review, implementation
or release approval is recorded. Root accepted the candidate current-learner
authority seam for planning in `msg_44287ff4fe77`.

Checkout: `/Users/cob/orca/workspaces/learli/m8-guardian-admission`; observed branch
`cob-g/m8-guardian-admission`, HEAD/main baseline
`2fa0294c5e6cad895754b3c10a703a6c6f6ef00a`, clean before this planning task.
No branch is proposed or created; use the allocated branch for a later dispatch.

Read repository-source build-feature and architect skills in Orchestrated mode,
AGENTS.md, ORCHESTRATION-LESSONS.md, and the eight canonical files in this order:
`context/project-overview.md`, `architecture.md`, `ui-context.md`,
`code-standards.md`, `ai-workflow-rules.md`, `progress-tracker.md`, `prd.md`,
`build-plan.md`. Paths are repository-relative and lowercase. Applicable decision:
`docs/decisions/2026-10-12-local-learner-onboarding.md`; root's current governing
decision is `docs/decisions/2026-10-12-hosted-workflows-software.md` in the read-only
integration checkout.

Parent: `prompts/features/m8-10-hosted-workflows-wave.md`, originally accepted
SHA256 `cc8a9677aef73717494233d1493921a88c0a4aac03cdd087803dedf208b80014`.
Root's `msg_72d1bdf1ac55` supersedes bytes with formatting-only SHA256
`80e76571d47f2d4c9ad51467e58c5cc87587f5ca5cabedde770dd6f6c0bbb610`, unchanged
normalized content/scope. The latter was copied unchanged to this checkout because
the parent was absent. Exact future edit allocation is the root-owned
`/Users/cob/learli/.local/hosted-readiness-wave/w5-ownership-followup.txt`.

## What we are building

A verified account with no ordinary family role can request a new guardian-managed
learner admission or independent College Support admission through a policy-gated
private flow. A precisely assigned, currently capable MFA-assured admin records
bound evidence and authorizes, rejects or revokes the request. Pending records
grant no representation, learner/booking/link access or family role. Authorization
atomically activates the existing learner row, creates the guardian link when
appropriate, grants only the derived ordinary role and appends decision history.
Revocation removes current learner authority without deleting the record/history.
The same current-authority predicate supplies W6 and root's participant consumers.

This is complete synthetic readiness software, distinct from existing local demo
creation. It is not actual guardian proof, age determination, consent or a booked
lesson. Missing intake policy denies before rendering child fields or accepting a
child payload. No terminology clarification is needed for the delegated scope.

## Inspected reality

- `src/features/learners/service.ts` provides list/read/update/create and the exact
  five-field `PrivateLearner` DTO: id, displayName, level, timezone, management.
  All existing services are loopback development/test and `local_fixture` gated.
  `readAuthorizedLearner(db.select,userId,learnerId,lock=false)` lacks a session
  argument; booking separately rechecks it after locks. Do not silently change
  that signature for historic callers.
- `schema/learners.ts` allows only `local_fixture`; self rows uniquely own a user
  and require College Support; guardian rows have no user/login. Links permit
  authorized/revoked only, with a composite guardian-only FK.
- `0018_local_learner_onboarding.sql` defines `create_local_learner`: actor NO KEY
  UPDATE, session SHARE, fresh READ COMMITTED identity/role check, canonical retry
  hash, one self profile, twenty demo-created guardian profiles, atomic immediate
  authorized link/creation receipt. It is not real consent. Preserve its bytes
  and behavior, including retry denial after revoked/inactive records.
- `scripts/runtime-grants.ts` grants profile/link SELECT and profile UPDATE only
  for display_name/level/timezone/updated_at. Raw profile/link/role/history INSERT,
  link UPDATE and ordinary role writes are denied. Only narrow functions create.
- Auth registration assigns no roles. `requireIdentity` checks provider session,
  verified email, active user_access and trusted user_roles. Account .test syntax
  is a fixture safeguard, not independent eligibility or guardian proof.
- `/learners/new` carries a strictly parsed public selected time through `next`;
  forms use private POST actions, SSR-disabled hydration controls and no-script
  disclosures. Awaited list/detail/create HTML and document-boundary behavior
  preserve privacy/no-JS reads.
- Booking service, lifecycle/read queries, meeting and other private consumers
  contain independent literal `local_fixture`/link checks. W5 does not rewrite
  those modules; W6/root install the accepted readiness predicate explicitly.
- Real PG learner creation tests already cover retries, cross-family denial,
  narrow function grants, post-wait role/session/access/verification revocation
  and rollback. Historical passes are not fresh evidence for this plan.
- W1 `assurance.ts`/`provider.ts` were read in `m8-admin-assurance` only. Proposed
  signatures are requireAdminAssurance(runtime,headers),
  recheckAdminAssurance(db.execute,identity,maxAgeSeconds), and
  adminAssurancePredicate(userId,sessionId,maxAgeSeconds), backed by
  has_admin_assurance. These files are mutable and **not a frozen dependency**.

## Narrow consumed policy and provenance

Proposed `src/features/learner-admission/policy.ts` owns admission validation; root
installs the selected capability at runtime composition. Do not create a generic
policy engine/editor, broad environment bypass or unchecked AuthRuntime cast.
Feature service input composes `{ runtime: AuthRuntime, admission: AdmissionCapability }`
as an explicit server-owned context, leaving existing AuthRuntime fields and local
callers intact. Root's eventual hosted runtime may supply a structurally compatible
runtime through its accepted composition; no asynchronous factory refactor is W5-owned.

`AdmissionCapability` is a discriminated record: disabled, or synthetic_test with
validated policyId UUID, version/reference, marketCode, immutable content digest,
noticeVersion, guardianProofMethod, independentEligibilityRule,
reviewerCapabilityCode and explicit revocation effect. For this wave the only
enabled capability is synthetic_test; approved real policy is reserved and denied
until a separately authorized actual packet/composition is supplied. No invented
age limit, DOB, country, legal notice wording, expiry/retention requirement or
guardian consent assertion is embedded in code.

Consumed synthetic values: marketCode `synthetic_test`, version
`synthetic-admission-v1`, reference `synthetic:admission:v1`, noticeVersion
`synthetic-notice-v1`, proof method `synthetic_guardian_review`, independent rule
`synthetic_independent_review`, reviewer code `learner_admission_review`,
revocation effect `deny_current_learner_access`. These identifiers mean a software
exercise only; the notice states no consent is established. Exact-check evidence
must exist: guardian_authority + guardian_notice for guardian mode;
independent_eligibility for self mode. College level or verified email alone is
never that evidence. No hypothetical numerical eligibility rule is necessary.

New records use `source=synthetic_readiness`; existing local_fixture records and
links keep their source. W5 migration expands source CHECKs only to these two
values. No operational row factory/source is enabled in this wave; activation of
real data is a later explicitly reviewed change. Hosted-synthetic composition may
consume readiness records only through root's explicit capability. Production
composition rejects synthetic_test and neither old nor readiness fixtures may
become operational by changing an environment string. Domain tests inject a
validated capability through owned test modules; no application flag exposes a
test backdoor. Disabled is the shipped real-flow default.

Policy check precedes request.json/form parsing for intake, and SSR renders no
child inputs, hidden defaults or draft child value when disabled. A malicious
client can send bytes regardless; the server must neither deserialize nor store,
echo, log or generate field feedback from them. Identity/origin/size/method
checks remain. GET context may show the unavailable state and public selection,
never a pretend consent checkbox.

## Proposed schema, state and constraints

All names below are **proposed new contributions** in
`src/lib/db/schema/learner-admission.ts`, reserved
`drizzle/0023_learner_admission.sql`, after accepted W1 `0022`. Historical
0000–0021 are immutable; only root reconciles final cumulative metadata.

| Table                          | Exact proposed fields and ownership                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| learner_admission_policies     | id UUID PK; version/reference/market_code/source/authority/content_digest/notice_version/guardian_proof_method/independent_eligibility_rule/reviewer_capability_code/revocation_effect NOT NULL; created_at DB time. Unique source+market_code+version and immutable identity/content. authority=synthetic_test, source=synthetic_readiness only in this migration. Owner provisioning only; never browser input.                                                                                                                                                                            |
| learner_admission_policy_state | source+market_code PK; current_policy_id FK; enabled boolean; revision nonnegative; updated_at. A composite FK binds current policy to the same source/market. Owner-only activation/switch/disable; no runtime writes.                                                                                                                                                                                                                                                                                                                                                                      |
| learner_admissions             | id UUID PK; requester_user_id FK RESTRICT; learner_id UUID UNIQUE FK RESTRICT; management guardian/self; source=synthetic_readiness; policy_id FK; policy_version + policy_reference + policy_digest immutable receipt; request_id UUID; request_fingerprint 64 lowercase hex; state pending/authorized/rejected/revoked; revision nonnegative default0; selection_path nullable max2048; created_at/updated_at DB time. Unique requester_user_id+request_id. One admission owns exactly one existing learner row; fields are immutable except state/revision/update time through functions. |
| learner_admission_reviewers    | user_id+source+capability_code PK; active boolean; created_at/updated_at. Owner-controlled reviewer eligibility, not a global admin permission. No automatic seed grant.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| learner_admission_assignments  | admission_id PK FK RESTRICT; reviewer_user_id FK; source; capability_code; revision nonnegative; assigned_at/updated_at. Composite FK to reviewer capability. Owner-controlled exact assignment; requester != reviewer, enforced by trigger. No runtime claim/reassign endpoint.                                                                                                                                                                                                                                                                                                             |
| learner_admission_evidence     | id UUID PK; admission_id FK RESTRICT; policy_id FK; source; check_code guardian_authority/guardian_notice/independent_eligibility; method; notice_version nullable except guardian_notice; reference opaque bounded token (no URL/free text); subject_user_id=requester; recorded_by_user_id; request_id UUID; fingerprint; recorded_at; revoked_at nullable. Unique recorded_by_user_id+request_id; unique source+reference prevents reuse across requests. Facts immutable; revocation only through scoped function plus event. No evidence document/content/contact.                      |
| learner_admission_events       | id UUID PK; admission_id FK; actor_user_id FK; request_id UUID; fingerprint; event requested/evidence_recorded/evidence_revoked/authorized/rejected/revoked/assigned; from_state/to_state; revision; policy_id/version/reference/digest; evidence_id nullable FK; assignment_revision nullable; created_at DB time. Unique admission_id+revision; unique actor_user_id+request_id; immutable append-only. Required event shapes use nullable-safe CHECK(... IS TRUE). No learner labels or raw proof payload.                                                                                |

`learner_profiles` keeps the same model and five-field projection. Add source
union type and conditional source CHECK; add UNIQUE(id,management,source).
`guardian_learner_links` adds matching source union and a triple FK
(learner_id,management,source) to prevent cross-source authority. Existing composite
FK and uniqueness/self constraints stay. Pending readiness rows have status
inactive; authorized rows active; rejected/revoked inactive. Guardian pending has
no link; authorizing creates exactly one same-source authorized link to requester;
revoking changes that link to revoked. Self user_id=requester, College Support,
one existing unique user, and no guardian link at any state. New fixture_key uses
an opaque `readiness-admission:<uuid>` identifier. Never retarget or reuse an
existing local_fixture learner; accounts with an existing self demo profile get
a truthful conflict, not a second self record or source promotion.

Forward triggers enforce: immutable profile/link source, management and owner;
readiness profile creation corresponds to its exact admission; readiness link
corresponds to an authorized guardian admission/requester/policy; pending and
terminal admission state matches profile/link state; every revision has its exact
event and authorization has required matching nonrevoked evidence. Use deferred
constraint triggers for invariants spanning multi-statement transactions. No
legacy records are backfilled into admission and no new trigger rejects legitimate
historic local_fixture creation/update.

Existing runtime column UPDATE would otherwise permit raw readiness edits.
Add a source-conditional trigger that rejects learli_app's direct UPDATE of a
readiness profile; the accepted fixed-path definer edit function owns those writes.
Do not use caller-settable GUC as a bypass. Definer owners are distinct non-runtime
roles; functions/triggers have SET search_path=pg_catalog and fully qualified
application objects. Runtime has no function ownership, grant option or schema
CREATE. These protections do not purport to stop the trusted migration owner.

## State machine and ordinary-role grant

Creation: no-role verified account → pending admission + inactive learner +
requested event. No guardian link or family role is created. A parent intent is
stored as management=guardian; a self intent is stored as management=self. Do not
accept role, user/guardian/learner IDs, source, policy packet, evidence or state in
the intake payload. Client policy version/digest is only an expected-rendered
revision token and must match server-selected immutable policy, never authority.

Allowed decisions: pending→authorized, pending→rejected, authorized→revoked.
Rejected/revoked do not reopen or reauthorize on replay; a new guardian request
can use a new UUID subject to the technical bound. Independent unique-owner
conflicts retain the old request/history and explain unavailability; self
reapplication is deliberately excluded from this small slice. No arbitrary
existing-child linking, child lookup by name/email or self-review is supported.

Authorization derives role from stored management: guardian→parent; self→student.
It inserts only that user_roles membership ON CONFLICT DO NOTHING, activates
the learner and creates the guardian link if needed in the same decision/event
transaction. A role is an account capability, not authority for other learners.
Revocation keeps that ordinary role because other legitimate relationships may
use it; current admission/profile/link checks remove this learner's authority.
It does not delete sessions/history or cancel financial/booking obligations.
Revoke/disable/evidence loss denies fresh profile/book/meeting/history reads for
that relationship. W6/root own safe retained-booking support handling.

An exact assigned reviewer records evidence through the scoped function; the
result is a reviewer attestation, not software verification of the underlying
real-world facts. Method/code/notice version are checked against the consumed
policy and admission management. Evidence UUID/reference cannot be reused across
another requester, policy/version or admission. Requesters cannot record their
own evidence. Evidence revocation on an authorized request revokes admission,
profile/link authority and appends both evidence and decision events atomically.
Missing/incomplete/revoked evidence denies authorization without any role/link
change. Rejection/revocation still work under the bound original policy when
intake is disabled or the policy pointer changes; staff scope/MFA remain current.
They must be able to remove authority after a policy becomes unavailable.

Technical bounds: at most20 created readiness guardian admissions per requester,
including terminal requests; retries do not consume capacity. This is a local
resource bound matching the existing demonstration, not a customer/retention
policy. Lists return20/page with opaque authorized request-ID keyset cursors and no total queue cutoff; evidence bounded to16 entries per
admission. Ref token1–128 ASCII [A-Za-z0-9:_-], never URLs or personal text. Full
body limit stays the existing mutation convention. Exact values are delegated
software bounds, not consent/safety thresholds.

## Proposed narrow SQL entry points and runtime grants

| Function signature                                                       | Responsibility                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| create_learner_admission(text,text,uuid,uuid,text,text,text,text,text)   | actor, session, request, server policy, management, name, level, zone, canonical nullable public selection. Creates only new same-source pending admission/learner/requested event.                                                |
| record_learner_admission_evidence(text,text,uuid,integer,uuid,text,text) | actor, session, admission, expected revision, request, check code, opaque reference. Exact assigned MFA reviewer records policy-derived method/notice and bound evidence/event; bumps revision.                                    |
| decide_learner_admission(text,text,uuid,integer,uuid,text)               | actor, session, admission, expected revision, request, authorize/reject/revoke. Exact scope, evidence set, original/current policy checks as appropriate; role/profile/link/decision audit atomically. No role or owner parameter. |
| revoke_learner_admission_evidence(text,text,uuid,integer,uuid,uuid)      | actor, session, admission, expected revision, request, exact evidence ID. Scoped revocation, including atomic admission revocation when authorized.                                                                                |
| update_admitted_learner(text,text,uuid,uuid,text,text)                   | actor, session, learner, server policy, display name, zone. Requires current authority; readiness level is immutable because it formed reviewed intake. Demo PATCH retains existing level editing.                                 |
| has_current_learner_authority(text,text,uuid,uuid)                       | actor, session, exact learner, server policy. Read-only bool, no mutation/locks. False for absent, pending, stale, foreign or disabled authority.                                                                                  |

The mutation functions return a minimal outcome + admission/learner UUID + revision
where authorized, not a raw row or evidence content. Outcomes: created/recorded/
decided/replayed, forbidden, invalid, conflict, exists, capacity, policy_unavailable.
Map forbidden/private absence identically to404 after authentication; 401 for no
identity, 400 safe allowed field errors, 409 stale/request conflict, 503 disabled/
unavailable. Reads use privateJson no-store/no-referrer. Never return raw SQL/error.

REVOKE ALL FROM PUBLIC on every new function. Grant learli_app EXECUTE only on
the six entry points above and SELECT on required admission/policy/evidence/scope/
event projections. No INSERT/UPDATE/DELETE on new tables, guardian links or roles;
no profile status/source/owner writes; no trigger-helper EXECUTE. Existing grants
and all local functions stay. Evidence references are projected only to exact
assured assigned reviewer, never requester lists, public DTOs, booking consumer,
logs or client common bootstrap. Owner tooling alone provisions policy/reviewer/
assignment fixtures, does not grant broad table rights to runtime and cannot be
called through an application endpoint.

## Locks, current authorization and retries

Use READ COMMITTED, existing transaction connection, and DB clocks. Do not call
the outer runtime pool while holding domain locks. SQL definer mutation functions
are VOLATILE; each lock and final check is a distinct command, not a stale
predicate evaluated before a lock wait.

1. Intake locks requester user FOR NO KEY UPDATE, session FOR SHARE, current
   policy-state row FOR SHARE; after all waits fresh-check session ownership/
   expiry, verified/active synthetic identity, policy row/version/digest and
   selected capability. Then validate bounded fields/time zone, retry hash, self
   uniqueness/capacity; insert pending learner/admission/event atomically.
2. Evidence/decision/edit first look up immutable IDs without disclosing content;
   lock involved user rows (actor and requester when different) in sorted ID order
   FOR NO KEY UPDATE, relevant session FOR SHARE, policy-state FOR SHARE,
   admission FOR NO KEY UPDATE, learner FOR NO KEY UPDATE, assignment/reviewer
   capability FOR SHARE, then matching evidence rows FOR SHARE ordered by ID.
   Do not lock tutor/booking rows anywhere in W5.
3. After the last possible wait, a fresh SQL check requires current provider
   session/account, W1 has_admin_assurance, admin role, exact active reviewer
   capability and exact current assignment, requester≠actor; authorization also
   rechecks eligible requester, current active policy and all bound evidence.
   Use the W1 accepted assurance age; MFA never replaces assignment/self exclusion.
4. Validate expected admission revision and request fingerprint. Compare existing
   actor/request receipts only after current access check. Same-key same-command
   returns the original immutable result but never reactivates a revoked link or
   restores role/evidence. Changed payload/key reuse conflicts. Different stale
   revision conflicts, including another reviewer's reassignment/evidence update.
5. Capture one clock_timestamp after locks for the successful state/evidence/event
   writes; commit or roll back all of them. Injected audit/role/link failures must
   leave no partial grant. READ COMMITTED checks, not initial TS guards, are final
   authority. Retrying authorization after revocation never returns a live learner.

Owner assignment/capability/evidence/policy fixture mutations use the same admission
serialization order where relevant. Assignment revision advances with an assigned
event/admission revision, and owner tooling denies self assignment. Capability
revocation/policy switch can commit while a worker waits; final checks must see it.
Do not serialize policy disable behind an indefinite booking obligation.

W6 retains tutor-first→booking→actor/session/learner locks. It does **not** take
admission locks before learner locks or reverse W5 ordering. It calls the read-only
authority predicate in a new statement after its final blocking wait. Revocation
committed before that check denies; an already authorized in-flight mutation may
finish. Root must test this actual linearization point and not promise retroactive
recall of already rendered data, links opened externally or committed email.

## Candidate authority API for W6/root

Proposed new `src/features/learner-admission/authority.ts`:

```ts
type CurrentLearnerAuthorityInput = {
  userId: string | SQL;
  sessionId: string | SQL;
  learnerId: string | SQL;
  policyId: string | SQL;
};
currentLearnerAuthorityPredicate(input: CurrentLearnerAuthorityInput): SQL;
readCurrentAuthorizedLearner(
  db: Pick<Database, "execute">,
  identity: Pick<Identity, "userId" | "sessionId">,
  learnerId: string,
  policyId: string,
): Promise<PrivateLearner>;
```

Predicate emits `public.has_current_learner_authority(actor,session,learner,policy)`
using bound Drizzle values/expressions, never user-interpolated alias strings.
Policy UUID originates in validated server capability, never client field. SQL
checks exact current session/account/ordinary role; active readiness learner;
matching policy ID/version/digest/source/current enabled pointer; authorized
admission; current nonrevoked required evidence; self requester=user_id and
College Support or requester=guardian exact authorized same-source link.
No admin/tutor bypass. Losing the reviewer's grant later does not retroactively
invalidate a properly committed admission; explicit policy/evidence/admission
revocation does. Review scope is evaluated anew for subsequent staff actions.

`readCurrentAuthorizedLearner` reads only the existing five-field DTO with that
predicate in the same statement, or throws generic404. It acquires no implicit
locks and never treats a prior read as a reusable authorization token. W6 should
compose the predicate into its final SQL checks/reads. Requester admission
projection is separate from active learner projection and cannot be fed to booking
selectors. Retain historic readAuthorizedLearner and demo predicate unchanged.

Root/W6 install this seam in readiness booking create/confirm/move/history,
family selectors/dashboard, private links/support and current mail recipients
as appropriate; tutor participant authority remains W6's exact assignment and
minimal learner check, not a family-role or admin bypass. This worker does not
edit those consumers. Root freezes actual signatures/file hashes before W6 import.

## Routes, continuation and UI

Proposed owned route trees: `src/app/(workspace)/learner-admission/{page.tsx,
new/page.tsx,[admissionId]/page.tsx}` and matching
`src/app/api/learner-admission/...`; admin equivalents under
`(workspace)/admin/learner-admission` and `api/admin/learner-admission`.
Facades call feature-owned services/handlers, not raw SQL. Do not add automatic
loading boundaries that hide no-JS private content. All private metadata is
generic/noindex; never learner labels in title/OpenGraph or public output.

GET new context requires verified active account, no parent/student role yet.
Server-selected disabled policy shows unavailable state and no child form. Enabled
synthetic policy clearly states fictional input/no actual age/consent review, shows
guardian or self intent and minimal display name, level, IANA zone. Self level is
College Support only and has no parent/guardian controls. There is no DOB, school,
address, child email/login, document, proof upload or free-text consent wording.

POST creates pending; requester list/detail shows only own admission status and
minimum submitted fields, safe policy version and a continuation link. Pending
copy says review is required and access is not authorized; no booking control or
success claim. Reviewer queue projects assigned request ID/mode/state/version/time
only, no learner name/level columns; detail requires current exact scope/MFA before
minimum intake fields/evidence. Human records evidence then submits explicit
authorize/reject/revoke; revocation has a consequence confirmation. Foreign/admin
unassigned/self requests all use the same unavailable screen. No response-time
promise or external notice is added.

The existing `selectionFromReturnPath` and `bookingSelectionHref` exclusively
allowlist tutorSlug/subjectSlug/level/displayTimezone/startAtUtc/endAtUtc. Preserve
this contract unchanged. Canonicalize optional public `next` once, bind it into
intake fingerprint and persist only that canonical public selection_path. It
contains no learner/evidence/private booking ID. On request detail refresh and
after approval, regenerate the return link through the same parser/helper; use
native navigation/document replacement as existing creation does. While pending,
allow browsing the original selection with a truthful advisory statement, never
reserve/extend a hold. W6/root selects the readiness booking composition; a demo
URL itself does not allow booking a readiness learner. Upon return revalidate
current admission authority and actual tutor/subject/level/time/DST availability;
old public selection has no booking guarantee. Malformed/external/private/duplicate
`next` is discarded, never echoed.

Own minimal `/learners` composition lists currently authorized demo and readiness
profiles in explicitly labelled source groups through their separate services.
Keep demo create CTA and `/learners/new` unchanged behavior; add the readiness
entry/selected-time detour only where capability allows it. Profile detail resolves
source server-side; readiness edits use the scoped function (name/zone), fixed
reviewed level; demo edit rules remain. Existing no-role account navigation entry
and admin navigation insertion are root shared hunks, never blanket role gating.
Public/auth generic forms/env stay W1/W3/root-owned.

Use current native controls, one primary action, navy/teal tokens, operative
page-title/body roles,44px targets, plain escaped text, explicit empty/unavailable/
pending/conflict/error states and first-invalid/result focus. No dashboards/KPIs,
design-system reset or new packages. Mutation forms follow existing POST/private
API/hydration-safe convention; no-JS can read status but cannot leak child fields
via GET. No browser storage for child/evidence/auth proof. Preserve private
document boundary and account-switch/bfcache full-reload semantics.

## Ordered implementation handoff and ownership

1. Receive a new implementation dispatch, inspect/import only the root-accepted
   W1 manifest, source bundle and explicit shared allocations. Do not copy live
   W1 source. Reconcile accepted auth/table/grant shape; preserve local demo tests.
2. Add narrow admission policy/input and schema/source constraints/functions/
   protections as reserved0023. Write unique migration forward/grant tests. Do not
   install dependencies or run generation/PG until implementation is dispatched.
3. Add policy-denied intake context, pending creation, exact scoped evidence/
   decision/revocation/current-authority API, safe projection/edit services, bound
   retry fingerprints and failure mappings. Provision synthetic fixtures solely
   through owned test helpers/local tooling with explicit no automatic grants.
4. Add complete requester/reviewer routes/forms, admission-list learner composition
   and saved public-time continuation. Root supplies small account/admin entries
   and integrates W6 consumer navigation. No booking mutation/private-review edit.
5. Perform separate read-only Review, then separate Verify with lease and isolated
   resources, targeted recovery/review/reruns if needed. Save source manifest,
   exact SQL/schema delta/inventory constants, report and ignored memory; send
   provider-v1 freeze to root. No claim of full real FAM/M4/M8 readiness.

Future permitted own-checkout areas per allocation: new
`features/learner-admission/*`, `schema/learner-admission.ts`, unique admission
tests; minimum `features/learners/*`/`schema/learners.ts` and `/learners` continuation;
unique admission route trees; schema index export; fixture/helper and default
test registration additions; runtime grants/protection inventory;0023 SQL/journal/
snapshot. Only blueprint/report were edited in the original architecture dispatch; the current implementation allocation is recorded below.

Final shared manifest must identify each exact file/hunk and accepted W1 baseline:

- `src/lib/db/schema/index.ts`: additive learner-admission export only.
- `schema/learners.ts`: source/triple-FK/protection metadata deltas only.
- `scripts/runtime-grants.ts`: new SELECT/explicit function EXECUTE only; retain
  accepted W1 auth/assurance rights and all existing grants.
- `scripts/staging-migrations/privileges.ts`: permitted function signatures and
  functions.rows.length/function count expectation; actual final totals depend
  on accepted W1+W5 inventory, not baseline24 plus a guessed number.
- `scripts/staging-migrations/protections.ts`: source/FK/state/trigger checks as
  needed, preserve the exact protection parser and all historical checks.
- `tests/unit/staging-migrations.test.ts` and existing integration inventory
  expectations: new chain/functions/triggers counts only with actual inventory.
- `drizzle/meta/_journal.json`: one index23 entry after W1 index22; schema delta
  plus own0023 snapshot; root regenerates cumulative later snapshots deliberately.
- `playwright.config.ts` and affected cross-browser config: additive unique spec
  registration in serial dependency chain; Vitest unique filenames already match
  `tests/unit/**/*.test.ts`, `tests/components/**/*.test.tsx`,
  `tests/integration/**/*.test.ts`. Do not replace include conventions.
- Shared synthetic fixture helpers only as necessary; use proposed
  `tests/support/learner-admission-fixtures.ts` to minimize conflicts, consume W1
  actual MFA provisioning helper rather than writing assurance receipts directly.
- Root account/admin/family navigation and W6 consumers: supplied minimal hunks,
  final installation owned by root. Root canonical contexts/decision/README/runbooks
  are recommendations in this plan, not this worker's present edits.

Known root integration follow-up: `scripts/local-backup-restore.ts` currently
rejects every learner source other than local_fixture. Root must deliberately
extend the **synthetic allowlist** to synthetic_readiness with admission provenance
and reviewed owned-restoration checks; never accept arbitrary/operational rows or
weaken the .test/target guard. W5 submits this requirement, not a peer/script edit
outside later explicit allocation. No heavy lease is needed for this architecture.

## Verification plan for downstream Verify — NOT RUN

Use actual `npm run check`, `npm run test:integration`, `npm run build`,
`npm run test:e2e`, affected `test:e2e:cross-browser` and root `test:restore`.
First inspect script side effects and test target identity. Later W5 isolation:
PG55905, app3095, browser3195, optional TLS56005/proxy3295; do not assume listeners
are free or borrow main55432/peer secrets. Root assigns heavy leases; no PG/browser/
build/setup/check executed in this planning task.

Required pure/component cases: strict unknown-field denial, version/digest/mode
validation, no child inputs or parsing under disabled policy, independent College
without guardian, safe public next canonicalization/refresh, all error/pending/
stale/focus/no-JS form states and no internal policy/evidence values in logs.

Required real PostgreSQL cases:

- Fresh0000–0023 and populated0021→0022→0023 preserve every historical SQL hash
  and all existing44-table values plus W1 data; exact schema/functions/triggers/
  grant options/PUBLIC/membership/parameter ACLs and effective function rights.
- No-role requester pending intake grants no role/link/active profile/booking
  authority; all direct readiness INSERT/UPDATE/link/role/history writes denied.
  Existing local_fixture function behavior/grants/limits/retries stay unchanged.
- Guardian authorization grants parent+active profile+same-source link+one event
  atomically; independent approved evidence grants student+own College profile,
  never parent/link. Unique self owner across sources; no fixture promotion.
- Forged owner/role/policy/learner/evidence IDs/reference replay denied; mismatched
  source/version/method/notice/subject or missing/revoked check denies approval.
  Global admin, wrong assignment, self reviewer, revoked capability/role/session/
  access/verification/MFA factor/epoch/receipt, stale assignment/revision denied.
- Real observed lock waits for requester/session/policy/admission/learner/assignment/
  evidence; commit revocation during each applicable wait and prove final denial.
  Use pg_stat_activity observed waits, not guessed sleeps. No nested pool deadlock.
- Same-key concurrent intake/decision/evidence replay creates one effect/event;
  changed fingerprint conflicts. Concurrent authorize versus reject/revoke has
  one consistent winner, stale loser; revoke after winning authorize removes
  current authority. Evidence revocation invalidates admission atomically.
- Inject event/role/link failure: no partial learner activation, link, role or
  receipt. Policy switch/disable prevents intake/approval; scoped reject/revoke
  remains available; historic immutable policy receipt does not change.
- W6 integrated post-wait create/confirm/move/read/meeting/notice tests consume
  exact current predicate and deny pending/revoked/foreign authority; an admin
  role never becomes a family or private-link bypass. No second learner model.

Required actual Playwright paths in normal discovery:

- Disabled admission has no child fields and POST rejects without parsing/storing
  input; synthetic no-role requester submits pending; assigned reviewer uses real
  W1 enrollment/challenge/TOTP/recovery path, records evidence then approves;
  parent now sees own authorized learner only. Revocation denies fresh detail/API
  and same-browser Back/account-switch/bootstrap/bfcache private remnants.
- Wrong parent/private URL, wrong/unassigned/self/password-only admin denials;
  forged/stale evidence/decision, policy-disabled approval, suspended session,
  pending/empty/conflict/network error/uncertain retry and field/result focus.
- Independent College Support with reviewed eligibility, no guardian controls;
  college/email without evidence stays pending. Original public selected time
  survives sign-in→admission→pending refresh→approval→return; stale slot shows
  current alternatives, no hold/automatic booking. Root combined W6 journey owns
  actual readiness booking/link progression.
- 320/390/1440 and applicable768/1024, keyboard/axe/44px targets/overflow, plain
  no-JS reads and safe POST fallback, reduced motion/forced colors. Actual Firefox/
  WebKit affected security/admission critical journeys under root matrix; hardware
  screen reader, physical devices and actual browser zoom separately disclosed.
- Public/auth/API/client/RSC/bootstrap/log/artifact scans contain no child/evidence
  ref/auth secret/meeting URL; safe synthetic captures only in0700/0600 ignored
  storage. An HTTP mock or screenshot alone does not establish authorization.

Each check requires command/environment/exit/source manifest/evidence and
PASS/FAIL/NOT RUN. Root independent review and combined source-bound verification
remain separate from builder same-agent review and isolated checks.

## Documentation, risks and recovery

Root updates PRD FAM/AUTH and architecture9.3 with readiness admission vs historic
demo and current authority; build-plan M4.4/M2.4/M8.10 scoped progress; UI context
only for conditional reviewed-level edit/denied intake states; operation guide and
README for policy defaults, assignment/evidence fixtures and current provenance.
Tracker records actual implementation/test evidence later, no whole milestone or
real legal gate promotion. No context/tracker edits occurred in the original architecture dispatch; current scoped tracker contributions record actual implementation and checks.

Risks: W1 source is not frozen; root R0/runtime selection and W6 consumers are not
yet accepted; existing raw UPDATE grants need source-conditional protection;
policy pointer changes can remove current access but cannot erase committed
obligations/history; opaque references are attestations, not screening evidence
verification. Local .test/roles/MFA/test success do not establish guardian consent.

Real activation gate: founders and qualified reviewers must approve actual entity/
markets, independent eligibility, minor/guardian proof, consent/privacy/retention
notices, child-login/supervision rules and named response owners; actual provider/
target acceptance and explicit pilot/release permission are also absent. Continue
synthetic design under existing delegation; this gate is not a routine request for
permission to implement the authorized software.

Rollback: disable new intake/current capability, preserve rows/decision history and
historic demo; use reviewed forward recovery, not destructive down migration or
silent reauthorization. Any owned restore rehearsal is separately scheduled; no
production/peer reset. No packages, env/cloud/main/peer source edits, commits,
merges, pushes or verification occurred here.

Blueprint ready.

## Current implementation dispatch refinement — 2026-10-12

This full build resumes under task_748dd18035ac / ctx_7f63930491fa, AUTHORIZED —
build-feature delegation. The earlier planning-only statements above are retained
historical scope; root's current dispatch allocates own0023 schema/journal/snapshot,
grants/protection inventory, normal test registration, minimum learner composition,
unique admission trees and additive account/admin navigation. Accepted119-file
provider aggregate0f0dd8511da6629e67b1252641c13131bbaa2337c6f26b84b69f903801f615ec
was verified before edits; subsequent root MFA fixture repair was separately hashed.

Root accepted a test-only full source mirror, with exactly the admissionContext
module substituted through the actual strict policy parser. It binds3095 while the
ordinary disabled application stays3195; no activation env flag or route guard
change. Mirrors retain sorted before/after hashes and explicit override diff.

Root independent review corrections preserve the domain contract: abort after ALL
writes if current authority is lost during a unique-key wait; SQL mutation revision
means immutable request-event receipt while detail returns current head. Evidence
revocation's automatic second decision event does not change receipt replay.
These are technical correctness choices, not actual guardian/legal policy approval.
Read-only full application review and executed final acceptance are recorded in
ignored report and tracker separately; no whole-wave or launch completion follows.

## Current implementation and scoped verification — final worker handoff

Authority remains AUTHORIZED — build-feature delegation. Same-agent final
read-only Review: plan alignment PASS, unintended-change audit PASS, recommendation
READY FOR VERIFICATION. Root independently accepted bridge-v2, prospective-v1
source and current keyset correction; root final combined acceptance is pending.
No real guardian/legal/staff/commercial evidence is asserted.

Current actual Verify: check-6 format/lint/types and1097/1097; build-3 production
build; owned-pg-final40/40 across four files (37 domain, fresh/populated proof,
111-record keyset traversal, deterministic real verify-email fixture regression);
Chromium browser-8 six cases; Firefox/WebKit cross-browser-3 twelve cases. Normal
command discovery includes all six admission cases and both extra-engine projects.
The retained full integration-3 passed687/687 before the later keyset/fixture
additions; it is not a claim of a current full689-case run. The revised fixture
separately passed115/115 across five actual provider/domain files.

Disabled composition and enabled test-owned mirror both use actual app/domain/DB
code; only context.ts is substituted, with hashes/diff retained. Browser coverage
includes320/390/1440, keyboard/axe/44px/overflow, no-JS POST/inert controls, real
provider verification/MFA, selected public slot preservation/stale revalidation,
denials/revocation/Back/public-auth bootstrap and real offline uncertainty. Current
390/1440 pending captures were inspected. Final local privacy scan covered206
asset/log/artifact text files against915 actual local secret/session/evidence
patterns including640 decrypted recovery codes, zero hits. Physical devices,
hardware screen readers, real browser zoom and live/hosted delivery were not checked.

Failures and fixes R0–R21 remain in the recovery note and private evidence. Root
owns combined W6 booking/private-link consumers, HTTPS provider integration,
restore readiness allowlist/proof and canonical documentation integration. Source
freeze/report: .local/learner-admission/final-source-v1.json and report.md.
No commit/merge/push/deploy or real-data/payment operation was performed.
