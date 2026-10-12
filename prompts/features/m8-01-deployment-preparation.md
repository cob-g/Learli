# M8.1 — Deployment runbook and local preflight

## Authority and baseline

- Status: **AUTHORIZED — build-feature delegation**, 2026-10-12.
- Actual request: Worker 3 of the six supervised readiness packages; deliver M8.1/M8.3 and NFR-11 locally, with no deployment or hosted gate weakening.
- Task `task_9543d02952cb`, dispatch `ctx_bde263247552`; no separate human blueprint approval.
- Checkout: `/Users/cob/orca/workspaces/learli/m8-deployment-preparation`.
- Observed branch: `cob-g/m8-deployment-preparation`; clean baseline `5634e44fd71e8851400e004de6bbe3554e65eae1`.
- Read AGENTS.md and the eight canonical context documents in their required order. Also read the uncommitted root orchestration lessons and readiness-wave blueprint in place; do not edit/import them.

## What we are building

An operator can inspect an explicit local/shell configuration, optionally check a built local process, and understand exactly what remains before any hosted release. A sanitized preflight never mutates data, sends mail, follows redirects or contacts remote services. The runbook describes actual install/build/start/port/health behavior, environment separation, deliberate migration and rollback ownership, and release gates.

## Requirement and milestone mapping

- Primary: M8.1, related M8.3; PRD NFR-11.
- Related constraints: NFR-05, AUTH-03, BR-08/16/17/18; M8.2/4/5/7/10/12 remain separate gated operations.
- Existing evidence: package scripts use `next build`, `next start --hostname 127.0.0.1`; Next config does not enable standalone output. Instrumentation validates environment. `/api/health` returns only `{ status: "ok" }`, no-store, without a DB query. AUTH_MODE permits only disabled/local. Local auth requires development/test, loopback HTTP and restricted local DB. All DB connections use localDatabaseConfig; hosted Neon URLs are rejected. Local email is private filesystem capture.

## Language and decisions

- No terminology clarification needed: shell readiness means configuration/build/process liveness, never real auth/data/email or release readiness.
- Reuse the actual server environment parser and local DB validator in a TypeScript CLI executed through installed tsx. No dependency or package-script change.
- Require an explicit mode: local (synthetic), shell (auth disabled, no integration credentials), hosted (always blocked until implemented separately).
- Configuration comes from inherited process environment plus an explicitly supplied optional env file. No automatic file discovery; no raw error/value logging. This is operator tooling, not a replacement for runtime validation.
- Optional health only targets the configured loopback HTTP origin, with no cookies, redirect following or provider requests; bounded timeout/body and exact minimal response/cache checks.

## Scope and invariants

Included proposed paths: `scripts/deployment-preflight.ts`, `tests/unit/deployment-preflight.test.ts`, `docs/operations/deployment-runbook.md`; own blueprint and factual context updates. Runtime/package/lockfile/CI/Playwright changes remain assigned to their owners.

Excluded: app routes/UI changes, schema/migrations, hosted auth/DB/mail adapters, Railway/DNS/env provisioning, real users, policy changes, stage/commit/merge/push/deploy, external delivery and further workers. Never borrow credentials or touch main/peer databases. Owned ports: DB55503/dev3063/test3163. Build/local startup use APP_ENV=test and AUTH_MODE=local with synthetic .test accounts; production NODE_ENV alone does not make this hosted.

Data/authorization changes: **None**. No new record access or booking mutation. UTC/DST/concurrency/idempotency and existing browser privacy are unchanged. Rollback for this package removes only its tooling/docs after review; retain private local state and data.

## Implementation sequence and failure states

1. Write the official-doc-backed runbook, with explicit observed vs deferred hosted behavior. Link Railway, Next.js, Neon and Resend primary sources, verified on 2026-10-12.
2. Implement an import-safe, read-only preflight evaluator and CLI; report fixed messages and named checks with exit0 scoped pass, exit1 invalid/failed local checks, exit2 hosted blocker. Do not print env values, private paths, URLs, response bodies or exception stacks.
3. Author dedicated negative/positive tests for configuration, runtime pins/build requirement, malformed/remote/privileged DBs, hosted refusal, optional health target/timeout/redirect/body/cache/privacy behavior and CLI parsing.
4. Record implementation checkpoint in tracker and a small M8 scope note in build plan; do not check off hosted M8.3 or all M8.

## Verification plan — not executed by Architect

- After granted install/setup slot: pinned npm ci and owned local setup; private env creation only, no borrowed configuration.
- Before final compatibility: root-approved exact package/lockfile frozen import with SHA256 provenance; no local package editing.
- After granted verification phase: normal `npm run check`, focused dedicated tests/discovery, production `npm run build`, and test-env `npm start -- --port 3163`; local CLI preflight including health/build checks, expected hosted exit2 and malformed/remote rejection with sanitized outputs.
- Assert live `/api/health` is200/no-store/exact minimal body; inspect socket binding and non-default PORT behavior. Stop only owned app process. Do not use integration/browser suites concurrently on owned database.
- Integration/E2E suites and responsive QA: not applicable to the unchanged app/authorization/UI; root owns combined acceptance. Record that limitation explicitly rather than claiming inherited tests passed here.
- Review is same-agent read-only, separate from actual execution; root owns independent acceptance. Preserve original failures through Recover, exact command/exit/environment/source hashes in `.local/readiness-wave/report.md` and manifest.

## Acceptance and remaining gates

- Runbook names exact current commands/configuration and ownership, forbids hosted credential reuse and fake production data, and specifies schema-compatible application rollback vs separately authorized data restore.
- Preflight is safe by default, tested and discoverable by ordinary Vitest; optional network checks cannot leave loopback or leak values.
- Local build/start/preflight verified on the accepted dependency result; scoped review ready, tracker and ignored memory accurate.
- Hosted deployment/auth/Neon TLS/migrations/Resend delivery, real consent/safeguarding/commercial/operational approvals and release go/no-go remain **NOT RUN/BLOCKED**, not missing facts to invent.

## Context updates and handoff

Append only factual own-checkout progress and M8 local-preparation scope note. Root reconciles shared documents; do not change PRD/architecture decisions. Save ignored untracked memory after Review/Verify, with separate outcomes. No material decision blocks this local slice; heavy slots and frozen dependency import are coordination dependencies.
