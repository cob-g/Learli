# Staging migration verification recovery

Authority: AUTHORIZED — build-feature delegation; local task_ceba478450a4/ctx_3a11e1a1d92f. Baseline0d7f2dd, own checkout only.

## R1 — installed Drizzle typed session incompatibility

Mode: targeted technical fix. Observed initial tsc exit2: PgDialect.migrate accepts a default PgSession whose schema defaults conflict with drizzle(client) inferred ExtractTablesWithRelations<Record<string,never>>. No cast/any bypass permitted by root msg_227b99940d2e.
Recommendation: try the explicit supported empty-schema generic/configuration, preserving the captured SQL and same client; if still incompatible, use supported node-postgres migrate with a mode-private immutable captured SQL/journal snapshot instead of internal session access. No dependency or SQL edits. Rerun typecheck then full Review and actual PG fresh/upgrade/no-op/failure tests.
Original evidence .local/staging-database-wave/typecheck-initial.log preserved. Recover executed no repair or verification. No provider or data incident.

## R2 — same-agent read-only Review receipt findings

Observed confirmed Important findings in runner applyPlan: unlock error was categorized cleanup_failed while cleanup field remained pass; failed grant COMMIT followed by successful ROLLBACK could incorrectly claim rolled_back when server commit outcome was unknown. Read-only Review recommendation CHANGES REQUIRED; no tests executed by Review.
Targeted recommendation: mark cleanup failed and override PASS on unlock errors; set an explicit commit-attempt flag so grant errors after COMMIT begins retain unknown. Preserve prior migration outcome, close both connections and add injected real-PG receipt regressions. Scoped authority inherited from build-feature request. Recover performed no repair or verification.
R1 separate implementation corrected to drizzle(client,{schema:{}}) typed session and tsc-2 passed, without casts or migration edits.

Root checkpoint msg_a1e8204e006c adds trigger condition/column-list/argument/schema equivalence: require absent tgqual/empty tgattr/zero arguments/public exact function/ordinary nondeferrable trigger. Add WHEN(false) negative. Root msg_c9bbfd338ae5 explicitly allocates strict LEARLI_STAGING_TEST_PORT override for test-only disposable harness; production gate unchanged.

## R3 — first full check test-type errors

Observed check-1 exit2 after format/lint PASS: tests integration COMMIT injection used last query overload Parameters returning void, so .then was untyped; unit it.each spread array rows instead of supplying a string[] row. Targeted harness fix: invoke explicit string COMMIT Promise overload in its already-matched branch, wrap each argument vector as {args}. Preserve every assertion and failure scenario; re-review then check and PG harness. No runtime changes proposed. Original log retained. Recover executes no tests/repairs.

## R4 — owned disposable PG Unix socket path

Observed pg-focused-1 exit1,20 skipped: initdb succeeded, pg_ctl failed because macOS maximum Unix socket pathname103 bytes was exceeded by owned private wave/UUID directory. Private server log confirms fatal socket creation failure and database shutdown; no test/assertion/application failure.
Targeted harness fix: disable Unix-domain listeners with unix_socket_directories empty; retain loopback127.0.0.1/assigned port, random fresh owned cluster and private credentials. Mark startup attempted before pg_ctl so afterAll inspects exact owned PG status and stops any proven running residual even on start error. No dependency/config/production guard changes or retry of the failed cluster. Fresh focused run required; prior808check remains test-source-stale until rerun. Recover only diagnosed; original logs retained.

## R5 — all-table preservation harness name[] decoding

Observed expanded pg-focused-3 exit1:22/23 pass, upgrade projection helper fails names.some because PostgreSQL array_agg(pg_attribute.attname) is name[] and installed pg does not parse that OID as a JS array. No migration/grant/runtime defect; original20-case focused pass remains historical.
Targeted query fix: cast attname to text before array_agg, yielding supported text[]. Keep all32 original-column projections and exact SHA256 equality assertion, rerun focused PG then fullcheck/full integration/build. All failed clusters stopped and data preserved. Recover diagnoses only, no verification or repair.

## R6 — inherited booking-read DST fixture pollution (root-authorized scope)

Observed full integration-1 exit1:412/413 pass in26files, own23 allpass. Sanitized underlying cause is bookings_tutor_no_overlap at unchanged booking-read.test.ts:660. Attempted synthetic Nov1 interval04:33:07.046Z–05:33:07.046Z overlaps earlier fixed DST fixture05:30Z–06:30Z on the same fixture tutor. That earlier fixture has elapsed TTL but persisted demo_reserved and participant reads correctly do not materialize expiry.
Root msg_56ce42bbfeab explicitly expands ownership only to tests/integration/booking-read.test.ts for confirmed fixture-time/pollution correction. A historical full407pass started12:23:22 Asia/Manila (04:23Z), observed in A private integration-full-1.log; its corresponding04:xx–05:xx generated interval finished before05:30Z. This explains differing results without a source/application change.
Recommendation: retain fixed DST instants and all timezone/read assertions; wrap that exact owned fixture case in finally, restore its viewer-zone fixture and remove only its queued notice/events/booking rows transactionally with owner credentials. This isolates its retained demo_reserved row from later tests rather than shifting any product timing/date constants or changing expiry behavior. Re-review exact scope, rerun full29-case affected file; root supplies current combined broad acceptance. No runtime/schema/grant/assertion change. Recover only diagnoses; original fullfailure evidence preserved privately.

Root msg_f2887788a6e9 confirms exact fixture diagnosis and explicitly accepts a helper loop that consumes fixtureIndex while skipping the fixed DST interval. Separate implementation selects this smaller interval registry/loop instead of cleanup: preserve every historical fixture row, unchanged DST instants/assertions and application behavior. No database fixture deletion or reset added. Counter advances for each skipped day, preventing duplicate subsequent ordinary starts.

## R7 — root fixture review requires complete per-case tutor isolation

Observed separate full integration-2 PASS413/413 and affected booking-read PASS29/29 on today's date. Root read-only msg_db0599b6cc41 / msg_75aee87fa17b identifies remaining test independence gap: the earlier overview uses explicit +7-day intervals and can collide with fixed DST on other dates before the DST case executes. This is a confirmed harness integrity finding, not application defect or failed current run.
Targeted recommendation: give the fixed DST case its own synthetic verified tutor account and approved fixture profile through existing real test provisioning; extend storedBooking only with an optional profile override. Use that assigned tutor's real headers for the unchanged tutor-local assertions and add original-tutor denial. Restore the baseline ordinary day-counter helper; fixed DST instants and all assertions remain. Source changes invalidate affected test evidence only; root asks no unrelated migration reruns. Re-review then29-case affected file/staticcheck, preserve full413pass as unaffected historical coverage plus final affected recheck. No app/schema/permission/migration or provider change.
