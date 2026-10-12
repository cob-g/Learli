# Local completion integration recovery

Authority: AUTHORIZED — build-feature delegation. Scope: root integration only.

## R1 — staging compatibility checkpoint

Actual scoped PostgreSQL run selected two fresh/forward cases; both failed and
38 unselected cases were skipped by the explicit test-name filter. The forward
case still expected one pending migration after baseline0015, but the current
A/C candidate has19 entries and therefore three pending; preserve the exact
baseline prefix and row-preservation assertions, adjust the expected delta.
Fresh apply reports FAIL but its category/stage was not included in assertion
output. No runtime diagnosis is confirmed yet. The runner receipt contains safe
category/stage enums; add those to the assertion message and rerun these two
cases in the owned disposable cluster on55719 to identify the actual failure.
No original historical SQL, database data or protection assertion is waived.
Recover performed read-only inspection; diagnostic test edits and rerun belong
to subsequent root Implementation/Verification stages.

R1 diagnostic run2: both selected cases still failed; fresh receipt explicitly
reports schema_unrecognized/migrate. Read-only inspection found runner.ts table
inventory recognizes only CREATE TABLE "quoted_name", while reviewed new A/C SQL
uses bare/qualified public names. Targeted fix: recognize these explicit forms,
reject unsupported/duplicate declarations, preserve exact inventory equality and
namespace/protection checks. No snapshot or database reset is needed. Added
focused inventory boundary cases; subsequent Verification owns the rerun.

R1 run3 passed schema/protection inspection and now fails grant_mismatch/grants.
Read-only SQL/grant inventory explains a stale permitted EXECUTE expectation:
new0017 explicitly revokes PUBLIC on preserve_demo_booking, and runtime-grants
never grants direct execution back. Trigger execution does not require a direct
caller EXECUTE grant. The verifier still permits that historical PUBLIC-derived
right. Targeted correction removes only this obsolete permitted signature;
no runtime privilege is added and other exact function/column checks remain.

R1 verification after targeted repairs: fresh/current nineteen-migration apply
and populated0015 upgrade both PASS, followed by the complete staging verifier
file40/40 PASS on A-v2 plus C accepted SQL. Unit parser/protection suite26/26 PASS.
These are partial assembly checkpoints; later D/E/B source still requires final
combined verification. All three earlier failing command logs are retained.

## Combined check1: generated metadata formatting

The first combined check stopped at Prettier: the three newly generated0017–0019 snapshots and this recovery handoff require formatting. No lint/type/unit stage ran. Diagnosis: offline Drizzle formatting differs from repository Prettier conventions. Scoped recovery recommendation: format only these four files; JSON content and SQL remain identical, then read-only review the formatting diff and rerun check. Preserve the exact consumer bundle as its recorded source baseline; its unformatted0017 snapshot is a known non-runtime packaging issue, not permission to rewrite historical snapshots.

## Combined browser1: native detail navigation observation

Eight policy/support cases passed. New combined journey created a learner, returned to its selected slot and saved a reservation, then read page.url immediately after the native details-link click. PostgreSQL rejected literal `demo` as UUID, proving the test still observed /bookings/demo. No runtime navigation defect established. Scoped repair adds awaited canonical guardian detail URL before parsing identity; assertions and application source stay unchanged. Distinct source inspection confirms native link semantics; rerun this one combined case against the unchanged successful build, retaining original8 passes and failure artifacts.

## Restore compatibility recovery: owned permissions and distinct logical overlap fixture

Restore1 refused root-created .local0755 before DB work; confirmed same-user real directory and tightened only it to0700. Restore2 reached exact restored catalog equality and canonical schema equality but failed an overlap probe with wrong SQLSTATE. Inspection found the old whole-row clone retained its original logical_booking_id while changing id, now violating bookings_revision_valid before it could exercise overlap. A rollback-only actual PG probe confirmed old clone23514/bookings_revision_valid and independent-root clone23P01/bookings_tutor_no_overlap. Repair clears logical/predecessor identity and sets revision0 in this test fixture, letting the existing insert trigger establish a distinct logical root; retain expected23P01 and every restore comparison/guard. Update expected table count33→39 (38public plus migration ledger), migrations already20. No schema, permission or business invariant changed. Distinct read-only review confirms probe now targets two different bookings; separate restore rerun uses a new UUID target on explicit55919 and preserves all old artifacts.

## Final restore4: negative email fixture contaminates downstream drill

Root fullPG2 passed575/575, then restore4 failed before creating its expected failure artifact. Read-only diagnosis confirms exactly one non-.test user on the owned55819 learli_test database, named Synthetic notice account. Existing booking-notifications.test.ts intentionally changes its creator to synthetic-UUID@example.com to prove suppression, but never restores its original notice-ID@learli.test address; the new lifecycle notice cases have the same missing cleanup. The restore tool correctly rejects non-synthetic-looking users before backup directory creation. This is test isolation, not a weakened restore requirement or application failure.

Targeted recovery: register the exact prior synthetic address before each intentional negative email mutation and restore only those exact owned identities in afterEach/finally, retaining all suppression/absent-file assertions. Restore the one already observed baseline-owned notice fixture only when its UUID/name/generated email pattern matches exactly, preserving a private receipt; no delete, reset, broader rewrite or restore guard change. Re-review the test delta, rerun both affected notice suites and then the full restore proof. Application/build/UI bytes remain unchanged, so prior full575 and build evidence remain applicable outside this cleanup delta. Current source check must include the changed tests. AUTHORIZED — build-feature delegation, synthetic local test repair only.
