# Independent College Student workflow — verification record

**Status: VERIFIED LOCAL, private fictional accounts with payments disabled.**
The [M8.9 blueprint](../../prompts/features/m8-09-student-workflow-acceptance.md)
is **AUTHORIZED — build-feature delegation** from the owner's approved
recommendation. This is not hosted staging acceptance or production readiness.
See the [corrected Student checklist](student-workflow-checklist.md).

## Delivered behavior

College Student is now an explicit signup intent and Account setup entry. It
leads to existing independent College Support admission and current review;
selecting the intent does not grant a role. Pending requests retain inactive
profiles, with no Student grant or guardian link. Current authorization is
required before showing Student workspace access. Public tutor/subject/time
selection survives signup, verification, review and return navigation.

Readiness booking queries now separate an account's Parent and Student views:
Student is owned self-managed College Support; Parent is authorized
guardian-managed learners. The same account's two roles no longer merge lists,
learner choices, overview, details or history. This was a same-account role-view
mixing defect, not a demonstrated cross-account disclosure.

## Baseline and environment

- Existing branch `feature/staging-interface-cleanup-20261016`, HEAD `572cf4d`.
  All prior mixed interface/Parent/Tutor/private workflow work is preserved.
- Exact 1,128-file dirty baseline retained privately under
  `.local/student-workflow-20261016/`; all 872 source/test/runtime/config hashes
  matched the preceding verified state before this unit.
- Owned loopback `learli_test` PostgreSQL on 55432 only. Existing 34 migrations
  were already current; none applied. No new schema, grants or dependencies.
- Chromium used the actual production build on loopback 3121, one worker,
  no retries. Finite disjoint fictional `.test` accounts used actual provider
  verification/capture, actual MFA and assigned eligibility review. No mirror
  build or direct Student/guardian grant substituted for admission.
- Local owner bootstrap/metadata preparation and the expressly historical fixture
  remain test setup. Meeting destinations were intercepted; trace, video and
  screenshots were disabled. No hosted/provider/data-purge operation occurred.

## Executed verification

| Check                                            | Observed result                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `npm run check`                                  | PASS: format, ESLint, route types/TypeScript, 127 unit/component files and 1,943 tests                       |
| `node scripts/with-test-env.mjs npm run build`   | PASS; four dynamic filesystem tracing warnings                                                               |
| Generated build trace audit                      | 138 traces; zero local-state/local-env references                                                            |
| Affected actual PostgreSQL integration selection | PASS: 14 files, 237 tests, 95.16 seconds                                                                     |
| `npm run test:e2e:private`                       | PASS: 2 connected Chromium cases, 21.3 seconds total                                                         |
| Student normal-build case                        | PASS: 12.5 seconds                                                                                           |
| Existing Parent/Tutor normal-build case          | PASS: 6.9 seconds                                                                                            |
| Final test-only TypeScript/ESLint/format checks  | PASS for reviewed passthrough helper; locator repair scoped lint/format PASS                                 |
| Read-only Review                                 | PASS / READY FOR VERIFICATION; cross-author coverage of onboarding, SQL, harness and subsequent test repairs |

The affected PostgreSQL selection was: private Student read scope, family
dashboard, booking read/overview projection, learner admission, private workflow
scope/operator, policy booking/boundaries/acceptance, meeting links, Tutor
completion, Parent onboarding and learners. This is not a claim that all repository
integration or E2E suites ran.

The dual-role regression was first run against the original queries: five
failures and two passes. Both predicate repairs then passed all seven cases;
related read/dashboard/private-scope compatibility passed 42 cases separately.
Those preliminary counts overlap the final selection and are not additional
final test totals.

## Student checklist results

| Step            | Local result and evidence boundary                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Registration | PASS: actual College Student signup/verification; pending admission lacks authority; assigned MFA review authorizes two independent Students without guardian links                                                            |
| 2. Profile      | PASS: own learner name/timezone save and refresh; reviewed College Support level stays locked; foreign changes denied                                                                                                          |
| 3. Find a Tutor | PASS: Science and College Support filters, approved eligible Tutor profile and real open interval; public selection retained across authentication/admission                                                                   |
| 4. Booking      | PASS: actual double-click creates one provisional reservation and event; exact retry returns same receipt; stale competing slot rejects; assigned admin explicitly confirms                                                    |
| 5. Dashboard    | PASS: Student and assigned Tutor see the same confirmed record; unrelated Student list is empty; own details and refresh persist                                                                                               |
| 6. Join link    | PASS for Learli private-link save/persistence/authorization and identical intercepted navigation; real two-party video connection NOT RUN                                                                                      |
| 7. Completion   | PASS only for a separately identified already-ended synthetic Science booking, completed through assigned Tutor UI with one attributed event/retry; fresh future booking duration NOT RUN                                      |
| 8. History      | PASS: completed historical record and separately replaced/cancelled versions retain accurate Student history/details and access restrictions                                                                                   |
| 9. Changes      | PASS: actual Student UI reschedule keeps logical identity, increments revision, retires old row/link and requires a new link; cancellation and replay preserve one event and consistent history                                |
| 10. Security    | PASS for foreign learner/admission/booking/link/mutations, unavailable slot, Student confirmation/link-edit/completion denial, premature Tutor completion, Admin/Tutor page denial, and actual logout/private-page/API revisit |

Onboarding and booking-history layouts passed 390px/1440px overflow and Axe
checks. Onboarding request navigation was exercised with Tab/Enter. These bounded
checks are not a full visual/accessibility or screen-reader audit of every page.

The final browser submit helper forwards each intercepted original POST once
with retries/redirects disabled, captures its real status/JSON before navigation,
and returns that server response unchanged. It asserts one observed POST per
click/double-click and retains receipt, retry, SQL state and event assertions.
It does not fabricate success or replace the mutation with a fixture.

## Preserved failures and corrections

Private logs remain under `.local/student-workflow-20261016/`.
The [recovery note](../../prompts/recovery/2026-10-16-student-workflow-validation.md)
records these actual failed attempts:

- Initial full check: 1,942 passed/one failed. Coordinator shell `umask 077`
  made the existing exposed-permission fixture private; unchanged assertions
  passed under normal umask with a separately protected log.
- Browser attempt 1: test expected split UTC URL fields where the authenticated
  native form intentionally uses a compound `time` field. Test now verifies both
  formats and the selected/saved interval; application serialization is unchanged.
- Browser attempts 2–3: Chromium discarded the response body during immediate
  navigation; eager reading alone did not resolve it. The real-response
  passthrough makes capture deterministic without changing application behavior.
- Browser attempt 4: a broad alert locator also matched Next.js's empty route
  announcer. Exact visible conflict-message assertions replaced that ambiguity;
  expected HTTP409 and unchanged-state assertions remain.
- Browser attempt 5: both cases PASS (`playwright-fifth.log`). Parent/Tutor also
  passed all four earlier attempts; earlier Student attempts were not passes.

Build, database and full-suite evidence apply to the reviewed production code;
only browser test repairs followed the original check/build/database runs.
Source hashes and final closeout checks are retained with the private run record.
No assertions, permission checks or production behavior were weakened for a pass.

## Remaining acceptance boundaries

No full-duration newly booked lesson, real Zoom/Meet connection/attendance,
actual Resend delivery, hosted target acceptance or deployment is established.
Prices, checkout and photo uploads are Not Applicable to this approved slice.
Real-family intake, age/guardian policy and payment launch gates remain separate.
M8 is not marked complete. No commit, merge, push, account purge or live
infrastructure change was performed.

## Final closeout

The integrated working tree passed `npm run check` again after all browser
repairs: 127 files/1,943 tests, formatting, ESLint and TypeScript; test phase
12.48 seconds (`check-closeout.log`). Diff whitespace and all five local links in
the new feature documents passed; production/runtime/support source stayed at
the reviewed build/database state. The final delta contains 28 files relative to
the preserved dirty baseline; earlier work outside that scoped delta is retained.

Owned test PostgreSQL was stopped after zero other local clients, with synthetic
data retained. The browser test server on 3121 stopped. Owner preview on 3000 remains
on its prior configuration, same process and health 200; it is not a newly
deployed private staging target. No hosted service was started or changed.
