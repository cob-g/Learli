# M4/M5 local slice integration

Status: **AUTHORIZED — build-feature delegation**, 2026-10-11.

The dispatched build request authorizes inspecting and committing the three
completed source slices, merging A then B then C into this integration branch,
resolving integration conflicts, combined verification, review and local handoff.
It reserves merging into main as a final checkpoint. No push or deployment.
This is delegated execution authority, not separate human blueprint approval.

## Outcome, baseline and scope

Integration checkout: `/Users/cob/orca/workspaces/learli/m4-m5-integration`, branch
`cob-g/m4-m5-integration`, clean initial HEAD `2803d1f3bf2579cc30f5c332b15482c092a9401c`.
Source branches share that base and contain uncommitted intended changes:

- A `cob-g/m4-1-tutor-availability`: 27 files; M4.1/TUT-04, private weekly editor,
  persisted windows, revision/ownership and the existing M4.2 engine adapter.
- B `cob-g/m4-4-learner-profiles`: 27 files; M4.4/FAM-01/FAM-02 local synthetic
  list/detail/edit only, trusted fixtures and private parent/self ownership.
- C `cob-g/m5-meeting-link-validator`: 6 files; M5.1/MEET-01 pure syntax validator.
  Its private meeting integration draft remains blocked documentation only.

Read AGENTS.md, all eight canonical context files in order and relevant decisions.
The source blueprints define the existing behavior. No terminology clarification,
new product feature or policy decision is needed. AUTH-03, NFR-05/11 and QA-03/04/05/13/19/20
remain applicable. No bookings, real minors, payments, provider calls, meeting
storage/access timing, time-off or public slot display are added.

## Reconciliation and invariants

- Source authority is staging/one coherent commit only after complete intended-file
  and secret review. Preserve ignored configuration, databases, memory and artifacts.
  Record hashes and stop if source files change unexpectedly.
- Preserve A migration 0006 byte-for-byte; regenerate B as 0007 from the combined
  schema and A snapshot. The combined snapshot retains both features and chains to
  A. Never apply this chain to a source database or renumber its applied history.
- Merge additive runtime grants: availability CRUD; learner SELECT and UPDATE only
  display_name, level, timezone, updated_at; no create/claim/ownership/link writes.
- Choose A's closed real pool outage test, which is deterministic on every port
  and cannot contact another cluster. Preserve both 503 assertions.
- Standard Playwright configuration runs all baseline, availability and learner
  cases with explicit dependency ordering and APP_URL portability. Keep fixture
  cleanup and test throttle isolation confined to the integration test database.
  Remove obsolete separate config when standard scripts cover its cases.
- Preserve source verification histories, but reconcile present-tense architecture,
  tracker and local setup instructions to combined actual state.
- No weakening parent/tutor permissions, local gates, validator allowlist or tests.

## Implementation and verification sequence

1. Commit each reviewed source slice; merge A then B then C with auditable merge
   history into this checkout. Resolve migration, grants, test and document overlap.
2. Install pinned dependencies using existing Node 24.20.0/npm 11.19.0 and npm ci.
   Inspect script side effects. Create fresh integration-owned PostgreSQL cluster
   on available 55442, dev HTTP 3003 and browser HTTP 3103, with separate dev/test
   databases. Preserve source clusters 55441/55434 and main 55432.
3. Apply/reapply migrations to both fresh databases, seed only synthetic fixtures
   and learners twice, inspect schema/journal and least-privilege grants.
4. Same-agent read-only Review, then separate Verify: npm run check,
   npm run test:integration, npm run build, npm run test:e2e (all combined cases).
   Expected approximate counts: 373 unit, 58 DB, 32 browser; actual observed counts
   control. Review mobile/desktop/forced-color screenshots, axe/keyboard evidence,
   diff and secret/client bundle scan. Fix scoped failures through Recover, re-review
   and repeat affected checks. No independent reviewer is spawned here.
5. Update exact tracker evidence, migration provenance/source hashes and local
   operations docs; commit final integration repairs only after required checks
   pass. Save ignored memory with actual final HEAD. Leave clean checkout and give
   coordinator a durable report plus runnable, unexecuted merge command.

Architecture-stage verification: **NOT RUN**. Completion requires passing combined
checks and same-agent review, truthful docs and memory; independent coordinator
review and main merge remain subsequent checkpoints. Rollback is leaving main at
its clean base and retaining isolated source/integration branches and local data;
no reset, destructive down migration or external operation is needed.
