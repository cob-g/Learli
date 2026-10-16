# Learli Recovery — private Admin acceptance validation

- Status: RESOLVED BY SEPARATE IMPLEMENTATION, REVIEW AND VERIFICATION for this
  local fictional scope; failed evidence retained.
- Mode: Targeted Fix; owned local synthetic environment only.
- Authority: **AUTHORIZED — build-feature delegation**, from the owner's approval
  to implement the scoped Admin recommendation, 2026-10-16.
- Blueprint: [M5.6](../features/m5-06-admin-workflow-acceptance.md).
- Baseline: preserved dirty `feature/staging-interface-cleanup-20261016`,
  HEAD `572cf4d`, exact snapshot `.local/admin-workflow-20261016/baseline/`.

## Observed failures and diagnosis

1. Worker B's first assigned-booking PostgreSQL run: 15 failed/7 passed. The new
   action projection called internal `booking_workflow_tutor_current`, which
   `learli_app` cannot execute. B diagnosed a local implementation mistake and
   replaced that presentation predicate with the existing explicit current
   Tutor/account/role/offering conditions. No grants or migration were changed.
   The following run passed 21/22; its remaining test expected foreign-Origin
   GET rejection, whereas the legacy local GET helper deliberately ignores that
   header. B applied explicit Origin rejection only to the new private staff GET,
   preserving ordinary navigation and existing helpers. Final affected run:
   90/90 across six files, before independent Review. Failed logs are retained
   privately as `.local/private-admin-bookings-{first,green}.log`.
2. Cross-author read-only Review found a deterministic new browser fixture error:
   `tests/e2e/private-fictional-admin.spec.ts` creates an already-confirmed ended
   historical fixture, then invokes `h.grantBooking`, whose operator command
   correctly requires a live provisional booking. It would refuse before actual
   Tutor completion. This is source-established; browser reproduction has not
   run. The historical record is already expressly disclosed as an owner fixture,
   separate from both fresh browser-created bookings.
3. Cross-author Review found the operator runbook still listed only the prior
   commands. Add the approved single-target `grant-account` syntax and local-only
   provenance/no-revival restrictions; no source or policy change is needed.
4. First combined normal-build browser execution failed all three cases (retained
   privately at `.local/admin-workflow-20261016/browser-first.log`). Admin attempted
   GET on the POST-only legacy Tutor review API and received405; the actual read
   boundary is the assigned Tutor detail page. Student expected exactly one
   Science/College Tutor, but the preceding Admin journey correctly supplied a
   second eligible Tutor in the same finite audience. Parent registration failed
   after the added cases shared the existing signup rate bucket: owned-test
   inspection showed a bucket count of10, matching the unchanged ten-attempt
   60-second rule. These are source/runtime-supported test contract/isolation
   failures; no application permission or signup-rate relaxation is justified.
5. Second combined browser run: Parent/Tutor passed; Admin and Student failed.
   Admin read `page.url()` synchronously immediately after a Next link click,
   before client navigation settled (expected page2, received absent page).
   Student reached its final logout step after completing the booking/history
   checks but could not find the account disclosure. Owned-test inspection found
   the shared get-session rate bucket at100, the unchanged default limit; the
   initial per-case reset omitted this bucket. A throttled session refresh is a
   supported cause hypothesis, not a captured429 response. Preserve the failure
   and extend once-per-case auth-state isolation to this known route. The local
   provider deliberately pins the loopback IP; do not bypass that protection.

## Recovery recommendation

For the second finding, provision only the exact current Admin workflow task/read
assignment for that historical fictional booking as explicit owner fixture
metadata. Retain the live-only operator guard, real Tutor completion action,
participant authorization, immutable history and all fresh browser booking paths.
Do not broaden production grants or present fixture creation as real attendance.
Re-review the changed test and execute the combined normal-build browser suite.

No evidence indicates polluted repository state, a wrong policy foundation,
production access, real-user exposure or need for a destructive reset.

For the first combined browser failures, verify Tutor reads through the actual
assigned detail page, assert the exact known current-run Science Tutor set rather
than assuming only one journey exists, and isolate the owned test authentication
attempt buckets between journeys. Preserve all actual signup/MFA requests and
unchanged production throttling. Use the established synthetic test setup pattern;
do not add sleeps, retries, fake responses or loosen assertions to an arbitrary
positive count. Re-review test-only changes and rerun all three journeys.

For the second attempt, await observable URL completion before inspecting all
affected Admin navigation query values; keep the same exact expected values.
Include the known get-session route in the guarded once-per-case counter reset,
with no in-case reset, request suppression, fake session result or application
limit change. Re-review and repeat the combined browser run. Production source,
the passed build and actual-PG implementation remain unchanged.

## Separate implementation and verification

- Recovery itself performs no source/test repair or test execution.
- Worker B's recorded repairs/checks above are supplied historical evidence.
- Separate Implementation replaced the historical fixture's live operator call
  with one explicit exact owner task grant. Cross-author re-review confirmed the
  correction preserves the operator guard and real Tutor completion path.
- The operator runbook addition was implemented separately and independently
  re-reviewed as resolved.
- Separate test-only Implementation corrected the actual Tutor detail boundary,
  exact known Science Tutor expectations and owned-test auth-attempt isolation.
  Independent re-review passed for both test-only revisions. Third combined
  normal-build browser execution passed all three cases in 35.8 seconds; final
  full check passed 130 files / 1,990 tests and static checks. No production source,
  operator guard or throttle was changed during browser recovery.
- Final current check/build/PostgreSQL/browser evidence belongs in the
  [QA record](../../docs/qa/admin-workflow-results-2026-10-16.md).
