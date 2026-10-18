# M4.4 / M5.4 — Parent Profile and My Children

Status: **AUTHORIZED — build-feature delegation**, 2026-10-17. The owner approved
the recommendation to align Parent Profile → My Children → Add Child, persist
an exact grade, and show truthful saved/pending/authorized status while retaining
guardian authorization. No separate human inspection of this generated blueprint
is claimed. PRD: FAM-01/03, AUTH-05, applicable privacy/accessibility NFRs.

## Baseline and scope

Implement in `/Users/cob/orca/workspaces/learli/parent-step2-20261017`, branch
`cob-g/parent-step2-20261017`, base616e8c7. The root checkout's existing uncommitted
navbar/auth UI was copied and verified byte-for-byte before work; private baseline
manifest lives under `.local/parent-step2-20261017/`. Preserve that work and the
active root3000 preview. Read AGENTS.md and eight canonical context documents in
order; unchanged context already read during this run may be reused.

This is the approved parent coordination journey, not a new design system or LMS.
Retain account display-name/timezone editing, separate email/security flows,
existing local fictional creation and reviewed private-staging admission paths.
Do not enable public real-family intake, automatically authorize pending requests,
change reviewer/MFA/evidence rules, create child logins, or change bookings.

## Grade contract

- Add nullable integer `grade` to the existing learner profile, bounded1..12.
  Existing records stay NULL; no inferred/backfilled grade or country mapping.
- Grade is optional self-declared school-year metadata, separate from the broad
  education level. Grade8 is saved as8 and displayed “Grade 8”. Keep explicit
  level selection; do not infer Middle School or a curriculum from grade.
- Only guardian-managed, non-College profiles may have a nonnull grade.
  Self-managed/College profiles stay null. Omitted PATCH preserves grade;
  explicitnull clears it. An invalid resulting level/grade pair is rejected.
- Include grade in private local/reviewed DTOs and request-detail views, with no
  expansion of public data or unrelated private access. Reviewed broad level
  remains immutable; authorized guardian may edit grade metadata.
- Preserve original SQL functions/signatures/bodies and old null-grade receipt
  fingerprints. Add uniquely named grade-aware create-local/create-admission/
  update-admitted functions rather than overloads, because existing protection
  validation intentionally requires unique function names. Nonnull grade is
  part of creation fingerprint; same-key changed grade conflicts; retries do not
  restore revoked links or overwrite later profile edits.
- Add migration0034, Drizzle snapshot/journal and exact least-privilege runtime
  grants/protection coverage. Do not modify historical migrations. Existing
  raw-write, actor/session, policy/evidence, transaction and capacity checks remain.

## Parent journey

- `/parent/profile`: server parent-role gate, reuse own-account service/AccountForm;
  show registered email and permitted name/timezone fields, save/refreshed values.
- `/parent/children`: server parent-role/guardian filtering, “My Children”; show
  authorized fictional local children or authorized reviewed children separately
  from bounded own guardian admission request status cards. Pending means saved
  request, not current profile/booking authority. Avoid N+1 detail fetching.
- `/parent/children/new`: “Add Child”; reuse existing form/services with guardian
  mode only, optional Grade selector and separate educationlevel/timezone. Normal
  development saves a fictional local child; private staging creates a pending
  admission for existing review, with honest success/pending wording.
- `/parent/children/[learnerId]`: owned/authorized guardian child only; existing
  edit form/service plus optional grade. Preserve reviewed-level lock and show
  exact saved grade after refresh. Foreign/self profiles are not child records.
- Parent sidebar/dashboard link to these pages. Keep legacy `/account`, `/learners`
  and student/other-role wording/behavior. Common settings/security entries stay.
- Reuse existing React/Tailwind/shadcn workspace tokens, native accessible forms,
  loading/error/empty states, target sizes and mobile navigation. No redesign of
  the accepted auth/navbar/footer surfaces; no images or new dependencies.

## Ownership and implementation order

Backend worker owns schema/input/service/authority, migration/grants, backend
unit/integration fixtures/tests. UI worker owns parent routes/server composition,
form TSX/navigation/dashboard links and frontend/component/E2E tests. Root owns
blueprint/context/decisions/progress, integration and validation; shared changes
must be coordinated. Both workers independently verify proposed choices.

## Separate verification

1. Run focused unit/component tests plus full check and production build.
2. Execute real isolated loopback PostgreSQL tests for grade create/edit/clear,
   invalid values, old/new null compatibility, same-key grade conflict/concurrent
   retry, sibling distinction, rollback/ownership/revocation/raw-write denials,
   reviewed pending/authorization/immutable level and legacy function ACLs.
3. Validate fresh migration and populated0033→0034 upgrade preserves all original
   columns/rows/history/grants; existing grade isnull, no fake backfill.
4. Production-build browser journey with a new synthetic verified parent: own
   profile save/refresh, MyChildren/AddChild Grade8 save/list/edit/refresh, retry
   without duplicate; private pending versus authorized flow; parent-to-parent
   and non-parent denials; desktop/390/320, keyboard, readable states/Axe.
5. Run related historical suites with exact prefix rights; tests must not weaken
   assertions or apply new grants to missing historical objects. No arbitrary
   sleeps, production data or live provider operations.
6. Independent source Review then separate execution evidence, fresh scoped UI
   finish review/documentation and Remember. Record limits honestly.

## Operations and boundaries

Root preview and its Neon development data are preserved during implementation.
Tests use owned loopback databases only. No production/staging/provider migration
or deployment is authorized here. Before any remote development apply, prepare a
concrete reviewed migration/backup/target plan and follow the existing exact-target
operator authorization boundary. No commit/merge/push/cleanup of user branches.

## Documentation

Record approved grade metadata/parent routes in PRD/architecture/UI/build-plan and
concise decision; update progress only from actual Review/Verify results. Preserve
old entries as history and supersede outdated broad-level-only QA limitations.
No launch milestone is closed by this development slice.

Blueprint ready.

## Execution checkpoint —2026-10-17

Local implementation, independent source/finish reviews and executed verification
are complete for the isolated candidate. See the progress tracker and restricted
`report.json` for actual results and retained initial failures. Original checkout
and preview remain unchanged; the exact remote development target has29 applied
and6 pending migrations. Remote rollout is NOT RUN, pending the separate concrete
plan in `docs/operations/parent-step2-rollout.md`. This does not change the original
authorization status or claim hosted/production completion.

## Development rollout completed under subsequent owner instruction

On2026-10-17 the owner approved the concrete development operation and requested
closing older servers in favor of the updated server. Exact six-migration plan
0029–0034 applied after a successful populated backup/owned restore. Canonical
grants,35-entry ledger,90-function protections and original data preservation
passed. Reviewed source is integrated into the original checkout; strict checks
and build PASS. Only updated original3000 runs. See current progress and rollout
record for actual results/limitations. This supersedes the pre-rollout NOT RUN
checkpoint above, without implying Git commit/merge or production deployment.
