# M8.3 — Ordinary local operational workflow

**Status: AUTHORIZED — build-feature delegation.** Architecture planning only;
implementation, independent Review and executed Verify belong to the coordinator's
separate stages. This document does not claim those stages have passed.

## Authority and observed baseline

- Owner request, 2026-10-18: “why is it on private just put it all in the local
  main no testing or simulation I just want the real one flow no just use the
  local and were just gonna clean up the data after”. This supersedes the
  separately owned, finite fictional manual preview as the requested operating
  location. It authorizes ordinary local functionality and integration into local
  main; it does not authorize push, deployment, production changes or data cleanup.
- Repository: `/Users/cob/learli`. Observed branch:
  `feature/desktop-navbar-reference-20261017`; observed HEAD:
  `616e8c734acebec0f7b51c5f96fb182dc4001d93`. Coordinator reports local main has
  the same HEAD. The substantial existing dirty/untracked auth, navbar, Parent,
  private-copy, migration0034 and documentation changes are prior owned work:
  preserve and integrate them, never reset or replace them wholesale.
- Primary work package: existing **M8.3** environment separation/local operating
  composition; related **M8.9**, **M2.1–M2.9**, **M3.1–M3.6**, **M4.1–M4.11**,
  **M5.1–M5.9** software subsets. No new milestone is invented or checked complete.
- Requirements: **AUTH-01–05, TUT-01–06, FAM-01–03, MATCH-01–03, BKG-01–07,
  MEET-01–03, OPS-01–05, ADM-01–04, NFR-01–06/09/11/12**. Public review
  publication and **PAY-01–03** remain outside this slice.
- Read before implementation: `AGENTS.md`, then all eight canonical files in its
  prescribed order (`context/project-overview.md`, `architecture.md`,
  `ui-context.md`, `code-standards.md`, `ai-workflow-rules.md`,
  `progress-tracker.md`, `prd.md`, `build-plan.md`), this blueprint and the dated
  decisions for the existing Parent onboarding, College onboarding, assigned-Tutor
  completion, Parent Profile/Children and manual preview.

## What we are building

One ordinary application in the primary checkout and local main, reached through
its regular local URL. A person registers with a normal valid email, verifies
through the local mailbox, completes the appropriate existing Parent, College
Student or Tutor onboarding, and uses persisted reviewed learner/tutor records
to request, confirm, join, change and complete the same booking across roles.
Assigned, MFA-verified administrators claim and review work in the application.
There is no finite account allowlist, private preview packet, daily access expiry,
per-booking owner command, seeded outcome or simulation path in this operating
experience. Existing records and the separate private preview remain preserved.

## Language and decisions

- **Local main** means the primary `/Users/cob/learli` checkout, its local `main`
  branch and loopback application. It does not mean production or a public pilot.
- **Real flow** means actual Better Auth, persisted domain records, current
  authorization, atomic PostgreSQL mutations and user-operated review/actions.
  It does not establish delivered email, video attendance, commercial approval,
  legal guardian proof or a completed real-user launch review.
- **No testing or simulation** describes the requested product/runtime. Keep
  engineering verification on the separate owned test database; never run fixture
  setup, global browser setup or destructive suites against the operating database.
- **Cleanup later** means preserve every existing account, record, event, secret
  file, database and unrelated source change now. No reset, truncate, delete,
  fixture reseed, source relabel or timestamp repair is authorized.
- The current no-money local timing/actor choices continue: 60-minute elapsed
  lessons, 30-minute starts, 60-minute notice, 14-day horizon, ten-minute
  provisional hold, 60-minute cancellation/move cutoffs, assigned current-MFA
  Admin confirmation, assigned Tutor completion only after saved scheduled end.
  This is the narrow coordinator interpretation of “same flow” for local use,
  recorded explicitly rather than invented customer terms. Payments remain off.
- Minimal guardian-managed requests remain usable locally and pending until
  actual assigned review; independent College Support remains a distinct reviewed
  self-managed path. No automatic consent, self-granted learner authority,
  independent minor login or fabricated screening/evidence is introduced.

## Current source evidence

`createLocalAuth` and local mail currently require `.test`. The private composition
requires `APP_ENV=test`, a finite packet and `learli_test`; the Neon development
adapter deliberately retains synthetic-only auth. Admission, screening and
booking policy validators, Drizzle CHECKs, SQL functions and many final reads
only admit `synthetic_readiness`/`synthetic_test`. There is no existing
`reviewed_live` implementation to switch on. `booking_workflow_policy_current`
and `has_booking_workflow_task` last changed in0033; school-grade admission
creation is0034. Merely removing a notice, bypassing the parser, broadening a
`.test` matcher globally or extending the private packet would preserve the wrong
record meaning and miss database authority.

## Scope and invariants

Included: ordinary local account lifecycle/settings, reviewed family and Tutor
onboarding, truthful directory/matching/availability, durable lifecycle booking,
participant-private meeting links, role dashboards/history, basic scoped local
support and account restrictions already exposed by those paths, and in-app
review claim/assignment. Preserve existing responsive UI and recent auth/Parent
work; change copy only where mode/provenance makes it necessary.

Excluded: public/hosted registration activation, production or Neon writes,
payments/prices/trials/refunds, legal market/consent policy, live Resend delivery,
automatic meeting creation/attendance, public review publication, a complete
staffed safeguarding operation, LMS/uploads/messages, dependency upgrades and
unrelated redesign. Missing public-launch policies do not block ordinary local
pending requests; they remain real-launch gates.

Authentication, verification, active account, trusted role, exact ownership/link,
current reviewed policy, assigned staff capability and fresh MFA remain server
and database facts. Admin is not a universal private-record bypass. No request
body, email domain, hidden control or mode label confers these capabilities.
Maintain READ COMMITTED guards, deterministic locks, post-wait rechecks,
idempotency, immutable history/notices and the shared exclusion constraint.

## Runtime and data composition

1. Use the primary checkout's already owned PostgreSQL on `127.0.0.1:55432`,
   **`learli_dev`**, restricted `learli_app` runtime role, and one consistent
   loopback origin (retain the user's regular local origin/port3000). Keep the
   owned **`learli_test`** and its automated runners separate. Do not repurpose
   the manual checkout's55433 database or copy its finite accounts/bookings.
2. Privately preserve current root `.env.local`/Neon development configuration
   before selecting the owned local connection. Reuse existing owned credentials
   without printing values; do not run a broad setup/seed command. Runtime gets
   no owner URL; owner migration/bootstrap credentials remain in separate ignored
   operator configuration. No cloud resources change.
3. Add a normal local-operating composition distinct from `getPrivateWorkflow`.
   Proposed area: `src/features/local-workflow/`. Its runtime admission requires
   explicit server selection, development + local auth/database, exact loopback
   origin, owned `learli_dev`/restricted role and actual enabled local policy
   heads installed by trusted owner preparation. An environment flag alone
   cannot install policy or staff authority. Reject conflicting private/hosted/
   Neon configuration; malformed operational selection must not fall back to a
   simulation. Existing test/private defaults stay unchanged.
   Bind the auth singleton to the selected local operating/email-policy identity
   and reject in-process changes instead of retaining a cached synthetic factory.
   Auth pages and provider/email/domain checks consume this same validated
   selector; a loose UI environment boolean cannot select ordinary authority.
4. Introduce additive **`local_operation`** record provenance and separately
   versioned local policy receipts (proposed names `local-admission-v1`,
   `local-screening-v1`, `local-booking-v1`). Never call it `reviewed_live`, reuse
   synthetic receipts or change old record sources. Source/authority derive from
   trusted current policy receipts inside SQL, never caller-controlled strings.
5. Operating policies/staff grants are explicitly enabled/revocable, without the
   former fixed24h packet expiry. Represent local non-expiry explicitly (nullable
   `valid_until` permitted only for local policy/staff branches), not by a magic
   distant date or an infinite timestamp. Keep session/token/MFA expiries,
   provisional deadlines, explicit individual-check expiry and revocation.
6. Directory, matching, available slots, booking creation and role reads select
   the same current local source. Preserve every old synthetic/fixture row as
   history with its original truthful label; do not surface fictitious inventory
   as ordinary approved tutors. Old active intervals still participate in shared
   conflict prevention where they share a Tutor. Empty ordinary inventory is
   honest until a genuinely submitted Tutor completes actual local review.

## Account and local mailbox behavior

For this admitted ordinary local composition only, allow normal valid email
addresses through installed Better Auth and account-email proof flows. Preserve
provider verification/reset, throttling, non-enumerating responses, CSRF/origin,
password rules, intent-only signup and current-session checks. `.test` remains
required in the existing synthetic branches. Change provider error copy to be
neutral and mode-correct; do not weaken name/email validation.

Extend the existing private filesystem mailbox to accept normal addresses only
for the admitted local composition, exact configured loopback link origin and owner-private
0700/0600 files. Verification still consumes the actual provider token. Describe
the local verification link accurately; never say an email was delivered. Keep
the mailbox outside served routes, serialized page props, browser storage, logs
and committed files. External Resend remains disabled. Existing `mail:open`
can expose the local mailbox to its owner; no HTTP token-list endpoint is added.

Audit the independent domain restrictions in `src/lib/auth-handler.ts`, account
email schemas/service/UI, auth page props and synthetic session resolution, not
only `createLocalAuth`. Preserve `accountAdapter`'s atomic user/credential/access/
audit transaction. Ordinary mail dispatch uses the existing request-local
`mailAttempt` failure boundary (currently selected only for hosted handling),
including account-email changes, so failed capture cannot become false successful
verification guidance. Preserve generic duplicate/account-enumeration responses.

## Schema, SQL and trusted review assignment

Use reviewed forward migration(s) after current0034 (proposed first0035), update
Drizzle schema, cumulative snapshot/journal and exact grant/protection inventories.
Never edit historical SQL. Extend existing tables/functions and the shared engine;
do not clone a parallel booking or learner system.

- Extend source-qualified CHECKs and immutable receipt guards for learners,
  guardian links, admission policy/state/reviewers/assignments/evidence/events,
  Tutor screening policies/cases/staff/assignments/checks/decisions, booking
  policies/head/records/grants/receipts/notices and basic support/account-control
  records required by the ordinary routes. Preserve the complete old allowed
  branch, receipt digests and restrictions. Add exact new local-only constraints.
- Audit latest definitions, not an obsolete copied function: admission identity,
  policy/current learner/reviewer authority, grade-aware creation/update0034,
  decide admission0029, screening current/authority/request/row validation0024,
  decide0029/check0030, booking create/change/expiry/assert/integrity0025 and
  current/task0033. Extend all final projection, receipt, after-lock and notice
  checks consistently. Replace a `.test` test only within a proven local policy
  branch; old synthetic actors must still be `.test`.
- Add a small trusted local staff capability registry if needed, scoped to
  explicitly owner-authorized IDs and functions (admission review, screening,
  booking confirmation, basic support/account handling). Owner preparation may
  grant the first exact already-registered, verified, active account Admin and
  these capabilities, with an audit event. Never grant the first signup Admin,
  accept an Admin signup choice or trust an email allowlist. No fictional users,
  evidence, profiles, authorization decisions or bookings are generated.
- Provide MFA-protected minimal **Unassigned reviews / Claim review** actions in
  the ordinary Admin workspace. The queue exposes only type, opaque request ID,
  safe coordination label and submission time. A current specifically capable
  Admin may claim one exact unassigned local request, excluding their own learner
  request/Tutor/account and inappropriate participant conflict. The claim is
  atomic, idempotent and audited; competing claims have one winner. Only after
  assignment does existing exact-record detail/evidence/review access apply.
  Routine creation and review require no owner terminal command. No capable
  reviewer yields a truthful pending state, not implicit authorization.
- Claiming installs only the exact existing-style assignment/action grant from
  current trusted local staff capability. It never records a passed check,
  confirms a booking, authorizes a guardian or revives revoked staff/grants.
  Current MFA and assignment are rechecked after locks and at decision/receipt.
  Reassignment uses an explicit similarly guarded action; never overwrite a
  foreign assignment opportunistically. Unassigned booking metadata remains
  minimal; Admin never obtains private meeting access.
- Existing source-immutable PKs collide across modes (`tutor_screening_cases`
  per Tutor; `support_reviewers` and restriction targets per user; self learner
  uniqueness across sources). Preserve them and refuse incompatible reuse with
  a safe diagnostic; do not upsert/relabel fixture identities/records. A fresh
  normally registered operational owner/Tutor is the simplest collision-free
  setup. Any structural PK expansion needs separate explicit design, not a
  silent migration shortcut.
- Guardian and independent admission remain pending until the assigned Admin
  records the actual local review references and explicitly decides. Local
  review is operational authorization, not invented legal consent/screening.
  Required evidence is never manufactured by bootstrap/startup/claim. Grade1–12
  remains optional private guardian metadata; College Support is retained.
- Basic local support and exact scoped restrictions use ordinary source and
  neutral reasons, preserving assigned-access/audit/minimum projection. Do not
  activate the synthetic safeguarding policy as real operations. The current
  full response model requires two distinct responsible/escalation owners;
  without those approved staff it remains disabled, with truthful basic support.
- Extend the shared active interval predicate/exclusion coverage to local
  provisional and confirmed states. Confirmed blocks until terminal and survives
  original hold expiry/restart. Never mutate dates to fake completion. Keep
  replacement-chain, private-link retirement and logical idempotency behavior.

## Ordered implementation handoff

1. Preserve dirty source/configuration and database recovery material; record
   exact target identities/counts privately. Switch/integrate into local main
   under the owner's explicit request without losing unrelated changes. Do not
   push. Keep both existing databases and manual preview recoverable.
   Existing `local-backup-restore.ts` is deliberately synthetic/test-only; do not
   weaken its `.test`/source checks to back up ordinary records. Use a separate
   private exact-owned-target PostgreSQL backup/preservation operation, retaining
   normal addresses and all existing records only in owner-private artifacts.
2. Add local source/policy types and forward SQL/constraints with least-privilege
   runtime functions, current-policy/authority helpers and exact grant inventory.
   Keep old branches compatible. Factor shared rules rather than duplicate an
   engine or perform repository-wide string replacement.
3. Implement validated normal local composition and the auth/local-mail branch.
   Reconcile admission/screening/booking factory seams and every consuming read,
   public availability, blocking predicate, meeting link and committed notice
   projection. A selected operating mode cannot silently use legacy reservation.
4. Implement trusted one-time staff/policy preparation and in-app exact review
   claim/assignment. Reuse actual evidence and decision forms, MFA and auditing.
   Local policy setup is separate from owner account selection; registration is
   available before Admin bootstrap. Explain the single owner setup concretely.
5. Wire normal onboarding, Parent Profile/Children, College/Tutor and Admin paths
   to this composition. Keep existing brand/design. Ordinary statuses read
   Provisional booking, Confirmed, Completed, Cancelled and Rescheduled; local
   mailbox/payment availability is stated where relevant, with no private
   staging/test/simulation banner. Historical provenance stays honest.
6. Apply only reviewed additive migration(s) to the authorized owned local dev
   target after private backup; no seed/reset. Start the primary normal local
   app and leave one clear URL for the user. Preserve the old private target
   until the coordinator can stop its owned server without deleting its data.
7. Separate Review/Verify stages collect actual current evidence and repair only
   scoped defects. Update governing context and factual progress/handoff. Commit
   and integrate local main as authorized; no push/deploy/cleanup.

## Verification plan for the separate verifier — DO NOT EXECUTE in Architect

- Existing scripts: `npm run check`, `npm run test:integration`, `npm run build`;
  actual focused Playwright commands use the repository's registered configs.
  Keep unchanged baseline evidence distinct from fresh affected checks.
- New owned-test database coverage: normal-email provider signup/local capture/
  verification/reset/email-change; synthetic-domain rejection remains in old
  modes; wrong target/environment/private packet refusal; untrusted bootstrap,
  unverified account and forged role/claim/source/receipt denial.
- Actual PostgreSQL adverse coverage: migration from populated0034 with every
  preexisting value preserved; SQL direct/runtime writes denied; cross-source
  policy/learner/Tutor/booking mismatch; revocation/MFA/session changes while
  blocked; concurrent exact claims/idempotent retry; self-review denial; fresh
  normal email admission/screening/booking; overlap concurrency and current
  beneficiary checks; confirmed original-deadline survival; early completion
  refusal, post-end assigned Tutor completion, replacement/link retirement,
  minimum support scope and mail failure independence.
- Normal-build browser journeys on the separate owned test DB exercise ordinary
  operation without private packet, `.test` signup requirement or source-mirror
  factory overrides: Parent→pending child→Admin claim/review→Tutor approval/
  hours→same booking Admin confirmation→Parent/Tutor/private link/history;
  independent College learner; unrelated actor denials; settings and support.
  Inspect phone/desktop, keyboard and current pending/empty/failure UI.
- Operating database acceptance is non-destructive and uses only actual owner
  workflow if needed, never test fixture runners or invented accounts/outcomes.
  Observe process/restart persistence without rewriting dates. Do not wait for a
  fresh one-hour lesson merely to fabricate a completion claim; test-clock and
  historical evidence belong solely to isolated engineering tests.
- Privacy: no mailbox tokens, normal email addresses, credentials, meeting links
  or owner URLs in client/static/trace/Git output; runtime lacks owner privileges.
  Check precise schema/grant inventory and local backup/rollback materials.
- **Verification status: NOT RUN — architecture planning only.** Report exact
  executed results and any unrun scope; no production/email/video/launch claims.

## Acceptance and rollback

### Exact account support grants

Account support is not an exclusive pending review assignment. Preserve the
existing `(staff_user_id,target_user_id)` grant model: multiple explicitly capable
Admins may each claim support for the same exact non-admin account. Each grant
is independently current/revocable and audited; it exposes only the existing
account-control projection, not learner/meeting records. The unassigned review
queue has no all-account census. Admission, screening, booking and support case
assignments remain exclusive, with one winner for competing claims. This narrow
existing-domain distinction resolves the general claim wording above; it is not
a universal Admin access exception.

The ordinary root app accepts normal valid-email registration, actual captured
verification and persisted reviewed role workflows with the same record across
authorized views. A normal booking request reaches an in-app claim/review and
explicit confirmation; it survives hold expiry once confirmed. No finite packet,
daily policy expiry, test checkbox, manual dispatcher or simulation path is
required. Current permission, safe child handling, MFA, concurrency, date/time and
private-meeting boundaries remain. All prior source/data is preserved.

Rollback stops the newly owned app and restores prior private runtime selection;
disable local policy heads/staff if necessary. Keep forward schema and all new
records/events; no down migration or data deletion. Restore a database only with
a separately approved operation if actual data corruption is established.

## Context updates and remaining gates

Implementation must record the Oct18 supersession narrowly in architecture, PRD,
build plan and UI context, plus a dated decision and local operating runbook.
Document local-only timing rules, actual mailbox, one-time trusted staff setup,
in-app claim/review, new provenance, root URL/target and preservation/rollback.
Progress tracker records actual stage/check evidence and remaining work only.
Do not check complete M2–M5/M8 milestones or claim policies/provider acceptance.

No unresolved material decision blocks this local software slice. Owner setup
needs an exact registered verified Admin identity; missing identity keeps review
work pending and is never guessed from “first user”. Public/real-minor launch,
guardian/legal proof thresholds, customer terms, staffed safeguarding, delivered
Resend, hosted deployment, payments, public review policy and later cleanup retain
their separate gates. No such future gate authorizes a fixture relabel or data
destruction now.

## Execution authority

**AUTHORIZED — build-feature delegation**,2026-10-18. The owner authorized the
requested ordinary local flow and local-main integration, with the coordinator's
narrow local-only timing interpretation above. This is not separate human
blueprint approval, production authorization or a statement of verification.

**Blueprint ready.** Return to the coordinator for separate implementation,
Review, verification and factual handoff.
