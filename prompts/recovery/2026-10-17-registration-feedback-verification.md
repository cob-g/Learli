# Registration feedback verification setup

- Status: RESOLVED BY SEPARATE VERIFIER after authorized targeted repairs.
- Environment: isolated local test resources; original development preview.
- Blueprint: `prompts/features/m2-01-registration-verification-feedback.md`.

## Observed failure and diagnosis

The first scoped Playwright command exited before tests ran. The temporary
configuration lives under `.local/registration-feedback-20261017`, so Playwright
used that directory for the inherited hosted fixture command. Node could not
resolve its relative `tests/support/hosted-auth-app.ts` entry point.

This is a test-configuration working-directory error, not evidence of an
application or authentication defect. The original application build and the
15 isolated PostgreSQL identity tests had passed. No application repair, reset,
provider change or database change is needed.

## Separate implementation and verification handoff

Set the repository root explicitly as `cwd` on both inherited web servers in
the temporary config; preserve their registered commands and environment guards.
Then rerun the same auth and hosted-auth projects and retain both attempts.
This diagnosis did not run the repair or its verification. The coordinator owns
those steps separately and will record observed results in the tracker.

- Approval: existing user request and build-feature scope; no new material gate.
- Rollback: remove only the temporary configuration change; preserve all work.
- Production, account intake, authorization and saved user data: unchanged.

## Second observed setup failure

After the working-directory correction, the owned hosted mirror compiled but
its generated TypeScript configuration adapter failed TS2322/TS2339. The adapter
assumes every non-disabled mail configuration has a `transport` field. The
existing `private-capture` union member has no such field. The maintained source
fixture is unchanged from this task's captured baseline, so this is a pre-existing
test-harness compatibility defect, not a regression in signup feedback.

The minimal separate repair is to rewrite transport-specific origin fields only
for the `resend-single-attempt` member, preserving disabled/private-capture members
unchanged. This does not enable a provider or alter application production code.
An implementation worker must independently verify that narrowing, and the actual
hosted mirror build and browser journey must pass before acceptance. Preserve both
failed logs and the mirror build evidence; do not disable TypeScript or weaken
the test fixture's admission guards.

## First local browser result

The existing real-provider auth journeys and no-script check passed (9 checks).
Four new presentation cases stopped on a strict locator error: a global
`getByRole("alert")` matched both the intended signup error paragraph and Next.js'
separate route announcer. The observed application error text was correct. Scope
the new test's error locator to the signup form, retaining its text, focus,
credential, retry and state assertions. Rerun those presentation checks and keep
the original failed log. Use a distinct output directory while the separately
owned hosted suite runs. No application fix is indicated by this failure.

## Locator review and hosted error observation

The corrected local presentation run reached receipt state, with correction,
pending and failure accessibility/overflow checks passing at all three widths.
Three cases then hit another unscoped selector: the page has both navbar and
receipt Sign in links. Read-only reclassification remains Targeted Fix in the
new test, not polluted application state. Scope the receipt action to its named
Verify your email region after reviewing all remaining locators together.

The regenerated hosted mirror built and five real-provider checks passed. Its
sixth check still expected the old signup error text (`could not be completed`),
so it failed and two serial dependents did not run. Update only that signup error
observation to the new explicit uncertain-request message; additionally retain
checks for credential clearing, an enabled retry and absence of a success receipt.
Other matching old messages belong to unchanged sign-in/MFA flows and must remain.
Rerun the hosted serial suite so the later checks execute. These are test repairs,
with no application code or assertion removal. All previous logs are retained.

## Observed outcome from separate verification

The regenerated hosted mirror built and all8 serial hosted checks passed. All8
existing local auth journeys passed; the final presentation/no-script suite
passed5/5 with16 valid captures after correcting Chromium sticky-header capture
scrolling. Full check passed138 files/2,093 tests; PostgreSQL auth passed15/15;
normal build passed with4 pre-existing tracing warnings. Final capture-helper
lint and typecheck also passed. Independent source re-review found no issues,
and fresh visual review returned SHIP after the valid captures. Test resources
closed and the updated original preview remains on port3000. Evidence and limits
are recorded in `context/progress-tracker.md` and private
`.local/registration-feedback-20261017/` logs. No production or provider change.
