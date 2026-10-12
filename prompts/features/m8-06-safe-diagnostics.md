# M8.6 — Bounded safe operational diagnostics

Status: **AUTHORIZED — build-feature delegation**, 2026-10-12 dispatched
Worker 4 request (task_38bf0d400be1 / ctx_12c1b7bd46e1). No separate human
blueprint approval is claimed. Backend/operations slice of M8.6/M8.8;
PRD NFR-09, NFR-10, NFR-05 and QA-19.

Repository: `/Users/cob/orca/workspaces/learli/m8-safe-diagnostics`;
observed branch `cob-g/m8-safe-diagnostics`, clean baseline
`5634e44fd71e8851400e004de6bbe3554e65eae1`.

## What we are building

An operator can distinguish bounded shared mutation and idle database-pool
failures without receiving error objects or protected information. The existing
safe public responses and process-liveness health endpoint remain identical.
No terminology or material product decision is needed for this technical slice.

## Evidence and decisions

Read AGENTS.md and its eight canonical context documents in order, plus the
root-owned orchestration lessons/readiness-wave prompt in place. Shared mutation
currently translates unknown failures to 503 without signals. Connection uses
a fixed safe console error for idle pool failures and is imported by plain Node
CLI/migration/test tooling as well as the server-only auth entry point.

Use a proposed `src/lib/diagnostics.server.ts` helper with a Node crypto import
and Node perf_hooks monotonic clock as the tested Node-only dependency. The
initial crypto-only assumption failed the isolated client proof and is superseded
by the scoped technical correction recorded in the diagnostics Recover note.
Do not add the `server-only` package sentinel
to the CLI-shared connection path: plain tsx scripts cannot import that sentinel.
Runtime integration is exclusively mutation-handler.ts and db/connection.ts.
Root handles broader handler/auth instrumentation, dependency ownership, combined
test registration/CI and final canonical-document integration.

## Scope and invariants

- Fixed allowlisted categories: mutation unavailable, mutation unexpected
  failure, database setup failure, database idle-pool failure.
- One fresh internally generated UUID per emitted event; no client/header/record
  identifier is accepted or returned in the response. It identifies a log event,
  not a cross-request/user trace.
- Fixed-schema JSON line, no arbitrary metadata/error/context parameter. Reject
  runtime-invalid categories without coercion. Never inspect caught error/cause/
  stack/SQL, request body/query/headers, emails/IDs/cookies/tokens, URLs, student
  or support payloads. Expected permission/validation/rule refusals stay quiet
  except the existing AccessError 503 availability result.
- Bound emissions to 20 attempts per 60-second monotonic process window, shared
  across categories; excess is dropped. Logging/UUID failure cannot change the
  response or propagate through the pool error listener. No unbounded registry.
- Preserve response status, body, cache/referrer headers, origin/body/method
  guards, feature execution and unknown 503 semantics. No retry or commit claim.
- No schema/migration/grant/auth/provider/policy/health/UI change, analytics,
  dependency, endpoint, service or worker. Local synthetic only.

## Implementation sequence

1. Add the bounded Node-only emitter and dedicated helper tests.
2. Wire fixed events into existing shared mutation availability/unknown paths
   and connection setup/idle errors. Add handler/connection tests with malicious
   secret-like errors and requests, throwing serialization/getter traps, logging
   failures and exact response comparisons.
3. Add an isolated real-PostgreSQL read/rollback/closed-pool failure test with
   guaranteed owned-pool cleanup and no persisted fixture writes.
4. Write docs/operations/safe-diagnostics.md including local signals, safe triage,
   quotas/usage-review gaps and limited coverage. Update architecture's local
   implementation note and progress tracker without completing whole M8/NFR-10.

## Verification plan (not executed during Architect)

After root accepts frozen dependency snapshot and grants each heavy phase:
pinned npm ci; assigned local setup DB55504/dev3064/test3164; test discovery;
focused diagnostics unit/integration; npm run check; production build;
full integration sequentially with default browser regression if root allocates
those phases. No schema proof is needed because migrations/grants are untouched.
Real database test preserves rows and validates transaction rollback plus generic
failure handling. Existing health tests prove liveness semantics unchanged.
Inspect built client assets for diagnostics exclusion and private-value absence.
No UI changes: new layout/accessibility screenshots are not applicable.

Record actual commands, environment, exits, failures, source hashes, separate
same-agent read-only Review and executed Verification in the ignored assigned
report. Missing/unrun required checks are blockers, never passing evidence.
Remember saves ignored local memory. Root owns independent combined acceptance.

### Final verification ownership clarification

Root message msg_10e08a594d22 and the subsequent supervised ask reply explicitly
assign full shared-runtime real-PostgreSQL/default Chromium regression to root's
assembled-candidate acceptance. Worker-owned required checks are check, focused
actual-PG, normal production build, plain tsx compatibility, exact client-negative
proof and scoped privacy. Complete the worker handoff as **SCOPED VERIFICATION
PASSED — COMBINED REGRESSION PENDING ROOT** after these pass; never report root's
unrun checks as worker passes or whole-wave/merge readiness. Frozen runtime files
stay unchanged while final documentation/report/memory is packaged.

## Acceptance and limits

Dedicated tests demonstrate exact fixed output/UUIDs, runtime allowlist, budget,
fail-open behavior, malicious-data absence and identical response contracts.
Database pool error listener retains nonthrowing behavior. Health remains
process liveness even if DB fails. Safe operator documentation names actual
coverage and remaining hosted usage/cost/notification/read/provider gaps.
Reverting helper and its two imports/calls rolls back this additive instrumentation;
no data restoration is involved. Production incident/escalation ownership and
hosted monitoring remain launch gates; no external action is authorized.
