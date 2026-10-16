# Parent onboarding validation recovery

Status: AUTHORIZED — build-feature delegation. Scope: the approved M2.4 parent
onboarding unit on `feature/staging-interface-cleanup-20261016`.

## Formatter invocation

- Observed: scoped Prettier formatted supported files, then returned nonzero
  because the explicitly supplied new SQL migration has no configured parser.
- Mode: Targeted Fix; tooling invocation, not an observed application defect.
- Cause: a SQL path was passed to a formatter without SQL support.
- Recommendation: rerun scoped formatting with `--ignore-unknown`; retain the
  manually formatted SQL. Do not install another formatter or change behavior.
- Preserve all prior Part A changes, migration history, source and tests.
- Verification handoff: run normal formatting/checks, followed by isolated
  PostgreSQL and browser validation. No checks executed by Recover.
- Implementation/verification outcome: pending separate coordinator stages.

## Historical migration fixture mismatch

- Observed: first focused PostgreSQL run: 23 passed, five failed in historical
  0029/0030/0027 migration fixtures. Parent behavior and latest0031→0032
  preservation tests passed. Full check also passed: 1,768 cases, 119 files.
- Mode: Targeted Fix; tests incorrectly applied the latest grant policy to an
  intentionally pinned historical schema. The earlier adaptation also expected
  the new function in fixtures that stop before0032.
- Recommendation: preserve the exact historical function/ACL/row/ledger checks
  and historical grants through their pinned reruns. Then upgrade those owned
  fixtures to the latest candidate and run the unchanged full runtime privilege
  verifier and full protection verifier. At the intermediate0027 boundary use
  the historical grant policy. Keep the current verifier strict at87 functions.
- No application/SQL/security policy change is required. Re-review the test diff,
  then rerun focused and full isolated integration validation. Keep failed logs.
- Verification: NOT RUN BY RECOVER; correction pending coordinator stages.

## Hosted integration port assignment

- Observed: the complete integration command finished with 1,004 passing cases
  in 69 files. The eight hosted-auth cases were skipped by their failed setup:
  `Hosted tests require an assigned TLS port and test environment.`
- Mode: Targeted Fix; test-command environment, not an application defect.
- Cause: this shell omitted `LEARLI_STAGING_TEST_PORT`; CI explicitly assigns
  `55703` in `.github/workflows/ci.yml`. The test intentionally requires it.
- Recommendation: rerun only the unchanged hosted-auth suite with the documented
  test-port assignment, then use that assignment for browser validation. Retain
  the failed full-run evidence and report the aggregate across the two runs,
  rather than describing the original full run as all green. No guard change.
- Scope: isolated loopback owned TLS harness, synthetic identities and mocked
  mail only. No provider or production action. NOT RUN BY RECOVER.

## Coordinator implementation and verification outcome

- Scoped formatter invocation passed with `--ignore-unknown`; no formatter
  dependency was added and SQL remained unchanged.
- Historical fixture correction received a same-agent read-only re-review, then
  the focused 28-case PostgreSQL run passed. No runtime privilege check was relaxed.
- Current full check: 1,768 unit/component cases passed; build passed with three
  inherited mail-pattern warnings. Broad PG 1,004 + corrected hosted 8 = 1,012 unique
  passing cases across two runs. The original full run is retained as failed
  setup evidence. Selected Chromium 73/73 passed. Phone/desktop captures inspected.
- Evidence: `.local/parent-onboarding-20261016/verification.json` and its logs;
  exact source/test/migration state is bound by 842 SHA-256 hashes.
- These outcomes were executed by the separate coordinator Verify stage, not
  Recover; no independent reviewer or release/real-family approval is claimed.
