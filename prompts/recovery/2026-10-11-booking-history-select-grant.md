# Recovery — M4.9 event SELECT permission

Status: AUTHORIZED — build-feature delegation, actual 2026-10-11 M4.9 request.
Mode: 1, targeted fix. Scope: owned isolated local cluster55471 only.

Observed: initial `npm run test:integration -- tests/integration/booking-read.test.ts`
failed16/passed2; unit read tests passed7. Private original evidence remains in
`.local/evidence/integration-read-initial.log`. PostgreSQL42501 reports
`permission denied for table booking_events`; handler consequently returns503.
`scripts/migrate-local.ts` grants INSERT but not SELECT on this baseline table.
The new detail query legitimately reads its four minimal event columns.

Recommended repair: add SELECT alongside existing INSERT in that setup script;
preserve append-only history (no UPDATE/DELETE grant), immutable bookings, all
applied migrations and all peer environments. This is a necessary read permission,
not new schema or an authorization bypass. Notify coordinator of shared script
overlap before editing. Reapply existing owned dev/test migration/grant commands;
no destructive reset or migration number is required. Re-review changed query/
grant and rerun focused PostgreSQL reads, then full required verification. Retain
the first failure. No product/consent/commercial decision changes are needed.

## Follow-up diagnosis — fixture throttling

The first final-v2 focused rerun skipped29 cases because its beforeAll fixture
signup failed in the existing helper, after several fast repeated runs consumed
the persistent auth throttle allowance. Evidence:
`.local/evidence/integration-contract-v2-final.log`, createAccount failure at
signup result. The earlier v2 run passed26 cases. Recommended targeted harness
repair: reset rate_limit counters with the owned test connection at this file's
beforeAll, matching existing browser fixture practice. Never change runtime
throttle configuration or another DB. Rerun focused suite and full integration;
retain this failed attempt separately. No user/product/security policy change.

## Read-only Review finding — client clock skew

Confirmed important finding: read-status.tsx compares Date.now with a server UTC
deadline; a device clock ahead can show expiry prematurely. Recommended targeted
repair: use the server-provided deadline-minus-snapshot interval and monotonic
performance elapsed time only, never extending authoritative expired state. Keep
projection read-only and history unchanged. Add browser regression with Date.now
one day ahead, proving active initial state then expiry at the server duration.
Review revised UI and execute required browser/full checks. Core/notice contracts
are unaffected; version the already announced detail bundle hash.

## Browser diagnosis — GET labels and no-JS streaming

First full browser run:52 passed/2 failed, including all49 baseline cases passing.
Evidence `.local/evidence/browser-full-initial.log`; diagnostic snapshots were
inspected during diagnosis, before the next run replaced test-results.
Label exact matching waits because a wrapping label includes select option text;
use explicit htmlFor/id labels. Parent independently confirmed the All sentinel
defect (msg_4f1d287d15f3): normalize only exact scalar empty learnerId in guardian
page GET input to omitted, preserving strict API/service, arrays and foreign IDs.
Add All Apply regression. Second failed browser snapshot remains indefinitely on
Loading with JavaScript disabled: route loading boundaries stream resolved content
whose replacement needs client script. Use ordinary server-rendered page reads
without these new loading boundaries, and enhance native GET form/link pending
feedback while keeping previous content visible. Add actual pending screenshots
and no-JS list/filter/detail assertions. No baseline loading file is removed.
Framework references: [loading boundary](https://nextjs.org/docs/app/api-reference/file-conventions/loading),
[supported link pending hook](https://nextjs.org/docs/app/api-reference/functions/use-link-status).
This is a targeted UI/framework repair, not authorization or product policy change.
Re-review, rerun check/build and browser suite; core29/full190 PG evidence remains
applicable because read services, grants and schemas do not change.

## Follow-up diagnosis — browser audit harness waits

Repaired full run `.local/evidence/browser-full-current.log`:52 passed/3 failed,
including all49 baseline. Actual no-JS denial, All/filter/pagination/detail
assertions passed before the added axe calls timed out in disabled-script
contexts. Their stacks identify AxeBuilder.runPartialRecursive frame evaluation.
The third added test blocks native GET navigation while asking axe to evaluate
the document; page evaluation waits for navigation, which cannot proceed until
the test releases its gate. Failure contexts retained under
`.local/evidence/browser-harness-failure/`.
Recommended targeted harness repair: keep no-JS visibility, keyboard/native GET,
privacy, reflow and screenshots; audit equivalent denied markup in a JS context.
Capture deliberately pending native navigation via the browser screenshot
protocol without document evaluation, then release it; axe continues for stable
JS views and client-link pending content. This preserves assertions and actual
no-JS mode rather than enabling scripts in that regression. No isolation/DB
conflict.

The protocol probe subsequently observes no status node during blocked full
document navigation, even after an interactive Menu proves hydration. Evidence:
browser-focused-repaired.log, browser-focused-final.log and
browser-pending-hydration-probe.log (all under .local/evidence). The first two
no-JS harness failures are repaired; five functional cases pass. The native
navigation pending UX still needs a targeted application repair: progressively
intercept the hydrated GET form with useTransition/router.push, retaining native
method=get without JS. Client navigation retains the document and resets pending
on completion, eliminating unreliable pending state during document teardown.
This changes only owned read-controls.tsx; publish a new detail version/hash before
consumer replacement. Core authorization/expiry/query and write modules unchanged.
Remove protocol audit workarounds, test actual delayed client GET and link pending
with axe/screenshots plus completion reset, then rebuild and rerun full default55.
References: [Next router](https://nextjs.org/docs/app/api-reference/functions/use-router),
[React transitions](https://react.dev/reference/react/useTransition).

## Outcome from separate implementation/verification stages

Targeted repairs complete in owned checkout; core read-v2/notice-v1.1 unchanged.
Detail-v3 changes the controls-only enhancement and retains no-JS SSR. Scoped
same-agent re-review PASS; no independent review is claimed. Focused6 and full
default55 browser cases pass with real pending axe/screenshots, completion reset,
learner/filter Back/Forward, no-JS and skewed-clock expiry; evidence
`.local/evidence/browser-focused-transition.log` and `browser-release.log`.
Check492, full PG190 and production build pass in their separate verification
stage. Fifteen screenshots inspected; first failure logs retained. No reset,
provider action, policy expansion or baseline mutation algorithm change occurred.
