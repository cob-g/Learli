# M3.2 / M3.5 — Teaching languages and directory filtering

Status: **AUTHORIZED — build-feature delegation**, 2026-10-11.
Authority: dispatched full build workflow for tutor-declared teaching languages
and directory filtering (TUT-02, PUB-03), under the user's five-worktree request.
This records execution authority, not separate human blueprint approval.

## Baseline and outcome

Repository: `/Users/cob/orca/workspaces/learli/m3-5-teaching-languages`.
Clean branch `cob-g/m3-5-teaching-languages`, HEAD
`3a055deff54149be48a91b44237d0e28b26f3405`.
The baseline has owner-scoped profile PUT, locked transactional profile saves,
shared public eligibility, subject/level filters, pagination and native forms.
It has no teaching-language storage, editor or filter.

Tutors may select optional languages on their own editor; eligible public profiles
and tutor rows display the stored declarations. Visitors can filter by one stored
language together with subject and level. Missing declarations remain eligible and
display a truthful missing-language state. No translation or localization platform.

## Decisions and invariants

- Coordinator reply to the catalogue proposal authorizes these initial codes:
  ar Arabic, ceb Cebuano, zh Chinese, en English, fil Filipino, fr French,
  de German, hi Hindi, ja Japanese, ko Korean, pt Portuguese, es Spanish.
- This is a coordinator-delegated in-scope product decision. A bounded vocabulary
  prevents duplicate free text and can extend through a forward migration.
  Chinese is the broad declaration label; no dialect or fluency is implied.
- Languages are tutor declarations, with no inferred coverage or proficiency
  verification. Optional for both old and new profiles; [] clears, omitted input
  preserves existing declarations for backward compatibility.
- Public eligibility remains approved profile + active verified account + active
  offered subject. Language filtering never expands that set. Subject and level
  must continue matching inside the same offering.
- Existing ownership, review transitions, audit and tutor-profile row lock remain.
  No client owner/status fields, no admin bypass, no schedule/auth changes.
- Local synthetic .test only: no cloud, real users, mail delivery, payments,
  production, commits, push, merge, reset or other checkout writes.

## Data and contract

One normalized `tutor_teaching_languages` relation: tutor UUID FK cascading to
`tutor_profiles`, language code PostgreSQL enum, composite primary key. The enum
and labels originate in a client-safe feature module. No existing rows backfilled
with invented languages. Runtime grants only SELECT/INSERT/DELETE on this relation.
Generate the next migration from the actual baseline; report collision potential
to coordinator for later integration.

Profile service read returns `teachingLanguages: TeachingLanguageCode[]` and PUT
accepts an optional unique bounded array of known codes. Existing API has PUT only;
no new GET route is needed. PublicTutor always returns a code array with labels
resolved through the same vocabulary. Public query includes declarations in one
statement to avoid partially observed relation replacement.
Directory `language` is one validated code. Invalid/repeated values do not become
SQL or unsafe links; valid selections without current inventory yield no results.
Filter options contain only actually declared languages on eligible tutors, plus
an active known selection when needed to let visitors change it. Removal and
pagination retain other filters and reset pagination when a filter changes.

## Ownership and steps

1. Add catalogue/schema/forward migration/minimal schema export and local grant.
2. Extend tutor input and existing transactional service; show own/admin summaries.
3. Add editor checkboxes and explicit declaration/missing-state copy; use existing
   tokens/native controls, keyboard focus and accessible errors.
4. Extend public DTO, native directory filter, labels and safe URL construction;
   preserve home finder and matching behavior (no new matching question).
5. Add dedicated unit, real PostgreSQL and browser tests; minimal baseline fixture
   updates only where the public DTO shape requires them.
6. Same-agent read-only Review, separate Verification, scoped Recover if needed,
   tracker/context update and ignored memory handoff.

Files: `src/features/tutors/*` relevant modules, public tutor routes and own editor
route; proposed `src/lib/db/schema/tutor-languages.ts`; schema index and one grant
line; dedicated test files and browser config; migration metadata; architecture,
PRD language note, decision record and this blueprint. No broad auth/CSS edits.

## Verification plan

NOT RUN — architecture checkpoint.
Use installed pinned dependencies and existing scripts. Isolated PostgreSQL 55453,
dev 3013 and browser 3113; check availability before setup. Run npm ci, local setup,
migration reruns, npm run check, full integration, production build, full baseline
browser suite with --workers=1 and dedicated language browser checks.

Units: catalogue labels, validation, duplicate/unknown/malicious/oversized input,
same-offering subject+level with language, missing declaration, search URL behavior.
PostgreSQL: owner save/read/clear/omitted preserve, pending/suspended and account
status exclusions, anonymous/unverified/role-less/forged-owner/origin denied,
FK/enum/uniqueness/grants, rollback and concurrent whole-profile language edits.
Browser: editor persistence/clear/errors/network failure, truthful public missing
language, combined filters/removal/pagination/zero results, no unsafe values,
pending/suspended exclusion. Axe/keyboard/no overflow at 320/390/768/1024/1440,
reduced motion/forced colors and 640px reflow; inspect screenshots at phone/desktop.

## Risks, rollback and docs

New relation is additive and optional. Existing deployments require migration
before the new read; rollback application then retain additive storage rather than
deleting declarations. Future catalogue extension needs module plus enum migration.
Small catalog in-memory filtering remains the baseline scaling limitation.
Update architecture's no-language note, PRD optional declaration behavior and
tracker with this branch's actual evidence only. Real-user screening, guardian and
commercial launch gates remain unresolved and do not block this local slice.
