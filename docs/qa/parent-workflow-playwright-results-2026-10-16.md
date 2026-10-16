# Parent Workflow — Playwright Results, 2026-10-16

**Overall result: BLOCKED at normal child admission.**

Parent registration completed in the default application. The same new Parent
could not continue through normal child admission and create a confirmed booking.
Separately, **63 automated feature tests passed**, with no failed, skipped or
flaky cases. Those feature passes do not complete the nine-step journey.

## Environment and execution

- Branch `feature/staging-interface-cleanup-20261016`, base `572cf4d`, preserving
  all existing uncommitted changes. No application or tracked test source changed.
- Chromium against an optimized Next.js build with local test authentication,
  captured test mail, fictional identities and the owned loopback test database.
  All 34 migrations were already present; none needed replaying after restart.
- Default journey used the shipped default composition, with no admission or
  booking capability override. It created a new Parent through the real UI,
  verified the captured email, signed in and explicitly enrolled as Parent.
- The separate feature suite used the repository's existing isolated fixtures.
  Policy-booking cases use its test-only application mirror. Other cases cover
  default local simulations; HTTPS authentication uses the owned local harness.
- One read-only agent independently mapped assertions to the checklist and
  reviewed coverage limitations. The coordinator executed the browsers.
- No production/staging database, real notification, payment or external meeting
  was used. Existing manual preview configuration was not migrated or changed.

## Nine-step results

“Normal journey” means the same newly registered Parent, intended child and
booking. “Separate feature evidence” describes other isolated test scenarios.

| Step | Workflow               | Normal journey                            | Separate feature evidence                                                                                                                                                                                                                         |
| ---- | ---------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Parent Registration    | **PASS**                                  | UI Parent signup, email verification, sign-in and explicit enrollment passed. Database assertions confirmed only Parent, one role-grant audit and zero automatic guardian links.                                                                  |
| 2    | Add Child              | **BLOCKED**                               | Default UI offers only fictional local learner creation. Normal admission says no learner details are collected. There is no exact Grade 8 field. Local learner creation/editing, retries and access checks passed separately using broad levels. |
| 3    | Find a Tutor           | **NOT RUN in the same journey**           | Tutor application/review, Math and level filtering, matching, public profile and dated selection tests passed with controlled tutors. They do not establish Grade 8-specific matching.                                                            |
| 4    | Book a Session         | **BLOCKED**                               | The default entry remains “Simulated booking” and this Parent has no authorized learner. Simulated reservation/continuation/change tests passed. A separate mirror exercised policy-controlled requests and admin confirmation.                   |
| 5    | Parent Dashboard       | **BLOCKED for booking comparison**        | The new Parent dashboard loaded and correctly showed no authorized learner. Separate tests verified scoped test bookings, learner filtering, local times and history.                                                                             |
| 6    | Tutor Receives Booking | **NOT RUN in the same journey**           | A combined simulation test opened the same test reservation from Parent and assigned Tutor dashboards. Tutor access/denial and refresh cases passed. No ordinary Tutor acceptance action is implemented.                                          |
| 7    | Join Zoom/Meet         | **NOT RUN for an actual call**            | Private link validation/save/replace, participant access and redirect checks passed. Tests did not visit the meeting provider or connect two participants.                                                                                        |
| 8    | Complete Session       | **NOT RUN in the same journey**           | The assigned Tutor completed a separate, already-ended confirmed historical fixture under the isolated v2 policy. Parent denial, retry and exactly one Tutor-attributed completion event passed. No external attendance was established.          |
| 9    | Booking History        | **NOT RUN for this Parent's new booking** | Separate scenarios verified saved state/details, filtering, privacy and local times. The v2 completion fixture appeared in Parent details and the Parent dashboard. It is not the booking from Step 4 of this new journey.                        |

Current learner choices observed in the browser were Elementary, Middle School,
High School and College Support. No Grade 8-to-level equivalence was silently
selected. The normal-flow blocker is admission/guardian authority, independently
of that grade-field limitation.

## Executed checks

1. Test-env `npm run build`: **PASS**. Three inherited local-mail tracing warnings
   remain. This build did not activate a provider or change application policy.
2. Default journey observation: **PASS as an observation test**, whose recorded
   application outcome is **BLOCKED**. It was run twice; the final run waits for
   the booking heading before capturing its evidence. The first capture showed
   a loading state and was retained privately, not used as final page evidence.
3. Existing Playwright feature suite: **63/63 PASS**, 12 files, 144.38 seconds,
   zero unexpected, skipped or flaky cases, one worker and no dependency expansion.
4. Final source preservation: **853/853** source/test/script/migration/config
   hashes matched. Seven local report links resolved. Owned test web servers and
   PostgreSQL stopped, preserving synthetic data and the existing preview.

The private configurations change only test selection, report locations and
server working directories. The existing root browser setup clears synthetic
tutor inventory in the isolated test database before its fixture suite; it does
not target the developer preview or production data.

Reproduction from the repository root, after confirming the owned local test
environment and starting its database:

```sh
node scripts/with-test-env.mjs node_modules/.bin/playwright test --config=.local/parent-workflow-playwright-20261016/audit.config.ts
LEARLI_STAGING_TEST_PORT=55703 node scripts/with-test-env.mjs node_modules/.bin/playwright test --config=.local/parent-workflow-playwright-20261016/features.config.ts auth.spec.ts tutor-catalog.spec.ts learners.spec.ts profile-booking.spec.ts family-dashboard.spec.ts tutor-dashboard.spec.ts booking-history.spec.ts booking-meeting-links.spec.ts policy-booking.spec.ts local-completion-integration.spec.ts six-feature-integration.spec.ts --no-deps --workers=1
```

Private configurations, JSON reports, logs and screenshots are retained at
`.local/parent-workflow-playwright-20261016/`. They are local evidence, not public
deployment artifacts or committed customer records.

## Evidence and next action

- [Approved checklist](parent-tutor-session-checklist.md).
- [Parent registration test](../../tests/e2e/auth.spec.ts).
- [Local learner test](../../tests/e2e/learners.spec.ts).
- [Tutor discovery test](../../tests/e2e/tutor-catalog.spec.ts).
- [Same-reservation Parent/Tutor test](../../tests/e2e/six-feature-integration.spec.ts).
- [Private meeting-link test](../../tests/e2e/booking-meeting-links.spec.ts).
- [Assigned Tutor completion test](../../tests/e2e/policy-booking.spec.ts).

Finish the normal child/guardian onboarding and approved booking integration,
choose the exact staging target, then rerun the same-account/same-booking journey.
Successful real Zoom/Meet connection still needs a dedicated authorized manual
check. This result does not authorize policy changes, account purging or deployment.
