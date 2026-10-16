# Security and edge-case acceptance — local results

**VERIFIED LOCAL — bounded acceptance passed; hosted/provider checks remain open.**
[Checklist](security-edge-case-checklist.md), blueprint
`prompts/features/m8-09-security-edge-case-acceptance.md`, **AUTHORIZED —
build-feature delegation** following the owner’s recommendation approval.

Baseline: clean local main `794fe61`; branch
`feature/security-edge-case-acceptance-20261016`. Changes are focused tests,
finite synthetic browser registration and documentation. Application source,
policies, schema, runtime grants, dependencies and lockfile remain unchanged.
No payment, deployment, hosted activation or real provider operation is included.

## Executed verification

| Command / selection                            | Observed outcome                                                                                          | Conditions                                                                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                | PASS: formatting, ESLint, TypeScript and 130 files / 1,990 unit/component tests; final test phase 14.78 s | Pinned Node24.20.0/npm11.19.0, macOS, current checkout.                                                                                   |
| Existing PostgreSQL selection below            | PASS: 16 files / 279 tests, 229.75 s                                                                      | Serialized actual PostgreSQL17, owned loopback learli_test.                                                                               |
| New `security-booking-recovery.test.ts`        | PASS: 1/1, 3.26 s                                                                                         | Actual handlers; independently closed local runtime; healthy runtime recreated against same DB.                                           |
| Local TLS selection below                      | PASS: 3 files / 50 tests, 16.73 s                                                                         | Threads pool, serial files, fresh owned disposable TLS clusters at explicit free loopback 55703; intercepted provider HTTP only.          |
| `node scripts/with-test-env.mjs npm run build` | PASS; four existing dynamic filesystem tracing warnings                                                   | Actual production build; all 140 traces exclude local state and environment files.                                                        |
| Private Playwright browser1                    | 3 PASS / 1 FAIL, 49.0 s                                                                                   | Admin 16.2 s, Student 15.6 s, Parent/Tutor 13.9 s; new auth test failed ambiguous alert selector after expected wrong-password rejection. |

Final separate Verify: `npm run check` passed again after the test repair
(format/lint/TypeScript, 130 files / 1,990 tests, 14.78 s test phase). Targeted repaired
auth browser passed 1/1 in 5.0 s. Final **combined** `npm run test:e2e:private` passed
**4/4 in 57.6 s**, one Chromium worker/no retries: Admin 21.4 s, auth 3.2 s,
Student 15.9 s, Parent/Tutor 15.3 s. This is the actual normal production build,
with trace/screenshots/video disabled. The first failed attempt remains recorded;
no failure was skipped or its expectation weakened.

Total selected PostgreSQL evidence is **330 tests / 20 files**, across the three
explicit runs above, not a full default integration campaign. The original 599
runtime/script/migration/config/dependency fingerprints remain unchanged; final 929
source/test/asset/config hashes identify the verified tree. Later test-selector
repair did not change runtime/build or PostgreSQL evidence. Final documentation
edits affect no executable source.

Existing 16 PostgreSQL files: `auth`, `account-password`, `account-sessions`,
`account-restrictions`, `tutor-catalog`, `availability`, `transactional-delivery`,
`cross-role-booking-integrity`, `policy-booking`, `policy-booking-acceptance`,
`policy-booking-boundaries`, `private-admin-bookings`, `booking-read`,
`booking-meeting-links`, `tutor-completion`, `private-student-read-scope`, all
`tests/integration/<name>.test.ts`, passed using `npm run test:integration --`
with these explicit paths. New recovery ran separately with that same command.
TLS selection: `hosted-auth`, `hosted-runtime`, `transactional-delivery-hosted`,
using `LEARLI_STAGING_TEST_PORT=55703 npm run test:integration -- --pool=threads`
plus exact paths. These hosted-named suites target owned local TLS clusters;
no actual Neon, Railway or Resend service was contacted.

## Original checklist outcomes

| Owner checklist area               | Result                           | Observed scope and remaining limit                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Authentication/session security | PASS LOCAL                       | Wrong login 401/no session; duplicate generic response/one credential; real capture-assisted reset, one-use token, old-password/old-session denial, exact session expiry and actual re-login/logout/refresh. Dedicated PG also covers invalid/expired reset and disabled-account boundaries. Real email delivery NOT RUN.                                                          |
| 2. Role/data access                | PASS LOCAL                       | Foreign Parent learner/Student booking/Tutor private session and profile denies; untrusted Admin denial; URL/ID forgery and private meeting denial. Exact assigned Admin remains minimal/current-MFA scoped.                                                                                                                                                                       |
| 3. Booking integrity               | PASS LOCAL                       | Two distinct learners contend on actual PostgreSQL; double-click/hard-reload/same-key replay; past/unavailable/reserved rejection; role-consistent cancellation/rescheduling/history. Confirmed record UTC/revisions/state/events/intents survive weekly booked-day removal and recurrence-zone edits; occupied interval stays excluded.                                           |
| 4. Validation/error handling       | PASS FOR TESTED BOUNDARIES       | Representative native required/email, server length/IANA/protected-field validation and invalid date/range suites; network-aborted account save retains input/no write/no false success, then retry persists. Failed booking create 503 leaves exact unchanged state; interrupted committed booking uses authoritative-read/replay recovery. Not every form/mutation is certified. |
| 5. International timezones         | PASS LOCAL / PARTIAL OPERATIONAL | Actual saved Tutor Account Manila and Student Account New York, separately known recurrence zone, same UTC and actual-date local date/time/offset/zone before/after reschedule; fixed-date unit/PG DST cases. Actual emailed confirmations/international physical devices NOT RUN.                                                                                                 |
| 6. Reliability/recovery            | PARTIAL                          | Protected booking read/create 503 and no effects under closed separate pool; fresh-runtime same-cookie/key recovery once; local TLS actual connection-loss/same-pool recovery; mock delivery failures preserve committed bookings. Actual Neon idle-to-wake and real email outage/delivery NOT RUN.                                                                                |
| 7. Payments                        | N/A                              | Payment processing remains disabled; commercial/provider choices open. No gateway, charges or callback flow added.                                                                                                                                                                                                                                                                 |

There is no known new application defect from this bounded pass. These local
results do not complete the entire manual security matrix or establish public
launch readiness. The Student journey observed 31 successful session lookups and 10
legitimate 429 responses during rapid multi-role navigation; guarded Account
operations and every required test still passed without within-case counter
resets or rate-limit changes. Optional session-dependent chrome can degrade under
that burst and is not represented as permanently error-free.

## Scope, review and recovery

Three implementation workers owned separate auth browser, Student browser and
PostgreSQL files. Cross-author read-only Review found zero blocking issues and
returned READY FOR VERIFICATION: Student author reviewed auth/shared registration,
PostgreSQL author reviewed Student, auth author reviewed PostgreSQL. Coordinator
inspected the combined change. Review executed no tests or service operations.

Browser1 exposed a test-only selector ambiguity: Next.js has its own empty alert
live region. The authored feedback assertions are now scoped by expected content
and still require exact text and visibility; provider/session assertions remain.
The selector-only repair independently passed reReview with its exact prior source
hash reconstructed; zero open confirmed findings. Original failure logs/context
are retained privately. Diagnosis and recheck
requirements: [recovery record](../../prompts/recovery/2026-10-16-security-edge-case-validation.md).
A preliminary read-only placement inspection also safely refused an omitted root
argument; corrected owned placement verified learli_test/learli_owner and 34
already-current migrations. No migration, reset, account purge or bypass ran.

## Evidence limits

- This is selected local acceptance, not a full fresh default integration/E2E
  campaign, penetration certification or final launch approval.
- Guardian-managed learners remain private Parent-managed profiles without their
  own login. Independent College Students retain separate scoped accounts.
- Admin access still requires trusted role, current MFA and exact assignments;
  it does not expose private meeting credentials.
- Closed-pool/recreated-runtime recovery is narrower than actual automatic Neon
  idle-to-wake behavior. Existing local TLS termination proves its own same-pool
  recovery boundary. Actual hosted wake-up remains NOT RUN.
- Email capture and mocked SDK delivery/retry/timeout assertions do not prove
  real delivery. Real provider email, international devices, video attendance
  and a newly elapsed full lesson remain NOT RUN.
- Representative validation does not prove every form or arbitrary mutation is
  idempotent. Production edge/proxy fairness and historical deferred security
  leads/dependency upgrades remain outside this approved slice.
- Payments are disabled; sandbox payment checks are NOT APPLICABLE until the
  commercial/provider decisions are approved.

Private raw logs, error contexts and source identities remain ignored under
`.local/security-edge-case-20261016/`; secrets, cookies, tokens and private links
must not be published. Changes remain uncommitted. No push/merge/deploy or live
infrastructure modification is authorized or performed by this operation.

## Local service closeout

After the final run, browser 3121 and owned TLS 55703 were closed. The owned test
cluster had zero other client connections across its databases and was stopped,
retaining all synthetic records and private evidence. Owner preview 3000 retained
its original process/configuration. No account cleanup or customer-data action ran.
