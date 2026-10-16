# Cross-role booking acceptance — local validation recovery

Authority: **AUTHORIZED — build-feature delegation**, owner approval of the
cross-role recommendation, 2026-10-16. Governing blueprint:
`prompts/features/m8-09-cross-role-booking-acceptance.md`.

## Initial inspection command — targeted tooling correction

- Observed: a read-only owned-database inspection imported a TypeScript test
  helper with plain Node and failed with `ERR_MODULE_NOT_FOUND` on its
  extensionless `src/lib/db/local-config` import. It stopped before connecting.
- Classification: Mode 1, local command setup; no application defect or polluted
  data indicated. Existing scripts use the installed `tsx` loader for these
  imports.
- Proposed correction: rerun the same read-only inspection with `node --import
tsx`, preserving its owned-loopback assertion and minimal aggregate output.
- Preserve: source, credentials, schema, policy heads, bookings and owner preview.
- Verification owner: build-feature coordinator; Recovery executes no checks.

Further failed attempts, if any, must be recorded with their evidence and distinct
root cause before repair. No reset, deployment or production action is authorized.

## Independent Review — two Student test-authoring defects

- Observed by read-only cross-author Review before runtime execution: the new
  same-booking link update invokes a helper that selects only `Save meeting link`.
  The actual existing-link control is `Replace meeting link`.
- Observed: new Student and Admin snapshot helpers require the end time element
  to be visible for every interval. `format-time.ts` intentionally puts both
  endpoints in the date range when an interval crosses the viewer's midnight;
  the end time element then has empty text.
- Classification: Mode 1, targeted test corrections. No application or policy
  defect is indicated. The checks were not yet executed and are not failed
  runtime reproductions.
- Proposed correction: select the two supported meeting-save labels, and assert
  actual UTC attributes plus rendered date/time text for both display forms.
  Require visible time text when present; retain the full visible date range.
  Add the Parent selected-public-start equality recommended by Review.
- Preserve all prior assertions, actual network calls, database records, product
  behavior and authorization. Separate Implementation applies the changes;
  independent scoped Review must recheck them before Verify.

## Browser attempt 1 — fixture reference and redundant fresh loads

- Executed combined browser suite: Admin PASS; Student and Parent FAIL. Original
  log and both private error contexts are retained under ignored
  `.local/cross-role-booking-20261016/`.
- Parent: new historical grant reference used `historical-guardian:`. The actual
  `booking_workflow_grant_shape` constraint requires `synthetic:` followed by a
  UUID. Existing Student/Admin fixtures use that required form. All preceding
  connected Parent request/recovery/link/move/cancel steps completed.
- Student: the final account-menu button was unavailable after the earlier
  lifecycle assertions completed. The retained error context contains no DOM
  snapshot or response status. A later read-only aggregate showed the session
  lookup counter at 100; the configured limit is 100 per 60 seconds. This supports
  a burst-limit hypothesis, not a directly observed Student 429. New snapshot
  helpers redundantly navigate and immediately reload each same document, adding
  unnecessary client session lookups.
- Classification: Mode 1, targeted test-driver/fixture corrections. Preserve the
  application constraint and auth limits. No application defect is established.
- Proposed repair: use the accepted `synthetic:` reference, and perform one fresh
  document read per snapshot (reload if already at the exact destination,
  otherwise navigate). Preserve all UTC/state/identity/visibility/privacy/history
  assertions and actual logout/cookie-denial checks. Add explicit status-only
  diagnostics if the logout failure recurs; do not clear counters within cases,
  add arbitrary sleeps or substitute a direct API logout for the UI action.
- Independent scoped Review must inspect the repair before repeating the combined
  suite. Browser-test-only edits require fresh static checks; unchanged application
  build and PostgreSQL verification can be reused with source hashes checked.

## Browser attempt 2 — observed session throttling, supported logout control

- Admin and Parent PASS; Student again reaches the final account-chip logout
  step and times out. Safe Student-page diagnostics record 31 successful session
  lookups and seven HTTP 429 responses. Unlike attempt 1, this directly observes
  throttled lookups within the Student journey; the timeout DOM is still absent.
- Redundant load removal is retained, but does not by itself remove the burst.
  Recovery reclassifies using this new evidence: still Mode 1, test action
  selection under expected configured throttling, not an auth-policy failure.
- The guarded `/account` page already verifies identity server-side and renders
  a dedicated main-content Sign out button. This control remains available while
  optional account chrome has a transient lookup error. Navigating to `/student`
  alone would retain the same session-dependent workspace chrome and is not a
  reliable repair.
- Proposed repair: open the existing Account page, assert its heading and exact
  signed-in test identity/profile, click its main-content Sign out button, and
  retain the actual provider POST/200, redirect, protected document and API
  rejection assertions. Preserve rate limits, captured status diagnostics and
  all lifecycle checks; no direct API substitute, sleeps or counter reset.
- Preserve attempt 2 log/error context. Independent scoped Review must recheck
  this last test edit, followed by fresh static and combined browser verification.
