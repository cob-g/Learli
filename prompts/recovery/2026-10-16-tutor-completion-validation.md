# Learli Recovery — Tutor completion validation

- Status: RESOLVED BY SEPARATE VERIFY STAGE (same agent), after authorized
  build-feature targeted repair.
- Mode: Targeted Fix, isolated local test environment only.
- Branch/base: `feature/staging-interface-cleanup-20261016` at `572cf4d`, with
  preserved uncommitted Parent onboarding, interface cleanup and completion work.
- Blueprint: `prompts/features/m5-05-assigned-tutor-completion.md`.
- Related: M2.4/M2.9 Parent setup, M5.5 completion; BKG-07, AUTH parent enrollment.

## Observed failure

The first 71-case browser run failed the Parent signup/onboarding accessibility
case on the Parent setup page. Axe observed contrast 1.27 on the enabled
“Continue as parent” button. Seven serial follow-on auth cases were not run;
other projects continue. Existing static/unit checks and 1,033 PostgreSQL tests
passed before this browser run; they do not waive the browser failure.
Sanitized evidence: `.local/tutor-completion-20261016/browser-initial.log` and the
corresponding private Playwright error context. No real identity/provider involved.

## Root cause and bounded recovery

`ParentOnboardingForm` uses `.action.action-primary`; the shared `.action` has a
150ms color transition. The button starts disabled before hydration, then its
foreground and background interpolate from muted colors to the primary colors
when enabled. The failing axe snapshot caught an enabled button during that
interpolation. Other guarded mutation forms already use `transition-none` for
this state change, including `AuthForm` and `WorkflowActionForm`.

Use that existing local convention on the Parent setup button. This removes the
unsafe enabled color interpolation while preserving all hydration, submission,
permission, no-script and error behavior. Do not add sleeps, disable contrast
checks, weaken assertions, change global tokens or alter authorization.

## Separate implementation / review / verification handoff

1. Add `transition-none` only to the Parent setup mutation button; record the
   supporting correction in the completion blueprint and progress tracker.
2. Read-only Review the exact one-control change against existing UI patterns.
3. Re-run static/unit checks and build, then affected Parent auth browser cases
   and the new Tutor completion browser scenario. Reuse the passing PostgreSQL
   checks only if no backend, database or test execution behavior changed.
4. Retain the original failure and actual rerun evidence; do not claim a single
   all-green 71-case run unless it actually executes.

No new owner/business choice, provider operation or destructive action is needed.
Implementation and verification are NOT PERFORMED BY RECOVER. Background browser
verification already started by the coordinator may finish; Recover only reads
its existing evidence.

## Additional first-run finding — exact learner label assertion

The new v2 browser scenario completed the Tutor UI/SQL action, replay and Parent
completed-detail checks, then failed its exact learner-name-only text assertion.
The existing detail renders the learner name and level together in one `dd`:
`name · High School` for this explicit fixture. The product is behaving according
to its established minimal-learner presentation; the new test expected a separate
name node that does not exist. Correct the assertion to the exact combined
fixture name/level. Do not remove the learner check or change production markup.
The final initial-run summary is 62 passed, 2 failed, 7 not run. Preserve both
failures and rerun all 71 selected browser cases after the two scoped repairs.
This diagnostic addition makes no implementation or verification claim.

## Outcome observed by the coordinator's separate Verify stage

Both scoped repairs were applied and read-only re-reviewed. `npm run check`
passed all 1,770/119 with clean lint; test-env production rebuild passed with the
same three inherited local-mail pattern warnings. The final single selected
Chromium run passed71/71, including the formerly failed Parent case, its seven
serial follow-ons and the new Tutor completion/Parent history scenario. No
backend/schema/integration execution changed after the passing full 1,033/71
PostgreSQL run, whose evidence remains applicable. Final 853-file source hashes
were verified unchanged. Original failures remain in private evidence; no test
was disabled, weakened or hidden. This is not independent review or live QA.
