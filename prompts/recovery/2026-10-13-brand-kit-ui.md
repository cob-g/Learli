# Brand kit UI recovery

Authority: AUTHORIZED — build-feature delegation, M1.10 user request 2026-10-13.

## R1 — Inverse footer navigation

Observed in independent source review: the new components-layer `.nav-link`
navy foreground outranks the base-layer inverse-link white foreground. Footer
navigation uses `.nav-link` inside a navy surface, yielding navy on navy.
Classify targeted fix: the visual system is correct; CSS layer precedence is the
fault. Add an explicit inverse navigation foreground in the components layer.
No data/security change. Coordinator implements after diagnosis; reviewer checks
the revised rule, then browser computed-color/axe validation proves contrast.

## R2 — Selected option readability and focus

Independent review found that navy selected availability options retain a nested
slate LessonTime zone (1.94:1), while matching radios/checkboxes retain a deep-teal
focus ring against navy (2.26:1). Classify targeted shared presentation repair:
selected navy options must rescope focus white and explicitly adapt nested muted
text to white. Preserve native selected semantics and server-formatted date/zone
values. Reviewer rechecks source, browser verification checks selected and focused
states and contrast. No changes to selection handlers or data.

R2 rereview identified the same inherited focus issue in the eighth navy native
choice, the family learner selector. Apply the white focus token there too;
include that state in browser verification. The seven public choices were already
corrected. This is the same scoped cause, not a different product decision.

## R3 — Enlarged navigation and browser focus

The first rendered batch showed a 597px document at 390px with 200% root text:
the fixed single-row header could not accommodate the enlarged logo and controls.
Allow the header and its control group to wrap without shrinking the text.
WebKit does not focus a clicked button, so native dialog close restored no menu
trigger; explicitly focus its ref on close. Keep the native dialog and navigation.
Add a cross-browser regression for enlarged text and Escape/close focus. The same
batch found adjacent admin links visually concatenated; add a wrapping gap group.
Targeted presentation/accessibility recovery, no authorization or data change.

## R4 — Finish-review text enlargement

The independent Impeccable finish reviewer accepted the supplied identity and all
22 normal-size captures, but returned `fix` for eight routes at 320px/200% text,
including the tutor profile at 390px. Native fieldset minimum sizes, unbreakable
text and unconstrained flex status/slot content create the overflow. Constrain
fieldset/control widths, allow long labels and complete time values to wrap, and
keep status icons intact. Preserve enlarged type size, selected contrast and all
form/data logic. This is the reviewer's bounded repair batch; recapture the same
screens and enlarged-text states, then obtain its explicit verdict.

## R5 — Isolated browser notification harness

The first browser run passed 81 tests, then six notification CLI captures stopped
safely and 63 downstream tests did not run. Independent diagnosis found the CLI
reads the working directory's owned-database manifest; the primary checkout's
legacy manifest lacks its required port metadata, while the new isolated runtime
manifest is valid. The application and CLI guards remain unchanged. Adapt only
the ignored test harness so this exact CLI child uses the isolated runtime working
directory and absolute source paths, preserving both primary private env files and
manifest. Keep the failed run, then rerun the affected and previously unrun tests.

The isolated notification retry passed five cases and exposed two follow-ups:
its integrated sign-up test also needs the root server's synthetic verification
mailbox, so link the complete owned test-mail directory in the temporary runtime
(the original primary mailbox is not deleted). A fixture-status assertion matched
both the new wrapping span and its parent. Scope the unchanged exact status text
to its existing polite live region, preserving the JS and no-JS checks. Neither
failure requires application behavior, credential or guard changes.

A subsequent integration retry encountered duplicate named tutors left by its
failed first fixture. Restore the clean owned test baseline through the existing
global setup before its final focused run; this targets only the newly created
55543 synthetic test cluster. Do not weaken the unique-link assertion. The other
62-case continuation passed 56 and stopped before six admission cases because
its mirror correctly rejected the primary manifest. Run those six from a copied
source snapshot beside the owned runtime manifest, preserving the mirror's exact
source-substitution and database-ownership checks.

R4 recapture resolved all known overflow except the profile at 320px/200%. A
targeted browser text-range measurement confirmed the full “Elementary” level
label spilled from the narrow identity column beside the initials avatar. Allow
that column's text to wrap; preserve the exact subject and level labels. The
capture script also observed one admin keyboard-navigation timeout without first
asserting trigger focus. Preserve that failed observation and perform a focused
navigation confirmation; no application navigation change is justified by it.
