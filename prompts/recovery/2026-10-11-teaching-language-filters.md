# Teaching-language filter labels — targeted recovery

Status: AUTHORIZED — build-feature delegation (2026-10-11).

Observed during same-agent read-only Review: the directory gives the English
subject and English teaching-language applied filters the same label, React key,
and accessible removal name. This is Failure Mode 1: a specific UI defect in the
new feature, with no evidence of session pollution or a wrong domain model.

The smallest repair is to prefix the language chip with “Teaching language:” and
test the simultaneous English subject/language case. Existing filter composition,
URL construction, eligibility, and database behavior remain unchanged. This is
within the delegated feature authority and needs no material product decision.

Implementation and verification follow as separate build-feature stages. Review
the repaired diff, then verify distinct removal names/targets in populated and
empty directory states along with the planned checks. No tests, resets, or runtime
changes were performed during this diagnosis.

Verification attempt 1: `npm run check` stopped at formatting because
`src/features/tutors/service.ts` needed Prettier line wrapping. This is another
Mode 1 tooling finding; recommend formatting only that changed file, reviewing
the mechanical diff, and repeating the check. No behavior or architecture
change is needed.

Dedicated browser attempt 1: directory and no-JavaScript cases passed, while the
owner journey reached the public profile then axe stopped with “Please use
browser.newContext()”. The test uses `browser.newPage()` for that public view;
the installed axe integration cannot open its helper page in this implicit
context. Mode 1 targeted test-harness repair: create an explicit signed-out
context and obtain its page, then close that context. No application defect is
established by this failure. Re-review that test change and repeat all three
language cases, including the previously unexecuted clear/public accessibility
steps. Preserve the first failed log; the existing baseline browser checks and
application checks remain applicable because only test setup changes.

Final screenshot inspection: the 640px forced-colors directory gives each select
too little width for its visible value. The existing flex items have zero basis;
adding a third filter leaves wrapping unused even though the container allows it.
Mode 1 UI repair: give filter controls a 10rem minimum width from the small
breakpoint, restoring zero minimum in the desktop sidebar. Leave the home finder
unchanged. Re-review and rerun quality/build/browser checks and inspect the
reflow screenshot; database/business-rule evidence remains applicable.
