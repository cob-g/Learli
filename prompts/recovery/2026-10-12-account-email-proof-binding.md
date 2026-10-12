# Recovery — local email proof binding

Status: RESOLVED BY SEPARATE VERIFICATION — same-agent phase, local scope only.
Mode: Rethink (provider binding assumption); local unpublished implementation.
Baseline/branch: b6cf237554b3d46e1e4c58ce10e1ef3ebafe10c0,
cob-g/m2-verified-email-change. AUTH-02/03/04, M2.9.

Observed source evidence: Better Auth1.7.7 `email-otp/routes.mjs` forms the final
identifier from old and new addresses joined with a hyphen. Valid synthetic
address pairs can collide across owners. Current proof is checked on request,
but the final endpoint only checks fresh-session validity and the final code.
The initial blueprint assumed unambiguous provider binding. No live users,
external delivery or production service is affected; no exploit was executed
in Recover. Existing partial implementation and owned data are preserved.

Recommendation: return to Architect for coordinator-authorized short-lived
signed HttpOnly same-site flow binding issued after provider current proof,
bound to exact actor/session/current/new address and expiry. It must confer no
identity or ownership authority, add no auth/database rewrites, and leave code
verification/atomic consumption exclusively to the provider. Final confirmation
fails closed without binding; completion/uncertainty clears it. No new address
policy is needed. Alternative: leave this feature blocked.

Required verification after separate implementation: collision-shaped pairs,
cross-owner/session cookie swap, tampering/expiry, repeated final use, existing
code expiry/attempt limits and concurrent consumption, browser cookie behavior.
Tests NOT RUN BY RECOVER. Ask sent to coordinator using this dispatch; approval
obtained on 2026-10-12 for the revised supported hasher design below. No repair,
application edit, reset or service operation by Recover.

Final recommendation supersedes cookie proposal: provider-supported
`verification.storeIdentifier` prefix hash overrides, default plain for unrelated
flows, request-scoped AsyncLocalStorage and keyed purpose-preserving tuple of
complete identifier/actor/session/current/new. Fail closed without context or
with a mismatching identifier. Because provider find/consume falls back to plain
identifiers, the hasher must read-only reject an unexpected matching plain row.
No custom cookie/token/identity store, migration or direct auth-row rewrite.
Coordinator explicitly prefers this direction. Separately implement and verify
both collision orders/interleavings, session swaps, wrong-attempt recreation,
replay, absence of baseline plain OTP rows and rejection of injected plain rows.

## Review1 targeted repair handoff

Observed by read-only Review: wrapper-level concurrency test does not establish
direct provider atomic consume; injected synthetic plain row pollutes rerun
baseline checks; scoped UI/build-plan documentation and tracker spacing need
completion. Mode Targeted Fix, AUTHORIZED — build-feature delegation. Add direct
concurrent provider HTTP with supported request context, two legitimate sessions
and interleavings; isolate injected fixture after proving application rejection
without deleting/re-writing it as a workaround. Add scoped docs/spacing, then
re-review and Verify. No repair or tests executed by Recover. No reset needed.

## Verification1 targeted mapping repair

Original full integration `.local/next-wave/integration-1.log`:17 failed,
339 passed across21 files; own email suite17/19 failures. Provider
`toOTPIdentifier` in `utils.mjs` returns `email-verification-otp-...` /
`change-email-otp-...`, while initial expected identifiers omitted `-otp-`.
Fail-closed hasher refuses mismatches; no email change succeeds. One test fixture
also passed a JSON body to GET, rejected by Request construction. Check606 tests
and build passed separately. Targeted mapping/fixture defects, no unsafe
acceptance or polluted state. Proposed repair: exact provider prefixes in
expected keys/overrides/fixtures; construct GET without body. Preserve mismatch
and plain fallback rejection, failed evidence, re-review, then repeat affected
check/build/integration and run actual browser. No repair/tests by Recover;
AUTHORIZED — build-feature delegation.

## Verification2 component timing handoff

Corrected integration passes21 files/356 tests, including all19 new provider
cases. Second check passes format/lint/typecheck but one component case races
the expected requestAnimationFrame status focus before typing the next step;
605 pass/1 fails. This is a test sequencing defect: wait for the specified safe
status focus before entering next-step values, and await pending-state render.
Do not weaken the focus/pending assertions or alter provider/source protections.
Targeted test fix under delegated authority, followed by read-only review and
current check. Reuse exact-source integration/build evidence; tests NOT RUN BY
RECOVER and original failure log retained.

## Production browser context ownership — Rethink

Original production browser run101 passed/3 new cases failed, exit1,
`.local/next-wave/browser-1.log`. All new calls fail closed with missing context.
Observed `lib/auth.ts` caches an auth runtime globally, while Next emits multiple
bundles containing the module-level proof AsyncLocalStorage. Route/service
imports can therefore enter a different instance than the cached factory's
supported hasher. Real provider integration in one module graph did not expose
this production bundling assumption. No unsafe acceptance or external exposure.

Return to Architect: make a private binding object per createLocalAuth runtime,
capture it in provider hash closure, return its scoped-run method alongside that
same auth runtime, and call that method from service. No global current-request
variable, custom identity store or new design authority. Preserve namespace/
plain guard semantics, record source hashes, re-review and repeat check/build/
real PG and actual full browser. Tests/builds/repairs NOT RUN BY RECOVER.

## Production browser2 — scoped locator and contrast diagnosis

Full browser2 preserves101 original passes/3 new failures. Runtime-owned proof
context works: current/new request reaches pending UI; real partial revocation
failure and stale-session messages appear correctly. Two page-wide alert
locators match both the intended form alert and Next route announcer; scope them
to the named email region, retaining text/focus assertions. A pending-stage axe
check reports color-contrast but only the rule ID was recorded. Do not waive it:
collect node selector and color/ratio diagnostics and determine whether source
or test timing needs repair. Mode Targeted Fix / diagnosis, not the earlier
provider binding failure. Preserve original logs and original101 passing cases;
no tests, source repairs or verification by Recover.

## Browser3 contrast root cause — Targeted Fix

Affected browser3 passes2/3 cases, including real partial revocation and stale/
no-JS gates. Axe identifies `.action-primary` at foreground#b0b6c1/background
#636ca2, ratio2.45 during disabled-to-enabled150ms color interpolation. Stable
existing palette is correct; the intermediate transition fails contrast. Small
owned repair: `transition-none` on email submit only, no global style/token
change and no axe waiver/wait workaround. Re-review, current check/build and
own3 actual browser cases. Reuse356 integration and101 original full browser
passes: provider/business source and non-email components are unchanged.
Original failure evidence retained; no repair/tests by Recover.

## Final separate verification outcome

Current check607 and build4 pass. Business/provider integration3 passes356;
full browser2 passes101 unaffected original cases and final affected browser4
passes all3 own cases, including actual confirmation/captured navigation at
desktop/phone/narrow sizes, keyboard/axe/no-JS and real revocation failure.
Only local email submit transition and own test locators changed after the full
baseline/browser and business evidence; those successful unaffected scopes are
reused explicitly. No axe waiver, token rewrite, custom identity store or reset.
All original failed attempts remain in `.local/next-wave`; coordinator independent
acceptance is separate. No production/real-user clearance implied.
