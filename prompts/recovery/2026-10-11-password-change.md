# Learli Recovery — Signed-in password change

- Authority: AUTHORIZED — build-feature delegation, actual 2026-10-11 wave request.
- Baseline: cob-g/m2-account-password-change at024dd4d7ce885da7ca391aefeaf4096fc75fc91e.
- Mapping: M2.9, AUTH-02/03/04, NFR-05. Local synthetic environment only.

## Provider freshness assumption

Mode: Rethink (bounded provider assumption). Observed installed1.7.7
`api/routes/update-user.mjs` uses `sensitiveSessionMiddleware`, whose definition
in `api/routes/session.mjs` checks authoritative session validity only. The
separate `freshSessionMiddleware` compares createdAt against context
sessionConfig.freshAge. The wave requires stale-session denial. No runtime
failure or credential mutation occurred in diagnosis; no earlier repair attempts.

Recommendation: amend Architect blueprint to add a Learli age check using the
installed provider context freshAge, then implement in the separate stage.
Keep provider sensitive middleware, HTTP throttling, cookies and all existing
work. Explicit freshness is a wrapper guarantee, not an installed endpoint claim.
Verify 25-hour still-valid sessions are denied, fresh sessions accepted and
expired/revoked/suspended sessions refused. No new product/policy authority needed.
Review/verification NOT RUN by Recover. No destructive operation proposed.

## Cross-account pool capacity finding

Mode: Targeted Fix. Root `msg_8b632a28bf7d`/`msg_7e8fd5e587cc` identifies max5
shared runtime pool and3000ms connection timeout. Five distinct account locks
could reserve all five transaction connections while provider queries use the
same pool, producing timeouts/possible uncertain outcomes, not an indefinite
wait claim. No failed runtime experiment occurred in diagnosis.

Recommend a nonblocking global provider-capacity transaction advisory slot before
the account lock; only one wrapper invocation holds a transaction during provider
work, and excess callers receive409 and promptly release their connection. Keep
the per-account lock and identity recheck. This is a local technical capacity
bound, not a new account/business rule. Amend blueprint, then implement separately;
verify five different accounts concurrently complete with200/409, never503,
credential corruption or blocked pool. No new pool/schema/runtime grant is needed.

## Review test typing finding

Mode: Targeted Fix. Same-agent read-only Review finds zero-argument vi.fn
inference incompatible with reading mock.calls[0][1].body in the component test.
Recommend type the mock as typeof fetch and narrow optional RequestInit body
through String before JSON.parse. No execution by Recover; separate repair,
re-review and full static verification required.

## Verification lint failure

Mode: Targeted Fix. npm run check exit1 in `.local/four-feature/check-first.log`:
react-hooks/set-state-in-effect rejects synchronous hydration setReady(true).
Format passed; later checks were not reached. Recommend useSyncExternalStore
server=false/client=true readiness instead of effect state, preserving disabled
native controls and existing no-JS safety. No rule suppression or semantic
relaxation. First root-cause attempt; re-review and full check/browser validation
required after separate repair. No checks executed by Recover.

## Verification throttle metadata failure

Mode: Targeted Fix. Full real PostgreSQL run exit1,266PASS/1FAIL in
`.local/four-feature/integration-first.log`. HTTP429 behavior passed; assertion
failed because installed rate-limiter/index.mjs64 returns X-Retry-After, while
the safe adapter only copied Retry-After. Recommend bounded numeric fallback
from X-Retry-After into standard Retry-After. Preserve actual throttling and all
refusals; add projection regression and re-review/check/integration/build/browser
verification. First root-cause attempt; no weakened assertions or auth changes.
Earlier production build exit0 applies to pre-repair state only.

## Repeated full-suite learner fixture failure

Mode: Targeted environment preparation, not a destructive reset. Second full
run exit1,255PASS/12not executed, in `.local/four-feature/integration-final.log`.
All12 password cases passed. Existing learners.test.ts beforeAll registers seven
accounts without clearing persistent rate counters; support.createAccount reads
user.id without checking original HTTP status. Original response was not captured,
so persisted-throttle attribution is an inference, not a proven original status.
Recommend zero only owned synthetic test rate-limit counts before the next full
run, matching existing test setup; preserve auth rules, existing tests, all account
records and failed log. No database reset/data deletion or production operation.

Read-only follow-up also found the new stale browser case uses Email address
where the actual baseline AuthForm label is Test email. Change only that new
locator, then re-review and verify the full browser suite. No runtime repair.

## Fixture-isolation reclassification after failed preparation

Third full run exit1,201PASS/66not executed in integration-third.log: baseline
bookings/matching beforeAll now fail in the same unchecked helper. One initial
counter zero cannot isolate batches across files; file sequencing varies between
runs. Reclassified Mode1: shared synthetic fixture isolation, not polluted source
or wrong product foundation. Two inherited helper-failure runs are retained;
original statuses remain unknown rather than retrospectively called429.

Recommend narrowly clear only sign-up/sign-in rate counts in trusted
tests/integration/support.ts createAccount provisioning and check registration
HTTP status before reading user.id. All identities are synthetic in the owned
learli_test DB. Actual runtime thresholds stay unchanged; auth throttle cases
use direct handlers and password throttling is never cleared by this helper.
Preserve all baseline tests, records, grants and lock behavior. Root reconciles
this additional shared hunk. Re-review and full static/PG/browser verification
required; no reset, auth bypass, fixture fake success or destructive deletion.

## First default browser availability focus failure

Mode: Targeted diagnosis. Default83 run exits1 with28PASS/1FAIL/54not run in
e2e-first.log. Unchanged availability.spec.ts120 observes Availability saved.
but status focus is inactive. Inspected baseline availability-form.tsx schedules
focus in requestAnimationFrame after setNotice/setPending; timing before React
commit is a hypothesis, not demonstrated root cause. Password runtime does not
change this form, route or service. No credentials/private URL appear in the
failure evidence. Recommend separate Verify rerun this exact unchanged case,
then full default suite if it passes; do not relax focus assertion or silently
repair an unrelated component. Escalate a reproducible baseline defect to root.

## New browser alert/no-JS findings

Second default run exits1,79baselinePASS/4newFAIL in e2e-final.log. Three cases
reach correct password errors, but unscoped alert locators match both the notice
and Next route announcer. Fourth observes disabled native password controls but
missing noscript explanation in actual script-disabled SSR. These are Mode1
targeted fixes: scope new alerts to Change password region and use the existing
server=false/client=true hydration state to render an ordinary pre-hydration
explanation, keeping credential inputs disabled without scripts. Do not remove
native safety assertions or alter unrelated baseline code.

Focused unchanged availability repeat passed1/1; second default passed all79
baseline cases, including that focus assertion. Original failure remains recorded;
no availability repair or permanent root-cause claim. Re-review, full static,
rebuild and default83 browser verification are required after separate repairs.
PG267 evidence remains applicable to byte-identical backend/helper source.
Sanitize failed error-context source snippets containing entered synthetic
password literals; preserve assertion/error/command evidence and canonical tests.

## Separate verification outcome after scoped repairs

Repaired source passed the same-agent read-only Review and then separate
verification: check591, PostgreSQL267, production build, focused password4 and
full default browser83/83. All79 baseline cases and four new cases passed in one
final run; no availability source/assertion repair. Backend/helper SHA256 equality
retains the prior full PostgreSQL result through the last UI-only changes.
Failed context excerpts in four files had nine known synthetic password literals
replaced; artifact-sanitization.json retains original/sanitized hashes and counts.
Actual privacy scan reports no matching credentials/tokens/hashes/passwords in
source/client/log/text outputs and no trace archives. This is local verification,
not independent review or public-launch authorization.
