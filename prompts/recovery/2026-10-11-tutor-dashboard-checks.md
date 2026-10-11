# M5.5 tutor dashboard check recovery

Authority: **AUTHORIZED — build-feature delegation**, actual dispatched local
tutor dashboard request dated2026-10-11. Mode: Targeted Fix; local only.
Baseline `0c078bf50f9f967b20391ef3640353a7b3897e62`, branch
`cob-g/m5-5-tutor-dashboard`, PRD OPS-02/TUT-06/BKG-04.

## Attempt1 — static lint

Observed: `npm run check` exited1 after format PASS; ESLint
react/no-unescaped-entities at tutor/error.tsx18:18. Evidence retained in ignored
`.local/check-preintegration.log`; existing8 component tests previously passed.
Cause: a literal apostrophe in JSX body copy. No policy, environment, dependency
or data issue; typecheck/unit stages of the check command did not execute.
Proposed smallest repair: encode the apostrophe without changing rendered copy.
Preserve authorization, provider integration gate and every existing suite.
Separate implementation owns repair; then read-only re-review and rerun check.
Recover executed no repair or verification; no new product decision needed.

## Attempt2 — PostgreSQL fixture setup

Observed full `npm run test:integration`:161 baseline tests passed; own9 tests
skipped because beforeAll fixture INSERT failed with `text + integer` at
reservation helper. Evidence `.local/integration-first.log` retained. PostgreSQL
infers parameters first used as text accordingly; the helper subsequently adds
integers to them. This is a targeted test-fixture defect, not provider access,
schema or business behavior. The matching browser fixture uses the same SQL.
Proposed repair: cast hour/TTL numeric operands explicitly to integer in both
owned helpers; preserve600-second immutable lifetime and real queries. Separate
implementation, read-only re-review, then full integration rerun. Recover itself
executes no changes/tests; no new authorization gate.

## Attempt3 — immediate full-suite repeat

Observed `.local/integration-with-race.log`:116 tests passed including the new
real blocked-profile/current-role race; baseline bookings55 skipped because
sign-up fixture response had no user object. Suites were sequential, with no
browser concurrently using this DB. Existing auth rules cap sign-up/sign-in at10
per60seconds; baseline booking beforeAll does not clear counters. Retained test
throttle state after the preceding full suite is the likely cause; exact HTTP
status was not captured by the baseline helper, so this remains an inference.
Safe scoped verification recovery: clear only synthetic rate counters in the
owned local test database55473, preserve all records/auth rules, rerun full suite
sequentially and record result. No test assertion or baseline helper changes.
Recover itself executes no reset, tests or code changes.

## Attempt4 — no-JavaScript streaming

Observed default single-worker browser suite53PASS/2FAIL, all49 baselinePASS.
Both empty and populated tutor reads with JavaScript disabled remain on the
automatic loading.tsx fallback after data finishes. Initial loading status does
render. Failed console evidence retained `.local/e2e-first.log`; error contexts
were inspected, then overwritten by Playwright's focused output cleanup.
parent also reported this provider rendering pattern. Targeted rendering defect:
automatic Suspense completion requires client script to reveal streamed content.
No access/data/business change is needed. Proposed scoped repair: remove own
route automatic loading boundary, provide explicit native GET refresh form with
client-enhanced transition/status announcement for slow refreshes. Verify first
reads/navigation both empty/populated without JS and real-lock pending refresh
with JS. Keep visible assertions; do not edit imported detail/provider files.
Parent msg_c6eb013eed49 explicitly authorized routine own-route loading recovery.
Separate implementation and read-only Review then check/build/default55-browser
rerun. No PostgreSQL service change; prior171 full PG evidence remains applicable.
Recover itself performed diagnosis only.

## Attempt5 — refresh primitive import

Observed `.local/check-refresh.log`:format/lint PASS, typecheck failed because
new refresh component imported a nonexistent components/ui/button path.
Targeted implementation error; baseline SignOut uses native button with shared
action/action-outline classes. Reuse that convention, preserving native
form/transition behavior. No new UI primitive or
dependency. Separate implementation/re-review then full check; unit stage did
not execute in this failed attempt. Recover diagnoses only.

## Attempt6 — historical fixture chronology

Read-only final fixture review found expired historical rows used a recent
creation instant even when their synthetic start time was in the past. Duration,
grid and600-second lifetime were valid, but the historical fixture did not
preserve the approved60-minute creation notice. This is a targeted owned fixture
defect, not application service behavior or a new policy. Proposed repair:
choose creation as the earlier of requested TTL creation and start minus60min;
derive expiry from that creation plus600seconds. Assert notice/horizon/duration/
grid/TTL for the current actor in the new bounded-history consumer test.
Preserve earlier synthetic records and immutable fields; no destructive cleanup
or provider edit. Separate implementation/re-review and final check/browser.
Full171 PostgreSQL evidence uses future fixtures and remains applicable.
Recover itself performs no code/database mutation or tests.
