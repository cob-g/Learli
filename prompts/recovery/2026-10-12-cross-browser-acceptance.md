# Recovery — cross-browser acceptance

Authority: AUTHORIZED — build-feature delegation, Worker5 task_2327e1fceb07 /
ctx_cef83e683724. Baseline5634e44; owned branch cob-g/m8-cross-browser-acceptance.
Scope: M8.9/NFR-01/02/05/09 harness only; application changes require root allocation.

## R1 — fixture callback naming

Mode: Targeted Fix. Scoped ESLint exited1 because Playwright's callback parameter
`use` was interpreted as React's hook. Rename to `runFixture`, retaining try/finally
cleanup and every lint rule/assertion. Subsequent scoped lint and full check657
passed. Original lint-scoped.log preserved. No application change.

## R2 — public auth history precondition

Mode: Targeted Fix. First serial engine run exited1:16pass/2fail, one auth-only
failure per engine. At spec line289 it expected a Sign in button after Back.
Both sanitized failure contexts show Create a test account. The journey starts
on public signup, verifies and signs in with document replacement, reloads account,
then signs out with replacement. Back reaches the earlier public signup entry;
the test did not establish a retained private-history entry at that point.

Repair recommendation: establish a real private `/account/sessions` history
entry, navigate back to account settings and then sign out. Retain Back's actual
sign-in redirect/button, assert the prior identity content is absent, and retain
the401 account API assertion. Preserve normal caching in this auth context.
Root msg_03c2990abe3c confirms this intended private-history precondition;
an earlier public-Back/explicit-revisit draft was not executed and is superseded. All dedicated same-context private booking Back assertions
remain unchanged: logout/different actor, revoked session, expired session and
failed reauthentication already passed in both engines. No relaxed privacy
expectation, auth bypass, runtime change or browser retry is justified.

Preserve browser-1.log, browser-attempt-1 artifacts, reviewed-manifest.json,
check/build logs and all owned data. Before another execution, re-review the
test-only correction, run affected static checks and obtain a new heavy slot.
Verifier should execute corrected auth cases in both engines and final complete
matrix, reporting mixed versus uninterrupted proof honestly.

## R3 — WebKit control geometry (confirmed by separate Verify)

Four public390/1440 captures were visually inspected. WebKit native select fields
look shorter than Firefox fields despite the existing `.field` min-h-11 rule.
This is not yet a confirmed application defect: inspect actual bounding boxes
and computed min-height, preserving engine-native rendering. Add safe numeric
geometry evidence and target-height assertions to the owned harness; do not
alter the application CSS or weaken expectations. If confirmed, root assigns
the application repair and supplies the accepted runtime for renewed verification.

Recover performed read-only diagnosis and wrote this note only. Heavy verification
and application repair are NOT PERFORMED BY RECOVER; current final acceptance
remains pending. Real-user/provider/commercial/guardian/safeguarding gates stay OPEN.

Executed focused Verify after R2 repair:3/4pass, exit1. Firefox public select
geometry is44px/minHeight44px; WebKit27.2 native selects are30px/minHeight18px,
all appearance:auto, at1440×900. Original .field source intends min-h-11.
Safe JSON artifacts: browser-attempt-2 public-control-geometry.json per engine;
original browser-2.log retained. Both corrected auth cases pass with a real
private sessions history entry, normal caching, Back identity absence and401.
Full18 rerun stopped pending root application repair allocation. No application
change or target-size waiver by Worker5. Classify R3 as targeted existing UI
compatibility defect requiring root ownership, fresh accepted runtime hashes,
re-review and renewed static/build/engine acceptance. Slot B released and
escalation sent; current final acceptance BLOCKED on that external allocation.

## R3 allocated targeted implementation recommendation

Root msg_33183702628d allocates only src/app/globals.css native .field select
sizing and relevant UI/tracker/blueprint/recovery records. Compiled .field CSS
already requests min-height calc(var(--spacing)*11), but observed WebKit native
appearance computes18px and renders30px. Diagnosis: native widget painting is
constraining authored box sizing, inferred from exact metrics and unchanged
compiled rule; no missing Tailwind utility or application permission defect.

Smallest correction: select.field { appearance: none; }, preserving the actual
HTML select/labels/options/native popup, existing44px minimum, type, border,
colors, radius, global focus and no-JS flow. This relinquishes OS closed-control
painting; no custom JavaScript widget, new asset/dependency, arbitrary offset or
fixed height. MDN confirms appearance:none changes painting while retaining
native widget functionality:
https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/appearance

Separate owner should apply/re-review this targeted rule, send exact CSS hash to
root for consumer acceptance, then obtain a slot for fresh check/build/full18.
Verify real select size at each viewport, focus/native no-JS/keyboard paths,
public visual captures and unchanged private Back/ownership flows. This is a
proposed repair at diagnosis time, not runtime acceptance; Recover runs no tests.

Root followup msg_21e135a68e2e requires a visible dropdown affordance. The final
CSS uses two hard-stop transparent/currentColor triangles as a flat functional
marker, with existing spacing values8/12/20/32 and reserved inline text space.
This narrowly allocated control indicator is the only use of gradient syntax
allowed here; decorative gradients remain prohibited. CurrentColor follows the
existing foreground or disabled muted token; no new hue, asset or widget.
Only single-value dropdowns (no size or size0/1, not multiple) receive it.
Multi-selects/listboxes receive no marker. Disabled select fields use existing
subtle/muted/border tokens. Forced-colors mode restores native painting/marker
and clears background images; global focus and native HTML behavior remain.
The earlier marker-less draft was not accepted/frozen and is superseded.

## R4 — Firefox forced-color restoration transition

Focused repaired-runtime run3:3/4pass, Firefox public fails only after active
forced-color smoke is immediately restored to default/reflow. All30 select
measurements across both engines now44px with marker/text room; WebKit public
and both corrected auth cases pass. Diagnostic run4 reproduces one color-contrast
violation: foreground#747474/background#8d92b8/ratio1.54, hashed target only.
No HTML, label or private value logged. This is consistent with a transient
foreground/background interpolation during the existing150ms color transition,
inferred from intermediate colors; exact affected control still unconfirmed.

Runtime CSS remains accepted e80f7be... and unchanged; original logs/artifacts
preserved. Proposed targeted harness setup: test default and forced-color states
in separate fresh contexts, retaining all axe/size/marker/focus/no-JS/privacy
assertions and documenting live OS-mode switching outside the selected matrix.
Alternatively root allocates shared motion changes if transient-mode behavior
is required here. Root question pending; no runtime repair or assertion waiver
performed. Recover diagnoses only; renewed final engine proof remains pending.

R4 root answer approves fresh isolated steady-state mode contexts, preserving all
axe, dimensions, marker, native, disabled/listbox, motion and privacy assertions.
Shared action-color runtime scope is not added. Separate implementation now loads
forced-color Firefox in a fresh document and retains unchanged default/reduced-
motion checks on the original document; no sleeps, relaxed thresholds or skips.
Record the immediate mode-switch transient failure as limited/unverified scope,
not transition correctness. Final full18 uses frozen accepted CSS under slot A.

## F-C1 — private SDK failure diagnostics

Independent Review C identifies unprotected APIRequestContext transport calls
(including local verification proof URLs/cookie headers) and injected route.fetch.
Playwright can include private values in failure call logs even with traces off.
Root allocates a narrow harness repair: protect SDK request/navigation exceptions
with a new fixed-message rejection; preserve status assertions and nonzero exits.
No response/assertion is swallowed and no retry/success fallback is added.
All owned request/get/post/put, route fetch/abort/continue and page goto/reload/Back
operations use the shared projection; private response parsing/mailbox parsing
uses the same protection. New unit regression requires a real raw SDK failure
containing generated proof/cookie sentinels, then a projected child CLI failure
exit1 whose list output includes neither sentinel. Original child evidence stays
private. Read-only scoped same-agent re-review finds implementation ready for
separate Verify; independent review and executed regression remain distinct.

## R5 — Firefox committed-result focus

Full run5 retained17passes/1failure: guardian lost-response retry saved heading
was not focused in Firefox. Assertion remains unchanged. Root diagnosed
one-shot animation-frame focus timing and owns the bounded commit-tied repair
and three component regressions; exact accepted booking/email snapshots imported
with preimage/hash checks under msg_ba59a51e22b6. Borrowed files are not edited.
Root reports separate check788/build and affected Chromium9 passes; these are
root evidence, not this worker's execution. Fresh full18 follows local Verify.
