# Five-feature local premerge evidence

Authority: **AUTHORIZED — build-feature delegation**, actual premerge request2026-10-11. Blueprint `prompts/features/m4-05-five-feature-premerge-integration.md`; review baseline `3a055deff54149be48a91b44237d0e28b26f3405`.

## Authorized merge and cleanup — 2026-10-11

The user explicitly requested merging all five features into main and removing their worktrees/branches. Local main fast-forwarded to verified candidate `a169f61fcf58cb1693a0996f832ad4c5e4ad59f9`, tree `994e3b964c1bc668af105503db972eb8a8e78fff`, without conflicts or runtime edits. All 114 reviewed code hashes and 176 original source hashes/file sets matched before cleanup. The five feature worktrees and `premerge-five-features`, plus their six `cob-g/` branches, were removed through Orca. Only the main worktree remains; unrelated branches were preserved.

Private source snapshots, local configuration, stopped synthetic databases, screenshots and reports are retained in six verified archives under ignored `.local/five-feature-merge-archive/` (directory mode0700, archives mode0600). Final reviews/check logs are directly available in its `evidence/` directory. References below to candidate `.local/` paths are historical paths inside `premerge-five-features.tar.gz`; original source artifacts are in the corresponding source archive. These archives contain private local credentials and must never be committed or published. The import manifest describes the reviewed premerge snapshot; later factual merge documentation is outside its candidate document hashes.

All six owned worktree PostgreSQL clusters were stopped before archiving/removal. Main's existing database and environment were preserved; no main database migration, remote push, external service action or deployment occurred. Prior executed verification remains applicable because the merged runtime is byte-identical. Only factual merge/cleanup documentation was updated afterward; formatting and diff checks cover those updates.

## Imported identities and shared scope

The exact per-file source paths, SHA256, dispositions and assembled hashes are in `five-feature-import-manifest.json`. All five source reports were read and their declared fingerprints recomputed successfully. Source identities:

| Source                              | Verified report fingerprint                                        |
| ----------------------------------- | ------------------------------------------------------------------ |
| booking plus guarded time off       | `5bdd785361593f9003ebdeb77149c92cededfd67d6c175252701f2fd2a9af2cf` |
| standalone time-off provenance only | `b4ad887b08ff9896ddf37b74200dcfc668436e4f1233195967cd900e56e6406d` |
| languages full diff                 | `185e8a0579d0d6989d59cb7df6aa10a0222d0f17ca75eafae5e7cd584e620bdd` |
| support full files                  | `2996604928c5a03b7fdfa96e639244fa2f28527fcb51d3f5098da327e47e71f0` |
| sessions full diff                  | `6bb495afd99f49da90c4a603ab21fb708e9b85946a6bc57b99fafe5a2e33599a` |

Booking already imports the standalone time-off implementation and adds reservation-conflict protection. Its guard wins; the standalone source is not imported again. Shared eligibility retains transaction-compatible select typing plus complete optional language projection/filtering. Schema exports and grants combine all domains. The default Playwright command includes every new suite, serializing fixture/throttle-mutating projects after baseline learners; privacy-safe trace/screenshot settings remain. The dedicated sessions config now selects only its own suite to avoid duplicating the default project.

New integration regression checks compose optional language save/omit/clear with unchanged subject/level eligibility, time-off suppression and retained active reservations. Additional revoked-provider-cookie assertions deny booking/support mutation access immediately. Existing source tests and baseline tests remain selected.

## Migration reconciliation

Baseline SQL/snapshots0000–0007 and journal entries are unchanged. Booking `0008_perpetual_celestials.sql` SHA256 `9976aa48be372ebdb218ebc76dffd302f544855d23ffa1602fe55f4dce28fba4` and time-off `0009_typical_queen_noir.sql` SHA256 `e433cf938fc50195d8f6c7b15836a611fdcea9e154bbae26a30bf98860baae72` plus generated source snapshots are exact copies. Preserve booking's reviewed btree_gist half-open tutor exclusion and immutable-booking transition trigger, which Drizzle snapshots do not express.

Pinned Drizzle generated `0010_integration_teaching_languages` from combined snapshot0009 with the language export only. Its SQL is byte-identical to the source language0008. Then it generated `0011_integration_support_reporting` after adding the support export. Its five table snapshots match the source corrected0009 exactly, including nullable event shape `IS TRUE`. This is a newly generated additive chain with the corrected support definition from creation; source applied0008→0009 history stays untouched. No source DB was adopted, applied history squashed/reordered, metadata fabricated or push used.

Runtime grants combine state-only booking UPDATE, insert-only booking history, SELECT/INSERT/DELETE time off and languages, exact support capability/assignment SELECT, column-limited support status/revision/time UPDATE, SELECT/INSERT case/history and no capability/assignment/history rewrite/delete. Existing auth/learner/tutor grants remain. Roll back application exposure while retaining additive schema and history; destructive rollback is unauthorized.

## Review and verification

Same-agent read-only integration Review: plan alignment, system integrity and unintended-change inspection cover shared deltas, source provenance, schemas/grants, migrations, private ownership paths and test discovery. Independent source/combined review is coordinator-owned. Runtime checks are separate; no source's isolated green result substitutes for candidate evidence.

Frozen code/config/test/migration fingerprint: `b096dd33636548b83ecb7cf15912df49411763fc6ee6d7fa67c0d5d3726f6166`,114 changed files. Algorithm: sorted baseline-relative changed tracked/new nonignored code paths, excluding Markdown and `context/`, `docs/`, `prompts/`; SHA256 of each path+NUL+hex SHA256(bytes)+LF concatenation. `.local/candidate-fingerprint.json` contains the exact paths/per-file hashes. Factual documentation updates remain outside that code identity.

Independent read-only repair Review **PASS** (`.local/booking-fix-independent-review.md`); combined Review plan alignment/system integrity/unintended-change audit **PASS**, recommendation **READY FOR VERIFICATION**,0 remaining Critical/Important/Minor (`.local/combined-independent-review.md`). Both independently recomputed the114-file code fingerprint. These reviews inspected supplied logs; this integrator executed the verification below. Neither report is production or main-merge clearance.

| Executed check                                | Observed result                                                                                                                       | Private evidence                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Pinned `npm ci`; owned `local:setup`          | PASS, own DB55461/dev3021/test3121; unchanged dependencies                                                                            | `.local/npm-ci.log`, `.local/setup.log`                                                               |
| `npm run check`                               | PASS format/lint/typecheck,485 unit/component cases16 files                                                                           | `.local/check-final.log`                                                                              |
| `npm run test:integration -- --maxWorkers=1`  | PASS161 cases9 files, including55 booking cases and all baseline/new suites                                                           | `.local/integration-final.log`                                                                        |
| `NEXT_TELEMETRY_DISABLED=1 npm run build`     | PASS production compilation/types/static generation/dynamic private routes                                                            | `.local/build-final.log`                                                                              |
| Default browser discovery/execution           | PASS49 cases10 files, baseline plus all five new suites; no hidden configs/tests                                                      | `.local/browser-discovery-final.log`, `.local/browser-final.log`, `playwright-report/`                |
| Fresh full migration and baseline0007 upgrade | PASS12 applied hashes/23 tables; all14 baseline tables' representative records exact; supplements/grants/NULL-event rejection         | `.local/migration-evidence.json`, `.local/migration-upgrade-attempt1.log`, `.local/verify-upgrade.ts` |
| Changed33 TSX Impeccable detector             | Exit0, no findings                                                                                                                    | `.local/impeccable-final.json`                                                                        |
| Actual private-value scan                     | 30 built client assets +139 changed tracked/new files against52 active credential/session/verification values;0 client/source matches | `.local/client-scan.json`, `.local/client-scan-final.log`, `.local/scan-client.mjs`                   |
| Responsive/visual QA                          | 15 representative narrow/desktop/forced-color screenshots inspected; no clipping/new defect observed                                  | `test-results/`, `.local/visual-review.json`                                                          |
| Diff/format/source preservation               | PASS final diff check and factual formatting; all176 source file hashes/HEAD/file sets unchanged                                      | import manifest, `.local/final-scope-evidence.json`                                                   |

Fresh/upgrade evidence precedes application authorization repair and remains applicable because SQL/snapshots/journal/grant inputs did not change. The isolated databases are retained. Upgrade tested actual baseline migration0007 first, seeded representative auth/session/access/role, subject/tutor/windows, guardian/self learners/link/audit records, compared every baseline table before/after, then exercised real app-role denials: exclusion23P01, immutable/early-expiry23514, forbidden column/history/capability writes42501, language uniqueness23505 and NULL history23514. No `push` or destructive database recovery was used.

Browser assertions cover keyboard/focus/status/error/retry/empty/privacy/axe/no horizontal overflow at applicable320/390/768/1024/1440 widths, reduced motion/forced colors and640x400 reflow. No-JavaScript language GET filtering also passes. Manual QA inspected five feature areas at narrow/desktop sizes and forced colors. Reflow is not literal browser zoom or hardware screen-reader evidence.

## Recovered findings and authorization semantics

Original review R1 queued authorization, R2 missing trusted tutor role and R3 transaction-start event timestamps are resolved. The scoped recovery also fixed a residual subject wait, nested pool starvation, the legitimate multi-role actor/audit FK cycle, and expiry during a subject wait. Recovery rationale and discriminating coverage are in `prompts/recovery/2026-10-11-integration-authorization-freshness.md`; original failures remain in `.local/authorization-repro.log`, `.local/subject-wait-repro.log`, `.local/support-repaired-attempt1.log`, `.local/actor-fk-deadlock-repro3.log` and `.local/subject-expiry-repro.log`. Invalid draft audit/deadline fixtures are disclosed there and superseded by corrected tests, rather than claimed as code defects.

READ COMMITTED checks after all domain waits observe revocations committed before each final authorization check; already authorized in-flight requests may complete. Tutor-first locking plus exclusion preserves overlap integrity; actor NO KEY UPDATE serializes the technical cross-tutor quota without blocking audit-FK KEY SHARE. Transaction-local session/verification/access/role rechecks avoid sixth-connection pool acquisition. Exact guardian and support capability/assignment predicates remain. Creation/expiry events use captured current DB time; post-subject-wait expiry is materialized before new insertion. Provider list/revoke ownership APIs remain unchanged. No new auth token ownership, role/link/access/capability write grant or real consent/commercial decision was introduced.

A metadata inspection accidentally printed the owned synthetic DB role credentials to this worker tool output. Only candidate55461 owner/runtime passwords were rotated, matching ignored metadata/env files retained mode0600, old fresh connections were rejected28P01 and replacements authenticated; the subsequent full49-case runtime browser run passed. `.local/credential-correction.json` is sanitized containment evidence. Schema/data/source/main/cloud credentials were not modified by this correction; report and scan outputs include counts only.

## Limits

Local synthetic data only; real guardian/consent/legal/commercial/incident-response/production decisions remain OPEN. One local candidate commit is coordinator-authorized after the frozen checks. No main merge/push/cloud/provider mail/payment/deployment/destructive reset/worktree deletion or extra worker occurred. Existing synthetic test fixture cleanup is confined to this owned test database. Remote CI, other browser engines, literal browser zoom, real hardware screen reader, hosted migration/backup and real-user launch are NOT RUN. Existing dependency advisories remain outside this integration's dependency scope.
