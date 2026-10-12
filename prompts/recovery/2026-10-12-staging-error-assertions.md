# Learli Recovery — Staging error assertion contract

Status: AUTHORIZED — build-feature delegation; targeted test-only repair.
Mode: Targeted Fix. Environment: owned local test checkout; NFR-05/09, M8.3/8.8.
Baseline0d7f2dd, child blueprint `prompts/features/m8-03-staging-connection.md`.

## Evidence and root cause

Observed focused unit command `npm test -- tests/unit/staging-config.test.ts`
failed62/77, passed15, exit1. Private original log
`.local/staging-database-wave/unit-focused-1.log`. All62 failed assertions compare
`cause: undefined` through Vitest5 toMatchObject, which requires property presence.
Actual sanitized StagingDatabaseError deliberately has no cause property. Source
inspection confirms no raw cause retention, and15 positive/lifecycle cases passed.
No production/source defect is established from these failures.

## Recommended separate implementation

Replace cause-value partial matching with explicit `not.toHaveProperty("cause")`
in unit/TLS assertions, retaining exact error category, instance and no-secret
checks. This strengthens absence verification and does not weaken validation.
No driver/config/API/local guard change, data reset or retry of unchanged assertions.

## Separate verification required

Re-review changed assertions, rerun focused77unit cases and typecheck if types
change, then proceed to planned real TLS/broader checks. Preserve original failure.
NOT RUN BY RECOVER. Execution authority is the dispatched authorized full workflow;
no separate human recovery approval is claimed. Independent combined review is root-owned.

## Outcome recorded by build-feature after separate Verify

Focused rerun77/77PASS; runtime source unchanged. Final default unit/component
check876/876PASS includes86staging/port cases; final TLS17/17PASS. The original
62failed/15passed run remains preserved, not replaced by a clean-run claim.
