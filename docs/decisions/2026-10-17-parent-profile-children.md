# Parent Profile and My Children journey

- Date:2026-10-17, Asia/Manila.
- Owner request: parent Step2 must support own profile save/refresh and My
  Children → Add Child → Grade8 → save/list/refresh without loss or duplication.
- Owner approval: “okay approve recommendation” after the scoped recommendation.
- Software authority: **AUTHORIZED — build-feature delegation**, not a separate
  human review of the generated blueprint.
- Blueprint: `prompts/features/m4-04-parent-profile-children.md` (M4.4/M5.4,
  FAM-01/03 and AUTH-05).

## Decision

Provide dedicated guarded parent routes using established services/forms and
workspace patterns. Parent Profile edits only existing permitted own-account
fields. My Children shows authorized guardian-managed profiles; its bounded own
admission request cards distinguish saved/pending state from current access.

Store optional integer school grade1–12 on private guardian-managed non-College
profiles, with no automatic international curriculum/education-level mapping or
backfill. Grade8 is explicit metadata, not grades/marks, age proof, consent,
attainment, or matching eligibility. Omitted PATCH preserves; null clears. Keep
old function contracts and null-grade idempotency receipts intact.

## Preserved safeguards and operating boundary

Development creation remains fictional and guarded. Private staging still needs
current policy and assigned MFA-admin evidence/review before guardian access.
No child logins, school/DOB collection, new guardian policy, public learner data,
booking/payment changes or new providers follow. Existing student routes remain.

The original preview and dirty UI work are preserved; implementation and testing
use an isolated worktree and an owned loopback PostgreSQL cluster. Exact remote
Neon/Railway migration or deployment is separately concrete and authorized under
`2026-10-16-private-fictional-staging.md`; no remote apply or production operation
is implied by this software approval. Verification status is recorded separately
in `context/progress-tracker.md`.

## Exact development rollout authorization and execution — 2026-10-17

After the concrete six-migration backup/target/preview plan was presented, the
owner instructed “okay close servers now I just want updated server”. Applied
only that exact Neon development plan, preserved original application data and
all existing user work, and replaced the old previews with the updated original
3000 server. See the rollout record/progress for actual backup/restore, apply,
checks and limitations. Production, deployment and Git integration remain outside
this authorization; source files are integrated locally without commit/merge.
