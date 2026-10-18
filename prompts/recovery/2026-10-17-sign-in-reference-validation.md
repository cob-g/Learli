# Sign-in reference verification recovery — 2026-10-17

Authority: AUTHORIZED — build-feature delegation, owner UI-only reference request
and `prompts/features/m1-05-signin-reference.md`.

## R1 — Initial accessibility check reports contrast failures

Observed: first check passed1,998 tests and build passed; normal-build browser1
passed18/19 in16.5s. The unchanged accessibility case failed on a decorative
subject label and the submit button. Preserve its exact Axe assertions.

Source evidence establishes two presentation causes: a conditional class string
lost the whitespace between base/selected chip names during formatting, leaving
selected text without its intended Navy backing; and enabling the initially
disabled button interpolates its light background into Navy while text already
becomes White (observed intermediate background #a3abc3, ratio2.28).

Recover classification: targeted presentation fix. Recommend complete literal
class names for the chip states and retain the former submit control's absence
of background transition across hydration/pending states. No authentication,
data, request, validation or assertion change. Separate implementation applies
this bounded repair, then independent source Review and separate Verify repeat
the affected checks/build/browser and planned batched visual matrix. Original
failure log retained privately; Recover performs no tests or application edits.

## Outcome — separate coordinator verification

Independent narrow reReview returned READY FOR VERIFICATION/no findings. Final
check1,998/131 and build passed; unchanged selected normal-build browser19/19
passed17.4s, including the formerly failing full-page accessibility case. Visual
matrix passed with zero Axe violations/overflow at four widths, plus actual
pending/failure/readiness/verification/200%/forced-color checks. Fresh finish
Review returned **ship**, no material fixes. Original18/19 failure preserved.
These results were executed and recorded by the separate Verify stage, not
Recover. No tests or assertions were weakened.

## R2 — Motion diagnostic keyframe serialization

Owner continuation requests the reference motion. The first private Chromium
probe observed the expected running 38s/46s/6s timelines and exact duplicated
track geometry, then stopped at a string comparison: Chromium serialized the
endpoint as `translate(-50%)` rather than the authored `translateX(-50%)`.
These represent the same horizontal translation; this is a diagnostic
representation assumption, not evidence of an application defect.

Recover classification: targeted diagnostic repair, under the same delegated
authority. Preserve attempt-1 output, accept the equivalent horizontal endpoint
serialization while retaining the -50%, zero-vertical, equal-period and coverage
requirements, and rerun the private probe. Do not change application source or
weaken observable motion checks. Separate implementation/verification owns the
repair and execution; this diagnosis alone establishes no passing result.

Separate Verify outcome: corrected private probe PASS; actual timelines, exact
loop periods/coverage, hover/press, pause/resume, offscreen suspension, simulated
document visibility, reduced motion, mobile and no-script behavior verified.
Three full-document Axe audits found zero violations. Seven captures have no
horizontal overflow; no auth mutation or page/console error occurred. The
application source did not change during diagnostic recovery. Attempt-1 JSON
and logs remain in the restricted motion evidence folder.

## Footer continuation — packaging diagnostic classification

The footer source check passed its exact changed-file boundary and byte-equivalent
CSS extraction assertions. An additional trace assertion then flagged memory.md
in 133 production traces because it grouped the sanitized local handoff with
private evidence/environment files. Inspection found no .local/.impeccable or
local environment files in any of 140 production traces. next.config.ts and
all tracing/runtime code are unchanged in this footer slice. The handoff reference
is an existing packaging concern, not a footer regression or evidence of public
serving. Preserve this failed diagnostic result and defer the unrelated config
change; no app repair, deployment or data action. The subsequent classified trace
result is recorded in `.local/signin-footer-20261017/trace-safety.json`.
