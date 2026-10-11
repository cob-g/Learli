# Learli Recovery — Four-feature integration

Authority: **AUTHORIZED — build-feature delegation**, actual 2026-10-11 local
integration dispatch; baseline024dd4d. Mode: Targeted Fix, local synthetic only.

## Migration evidence assertion

Expected: named runtime EXECUTE grant permitted, PUBLIC EXECUTE denied. Observed:
fresh migration and actual0012 upgrade commands completed; preservation/grant
checks reached the final function ACL assertion, which exited1 in
`.local/four-feature/migration-proof.log`. The verifier's substring `=X/` also
matches named grantees. This is an evidence-script defect, not proof of unsafe
application authority. Read-only function inspection establishes SECURITY DEFINER,
pg_catalog search path, named owner/runtime grants and no PUBLIC entry.

Recommend matching only an empty grantee at an ACL entry boundary, then rerun the
non-mutating proof and inspect the fresh development schema separately. Keep the
original failed log. No schema/runtime/data repair, reset or broader grant needed.
Implementation and checks: NOT PERFORMED BY RECOVER; returned to the authorized
build-feature implementation/verification stages. Independent reviews pending.

## Read-only Review handoff — combined test assertions and current status

Confirmed targeted implementation defects: the new combined browser test asserts
201 instead of the existing support mutation's200 contract and uses different
expiry wording from the imported meeting section. No execution failure has yet
occurred for these assertions. Change only the new assertions, preserving the
accepted UI/API behavior. The current tracker also needs an integration-specific
phase/goal and clear historical source evidence labels. This is targeted local
repair within the delegated contract; no architecture rethink/reset/data changes
or additional policy decision is required. Re-review the revised diff, then run
separate Verification. Implementation/verification NOT PERFORMED BY RECOVER.

## First static check — missing exact target argument

`npm run check` exited2 after formatting/lint passed; TypeScript reported TS2554
at tests/integration/four-feature-integration.test.ts:181. The new combined test
calls the existing handleAccountRequest with two arguments; its required third
argument is the exact current account user ID. This is an own test-call defect,
not a runtime service change. Targeted Fix: supply f.parent.id, re-inspect the
call and rerun the full check. Preserve check.log and do not weaken assertions or
change the imported handler. Implementation/verification NOT PERFORMED BY RECOVER.

## First full PostgreSQL run — safe booking denial assertion

Full npm run test:integration exited1:336 passed/1 failed of337. At
four-feature-integration.test.ts:170 the new test expects403 from suspended
participant booking read; readParticipantBooking returns404 when its current-authorization query produces
no eligible private booking. This existing safe boundary is correct and unchanged. Targeted Fix:
assert the existing404 while retaining actual suspension and all downstream joint
checks; re-review and rerun the full337 suite. No criteria reduction or runtime
repair. Original integration.log is retained.

The additional read-only schema verifier failed on a baseline FK name exceeding
PostgreSQL's identifier length; the actual stored name is its truncated form,
with the existing FK definition present. Normalize expected names to the actual
63-byte identifier limit (all snapshot names ASCII), retaining full column-type,
nullability, index-uniqueness and constraint assertions. Keep original fresh and
upgrade schema-proof logs. These are own test/evidence targeted fixes only;
Implementation/verification NOT PERFORMED BY RECOVER.

## Coordinator Review finding — undiscovered support component tests

Root msg_5379dbc319d5 identifies imported tests/unit/support-bookings.test.tsx
outside vitest.config.ts's include patterns. Its four input/presentation cases
were absent from historical579 source and596 combined unit counts. Targeted Fix:
move to tests/components/support-bookings.test.tsx, add the existing jsdom test
file directive, preserve all four assertions, and prove discovery/pass in full
npm run check. Record this import-path adaptation in source provenance. No include
pattern broadening, exclusion, runtime change or reclassification of prior counts.
Implementation/verification NOT PERFORMED BY RECOVER.

## First default browser run — prior authorized RSC payload retention

Full default browser command exited1:96 passed/1 failed of97; all79 baseline and
16 source cases passed, as did the combined real TTL/revocation case. At the first
combined booking→report privacy check, page.content retained the prior booking's
inline Next RSC payload after client navigation. That previous authorized payload
includes its participant-only meeting URL. The current support DTO/projections
remain minimal (realPG proof passed); this is an integration navigation retention
problem, not established unauthorized access or a support query leak.

Targeted Fix: replace BookingSupportAction's Next Link with a native anchor so
report entry performs a fresh full document navigation, retaining the same URL,
server authority, accessible text/classes and booking-ID-only association. Keep
strict fresh support document privacy assertion. Use boolean private-value checks
to avoid dumping sensitive expected strings/HTML on failure. Sanitize only actual
private URL/passcode and prior payload content in the retained failure log/report
and error context, preserving failure location, count and outcome. No screenshot
or trace was taken on the sensitive page. Record sanitization without secret
values. Re-review, fullcheck/realPG/build/defaultbrowser rerun; no criteria lowered.
Implementation/verification NOT PERFORMED BY RECOVER.

## Required actor-transition probe — test heading correction

Root msg_c29ef19f246a explicitly authorizes actual same-browser sign-out/different
actor diagnosis and a smallest session-transition repair if observed. The first
isolated probe exited1 on an own locator mismatch: expected “Account settings”
but the established account heading is “Your account”. It reached actual sign-out
and different-user sign-in but did not complete its privacy result assertions;
no privacy conclusion is claimed from that run. Correct the heading, preserve the
probe log and rerun the exact diagnosis before editing baseline SignOut.
Implementation/verification NOT PERFORMED BY RECOVER.

## Confirmed actor-transition retention — successful sign-out boundary

Corrected real same-browser probe exited1 and records actual observations in
`.local/four-feature/actor-transition-before.json`: prior private payload remains
after successful UI sign-out, different-parent UI sign-in and Back; actual link
requests deny401 then404. This confirms client document retention across actor
transition, with server authorization intact. Root msg_c29ef19f246a authorizes the
smallest session-transition navigation repair if observed.

Targeted Fix: replace only successful SignOut's router.replace/router.refresh
with window.location.replace('/sign-in'). Preserve provider sign-out, pending
button, safe error feedback and failure behavior; do not rewrite unrelated auth
or navigation. The real regression must require absence after all three stages
and still assert server denials. Keep before observations and failed probe log;
add direct fresh support navigation-response and requester DTO privacy assertions
without removing whole-document/UI absence. Re-review and execute required full
checks/build/default98 sequence; isolated probes do not replace baseline coverage.
Implementation/verification NOT PERFORMED BY RECOVER.

## Confirmed revoked-session reauthentication retention

Root-requested real revoked-session probe exited1: after-signin and Back payload
booleans remain true under a different parent; server denies old session401 and
new actor404. Separate before observations are preserved in reauth-transition-before.json.
Root msg_0c6aeb57d0d0 authorizes the conditional smallest successful sign-in repair.
Targeted Fix: only successful AuthForm sign-in replaces the full document using
existing safeBookingReturnPath-derived returnTo. Preserve validation, callback
encoding, error/pending feedback, reset refresh and all other auth modes. Keep
strict reauthentication/Back regression in default99 discovery, retain failed
probe and boolean evidence, re-review and run final verification. No broader
navigation/auth/provider change. Implementation/verification NOT PERFORMED BY RECOVER.

## Final privacy evidence scan — report fixture sanitization

The first read-only scan exited1 with path-only findings in retained report data
and embedded HTML report archives. Runtime/public-response/client/audit/notice
areas had no hits. Generated Playwright reports embed test source with synthetic
private fixture URLs/passcodes, including passing source cases, and an initial
failure archive retained a fixture value. This is an evidence-artifact privacy
problem. Targeted Fix: sanitize actual private URL/passcode and credential matches
in report text and decoded archives without changing runtime/source assertions,
counts, outcome, failure locations or command logs. Preserve original scan result
and before/after artifact hashes plus path/kind-only observations; rerun unchanged
strict scan including archives. No test criterion reduction or new runtime change.
Implementation/verification NOT PERFORMED BY RECOVER.

## Final whitespace audit — equivalent Markdown line break

`git diff --check` returned2 on the changed tracker date line's two trailing
spaces, an intentional Markdown hard break inherited from the metadata block.
Preserve the same rendered break using Markdown's explicit backslash form; rerun
the diff audit without changing content or application behavior. Targeted docs
formatting only; no verification criterion or runtime change. Implementation and
verification NOT PERFORMED BY RECOVER.

## Accepted independent findings — final targeted recovery (2026-10-12)

Status: **AUTHORIZED — build-feature delegation**; Mode: **Targeted Fix**.
Authority is the actual 2026-10-11 execution request, not separate human blueprint
approval. Root activated task_fa70e53f8944 / ctx_7e0f31b60cf3 after both read-only
reviews settled and their owners were released. HEAD remains024dd4d7 on
cob-g/m5-four-feature-integration; all91 prior candidate file hashes matched the
root manifest aggregate c0a8e172a6a9dd4dcab843338e7ba99b6a4a4d394fb7c237f7301d59e4502cff.
Accepted backend report SHA25691fb70e3f8398c87c8715552ee4de052bd3023995c4a767cd7ca1cc5eb234644;
flows report SHA2562eee61cc6b1a7b0c30349127e4ece201440f84a534acb83e497ff9808727a6ac.
Both reports and all earlier attempts/observations remain immutable evidence.

Observed F1 (Important): the authorized booking initial client props include the
private meeting URL. App Router client navigation from that document to a guarded
account page redirects a revoked session into sign-in without discarding the old
inline bootstrap. The saved beforeSigninHasPrivatePayload boolean is true even
though current APIs correctly return401/404. Earlier successful sign-out/sign-in
full replacements fixed their later boundaries only. No real-user exposure or
fresh cross-user server disclosure was established. The authorized root owner is
already involved; local synthetic scope does not require production containment.

Observed F2 (Minor): an empty current password, short new password and mismatched
confirmation yield three inline errors and first-invalid focus but no alert
summary required by UI context. This is a form interaction defect, not a provider
or credential-storage defect. Requirements: AUTH-02/03/04/05, NFR-05,
MEET-01/02/03; M2.6/M2.9 and the existing local M5 link subset.

Recommendation: add a document-lifetime boundary shared by private-workspace and
public-auth layouts. A nonpersistent boolean marks a document that has rendered
workspace content; a client transition into any public auth page replaces the
current document at its same URL before rendering auth children. Fresh public
SSR/no-JS pages remain ordinary server responses; validated next/booking intent,
reset/verification parameters and provider cookies are unchanged. A restored
private bfcache document reloads to recheck current server authority. This repairs
the lifecycle of all private bootstrap content, rather than removing a measured
URL or changing authorization. Keep the existing success replacements.

Add a visible focusable three-error password alert summary before the fields,
with named error links that focus their exact fields. Preserve first-invalid
focus, inline aria associations and credential clearing on actual submission;
summary clears on the next validated submission. No password values appear in
messages, diagnostics or captures.

Separate implementation owns these edits and truthful tracker/architecture/UI/
operations updates. Separate read-only same-agent Review follows; separate Verify
runs full check/build, strict original before-sign-in regression, revoked/expired
Back before any successful reauthentication, failed-sign-in absence, actual
three-error keyboard/phone/corrected-submission coverage and the full default
browser sequence. Do not change dependencies/schema/migrations/domain/provider
logic; retain prior337 PostgreSQL/fresh/upgrade/grant proof only after exact
unchanged relevant-source/evidence hashes establish applicability. Rerun impacted
PG checks if implemented server logic actually changes. New evidence lives only
under .local/four-feature/recovery-final/; original observation destinations must
be preserved during new browser executions. Rollback removes the new document
boundary/summary only, preserving all records and prior evidence. No reset,
external communication, commit/merge/push/deploy or release readiness follows.
Implementation and verification: **NOT PERFORMED BY RECOVER**. Unknown: actual
runtime/browser repair outcomes, to be established by separate Verify.

Read-only pre-verification Review checkpoint: root msg_07e78ce46453 and source
inspection identified a listener-lifetime gap in the initial repair. The private
layout removed pageshow on unmount even though the document-lifetime boolean
remained true. No browser failure or runtime check is claimed. Recommendation:
register the private-restoration listener once for the entire marked document,
without component-unmount cleanup; navigation/replacement ends its lifetime.
This keeps the same bounded document repair and avoids treating layout lifetime
as document lifetime. Separate implementation then repeat read-only Review and
planned Verify. No test/assertion weakening or new scope. This is the first
source-review refinement of this targeted recovery, not a repeated runtime patch.
Implementation/verification NOT PERFORMED BY RECOVER at this checkpoint.

First separate Verify: npm run check exited1; format/lint/typecheck passed,
600 cases passed and the new component summary case failed at its linked-field
focus assertion. The existing form schedules first-invalid focus with
requestAnimationFrame; the new component test immediately moved through summary
links before that scheduled focus completed. Browser source already waits for
first-invalid focus. Targeted test synchronization: wait for current-password
focus after invalid submit, then exercise summary focus and every keyboard link.
Preserve all link/aria/server-not-called/corrected-submission assertions and the
failed check.log. No runtime or criterion change. Separate implementation,
read-only re-review and repeat full check required. NOT PERFORMED BY RECOVER.

Separate implementation/Review/Verify outcome: scoped read-only re-review PASS;
fullcheck601/build/focused10/default101 PASS. Strict before-signin and revoked/
expired failed-auth/Back-without-reauth absence plus existing401/404/post-auth
denials pass; actual three-error linked-summary/corrected submission passes.
The failed first component check and source-lifetime refinement remain above.
This records separate local Verification, not tests performed by Recover or
independent root acceptance. New report/manifests/observations are under
.local/four-feature/recovery-final/; root scoped independent re-review is pending.
