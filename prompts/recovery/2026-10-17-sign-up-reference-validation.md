# Create account reference verification recovery — 2026-10-17

Authority: **AUTHORIZED — build-feature delegation**, the owner UI-only request
and `prompts/features/m1-05-signup-reference.md`.

## R1 — Native radio matcher assumption

Observed initial focused component run:27/28 passed. The new signup SSR test
used jest-dom `toHaveValue` for a radio input; the matcher explicitly rejects
that control type. The second new-file-only run similarly passed14/15 before
the same assertion. This is a test assertion API mismatch, not an application
failure or a changed signup contract.

Recover classification: targeted test repair. Assert the exact serialized
`value` attribute for each existing radio value, retaining separate checked/
unchecked and disabled-state assertions. Preserve all callback/payload and
hydration checks; no application source or expected contract change. Separate
test implementation/verification owns the repair and execution.

Separate Verify outcome: both new component files PASS15/15 after this change,
including six artwork lifecycle cases. Full checks and browser validation remain
separate; this focused result alone does not establish feature completion.

## R2 — Test query option typing

The first full check passed formatting/lint, then TypeScript rejected `exact`
in new Testing Library `getByRole` options. That option belongs to Playwright;
Testing Library matches a string accessible name exactly by default. Component
runtime success alone did not establish test-source type compatibility.

Recover classification: targeted test-API correction. Remove only unsupported
Testing Library `exact` properties, retaining every exact string name and
assertion. Do not change Playwright's supported options or application code.
Preserve the initial check log. Separate implementation and verification rerun
types, the new component suites, and the full check/build/browser plan.

## R3 — Component focus scheduling

Second full check passed formatting/lint/types and2,018/2,019 tests. A new
network-rejection case observed the rendered alert with body focus under the
parallel suite, although its focused run passed. The production notice function
is byte-identical to baseline and schedules one requestAnimationFrame focus.
The new immediate-rejection test did not control that frame relative to React's
asynchronous commit; the existing sign-in case uses a deferred response/act.
This establishes timing-sensitive component verification, not the exact timer
interleaving or a newly introduced browser defect.

Recover classification: targeted deterministic test scheduling. In the two new
focus cases, queue rAF callbacks, assert a frame was requested and the alert
committed, then execute the callback inside act and assert actual focus. Retain
all payload, clear/remask, disabled, refusal and retry assertions. No sleeps,
larger timeout or source change. Browser validation must independently check
real frame/focus behavior. Preserve the failed full-check log and repeat the
affected verification.

Separate Verify outcome: final full check PASS134 files/2,019 tests,12.96s test
phase, plus formatting/lint/types. Real normal-build browser19/19 PASS17.3s;
the separate controlled browser probe also observes the actual signup error
receiving focus, with unchanged production frame scheduling. No application
repair was needed for R1–R3; all assertions/expected contracts are retained.

## R4 — Browser diagnostic alert locator

The first visual probe passed layout/motion/pending checks, then a global alert
locator matched both signup feedback and Next's route announcer. Recover
classification: diagnostic scoping error. Scope the existing alert assertions
to the signup form, preserving content and focus assertions. Separate probe
rerun PASS across8 widths/12 captures/4 zero-violation Axe audits, actual motion,
pending/error/College selection and static fallbacks. Timestamped failed output
is retained. No application code, auth request or behavior changed.

## R5 — Compact-footer focus probe after capture

The footer-only probe passed route/history isolation, desktop/mobile Axe and
390px focus clearance. At320px it attempted to focus the same Help link that
remained active after the preceding full-page capture explicitly scrolled to
document top. Focusing an already-focused node does not repeat native focus
scrolling; the measurement therefore described the capture helper's state,
not a fresh user keyboard focus transition.

Recover classification: targeted probe setup correction. Preserve the first
output/captures; blur Help before each width's focus action, then retain the
same focus/dock geometry assertion. No source, spacing, timeout or expected
clearance change. Separate verification reruns the probe on the same build.

Separate Verify outcome: footer probe PASS after this setup correction, including
both mobile focus-clearance assertions, direct/client/history route isolation,
four zero-violation Axe audits, no overflow and no-script compact markup. Five
final captures were validated. No application repair or database operation.

## R6 — Mobile refusal text crosses decorative ribbon

Independent final finish Review requested one targeted fix: at390/320 the
pre-existing transparent signup alert lets the navy decorative diagonal run
behind red refusal text. The defect predates form-motion/control changes;
baseline CSS and before-fix captures confirm origin. Existing AuthForm supplies
the right message, role and focus; the issue is presentation contrast only.

Recovery mode: targeted implementation repair, AUTHORIZED — build-feature
delegation for the verified form failure path. Add only a signup-scoped opaque
surface background to its existing alert. Preserve markup/copy, auth/validation,
focus, layout, animations and unrelated pages. No data/provider/reset action.
Retain pre-fix captures and check/build/probe evidence under
`.local/signup-form-motion-20261017/before-contrast-fix/`. After implementation,
source reReview, production build and same final browser/capture matrix plus
explicit mobile alert-surface assertions are required. The previous2,030 unit/
component result remains applicable to unchanged TSX/test logic; no new tests
that merely mirror this CSS declaration. No second detector run.

R6 separate Verify outcome: final production build and same combined probe PASS,
including explicit opaque White alert assertions at390/320, six zero-violation
Axe audits and nine valid recaptures. Final independent source reReview READY,
and finish verdict pass scored the sole contrast finding resolved / ship at
fix scope. Original before-fix evidence remains retained. No AuthForm/data/
provider change or additional material fix.
