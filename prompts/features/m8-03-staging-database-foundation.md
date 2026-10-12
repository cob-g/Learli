# Implementation Plan — Isolated staging database foundation

Status: **AUTHORIZED — build-feature delegation** for code preparation and local verification.
Prepared: 2026-10-12.
Preparation request: “ok now lets preapare for next gate”.
Execution authority, 2026-10-12: “ok lets proceed on the current wave lets do that”.
The user authorized the proposed two builders and independent reviewer, GPT-6.1
Sol / High, through coordinated build-feature. This does not authorize external
provider operations, commit/merge/push, production changes or public release.
Repository: `/Users/cob/learli`.
Observed baseline: clean `main` at `0d7f2ddba07b05a72c8a995428e29c3584224ebe`,
one checkout and one local branch before this planning file. Existing
`origin/main` is one documentation commit behind; no remote refresh was performed.
Proposed integration branch: `cob-g/m8-staging-database-foundation`.
At planning time no branch or worker had been created. Current launch state is
recorded separately in the progress tracker and private wave manifest.

## What we are building

Give the operator a separate, explicit way to validate an isolated Neon staging
target, connect with verified TLS and restricted credentials, and deliberately
apply the existing reviewed schema. Preserve the working local application and
its local-only tools. This is the first prerequisite for hosted authentication,
email and deployment; it does not make the hosted marketplace operational.

The immediate deliverable is reviewed code and a locally verified operator
procedure. A later authorized rehearsal on a named Neon staging resource supplies
the actual provider evidence. Keep those two completion records separate.

## Requirement and milestone mapping

- Primary: **M8.3** environment separation.
- Supporting: **M2.1**, **M2.2**, **M8.1**, **M8.4**, **M8.8**.
- PRD: **NFR-05**, **NFR-06**, **NFR-09**, **NFR-11**; preserve **AUTH-03**,
  **BKG-02**, **BR-06**, **BR-18** through database permissions and constraints.
- Recovery preparation supports **NFR-12**, but this slice does not establish a
  hosted backup service, recovery objective or completed M8.7 acceptance.
- Read `AGENTS.md`, then the eight canonical files in its required order:
  `context/project-overview.md`, `architecture.md`, `ui-context.md`,
  `code-standards.md`, `ai-workflow-rules.md`, `progress-tracker.md`, `prd.md`,
  `build-plan.md`. All eight are under `context/`.
- Also read `ORCHESTRATION-LESSONS.md`, the current readiness/deployment reports,
  and `docs/decisions/2026-10-11-local-m2.md`. Older mixed-case references and
  baseline status tables do not supersede canonical paths or later evidence.

## Current repository evidence

| Inspected area                                        | Actual boundary                                                                                  | Planning consequence                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `src/lib/db/connection.ts`, `local-config.ts`         | `pg` plus Drizzle node-postgres; loopback-only URLs and local database names; local TLS disabled | Add a separate staging factory; do not broaden the local parser                                                |
| `scripts/migrate-local.ts`                            | Loads local env files; applies Drizzle migrations and explicit `learli_app` grants               | Hosted migration needs an explicit target and separate credentials; reuse the grant policy without widening it |
| `drizzle/0000` through `0016` and schema              | Existing simulation schema, triggers, restricted functions and `btree_gist` exclusion constraint | Preserve migration bytes and simulation semantics; verify provider privileges rather than assume them          |
| `src/lib/env/schema.ts`, `auth.ts`, `auth-factory.ts` | Only disabled/local auth; local factory requires development/test                                | Database preparation must not enable hosted accounts                                                           |
| `src/lib/auth-handler.ts`, `auth-options.ts`          | Loopback Host/origin checks and a fixed local IP identity                                        | Hosted auth requires a later deliberate proxy/cookie/abuse design                                              |
| `src/lib/email/local-mail.ts`                         | Private synthetic local captures                                                                 | Resend delivery remains a later package                                                                        |
| `scripts/deployment-preflight.ts`                     | Hosted mode always reports BLOCKED; no hosted network probe                                      | Keep full hosted readiness blocked after this database-only slice                                              |
| `package.json`, `.github/workflows/ci.yml`            | Existing pinned `pg`/Drizzle; CI uses disposable local PostgreSQL                                | No new driver or provider credentials in ordinary CI                                                           |
| `docs/operations/dependency-maintenance.md`           | Last recorded audit: 13 findings and no accepted waiver                                          | Reassess before external exposure; no clean-audit claim from this plan                                         |

These are source inspections and retained reports, not checks executed during
planning. Provider accounts, target identifiers, credentials, budgets and existing
cloud resources were not inspected.

## Language and engineering recommendations

- **Staging** means a dedicated non-production Neon resource with synthetic test
  data, separate credentials and an identified operator. A label or environment
  variable alone is not evidence of isolation.
- **Prepared** means implementation and local evidence are ready for a named
  provider rehearsal. **Provider verified** requires observed checks on that
  authorized target. Neither means pilot or public-launch approval.
- Retain `pg` and `drizzle-orm/node-postgres` for the single Node service. Neon
  supports standard Postgres clients, and Drizzle supports this driver. This
  avoids changing existing transaction semantics merely to use a hosted database.
  Sources: [Neon connection documentation](https://github.com/neondatabase/website/blob/main/content/docs/connect/connect-from-any-app.md),
  [Drizzle PostgreSQL documentation](https://orm.drizzle.team/docs/get-started-postgresql).
- Initially use a direct endpoint with a bounded application pool, preserving the
  current five-connection ceiling, and a separate direct migration connection.
  Reconsider pooled endpoints only with measured need and transaction/session
  compatibility evidence. Neon's pooler uses transaction pooling; its documented
  direct-connection guidance covers migrations and session-dependent operations.
  [Neon pooling documentation](https://github.com/neondatabase/website/blob/main/content/docs/connect/connection-pooling.md).
- Require certificate and hostname verification. Parse permitted URL fields into
  explicit driver configuration; do not combine unchecked connection-string SSL
  options with an SSL object, because those options can replace the object.
  [node-postgres SSL documentation](https://node-postgres.com/features/ssl),
  [Neon secure connections](https://github.com/neondatabase/website/blob/main/content/docs/connect/connect-securely.md).
- Sources were read on 2026-10-12. Check installed APIs before implementation;
  do not copy current documentation's prerelease installation recipes into the
  pinned stable application.

## Scope and invariants

Included: separate staging configuration/connection boundary; explicit
configuration-only inspection; explicit read-only target inspection; deliberate
migration runner; shared, unchanged runtime grant policy where useful; meaningful
negative tests; operator instructions and evidence format.

Excluded: application hosted-auth wiring, new booking states, real accounts,
Resend sends, Railway deployment, public endpoint changes, pricing/payments,
guardian policy, new business schema, provider provisioning and cloud operations
under the code-preparation authorization alone.

Keep the current local URL validator, setup, seed, restore and test commands
restricted to their owned loopback databases. No local fallback for a failed
staging connection. Production targets are refused by this new staging tooling.
No seed or migration on application startup. Main's databases and other projects
are not test resources. Preserve least privilege, historical records, private
diagnostics, source constraints and database-level overlap protection.

## Configuration and data contract

Accepted staging-only configuration names: `STAGING_DATABASE_URL` and
`STAGING_DATABASE_URL_DIRECT`. They belong to explicitly selected private
operator configuration, not implicit local dotenv loading. The application must
not receive the migration credential. Keep ordinary `DATABASE_URL` local behavior
unchanged in this slice. Do not log either URL, passwords or raw driver errors.

Before a network operation, require an approved target record describing the
Neon project, branch, endpoint, database, intended role and purpose. Bind exact
host/database/role configuration to that record; reject mismatches, ambiguous
URL parameters, URL fragments, insecure TLS settings and missing identity.
Identity values are not secrets, but keep resource inventories private where
appropriate. Do not accept a staging name as proof that a production branch is
safe. The operator must verify the resource in the provider account first.

Use distinct restricted `learli_app` and migration-owner roles. Existing SQL
mentions `learli_app` explicitly, so establish the role before applying that
chain. Verify its effective privileges and memberships: it must not inherit owner,
schema-administration or provider administrative rights. Verify the migration
identity can create the required extension/functions without assuming superuser.
Do not silently replace unsupported SQL or grant broader rights to make it pass.

No new business migration is expected. Preserve every applied SQL file and the
Drizzle journal. If provider compatibility genuinely requires new SQL, return a
specific forward-migration proposal for review instead of rewriting history.

## Workflow and failure behavior

1. Configuration-only inspection parses the selected file and target record and
   produces fixed, sanitized results. It performs no network I/O.
2. A separately explicit read-only inspection connects to the approved target,
   verifies TLS, database/user identity, migration journal and relevant grants,
   then closes its pool. It does not create roles or alter the database.
3. Migration planning compares the immutable local journal/hashes with the target.
   Unknown, divergent or newer target history blocks application. An empty schema
   and an existing populated staging schema have distinct paths.
4. An explicit apply operation requires the exact inspected target and candidate,
   rechecks identity/history, serializes concurrent migration attempts, applies
   the reviewed migration chain, and verifies restricted grants. A prior plan
   does not authorize a changed target or changed SQL.
5. Runtime probes use restricted credentials and rollback-only synthetic
   transactions for permission/integrity checks. Never use owner credentials to
   claim the runtime's permissions passed.
6. On failure, close pools, emit only bounded error categories and leave an honest
   incomplete receipt. Stop dependent operations; never reset the target, drop
   history, retry destructive steps blindly or fall back to local credentials.

For a populated target, provider-side recovery capability and a verified backup
or restore point must be recorded before applying changes. A failed migration is
diagnosed against its actual transaction/journal state. Restore, if needed, goes
to a separate approved target first; code rollback is not a database rollback.

## Proposed ownership and dependencies

Use **two builders, then one independent reviewer**, all **GPT-6.1 Sol / High**
under the execution authority above. Every builder prompt must explicitly invoke
`$build-feature` and include this scope, ownership, baseline and dependencies.
The reviewer uses `$review` read-only and starts after the combined candidate is frozen.

| Owner                                      | Allowed implementation area                                                                                                                                                               | Dependency                                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Builder A — connection boundary            | Proposed `src/lib/db/staging-config.ts`, `staging-connection.ts`; focused unit/TLS tests; staging-only config parsing                                                                     | Freeze parsed target/config, connection lifecycle and safe-error interface first                                 |
| Builder B — migration and operator tooling | Proposed `scripts/staging-database.ts`, shared grant-policy helper, associated tests and staging runbook; narrowly refactor `scripts/migrate-local.ts` only to reuse the unchanged grants | May inventory existing migrations/privileges first; import A's exact accepted interface before connectivity work |
| Orchestrator                               | Shared package scripts, `.env.example`, test discovery/CI if required, canonical context, integration and verification scheduling                                                         | One owner for shared files and accepted source manifests                                                         |
| Independent reviewer                       | Read-only review of the frozen combined candidate and acceptance evidence                                                                                                                 | Both builders complete; no self-review substituted for independent acceptance                                    |

Proposed builder branches: `cob-g/m8-staging-connection` and
`cob-g/m8-staging-migrations`. Allocate unused ports and owned data paths at launch;
do not assume prior wave port reservations remain available. Separate worktrees
and local synthetic clusters for builders; no shared fixtures or credentials.
At most two heavy jobs initially, reduced for observed machine activity. Suites
sharing a database and checks writing the same generated output run sequentially.
Review starts after a source freeze; a repair invalidates affected evidence and
requires scoped re-review and reruns. Account for unrelated projects by actual
session ownership, never by CWD alone.

## Incremental implementation sequence

1. Reconcile this draft with the execution request; record its actual authority.
   Freeze current pins, SQL/journal and local grant expectations. Recheck relevant
   upstream advisories without forced upgrades or inventing a risk waiver.
2. Builder A adds and tests the separate connection boundary. Publish a versioned
   interface and exact file manifest. Ordinary application requests remain local.
3. Builder B implements inspection/plan/apply and grant parity against that
   interface. Root integrates shared script registration and test discovery.
4. Run separate local verification and independent combined review. Retain initial
   failures, exact candidate identity and acceptance evidence. Resolve scoped
   defects without widening target access or weakening assertions.
5. Finish a concrete provider rehearsal packet naming the target, operator,
   resource/cost scope, SQL hashes, credentials by role only, expected mutations,
   recovery plan and stop conditions. Obtain any missing external-operation
   authorization only after this packet is reviewable.
6. After that authorization, perform the actual staging rehearsal and separately
   record provider results. Advance to hosted auth/email only when this foundation
   has the necessary provider evidence.

## Verification plan — for the separate verifier, NOT RUN

- Existing scripts: `npm run check`, `npm run test:integration`,
  `node scripts/with-test-env.mjs npm run build`, and affected browser suites
  through `npm run test:e2e`. Use isolated owned test configuration. Expand browser
  coverage only if shared runtime/auth behavior changes; state the exact scope.
- New tests must match current discovery conventions in `vitest.config.ts` and
  `vitest.integration.config.ts`. New command names above are proposed; register
  and inspect their exact contract before claiming they exist.
- Meaningful connection tests: required target binding, remote/local separation,
  forged hostname/role/database, duplicate or unsafe URL options, malformed input,
  owner-as-runtime rejection, timeouts, pool cleanup and no raw-error leakage.
- Exercise real TLS with an isolated test harness: trusted certificate success,
  untrusted/expired certificate and hostname mismatch rejection. Test-specific CA
  injection belongs only to the isolated harness and cannot weaken the staging
  entry point. Mocked TLS options alone do not prove a handshake.
- Fresh and populated-upgrade migration rehearsal on owned local PostgreSQL:
  exact ordered hashes, required extension/constraints/triggers, grants parity,
  preserved synthetic records, no-op rerun, concurrent runner refusal/serialization,
  divergent history rejection and post-failure resource cleanup.
- Preserve existing real-PostgreSQL authorization and booking concurrency tests;
  prove runtime cannot grant roles, alter schema or rewrite protected history.
- Prove all existing local setup/seed/migration/restore/test entry points still
  reject remote targets and the full hosted deployment preflight still reports
  blocked auth/email/release gates. Health remains liveness only.
- Actual Neon TLS, resource identity, effective role membership, migration and
  transaction behavior require the separately authorized provider rehearsal.
  Until observed, mark those checks **NOT RUN**, never inferred from local results.
- Retain command/exit/time, source and lockfile hashes, exact target identity,
  discovered test counts, sanitized summaries and private raw evidence. No
  connection strings, auth payloads, private rows or dumps in Git/artifact uploads.
- Manual UI verification: no UI change expected; inspect shell/private-route
  refusal if shared configuration changes. Real devices and screen-reader/forced-
  color follow-ups remain separate M8.9 evidence gaps.

## Acceptance and advancement

**Code preparation complete** requires reviewed separate staging tools, passing
local security/TLS/migration/regression checks, unchanged local safeguards,
correct test discovery, a frozen candidate and a concrete provider operation
packet. It may honestly finish with cloud checks NOT RUN.

**Staging database gate passed** additionally requires a specifically authorized
Neon target, actual encrypted/verified connection and role evidence, successful
schema/grant checks and rollback-only synthetic integrity checks on that target.
No production or public access follows from that result.

Subsequent sequence: hosted Better Auth plus restricted test email (**M2.3/M2.9,
M5.7/M5.8, M8.5**) → authorized Railway staging execution (**M8.2/M8.6/M8.9**) →
applicable founder/safety decisions and pilot approval (**M6/M8.10–M8.12**).
Full hosted auth must revisit proxy trust, cookies, abuse controls, test identity
eligibility, account recovery, private browser lifetime and capability gates;
merely adding an auth enum value is insufficient. Human M6 decisions can proceed
in parallel, but this plan does not choose jurisdictions, fees or consent rules.

## Context updates after implementation

Update `context/architecture.md` and `context/build-plan.md` with the separate
staging capability and retained local-only exception; record any approved
extension to the local-M2 decision in a new dated decision file. Update README,
`.env.example` and `docs/operations/deployment-runbook.md` only for implemented
commands and their exact scope. Add the proposed staging operator runbook.
Update `context/progress-tracker.md` with actual review and verification evidence,
keeping prepared/provider-verified/deployed/released states distinct. No business
PRD or UI-policy change is proposed. Planning does not update verified progress.

## Risks, missing inputs and approval record

- **Security:** last recorded dependency findings remain unresolved; no current
  audit was executed here and no external-exposure exception was approved.
- **Target:** no staging project/branch/endpoint or budget is selected. These are
  required for provider operations, not for isolated code preparation.
- **Provider compatibility:** effective role privileges, `btree_gist`, transaction
  behavior and actual TLS on the selected resource remain unverified.
- **Ownership:** operator and recovery responsibility must be identified before
  the provider rehearsal; do not invent a human incident owner.
- **Launch:** commercial, guardian/consent, tutor screening, legal/retention,
  verified sender, real-device evidence and release approval remain applicable.
- **Execution status:** AUTHORIZED — build-feature delegation by the execution
  request above. Normal implementation, review, local verification and scoped
  repair stages proceed automatically. No separate human blueprint-review claim.
  Reuse target operation authority only if actually supplied; none is supplied
  for cloud operations by this code-preparation wave.
- **Planning result:** Blueprint ready. The preparation turn executed no tests or
  cloud operations. Execution evidence is recorded separately as this wave runs.

## Scoped independent-review recovery — 2026-10-12

F1/F2 extend the existing least-privilege acceptance detail, not product scope:
reject effective administrative parameter ACLs and non-origin staging sessions;
reject grant options absent from the original runtime policy. Root owns the
shared staging guard, its candidate hash registration, affected boundary/probe
checks and real-PG regressions. Preserve SQL, grants, local boundaries and cloud
operation gates. Recovery history: `prompts/recovery/2026-10-12-staging-integration.md`.
Authority remains **AUTHORIZED — build-feature delegation**, not separate human
blueprint approval. Independent follow-up review and new verification are required.
