# M4.11 recovery notes

Authority: AUTHORIZED — build-feature delegation, actual 2026-10-11 worker request.

## Targeted fixture correction

Read-only shared-provider review found that the new integration fixture used a private synthetic account identifier inside its public slug. This invalidates the intended privacy assertion, while the service projection itself selects no account identifier. Recommendation: generate the public fixture slug independently; retain all production code and verify projection leakage assertions against the isolated database. Recover performed diagnosis only; the build-feature implementation stage owns the change and Verify owns execution. No reset or external action is required.

## Typecheck unavailable error

Observed `.local/typecheck-first.log`: two TS2345 errors because baseline RuleError excludes status 503. Recommendation: a feature-local PublicAvailabilityUnavailable error with immutable 503 status, handled in the new endpoint only; preserve the baseline shared domain error type. First focused tests observed 19 unit and 64 PostgreSQL tests pass; typecheck failed and remains retained. Recover recommends a targeted fix; implementation and fresh Verify are separate stages.

## Repeat-run test throttle

Observed the second focused integration attempt skipped all64 cases after signup fixture creation failed; the first run had passed. Baseline helpers create accounts through real auth and retain database-backed rate counters across runs. Targeted recommendation: inspect only counter totals, clear counts in the owned synthetic test database55474 before rerunning; do not alter auth rate-limit configuration. First failure retained in `.local/provider-integration-final.log`, isolation-guarded counter recovery in `.local/throttle-recovery.log`. No private records, schema or real environment is reset.

## Full-review repeated auth return input

Confirmed read-only Review finding (Important): Next searchParams can contain repeated next values as an array; the new selectionFromReturnPath/safeBookingReturnPath forwarded that runtime input into baseline string-only safeReturnPath, whose startsWith call can throw. Recommendation: feature-local unknown-input narrowing to a string before calling the existing helper, otherwise safe account fallback; no shared auth configuration/helper change. Verify repeated return values with unit and browser auth tests. Provider bundle is unaffected and stays frozen. Recover performs diagnosis only; delegated build-feature implementation owns this targeted repair.

## Default browser legacy profile expectations

First default54 browser run observed24 PASS, catalog failure at obsolete `Booking is not available on Learli yet` assertion,29 dependent cases not run; `.local/browser-first.log` retained. Read-only diagnosis: the requested actual-date picker intentionally replaces that section, and the new public IANA selector/browser-zone query invalidates whole-HTML no-Manila and exact visitor/tutor URL-equality expectations. Recommendation: assert the new picker and simulation notice, retain no-email/public integrity checks, verify anonymous selected zone equals the browser rather than tutor account zone, and compare tutor-profile pathname while allowing viewer-specific public zone filters. No business/auth/service changes required; declared test-file overlap to coordinator before implementation. Fresh same-agent Review and full default browser rerun required.

Second catalog attempt retained at `.local/browser-recovery.log`:24 PASS, same dependencies blocked because the replacement URL pathname check ran synchronously before navigation finished (received `/tutor`). Recommendation: restore the original retrying Playwright toHaveURL assertion with a pathname predicate. This is test synchronization, not application routing or architecture failure; preserve query-per-viewer semantics and all privacy checks. No source/provider change required.

## Route streaming changes denied-profile404

Third default run `.local/browser-third.log` retained24 PASS and catalog suspension regression:expected404,received200,29 dependent cases not run. Read-only source diagnosis identifies the new route loading.tsx as an outer Suspense boundary that begins streaming before the existing awaited eligibility/notFound gate; official [Next not-found reference](https://nextjs.org/docs/app/api-reference/file-conventions/not-found) documents streamed200 versus non-streamed404 behavior. Recommendation: remove only the new loader and add picker-only Suspense after approved-public-tutor lookup; keep the exact404 denial assertion and no private projection. This is a targeted implementation fix, no policy/architecture rethink, no provider bundle change. Fresh Review, check/build, full default browser required. No reset or shared auth change.

## No-JS streamed picker

Focused existing profile-booking project with --no-deps (diagnostic only):4 PASS,1 failure in populated javascriptEnabled:false picker; heading/controls hidden because Suspense requires streamed reveal JavaScript. `.local/browser-focused-first.log` retained. Parent msg_772d62c2e5d6 warned this possibility; observed failure confirms it. Recommendation: fully await preview in the already eligibility-guarded page, remove async/Suspense panel, use native GET client enhancement for visible pending feedback. No preview/reserve/service contract change. Re-review and actual no-JS/native selection plus full default suite required; no-JS assertion will not be weakened.

## Browser-zone selector stale default

Focused six-case native attempt `.local/browser-focused-native.log`:5 PASS (including real populated no-JS native review), new browser-zone case failed expectedPacific/Auckland receivedAmerica/New_York. Source diagnosis: browser-zone router.replace updates validated server preview, while React preserves the uncontrolled select's initial default across the same form instance. Targeted recommendation: key the native filter form by validated subject/level/zone to reset uncontrolled defaults when server selection changes; assert canonical browser-zone URL and displayed select value, retain visit override and account preference cases. Provider unchanged; fresh Review and Verify required. No auth/account-zone mutation.

Focused zone attempt `.local/browser-focused-zone.log`:5 PASS, sixth browser-zone URL/select checks passed; pending status locator waited for the deliberately paused main navigation and timed out. Targeted verifier adjustment: inspect current DOM via evaluate/poll while response is held, then release the response and assert actual completed GET values. This changes test synchronization only; no weaker native/no-JS/zone assertion and no application patch claimed yet.

Current-document evaluation attempt `.local/browser-focused-pending.log` also observed5 PASS and false pending DOM predicate. The absence of pending button/status is an actual enhancement timing issue before native navigation, not merely the initial locator wait. Recommendation: flush only the pending React state synchronously in onSubmit before the browser default GET starts; preserve native submission/field values and no-JS rendering. Existing previous diagnosis is retained and corrected here; fresh Review and actual pending/no-JS checks required.

The deeper pending diagnostic timed out evaluating the old document after native navigation replaced its execution context (`.local/browser-pending-diagnostic.log`). Correction to verifier approach: capture the public busy/status/disabled DOM booleans in the real submit event through a Playwright exposed binding, assert in Node while the real navigation response is held, and always release it. This preserves actual browser submit behavior and avoids querying an unloading document; no synthetic submit or assertion suppression. Temporary diagnostic instrumentation is removed. Pending application correctness remains unproven until this case executes.

## Demo candidate pending action gap

Full default55 `.local/browser-full-before-controls.log`:38 PASS, College Support stale-selection recovery failed,16 dependent cases not run; focused baseline failure retained in `.local/browser-booking-diagnostic.log`. Temporary status-only/event-boolean instrumentation (no private values) in `.local/browser-booking-submit-flags.log` confirms a later submit event reached busy form with one checked time and no second reservation HTTP response/request after the409. The form exposes Create during candidate reload while reserve returns immediately on pending. Recommendation: native disabled state for Load/Create for any pending operation, preserving original server algorithm/idempotency and field-change version checks; controlled delayed candidate test must prove no enabled silent action. Temporary baseline instrumentation restored byte-for-byte before final checks. Parent msg_67726752dfa3 also requests public native form pageshow reset for Back; add only that lifecycle reset and browser assertion. Fresh Review/check/build/default55 required.

## Screenshot actual-date grouping

Final55 browser run passed before visual inspection; captured320/1440 images revealed first three groups could all be the same actual start day because the shared LessonTime.date intentionally expands cross-midnight intervals to a full date/time range. Confirmed UI grouping mismatch with the blueprint's actual-date groups; times themselves remain accurate. Recommendation: group only in ProfilePicker by startAtUtc formatted as the viewer-local calendar date, retain complete endpoint/offset strings within each slot and immutable provider DTO. Add independent browser expected-calendar-day grouping assertion, inspect refreshed images and rerun check/build/default55; no provider/service change, no new product scope. Final PostgreSQL service rerun proceeds separately on unchanged Node modules.

## Observed recovery outcome — separate Verify

All targeted repairs now have applicable executed evidence: final check506
unit/component cases PASS, full170 PostgreSQL cases PASS on unchanged provider/
reservation Node modules, final default55 browser cases PASS (every49 baseline
plus6 feature cases), production build PASS. Current320/1440/390 public screenshots
inspected after the date-group correction; source/client scan0 private matches.
Logs: `.local/check-date-final.log`, `.local/integration-final.log`,
`.local/build-date-final.log`, `.local/browser-date-final.log`,
`.local/privacy-scan.json`. Renewed source Review is same-agent and separate from
these executed checks; no independent or production clearance is invented.
The first failure logs and diagnostic corrections above remain retained.
