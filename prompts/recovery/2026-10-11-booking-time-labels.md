# Learli Recovery — Booking DST labels

- Status: AUTHORIZED — build-feature delegation; targeted repair handoff
- Mode: Targeted Fix; local synthetic booking M4.5–M4.8 / BKG-02
- Baseline: `cob-g/m4-5-booking-core` at `3a055def`, uncommitted feature

## Expected versus observed

`npm test -- --maxWorkers=1` returned exit 1: 377 passed, one booking label test
failed. `Intl.DateTimeFormat.formatRange()` omitted short-offset context from
repeated-hour time labels. The separate zone line included correct GMT offsets,
but endpoint range labels are not guaranteed to retain them through DST changes.

## Root cause and recommendation

Observed CLDR/Intl range collapsing differs from individual endpoint formatting.
Use individual date/time endpoint labels, preserving both UTC offsets and date
changes explicitly. Preserve UTC generation, policy, authorization and all tests;
add a range crossing the repeated-hour transition. No production or data impact.

## Handoff

Implementation may repair the pure formatter and meaningful DST regression under
existing feature authority. Then read-only re-review the changed formatter and
rerun the full isolated unit suite; broader checks remain pending actual time-off.
Recovery executed no tests or application edits. Earlier attempts: none.

## Separate implementation/verification outcome

Targeted formatter repair and transition assertion were implemented outside
Recovery, with focused read-only re-review. `npm test -- --maxWorkers=1` then
passed all 378 tests / 12 files; format and lint passed. This is same-agent staged
verification, not independent QA. Combined booking/time-off acceptance remains
pending; the local label failure is resolved by that separate Verify stage.
