# M2.4 — Parent account onboarding

Status: **AUTHORIZED — build-feature delegation**, 2026-10-16.

## User outcome and authorization

The owner approved the recommendation to complete the five-step parent journey:
registration, linked child, tutor discovery, booking, and parent booking details.
This blueprint owns the first independent unit: a newly registered, verified
account can select Parent, explicitly enroll its own parent workspace, and enter
`/parent` without SQL fixture role assignment. Existing generic registration and
other account roles continue to work. Email verification remains mandatory.

The actual approval was “okay approve what. you recomend” following the source
cross-check and five recommendations. This authorizes that recommended work; it
does not claim separate inspection of this generated blueprint, consent-policy
approval, live booking terms, data deletion or a selected hosted target.

## Requirement mapping and baseline

- Primary build-plan item: **M2.4**, related M2.5/M2.9 and M5.4.
- PRD: **AUTH-01/02/03/05**, **OPS-03**; FAM-01 and BKG-01/03 remain separate
  dependent units with their existing safeguarding and operating gates.
- Repository `/Users/cob/learli`, branch
  `feature/staging-interface-cleanup-20261016`, HEAD `572cf4d` plus the reviewed,
  verified uncommitted Part A of
  `prompts/features/m8-03-staging-interface-cleanup.md` (36 status entries).
  Preserve that existing implementation; do not discard or repeat it.
- All eight canonical context documents and AGENTS.md were read in the current
  build workflow and remain governing. Reuse the established stack and design.

## Decisions and scope

1. Parent selection is onboarding intent, never an arbitrary trusted role field
   in Better Auth signup. Keep the provider's strict request allowlist intact.
2. Add an optional account-type choice to signup: Choose later / Parent or
   guardian. Default Choose later preserves other existing registration paths.
   Carry the parent setup destination through verification, sign-in and resend
   using the existing safe local return-path/callback validation.
3. The authenticated setup page performs a separate explicit POST. A GET,
   verification link or sign-in must never itself grant a role.
4. The only role this new operation can grant is **parent**, to the current
   active verified account. It grants no child relationship, tutor approval,
   admin capability or policy-dependent booking authority.
5. An account may hold multiple roles; preserve existing grants. Enrollment is
   retry-safe and produces one audit event only on the first successful grant.
6. Both local and accepted hosted account runtimes may use this account-scoped
   boundary, with exact current origin/ingress/membership and session checks.
   Do not relax the legacy local-only domain runtime or synthetic email guards.

Excluded from this independent unit: child or guardian-link creation, grade
schema, booking confirmation/hold policy, payments, enabling disabled readiness
factories, replacing all dashboards, external mail, database account cleanup,
provider migrations/deployment and live minor intake. The rest of the owner's
approved journey remains active work, not canceled or completed by this unit.

## Current implementation evidence

- `src/features/auth/auth-form.tsx`: shared signup has display name/email/password
  only; normal signup receives no roles, and the default return is `/account`.
- `src/lib/auth-handler.ts`: strict Better Auth POST allowlist rejects role/owner
  fields; keep it unchanged for the new intent.
- `src/features/tutors/service.ts` and `drizzle/0004_grant_tutor_role.sql`:
  established narrow non-admin self-enrollment pattern. Runtime has SELECT only
  on `user_roles`; never grant general INSERT/UPDATE/DELETE to implement Parent.
- `src/lib/permissions/access.ts`: current verified identity, active access,
  membership, trusted role reads and independent admin assurance.
- `src/lib/permissions/workspace.ts`: account pages support hosted runtime;
  legacy domain pages use a different local-only selector. Reuse the account
  loader for parent setup without broadening unrelated domains.
- `drizzle/meta/_journal.json`: canonical migrations through0031 (32 entries).
  Existing SQL/snapshots stay byte-identical; one additive0032 is proposed.

## Affected areas and implementation sequence

1. Proposed `src/features/parent-onboarding/` service, handler, intent helpers and
   accessible form; proposed private `/parent/onboarding` page and
   `/api/account/parent-onboarding` POST.
2. Add signup account-type intent and preserve the original safe tutor/slot
   return inside the onboarding continuation. Existing account can also enter
   parent setup through an account-settings link; avoid repeated enrollment UI
   for an account that already has the role.
3. Add reviewed migration0032 and corresponding Drizzle snapshot/journal:
   append `parent_role.self_granted` to the exact audit check, create a narrowly
   granted SECURITY DEFINER parent-enrollment function, and revoke PUBLIC execute.
   Keep all prior check values and grants; add no generic role mutation.
4. In the authoritative function, lock/recheck current user, active access and
   exact unexpired session before inserting the parent role. Insert the audit
   atomically only when the grant is new. Unknown/revoked/expired/unverified or
   inactive actors must produce no grant and no audit. Concurrent retries must
   preserve one role and one event. Reject unsupported transaction isolation if
   current-authority checks rely on READ COMMITTED.
5. Add only the function's EXECUTE grant to the existing restricted runtime
   policy and exact staging privilege verifier. Do not weaken protection checks;
   update latest-candidate expectations only where the new migration requires it.
6. Service derives user/session from the authenticated provider identity, accepts
   a strict empty body, and returns only a grant result plus fixed destination.
   Handler enforces exact account origin, bounded JSON and safe 4xx/503 responses.
   HTTP and page reads do not expose another account's identity or state.
7. Setup form has pending/error/retry states, clears stale identity through
   ordinary document replacement on success, and navigates to the original safe
   continuation or `/parent`. Preserve auth/MFA recovery and no-JS mutation safety.

## Invariants and failures

- Email verification proves address control, not adulthood/guardian authority.
- Selecting Parent never creates a learner or authorizes access to one.
- Parent A cannot acquire Parent B's role, learner links or records through a
  submitted identifier; arbitrary role fields are rejected.
- Existing roles, session/cookie, MFA, child privacy and booking constraints stay.
- Grant and audit commit together; failure/retry does not create duplicate events.
- No live notifications, real learner records, resets or remote database writes
  are part of verification. Preserve the owner's running preview.

## Planned verification (NOT RUN during Architect)

- Focused intent/callback and component tests, retaining generic signup behavior.
- Actual isolated PostgreSQL tests using the restricted runtime role: verified
  self grant, existing role, multi-role, current session, unverified/suspended/
  revoked/foreign denial, forged payload, concurrent retries, atomic rollback,
  one audit event and inability to mutate roles directly or grant admin.
- Fresh and populated0031→0032 migration/schema/data/history/grant preservation;
  exact staging protection/privilege checks. Inspect existing migration runners
  before use; tests remain on owned loopback databases only.
- Browser acceptance: select Parent during UI signup → captured verification →
  UI sign-in → explicit parent enrollment → `/parent`, without direct test SQL
  granting the tested Parent role. Assert provider user/role/audit state and no
  automatic learner/link creation. Include existing-account entry, safe tutor
  continuation, forged return, generic signup, failure and retry cases.
- `npm run check`, test-environment production build, affected auth/hosted
  account/security/browser checks and desktop/mobile accessibility.
- Do not claim the whole five-step parent journey passed until its later units
  and target-specific acceptance actually execute successfully.

## Documentation, review and rollback

Update architecture/PRD to distinguish safe parent workspace self-enrollment
from guardian authorization; update UI/build-plan and progress only for actual
facts. Record owner scope in the staging cleanup blueprint. Use same-agent
read-only Review followed by separate Verify, with explicit evidence and limits.
Retain local ignored memory; do not commit/push/merge automatically.

Rollback the application change through its scoped diff. Do not remove existing
parent roles or audit events during rollback; additive schema is compatible with
the old application. Any provider operation needs an exact isolated target and
applicable recovery evidence before execution.

## Remaining decisions for dependent units

The owner has been asked whether this first version remains private staging
with fictional data, manual admin approval of guardian links/bookings and no
payments, or is intended for real families. Await that answer before enabling
dependent intake/booking behavior. Exact booking duration/hold/confirmation
parameters, consent/screening requirements, assigned reviewer authority and
Railway/Neon staging targets still require concrete supported decisions.

## Approval gate

This independent M2.4 parent enrollment unit is **AUTHORIZED — build-feature
delegation** by the owner approval above. No unresolved policy is needed to
grant only a non-admin workspace role without learner access. Dependent child,
booking, target cleanup and hosting work remain gated; do not report them done.

## Owner-approved acceptance extension — Steps 5–9

On 2026-10-16 the owner supplied the Parent dashboard → Tutor dashboard → private
meeting → manual outcome → Parent history checklist and then explicitly approved
the recommended adjustments: “ok appporove hte recommended checklist”. This
approves those acceptance criteria, not a claim that the corresponding behavior
has already shipped or passed manual QA.

The coordinator will save the approved manual checks at
`docs/qa/parent-tutor-session-checklist.md`, link them from the PRD/build plan,
and record their actual NOT RUN status. That documentation unit is authorized
within the ongoing build-feature delegation; it changes no application behavior.

- Compare the same booking reference, learner, tutor, subject, schedule and
  actual status across Parent/Tutor dashboards and details. Compare the same UTC
  instant even when account-local clock times differ.
- Tutor saves an allowed private meeting link for the booking before participant
  join checks. Test actual external connection manually, separately from URL
  validation/opening. The guardian-managed child uses the Parent account.
- Include unrelated-parent and unassigned-tutor denials on both detail and link.
- Retain conditional tutor acceptance: no ordinary acceptance action currently
  exists, so this is not approval to invent one.
- Completion remains manual, audited and after the scheduled end, under an
  approved actor policy. Ending a call does not itself update Learli. This
  approval does not choose Tutor versus Admin as the live completion actor; the
  existing isolated workflow uses an assigned MFA-protected admin.
- History must show the persisted final outcome, distinguishing completed,
  cancelled, expired and no-show records without inferring attendance.

The documentation-only update requires scoped Markdown/diff/link checks and
preservation of the previously verified program state, not a new application
test run. Remaining real-family/staging, guardian, booking and provider-target
decisions above stay open. Payment and deployment scope is unchanged.

## Subsequent owner decision — completion actor

The owner's “yes ;approve ur recommmendation” on 2026-10-16 resolves the actor
question recorded above: assigned tutor, after the scheduled end, with an audit
record. The bounded implementation blueprint is
`prompts/features/m5-05-assigned-tutor-completion.md`. This supersedes only the
actor uncertainty. The remaining guardian/booking and staging-target decisions
and the broader journey are still pending; no provider activation is inferred.
