# M4.4 — Local synthetic learner profiles

## Authorization and baseline

**AUTHORIZED — build-feature delegation**, 2026-10-11. The dispatched task requests
M4.4 (FAM-01/FAM-02) in local synthetic development only. This records delegated
execution authority, not separate human approval of this blueprint.

Worktree: `/Users/cob/orca/workspaces/learli/m4-4-learner-profiles`.
Branch: `cob-g/m4-4-learner-profiles`; clean baseline `2803d1f`.
Read AGENTS.md and the eight canonical context files in its required order.
Existing local Better Auth identities, trusted roles, ownership helpers, private
JSON responses and native themed forms are reused. Learner entities do not exist.

## User outcome and scope

An active, verified synthetic parent lists and edits only fixture-authorized
learners. An eligible synthetic college learner manages their own fixture-created
profile without a guardian. Both enter from their existing workspace and can edit
a display name, level (guardian-managed only), and IANA time zone. Learner creation
and relationship provisioning are trusted local fixture operations only; the
browser has no create, claim, link, unlink, role, eligibility or status operation.
This is a complete local profile-management slice, not real onboarding.

FAM-01 and FAM-02 are primary; AUTH-03, BR-16, QA-04 and QA-05 guide permissions.
M4.4 owns this work. Booking, booking history, tutor availability, the time engine,
meeting validation, real eligibility/consent, child login, age questions, guardian
proof, role self-assignment, deletion and external services are excluded.

No terminology clarification is needed. Existing trusted fixture records supply
authority; no inferred legal age or consent policy is introduced.

## Data and authorization

- New learner schema module: private `learner_profiles` with UUID, display name
  (trimmed 1–80 characters), one of four existing levels, IANA timezone, active
  state, optional unique self user ID, timestamps, and explicit local fixture
  provenance. A non-null self user ID requires College Support. No school, DOB,
  address, contact field, upload or learning record.
- `guardian_learner_links`: guardian user/learner pair, authorized/revoked state,
  fixture provenance and timestamps. FKs and composite primary key; learner lookup
  index. Self-owned profiles and guardian-managed profiles are disjoint for this
  slice, enforced by the service and fixture tooling.
- Runtime can SELECT these tables and UPDATE only ordinary profile fields plus
  updated timestamp. It cannot INSERT/DELETE profiles, change self ownership,
  eligibility/state/provenance, or mutate links. Dedicated fixture script uses
  owner credentials and verifies existing `.local/fixtures.json` identities.
- Every service operation authenticates and rechecks active verified account,
  trusted parent/student role, local runtime, profile state and exact active
  relationship in the data query. Admin/tutor roles are not bypasses. Missing,
  malformed and unowned IDs share one safe unavailable result. Updates repeat
  the ownership predicate in SQL rather than trusting a previous read.
- Profile IDs are opaque route keys only; no names/levels in URLs, titles or
  metadata. Static metadata, noindex, dynamic private pages; API no-store and
  same-origin mutations. No profile contents in logs or public queries.

## Implementation sequence and affected files

1. Add `src/lib/db/schema/learners.ts` and one schema index export. Generate and
   inspect `0006_local_learner_profiles`, snapshot and journal. This numbering
   collides with the separate availability branch and must be reconciled by the
   coordinator, without copying its migrations here.
2. Add learner input, service, handler and read/edit API routes; trusted local
   fixture provisioning script. Minimal grants in `scripts/migrate-local.ts`
   require coordination because availability owns independent changes there.
3. Add `/learners` list and `/learners/[learnerId]` editor with empty/unavailable,
   loading and save-error states; minimal existing account/workspace copy/link
   edits. Native controls follow existing theme and time-zone label helper.
4. Add unit validation tests, real PostgreSQL permission/constraint/privilege
   tests, and Playwright responsive/keyboard/axe/privacy/error tests.
5. Update architecture implementation note and factual progress tracker; review,
   verify and save ignored memory through the repository child skills.

## Verification plan (not executed during Architect)

- Install pinned lockfile; inspect scripts first. Use only this worktree's private
  cluster (proposed DB 55434, app 3002, browser 3102), after port checks. Existing
  local setup/Playwright scripts hardcode shared ports, so use ignored private
  adaptations; do not alter or reset another cluster.
- Migrate fresh dev/test databases and rerun migrations; seed synthetic accounts
  then provision learners twice, asserting idempotence and no arbitrary adoption.
- `npm run check`, `npm run test:integration`, `npm run build`, browser script with
  isolated config. Existing browser specs hardcode 3100: use temporary ignored
  adapted copies for full regression, preserving source assertions.
- Parents A/B, college self A/B, admin, tutor, role-less, suspended, unverified,
  anonymous; pending/revoked links, inactive profiles; forged extra fields,
  unknown IDs, malformed request, cross-origin; DB FKs/unique/checks and grants.
- Mobile 390×844, narrow 320×720, desktop 1440×900; keyboard, axe, long labels,
  no overflow, success/error/empty states. Inspect screenshots. Verify private
  cache/noindex, static metadata and no leakage to another account/public pages.
- Check diff, no secret values in client assets, ignored private files. Record
  exact PASS/FAIL/NOT RUN separately from same-agent read-only Review.

## Risks, open decisions and rollback

Real age eligibility, consent, guardian proof, child login and role assignment
remain OPEN and are unnecessary for this fixture-only slice. Production runtime
is gated. No deployment/commit/push/merge or data deletion is authorized. A local
rollback is stop using the new routes/fixtures and preserve records; no down
migration or destructive reset. Integration must reconcile migration numbering
and the small shared grants/docs edits. Verification status: NOT RUN.
