# Local Firefox and WebKit acceptance

This bounded M8.9 package exercises existing local synthetic journeys in real
Playwright Firefox and WebKit engines. It supports NFR-01/02/05/09; it does not
establish public-launch readiness or replace the full backend, Chromium,
provider, safeguarding or operational acceptance matrix.

## Run the harness

Use pinned Node 24.20.0/npm 11.19.0 and the root-accepted package/lockfile result.
For the supervised readiness wave, request a heavy slot before installation,
build or browser execution. Do not reuse another checkout's credentials or DB.

```sh
npm ci
LEARLI_DB_PORT=55505 LEARLI_DEV_PORT=3065 LEARLI_TEST_PORT=3165 npm run local:setup
node_modules/.bin/playwright install firefox webkit
npm run check
NEXT_TELEMETRY_DISABLED=1 npm run build
npm run test:e2e -- --config playwright.cross-browser.config.ts --list
npm run test:e2e -- --config playwright.cross-browser.config.ts
```

`local:setup` creates fresh private credentials and separated dev/test databases
only in this checkout. PostgreSQL 17 tools must be on PATH or supplied through
PG_BIN. The test wrapper loads `.env.test.local` (APP_ENV=test, AUTH_MODE=local).
The config rejects remote or ambiguous origins and starts its own production
server; do not run integration/browser suites together against this database or
build/typegen simultaneously. Changing ports requires a fresh owned setup, not
adopting another worker's config. Root integrates shared registration/CI later.

The separate config discovers only `cross-browser*.spec.ts`, with one worker,
zero retries and two projects: Firefox and WebKit. No inherited destructive
global setup runs. Engine failures remain failures; no unsupported case is
silently skipped. The default shared config and its historical 117-case
Chromium result are separate evidence, not Firefox/WebKit coverage.

## Acceptance matrix

Every row runs in each engine. Nine cases per engine are authored; verify actual
discovery before accepting that count. The scenarios select security-sensitive
navigation and native-control behavior that can differ between browser engines,
rather than duplicating every historical domain assertion.

| Case                         | Required behavior                                                                                                                                                                  | Presentation/access checks                                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public discovery             | Actual approved tutor and offered subject/level, truthful no-match, real dated matching, pending/suspended exclusion and 404                                                       | Keyboard time radio, explicit zone, native select target-height geometry, axe/overflow at 320/390/768/1024/1440 and reduced-motion 640×400 reflow |
| Native public                | No-JS native GET filtering and profile time→safe sign-in continuation; no learner parameter or automatic booking                                                                   | Phone 390×844 visible SSR controls                                                                                                                |
| Authentication               | Browser registration, private local verification capture, real sign-in, no self-assigned roles, persisted settings, logout/private sessions-page Back and server denial            | Axe/overflow across all five widths; private no-store                                                                                             |
| Guardian reservation/history | Public selection retained after auth, authorized learner only, explicit server mutation; lost response retried with same key creates one record; original UTC and simulation state | Keyboard submit/result focus; private detail axe/overflow; phone no-JS history filter/detail, noindex/no-store                                    |
| College/resilience           | Independent self learner, candidate network failure with recovery, stale time rejected with no saved booking, alternative explicitly reserved                                      | Focused error, axe, student dashboard across five widths                                                                                          |
| Ownership/meeting privacy    | Other guardian/forged learner denied, visitor denied, participant-only redirect, public payload and metadata omit private values, revoked guardian loses access                    | Boolean private-value assertions; provider is never visited                                                                                       |
| Same browser                 | Sign-out→different actor sign-in→Back clears old inline private data and rechecks exact ownership                                                                                  | Same page and context throughout                                                                                                                  |
| Revoked session              | Sign-in document clears old private data; failed sign-in and Back before successful auth cannot recover it                                                                         | Same page/context, server 401                                                                                                                     |
| Expired session              | Same assertions after actual persisted session expiry                                                                                                                              | Same page/context, server 401                                                                                                                     |

Auth/meeting fixtures use real provider registration, local captured verification
and sign-in. Trusted owner provisioning supplies only synthetic role/learner
links. The full browser auth case performs those controls through UI. Reservation
creation cases use the real mutation endpoint; read/privacy fixtures additionally
use the existing shared family fixture utility. These are visibly local
`demo_reserved`/`demo_expired` records, never paid or confirmed lessons.

Tutor profiles are unique per case and suspended in guaranteed teardown; only
owned session IDs are revoked. Bookings/events remain intact. No global truncation,
subject activation, broad deletion, auth-counter rewrite or inherited-fixture
cleanup runs. Auth budget waits respect current real throttle windows. Link
assertions verify a fresh live database TTL; expiry is never extended for tests.

## Evidence privacy and interpretation

Trace, automatic screenshots, video and HTML reporters are disabled. Public and ordinary workflow contexts
block off-origin requests. Same-browser privacy contexts preserve normal caching
without request interception and assert zero observed off-origin requests, so
Back tests retain the engines' ordinary document lifetime behavior. External link proof checks only a local 303
response with redirects disabled, never Zoom/Meet traffic. Private URLs, proof
values, cookies and identifying fixture payloads are not printed in assertions;
safe summaries use statuses/counts/booleans. Owned SDK request/navigation and
private response/mailbox parsing failures are projected to a fixed-message
rejection without retaining SDK messages, stacks or causes; status and privacy
assertions remain outside that projection. The regression first confirms a raw
SDK failure contains generated proof/cookie sentinels, then verifies the protected
child still exits1 with both absent from its list report. Explicit public-profile captures at
390/1440 contain public fixture data only and are visually inspected separately. Raw failure artifacts can still
contain synthetic page data: keep `.local/readiness-wave` private, inspect them
before sharing, and deliver only sanitized report/manifest data.

Exact commands, exits, source SHA256 manifest, accepted dependency identity,
engine versions, failures/recovery and separate same-agent Review/Verify records
belong in the owning checkout's ignored `.local/readiness-wave/report.md`.
Current implementation/evidence status belongs in `context/progress-tracker.md`.
Root owns combined registration, independent review and final acceptance.

These checks use Playwright engine builds and CSS viewport emulation. They do
not prove branded desktop Safari, real Firefox devices, iOS, Android, hardware
screen-reader announcements, OS password-manager/clipboard behavior, physical
touch input or literal browser zoom. Axe/semantic/keyboard checks are automated
accessibility evidence, not WCAG certification. Mail/provider outages and DB
concurrency retain separate backend acceptance; they are not inferred from this
selected engine matrix. Hosted Neon/Resend/Railway, remote CI, production secure
cookies, real users, commercial/guardian/safeguarding decisions and public launch
remain gated or NOT RUN under this local authorization.

## Allocated native-control compatibility correction

Root allocated `select.field` closed-control painting through `appearance:none`
after WebKit measured30px controls despite the existing44px field minimum.
The real HTML selects, labels/options, native picker, no-JS and focus remain;
existing tokens size the box. The closed OS painting is relinquished, including
its native marker; the allocated flat CSS marker below restores the dropdown
affordance without a replacement widget or new token.
[MDN appearance](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/appearance)
describes this styling/functionality separation. Final proof includes all three
select heights at320/390/768/1024/1440, focus, native workflows and public captures;
actual execution results belong in the tracker/report, with original failures retained.

Root followup msg_21e135a68e2e requires a visible dropdown affordance. The final
CSS uses two hard-stop transparent/currentColor triangles as a flat functional
marker, with existing spacing values8/12/20/32 and reserved inline text space.
This narrowly allocated control indicator is the only use of gradient syntax
allowed here; decorative gradients remain prohibited. CurrentColor follows the
existing foreground or disabled muted token; no new hue, asset or widget.
Only single-value dropdowns (no size or size0/1, not multiple) receive it.
Multi-selects/listboxes receive no marker. Disabled select fields use existing
subtle/muted/border tokens. Forced-colors mode restores native painting/marker
and clears background images; global focus and native HTML behavior remain.
The earlier marker-less draft was not accepted/frozen and is superseded.

Default and Firefox forced-color acceptance use separate fresh documents, with
axe assertions in both modes. An original immediate forced-color→default switch
produced a1.54 contrast sample consistent with an intermediate color transition;
that failed evidence is retained. Root scoped this matrix to stable operating
modes without changing runtime motion or contrast thresholds. Live OS-mode
switch transition correctness is not verified here. WebKit forced-color
emulation/hardware behavior remains outside the observed method.
