# Specialized-subject display-name maintenance

Status: AUTHORIZED — build-feature delegation, 2026-10-12. Authority is the
actual supervised task_2b4d3ee1c279 / ctx_1f3dcb62a632 build request and the
coordinator's read-only `m3-05-next-three-feature-wave.md`; no separate human
blueprint approval is claimed. Same agent performs sequential stages; no subagents.

## Outcome and baseline

PRD ADM-02, TUT-03, MATCH-02; build-plan M3.1 / M5.6. An active verified admin
can correct only a specialized subject's display name at `/admin/subjects`.
Clean branch `cob-g/m5-specialized-subject-editing`, baseline
`b6cf237554b3d46e1e4c58ce10e1ef3ebafe10c0`, owned checkout
`/Users/cob/orca/workspaces/learli/m5-specialized-subject-editing`.
AGENTS and eight canonical context files govern this plan. Existing code offers
create/activation only, lower(name) uniqueness, stable UUID/slug and FK references.
No terminology or material business decision is needed.

## Decisions and invariants

- Reuse exact existing trimmed 2–60-character Unicode letter/number name rules
  and punctuation allowlist for create and rename; reject unknown request fields.
- Add a monotonic name revision to avoid timestamp precision and ABA ambiguity.
  A DB trigger advances it only for an actual name change, prohibits rename of
  non-specialized launch subjects, and preserves ID/slug/category. Activation
  does not advance the name revision. Migration0016 also adds subject.renamed
  to the existing audit allowlist. Historical0000–0015 stay byte-identical.
- Rename obtains a subject row lock under READ COMMITTED, then rechecks current
  session expiry, verified user, active access and trusted admin role on the
  transaction connection. Current name equality returns a no-op even for an
  identical retry with the old revision; differing stale edits return409.
- Unique lower(name) enforcement handles simultaneous duplicates. Name update
  and minimal actor/subject/action/time audit share one transaction. No content
  audit, booking update or historical snapshot rewrite.
- Narrow runtime subject UPDATE grants to name/is_active/updated_at; revision is
  DB-owned. Preserve existing INSERT/SELECT and all tutor grants.
- IDs, slug, category, activation, tutor offerings, bookings and all stored
  historical values remain unchanged. Discovery/matching services stay untouched.

## Scope and implementation

1. Extract client-safe subject name and rename validation; keep existing exports
   compatible. Add schema revision/audit action and reviewed forward0016 metadata.
2. Add rename service, handler, PATCH `/api/admin/subjects/[subjectId]/name`.
   Same-origin/size/method protections and minimal private no-store responses
   follow existing mutation boundary. Denied/not-found/malformed/duplicate/stale
   and unavailable responses are safe.
3. Add inline specialized edit form with explicit label/help, retained input,
   first-invalid focus, status/error feedback, saving guard and reload conflict
   recovery. Mutation requires hydration; native POST fallback carries no input
   in URL and shows enable-JavaScript guidance. Keep existing activate/deactivate.
4. Author unit/component and owned real-PG/browser tests, update only scoped
   architecture/PRD/build-plan notes and progress evidence.

Owned paths: features/subjects; admin subjects page/name API; strictly necessary
schema/migration/grants; own tests/config/blueprint/docs. No public directory,
matching, auth/account edits or peer imports. Coordinator follow-up
`msg_c398f0ec9df5` authorizes the narrowly justified0016 revision/trigger/grant
design and an additive project in the existing Playwright configuration so the
new browser cases participate in default discovery; root reconciles integration.

## Separate Review and Verification plan

Review reads complete tracked/untracked diff against this blueprint; no tests
or fixes during Review. Verify runs pinned npm ci, owned local setup
DB55493/dev3053/test3153 with PostgreSQL17, npm run check, npm run build,
full real PostgreSQL suite and appropriate actual Chromium suite. Meaningful
unit/component cases cover normalized strict input, fixed fields, pending,
retained input, error focus, conflict recovery and safe no-JS markup.
PG covers unauthorized/unverified/suspended/revoked/session expiry (including
after row-lock wait), core denial, malformed/duplicate/stale/ABA/concurrent
rename, identical retry dedup, audit rollback, activate/rename races and unchanged
offerings/bookings/events/snapshots. Existing listEligibleTutors/resolveMatch
must read renamed labels with unchanged eligibility and slug references.
Fresh migration and populated0015 upgrade preserve original values and grants.
Browser covers real admin edit and discovery/matching labels, same-tab/two-tab
stale recovery, pending/network/duplicate/validation; keyboard/axe/reflow at
320/390/768/1024/1440 plus forced colors/reduced motion; native no-JS safe reads
and disabled mutation. Captures contain synthetic public data only.

Verification status at blueprint creation: NOT RUN. Executed local evidence now
resides in `.local/next-wave/report.md`, distinct from the same-agent read-only
Review. Current check628, real-PG354, build, fresh/populated migration and all106
unique browser cases passed across full/scoped recovery. Every changed
nonignored path and SHA256 with baseline goes to manifest.json; Remember saves
ignored memory. Failed attempts and Recover history remain. Unchanged exact-state
passes are reused; no independent or production signoff is claimed.

## Limits and handoff

Local synthetic scope only; inherited13 advisories retained. No real identities,
external mail/provider visits, payments, consent/safeguarding change, deletion,
taxonomy expansion, commit/merge/push/deploy, main/peer database or cleanup.
Rollback is a source revert before integration; retain additive schema/data, no
destructive reset. Coordinator owns frozen-source integration and independent
review; all launch gates and whole-milestone checkboxes remain open.
