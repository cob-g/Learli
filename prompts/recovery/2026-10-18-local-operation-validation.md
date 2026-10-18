# Local operation validation recovery

- Status: AUTHORIZED — build-feature scoped repair
- Mode: Targeted Fix
- Environment: separate owned local-operation fixture, PostgreSQL55434/learli_dev
- Related blueprint: `prompts/features/m8-03-local-operational-workflow.md`

## Observed

The first application of all migrations to the empty isolated fixture refused
with PostgreSQL42704: `booking_workflow_policy_head_source` was not a constraint
on `booking_workflow_policy_head`. The transaction rolled back and migration
ledger remained empty. Operating55432 and the private55433 datasets were not
migrated or changed. This is an authored forward-migration naming defect, not a
reason to reset data or weaken the old constraint.

## Diagnosis and handoff

The forward DDL must use the actual historical PostgreSQL constraint name, which
can differ from the later Drizzle schema label. Reconcile all drop/replace names
against historical SQL and an isolated actual catalog. Preserve old allowed rows
and checks, and retain cumulative snapshot/grant consistency. SQL implementation
worker owns the narrow repair; do not use `IF EXISTS` to silently skip a required
constraint correction.

Separate verification must apply the corrected chain on the empty fixture, run
the actual ordinary auth/domain/security journeys, and validate populated
migration preservation before the operating target is changed. No test or repair
was executed by this diagnosis stage. Integrated checks remain pending.

## Subsequent narrow findings

- Empty-fixture migration then passed. First trusted staff preparation found the
  existing audit action CHECK did not admit the new exact staff-authorization
  action. Preparation rolled back; provider-test accounts remained intact. The
  SQL owner is adding a forward0036 correction, preserving the applied0035 and
  its ledger. No operating data was involved.
- Three existing account presentation tests rendered unavailable because their
  deliberate private-runtime mock exports `getPrivateWorkflow`, while the page
  had switched to a helper importing the other export. Preserve the page's
  original private selector and add the explicit ordinary selector alongside it;
  retain the existing assertions. This is a scoped composition/test-contract
  correction, not a permission or account-query change.

## In-progress type integration

An earlier root nonincremental TypeScript read occurred while policy unions and
optional account DTO fields were still being authored. After those edits settled,
the current TypeScript check passed and58 affected presentation tests passed.
This is limited engineering feedback, not final integrated verification.

## Independent review — revoked learner reviewer

Observed in current source: the admission service reviewer projection retained
the assignment/reviewer/MFA predicates but did not consult the new current local
staff registry. SQL mutation authority already did. Revoking the registry or
removing its admission capability could therefore leave list/detail reads open
through retained assignment rows. This is a targeted privacy correction, not a
need for broad role changes. Delegate the read to the authoritative
`admission_reviewer_allowed` predicate and add isolated PostgreSQL list/detail
denials for revoked staff and removed capability. Preserve the synthetic branch,
assignment/history and existing authorized behavior. Source implementation worker
owns the repair; fresh read-only reviewer will recheck it. Verification remains
separate and pending until executed.

## Standard test database preparation

The first broad integration command started against the preserved standard test
database with35 migration entries; the new identity function was absent. This was
a coordinator setup omission, not evidence of many independent product failures.
The exact owned runner child was interrupted, current reviewed forward migrations
and restricted grants were applied to55432/learli_test, and the suite was restarted.
The operating55432/learli_dev and private55433 data were untouched. Preserve the
interrupted log separately; only the restarted/current run can supply results.

## Local bundler

The default Turbopack build panicked while statically resolving the new private
mail-directory checks through an existing ignored backup's dangling skill link.
The configured deployment-trace exclusions did not prevent this compiler scan.
No private backup or link is deleted to satisfy the compiler. The installed
Next16.4 CLI documents `--webpack` for both dev and build; use that supported
bundler explicitly and verify the normal build/runtime. Record Turbopack's failed
attempt separately. This is a compatibility repair, not a dependency/framework
change or a weakening of private mailbox permissions.

## Broad integration compatibility checks

The first fully prepared standard integration run executed1124 tests:
1106 passed,10 failed and8 were skipped after a hosted-suite setup failure.
Nine failing migration assertions compared the current additive schema with an
older boundary's complete inventory; one also reapplied an old function body
after the current replacement. Preserve every original table/column value and
inherited function identity/ownership/ACL, test historical replay at its actual
historical prefix, then separately check the current exact inventory and grants.
Do not delete or weaken the preservation assertions. The migration worker owns
these test-only boundary corrections; no SQL defect was established by them.

The remaining failure reproduced an actual response-classification regression:
a forbidden local Better Auth identity threw before the legacy email guard and
was mapped to503 because the existing401/403 translation was hosted-only.
Implementation removed that qualifier for provider401/403 only; unknown errors
still fail safely. The original403/no-write integration assertion now passes
(17/17 learner-creation tests); focused unit coverage verifies both denied codes
and unknown-error503. Authorization itself was not broadened.

Hosted tests require an explicitly assigned owned TLS test port. Rerunning with
`LEARLI_STAGING_TEST_PORT=55701` passed8/8 against a disposable loopback TLS
PostgreSQL harness. No remote credentials or external provider delivery was used.
The final full integration rerun remains separate evidence.

## Frozen build resource failure

A subsequent webpack build exhausted Node's default approximately4GB heap during
compilation. The previous webpack build had passed, but it preceded a final
source correction and cannot stand for the current state. The failure was a
reported heap limit, not a product exception. On this16GB development machine,
retry the same frozen source with an explicit8GB heap and retain the failed log.
Do not remove backups, source or validation assertions. Final build success and
runtime health still require observation.

## Fresh visual finish

The independent finish pass found one phone-only readability defect: the
incumbent signup card became transparent at narrow widths, allowing its decorative
navy ribbon to cross password guidance. A scoped opaque Paper card ground at the
existing phone/tablet breakpoint preserves the flat composition and desktop
reference while keeping the decoration behind readable content. Rebuild and
recapture the same empty signup screens without privacy masks; the reviewer must
score this exact fix separately. This does not change auth or form behavior.

## Supported Admin preparation versus account restriction

Independent review identified a concrete owner-operation race: preparation locked
identity but not the joined account-status row. Both actual-connection orderings
were reproduced failing against a newly created, disposable migrated local
database with real provider sessions and MFA. The narrow owner-only repair locks
both rows (`FOR NO KEY UPDATE OF u,a`), sharing the restriction's existing status
serialization. The same unchanged two tests then passed: restriction-first leaves
a suspended non-Admin and refuses preparation; preparation-first leaves an active
Admin and refuses restriction. No SQL function or migration change was required.
Arbitrary owner SQL is outside this supported-operation guarantee.

Fresh read-only source Review now reports plan alignment, system integrity and
unintended-change audit PASS with no open findings. Verification is recorded
separately in the tracker, including the actual final build and browser results.
