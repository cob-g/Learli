# M8.8 — Dependency security maintenance

Status: **AUTHORIZED — build-feature delegation**, 2026-10-12.
Authority: user-dispatched Worker 1 readiness package (`task_b85adcb2a0a7`,
`ctx_082138467171`), not separate human blueprint approval.

## Outcome and traceability

Maintain a reproducible, pinned, mutually compatible dependency graph; fix current
security findings only through supported stable upgrades. Classify every remaining
advisory by installed path, runtime/development/optional-peer classification,
actual application reachability and mitigation. Map to M1.1/M1.6/M8.8 and PRD
NFR-05/06. No guaranteed zero-advisory result or launch clearance.

Baseline: `5634e44fd71e8851400e004de6bbe3554e65eae1`, initially clean branch
`cob-g/m8-dependency-maintenance`, owned checkout
`/Users/cob/orca/workspaces/learli/m8-dependency-maintenance`.
Read AGENTS.md and project-overview, architecture, ui-context, code-standards,
ai-workflow-rules, progress-tracker, prd and build-plan in canonical `context/`.
Root's uncommitted wave/lessons are read in place only.

## Scope, decisions and invariants

Included: package.json/package-lock.json exact-version updates supported by
official registry metadata/advisories; dependency-specific report at
`docs/operations/dependency-maintenance.md`; narrow README dependency paragraph;
isolated factual tracker contribution, private evidence/manifest and memory.
No terminology clarification or business decision is needed.

Choose the smallest supported stable upgrade for actual findings. Preserve Node
24.20.0/npm 11.19.0 pins unless their own compatibility/security evidence requires
a separately coordinated change. Never force dependency resolution, downgrade an
incompatible major, use unsupported overrides, suppress advisories or install
speculative libraries. Request root ownership before any compatibility edit to
source/config/tests beyond package manifests; root owns CI/shared registration.

No schema/migration/grant/authorization/data-model change is expected. Historical
migrations are immutable. Existing local auth, synthetic `.test` identities,
guardian ownership, atomic booking, private browser documents/meeting data,
capture-only email and commercial/safeguarding/production gates remain intact.
No main/peer edits/databases, inherited credentials, workers, commit/merge/push,
deployment, provider mail or real users. Assigned own ports 55501/3061/3161 only;
test commands use APP_ENV=test and AUTH_MODE=local. No private values in output.

## Implementation sequence

1. End Architect before executing audit/install investigation. Capture full and
   omit-dev baseline audits privately, installed dependency ancestry and exact
   versions; consult current official primary advisories/docs and registry peers.
2. Apply only justified package/lock changes, or document unavailable safe fixes.
   Preserve raw failed attempts. Inspect lock diff, exact pins and peer validity.
3. Under initial heavy slot A, prove pinned npm ci reproduction and publish early
   frozen package hashes plus any required compatibility diff for root acceptance.
   Release the slot promptly. Consumers need root-approved import authorization.
4. Write sanitized dependency report and factual partial tracker entry; perform
   same-agent read-only Review against blueprint and full owned diff.
5. In separately granted heavy phase(s), execute relevant check/build and real-PG
   provider-sensitive/browser regressions. Keep DB/browser and typegen/build
   sequential. Read Recover for failures before repairs, preserve assertions.
6. Record exact command/environment/exit/result/source identity; update tracker
   from actual evidence and save ignored untracked memory through Remember.

## Planned verification and acceptance

Root's frozen-result acceptance directs full check/build/database/browser suites
and local database setup NOT APPLICABLE for an unchanged runtime/config/package
result; execute scoped documentation formatting/link checks instead, in addition
to reproducible install, dependency validity and actual audit/exposure evidence.
This is a technical applicability decision, not a clean-audit waiver. Root matched
the frozen hashes in `msg_073cb8dceef5`; any subsequent runtime/package/config
change returns to root before implementation and invalidates this rationale.

NOT RUN — Architect planning only. Separate Verify executes pinned npm ci,
npm ls --all, full and omit-dev audit with dev/optional classifications, repository
`npm run check` (format/lint/typegen/unit/component), production `npm run build`,
and provider-sensitive real-PG/browser checks if updated runtime/provider versions
affect them. With graph-wide changes prefer existing full integration and default
Chromium commands, checking discovery and current ownership/privacy/concurrency/
failure behavior. UI redesign and new redundant version tests are not required.
Hosted providers, remote CI, production deployment and real mail are not run.

Safe setup uses existing owned local tooling with generated private configuration;
preserve fixtures and use only owned cleanup. Keep raw audit/evidence private under
`.local/readiness-wave/`. Same-agent Review is explicitly not independent review.
Root accepts dependency freeze and owns final combined independent acceptance.

Acceptance: no hidden findings; each safe fix reproduces under pinned npm ci and
has compatible peers, accurate installed-path/reachability evidence, relevant
current passing checks and truthful remaining risks. An unavailable upstream fix
is documented as a remaining release blocker, not silently waived. Rollback is
restoring prior package manifests followed by pinned npm ci in this checkout,
without altering data. No new policy decisions or production operations.

Context changes: factual own-checkout progress-tracker entry only; architecture,
PRD, UI and business scope remain unchanged. Final report includes review and
verification separately, failures, NOT RUN limits and SHA256 manifest of all
changed tracked/nonignored untracked files. Local memory is ignored/untracked.
