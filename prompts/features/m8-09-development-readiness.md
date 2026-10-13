# Development readiness and dependency maintenance

Date: 2026-10-13. Status: **AUTHORIZED — build-feature delegation**.

Authority: the owner requested the next wave: dependency maintenance, complete
Neon development acceptance, and prepare main for daily development. This is
execution authority for this bounded work, not separate human blueprint review.

## Outcome and scope

Prepare the primary checkout for repeatable local development against the existing
isolated Neon development branch, with automated tests remaining on owned loopback
PostgreSQL. Demonstrate successful synthetic family/tutor discovery and booking,
including retries, conflicts, changes and ownership denials, without enabling real
policies, public intake, production writes, external messages or payments.

Primary build-plan owner: M8.9; related M1.6–7, M2.1–3, M4.6–10 and M8.3–4/8.
PRD: AUTH-01–04, FAM-01–02 (synthetic scope), MATCH-02–03, BKG-01–06,
MEET-01–02. No clarification or business decision is needed for this local slice.

Baseline: main a8a92c1 in /Users/cob/learli, synchronized with origin. Preserve
the pre-existing next-env.d.ts change and unrelated learli-brand-kit.zip. Existing
private environment files and local data must be backed up before configuration
or migration. All prior worktrees have been removed. Main's preview is stopped;
its owned PostgreSQL cluster remains available on 55432.

## Plan and invariants

1. Retain baseline hashes, audit evidence and private configuration backups. Use
   a scoped review branch in the primary checkout; no commit, merge or push is
   implied. One coordinator owns the work and shared environment.
2. Fix the vulnerable esbuild transitive chain with a narrowly scoped, pinned
   npm override. Keep direct framework/auth/database versions stable unless
   observed compatibility requires a scoped change. No force audit downgrade,
   advisory suppression, edits to installed vendor code or speculative fork.
   The published braces advisory has no fixed release: document actual exposure
   and remaining findings rather than claim a clean audit.
3. Install from the updated lockfile. Verify lint/type/unit/build and offline
   Drizzle/auth generation compatibility; preserve historical migration bytes.
4. Back up and deliberately migrate the existing owned local test database through
   the committed migration chain with restricted runtime grants. Preserve existing
   rows and the former local development database. Inspect target before writes.
5. Recover only the archived development configuration needed for this task,
   verify its archive hashes, rebind paths to this checkout, preserve secret file
   permissions, and configure local auth with Neon development runtime credentials.
   No migration credentials in application environment/runtime packets. Test
   environment stays loopback. Keep production config unselected and untouched.
6. Prepare a bounded opt-in development acceptance runner. Pin the known project,
   development branch and endpoint; validate target, native TLS and database roles
   before fixture writes. Use uniquely owned synthetic identities, explicit role/
   guardian/tutor fixtures and the actual application HTTP/browser paths. Record
   fixture ownership privately and retire owned public availability after checks.
   Do not run the general destructive/resetting integration suite against Neon.
7. Start the loopback app and verify synthetic signup/capture/verification,
   authorized learner/tutor flows, positive reservation, idempotency, concurrency,
   reschedule/cancel history and private meeting access/foreign denials. Keep real
   workflow factories disabled; outcomes are demo states, never real confirmations.
8. Review the complete diff, execute verification separately, update the tracker
   and operating guide, then save the local memory handoff with remaining limits.

## Verification and recovery

Planned, NOT RUN at blueprint creation: npm audit before/after (including runtime
scope), clean lockfile install, npm run check and build, offline Drizzle generation,
relevant owned PostgreSQL tests, and opt-in actual Neon development acceptance with
browser phone/desktop reads and server authority/retry/concurrency checks. Confirm
the running preview and test isolation, private artifact exclusion and preservation
of unrelated files. Serialize shared-database/browser/build work.

Review is same-agent read-only and separate from Verify; do not claim independent
review. Failures enter Recover, preserve evidence, repair within scope, re-review
and rerun affected checks. Existing configuration backups support rollback; no
destructive reset or production restore is authorized. No schema change is planned.

## Documentation and remaining gates

Update context/progress-tracker.md, context/build-plan.md and an operations guide
with exact results and dependency limits. Update architecture only if a technical
boundary actually changes. Existing unfinished Firefox/WebKit coverage outside
the selected acceptance scope, real-user auth/policies, Railway, live Resend and
payments remain separate work. No whole-milestone or public launch claim.

## Delegation and reviewed supporting work

The owner subsequently explicitly requested spawned agents. Two GPT-6.1 SOL
High-effort workers used separate review worktrees/branches: dependency review
with a later, separate 17-check compatibility verification stage; and development
setup/acceptance review with a scoped README/local-guide correction. The
coordinator retained sole ownership of primary configuration, migrations, Neon
fixtures and shared checks. No worker ran a competing database/browser suite.

The documentation correction adds current-primary versus fresh-loopback guidance
to README.md and docs/operations/local-development.md. It changes no product
boundary. Acceptance evidence is aggregate: 43 successful core assertions from a
retained failed run, followed by a successful 24-assertion targeted follow-up with
overlap. It is not 67 unique tests or one uninterrupted successful run. Related PRD
IDs do not imply complete authentication, matching or real-policy acceptance.
