# Local support verification recovery

Authority: AUTHORIZED — build-feature delegation, scoped local test repairs.
Mode: Targeted fix. Environment: isolated synthetic local PostgreSQL 55454.
Baseline: `3a055de`, branch `cob-g/m5-9-support-reporting`, uncommitted feature.
Related: M5.9 / OPS-05 / ADM-03, authorized support blueprint.

Observed first `npm run check` failed Prettier on chained calls in the new
integration test. First `npm run test:integration`: 70/75 passed, five support
tests failed creating synthetic accounts in the existing helper after previous
signups consumed the configured IP-based auth throttle. Failure was a missing
signup user payload, before those case assertions; no app support invariant was
shown broken. Existing nonparallel suite and learner browser tests already use
test-only counter resets for independent fixtures. No real data or other cluster
was touched. Private logs: `.local/check.log`, `.local/integration.log`.

Recommendation: format the new integration file to stability; reset isolated
test auth counters between new support cases so signup fixtures don't share
throttle budget. Keep real application auth/support rate limits and existing
tests/guards unchanged. Inspect lint/typecheck findings if any; re-review changed
tests, then rerun full check/integration, build and browser verification.
No reset of customer data, broader architecture or new product decision needed.

Recover performed diagnosis only. Proposed repair and verification belong to
the separate implementation/verification stages; no independent QA is claimed.

Second checkpoint: all 75 PostgreSQL tests passed after the fixture setup repair;
format/lint passed, then TypeScript rejected the support limiter's `429` because
the shared `RuleError` union only allowed 400/403/404/409. The existing mutation
handler already safely serializes RuleError's status; no handler or permission
logic change is required. Targeted repair recommendation: add 429 to that type
union, preserving error behavior, then re-review and resume check/build/browser
verification under the delegated implementation stage.
