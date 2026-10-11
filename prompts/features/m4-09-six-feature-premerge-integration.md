# M4.9 — Six-feature local premerge integration

Status: **AUTHORIZED — build-feature delegation**. Authority: actual dispatched
2026-10-11 `$build-feature Integrate and verify the six completed Learli local
features as a safe combined pre-merge candidate`, following the user's explicit
"ok safe to merge? commit and merge it". The parent alone owns commit/merge;
this delegation permits isolated integration, review, verification, scoped repair
and documentation, not a separate claim of human blueprint approval.

## Outcome and requirements

Assemble booking details/history, student/parent dashboards, tutor dashboard,
actual-date profile selection/auth continuation, availability matching and local
creation-notice capture into one inspectable candidate. Primary M4.9/BKG-04;
related M4.11/M2.9/M3.6/M5.3–M5.5/M5.7–M5.8, PUB-03/PUB-04, MATCH-01–03,
AUTH-03/AUTH-05, BKG-01–04, FAM-03, TUT-06, OPS-01–04. This is local synthetic
acceptance only; milestone exit and real-user/production gates remain open.

Observed clean baseline: `0c078bf50f9f967b20391ef3640353a7b3897e62`, branch
`cob-g/six-feature-integration`, repository
`/Users/cob/orca/workspaces/learli/six-feature-integration`. Read repository
AGENTS.md and its eight canonical context files in their required order, then
source worker reports, approved local decisions and source blueprints. Reuse
completed isolated feature stages; do not rebuild their designs.

## Inputs and boundaries

Authoritative input is `/Users/cob/learli/.local/six-feature-merge/sources.json`:
six frozen snapshots, exact changed file paths and SHA256 identities. Read only
listed source/report/blueprint files, preferably snapshots; never peer env,
credentials, databases, auth captures or private fixtures. Originals stay intact.
Record provenance/dispositions for every input and reconciled target. Preserve
the 15-file m4.9-read-v4 and five-file public-availability-v1 bundles exactly
unless a demonstrated integration defect requires a scoped authorized repair.
Preserve the family-owned additive LessonTime variants and unchanged full default.

No terminology or material business clarification is needed for this explicit
integration. Existing local decisions supply simulation constants and recipient
rules; no commercial/guardian/security policy is reopened.

## Invariants

- `local_simulation`, `demo_reserved`/`demo_expired`; 60-minute duration,
  30-minute step, 60-minute notice, 14-day horizon, 600-second TTL unchanged.
- Current provider session, server roles, active verified synthetic accounts,
  exact ownership/guardian link/assigned tutor; no admin bypass. Private reads
  retain final SQL authorization snapshot, current viewer zone, read-only effective
  expiry and monotonic client timing. No fabricated history event.
- Booking locks, writes, idempotency/exclusion and booking/time-off race guards
  remain authoritative. Profile's narrow pure schedule extraction and complete
  final-duration busy/time-off query tail are preserved.
- Public choice URLs contain public tutor/subject/level/zone/UTC interval only;
  after auth, resume/create revalidate eligibility, ownership, level and slot.
- Native no-JS SSR, real 404, current controls/pending/Back restoration, truthful
  empty/error states, privacy metadata and baseline demo/loading.tsx remain.
- Notifications are bounded manual committed-only private local HTML capture;
  no Resend/network send, confirmation/payment/meeting storage/attendance,
  cancellation/refund policy, real minor onboarding, LMS/messages/uploads.
- Only owned PostgreSQL55477/dev3037/test3137; no production/main/peer services.
  No commits, merge, push, deployment, reset or worktree removal by this worker.

## Assembly plan

1. Validate clean baseline and all frozen input hashes. Import unique/identical
   shared files once. Preserve all source decisions, blueprints and recovery notes.
2. Combine six additive Playwright projects after all49 baseline cases; serialize
   DB-changing suites with workers1 and project dependencies. Combine family/tutor
   separate auth h1 changes and profile/matching distinct catalog assertions,
   preserving eligibility, privacy and suspended404 checks.
3. Keep baseline migration0000–0011 unchanged. Import notification0012, snapshot,
   journal and schema export. Retain booking_events INSERT plus exactly one
   column-limited SELECT and restricted notification grants; no broader access.
4. Reconcile context changes against the baseline, combining nonconflicting
   documented facts and recording isolated evidence as historical. Update current
   progress as assembled/pending until combined execution actually passes.
5. Inspect actual combined tests. Add only meaningful missing combined journey
   regression: matching interval → profile same choice → auth/verification → own
   synthetic reservation → family/tutor lists/detail → local artifact and private
   participant link/revocation, plus eligibility/overlap/time-off denials.

## Review and verification plan

Same-agent read-only Review covers all tracked/untracked nonignored changes against
this blueprint. Publish CANDIDATE_READY with exact manifest, runtime fingerprint,
source provenance and reconciliation decisions. Parent launches two independent
read-only reviewers. Freeze runtime/config/tests/migrations while they inspect;
verification and factual docs may proceed. Ask parent before necessary runtime
repair during active review; confirmed findings route Recover → scoped repair →
Review → affected verification. Both reviews must cover final runtime before done.

Execute pinned npm ci, owned fresh local setup/full13 migration proof and real
baseline0000–0011 →0012 upgrade with representative synthetic preservation and
restricted runtime grant proof. Run npm run check, full PostgreSQL integration,
production build, complete default browser discovery and suite workers1. Static
checks finish before build/browser, and integration/browser never overlap. Inspect
phone/desktop screenshots, keyboard/axe/no-JS and privacy/client-output evidence.
Use actual repo scripts; no package or lock upgrade and no ad-hoc implementation
mirror tests. Capture failures and use Recover, preserving checks and evidence.

Initial verification status: **NOT RUN — planning only**. Passing isolated source
reports are provenance, not combined acceptance. No new external API/dependency.

### Parent-authorized integration repairs

After both initial independent reports completed, parent msg_c1e87bad0cf5
authorized three scoped findings: correct the new combined detail heading and
separate simulation status assertions; suspend only profile-suite-owned discovery
fixtures in guaranteed teardown while preserving records/overflow assertions;
group family agenda/history by local date plus actual formatted zone so two
same-date DST offsets never share a contradictory label. Preserve unique stable
group keys and per-row offsets; add a meaningful rendered opposite-offset
regression. No auth/query/service/migration/policy change. This remains
AUTHORIZED — build-feature delegation, not separate human blueprint approval.
Recover diagnosis is `prompts/recovery/2026-10-11-six-feature-integration.md`.
Re-review the exact five runtime paths, execute affected presentation/static,
production rebuild and full79-browser acceptance, publish replacement fingerprint
and refreeze for both independent final-runtime follow-ups. Unchanged real PG
and migration proof remain applicable by exact boundary identity.

## Delivery and rollback

Factual canonical progress/context, `docs/operations/six-feature-premerge.md`,
ignored `.local/integration-report.md`, `.local/final-manifest.json` and separate
runtime fingerprint. Algorithm: sorted relative path + NUL + lowercase hex
SHA256(bytes) + LF, concatenate and SHA256; all changed tracked plus untracked
nonignored files included, runtime excludes context/docs/prompts/ignored evidence.
Remember saves ignored untracked sanitized memory with review/verification separate.
Parent validates final frozen candidate and performs commit/merge. Before that,
rollback is simply retaining this isolated uncommitted candidate and its owned
synthetic services/evidence; no original or main state is modified.
