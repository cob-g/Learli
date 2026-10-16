# Private fictional Parent/Tutor workflow — local verification

**Result: connected private software rehearsal passed; hosted activation pending.**
This does not supersede the earlier [default-app Parent attempt](parent-workflow-playwright-results-2026-10-16.md),
which was blocked at Add Child. The owner subsequently selected the explicit
private fictional composition. This run uses the normal application build,
without copied source or replacement feature factories.

## Scope and environment

- Branch: `feature/staging-interface-cleanup-20261016`, base `572cf4d`, preserved
  prior dirty work. No commit, merge, push, deployment or account purge.
- Configuration: `APP_ENV=test`, owned loopback `learli_test` on port55432,
  real application at `http://127.0.0.1:3121`, finite run-specific `.test` accounts.
  Actual hosted-provider compatibility tests use a separate disposable local TLS
  PostgreSQL harness; they do not contact Neon or Railway.
- Existing34 migrations were already applied. No new migration or altered
  privileges were required for this feature.
- Payments and real-family intake disabled. Local provider mail captured privately;
  actual verification links and actual admin authenticator enrollment used.
- The owner operator prepares exact policies and assignments only. Guardian
  evidence/authorization, tutor evidence/approval and booking confirmation use the
  application's current server/MFA/ownership checks.

## Connected browser results

Final command: `npm run test:e2e:private` — **1 test passed**,8.7s test duration,
10.2s total. Chromium,1440×900 with390px/1440px booking-history layout and WCAG
2A/AA/2.1AA Axe checks. Trace/video/failure screenshots disabled around private
proofs. Two earlier test harness attempts are recorded below.

| Parent workflow                               | Actual result                                                                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Register, verify, sign in, continue as Parent | PASS; provider flow and explicit Parent enrollment                                                                                                                       |
| Add child/learner                             | PASS through reviewed admission; pending learner inactive with zero guardian links, then assigned MFA evidence/authorization                                             |
| Find Tutor                                    | PASS; actual directory Math/Middle School filters, eligible public profile, background and dated times                                                                   |
| Book session                                  | PASS; selected learner/tutor/subject/UTC interval persisted, provisional then assigned-admin confirmation                                                                |
| Parent dashboard                              | PASS; the same booking appears in Upcoming Sessions                                                                                                                      |
| Tutor receives booking                        | PASS; the same booking appears in Tutor agenda and permitted learner details                                                                                             |
| Join Zoom/Meet                                | PASS for private Learli link save, persistence, reauthorization and both browser tabs reaching the same intercepted fictional destination; real video connection NOT RUN |
| Complete new session                          | NOT RUN after end; premature completion correctly returns409 and preserves confirmed state                                                                               |
| Booking history                               | PASS for current booking record in Parent history; completed-history behavior separately covered by PostgreSQL fixtures, not this same newly scheduled booking           |

Tutor registration/application, profile persistence, evidence-based screening
approval and initial availability persistence were exercised in the connected
browser test. Availability add/edit/remove/conflict behavior has separate real
database coverage; this browser case does not claim every schedule CRUD control
was manually exercised. Photo upload, exact-grade storage, pricing and Tutor
acceptance were not added. Grade8 uses the implemented Middle School category.

Unrelated Parent access to admission, learner, booking and meeting information
was denied. Tutor admin mutation was denied. Public profile output excluded the
private meeting link. These assertions inspect actual responses/state, rather
than relying on hidden buttons.

The scheduled notice plus lesson duration prevents immediate completion of the
same newly created booking. Separate deterministic assigned-Tutor completion
tests cover post-end completion, audit/history, concurrent retries, failure
rollback and current-authority changes. They are **not** a full nine-step
same-booking browser completion or evidence of video attendance.

## Combined validation

| Check                                          | Observed result                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`                                | PASS: formatting, lint, route type generation/TypeScript,123 unit/component files and1886 tests; one unused-import warning subsequently removed        |
| Final `npm run lint`                           | PASS, no warnings                                                                                                                                      |
| `node scripts/with-test-env.mjs npm run build` | PASS; four dynamic filesystem/tracing warnings                                                                                                         |
| Build trace privacy inspection                 | 137 generated traces checked; zero references to `.local` state or local environment files                                                             |
| 20 affected PostgreSQL suites                  | 336 tests passed across19 files; hosted compatibility8 tests passed separately after assigning its required isolated TLS port —344 final passing cases |
| Normal-build private Playwright                | PASS, including actual directory navigation and shared booking/link                                                                                    |
| Local metadata operator CLI                    | PASS: idempotent `prepare` applied three policy records and one reviewer; zero assignments or confirmation grants created                              |
| Responsive/accessibility                       | PASS on booking history at390px/1440px; broader modified-screen visual/manual QA remains advisable                                                     |
| `git diff --check`                             | PASS                                                                                                                                                   |

Affected database suites cover auth/hosted-provider compatibility, Parent
enrollment, tutor catalog, availability, learner creation/admission/isolation,
public candidates, booking conflicts/retries/read projections/meeting links,
policy workflows, assigned-Tutor completion and private composition boundaries.
This is not a claim that every repository test or all browser engines ran.

At closeout, the owned test PostgreSQL cluster had zero other clients and was
stopped with its synthetic data retained. The owned browser/TLS test servers were
already stopped. The existing owner preview on port3000 was preserved and its
health endpoint returned200; it is not the newly verified private rehearsal.

## Findings and failed attempts retained

- Review found same-version altered screening metadata could still advertise and
  book a Tutor. The controlled PostgreSQL regression test failed before repair
  (one test,14 assertions). The shared predicate now compares the entire immutable
  receipt/window; final scope/operator13 cases pass without weaker expectations.
- Review found a meeting save could retain an old private audience during a row
  lock wait. The regression observes the real lock, changes the packet and proves
  rejection with unchanged link/revision/event state. Packet consistency now
  protects the relevant awaited reads and booking/meeting commits.
- Initial browser startup rejected a mismatched Better Auth URL; corrected the
  runner's owned test URL. The next attempt timed out on an incorrect test label
  (`Level` versus `Learner level`). Corrected the locator, preserving intended
  Middle School selection. Both subsequent normal-build runs passed; the final
  one additionally traverses actual directory filters.
- The first combined database command omitted the existing hosted suite's
  required `LEARLI_STAGING_TEST_PORT`: that suite failed setup/eight tests skipped,
  while the other336 passed. Rerunning hosted auth on explicit owned TLS port55703
  passed all eight. This was test setup, not a production failure.

Private evidence is retained under `.local/private-fictional-workflow-20261016/`.
The [recovery record](../../prompts/recovery/2026-10-16-private-workflow-validation.md)
preserves diagnosis and repair scope. The independent source review returned
READY FOR VERIFICATION after the two substantive repairs; verification above is
separate executed evidence. UI-author review independence is limited; the
coordinator separately inspected that presentation.

## Remaining staging gates

No hosted target was activated. The metadata CLI supports the owned local test
target only; target-specific hosted preparation, provisioning/apply approval,
deployment and hosted acceptance remain pending. Real email delivery, real video
connection, attendance, a full-duration same-booking browser completion, production
readiness, real consent/screening policies and account deletion were not verified
or performed. See the [operator/runbook](../operations/private-fictional-workflow.md).
