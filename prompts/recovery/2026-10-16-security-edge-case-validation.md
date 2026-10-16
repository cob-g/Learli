# Security acceptance validation recovery — 2026-10-16

Authority: AUTHORIZED — build-feature delegation for the bounded local test/docs
slice in `prompts/features/m8-09-security-edge-case-acceptance.md`.

## R1 — Ambiguous auth alert locator

Observed normal-build Playwright browser1: Admin passed; the new auth case
received the expected wrong-password rejection but its unqualified
`getByRole("alert")` matched both the visible form error and Next.js’s empty
route-announcement live region. Private original evidence is retained in
`.local/security-edge-case-20261016/browser-1.log` and its copied error context.
This is a deterministic test-selector defect, not evidence of failed application
authentication. No production, policy or data repair is warranted.

Recover classification: targeted test fix. Scope each tested error/status by its
expected visible content and assert it is visible; retain expected text, actual
HTTP status, no-session and all other behavioral assertions. Do not simply select
an arbitrary first alert or alter application accessibility semantics. Inspect
other unqualified alert/status selectors in the new auth case for the same cause.
Separate Implementation owns this repair, independent read-only Review must
inspect it, and Verify must rerun affected private browser coverage. Existing
unchanged runtime, build, PostgreSQL and unit evidence remain reusable; rerun
static checks for revised test source. No new user decision is required.

## R1 outcome — separate implementation, Review and Verify

Auth author changed only feedback selection to expected-content matching plus
exact-text/visibility checks. Independent Student author reconstructed the prior
reviewed source hash and verified the selector-only delta; READY FOR VERIFICATION,
zero confirmed findings. Separate targeted auth Playwright passed1/1 (5.0s), then
final combined private run passed4/4 (57.6s). Final check passed format/lint/types
and1,990 unit/component tests. Runtime/build and PostgreSQL sources unchanged;
no application repair or security-policy change. Original browser1 failure retained.
