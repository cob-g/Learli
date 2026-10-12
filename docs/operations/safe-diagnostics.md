# Safe local operational diagnostics

This bounded local slice supports M8.6/M8.8 and NFR-09/10/05. It does not
establish full observability, hosted monitoring, incident staffing or launch
readiness. Authority is the 2026-10-12 readiness-wave build-feature delegation.

## Signal contract

`src/lib/diagnostics.server.ts` emits one JSON string to Node stderr, containing
exactly `event` and `correlationId`. Correlation identifiers are fresh generated
UUIDv4 values identifying individual events. They do not identify a person,
record or request and are never returned in response headers/bodies. No incoming
correlation header is trusted or echoed. Operators may use the generated event
identifier when comparing their own restricted log excerpts.

| Event                   | Instrumented location           | Meaning                                                                               |
| ----------------------- | ------------------------------- | ------------------------------------------------------------------------------------- |
| `mutation.unavailable`  | Shared JSON mutation handler    | Runtime absent or existing AccessError 503 availability refusal                       |
| `mutation.failed`       | Shared JSON mutation handler    | Unexpected service or response-serialization failure translated to generic 503        |
| `database.setup_failed` | Local connection factory        | Local configuration or pool construction failed; original exception behavior retained |
| `database.pool_failed`  | Pool idle-client error listener | Driver reported an idle connection failure; error/client objects discarded            |

Expected origin/method/body/validation/ownership/business-rule refusals produce
no diagnostic. Successful writes produce none. Categories are allowlisted at
runtime as well as through TypeScript; unexpected values are ignored without
coercion. There is no metadata/error/request parameter or global error hook.

Never add Error/cause/stack/SQL, querystrings, bodies, identity IDs/emails,
headers/cookies/tokens, private meeting links, DB URLs or student/support payloads
to these signals. This contract avoids collecting them rather than attempting
to redact an arbitrary payload afterward. Do not add free-form diagnostic
messages in feature call sites or print raw driver/provider errors during triage.

The process attempts at most 20 events total per 60-second monotonic window across
all categories. Excess events are silently dropped. Failed logger/UUID attempts
consume the same budget; logging failure never changes application behavior.
The fixed counter/window uses constant memory and no timer/worker. Restarts or
separate Node module/process instances have separate budgets. This is a bounded
local signal, not an accurate error counter, distributed limit or alert system.
Silence does not prove success, and volume beyond the budget cannot be inferred.

## Server boundary and unchanged behavior

The Node `node:perf_hooks` dependency prevents importing the helper into a Next
browser bundle. Like db/connection.ts, it must work in plain Node migration,
fixture and test tooling; a `server-only` sentinel on this shared path would
break those entry points. Keep all imports on server/Node paths. Verification
must inspect the built client output and prove an attempted client import fails.

Existing mutation response status/body and private no-store/no-referrer headers
remain unchanged. Unknown failures still return the existing generic 503; callers
must not infer a rollback, retry safety or committed result from a diagnostic.
Existing service transaction/idempotency semantics stay authoritative. Logger
failures are absorbed, and the idle-pool listener stays nonthrowing.

`GET /api/health` remains uncached **process liveness only**, returning
`{"status":"ok"}` without a DB read or diagnostic/readiness detail. A healthy
HTTP response can coexist with database or service failure. No debug endpoint,
unauthenticated readiness endpoint or public error detail was added.

## Local failure triage

1. Record the observed time, fixed event category and generated identifier from
   restricted stderr. Record the relevant safe HTTP status separately. Never
   attach auth/meeting/request/SQL payloads or private captures to a shareable
   report. Local setup credentials/captures remain in ignored private storage.
2. Check the owned local process and configured ports. `npm run db:status` reports
   owned cluster liveness without credentials; it does not prove schema or grants.
   Confirm the intended development/test environment using a sanitized tool that
   reports host/port/database names only. Never paste `.env*` or database.json.
3. For a mutation failure, check the user's authorized booking/history before
   repeating an uncertain write. Preserve the original failure and reproduce
   with owned synthetic `.test` fixtures and dedicated local test config.
4. Use Recover to classify the failure before changing behavior. Never weaken
   permissions or assertions, reset another owner's fixtures, overwrite data,
   or change booking/commercial/safeguarding policy to clear a signal.
5. Recheck the targeted negative case and appropriate broader regressions after
   repair; preserve exact command/exits, source hashes and the failed attempt.

## Coverage and remaining operations gates

Coverage is limited to mutations using handleJsonMutation and connection factory
setup/idle-pool events. Active-query failures appear only when they reach this
mutation boundary. Read queries/pages, bespoke handlers, auth-provider errors,
notification capture/delivery and startup outside this factory are not newly
instrumented. Existing auth error normalization remains separately owned and
unchanged. The diagnostics are not an audit trail or attendance evidence.

An authorized later operator still needs to inspect actual Railway CPU/RAM/
network/billing, Neon storage/compute/connections and Resend delivery/quota
information, configure available alerts or assign a documented manual review
cadence, and establish human incident/support escalation ownership. This work
does not provision/access those services, assign a cadence/operator, claim
current plan limits/prices, or promise a fixed bill. Hosted availability,
retention/access policy, production collection, email and launch approval remain
separate gates. No analytics vendor, extra dependency or background worker.

## Verification and rollback

Dedicated unit tests exercise malicious secret-like errors/requests, serialization
traps, runtime category injection, unique generated IDs, budget limits, logger/
UUID failures and unchanged responses. Mocked idle-pool error tests check that
neither Error nor driver client is inspected. A real isolated PostgreSQL test
checks safe SQL failure/rollback, closed-pool translation and unchanged health
liveness, without persisted fixtures. Actual executed outcomes belong to the
progress tracker and worker evidence; this document is the contract, not a pass.

Rollback removes the helper imports/calls and restores the earlier fixed idle
pool message. No schema, migration, database record, dependency, policy or health
route change requires reversal.
