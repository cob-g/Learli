# Directory time filters — scoped recovery history

Status: AUTHORIZED — build-feature delegation; targeted repair handoff.
Baseline: b6cf237554b3d46e1e4c58ce10e1ef3ebafe10c0, isolated directory branch.
Scope: M3.5/M4.11 PUB-03 MATCH-02/03, local synthetic only.

## R1 — same-query pending state (read-only Review)

Observed: TutorFilterForm sets pending on submit and only resets by remounting
under the canonical URL key. A Next Form navigation to the identical canonical
URL does not guarantee a remount, so the action can remain Loading tutors.
Confidence: confirmed source path; runtime checks have not run.
Impact: reversible UI loading feedback defect; no write or private-data impact.
Mode: Targeted Fix. Prior attempts: none.

Recommendation: preserve the original native GET form for both variants and
enhance only pending feedback, clearing it on page restoration. Full document
navigation gives a fresh pending state even for identical submissions. Keep
no-JS controls, canonical safe SSR and Next links unchanged. Add a real-browser
same-query submission assertion. No dependency, policy or ownership expansion.

Authority: AUTHORIZED — build-feature delegation for this reversible repair.
Recover performed no implementation or verification. Separate implementation
must apply the repair, then fresh read-only Review and executed Verify must
check same-query loading, Back, no-JS and prior directory behavior.

## R2 — formatting gate in executed Verify

Observed: npm run check exited1 at format:check, reporting only the newly added
tests/integration/directory-time-filters.test.ts. Evidence: own ignored
.local/next-wave/check-1.log. Lint/typecheck/unit stages did not execute in that
attempt. Mode: Targeted Fix; source of failure is unformatted new test text.
Recommendation: format that test file only, inspect the whitespace diff, then
fresh read-only scoped Review and rerun check. The separately started real-PG
suite may complete on its unchanged logic; formatting alone does not invalidate
its behavior evidence. No application/policy/dependency/DB reset required.
Authority: AUTHORIZED — build-feature delegation. Recover executed no repair
or tests. Preserve the original failed log and do not label it passing.

## R3 — query key ordering in executed Verify

Observed: check-2 passed format/lint/typecheck but failed the round-trip unit
assertion: sanitizeDirectoryParams marked a tutorsHref URL as changed solely
because object key insertion order differed. Other616 cases passed; full real-PG
suite348/348 passed independently. Evidence: check-2.log and integration-1.log.
Mode: Targeted Fix. Root cause: JSON serialization compared key order rather
than each allowlisted key/value. No data leak or expanded results observed.
Recommendation: compare key count and per-key serialized values, retaining
scalar/array distinctions and safe invalid sentinels. Fresh Review and check
must validate canonical URLs without unnecessary redirects. Real-PG source is
unchanged by this search-only repair, so preserve its exact passed evidence.
Authority: AUTHORIZED — build-feature delegation. Recover made no repair or
test execution; retain the original failure and follow separate stages.

## R4 — owned artifact setup in full browser Verify

Observed: browser-1 ran97 passing cases, then4 existing four-feature-integration
cases failed with ENOENT while writing observation JSON under the ignored
.local/four-feature/recovery-final directory. The new directory project did
not execute because its dependency failed. Evidence: browser-1.log, preserved
own browser artifacts. Root cause: an inherited test assumes the local output
parent already exists; a clean owned worktree intentionally has no peer artifacts.
Mode: Targeted Fix to owned local setup only. Recommendation: create that empty
private output directory locally, without copying peer state or editing inherited
tests, then rerun the complete appropriate browser suite. Earlier97 passes are
historical; do not claim a full success or count skipped tests as passed.
Authority: AUTHORIZED — build-feature delegation. Recover creates no runtime
directories, repairs or tests; separate implementation/setup and Verify own them.

## R5 — inherited object-key truthiness in directory composition

Observed by source inspection during verification: an empty nextTimes object
inherits the constructor key. A valid public slug constructor without an open
time can pass a truthiness check against that inherited value, yielding a false
match/count. Mode: Targeted Fix; no private-data or booking-write path involved.
Recommendation: use an own-property check for inclusion and add meaningful
unit/real-PG regressions with that valid public slug and no availability. Preserve
name ordering, DTO fields and existing schema/provider contracts. Fresh Review,
check, affected real-PG and production-build/browser evidence required.
Authority: AUTHORIZED — build-feature delegation. Recover executes no repair or
test. No material policy or shared implementation-owner expansion required.

## R6 — pending navigation assertion in new browser harness

Observed: browser-2 passed all101 inherited cases, then the directory pending
assertion failed (aria-busy false) while Playwright's call log said it was
waiting for native navigation to finish. Remaining3 directory cases did not run.
Evidence: browser-2.log and its owned error-context artifact. The inherited
matching pending test already uses page.evaluate polling explicitly to inspect
the still-visible native document while holding its navigation response.
Mode: Targeted Fix to the new browser harness; runtime pending remains unproven.
Recommendation: adopt that existing evaluation/polling pattern, preserving both
aria-busy and Loading tutors assertions, then execute the4 directory cases on
the unchanged production build. Keep separate output paths so this failure's
attachments survive. The101 passing inherited cases remain applicable to the
unchanged application source; no application, DB or policy repair is indicated.
Authority: AUTHORIZED — build-feature delegation. Recover ran no experiment,
repair or tests. Fresh read-only Review and appropriate executed Verify follow.

## R7 — runtime pending still unproven after the harness correction

Observed: browser-3's direct document poll still read Apply filters/aria-busy
false;0 cases passed and3 did not run. This disproves the earlier assumption
that locator navigation waiting was the sole cause. Preserve browser-3.log and
its separate output artifacts. The pending investigation has one unsuccessful
root-cause repair attempt; do not repeat that repair or weaken the assertion.
Classification remains Mode1, localized pending feedback, with root cause
unknown; neither polluted source ownership nor invalid availability architecture
is evidenced. Recommendation: separate Verify should probe hydration, actual
React/native submit events and restoration events on the current owned build,
using an owned synthetic fixture and private diagnostic artifacts only. Return
the new evidence to Recover before any application repair. No broad reset,
provider visit, peer import or new policy is justified. AUTHORIZED — build-feature
delegation covers this scoped local diagnosis. Recover executes no probe itself.

### R7 evidence and refined handoff

Separate Verify's owned runtime probe observed hydrated React submit handler,
then its completed DOM state busy=true/action=Loading tutors…, with zero page
errors. Evidence: probe-initial.json, probe-pending-result.json and private probe
logs under .local/next-wave. Earlier probes timed out because remote evaluation
and click completion crossed a held full-document navigation; no application
repair is indicated. The two earlier pending-test approaches did not establish
runtime failure. Reclassification audit: not Mode2 (owned clean source and
unchanged build), not Mode3 (native GET and real availability architecture fit).
Keep Mode1, a browser observation harness defect.

Recommend a MutationObserver on the actual form before submit, reporting its
DOM busy/action values through Playwright's binding into the test process. Poll
that observed state while holding native navigation, preserving both assertions.
This avoids inspecting a transitioning document or React implementation internals
in the regression test. Fresh Review and4-case Verify must establish the result;
do not claim success from the probe alone. Recover performed no new repair/tests.
