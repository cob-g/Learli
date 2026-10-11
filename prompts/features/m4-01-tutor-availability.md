# M4.1 — Tutor weekly availability

Status: **AUTHORIZED — build-feature delegation**

Authority: repository owner requested `ok $build-feature m4.1` on 2026-10-11.
This authorizes this workflow, not separate human approval of this blueprint.
Baseline: clean `2803d1f`, branch `cob-g/m4-1-tutor-availability`, worktree
`/Users/cob/orca/workspaces/learli/m4-1-tutor-availability`.
Another isolated session owns M5 meeting-link validation; do not edit its checkout.

## Outcome and mapping

An active verified tutor with an existing profile can view and replace their own
weekly hours at `/tutor/availability`, including empty schedules and explicit
overnight windows. PRD TUT-04; build plan M4.1. Reuse the M4.2 pure engine.
No terminology clarification or material business decision is needed for this slice.

Read AGENTS.md and the eight canonical context files in their required order.
Existing evidence: tutor profile/role guards, JSON mutation handler, native form
styles, local PostgreSQL and time engine exist. Availability storage/editor do not.

## Scope and decisions

- Add `tutor_availability` with tutor FK, ISO weekday (1–7), integer local start
  and end minutes, UUID, bounds checks, unique window and owner lookup index.
  End can exceed 1440 for explicit overnight windows, at most 24 hours long.
  Effective dates, inactive rows and exceptions are deferred to their own work.
- Keep `tutor_profiles.timezone` the single teaching-zone source; add a nonnegative
  availability revision. Atomic replacement locks that profile and compares the
  revision, then replaces windows, changes zone and increments revision together.
  Reject overlapping/duplicate windows, including Sunday→Monday; adjacent is valid.
  Limit to 42 windows as an input/CPU guard, not lesson or booking policy.
- The profile editor can still set the initial zone, but changing it while weekly
  windows exist must go through availability. Profile zone changes increment the
  same revision. Existing edits in the same zone remain unaffected.
- Authorize each read/write through the session and trusted tutor role, exact owner
  and active verified account. Suspended tutor profiles cannot edit availability.
  Pending/rejected profiles may prepare hours without becoming publicly eligible.
  No admin override or client-selected owner. Strict input rejects extra fields.
- Private GET/PUT boundary, same-origin writes, bounded JSON, safe errors and no-store.
  Use a consistent single-query snapshot for zone, revision and rows.
- Seven day rows, native Start time/End time selects, explicit next-day control,
  add/remove buttons, zone label, one Save availability. Preserve input on failure;
  focus invalid fields; success/error/pending/empty states. Minute precision is
  independent of lesson duration or slot-start step. Reuse native controls; no
  generated shadcn primitive changes. Link from tutor workspace/profile.
- Expose a guarded service adapter from stored windows to `expandWeeklyWindows`;
  verify persistence-to-UTC integration with DST and overnight fixtures. Do not
  generate bookable slots without the future policy inputs and active bookings.
- Add isolated-worktree local database/app port configuration where needed, keeping
  existing defaults. New cluster and synthetic dev/test databases in this worktree;
  no use/reset of the main checkout's databases. No new packages.

## Exclusions and invariants

No bookings, public availability, learner/guardian records, time-off exceptions,
payments, notifications, meeting links or provider integrations. Availability is
not a reservation or evidence of tutor approval. There are no booking records to
move/cancel; future booking integration must preserve bookings and subtract busy
intervals. No consent, duration, lead-time, holds, cancellation or launch policy.
No commit, push, merge, hosted services or deployment authorized.

## Implementation sequence and affected areas

1. Schema and new forward Drizzle migration; migration runtime grants. Review SQL
   before applying to the new isolated databases. Preserve historical migrations.
2. Proposed `src/features/availability/{input,service,handler}.ts`; private API and
   page at `/api/tutor/availability` and `/tutor/availability`.
3. Proposed availability form; minimal profile/service/navigation changes for zone
   consistency. Stale revisions return 409 with reload guidance, retaining edits.
4. Unit, PostgreSQL integration and browser tests. Test helper/config port wiring
   only as required for isolation. Update architecture, README and tracker.

## Verification plan — NOT RUN at architecture stage

- `npm run check`, `npm run test:integration`, `npm run build`, `npm run test:e2e`.
- Unit: malformed ranges, unknown fields, invalid zone, bounds, overlaps, adjacency,
  overnight/week wrap, empty schedule and limits.
- Real PostgreSQL: migration/grants/check/FK constraints, own read/write, other roles,
  anonymous/unverified/suspended denial, forged owner, stale/concurrent replacement,
  clear schedule, atomic rollback, profile-zone guard and revision interaction.
  Stored windows expand correctly across DST and midnight. Booking concurrency is
  not applicable: no booking mutations exist in this slice.
- Browser: add/edit/remove/save/reload, empty state, zone change, invalid ranges,
  stale/error/network/pending states, ownership rejection, keyboard focus, axe and
  overflow at 320/390/768/1024/1440, 200% equivalent reflow, reduced motion/forced
  colors as applicable. Capture and inspect relevant screenshots.
- Same-agent read-only Review precedes separate Verify; disclose that it is not
  independent. Repair confirmed defects via Recover, then re-review/reverify.
- Operational: local fresh migration, no production. Additive schema rollback is
  code rollback leaving unused tables/column; never destructively reset user data.

## Documentation and handoff

Update architecture §9.4/§11 for implemented model and time-zone semantics;
README for isolated ports. Tracker records only observed M4.1 results, preserves
M4.2/booking integration limits. Save ignored, untracked `memory.md` through Remember.
Final evidence includes commands/results, review recommendation, changed scope,
remaining policy/integration gates. No separate review report required.
