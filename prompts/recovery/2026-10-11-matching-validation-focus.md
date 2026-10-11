# Matching validation focus recovery

Status: AUTHORIZED — build-feature delegation, actual 2026-10-11 M3.6 request.
Mode: Targeted Fix. Local synthetic environment only; baseline `0c078bf50f9f967b20391ef3640353a7b3897e62`.

Review observed that `MatchQuestions` renders level/subject errors with
`aria-invalid` and descriptive text, but only `WhenForm` focuses the first
invalid field. This falls short of the blueprint's invalid-group focus contract.
The cause is a missing focus enhancement for the first two native GET forms;
no database, permission, policy or private data failure is involved.

Recommendation: add an optional field name to matching's existing client
`ChoiceError`, focus that field inside its own form when its error is rendered,
and pass level/subject only from the question forms. Preserve native/no-JS GET,
server validation and When focus ordering. Add a meaningful component regression
and browser focus assertion, re-review, then execute the required checks.

Recovery executed no application edits, tests or resets. Verification NOT RUN
BY RECOVER. The build-feature implementation coordinator owns the reversible
repair; no additional policy/production authorization is needed.

## Verification follow-up — formatting

Observed `.local/check-attempt1.log`: repository format check stopped on the new
`tests/integration/matching.test.ts`; later stages did not run. Targeted Fix:
format only that owned test file, inspect the diff for semantic changes, then
rerun the repository check. Preserve the original log; no database/reset/policy
change is needed. Diagnosis performed no verification.

## Verification follow-up — static validation

Observed `.local/check-attempt2.log`: typecheck rejected the unannotated evolving
`tutors` test array; ESLint also warned that radio inputs do not support
`aria-invalid`. Mode1 Targeted Fix: annotate the fixture array with existing
PublicTutor, move group invalid state to its fieldset, retain descriptive error
text/focus, and remove the unsupported test-radio attribute. No query/permission
behavior changes are required. Re-review source and rerun full check.

## Verification follow-up — strict link input and progressive rendering

Observed `.local/integration-attempt1.log`:171 cases passed, one failed because the
consumer test spread a formatted candidate (date/time/zone/tutorTime) into the
strict publicProfileHref helper. The page already selects only explicit permitted
fields. Mode1 targeted test repair: pass only the two UTC instants and retain the
strict helper unchanged. Rerun the affected real PostgreSQL suite.

Coordinator message msg_eccb35ab40e6 reports peer browser evidence that automatic
loading/Suspense boundaries hide async core content without JavaScript. Own
matching loading.tsx wraps the same async route. Recommendation: remove that
owned automatic boundary, keep GET pages fully rendered, and add local submit
pending feedback to the hydrated When form. Verify genuinely populated no-JS
When/results plus pending submit in the real browser; no provider bundle edits.

## Verification follow-up — pending browser observation

Observed `.local/browser-attempt1.log`: all49 baseline cases passed; the first
matching case timed out while its own native navigation was held, with Playwright
reporting that locator visibility waited for navigation to finish. The error
snapshot alone cannot establish whether React's pending state committed before
navigation. Mode1 targeted verifier repair: observe the current DOM with page
execution while the response is held, then release it; also exercise real browser
Back with restored answers and a usable submit button. If that proves a UI defect,
repair only the pending native-submit lifecycle. Keep original evidence and do not
weaken pending/no-JS assertions; provider/query source remains unchanged.

The focused observation `.local/browser-matching-attempt2.log` established that
busy stayed false and the action stayed unchanged while navigation was held.
Unlike the first locator timeout, this is direct evidence of an uncommitted React
pending update during native GET navigation. Targeted implementation repair:
flush only this submit's pending update before native navigation and clear it on
pageshow so browser-back cache restoration remains usable. Keep GET progressive
navigation and source query semantics unchanged. Rebuild and rerun current checks
and full default browser coverage; no reset or architecture/policy change.

Further evidence `.local/browser-final.log` and `.local/browser-diagnostic.log`
shows browser-driver observation itself waits on the held native navigation; the
latter reached the test timeout before its diagnostic could evaluate. The earlier
claim that this proved a React commit defect was too strong. No server reuse is
involved (reuseExistingServer=false, no listener remained on3135). Reconsidered
Mode2/3: workspace/provider architecture remains sound; the native navigation
observation/pending approach is the local mismatch. Installed Next16.4 App Router
Form implementation supports string-action progressive GET and client navigation,
which leaves the current form visible until the RSC response. Targeted repair:
use that existing Form for When, disable prefetch, preserve native GET without JS,
hold only actual submitted result requests in the test, and verify pending/Back/
no-JS plus full baseline. No dependency or policy change is needed.

`.local/browser-matching-form.log` proves pending observation now passes; the
next assertion exposed real browser Back restoring the original When URL before
submitted day/range choices existed in it. Targeted URL-state repair: before
valid GET result navigation, replace only the current When history entry with
matchingHref built from validated visitor filters and change=when, preserving
Next's existing history state. Do not store learner/account data or arbitrary
query values. Invalid preferences still reach normal server error validation.
Verify browser Back/refresh plus native no-JS Change answers/Back, then full suite.

`.local/browser-matching-back.log` still showed an unchecked weekday on router
Back after URL replacement. The cached server question payload can predate the
updated history URL, so defaultChecked from that old payload is insufficient.
Targeted repair: make the When day/range inputs controlled and restore only fully
validated public preferences from the current URL on mount/pageshow/popstate,
checking route/subject/level first. Browser detection must not override an explicit
URL zone. Add an explicit Back URL assertion before checking controls. Preserve
partial invalid server draft and no-JS native rendering; no other storage exists.

Installed App Router history adapter inspection additionally confirms that passing
existing `__NA` history state bypasses its URL synchronization path; passing null
lets the adapter copy internal state and synchronize the canonical URL itself.
Use that supported native-history path, rather than carrying Next's internal
state marker manually. Current URL/control restoration remains strictly public.

`.local/browser-matching-current.log`: first two cases PASS, covering enhanced
pending, real Back URL/controls/refresh, responsive/forced-colors and populated
no-JS Any time. Invalid-input test matched both the correct main form error and
Next's empty route announcer. Targeted verifier-only fix: scope alert assertions
to main, preserving exact expected content and focus. Current source/backend/
build proof is unchanged; execute full default53 after this locator correction.

## Screenshot follow-up — fixed time-column alignment

All53 default browser cases passed in `.local/browser-complete.log`, but manual
`results-1440.png` inspection found varying left edges for the time column when
tutor names differ in length. UI context requires one aligned13rem time column.
Mode1 targeted layout repair: use fixed desktop grid columns minmax(0,1fr),13rem,
auto within each result row, keeping the mobile stack. Add a real bounding-box
alignment assertion for desktop rows. Re-review, check/build and actual browser
coverage; backend172 proof unchanged. Preserve screenshots/first green evidence.
