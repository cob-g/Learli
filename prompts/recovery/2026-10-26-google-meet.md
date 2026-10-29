# Learli Recovery — Optional Google Meet implementation

- Status: AUTHORIZED — build-feature delegation; verification pending.
- Mode: Targeted Fix.
- Severity/environment: Important; new uncommitted local code only, not activated.
- Branch/baseline: feature/google-meet-provisioning / 6d9a8fcb5cebf15c0d621e3f710e39c67d965bc7.
- Scope: approved M5.1 blueprint, MEET-01/02/03; user's explicit implementation request.

## Review findings and diagnosis

1. `google_meet_complete` proposed an active INSERT with nullable incoming refresh
   ciphertext before ON CONFLICT could retain the existing same-account token.
   PostgreSQL checks the active-token constraint before the conflict update. Reuse
   the already-authorized stored ciphertext in the proposed tuple as well. The
   existing subject/client/environment/generation checks must remain unchanged.
2. Regression tests need reschedule, late receipt, stale eligibility/session,
   manual replacement and intent rollback coverage. The cancellation test used
   request/policy arguments in reverse order; correct its invocation against the
   actual established SQL signature, without changing business expectations.

Evidence is source inspection, not a reproduced runtime failure yet. Review's
recommendation is CHANGES REQUIRED; no verification executed by Review/Recover.
No existing bookings, credentials or user work were changed by this diagnosis.

## Authorized targeted repair / verifier handoff

The coordinator may coalesce the validated same-account ciphertext for INSERT,
correct the test call and add the missing focused cases. Preserve all current
permissions, manual links, no-money lifecycle, migrations/history and `designs/`.
Re-review the exact changed state, then run unit/component, real PostgreSQL races,
related authorization/workflow tests, Playwright, type/lint/format and build.
Live Google/production checks remain NOT RUN pending separate authorization.
No reset, provider action, deployment or scope change is proposed.

## First verification results and targeted lint repair

Focused unit/component tests: 16 passed. Typecheck passed. Lint found the new
internal Meeting setup anchor must use Next Link. Mode 1: localized convention
defect; replace only that anchor, re-review and rerun lint/affected checks. No
production or provider action is needed. PostgreSQL is initially stopped; the
coordinator may start the owned local cluster without resetting data.

## PostgreSQL fixture setup correction

The first isolated integration run stopped before 22 cases: subjects_slug_unique
rejected an extra Math insert, since the complete migration chain already seeds
that catalog row. Mode 1 fixture mismatch; select the existing Math record. No
application behavior or assertion contract changes. Test database is disposable;
the test cleanup closed/dropped only its owned temporary database.

## Fixture-contract census after the second setup stop

The next setup stop was a screening-request expectation: established SQL returns
`saved`, not `created`. Re-inspected every fixture mutation: screening request,
assignment, check and decision use saved; child/adult/booking creation use created.
Keep those real functions/permissions and assert the persisted screening receipt.
Also isolate each case with its own actual self-service learner to avoid hitting
the existing twenty-bookings-per-minute rule across unrelated test scenarios.
This is Mode 1 fixture construction, not a reason to change production rules or
reset the working tree. No product fixes have failed the same gate.

## Executed integration and build findings

- PostgreSQL reached the connection boundary: Drizzle expanded the scopes array
  into a record tuple before `::text[]` (SQLSTATE 42846). Mode 1 serialization
  defect. Bind it as one explicit `sql.param` array; preserve exact scope checks.
- Production build compiled and typechecked but exited 1 at Next.js's security
  advisory gate. Audit confirms Next 16.4.0, Undici 8.11.2 and Zod 4.6.5 are
  unchanged from baseline; three production dependency advisories remain. Do not
  silently expand this feature into a framework/security upgrade. A normal final
  build rerun after code repairs may continue, but never conceal these advisories
  or call production readiness. Provider and production activation remain off.

## Twenty PostgreSQL cases passed; two clock fixtures corrected

Observed: expiry/recovery cases expected immediate work while (a) only the job
lease was moved into the past but its matching connection lease remained future,
and (b) the existing safe failure backoff remained one minute in the future.
Re-inspected claim/prepare/fail/receipt: real elapsed time advances both leases and
the retry schedule. The approved contract does not promise instant recovery.
Mode 1 test-clock mismatch: advance the corresponding synthetic timestamps; keep
production lease fencing, backoff, call-count and authoritative-state assertions.
No additional applied migration or production change is warranted.

## Launcher credential-isolation review

Read-only follow-up found the parent launcher passed its entire environment to
both children. That unnecessarily gave Next the worker URL and the worker the
application DB/auth credentials. Targeted in-scope repair: mask the worker URL in
Next's initial environment (empty prevents dotenv reloading it), whitelist worker
settings only, and validate worker configuration without inventing an app DB
identity. Keep each child's real role checks; add configuration-boundary tests.
No live worker or provider was started.

The launcher now also checks that app/worker URLs refer to the same local host,
port and development database. Private meeting status reads use the final fresh
projection for edit permission and a concurrently installed link. These are
in-scope boundary corrections; tests cover credential split, target mismatch and
authorized versus unrelated pending-status projections.

## Broad integration compatibility recovery

Executed broad integration: 1079 passed, 55 failed, 17 skipped; 68/84 files passed.
Root causes: schema migration attempted cluster CREATEROLE under deliberately
unprivileged Neon-shaped migration users; exact app permission verifier still
expected the previous 100 functions and its old six-function allowlist; migration
preservation inventories lacked the three approved new empty tables; the private
audit shape test lacked explicit system-provenance fields. These are confirmed
integration regressions, not pre-existing failures.

Targeted repair: move all cluster worker-role/grant provisioning to the explicit
local operator, keep portable schema migration and exact six owner-scoped app
functions in canonical runtime grants, verify all116 functions and exact ACLs.
Historical grant prefixes exclude new functions; preservation checks compare all
original fields and assert three new empty tables. New audit fields are asserted
exactly as human/null for old manual events. Do not loosen existing checks.

Credential-split TypeScript additionally needs the project's required NODE_ENV
property in each child ProcessEnv. Set development explicitly; no casts or skips.
The draft0040 migration was applied only to owned test data, never development or
production; retain/archive any test ledger if rebuilding a current test target.

## Final local operator setup review

Review found an unconditional `mkdirSync` after role grants. A normal migration
backup already creates `.local/google-meet`, so worker preparation would stop with
EEXIST before creating its private credential. Mode 1 localized setup defect.
Reuse an existing owned directory only when it is a real private directory;
reject symbolic links, files and overly broad permissions before role mutation.
Add temporary-filesystem regression tests. No worker login or Google call is
needed to verify this correction. Review/Recover do not execute the repair.

## Full-suite focus assertion timing

Two full unit runs failed only the unchanged ParentChildForm focus assertion;
three isolated runs passed. Error text can render before the component's passive
focus effect completes, so `findByText` does not synchronize that side effect.
Mode 1 test synchronization defect: await the existing focus assertion with
`waitFor`; preserve the required focus target, submitted payload and all other
assertions. No application or guardian rule changes. Verify the full suite again.

## Approved framework unblock — 2026-10-27

The user approved exact Next/eslint-config-next 16.4.3 in this checkout and
verification continuation. Official release and registry peer metadata confirm
compatibility with the installed Node/React/ESLint versions. Coordinator may apply
only this patch and lockfile resolution, then separate read-only Review and
executed check/build/scoped browser verification. Other baseline advisories remain
outside this dependency change; no suppression or broad audit fix.

## Separate verifier outcome — 2026-10-27

After the explicitly approved exact Next/eslint-config-next 16.4.3 patch, the
coordinator's Verification stage observed check 2358/163, targeted PostgreSQL 51/51,
production build and affected Playwright 6/6 PASS. No runtime blocker remains from
the former Next gate. Two unchanged production dependency advisories remain; live
Google/provider acceptance NOT RUN, default off. No production or provider action.
This is supplied Verification evidence, not checks executed by Recover.

## 2026-10-27 — First live OAuth callback refused

Observed: selected-account identity/Meet consent completed; Learli redirected to
`result=failed` and remained Not connected. Read-only owned-local SQL showed the
attempt still unconsumed and unexpired, and zero saved connections. Expiry is
therefore not established as the cause. No Meet create occurred. Strict callback
query validation, browser binding and actor/SQL consumption remain candidate
failure points. Google documents authorization-response `iss` support, which the
current callback allowlist does not include; actual callback presence is not yet
observed. Do not assume an account-tier limitation.

Targeted diagnostic handoff (within approved feature): separate implementation
may add temporary safe boolean/enum callback diagnostics, without query values,
codes, cookies, tokens, labels or provider bodies; retry one fresh unchanged-scope
OAuth attempt under the user's actual data-grant approval. Remove instrumentation
after isolation. If a callback compatibility defect is established, apply the
smallest strict validation correction and add positive/negative regression tests;
separate Review and affected verification before continuing. Preserve existing
history, secrets, issuer/nonce/PKCE/state/session checks and manual fallback.

### Callback diagnosis confirmed and targeted repair

Fresh retry under the same approved scopes reproduced failure. Temporary boolean
logging showed unexpected parameter=true, issuer present=true, browser binding
present=true and rule failure. Added a real-PostgreSQL regression that rejects
invalid/duplicate issuers and unexpected parameters without exchange, then accepts
Google's exact issuer; it failed before repair at the valid callback with HTTP400.
The correction allows optional `iss` only when exactly
`https://accounts.google.com`; absent issuer remains compatible. Unknown/duplicate
parameters, state/browser/session binding, nonce and PKCE remain enforced.
Temporary diagnostic logging removed. Separate same-agent read-only focused
Review: READY FOR VERIFICATION; live acceptance and checks pending.
Primary reference: <https://developers.google.com/identity/openid-connect/reference>
and <https://www.rfc-editor.org/rfc/rfc9207.html>.

### Callback repair verification result

Live OAuth now returned Connected and persisted after refresh/restart. Readback
confirmed active state, encrypted credential and only the three approved scopes.
Separate executed verification: check PASS (2,358 tests/163 files plus formatting,
lint/typecheck), targeted PostgreSQL PASS52/52, production build PASS, scoped
Playwright PASS6/6. Focused read-only re-review found no further issue. New
regression red/green evidence is private under `.local/google-meet/`. Actual space
creation/admission/joining remain NOT RUN because the selected Tutor is pending
normal screening; no bypass or fabricated approval. App/worker restarted and
Connected verified afterward; no production, billing, publishing, commit or deploy.

## 2026-10-27 — Live CreateSpace rejected with HTTP403

Observed after owner-approved24hour synthetic local screening through assigned
MFA Admin: normal Parent booking confirmed once and appeared in Parent/Tutor
views. Worker refreshed token, dispatched once and stored blocked/create_rejected.
Google Cloud UI independently shows API Enabled and1 CreateSpace request/100%
error with response403. No link/space receipt; booking remains confirmed.

Targeted provider-authorization diagnosis, exact cause NOT established. Existing
provider collapses400/401/403 into create_rejected and intentionally never logs
response bodies. Unknown whether account policy, Google project/client settings
or another provider permission caused the refusal. OAuth/grant persistence passed;
API disabled and duplicate requests excluded by direct observations. Do not claim
Workspace is required or purchase it based on this evidence.

Next separate implementation/verification handoff: design bounded safe status/
allowlisted reason diagnostics before an explicitly controlled provider retest.
Never log raw bodies, account labels, tokens, space IDs or links. Preserve the
blocked job and single confirmed booking; no blind requeue/replay, weaker settings,
new booking to bypass failure, Calendar fallback or production changes. Real
meeting settings/admission/joining acceptance remains blocked. Current source is
unchanged from the issuer-repair verified state.

## 2026-10-27 — Approved safe diagnostics verified; live retest pending

The user approved the supplemental diagnostic/retest blueprint. Current clock
showed the original booking had ended; its guard forbids retry. No rearm, new
booking or live provider request occurred. The separately proposed future
synthetic booking awaits an explicit owner response; elapsed time is not approval.
The exact-job recovery command is deferred for the expired target, not implemented.

Provider/worker now report only finite HTTP/status/ErrorInfo reason categories;
raw messages, metadata, identifiers, tokens and links are excluded. Response reads
share the10second deadline and64KiB cap, including unresponsive cancellation.
Existing failure classification, blocked-job state and non-replay rules remain.

Separate same-agent scoped read-only Review found no confirmed issues in the
diagnostic slice: READY FOR VERIFICATION. Supplied executed Verification:
`npm run check` PASS2367 tests/164 files plus format/lint/typecheck; targeted
Meet/private-link PostgreSQL PASS54/54; production build PASS; scoped Playwright
PASS6/6. Logs are private `.local/google-meet/diagnostics-*.log`. No new migration,
dependency, production or permission change. Earlier feature edits are preserved.
The original403 cause remains unknown; these tests do not establish live Google
account capability or room creation/joining. Never buy Workspace or weaken
restricted meetings based on generic403. Next: owner selects the fresh-booking
path, then one normal booking only while screening/availability remain current.

### Authorized future-booking outcome — 2026-10-27

Owner selected **Approve one future test booking** for Oct28,10–11AM Manila,
after passing checks and current availability validation. This specific normal
booking replaces the expired-target retry as the live diagnostic operation;
no general rearm operator was implemented or needed. Original job untouched.

One normal Parent submission saved one confirmed no-money booking with correct
associations and UTC02:00–03:00/Asia-Manila receipt. The restricted worker sent
one creation attempt, recorded blocked/create_rejected/attempts1, no space/link.
Safe diagnostic: HTTP403, PERMISSION_DENIED, UNCLASSIFIED reason. This establishes
Google's refusal but not its exact account/project/policy cause. No blind replay,
weaker access, payment, purchase, extra grant or production action occurred.
Parent/Tutor views agree; parent sees tutor must arrange the link, tutor has
manual fallback. Original ended booking/time/job/attempt count retained.
Final read-only counts2bookings/2jobs/0links. Private evidence under
`.local/google-meet/diagnostics-live-result.json`, `diagnostics-parent.jpg`,
`diagnostics-tutor.jpg`, `diagnostics-runtime.log`. Existing account timezone
preferences remain UTC; displayed02:00–03:00UTC equals10–11AM Manila.

Separate verification on this source: check2367 tests/164files plus format/lint/
typecheck PASS; targeted real-PG54/54 PASS; production build PASS; scoped Playwright
6/6 PASS. Same-agent scoped read-only Review found no confirmed diagnostic issues;
READY FOR VERIFICATION was followed by those executed checks. Full provider
acceptance remains FAIL403; no real room/admission/joining verified. Next requires
a bounded provider/account decision, not repeated bookings to chase success.

## 2026-10-27 — Read-only Google account and project eligibility investigation

User requested checking eligibility/project restrictions before another attempt.
Mode: targeted provider-authorization diagnosis; exact root cause still unknown.
No code/configuration/database/provider-create change, retry, billing, grant,
publication, deployment, or new test execution occurred during this investigation.

Observed through the selected authorized Google account in the actual local-test
Cloud project:

- Meet API Enabled. Metrics record exactly two CreateSpace requests,100% errors,
  response403, consistent with the two previously authorized single attempts.
- OAuth audience External/Testing; selected account is the sole configured test
  user,1/100 cap. Data Access contains only identity/email and
  meetings.space.created; no extra scope was added.
- Web client Enabled; exact loopback callback present. Private local inspection
  confirms configured client matches this Cloud client and the prepared client
  file/project; no secret value emitted.
- Meeting-space creation quota1000/minute/project and100/minute/user; no zero quota
  or current exhaustion indicated. Per-user usage is not displayed by Cloud.
- gcp.restrictServiceUsage and gcp.restrictEndpointUsage both Inactive. OAuth
  Overview reported no project health recommendations. This is a scoped check,
  not proof that every Google internal restriction is absent.
- Owner completed Google's passkey step-up directly. Admin console then returned
  the administrator-account-required chooser for the selected account; no managed
  Workspace administrator console became accessible. Account subscriptions show
  no Workspace subscription; the only listed membership is inactive. No financial
  values or unrelated account details retained. Absence of an administrator role
  alone does not prove absence of a Workspace user entitlement.

Official primary references checked:

- https://developers.google.com/workspace/meet/api/guides/quickstart/nodejs
  lists a Google Workspace account with Meet enabled as a prerequisite.
- https://developers.google.com/workspace/meet/api/reference/rest/v2/spaces/create
  specifies meetings.space.created, matching the existing app scope.
- https://developers.google.com/workspace/meet/api/guides/authenticate-authorize
  documents user authorization and narrow scopes.
- https://developers.google.com/workspace/meet/api/reference/rest/v2/spaces
  documents RESTRICTED settings; no basis found to weaken them.

Conclusion: no obvious blocker found in the examined project settings. The
selected personal account's entitlement to this Meet API remains unverified and
is a plausible remaining cause, not a proven explanation of403. Do not assert
that all personal accounts are unsupported or that a Workspace purchase fixes it.
Recommend provider confirmation for this account, or an explicitly authorized
test with an existing Meet-enabled Workspace account. Preserve manual fallback,
blocked jobs and booking history. Any further creation, new account connection,
scope expansion, purchase, or provider redesign needs its applicable authority.
Recover performed diagnosis only; implementation and verification not performed.
