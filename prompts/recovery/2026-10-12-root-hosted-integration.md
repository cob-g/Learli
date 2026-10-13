# Learli recovery — combined hosted workflow verification

- Authority: AUTHORIZED — build-feature delegation; approved eight-area local software wave.
- Mode: Targeted Fix, isolated integration checkout at baseline2fa0294.
- Status: targeted repairs verified separately; final full-wave acceptance remains pending.
- Blueprint: `prompts/features/m8-10-hosted-workflows-wave.md`.

## Observed failure

Root combined `check` passed1225 tests/72files. The first full PostgreSQL run
finished732 passed/4failed across46files in186.18s. Original log is retained as
`root-combined-pg-1.log` in the root private wave evidence directory. No source
or test input was edited during that run.

Two new migration tests append private phase logs before creating their evidence
directory. They pass in previously used worker checkouts but fail with ENOENT in
the fresh integration checkout. The staging migration test expects24 pending
migrations while the accepted cumulative chain contains25. Finally, the legacy
support-assignment preservation test compares the entire post-upgrade row except
one earlier MFA column;0024 adds `support_reviewers.valid_until`, so a preserved
legacy row differs by its new null field.

## Targeted handoff

Create each owned private evidence directory before its first write. Compare the
staging plan's exact ordered pending hashes against the entire inspected candidate
chain. For legacy support preservation, record the original column projection
before applying the forward migrations and compare all its rows and values after
upgrade. Retain actual fresh/populated migration application, historical hashes,
current schema and restricted-runtime probes. Do not strip changed original
values, skip tests, rewrite migrations, weaken grants or reset data.

Separate Verify must rerun the four affected migration files, including actual
PostgreSQL and populated preservation. Their previous failures and the732 other
passes remain separate evidence. Broader final-wave checks still follow when
W6/W7/W4b arrive. No production/provider operation or additional business decision
is involved. Recover itself changed no application/test/config files or ran tests.

## Separate verification and browser follow-up

The four repaired PostgreSQL files passed43/43. Root check2 passed1225/72 and the
combined production build passed. These are observed separate results; the first
732/4 result remains retained.

The initial private focused browser config inherited its own directory as the
server working directory and failed before startup. Its explicit root working
directory repaired that setup issue. The next actual HTTPS run passed6/7; the
history/reauthentication case filled an existing public form while the privacy
reload after Back was still replacing the document, leaving a fresh empty form
at the five-second account URL assertion. The retained failure context contains
no sign-in error. No application guard is changed: the test must observe the
fresh successful main-frame sign-in document response and load before interacting
with its hydrated form. Preserve all old-document/bootstrap/storage absence,
failed-auth, account-switch and new-login assertions. Reverify the actual7cases
and affected engines; do not mask navigation errors, add retries or pad timeouts.

The repaired7 HTTPS journeys passed separately in Chromium21.8s, Firefox24.3s and
WebKit23.1s. Root private logs retain both earlier failed attempts. The two latter
engines also record exact mirror/source-manifest identity, real TLS/peer denials,
67 client assets without current private markers and all3319/3419/56019 ports
closed. Combined production-only installation and hosted entry/shutdown passed.

The new test-only owned-placement guard passed its two focused tests; root checks3–5
then identified TypeScript-only environment type mismatches: Next augments full
`ProcessEnv` with required `NODE_ENV`, while a picked optional-key type triggers
weak-type incompatibility with its index signature. The injected environment now
uses the actual string-or-undefined dictionary contract. No runtime guard or test
assertion changed. Original failed checks remain; separate types/check6 verify the
completed type-only repair.

## Default learner-page role regression

Root normal Chromium1 ended41pass/1fail/118not-run. The unchanged wrong-role
browser assertion expected the unavailable page for a tutor; the actual page
rendered a benign empty learner list. `listLearnerGroups` introduced by admission
composition always returns groups for a verified identity, even when the only
other source is disabled and historical `listMyLearners` would reject the role.
No private learner record was exposed in the observed response.

Scoped recovery: preserve historical403 when the account has neither parent nor
student role AND admission is disabled. Keep explicitly enabled synthetic
admission's pre-role onboarding behavior unchanged. Extend the actual PostgreSQL
learner wrong-role test to cover the composed loader, retain the unchanged browser
assertion, rebuild the application and rerun normal Chromium. Preserve existing
role/ownership checks, multirole behavior and all original failure evidence.

The composed-loader repair passed49 actual PostgreSQL tests across learner and
admission files. Root same-agent read-only diff review found the two-line guard
preserves existing ownership and enabled admission paths; it is not an independent
review. Separate production build2 passed. Normal registered Chromium2 now runs
against that rebuilt code; no existing browser assertion was changed.

## Private-review Back snapshot timing

Normal Chromium2 completed145passes/1failure/14not-run. The failure is a protocol
error retrieving `page.content()` while Back changes the document, before the
privacy assertion receives content. A bounded diagnostic run passed1/1 and
recorded the main frame returning to `about:blank` without a network response;
therefore waiting for an invented sign-in response would be incorrect. Removed
the temporary navigation logger. The test now awaits load and evaluates the
restored root HTML through a locator, retaining the complete HTML/bootstrap
private-marker absence assertion. No application privacy guard, retry, catch or
arbitrary delay is added. Separate affected browser verification follows; the
145 earlier passes remain distinct evidence, not full160pass.

The selected tail browser run passed16/19, including the repaired full-HTML Back
assertion and all six admission journeys. Two W8 cases still used the producer's
hardcoded3098 in `w8-fixtures.ts`, despite the server/config using root3099. The
caller now imports the same validated placement constant. A separate admin
rotation case timed out waiting for a main-frame navigation; its cause is not yet
established. The selected `--no-deps` invocation also allowed these shared-database
projects to overlap, so the corrected tail run explicitly uses one worker. No MFA
assertion, provider guard or timeout changes; preserve the original result.

Corrected selected Chromium tail2 passed19/19 serially. The admin rotation case
passed unchanged; the earlier overlapping-run timeout's exact cause remains
unproven. Admission/safeguarding cross-browser1 passed18/18 in Firefox/WebKit.
All failure logs are retained; these do not become a single full160pass result.

## Bounded0025 provider before its presentation consumers — 2026-10-13

Mode: Targeted integration fix. Authority: **AUTHORIZED — build-feature
delegation**. Root imported the accepted34-file W6 provider v5; the full W6 UI
package is still producer-owned and has not been imported. Both isolated55919
databases migrated successfully; the populated0025 restore passed separately.

`root-0025-check-1.log` passed formatting and reached TypeScript after lint's one
unused `inArray` warning in time-off/service. TypeScript rejects three legacy
consumers: booking read-presentation indexes new workflow event names into the
old state-label map, and family-dashboard/read plus tutor booking-workspace still
type their summary state as DemoBookingState. Unit execution was not reached.
These consumers are outside the intentionally bounded provider package; no new
database authorization defect is inferred from this type failure.

Recovery: receive and inspect W6's exact final owned/shared presentation source,
then integrate against its233-file ancestor while preserving root300-file
foundation corrections. Do not invent duplicate labels, cast away type errors or
weaken tests to make a partial import compile. Re-run current check/build and
affected combined browser tests after complete source integration. Root sent the
three exact failures to the W6 owner; full package and resulting verification
remain pending. No application edit or verification was performed by Recover.

## Full W6 integrated PostgreSQL migration-test recovery — 2026-10-13

Targeted test-integration repair, AUTHORIZED — build-feature delegation.
`root-fullw6-pg-1.log` completed with791 passes,12 failed tests and3 not run
under one failed setup, across50files. All12 assertions are obsolete whole-chain
counts: current26 migrations/75 functions were compared with25/60, plus related
68-table expectations not yet reached. W6 migration setup additionally requires
producer55906/56006 and an ignored producer import manifest, so correctly rejects
root55919 before connecting. These are test integration failures, not permission
relaxations. Original logs/exit1 remain.

Repair exact current-chain expectations from the reviewed journal, generated
snapshot and SQL protection inventory; keep fixed baseline historical table/row
projections and ledger hashes, surplus grant denials and exact permissions. Make
W6 test placement use the existing checkout ownership/credential guard and
validated assigned disposable port; check historical0022–0024 against their
accepted immutable source hashes and0000–0021 against baselineGit. Remove no
assertion or runtime safeguard. Re-run the six affected migration files; full
combined acceptance remains pending.

Independent publication review also found stale-snapshot directSQL authorization
under REPEATABLE READ in W7 and adjacent W6. Root allocated W7's unpublished0026
forward-only READ COMMITTED entry guards for its two mutators and exact three W6
create/change/dispute definitions, preserving historical0025 bytes. Actual
pre-fix reproduction, negative guards, normal positives and independent re-review
are required. This finding withholds full W6/W7 wave acceptance despite prior
component tests; source freeze v1 remains evidence, not a final security pass.

## Combined booking/admission return regression — 2026-10-13

Root full165 Chromium finished152PASS/1FAIL/12NOT RUN; original unique output
directory and log root-fullw6-browser-1 remain. W5's unchanged guardian journey
timed out at its existing Learner admission and review link. The W6 enabled page
replaced AdmissionDetour with a differently named link lacking next, and the
new outer loadPrivatePage ran before parsing the public selection, so it stripped
that selection on authentication. This is an application composition regression,
not a test locator problem.

Targeted repair: parse the validated public choice before the first private load,
reuse the existing admission detour for an account without admitted learners,
and retain only validated public choice fields through learner selection. A saved
time may be preselected only when both instants match a freshly authorized server
candidate; stale selections remain unselected with an explanation. Server mutation
authorization/slot checks and no-JS POST restrictions remain. Preserve existing
browser assertions; add a matching/stale selection component regression, then
re-run check/build and the affected combined W5/W8/W6 browser tail.

## Disposable CI placement compatibility — 2026-10-13

Read-only inspection found that the default CI job calls ci-db.mjs, which creates
an ephemeral Docker PostgreSQL role/database and .env.test.local, whereas the new
readiness ownership helper requires a local pg_ctl marker/database.json. The clean
CI path therefore cannot start its default browser fixtures. This is a fixture
placement compatibility defect, not authorization to relax application guards.

Keep the existing local-cluster path. CI setup writes a separate private receipt
bound to the real checkout path, exact loopback test service and newly generated
owner/runtime credentials. Only CI=true accepts that distinct receipt; never forge
a local PostgreSQL ownership marker or give stop/restore tooling ownership of the
Docker service. Tests must accept the matching receipt and reject copied/wrong-
kind/missing receipts, wrong targets and absent CI mode. Remote CI remains unrun.

## Public discovery continuation after W7 profile handoff

Source review found the new readiness tutor/subject handoff was stripped at the initial private page and by authentication/admission canonicalization, which only accepted complete legacy time selections. Actual focused regression before repair:1FAIL/6PASS; the valid two-field return became /bookings/demo. Root owns a separate strict two-public-field discovery contract and canonicalization, preserving existing full time validation and rejecting private/duplicate/extra fields without downgrading malformed selections. Wire it only through the existing private-page return and admission detour/input; no learner authority or policy duration is inferred. Final combined browser acceptance must sign in from the public profile and retain the exact discovery pair. Earlier worker checks do not verify this root-only change.

SQL contract follow-up before claiming the repair complete:0023 valid_admission_selection has exact six-field parsing, so the new pair also requires a narrowly scoped forward0028 function replacement. The first helper regression is fixed and58 related units pass, but actual admission cannot yet accept the pair. Preserve0023 and all old six-field logic; add only canonical two-field recognition. Root parent blueprint records the technical repair authority and final actual-PG/browser requirements.

0028 separate Verify: owned PostgreSQL regression before migration produced two
expected failures (actual admission rejects pair, SQL validator false). After
owned dev/test forward0027/0028 migrations, the same two cases PASS in1.78s.
Original failure retained in root-discovery-pg-before-1.log; after and migration
logs are separate. No historical migration or grant relaxed. Combined browser,
full checks and final independent review remain pending.

## R15 — full component suite observed before React focus effect

Root final check2 passes format/lint/types, then1303PASS/1FAIL: the admission
uncertainty test waits for rendered alert text but immediately asserts focus.
The actual component focuses in useEffect after that DOM commit; its neighboring
invalid-field test correctly waits for observable focus. This is a test observation
race, not evidence to remove the accessibility requirement. Targeted Fix: retain
exact focused alert and disabled retry assertions, waitFor that focus condition
with the existing bounded library timeout, and rerun the scoped case and full
check. No application behavior, sleeps or timeout extension changes. Before
failure remains root-final-check-2.log; separate Verify owns execution.

## R16 — independent combined browser privacy evidence scope

The final independent reviewer observed that the new combined journey checked
only concern text after Back and did not establish the current route or old
identity/learner/booking/review/meeting/RSC erasure. This is a concrete authored
assertion gap, not a demonstrated application defect. Targeted Fix strengthens
post-switch, genuine committed Back and fresh denied-case checks with exact route,
visible current actor or denial, full HTML/raw+encoded prior private needles and
absence of action history. Only two exact current case route fields may carry its
requested URL identifier; occurrence counts and all other occurrences remain
strict. Read failures during document replacement are unsafe until observed clear.
No document-boundary/application changes, sleeps, skipped assertions or timeout
extensions. New combined journey remains NOT RUN until separate Verify executes.

## Restart reconciliation — 2026-10-13

Orca/system restart stopped prior processes. Existing root check3 completed
1,304/81 PASS; build1 reached successful final route table before restart and is
retained rather than repeated (elapsed TypeScript wall time includes the long
suspended interval and is not a performance result). Root PG1 has no final result;
old exec handles are gone, process census shows no old test/build, and own55919
cluster is stopped. Restart only the owned preserved cluster and interrupted
fullPG. The same three agent dispatches resumed themselves; no duplicate workers
were launched. Existing completed migrations and worker checks are retained.

## R17 — production trace includes private local test mail

The completed build1 emits broad filesystem tracing warnings. Actual inspection
of132 trace manifests found private .local/mail dependencies across120 traces,
including7,090 private files per affected route (exact counts in private before
receipt). These are trace references, not evidence of public client disclosure or
a deployment. A packager consuming traces could include synthetic verification
mail. Targeted Fix: Next.js supported outputFileTracingExcludes globally excludes
only private .local files and local environment files. Preserve local capture,
provider adapters and all route behavior; do not remove fixture evidence to hide
it. Verify a new production build and actual all-manifest absence, then ordinary
browser checks. Official current Next.js output documentation and installed
NextConfig type confirm the option:
https://nextjs.org/docs/app/api-reference/config/next-config-js/output .
No package update, live operation or secret values in evidence.

R16 follow-up: independent review correctly requires the actual prior case URL
after Back, rather than accepting the account page. The assertion now requires
that exact case document and all denied/private-payload checks. Browser execution
will establish whether login replaces the intervening sign-in history entry; any
different observed history must be diagnosed rather than broadening acceptance.

R17 separate Verify: production build2 exits0. All132 rebuilt nft manifests were
inspected; private .local and local-env references are0, versus120 affected
manifests before. Receipts retain counts without secret values. Browser/runtime
checks and independent review remain pending; no deployment occurred.

R16 actual combined Chromium1 reached every business-flow step then failed the
new current-actor text locator: actual account paragraph is `Signed in as EMAIL`,
while the assertion incorrectly expected an email-only element. Preserved error
snapshot establishes the correct new actor. Targeted test-only correction uses
the exact full paragraph, retaining actor identity, strict Back URL and all
private-payload assertions. No application change or privacy assertion removed.

## R18 — final delivery acceptance mapping gaps

Independent final review found two concrete adapter-level evidence gaps: the
address/material test changes only timezone/configuration, and independent College
authority tests never inspect the delivery adapter's student navigation. Targeted
Fix is test-only: prepare a real429 queue attempt, change the owned synthetic
account address while both addresses remain allowed, then assert no old/new-address
retry, immutable prepared identity and suppressed state; separately create an
actually admitted independent College booking and assert actual SDK student/tutor
navigation with no guardian link or learner details. Existing authority/provider
email-change tests remain supporting evidence, not substitutes. Root owns these
additions and serial actualPG verification after active browser work. No runtime,
policy, credential, permission, migration or live-mail change is proposed.

## R19 — password success focus can precede the committed notice

Full root Chromium1 has98PASS/1FAIL/72NOTRUN. Existing password browser case
observed the successful status paragraph but it remained unfocused for the full
5-second assertion. PasswordForm schedules focus with requestAnimationFrame in
fetch finally, independently of React committing the new notice, while also
refreshing server props. A frame is not a DOM-commit guarantee. Targeted Fix moves
notice focus to a React effect keyed to the committed notice; preserve request,
password clearing, pending/error behavior and router refresh. The original browser
assertion remains unchanged. Verify existing password components, full static/unit
check, rebuilt production app and actual scoped/full browser before acceptance.
No password/session/security policy change. Exact timing cause remains a supported
source diagnosis; no claim of a different authentication failure.

## R20 — restore runner imports new server-only delivery adapter

Restore1 stopped at module collection,0 tests: the new real delivery fixture imports
the server-only marker under Vitest's default conditions. The PG delivery suite
already uses the standard test-only empty marker mock. Add that same marker-only
mock to the Node restore test; do not mock database, provider SDK, transactions or
restore operations. No restore ran or target was reset in the failed attempt.
Separate Verify reruns the actual owned populated restore after this harness fix.

## R21 — restore CHECK canonicalization assumed one physical line

Restore2 performed real dump/restore but failed its schema proof with
check-schema-shape. Read-only comparison of actual PostgreSQL definitions and
retained schema dump identifies publication_reviews_comment as two physical
lines; its complete exact named definition occurs once. The existing comparator
splits dump lines before matching the complete definition, so it rejects an
unchanged multiline CHECK. Targeted Fix replaces the unique exact named full
definition across lines, preserving every byte outside that definition and using
the existing PostgreSQL parser canonicalization. Require exactly one match across
quoted/unquoted constraint names, retaining drift/duplicate/shape refusal. Existing
negative material-rule test, exact restored catalogs/schema and rollback probes
must still pass. Never normalize away actual rules or drop constraints in source.
Failed target remains preserved and stopped; retry uses a new owned run directory.

## R22 — admission-only regression reused a different capability composition

Full Chromium2:152PASS/1FAIL/18NOTRUN. The retained failure is an actual404
for the admission test's newly inserted legacy-demo tutor. startAdmissionMirror
reuses the complete screening/booking/publication mirror when its fixture exists;
W7 correctly scopes that mirror to synthetic-readiness tutors, excluding legacy
fixtures. This test specifically exercises admission with other capabilities
disabled, including its simulated-booking UI assertions. Targeted harness fix:
always build the admission-only one-substitution mirror on its separately allocated
port and new owned directory, leaving the previous complete-mirror symlink and
server untouched. Return its root explicitly for local-mail lookup. Preserve all
test assertions, actual public selection and stale-return checks; the separate
combined journey continues to test all eight enabled capabilities together. No
application eligibility weakening. Verify the unchanged admission tests plus
remaining Chromium tail, relevant cross-browser and full normal suite.

## R23 — cumulative browser fixtures retain stale tutor identity and MFA state

R22's unchanged admission six tests pass; scoped Chromium tail1 ends15PASS/2FAIL/
3NOTRUN. Publication's actual historical fixture insert hits tutor-profile FK:
restoreW6BrowserTutor returns early when an earlier project recreated the tutor,
but leaves this caller's startup JSON profile ID/slug stale. Refresh those two
fields from the exact fixture user-owned current row before returning. Delivery's
same-browser outsider sign-in correctly reaches two-factor because earlier W8
checks enrolled that exact synthetic admin; complete its genuine UI challenge
using only its existing owned fixture secret. Retain account-switch/Back privacy
checks and add that used factor to the local secret scan. No application, MFA
requirement, identity assertion or database constraint changes. Re-run the full
scoped ordered tail, affected engines and normal suite.

R23 tail2:19PASS/1FAIL. Tutor-identity repair and all publication assertions pass.
Delivery's new response.json inspection fails because the real auth flow replaces
the document before Playwright can retrieve the old response body. Preserve200
response assertion but choose the MFA step from the actual committed exact-origin
account/two-factor document; require the exact challenge path and known owned
factor when challenged, then the original exact account destination. No body-read
race, timeout increase, challenge bypass or private assertion relaxation.

## R24 — publication moderator enrollment persists across browser projects

Affected-engine run1:28PASS/1FAIL/3NOTRUN. Password/admission, both delivery and
both strict combined journeys pass. Publication Firefox passes4; WebKit beforeAll
correctly reaches the MFA challenge for the same fixture moderator already
enrolled by Firefox. Persist only this owned synthetic factor privately keyed by
exact moderator ID, complete the real UI challenge on reuse, and enroll through
the existing UI only for a fresh fixture. Preserve all business, privacy and MFA
assertions, no factor/session reset. Verify both publication projects together,
then full ordinary browser. No application or permission change.

R24 follow-up: publication cross2 reaches7PASS/1FAIL. Genuine reused-MFA setup
and WebKit's three publication journeys now pass. The final negative fixture hits
the real booking-overlap exclusion: each project's module counter restarts and
creates an elapsed still-confirmed booking over the earlier engine's deliberately
noncompleted negative fixture. Anchor each project's explicit historical fixtures
before the exact current tutor's earliest elapsed booking, retaining spacing and
all prior rows/constraints/assertions. Do not delete fixtures, relax exclusion,
or silently label a confirmed booking completed. Re-run both engines together.
