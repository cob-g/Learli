# Learli Recovery — Combined booking verification

Authority: AUTHORIZED — build-feature delegation; local-only targeted fixes.
Baseline `cob-g/m4-5-booking-core` at `3a055def`, own uncommitted feature.

## Generated metadata formatting

Observed: initial combined format/lint/typecheck/unit sequence stopped at format,
reporting only generated `drizzle/meta/_journal.json` and `0009_snapshot.json`.
Root cause: Drizzle's JSON indentation differs from repository Prettier defaults.
Recommend format those two files only, preserve parsed JSON and applied SQL bytes,
read-only re-review metadata, then restart required checks. No product/data change
or additional decision is needed. Recovery executes no formatter or tests.

## Raw database clock decoding

Observed: first full PostgreSQL suite failed 30 cases / passed 61. Booking reads
raised `value.toISOString is not a function`; the combined time-off guard returned
safe 503. Existing baseline suites passed. Build succeeded independently but is
stale for the required repair. Installed Drizzle PostgreSQL sessions override raw
timestamp parsers to strings: an `execute<{now: Date}>` assertion does not decode
the result. Both new callers supplied a string to timestamp comparisons.

Targeted recommendation: query clock as epoch milliseconds and explicitly create
a Date at both callers, preserving clock-after-lock, constraints, auth and tests.
Re-review callers, rerun full PostgreSQL, lint/typecheck/units/build and browser.
No schema/policy change or destructive operation; first root-cause attempt.
Recovery executes no tests or source edits.

## Separate staged outcome

Implementation repaired only metadata formatting and both clock decoders.
Read-only focused re-review found no new findings. Separate Verify rerun passed
424 units, 91 PostgreSQL cases, format/lint/typecheck, build, 35 baseline/booking
and 3 time-off browser cases. Migration SQL is unchanged; no independent QA or
production clearance is implied. Both diagnosed failures are resolved locally.
