# W3 hosted authentication recovery

Status: AUTHORIZED — build-feature delegation. Mode: Targeted Fix.
Local/synthetic only; baseline2fa0294 plus accepted provider imports.
AUTH-01–05 / M8.10 W3. No production/provider operation or data incident.

## Initial read-only Review findings

1. Important: `scripts/start-hosted-auth.ts` did not close the prepared Next
   application if prepare/listen failed before signal handlers were installed.
2. Important: `tests/support/hosted-auth-app.ts` sequential finally cleanup could
   skip backend/database cleanup if proxy close threw.
3. Important: account password/email route facades awaited initialization outside
   a safe response catch, unlike the other allocated account facades.
4. Minor: config peer validation accepted scoped IPv6 syntax that the actual
   ingress normalizer refuses, creating an unusable enabled contract.

Observed source establishes these paths; runtime checks have not run yet.
No failed test is relabelled passed. Preserve accepted W1/W2/W4a, local contracts,
real parsers, all assertions, owned evidence and existing data. Repair startup/
teardown control flow, add consistent safe facade catches, and reject malformed
peer literals. Re-review revised source, then separately Verify actual startup/
shutdown, injected initialization failure, config denials and full scoped checks.
Recover performs no implementation or verification; coordinator owns next stages.

## Other authorized integration adjustments

Root explicitly revised the test-only hosted backend allocation3193→3093 to avoid
the ordinary local server collision. No parser or production seam changes.
Root accepted support-bookings test-only MFA fixture repair was independently
hash-checked and imported as a supplemental baseline, retaining all assertions.

## Initial formatting attempt

Scoped implementation formatting exited2 because the new integration request helper omitted its closing brace; other formatting edits succeeded. This is a test-source syntax defect, not a provider/parser failure. Add the missing brace without changing any assertion and rerun scoped formatting before Review/Verify. Original tool output remains in the transcript; no passing check claimed.

Read-only callback follow-up found nested encoded return fragments accepted by the W3 boundary while W4a correctly rejects them during message construction. W3 now rejects that input before dispatch, with a regression assertion; W4a frozen validation remains unchanged. Scoped re-review found no remaining confirmed issue; separate Verify remains required.

## Verification attempt1 — check and package normalization

check-1.log: formatting PASS, lint PASS with one unused fixture import warning, typecheck FAIL before tests. Observed causes: grouped LocalMessage kind union did not narrow the final OTP branch; Vitest5 has no describe.sequential and its each table expands arrays; test header cases inferred optional undefined fields; verifyRuntimeGrants consumes one PoolClient; an existing W1 local integration runtime annotation widened into incompatible pool overloads. Targeted repair uses property-based mail narrowing, ordinary sequential-by-default describe, object table cases/explicit header dictionary type, a borrowed owned owner client, and exact LocalAuthRuntime annotation with no assertion change. Remove the unused fixture import. These are test/consumer typing corrections; W1 provider/state/assurance/SQL and W2/W4a remain unchanged.

npm package-lock-only normalization kept all existing package versions/resolved URLs/integrities but added six unrelated optional Tailwind WASM nested inventory entries without identities. Archive that output and remove only those unexpected additions. Its legitimate normalization changes only esbuild/tsx devOptional classifications; retain the explicitly authorized existing tsx4.23.15 root dependency move. Validate exact package-set/version/resolution/integrity preservation, re-review, then separately rerun check. No new dependency/version is accepted.

## Hosted PostgreSQL fixture attempt1

pg-hosted-1.log exited1 during beforeAll; six cases were not executed. Owned TLS server log reports permission denied for schema pg_catalog. The fixture reused the runtime-safe pg_catalog-first session options for its owner migration Pool, while historical reviewed migrations intentionally create unqualified objects. Root/operator tooling normally selects the application schema for DDL. Set only the owned test migration/fixture owner Pool search_path to public,pg_catalog; leave the real staging parser, W2 app Pool/lease options and every historical migration unchanged. Add safe phase/code failure evidence, re-review this test-only owner setting, then rerun real PG. The failed owned cluster is stopped and its private directory preserved.

## Hosted PostgreSQL fixture attempt2 — real provider callback failure semantics

pg-hosted-2.log:5 PASS,1 FAIL. Real Better Auth1.7.7 runInBackgroundOrAwait awaits but catches callback errors at context/create-context.mjs215–227; signup returns200 after the injected SDK503. Existing callback correctly performs one awaited send and throws APIError; no assertion is weakened. Repair actual hosted composition with a runtime-owned AsyncLocalStorage boolean mail-attempt boundary, consumed at hosted auth HTTP and internal email proof dispatch. Callback errors mark that scope before rethrowing; a provider-swallowed failure becomes safe503 preserving all cookies, with no rollback or delivery claim. Local dispatch preserves prior behavior. No provider/SDK patch, token queue, durable proof data or additional identity store. Unit concurrent scope/cookie tests and real PG/browser failure cases must pass after scoped re-review.

Pre-browser teardown re-review retained persistent idempotent Node signal handlers and an independently owned backend process group, so a parent fixture group termination cannot bypass its explicit child drain by delivering a second default SIGTERM. Runtime closure still happens once under the existing stopping guard. Parent never stops unrelated processes.

## Pre-browser current membership review

An existing persisted session or provider proof can survive a process restart that removes its account from the selected set. Creation hooks/private requireIdentity alone do not cover raw get-session, pending MFA verification or preexisting reset/verification proof mutation. W3 adds a consumed provider before hook using actual getSessionFromCtx, signed two_factor cookie, provider verification/user lookups (read-only, no consume/rewrite), and supported beforeEmailVerification. Core/W1 hooks remain unchanged; local composition does not install the additional plugin. A real-PG restart closes the original guarded runtime, composes a new selected set on the same owned database, and asserts old sessions, reset/verification and pending recovery proof deny before mutation/consumption. Known hosted provider401/403 identity errors retain safe AccessError semantics. This is a required current authority repair, not new eligibility/legal policy.

## Independent root current-membership finding — reset fallback

Root msg5114c0c19f6b identified an Important bypass before final acceptance: native reset selects body.token || query.token, whereas the new pre-proof lookup inspected only body.token. Root inspected real forwarded POST search, so this is a confirmed source path, not a fictional endpoint. The original guard is preserved under .local/hosted-auth/reset-guard-before. W3 now matches native precedence and refuses unsupported hosted POST query strings; local/provider/SQL paths remain unchanged. Actual TLS restart negative cases cover omitted and empty body tokens through the HTTP boundary and supported provider API, asserting proof remains and credential hash comparison is unchanged without logging the hash. Positive selected reset remains part of the same actual suite. No separate human decision is needed for this scoped authorized security repair.

Installed create-context.mjs70 reads ambient BETTER_AUTH_SECRETS even with explicit single secret. The hosted parser/factory now refuse that unaccepted alternate key source before I/O, preserving one configured secret/fingerprint and local behavior. The explicit single-secret blueprint does not authorize versioned-key rotation during this wave. Actual config negative is registered in normal unit tests.

## Revised current-source check4

Formatting and lint passed; typecheck failed because the conditional membership plugin spread at the start of the provider tuple hid W1 twoFactorEnabled in inferred session types. Keep fixed native plugin entries first and hosted-only plugin in the optional tail, preserving MFA fields without casting or deleting test assertions. Separate check5 and actual PG/browser Verify must establish revised behavior; check4 remains failed.

Root cross-browser evidence also found AccountForm recomputed browser Intl aliases and implicitly allowed native GET before hydration. Use existing server listTimeZoneOptions with existing account alias inclusion as serialized props, plus SSR-inert fields and explicit POST fallback. The shared supplement freezes only the component/test and minimal page import/prop patch, preserving peer runtime composition.

## Revised actual TLS scoped proof

pg-hosted-5 retained seven hosted passes and the accepted R2 regression pass; final restart negative test threw native APIError before asResponse handling. Installed supported direct API preserves that throwing before-hook contract. Expect actual isAPIError with statusCode403, retaining HTTP boundary status, proof non-consumption and credential unchanged assertions; no product code changed for this fixture correction. pg-hosted-6 PASS9 tests2 files, including all eight hosted cases plus accepted R2. Required current full integration and browser evidence remain separate.

## Independent root ordering finding

Root identified that optional-tail membership checks run after W1 factor-change before hooks which can commit epoch increment and factor_change_started. check5/fullPG2 success did not cover this path and are explicitly pre-repair. Restore membership first as a fixed tuple entry; local matcher is always false and does no lookup/mutation, preserving local behavior and native plugin schema inference. Extend the actual TLS restart case with freshly assured selected admin, valid password factor enable/disable/recovery rotation attempts after removal, and boolean equality of retained epoch/event/factor/session/receipt snapshots. Do not modify frozen W1 semantics. Re-review source then separate current Verify required.

Evidence correction: fullPG2 reported658/38 but composition/test source changed while the job was active, so its retained log is mixed/unusable for exact-source acceptance, not a valid pre-repair run. Current check6 ran without source/import edits and PASS1111/66. Subsequent corrected scoped/fullPG runs must preserve frozen input; documentation/source changes occur only between commands.

## Actual HTTPS attempt1 — optional public folder absent

Chromium1 webServer failed before any browser assertions. Private mirror contained src/scripts/tests but no packet/build log, and actual repository inspection showed public does not exist. Test mirror/production packaging incorrectly assumed the recommended optional asset folder exists. Copy existing public only when present while still requiring every core source directory; do not create phantom assets or skip business tests. Actual fixture teardown closed3093/3293/56003, ordinary3193 also absent. Runtime/build2 unchanged. Targeted fixture-only repair read-only reviewed; rerun actual HTTPS required.

HTTPS Chromium2 progressed to successful mirror compilation, then real TypeScript failed because copied tests/e2e/support-assignment.config.ts imports ../../playwright.config and that root config was absent. Preserve normal typecheck; copy the actual registered Playwright config into the owned source mirror and hash it alongside existing inputs. No compiler exclusions or ignored build errors. All owned ports closed again. Narrow fixture repair reviewed; Chromium3 rerun required.

HTTPS Chromium3 started actual fixture and passed registration/verification/signin/secure cookie/CSRF/scoped denial plus persisted forwarded-identity throttle. Current/new email case attempted reading the SDK proof synchronously while the submit was still pending; `.fill(proofCode(...))` evaluates proof before locator auto-wait. Wait for actual new-address field transition before reading the captured provider code, retaining every assertion. Two passed/one failed/four not run is not acceptance. Actual fixture ports closed. Product/provider source unchanged; reviewed browser observation correction only, rerun all hosted cases.

HTTPS Chromium4 failed before setup on occupied3093/56003 from confirmed own Chromium3 detached entry/TLS processes. Prior latest shutdown file belonged to setup2; the later claim of actual3 closed ports is withdrawn. Installed Playwright runner explicitly skips graceful shutdown unless configured, then force-kills launcher group; detached owned backend/database cannot drain. Root independently confirmed PID/cwd/listener identity and authorized only graceful SIGTERM exact owned entry plus pg_ctl stop exact owned TLS directory, preserving data/artifacts. Hosted webServer now has supported gracefulShutdown SIGTERM30s; shutdown evidence is also stored in each immutable mirror with matching mirror identity, preventing reuse of stale proof. No production/peer/unknown process, deletion or protocol/parser change. Rerun actual HTTPS and inspect matching shutdown proof/listeners before claiming closure.

HTTPS Chromium5 retained2passes/1fail/4notrun. Email transition race fixed; password test matched pending “Changing your password” status and queried another session before the mutation completed (200). Wait for exact actual success “Password changed. Other sessions ended.” before unchanged401 denial assertion. No service change/timeout extension. Invocation-specific mirror-DYeQl4 shutdown proof stopped=true/closed3093,3293,56003 and fresh lsof confirms no listeners, proving supported graceful shutdown repair. Scoped observation re-review ready; rerun all seven cases.

HTTPS Chromium6 PASS3/FAIL1/3notrun: real current/new email, password and session controls now pass. Reset fixture used expect.poll with a callback that throws on missing capture, which aborts instead of retrying while request is pending. Await the actual UI-triggered request-password-reset POST response and require200 before reading SDK capture; compare fresh/old token inequality as a boolean to avoid printing raw proof URLs. All positive/expiry/reuse assertions retained, no product mutation, blind waits or increased timeout. Matching current shutdown remains required. Rerun all hosted cases.

HTTPS Chromium7 PASS3/FAIL1/3notrun. Expiry fixture set timestamp-without-time-zone using now() in disposable server's local timezone, whereas installed Drizzle timestamp maps UTC ISO strings and reads by appending +0000; the “expired” value could be hours in the future. Fix only fixture timestamp expression to clock_timestamp() AT TIME ZONE 'UTC' minus1second, require exactly one updated row and returned expiry comparisontrue, then retain actual browser expired-link denial. No production schema/parser/timezone exception. Proof expiry is asserted, not assumed. Provider source unchanged; scoped re-review done and actual rerun required.

HTTPS Chromium8 reached actual expired-link denial, successful fresh reset and invalidated-session401; it then tried filling a reused token form that native callback correctly refuses before rendering. Adjust observation to require reused callback's missing/expired alert and zero password fields, plus actual direct HTTP reused-token POST400 and successful signin with the unchanged fresh-reset password. This strengthens reuse denial at both boundaries, no removed business assertion/timeout increase. Source provider remains unchanged. All cases rerun.

HTTPS Chromium9 PASS4/FAIL1/2notrun reaches MFA setup but the transient key locator never appears; no confirmed provider failure inferred from timeout. Improve actual boundary observation: require hydrated enabled setup button before entering credential, capture real UI enable POST response and require200 plus safe boolean secret shape, then inspect rendered key. This distinguishes missing UI submission from provider or rendering failure without logging credentials/keys or changing W1. Scoped source review and actual rerun required; no assertion waiver.

HTTPS Chromium10 proves setup readiness/actual enable200, enrollment/challenge/recovery single use and rotation. Final disable observation raced verification's asynchronous full document replacement at the same /account/security URL, filling the prior document before replacement. Wait actual reverifyPOST200 and load of the replacement document, then hydrated enabled disable button before password; require actual disablePOST200 and existing UI/receipt denial assertions. No production/W1 change or shorter privacy boundary. Scoped re-review and all-case rerun required.

HTTPS Chromium11 PASS5/FAIL1/1notrun including full actual MFA. Axe found Sign in button mid disabled→enabled color transition: foreground#a3aab7/background#8f97be contrast1.22. Preserve all contrast assertions/tokens; scoped shared AuthForm primary action uses existing transition-none convention (already used by account email/security controls) so hydration/pending state colors change immediately. No global animation/axe disable or delayed inspection. Re-review minimal shared class change, root relay new exact freeze, actual three-engine/default acceptance and current build required for updated UI.

HTTPS Firefox1 PASS7/7 with matching owned shutdown/bundle privacy. WebKit1 PASS6/FAIL1: after Back, existing private document guard initiated fresh same-destination navigation while test immediately called a second goto, producing an interrupted navigation. Await the actual hydrated usable public Test email field after restoration before further signin navigation, retaining old DOM/bootstrap and storage privacy assertions; no aborted-navigation catch/retry or boundary weakening. Actual guard-triggered reload is expected. Scoped review ready; rerun complete WebKit and subsequent default Chromium.

Production-only1 exact npm ci --omit=dev --ignore-scripts succeeded195 packages; self-imposed Vitest absence assertion failed before entry. Actual npm explain identifies inherited Better Auth1.7.7 optional peer Vitest5.0.3, baseline lock devOptional=true, retained by npm omitdev graph. Requested production-only command remains unchanged. Require actual runtime tsx plus genuinely dev-only TypeScript/ESLint/Testing Library absent; record optional Vitest retained explicitly, without dependency churn, omission flags, false absence or waiver of entry/startup proof. Source/package graph preserved; narrow evidence assertion correction reviewed against real package metadata. Startup/shutdown remains unrun for attempt1 and required in next attempt.

Complete default Chromium1 PASS25/FAIL1/125notrun; local auth account axe caught Save settings disabled→enabled color interpolation ratio1.22, same confirmed root cause as sign-in. Scope AccountForm primary action only to established transition-none convention, preserving UI tokens and unchanged full-suite axe assertion. No global CSS/style/animation delay or test waiver. Product permissions unchanged. New shared component freeze required; current build4/default rerun must validate this local account compatibility delta. Earlier three-engine hosted7/7 each and production-only2 entry health/denial/SIGTERM/production-refusal passed but precede this single UI class.

Current-source Firefox2 PASS7/7. WebKit3 retained6/7: Back restoration still raced the helper's redundant second goto despite the restored form being usable. Continue in that actual restored sign-in form after existing enabled-field and old-bootstrap privacy assertions, rather than initiating another navigation; default helper navigation remains for all other contexts. No catch/retry of aborted navigation, relaxed assertion or document-boundary change. Current UI/runtime unchanged from default151/check7/build4/packaging3. Root B remains active for one affected WebKit rerun; final check source correspondence required.
