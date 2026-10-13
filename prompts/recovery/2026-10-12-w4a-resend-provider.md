# W4a recovery — callback validation alignment

Authority: **AUTHORIZED — build-feature delegation**, W4a task on2026-10-12.
Baseline `2fa0294`; same-agent read-only Review inspected untracked providers,
tests and operations contract against `m5-07-w4a-resend-provider.md`.

## Original finding and classification

Important plan-integrity finding: `transactional-message.ts` nested callback
next validation checked same-origin relative shape but did not apply existing
`src/lib/permissions/return-path.ts` denials for auth/API destinations and
decoded control characters. Source-only comparison established this mismatch;
no test execution or real provider operation occurred during diagnosis.
Mode: **targeted implementation bug**, not polluted state or policy change.

## Recovery recommendation

Use the existing pure safeReturnPath helper read-only; accept a next destination
only when it equals the helper's validated result and passes current HTTPS URL
checks. Add meaningful denial assertions for API destination/encoded controls,
keeping valid account and public booking returns. Do not edit shared helper,
callbacks, permissions/config or any existing tests. Preserve source baseline.
End Recover before patching. Re-review changed validation/tests, then execute
scoped units, format/lint, typecheck and build. No reset/database/deployment/live
email is needed. Root owns any consumer contract integration.

Verification status: NOT RUN — diagnosis only at initial save.

Separate coordinator outcome: targeted patch used unchanged safeReturnPath;
final same-agent read-only re-review PASS/READY FOR VERIFICATION. Subsequent
separate Verify passed62 owned unit cases, scoped format/lint, typecheck and
production build. No failed check was hidden or relabelled; initial finding and
root-requested cache/expiry refinements are preserved in private review/report.
Status: RESOLVED BY SEPARATE VERIFICATION STAGE (same agent, distinct stages).
