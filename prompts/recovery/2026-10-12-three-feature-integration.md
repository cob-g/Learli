# Three-feature integration recovery history

Authority: AUTHORIZED — build-feature delegation, task_94ea6f3227f7 /
ctx_8f7e5db1f502; local baseline b6cf237. No reset or production action.

## R1 — shared-document import assumption

Observed import1 stopped with AssertionError: email context/architecture.md is
not append-only after verifying65 source/snapshot/report entries and importing
independent paths. Source code and snapshots remain preserved; no local services
were activated. Read-only diff shows the accepted email source inserts its local
boundary directly under authentication, rather than appending at EOF. The
byte-prefix assertion is an overly strict importer assumption, not a source or
product defect. Mode: Targeted Fix; no polluted state or foundation mismatch.

Recommend reconciling all source context diffs against their shared baseline,
retaining insertion order and all independent additions. Reject overlapping
non-additive edits for explicit inspection rather than overwrite. Preserve the
original failed assumption and source manifests. Implementation must save exact
source provenance and review resulting docs, then complete normal Review/Verify.
No tests, source edits or reconciliation were executed by Recover. No additional
product decision is needed. Status: handoff to separate implementation.

## R2 — combined coverage finding from read-only Review

Observed: combined email test checks public eligibility with a broad slug prefix,
which another fixture can satisfy. Current-recipient resolver assertion exists,
but actual post-change local capture is not yet exercised by the combined test.
Mode: Targeted Fix to owned test coverage; no confirmed application defect.
Recommend exact owner profile slug before/after and actual owned event-specific
notice dispatch/capture with private-field exclusion. Keep resolver new-address
assertion and all original protections. Re-review changed tests before full Verify.
No test execution or source/test repair by Recover. Existing frozen source remains
unchanged; delegated integration authority covers this reversible coverage repair.

## R3 — initial Verify formatting gate

Observed npm run check exits1 at format:check for only the newly authored
tests/e2e/three-feature-integration.spec.ts. Lint/typecheck/units did not run in
this attempt; original check-1.log remains. Fresh/populated migration proof
passed separately, and full real-PG suite is still running. Mode: Targeted Fix.
Recommend formatting that owned browser file only, inspect whitespace-only delta,
read-only re-review and repeat check. No application, schema or policy change;
preserve independent PG/proof outcomes. No repair/check executed by Recover.

## R4 — combined test uses the wrong public DTO field

Observed check-2 passes format/lint then fails typecheck: PublicTutor has no
subjects property (two owned combined assertions). Full PG first run reports the
same two new cases failing while other suites continue. Inspected public DTO uses
offerings with subjectSlug/subjectName, not subjects with slug/name. Mode:
Targeted Fix to integration-authored tests, not accepted application source.
Recommend use the actual offerings projection in both assertions, preserve exact
slug/name checks, re-review, repeat check and real-PG on current final test state.
Original failed logs remain; no compiler weakening, runtime change or reset.
No repair or verification by Recover; delegated test repair authority applies.

## R5 — repeat-run source fixture uniqueness

Observed integration-2 ends1 failed/387 passed across24files/388cases. The only
failure inserts a fixed Synthetic directory subject name into the retained owned
test database, violating subjects_name_unique after integration-1 created it.
The corrected three combined cases passed. Root cause is the accepted directory
test's nonunique persistent fixture name; unique slug alone does not avoid the
existing lower(name) constraint. Mode: Targeted Fix to candidate test fixture.
Recommend add a bounded random suffix to that name, retaining all assertions and
source behavior, without deleting retained data or relaxing uniqueness. Frozen
source checkout/report/hash stays untouched; record integration-only divergence.
Re-review, repeat current check/full PG; existing application build and migration
proof remain applicable. No repair/tests by Recover. Original logs preserved.

## R6 — local provider fallback logs a fixture session token

Observed full115 browser cases pass, then privacy-1 flags four files. Safe
read-only category inspection proves three matches are a public callback path
mistakenly classified as a secret. One is an actual generated32-character local
fixture session token in browser-1.log during the deliberate revocation failure.
A subsequent diagnostic excerpt also exposed that token in tool output. This is
a local synthetic credential incident; no real users, external delivery or hosted
environment is involved. No public/auth response or booking notice leaked data.

Installed Better Auth1.7.7 already has logger.disabled=true. Its onError returns
without handling unknown database errors; installed Better Call subsequently
console.error prints the raw Error including Drizzle params. Mode: Targeted Fix,
with local incident containment first. Public callback scanner matches are a
separate evidence classification defect, not application exposure.

Recommend revoke only the exact observed fixture session through the existing
provider-backed own-session endpoint, using a fresh authenticated session on that
same owned synthetic account. No direct auth-row rewrite. Preserve original log
hash and sanitized error/assertion/timing history, remove the token from delivered
text evidence and never reproduce it. Report the diagnostic exposure explicitly.

Then normalize unknown provider HTTP errors through supported onAPIError.onError:
throw a safe provider APIError500, which Better Call converts without raw fallback
logging. Preserve known APIErrors/statuses, cookies, all proof/permission/throttle
semantics and existing uncertainty UI. No global console monkeypatch, error waiver
or custom identity storage. Confirm docs/installed callback contract, add real
provider failure/log regression and original behavior checks; re-review then full
check/PG/build/browser/privacy. Correct scanner to classify only token/code query
parameters as secret, keeping public callback paths public. User delegated local
complete workflow authorizes this scoped repair; root was escalated separately.
Recover has not contained, repaired or verified anything. No production action.

## R7 — renewed browser combined harness sequencing

Observed browser-2 ends113passed/2failed: all101 inherited and12 accepted feature
cases pass on the repaired auth runtime. Combined paging checks one row before
observing completed page2 navigation, hitting the5-second expectation while20
old rows remain. The earlier combined case took27.7seconds overall; bounded21
actual-date reads are substantial. No snapshot establishes wrong final page data.
Combined auth remains in its ready new-address stage with its previous status
and no failure message; source form schedules status focus in requestAnimationFrame.
Implicit Tab/Enter can race that focus and fail to submit. Source both-code cases
pass on this same production build. These are scoped harness-sequencing hypotheses,
not a claim of a proven application defect or a waived performance requirement.

Recommend explicitly await actual page2 URL with a bounded navigation timeout,
retain exact one-row/count/order assertions, and await the specified status focus
before entering proof fields. Focus and assert the named confirmation button,
then Enter. No sleeps, forced clicks, dropped assertions or application change.
Re-review and separately execute both combined cases, then appropriate full
browser acceptance. Preserve failed logs/contexts with identifying values redacted
and original hashes. All provider/PG/build/migration evidence stays unchanged.
No test repair or execution by Recover; delegated harness repair authority applies.

## R8 — multi-navigation case total budget

Observed focused browser-3 passes the combined email case and gets past the
original paging assertion. Directory case reaches native-context teardown, then
Playwright's30-second whole-case timeout closes the context; no wrong-count or
wrong-label assertion is reported. This combined case provisions21 tutors and
performs repeated real dated directory/matching/native GET reads plus multiple
axe/screenshot checks; its earlier successful run took27.7seconds. Its default
total budget is insufficient and separate from a product response-time policy,
which remains OPEN in NFR-08.

Reclassification audit after the new failed attempt: not polluted state (one owned
sequential runner, stable build, isolated DB), not wrong feature foundation (all
source cases and exact paging assertions now pass). Keep Mode1 targeted harness
budget. Recommend60-second whole-case budget only for this composite browser
case, retain all exact counts/labels/deactivation/identity/privacy/native asserts,
and execute focused plus full acceptance. No assertion skip, clock sleep, source
performance claim or application change. Original browser-3 log remains. No repair
or checks by Recover; existing auth/PG/build/migration results stay applicable.

## R9 — failed attachment source excerpts contain private fixture values

Observed privacy-2 flags four owned browser-2 Markdown attachments only. Public/
auth responses, production sources/assets and141 notification HTML pass. The
full failed-test source excerpt also includes deliberate private meeting/learner
fixture literals; prior sanitation removed addresses/codes but not those fields.
Mode: Targeted Fix to evidence packaging, not application/test behavior.
Recommend redact all known private fixture values in those failure attachments,
preserving original hashes and assertion/state/source structure. Inspect compressed
HTML report text entries as well; no exclusion of live credentials or secret-bearing
values. Repeat privacy over final report/manifest/memory. Runtime check651/PG389/
build2/final browser115 remain applicable; no source repair or verification by
Recover. Source-side operational containment was accepted separately by root;
integration never accessed peer DBs or changed frozen source files.

## R10 — bounded handoff privacy and private original reports

Observed extended privacy-3 decodes HTML report ZIP payloads and flags all five
original Playwright HTML reports, which retain private synthetic test-step/input
metadata. Raw provider-session-failure signature is absent in their inspected
archive text; earlier unsafe browser1 log is already redacted with original hash.
These original local test reports are private evidence, not sanitized public or
handoff diagnostics. Do not imply that historical originals contain no private
fixture data.

Root msg_3319d1168892 directs bounded current-candidate privacy proof, preserved
original hash provenance and separate sanitized diagnostics; no repeated passing
application suites for redaction/report changes. Mode: targeted evidence handling.
Recommend retain the original HTML reports under a private ignored directory with
file hashes/restricted permissions, explicitly outside the clean-text claim.
Keep sanitized failure Markdown diagnostics, current code/client assets, public/
auth responses, production logs, notices and final report/manifest/memory inside
the final scan. No exclusion of active secrets from those reviewed surfaces.
No application edit, archive move or check was performed by Recover.

## Separate execution outcome

All targeted local recoveries resolved after separate implementation, read-only
re-review and verification. Current check651, PG389, build2 and final full browser5
115/115 pass; fresh/upgrade/grants proof remains applicable at unchanged inputs.
Bounded privacy4 passes with zero affected paths. Original failures, original and
sanitized hashes, exact provider containment receipt and restricted private original
reports remain. No unresolved current runtime finding, reset or launch permission.
Factual report/manifest/Remember packaging and final handoff scan follow; root
independent review is separate. Earlier diagnostic tool output cannot be removed.
