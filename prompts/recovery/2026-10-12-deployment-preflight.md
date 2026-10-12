# Deployment preflight recovery

- Status: AUTHORIZED — build-feature delegation; targeted local repair.
- Task/dispatch: task_9543d02952cb/ctx_bde263247552, 2026-10-12.
- Baseline5634e44; own cob-g/m8-deployment-preparation; M8.1/M8.3, NFR-11.
- Mode: Targeted Fix; no provider/user/data incident.

## Scoped re-review finding

Expected: bounded health I/O closes response resources on every result.
Observed in `scripts/deployment-preflight.ts`: rejecting non200 or a cache-header
mismatch throws before consuming/cancelling the body, then clears the deadline.
An invalid local response with an endless body can retain a fetch connection.
The source path is confirmed; a native-process hang has not been observed.
Initial Review's no-findings result is superseded by this Important scoped finding.

## Recommendation and boundaries

Cancel rejected bodies before throwing. Preserve deadline, URL allowlist,
redirect refusal, no credential forwarding, safe messages and all runtime gates.
Add a cancellation assertion and native loopback invalid streamed-response case.
No architecture/policy/schema/package/configuration change, reset or external
operation. No earlier repair attempts; baseline install/setup passed separately.

Recover performed diagnosis only. End Recover before applying the change, then
read-only Review and allocated Verify: dedicated tests including native local
redirect/body/deadline handling, normal check/build and start/preflight smoke.
Verification NOT RUN BY RECOVER; root owns independent acceptance.

## First allocated check — TypeScript table declaration

- Actual command `npm run check`, recorded in `.local/readiness-wave/check.log`:
  formatting and lint passed; Next type generation passed; TypeScript exited2
  before unit execution. The new final `it.each` passes raw string arrays, so
  Vitest correctly types/spreads each row as positional arguments instead of
  delivering one string-array argument (TS2345 at lines387/388).
- Targeted test-only repair: wrap each unchanged argument array in `{ args }`
  and destructure the callback. Keep all five invalid cases and throw assertions;
  no script/runtime/guard change. Re-review the test delta, then rerun normal
  check and planned build/smoke under the current allocated phase.
- Discovery exited0 and listed15 test declarations; parameterized rows are
  expanded only at execution, so15 is not the final executed case count.
- Original failed log/source hashes retained. No unit case ran in this failed
  command; Recover performed diagnosis only, not repair or verification.

## Native Node environment option collision

- Check-2 passed711 unit/component cases/36files, plus format/lint/types; build
  and two production-Node startup/PORT/binding/health/preflight smokes passed.
  The subsequent negative CLI harness failed at missing-file: actual exit9,
  expected sanitized script exit1. Earlier hosted/remote/invalid-mode cases met
  their expected exits, but the harness stopped before its final case.
- Separate allocated Verify diagnosis captured the exact missing-file command
  output in `missing-file-diagnostic.log`: Node reports the missing path and
  exits9. This bypasses the script's catch. `--env-file` is also a native Node
  option; the precise internal loader path is not established by this evidence.
- Targeted repair: use the unambiguous script option `--config` for explicit
  private configuration. Preserve the same parse/overlay behavior, flags and
  all invalid-file/config/network assertions. Update own tests/runbook/private
  harnesses; keep Node's actual pre-script `--env-file=...` in the shell startup
  command. No dependency/package/runtime gate or application change.
- Preserve both first failures and prior passing smoke/build evidence as
  historical. Re-review changed script/test/docs, rerun check/build/updated CLI
  smokes and all negative cases under the allocated phase. Save harness output
  before assertions so a new failure cannot discard its diagnostic body.
- Recover performs diagnosis/planning only. Authorization remains delegated
  M8.1/M8.3 scope; root independent acceptance is separate.

## Final separate Verify outcome

After scoped same-agent read-only re-review, check-3 passed711 cases/36files plus
format/lint/types; build-2 passed. Updated local and disabled-shell startup/PORT/
binding/health/config smokes passed (smoke-2). Five final negative CLI cases
returned their expected1/2 exits with sanitized output (cli-negative-2), including
missing config file. All owned app processes stopped; slotA released. These are
separate same-agent Verify executions, not work performed by Recover or an
independent review. Source findings are resolved for this bounded local package;
original failures remain preserved. Hosted/real-user/release gates remain.
