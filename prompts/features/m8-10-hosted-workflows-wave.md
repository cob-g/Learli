# Learli eight-area hosted readiness wave

Date: 2026-10-12. Primary owning package: **M8.10**, coordinated with
M2.1–M2.9, M3.3, M4.4–M4.11, M5.1–M5.10, M8.3–M8.9.
Status: **AUTHORIZED — build-feature delegation** for software preparation,
isolated synthetic local execution, scoped repair, and review/verification.
Actual authority: the user approved proceeding with the eight named areas under
the root coordinator, GPT-6.1 Sol High builders using `$build-feature`, and
Playwright coverage for all software flows. This is not separate human blueprint
approval, approval of operating policy, or authority for this planning worker to
implement. This planning task returns control to root.

Repository: `/Users/cob/learli`; observed branch `main`; inspected HEAD
`2fa0294c5e6cad895754b3c10a703a6c6f6ef00a`. Proposed integration worktree name:
`m8-hosted-workflows-integration`; proposed worker names are below. No branch,
worktree, test, build, database, provider, commit, merge, push, or deployment was
performed by the architect.

## Outcome and boundary

Prepare the missing software for secure hosted accounts, database access and
transactional delivery; add policy-enforced onboarding, booking lifecycle,
publication and screening paths that can be exercised completely with fictional
accounts locally. Preserve the already working local demonstration. Separate
software acceptance, real-provider acceptance, policy approval and real-user
activation in every report. Finishing a bounded child does not clear the whole
corresponding PRD requirement or M8.

The new wave does **not** authorize production schema/data operations, any new
cloud operation, external email, real participants, payments, Railway deployment,
credential mixing, commit/push/merge, or global agent settings changes. Payments
have no task, schema, manual-paid switch, or implied off-platform approval.
Keep Next.js + Drizzle/node-postgres + Better Auth + Neon + Resend + Railway.
No uploads, LMS, conferencing integrations, messaging, new service, Redis or
always-on worker. Existing per-booking private link validation remains.

Required reading for every builder: AGENTS.md, ORCHESTRATION-LESSONS.md and,
in order, context/project-overview.md, architecture.md, ui-context.md,
code-standards.md, ai-workflow-rules.md, progress-tracker.md, prd.md,
build-plan.md; applicable decisions; this parent blueprint and its frozen
provider handoffs. Use repository-source skills in Orchestrated mode.

## Baseline reality: do not rebuild existing capabilities

The latest verified local completion is in HEAD. Historical tracker paragraphs
about earlier pending merges are superseded. Inspection establishes these code
facts; it does not rerun their previous verification.

| Area                      | Actual implementation                                                                                                                                                                                                                                                                                                                                                                                  | Exact remaining software gap                                                                                                                                                                                                                                               | Trace                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| W1 Admin MFA/recovery     | `auth-factory.ts` enables only emailOTP for email changes; generated `schema/auth.ts` has no two-factor fields/table. `requireRole` checks verified active identity and role. Account sessions, password/reset and current/new email proof controls exist.                                                                                                                                             | Provider TOTP enrollment/challenge/recovery; mandatory admin assurance for existing and new sessions, freshly rechecked privileged operations; controlled rotation/disable and lockout. No password-only admin escape.                                                     | AUTH-02/03/04, ADM-01/03/04, NFR-05; M2.3/5/7/9, M5.6, M8.8                  |
| W2 Hosted DB runtime      | `createDatabase` parses only loopback `learli_dev/test`. Separate `staging-config.ts` and `openStagingConnection` validate exact staging target, TLS, role and session safety for operator callbacks; migration tooling checks journal/protections/exact effective grants.                                                                                                                             | A validated Pool/Drizzle runtime usable by application and Better Auth without circumventing validation on reused connections or changing transaction semantics. Wire it separately from unchanged local parser.                                                           | NFR-06/11, AUTH-03, BKG-02; M2.1/2, M8.3/4/8                                 |
| W3 Hosted auth            | Env accepts `AUTH_MODE=disabled/local`; `getAuthRuntime` calls only `createLocalAuth`. Local registration, verification/reset, throttles, sessions, account change proofs, safe return paths and document privacy exist. `sameLocalOrigin` and trusted origins bind loopback; IP header is overwritten to loopback.                                                                                    | Explicit hosted-synthetic HTTPS configuration/factory, safe reverse-proxy origin/client identity handling, secure cookies and mail callbacks, without making local demo routes remotely accessible or allowing real onboarding.                                            | AUTH-01–05, NFR-05/11; M2.3–9, M8.3/8/9                                      |
| W4 Resend                 | Resend 6.32.1 is installed; auth callbacks call `captureLocalMail`. Creation and lifecycle notice queues/recipient checks/drain exist; manual drain publishes local HTML under local-only Pool guards.                                                                                                                                                                                                 | Pinned SDK transport, account templates/callback delivery, committed-event provider send/ack/retry handling, truthful accepted/uncertain states and immutable idempotent payloads. Existing local capture is not real email delivery.                                      | OPS-04, BR-12, NFR-09; M2.3, M5.7/8, M8.5/6                                  |
| W5 Onboarding/guardian    | `/learners/new`, validated create/list/edit, selected-booking continuation and narrow `create_local_learner` exist. SQL automatically grants creator's synthetic guardian link; learner/link source CHECKs allow only `local_fixture`; student profile is self/College Support.                                                                                                                        | Distinguish an unverified guardian request from authorized representation; current policy version/evidence/reviewer decisions, revocation, independent eligibility, safe role onboarding. Existing local self-service creation is not real guardian proof.                 | FAM-01/02/04, AUTH-03, BR-03/04/16; M2.4/5, M4.4, M6 D-01/09/10/12           |
| W6 Booking lifecycle      | Atomic create/idempotency, real PG exclusion, DST slots, private detail/dashboards, immutable replacement chain, cancellation/reschedule and notices exist. Runtime cancels/moves only synthetic records. `demo_confirmed/completed` are owner-only historical fixtures; no no-show. Every demo live row retains TTL.                                                                                  | Separate policy-governed confirmation and administrative outcome path, bounded provisional expiry, confirmed non-TTL behavior, actor/cutoff controls, no-show/dispute record; propagate real-shaped states through busy reads/detail/links/notices.                        | BKG-01–07, MEET-01/02/03, NFR-03/04; M4.5–11, M5.1–5/8, M6 D-06/07/13        |
| W7 Public reviews         | Private rating/comment submission, immutable one-per-logical-booking, exact moderator capability/grant, pending/local decisions/reconsideration exist. Submission requires current ended `demo_completed` head; no public projection.                                                                                                                                                                  | Explicit publish/withdraw state and privacy-safe published projection/aggregate using only new eligible records; real-shaped administrative completion authority, publication/moderation policy and current visibility. Never publish existing private or fixture reviews. | OPS-06, PUB-04, BR-13/14, NFR-05; M5.10, M3.4/7/8, M6 D-14                   |
| W8 Screening/safeguarding | Tutor apply/profile/review transitions and audit exist. `reviewTutorApplication` currently trusts an active verified admin role and expected profile status, without screening evidence or exact assigned reviewer authority/post-wait assurance. Support case creation, exact reviewer assignments, dispatch/reassignment/escalation, scoped account restrictions exist, all synthetic/fixture gated. | Screening evidence/version and exact assigned reviewer controls; approval only after required checks; real-shaped safeguarding response ownership/escalation and permission provisioning. Assignment alone is not a staffed response process.                              | TUT-01, ADM-01/03/04, OPS-05, BR-01/16; M3.3, M5.6/9, M6 D-08/09/10, M8.7/10 |

Also preserve `scripts/with-test-env.mjs`: it currently requires test/local and
must never become a generic hosted-target test runner. `deployment:preflight`
currently reports hosted readiness blocked, without network probes. Updating its
precise capability report is root work after acceptance, not permission to deploy.

## Baseline integration without committing the Neon diff

Neon setup is now settled. Root reports its independent no-op receipt check;
`.local/neon-setup/report.md` and `reviewed-source-manifest.json` preserve that
operational task. It linked existing `withered-grass-51575984` / production
`br-bitter-hat-az6vm3mg`, PostgreSQL 18, and deployed exact `defineConfig({})`:
**zero resource changes**. That is cloud configuration, not application runtime,
Drizzle migration or runtime role provisioning. Never infer permission from `.neon`.

1. Preserve main untouched. Root records current Git dirty/untracked inventory
   and hashes against the Neon frozen manifest, including its existing tracker
   hunk, before starting integration. No stash/reset/commit needed.
2. Source workers start from the committed `2fa0294` baseline in Orca-owned
   isolated worktrees. They do not copy main env, `.neon`, global MCP credentials,
   receipts, database data or private user settings. Generate own local secrets.
3. Root imports the accepted bounded Neon source diff once into its integration
   checkout, with exact hashes/source provenance: pinned `@neon/config`1.8.6 and
   `@neon/env`1.5.3, lockfile, empty neon.ts, ignore/skills/doc additions as recorded
   in that manifest. Preserve third-party skill paths separately from canonical
   skills symlinks. Do not rerun CLI login/link/deploy/MCP setup or regenerate its
   lockfile gratuitously. Root owns resolving dependency requests thereafter.
4. Domain workers submit frozen source bundles/patches, not commits. Root imports
   only accepted files, identifies every shared hunk separately and maintains the
   cumulative candidate manifest. Starting at HEAD alone is not dirty-source proof.
5. No commit/main merge/remote push occurs under this wave. Root can finish a
   reviewable integration candidate and verified local handoff. A later authorized
   commit must preserve and include or separately account for the Neon diff.

## Frozen operating-mode and policy boundary (root provider R0)

Environment, account/data provenance, and legal permission are separate concepts.
Do not turn `NODE_ENV`, a `.test` email, a boolean in a form or possession of an
admin role into evidence of real eligibility. Keep current local parsers and
demo SQL restrictions; introduce an explicit alternative at the composition root.

Root publishes a small typed runtime contract before consumers modify existing
code: `auth`, `db`, `pool`, `origin`, `environment`, current email proof binding,
and a discriminated capability/policy record. Keep existing Drizzle database type
and provider session authority. New proposed files under `src/lib/runtime/` are
root-owned. Existing `AuthRuntime` type/factory stays compatible for local callers.
Avoid widening it by unchecked casts. The shared network boundary must not use
the misleading local-IP convention for hosted calls.

Use strictly validated policy records only where a workflow consumes them:

| Contract                  | Required fields / useful validation                                                                                                                                                                                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admission policy          | Version/reference, permitted market, independent eligibility rule, guardian proof method and notice/consent version, human reviewer capability, revocation effects. Missing policy denies intake **before collecting child information**. An email proof verifies control of an address only.                                     |
| Booking policy            | Version/reference, elapsed duration, start step/notice/horizon, provisional lifetime, confirmation prerequisites, actor/action windows, administrative completion/no-show permissions and dispute/support route. Missing/invalid terms deny the dependent transition, never choose zero/no-cutoff/infinite lifetime.              |
| Publication policy        | Version/reference, eligible outcome, reviewer relation, one logical-booking submission, manual moderation, publication/withdrawal conditions and public field allowlist. Private local approvals do not satisfy it.                                                                                                               |
| Screening/incident policy | Version/reference, required check codes/evidence reference format, expiry/re-review requirements if approved, reviewer and exact case assignment, responsible human/escalation owner and reviewed reporting/meeting guidance. Missing required evidence blocks approval. No government-ID upload or invented screening threshold. |

Each record distinguishes `disabled`, `synthetic_test`, and future `approved`
authority. Disabled is the shipped default for real workflows. Root can freeze
synthetic test values and ordinary software defaults below. An approved record
requires actual recorded policy/owner evidence plus explicit activation for the
intended deployment; this wave supplies **no** such real records. A string claiming
approval is an operator attestation, not proof of legal compliance. Configuration
errors name fields/reason codes without values or private content.

Persist the policy version/reference used by significant admissions, screening,
booking and publication decisions; mutable current policy must not retroactively
rewrite a confirmed booking's terms. Prefer per-feature narrow immutable receipt
and decision records over a generic policy editor/engine. Root owns any genuinely
shared validated type/loader. No administrative policy-management UI is required.

For real-shaped local contract tests, add explicit **synthetic readiness**
provenance distinct from the historical demo and future operational records.
Synthetic readiness test fixtures may exercise all new states/decisions using the
same services and constraints, but all UI/evidence says synthetic, no lesson/email
delivery/guardian screening actually happened. Never relabel/backfill existing
`local_fixture`, `local_simulation` or private reviews into operational data.
Production visibility rejects all synthetic provenance even if someone passes a
synthetic policy packet. Real-world factories remain disabled without real records.
Test-only injection is in test-owned modules; no environment flag, production URL
override, TLS weakening or broad fixture grant in application code.

Root may select: TOTP plus provider recovery codes; mandatory admin assurance;
manual exact-task review; pending guardian requests and explicit revocation;
one immutable review per logical booking, integer1–5/optional bounded text;
anonymous public author label, no learner/contact identifiers; publish/withdraw
with audit; owner-invoked bounded outbox drain. These are ordinary software/product
choices within delegation. Record them as delegated choices, not human legal or
commercial policy approval. Keep all actual age, consent, screening sufficiency,
market, contractual booking and financial operating decisions gated.

## Ownership: one editor per responsibility

**Root/integrator R0 is the only final owner** of package.json/lock, auth schema
generation/composition, all `src/lib/auth*.ts`, `src/lib/env/*`, permissions and
mutation boundaries, runtime composition/config, existing shared routes/page shells,
shared account forms/navigation, schema index, migration numbers/journal/cumulative
snapshots, runtime grants/protection inventories/local/staging migration scripts,
test discovery/global setup/config/shared fixtures, deployment preflight, README/
env example/canonical context/decisions/operations documentation. Root owns combined
Playwright journeys and final exact-candidate independent reviews/verification.

Builders edit only the scopes below. They may write a scoped child blueprint,
ignored memory/report, and append a bounded own-worktree tracker entry under
`$build-feature`; root reconciles those hunks. They do not edit root's canonical
checkout, another worker's files, or a producer after freeze. Unique new route
facades are proposed in the handoff; root installs them. Tests owned by each child
use unique filenames; root registers them in the normal commands. New migrations
are proposed source contributions with reserved slots, never competing journal
editors; only root assembles/applies the final chain in owned local databases.

| Worker                            | Editable application scope (new paths marked proposed)                                                                                                                                                                                       | Explicit exclusions / output                                                                                                                                                                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1 `m8-admin-assurance`           | Proposed `src/features/admin-security/*`, `src/lib/db/schema/admin-security.ts`; `tests/{unit,integration}/admin-security.test.ts`, `tests/components/admin-security.test.tsx`, `tests/e2e/admin-security.spec.ts`                           | Submit plugin/schema/provider-hook and permission SQL hunks to root; no auth factory/options/schema direct edits, no shared admin routes/guards. Deliver admin assurance v1.                                                                                            |
| W2 `m8-hosted-runtime-foundation` | Proposed `src/lib/db/hosted-runtime.ts`, `hosted-runtime-validation.ts`; uniquely named DB unit/integration tests and scoped local test support                                                                                              | Reuse staging config/Pool validation; no local/staging parser weakening, auth/env/scripts/grants changes, migration, or cloud I/O. Deliver hosted DB v1. Root accepted initial contract in msg_6a0f5feb46f7.                                                            |
| W3 `m8-hosted-auth`               | Proposed `src/features/hosted-auth/*` with pure config/origin/callback/provider composition proposals; unique `hosted-auth` unit/integration/browser tests                                                                                   | Root installs actual shared factory/client/handler/forms. No concurrent ownership of W1 plugin or W4 transport. Deliver HTTPS/auth contract and full synthetic local harness.                                                                                           |
| W4 `m8-transactional-delivery`    | Proposed `src/lib/email/resend-transport.ts`, `transactional-message.ts`, `src/features/transactional-delivery/*`, schema `transactional-delivery.ts`; unique Resend/transactional tests and browser spec                                    | W4a adapter/templates first; W4b consumes accepted W6 events. Existing local-mail/capture and booking-notifications files stay unchanged initially; later exact root-approved adapter hunks only. No auth factory or booking mutation edits.                            |
| W5 `m8-guardian-admission`        | Proposed `src/features/learner-admission/*`, `schema/learner-admission.ts`, unique admission component/unit/PG/browser cases                                                                                                                 | Preserve `features/learners/*` local behavior; submit exact source/projection additions to root. No booking/tutor/review/core auth edits. Deliver admission authority v1.                                                                                               |
| W6 `m8-policy-booking-lifecycle`  | Proposed `src/features/booking-workflows/*`, `schema/booking-workflows.ts`, unique policy-booking component/unit/PG/browser cases; proposed forward modifications to existing booking constraints/triggers                                   | Extend existing booking rows/logical chain, not a second booking system. Root applies existing `bookings/*`, meeting, time-off, public availability, dashboard schema/read/presentation/route changes after freeze. Deliver booking events/eligibility v1.              |
| W7 `m8-review-publication`        | Proposed `src/features/review-publication/*`, `schema/review-publication.ts`, unique publication tests/spec                                                                                                                                  | Preserve private-reviews; root integrates public tutor projections/components/routes. No reviews of fixtures published, no W6 mutation, no shared eligibility query rewrite.                                                                                            |
| W8 `m8-screening-safeguarding`    | Proposed `src/features/tutor-screening/*`, `src/features/safeguarding/*`, schemas of same names, unique screening/safeguarding tests/spec; existing `features/tutors/review.ts` and review-rules/actions only after root's scoped assignment | Preserve existing support/restriction local demo. Root installs hosted-mode support/account source predicates, SQL assurance, page/routes/nav, common public tutor eligibility. No W5 consent policy or W6 booking mutation ownership. Deliver screened eligibility v1. |

No nested workers. At most **three workers plus root** active; after a child settles
root reuses/releases it under Orca. Builders must have observed effective GPT-6.1
Sol **High**, `$build-feature`, and current task/dispatch lifecycle records.

**Accepted dispatch refinement — msg_a24f21633113:** root accepted this software
scope/gates and delegates W1 the necessary **own-worktree** shared auth factory,
provider-generated auth schema, permission guard/admin-query, forward migration
and fixture/test hunks so its local MFA acceptance runs end to end. W1 may modify
`src/lib/auth-factory.ts`, `auth-options.ts`, `auth-handler.ts`, `auth-client.ts`,
`src/lib/db/schema/auth.ts`, `src/lib/permissions/{access,recheck}.ts`, its actual
admin query/SQL-function assurance consumers, scoped auth form/challenge/enrollment
routes, and own-worktree migration/grant/fixture registration needed for that
acceptance. Root retains **final** journal numbering/schema/grants/shared integration
ownership and freezes the actual list/hash bundle. W3 must not concurrently edit
those files; it consumes W1 only after freeze. W8 receives any subsequent tutor
review edits against that accepted baseline. This explicit allocation supersedes
the table's initial W1 shared-edit exclusion; no main/integration editing is granted.
Other builders may similarly receive an exact own-worktree shared-hunk allocation
in their live dispatch, with one active owner and root reconciliation. R0 generic
runtime/policy abstractions stay limited to actual consumer needs; W1 starts with
existing AuthRuntime and a concrete assurance contract, no unused R0 scaffolding.

## Provider handoffs and dependency DAG

Every accepted provider handoff includes exact exported signatures, data states,
post-wait authorization rules, migration/grant contributions, accepted file list/
hashes, test evidence/limitations and version. A contract sent in a message is
initial planning authority; source is frozen only when root inspects and accepts
the actual version. Consumers import the accepted bytes into their worktrees and
record hashes. Revisions require explicit consumer coordination, not silent edits.

| Provider              | Frozen interface to publish                                                                                                                                                                                                                                                 | Consumers                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| R0 runtime/policy v1  | Runtime fields/capabilities above, strict policy discriminants, same-origin request contract, assurance reference and selected synthetic provenance                                                                                                                         | Every child                                         |
| W2 hosted DB v1       | `createHostedRuntimeDatabase(config: StagingDatabaseConfig): Promise<{ db: Database; pool: HostedRuntimePool; close(): Promise<void> }>`; `verifyRuntimeLease(client: ClientBase, config): Promise<void>`; purpose runtime/staging only; every lease checked before app SQL | Root/W3; rooted Drizzle and auth adapter            |
| W1 admin assurance v1 | Server `requireAdminAssurance(runtime, headers)` and transaction/query assurance predicate tied to exact current provider session/user, verified enrolled factor/security epoch and bounded verification time; plugin configuration and allowed endpoints                   | Root admin guards/W8/W5/W7; W3 composer             |
| W4 mail v1            | Internal strict `ValidatedMessage`; `Transport.send` returns accepted(providerId), retryable(rate_limited/unavailable), rejected(configuration/recipient/payload), or uncertain(timeout); no delivery guarantee                                                             | W3 account callbacks; W4b committed events via root |
| W5 admission v1       | Current participant/guardian eligibility query for exact learner and policy version, pending/authorized/rejected/revoked decision receipts; minimal learner DTO, admission grant function                                                                                   | W6/root participant reads/private links             |
| W8 screened tutor v1  | Current policy-approved eligibility predicate + minimal public offering DTO compatible with existing directory; decisions/revision/evidence metadata, no evidence content publicly                                                                                          | W6/root discovery/availability/meeting              |
| W6 booking v1         | Persistent policy-aware state/events/logical-head model, current authorized detail projection, completion eligibility for exact current head and event, committed notice-recipient projection; UTC instants and policy version                                              | W7/W4b/root dashboards/support/link integration     |

Initial ready tasks: W2 provider and W4a transport need no new policy answer and
may start from baseline now. Root can publish R0 then start W1 before filling the
third slot with domain work. W3 can prepare pure HTTPS/origin tests and W5/W8 can
prepare their policy-denied/synthetic domain slice using R0 and current local auth;
their **combined hosted acceptance** waits for actual W1/W2/W3 handoffs. Do not
make independent local domain work wait on a cloud setup that is unauthorized.

Coordinator refinements received before final handoff: W2 uses a private native
Pool behind a named `GuardedRuntimePool` implementing the limited structural
`HostedRuntimePool` interface (SQL/config query and connect promise/callback,
end, readonly counts, sanitized error events). No unchecked native pool/options
escape; no prototype spoofing. Pinned Drizzle recognizes its Pool class name;
real transaction/rollback/callback behavior must establish compatibility before
freeze. Root supplies an explicit structural hosted-runtime alias and preserves
local fixture Pool typing. This supersedes the initial raw-Pool planning shape.
W4a preserves actual pinned SDK request construction/fixed provider endpoint
with private typed safe-error sanitization; no global logger/SDK patches. Actual
SDK local HTTP contract tests remain required, not mock-only acceptance.

At this handoff root reports W2 in `m8-hosted-runtime-foundation` and W4a in
`m5-resend-transport` actively implementing, and integration
`/Users/cob/orca/workspaces/learli/m8-hosted-workflows-integration` contains36
hash-verified source-only Neon files without credentials. These coordinator
checkpoints do not claim either provider is verified/frozen yet.

Ordered waves, keeping real dependencies shallow at dispatch level:

1. R0 minimal interfaces/baseline protection; W2 + W4a + W1.
2. Accept providers; root composes them. W3 + W5 + W8 (W5/W8 independent synthetic
   service work can have started earlier in available slots). Their final scope
   checks consume current assurance. Root freezes admission/screening together.
3. W6 consumes frozen identity/admission/screening; W4 account browser integration
   and root shared runtime testing proceed independently. No W6 public confirmation
   before policy gate, no W4 booking guesses.
4. W7 + W4b consume W6; root assembles dashboards/private link/public projections
   and combined browser journeys. Use a third slot for read-only review only after
   each candidate scope is stable.
5. Freeze assembled candidate; independent auth/TLS/grants and domain/privacy
   reviews; root full Verify and Remember. Repairs use Recover, scoped owner,
   revised source freeze and affected re-review/rerun.

## Smallest complete child implementations

### W1: mandatory admin assurance with provider-owned recovery

Add Better Auth's installed twoFactor plugin for TOTP and backup codes. Keep
password-required enrollment; verify enrollment before factor becomes active;
no SMS/email second-factor fallback, passwordless paths or trust-device option.
Enrollment/setup may be reachable by verified active admins without assurance,
but admin data and actions must be denied until enrollment and challenge succeed.
Handle `twoFactorRedirect` in sign-in before navigation; password success alone
must not navigate into an admin document.

Root uses installed auth schema generation for plugin-owned fields/table and a
forward migration. Do not reproduce provider credentials in an app identity store.
Minimal app-owned assurance receipt binds exact session/user and security epoch,
verification time/method; no secret, backup code or token in receipt/audit. An
enrollment flag alone cannot elevate a preexisting session or new role grant.
Provider success hooks set assurance only after actual verification/created
session is known; pending sign-in explicitly has no `newSession`. Use supported
hooks/HTTP handlers and preserve throttling/cookie forwarding/error normalization.

Require assurance at every admin read/write, single-statement private projection,
post-lock recheck and narrow SQL function. Root audits all existing admin callers;
a page/layout guard is insufficient. Maintain exact task grants/self-review
exclusion in addition to assurance. Provider verification failure or assurance
write failure yields no privileged access, even if ordinary session creation
partially succeeded. Existing old sessions fail assurance.

Recovery uses a provider single-use backup code, not resetting MFA from email or
knowing an account name. Rotate backup codes and replace/disable factor only
after fresh password + current factor assurance; active admin cannot remain
privileged after disable. Re-enrollment removes old assurance and revokes sessions
through provider, preserving uncertain failure recovery. Lost password and all
factor/recovery codes has no automatic admin-bypass reset endpoint; leave an
explicitly owner-controlled operational recovery runbook requirement for later.
Do not mutate provider rows ad hoc. Present secrets transiently once, no URL/
storage/SSR bootstrap/telemetry/screenshots with them. Local authenticator setup
may use manual entry; no third-party QR service or extra package needed.

### W2: hosted Pool/Drizzle without disabling target guards

Reuse exact `ApprovedStagingTarget` validation and verified TLS PoolConfig.
Only accept runtime purpose, `learli_app`, exact current/session identity,
origin replication, safe roles/memberships/ownership/parameter ACL. Every Pool
checkout must validate, including callback/promise query/acquisition paths and
already-established connections after drift. Drizzle transactions and Better Auth
must obtain the same validated leases; raw unchecked Pool escape is not allowed.
Keep local `createDatabase` unchanged. Respect close/error cleanup and bounded
safe diagnostic codes. No serverless HTTP driver substitution.

Source extraction is acceptable only when root installs shared refactors and
retains operator connection validation. Avoid importing filesystem migration
runner into request code. Root may reuse a small runtime-safe exact privilege
validator from existing operator checks where needed. Production config and
production targets remain refused by the staging parser. Report this partial
scope honestly: production target activation needs separate later work/authority.

### W3: hosted auth contracts tested on an owned local HTTPS app

Add explicit hosted-synthetic runtime composition consuming W2/W1/W4, not an
implicit fallback when local validation fails. Require canonical HTTPS APP_URL/
Better Auth URL equality, exact trusted origins, own auth secret and isolated
target record. Staging synthetic identities remain allowlisted/test-only, with
no arbitrary real signup/role assignment. Preserve current local createLocalAuth
and `.test` rule. No production auth enablement follows from DB provider config.

Use supported secure HttpOnly/SameSite cookie settings with exact host scope;
reject HTTP, lookalike hosts, wildcard origins, credentialed/path/query origins,
forwarded-origin injection and external callbacks. Keep CSRF/origin checks on.
Make deployment proxy assumptions explicit: headers require an ingress boundary
known to overwrite them; do not trust browser X-Forwarded-For or skip limiting.
If that boundary is not established locally, use a safe bounded fallback limiter,
not per-attacker untrusted addresses. Root owns shared request sanitizer for
password/email/session wrappers as well as core auth.

An owned local TLS reverse proxy/browser harness can exercise exact HTTPS origin,
Secure cookies and forwarded-header stripping over the local app and real PG.
Use test-owned CA/cert trust; never global trust/TLS disable or hosted hostname
allowlist exception. Local tests can compose the same provider factory with owned
local DB through a test module while production env parser rejects that pairing.
Test actual SDK/server calls; mocks alone do not prove session security. New
runtime selection is awaited/lazy safely; do not silently create duplicate auth
instances/pools when changing the existing synchronous accessor.

### W4: real SDK transport, durable send semantics, no live sending

W4a independently supplies strict internal messages/transport using installed
Resend6.32.1 SDK; test the actual SDK with a local mock HTTP boundary. Bind sender,
environment, recipient allowlist and action-link origin/config; default disabled.
Account URL/proof messages come from provider callbacks only and retain purpose/
session proof binding. Auth mail callbacks await an accepted/failed result; safe
UI says request/acceptance, never delivery. Keep existing capture intact.

W4b consumes W6's actual committed event IDs and current recipient projection.
Queue one event/recipient/kind item atomically with transition. Drain only after
commit, on an independent connection, manually/operator-invoked and bounded;
no user retry endpoint or new scheduled worker. Use a short claim transaction/
lease, immutable prepared payload/fingerprint/key, SDK send outside booking
transaction, then compare-and-set acknowledgment. Recheck current account and
participant authority immediately before preparing/sending; cancel/supersession/
revocation suppresses obsolete notices. No learner name/meeting link in payload.
An already-authorized send can race a later revocation; document the actual
authorization point, do not promise revocation recalls external email.

`provider_accepted` is not `delivered`. Persist safe provider ID/attempt time/state,
no raw provider error. Bounded retry of 429/5xx/concurrent-key409; invalid-payload
409 is terminal. Timeout/send-before-ack is uncertain, not false success. Keep
payload identical under a retry key; address/template changes create suppression
or a new explicitly reviewed event, never reuse a key with changed content.
Resend retains keys24h: once uncertainty outlives that window, block blind resend
and require reconciliation. Neither provider dedup nor DB proves exactly once.
No delivery webhook/reminder/cost integration is necessary for this slice.

### W5: admission authority instead of a guardian checkbox

Preserve existing synthetic creation. Add the smallest explicit policy-aware
admission path: an authenticated verified account selects permitted parent or
eligible independent-learner intent; trusted server logic grants only the approved
ordinary role after its eligibility gate, never admin or arbitrary role input.
Pending admission is private to its requester and precisely assigned staff.
No existing-child lookup/link by name/email; new child profile creation is permitted
only when intake policy allows collecting its minimal fields. When policy is
missing show unavailable policy state and collect no child data.

Create pending guardian request/authorization evidence/version receipt; human
review under exact task scope and admin assurance records approval/rejection/
revocation, without automatically authorizing a link at creation. Minimal evidence
is a private opaque reviewed reference/method and actor/time, not uploaded ID,
extra child DOB/address or invented consent wording. Reject forged/replayed
evidence/policy versions, self-review and stale decision. Authorized link and
immutable decision audit commit atomically via narrow fixed-path functions;
runtime cannot write arbitrary links/status/roles. Independent College Support
learner eligibility is separate; neither college level nor email alone proves age.

Publish current SQL eligibility consumed by booking/links/history, including
revocation after waits/retries. Existing local link remains valid **only** in local
demo; new readiness provenance cannot bridge to a real record. UI retains original
selected public time through admission detour, revalidates later and never holds
it indefinitely while awaiting human review.

### W6: confirmation and outcome logic using explicit policy

Reuse `bookings` logical IDs, immutable replacement rows, exclusion/locks,
idempotency and event history. Add conditional forward source/state constraints
for the new readiness/operational-shaped workflow; preserve all historic demo
checks/data/functions unchanged unless a root-reviewed forward replacement is
needed. Do not build a parallel booking database. Proposed state subset:
provisional → confirmed → completed/no_show; provisional → expired/cancelled;
confirmed → cancelled/replaced under configured actor/window. No paid state or
payment table. Current production confirmation policy stays disabled.

Confirmation requires named policy prerequisites and current admission/screening;
browser/user `confirmed=true` and manual paid flags cannot satisfy them. Root
cannot invent a free-trial/no-payment commercial model. Synthetic readiness test
policy exercises this predicate without proving a real commercial entitlement.
Policy-disabled UI explains unavailable action, not a decorative success button.
Provisional expiration has finite DB time; confirmed bookings remain blocking
until their actual lifecycle terminal state and **must not expire after10min**.
Existing demo TTL and original reschedule deadline remain untouched. One confirmed
logical head and one blocking interval across **all** blocking source/state kinds.

Confirm/cancel/move/outcome transactions lock tutor first then booking; fresh
post-wait session/account/role/admission/screening/action-scope checks, DB clock,
revision/key fingerprint; save event/outbox atomically. Cancellation need not
require future tutor subject eligibility merely to stop an authorized obligation.
Reschedule validates fresh slot/offering/schedule/time off and atomically replaces
the original; conflict preserves original and all events. No autoextend hold;
retire old private link and require explicit new link. Administrative completion
after end and manual no-show use exact permitted actor/case and bounded reason
code, never infer attendance from clock/link clicks. Preserve dispute/support
route and outcome provenance, no fees/refund/credit effect.

Root installs policy-aware busy queries (public availability/matching/time off),
private detail/overview/status/dashboard and meeting joins, all driven by the
same accepted state/source predicates. New confirmed links must have exact
participant/admission authority and configured access window; no general admin
link access. Ended/read history and notification projections never expose URLs.
Freeze completion eligibility/events before W7/W4b starts.

### W7: separate publication, never promote private demo approvals

Reuse private-review concepts but keep historical private tables/data private.
Add operational-shaped review/publish decisions bound to the W6 current completed
head/event with active author/authorized family relation; one immutable submission
per logical booking. Numeric rating1–5 and bounded plain text are delegated
product defaults. Completion is administrative status, not verified attendance.
No author/tutor self-moderation or blanket admin grant.

Manual moderator with exact review assignment plus admin assurance may reject,
approve for publication, publish/withdraw, or return to pending reconsideration;
audit actor/version/revision/request, no silent hard deletion. Publishing checks
current policy/source eligibility and privacy review. Existing `locally_approved`
does not imply public approval. Publication field allowlist: anonymous customer
label, approved rating/text/date as policy permits, no account/booking/learner IDs,
names/emails/school/schedule/meeting evidence. Reject inappropriate private text;
do not add automated content surveillance or a tutor reply/chat system.

Root's public query returns only currently published eligible rows for currently
publicly eligible tutor; withdrawal immediately removes aggregate contribution.
Count/average computed from that same exact set, truthful zero state, no rounding
that makes fabricated5.0; no lesson-count or attendance claim. Synthetic readiness
records appear only in clearly marked local tests, never hosted/public production.
Preserve author/mode scope and plain escaped text/XSS/privacy boundaries.

### W8: assigned evidence-based screening and staffed-response gates

Keep basic existing application/status flow; add required-check/version evidence
and exact reviewer assignment. Reviewer needs current role/assurance/capability,
not application ownership or global admin status. Opaque private evidence reference
and check-result/time/actor is sufficient software infrastructure; no upload or
document repository. No self-review. Approval/reinstatement checks all required
evidence under current policy, with conflict/history and post-lock authority;
incomplete, revoked or stale evidence keeps future bookability off. Profile edits
retain existing approved editing decision unless the actual policy makes a
specific reviewed evidence fact invalid; no unrelated re-review program.

Freeze screened public eligibility and have root integrate that predicate in
directory/matching/create/reschedule/private links; no public “verified” claim
beyond actual checks. Existing synthetic tutors keep local demo eligibility;
operational public visibility cannot rely on those approvals. Domain deny states
work locally before real screening criteria exist.

Extend existing exact support dispatch and account restriction contracts through
separate readiness/operational capability records and human-owner/escalation
policy. Preserve requester-only content, dispatcher metadata-only queue, assigned
reviewer access, self-case exclusions and minimal booking context. Administrative
acknowledgment, assigned owner/escalation and safe timestamps/audit are useful;
notes/chat/emergency service promises are excluded. Missing human operating owner
means real intake is disabled; do not advertise monitored response just because
the UI assigns a case. Provisioning of real staff/capabilities is deliberate and
outside this activation scope. No all-family lookup or universal account powers.

## Isolation and heavy-check scheduling

These are **allocated ports**, not proof of current availability. Root reported
only main55432 and unrelated5432 listeners at its checkpoint; recheck exact ports
before starting any child. Occupied port means report to root and reallocate,
never stop an unknown process. Do not reuse old wave555xx/556xx/557xx/558xx.

| Owner            | PG dev/test cluster | App dev | Browser app | Disposable TLS PG | Local HTTPS browser proxy |
| ---------------- | ------------------- | ------- | ----------- | ----------------- | ------------------------- |
| W1               | 55901               | 3091    | 3191        | 56001             | 3291                      |
| W2               | 55902               | 3092    | 3192        | 56002             | 3292                      |
| W3               | 55903               | 3093    | 3193        | 56003             | 3293                      |
| W4               | 55904               | 3094    | 3194        | 56004             | 3294                      |
| W5               | 55905               | 3095    | 3195        | 56005             | 3295                      |
| W6               | 55906               | 3096    | 3196        | 56006             | 3296                      |
| W7               | 55907               | 3097    | 3197        | 56007             | 3297                      |
| W8               | 55908               | 3098    | 3198        | 56008             | 3298                      |
| Root integration | 55919               | 3099    | 3199        | 56019             | 3299                      |

Each owns `.local`, mail/SDK capture, PG data, test fixtures, secrets, build output
and reports in its worktree. Explicit port variables use actual existing tooling:
LEARLI_DB_PORT, LEARLI_DEV_PORT, LEARLI_TEST_PORT; LEARLI_STAGING_TEST_PORT for
owned TLS harness. Reserve extra HTTP SDK mock/restore ports explicitly with root
if needed; do not guess free adjacent peer ports or bind public interfaces.

At most **two heavy jobs** across team (build/browser/PG/restore), one during any
performance timing. Root grants numbered leases; release in success/failure.
Within one checkout, build/type generation are serial and suites sharing fixtures/
rate limit DB are serial. `.env.test.local` cannot borrow main or production.
Guaranteed owned cleanup; fixed-date DST fixtures get separate tutors. Reporting
does not justify deleting peer/main data or stopping another project's session.

## Local verification acceptance (separate Verify stage; NOT RUN here)

Use actual scripts: `npm run check`, `npm run test:integration`, `npm run build`,
`npm run test:e2e`, `npm run test:e2e:cross-browser`, `npm run test:restore` as
affected; targeted Vitest/Playwright before root full matrix. Root confirms every
new spec is discovered by ordinary project registrations; isolated config passes
alone do not prove default discovery. No skip/retry used to conceal software
failure. Every named check has PASS/FAIL/NOT RUN + source manifest/command/env/
exit/evidence. Historical974/575/140 counts are retained baseline evidence only.

Required real PG checks: fresh chain and populated0021→new chain preserving all
44 public tables' existing rows/values and historic migration hashes; exact
functions/triggers/exclusion shape; current runtime table/column/function grants,
grant options/PUBLIC/memberships/parameter ACLs and failed direct-write probes.
Do not assume22 journal entries exist in each worker database until inspected.
Keep immutable0000–0021 and cumulative metadata; root assigns0022 onward only
after dependency order is settled (do not promise an exact final migration count).
Back up/recover owned local data; forward expand/conditional checks preferred;
rollback is disabling new paths plus restore only in an owned rehearsal, no
destructive down migration on existing shared records.

| Flow                   | PG/service negatives and concurrency                                                                                                                                                                                                                                                                   | Actual Playwright acceptance                                                                                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin MFA              | Pre-enrollment/old session/new admin role/password-reset cannot bypass; wrong/expired/foreign challenge; enrollment/disable/rotation atomic or safe uncertainty; concurrent backup-code reuse ≤1 success; revoked assurance after waited lock denies writes                                            | Enroll manual secret→verify→sign out→password challenge→TOTP→scoped admin action; recovery code then reused denial; code rotation/disable removes access; keyboard/errors320/390/1440; secrets absent URLs/storage/back/bootstrap/log/captures                                                      |
| Hosted DB/auth         | Actual TLS cert/hostname/CA failures, wrong DB/role/session/TLS, elevated members/PUBLIC/parameter grants including reused-client drift; transaction rollback and two independent leases; auth provider real tables/throttles                                                                          | Owned HTTPS proxy: Secure/HttpOnly/SameSite cookie, verification/reset/login/logout/MFA; trusted/untrusted Origin/Host/forwarding requests; stale cookie after revoke; production-target configuration hard refusal before I/O; safe unavailable UI, no client config leak                          |
| Account email          | Supported pinned SDK request/accepted/error/429/409/timeout, provider URL allowlist, same-purpose hashed retry identity; private proof failure and uncertain revocation                                                                                                                                | Actual browser register→captured/mock-SDK verification→signin; forgot/reset token expiry/reuse; current/new email OTP and password/session changes; unknown account generic response; fake SDK failure disclosed without secrets/live email                                                         |
| Guardian admission     | Pending cannot authorize learner/book/link; forged arbitrary role/learner/evidence; stale/foreign/self decision; revoked role/link/evidence after waits; concurrent approval/revoke is consistent; independent College eligibility separate                                                            | Policy disabled collects no child fields; synthetic parent requests→assigned MFA reviewer approves→parent sees only own learner→revoke denies fresh/detail/API; unrelated parent direct URLs deny; independent College path without guardian; selected time survives detour and stale revalidation  |
| Booking lifecycle      | Concurrent provisional/confirm/move/time-off vs cancel/reschedule across sources; one blocking interval/logical head; failed move preserves original; retry event/outbox once; expiry cannot revive; confirmed does not expire with old demo TTL; outcome before end/wrong actor denied; DST/overnight | Parent/College select→request→authorized synthetic confirmation→tutor supplies link→participant-only open→move/conflict→cancel/history; manual completion/no-show shows administrative provenance; stale/foreign/suspended actor and policy-disabled confirmation denial; no paid claims            |
| Booking mail           | Rollback enqueues none; two drains only claim once; current revoked/stale recipient suppression; send after commit failure cannot alter booking; accepted-before-ack retry same immutable key/payload; >24h uncertain stays blocked                                                                    | Browser transition produces exact new committed notice in local fake SDK; SDK failure preserves confirmed/cancelled DB+UI; retry yields truthful accepted state and no duplicate; no learner/meeting/token data in booking notice                                                                   |
| Reviews                | Ineligible/noncompleted/old head/unrelated author denied; unique logical-booking review under concurrency; exact moderator grant/assurance/current revocation; publish/withdraw revision race; private/fixture source permanently excluded from production public set                                  | Eligible synthetic ended booking submit→assigned moderator→publish→local clearly labelled profile count/average/text→withdraw disappears; visitor cannot submit, foreign parent/tutor cannot read private review, XSS text escaped; zero reviews truthful; public HTML no private IDs/names/history |
| Screening/safeguarding | Missing/policy-expired evidence cannot approve/reinstate; forged/self/unassigned/revoked reviewer denied after waits; suspension promptly removes shared bookability; exact case dispatch/read/reassign/reopen rules; unauthorized account writes fail                                                 | Tutor applies→assigned MFA reviewer missing-check denial→synthetic evidence decision→eligible discovery; report concern→exact dispatcher metadata→assigned reviewer acknowledges/escalates→old reviewer loses access; no case body/learner/link in queue/public responses                           |

Root combined journeys must cross auth→admission→screening→booking→private link→
mail→outcome→review; also safety report→assignment→restriction→denied action.
Use the same browser through sign-out/account switch, failed reauth, expired or
revoked session, lost role/guardian/reviewer grant, Back/Forward and bfcache. Check
actual old document inline RSC/bootstrap as well as fresh HTTP/API denials; no
retained learner/booking/meeting/support/review or MFA secret from previous actor.
Preserve `document-boundary.tsx` and full replacement semantics unless evidence
justifies a scoped reviewed repair.

Responsive/keyboard/axe at320/390/1440 and relevant768/1024, no-JS readable/denied
states and POST/no-script safety, pending/errors/focus, forced colors/reduced motion,
date-specific DST offsets. Complete default Chromium for all flows, plus affected
auth/security/critical journey subset on actual Firefox and WebKit. Disclose
physical-device/hardware screen-reader/real-browser-zoom limitations; automation
does not establish those. Do not enable ignoreHTTPS globally or pretend an HTTP
mock proves HTTPS sessions. HTTPS cert trust stays test-owned.

Final privacy inspection includes public/auth HTML, API errors, client assets,
logs and generated Playwright HTML/screenshots/traces. Raw private synthetic
captures stay0700/0600 ignored; sanitise shareable summary without changing result.
Existing13 dependency advisories remain separate unresolved risks unless an actual
compatible fix is reviewed/tested; no policy waiver or quiet package churn.

## Root document reconciliation and exact activation gates

Before implementation depends on new decisions, root records this delegated
software boundary in relevant PRD/architecture/build-plan and a dated decision;
local exceptions remain historical and unchanged. Update UI context only for new
policy-gated controls/statuses using current native tokens/components, no second
design language. README/env example/runbooks document separate local/hosted
configuration and safe denial/defaults. Update tracker after meaningful accepted
implementation with actual partial outcomes; no blanket checkbox promotion.

Still required **before actual activation**, even if all software tests pass:

1. D-01/09/10: actual operating markets/entity, lawful independent/minor
   eligibility, guardian proof/consent/privacy/retention notices and named owners.
2. D-08/13: actual tutor screening minimum and evidence, responsible reviewer/
   safeguarding/escalation humans and safe external meeting/guardian guidance.
3. D-06/07 and BKG-03: actual duration/notice/hold/confirmation/cancel/move/no-show
   contractual conditions. Paid and no-platform-payment commercial models both
   need actual business decision; no inferred free pilot. Payments remain idle.
4. D-14: root-delegated software publication default recorded, plus real operating
   privacy/moderation/dispute ownership and policy evidence before real publishing.
5. Named isolated hosted target + runtime identity/grants/migrations, actual
   HTTPS ingress/header contract, auth secret, verified sending domain/authorized
   recipients and provider acceptance; each provider/migration/deploy/send operation
   requires its own authority. Existing production `.neon` linkage supplies none.
6. Explicit pilot/release scope and human ownership, unresolved dependency/device/
   backup/operational acceptance as applicable. No whole eight-area launch-complete.

**No user answer is necessary to start W1/W2/W4a or the policy-denied synthetic
software paths.** If root wants to enable real admission/confirmation during this
wave, it must ask instead of inventing authority. Suggested necessary question
then: “Which operating scope should we activate after software acceptance:
synthetic-only readiness (recommended while policies are unavailable), or a named
real-user pilot with its approved market/guardian/screening/booking policy packet
and responsible human owners?” The first proceeds under current authority; the
second requires actual evidence and separately authorized provider/release actions.
Do not ask this as routine blueprint confirmation or wait on it for independent
safe work. Root can ask missing policy details one at a time when activating them.

## Completion accounting and handoff

Every child reports what is implemented, same-agent Review versus independent
review, exact checks/source identity, known failures/limitations, migration/shared
hunks, policy-disabled behavior and next owner. Every lifecycle outcome uses its
current Orca task/dispatch, exactly one worker_done and a three-sentence summary.
Root accepts/reuses/releases each settled worker, independently reviews frozen
combined security/domain scopes, executes Verify, and saves ignored `memory.md`.

This architect's verification status: **NOT RUN — planning only**. Planning is
complete when this actionable scope and report are returned to root; it does not
grant this worker implementation ownership. Blueprint ready.

## Root integration clarification — current beneficiary eligibility

2026-10-12, AUTHORIZED — build-feature delegation. Root inspected accepted0023
and authorized W6 to add a private read-only beneficiary predicate in forward0025.
A participant logging out does not by itself revoke the learner's existing
admission, tutor-side booking eligibility, or a current notice recipient. The new
predicate must retain every current policy/source/receipt/evidence/role/ownership
and active verified synthetic-account check from W5, excluding only the
beneficiary's session requirement. Existing0023 and exact-session actor predicate
remain unchanged. W6 must separately authenticate/authorize the actual viewer or
mutating actor with current session and exact booking ownership/assigned scope,
including post-wait checks. The beneficiary boolean never grants public, tutor,
admin or meeting-link access by itself. Notice projection binds the actual booked
participant; it does not discover arbitrary guardians. Real activation remains
disabled, and no guardian or commercial policy is decided by this technical split.
Root requires actual logout-versus-revocation and post-wait regressions before
accepting the new provider contract. W6 owns implementation; root owns independent
review and final integration.

## Root integration clarification — dispute creation and test placement

2026-10-12, AUTHORIZED — build-feature delegation. W6 owns the narrow forward0025
bridge from an authorized booking participant to the existing W8 synthetic case
service and immutable booking association. W8's nested exception transaction
requires an explicit server-generated top-level creation transaction marker on
new readiness cases; a forward-only trigger stamps it and rejects later changes.
Existing rows remain null, the W8 function/0024 and legacy association branch
remain unchanged, and all participant/policy checks recur after blocking writes.
This is database transaction bookkeeping, not a new case system or real response
policy. Root requires actual nested-success, forgery/old-case/replay denials,
late-revocation rollback and forward preservation before acceptance.

Root may configure only test-owned placement to run the accepted source on its
own listeners. Hosted fixture defaults remain compatible with W3; explicit
validated backend/HTTPS/TLS assignments preserve exact loopback, private packet,
certificate and source-substitution checks. Root reserves3319/3419/56019 for the
hosted fixture, separately from ordinary3199 and readiness3099. No application
capability or production guard is changed by test placement.

## Root integration clarification — public discovery return paths

2026-10-13, AUTHORIZED — build-feature delegation. The W7 enabled public profile now hands a public tutor/subject pair to W6 before any learner or slot is chosen. Preserve that exact two-field pair through authentication and admission alongside the existing complete legacy time tuple. Use a separate strict public schema; never infer age, level, duration, learner identity or availability and never downgrade malformed/extra/private fields to discovery. Root owns the shared return parser, initial private-page return and admission detour/input plus actual anonymous-profile→sign-in→admission→booking verification.

The accepted0023 private valid_admission_selection function currently permits only the full six-field legacy tuple. Root allocates forward0028 after W4's frozen0027 solely to recognize the canonical two-field public pair before its otherwise unchanged six-field validation. Historical0000–0027 bytes and all actor/guardian/policy/evidence checks remain unchanged. No table/column/role/grant change, backfill, destructive migration, production action or operating policy approval is introduced. Verify real admission storage/read of the pair and direct SQL rejection of private/duplicate/extra/malformed fields, canonical fresh/forward preservation through the final chain, root combined browser and restored-source integrity.
