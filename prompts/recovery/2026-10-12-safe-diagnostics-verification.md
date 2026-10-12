# Recovery — safe diagnostics verification

Authority: **AUTHORIZED — build-feature delegation**, bounded Worker4 request.
Mode: Targeted Fix; local test harness only. Baseline5634e44, own branch
cob-g/m8-safe-diagnostics; M8.6/M8.8, NFR-09/10/05.

## Observed failure and diagnosis

First `npm run check` exited1 after format/lint/typecheck passed. Unit result:
677 PASS,1 FAIL in38 files. Only failure is safe-diagnostics.test.ts's attempt
to spy directly on node:crypto randomUUID: native ESM namespace export is not
configurable. Error output contains test/source information only. Original
`.local/readiness-wave/check-1.log` and reviewed source manifest are preserved.
No application/runtime failure, fixture pollution, reset or policy issue found.

Official [Vitest module mocking](https://vitest.dev/guide/mocking/modules)
supports an importOriginal factory returning a vi.fn wrapper. Recommend wrapping
only randomUUID in this test file while retaining its real implementation for
ordinary generated-ID tests, then inject a one-shot generation failure for the
existing negative assertion. Do not change application helper, assertions,
dependencies, global config or node_modules.

## Separate implementation and verification handoff

End Recover before changing test code. Apply the narrow mock repair and format
only affected files. Read-only Review inspects the revised test/diff; then execute
full check plus planned focused real-PG/build/client-negative proof. Preserve
first failure; no approval beyond delegated scoped repair is needed.

Tests/repair executed by Recover: NONE. Status: recommendation ready; runtime
and final verification remain separate. No production or data impact.

## Client boundary proof — second observed issue

The real application build exited0 and focused real-PG test passed. However,
isolated ignored client-boundary probe also exited0, where rejection was required.
Installed Next16.4.0 provides a browser crypto fallback: node:crypto alone is not
a hard client boundary. This is a confirmed missing technical acceptance gate,
not a production exposure of application secrets (helper contains no secrets).
No frozen runtime was sent. Original client-negative.log is preserved; its exit0
is explicitly a FAIL against the negative expectation.

Recommend Node perf_hooks performance import for the existing monotonic clock.
Unlike crypto it has no installed browser fallback, preserves plain Node tooling
and uses the same performance instance. This is a scoped correction to the
authorized Node-only technical design, not a policy or external-service change.
Amend the blueprint before implementation, then re-review, rerun full check,
focused real-PG/application build and exact same isolated client-negative build.
Require observed module rejection, never merely a nonzero exit for unrelated
fixture setup. No build/browser config or application route edits are authorized.
Recover itself executes no repair or checks for this recommendation.

## Separate coordinator execution outcome

The implementation stage applied the narrow mock and real Node monotonic-clock
import, and revised the blueprint/runbook. Same-agent read-only scoped re-review
reported no remaining confirmed source findings, READY FOR VERIFICATION.
Separate Verify passed final check678/38 files, focused real-PG1/1, normal test-
environment production build and plain tsx entry. The identical isolated client
probe now exits1 specifically for unsupported browser external node:perf_hooks;
the compiler labels this TurbopackInternalError. This is the expected negative
proof, distinct from successful normal app compilation. Runtime freeze was sent
only after all those checks. Full integration/browser and root independent
acceptance remain separate; exact commands and source identities are in the
ignored worker report. No tests were performed by Recover or Review themselves.
