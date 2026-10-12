# M4.4 — Local synthetic learner onboarding

Date: 2026-10-12. Status: AUTHORIZED — build-feature delegation.
Authority for bounded slice: AUTHORIZED — build-feature delegation, live Task C
(task_55b84e7aec62 / ctx_1c38579b7e8e), user requested local completion before
deployment with payments deferred. No separate human blueprint approval claimed.
Repository: /Users/cob/orca/workspaces/learli/m4-local-learner-onboarding.
Observed clean baseline: 0494f6b4cd1044ebebb89f0d41b1b706cb851352,
branch cob-g/m4-local-learner-onboarding. No nested workers or commits.
Parent reference: /Users/cob/orca/workspaces/learli/m4-local-completion-integration/prompts/features/m4-10-local-completion-wave.md.
Read AGENTS.md, eight canonical context files in its order, ORCHESTRATION-LESSONS.md
and each repository skill at its stage. Context and parent authority govern.

## Outcome and requirements

Both UI and backend/database. FAM-01/02, AUTH-03; owning build-plan M4.4.
An existing active verified synthetic parent creates a minimal new guardian-managed
local learner and its own authorized fixture relationship atomically. An existing
student role holder creates one own College Support local learner without a guardian.
The list empty state leads to a dedicated create page. Success returns an authorized
minimal learner; existing GET/PATCH and booking provider contract remain unchanged.

## Decisions and boundaries

Preserve source=local_fixture in both existing tables. Record auditable local
creation origin in a separate immutable receipt/event relation, without changing
existing booking selectors. This is a relationship demonstration, not proof of real
consent, age, identity or guardianship; no consent checkbox. Only display name,
level and IANA time zone; no arbitrary existing-learner linking, uploads, DOB,
school, address, contact data, role acquisition, deletion or live enablement.
Local development/test on loopback and verified .test identity only. Trusted parent
role is local authority. Multi-role holders may choose only their actual permitted
management modes; a client choice is never a role grant.

Proposed routine contract sent to root (msg_c3696c67d5b0): actor-scoped UUID
idempotency, same canonical request replay, different payload conflict; distinct request UUIDs create separate guardian profiles, even with identical
name/level/zone (siblings can share values); self profile remains unique. Coordinator
accepted20 parent-created profiles, excluding owner fixtures and replay attempts.
Answer msg_c3696c67d5b0 is local authority only, never customer policy.

## Implementation

1. Strict create input extends existing minimum fields with request UUID and bounded
   management choice; authenticate before field feedback. New service checks local
   synthetic identity and trusted role, then calls a narrow SECURITY DEFINER SQL
   function; fixed pg_catalog search_path, qualified tables, PUBLIC execution revoked.
2. Function serializes actor, rechecks persisted session/verification/access/role
   after waits, validates bounded fields including pg_timezone_names, atomically
   inserts profile/link and immutable request/origin receipt. No broad INSERT or link
   UPDATE grants. Hash canonical minimum input; audit contains opaque references,
   hash, mode/outcome/time only. Replay still requires current learner authorization.
3. POST /api/learners composes existing bounded same-origin private mutation handler;
   GET/PATCH preserve behavior. /learners/new uses existing private boundary/static
   noindex metadata and native labelled controls. Keep values on errors, distinguish
   validation/access/network uncertainty, stable retry key, pending lock and focus.
4. Minimal new own schema module and forward SQL. Coordinator refinement
   msg_08985f8ddc5b: isolated SQL uses contiguous0017_local_learner_onboarding;
   final root numbering0018. Immutable0000–0016/snapshots preserved. Essential
   own-scope schema export/runtime EXECUTE grant and isolated journal append only;
   root owns integration snapshots/index/grant/journal/test-registration reconciliation.
5. Tests for input/permissions/atomic rollback/concurrent retry/distinct profiles/capacity/replays/conflicts,
   revoked session/role/suspension after lock waits and runtime raw-write denials.
   Update existing forged-create expectations from405 to validated400. Add browser
   journeys to already registered learners suite; no package/config changes needed.

## Planned verification (NOT RUN at blueprint creation)

Pinned npm ci; assigned own DB55813/dev3083/browser3183/disposable55713 only.
Heavy checks require coordinator lease. Sequential full npm run check, production
build, real PostgreSQL feature/regression tests, migration rerun/preservation/grant
proof, and real Chromium browser journey at1440/390/320 with keyboard/axe,
empty/loading/error/retry and navigation/session/public-metadata privacy evidence.
Booking provider consumes newly created profiles through unchanged interface,
verified with actual PostgreSQL, without editing booking service or schema.
Shared staging protection/restore schema assertions remain strict; expected new
schema failures reported to root for integration-owned reconciliation.

## Documents, rollback and handoff

Own scoped decision records local origin/retry semantics before code; tracker
records meaningful partial implementation and separate Review/Verify evidence.
Root reconciles governing PRD/architecture/build-plan shared docs; no milestone
box promoted for this synthetic subset. Append-only forward addition; remove/disable
runtime endpoint to stop local creation, preserve records/history. No production
rollback operation authorized. Save exact source/hash manifest and Review/Verify/
Recover evidence at .local/local-completion-wave/report.md and manifest.json,
ignored memory.md with existing history. Next consumer: coordinator source freeze,
combined migration/schema grants/staging-verifier reconciliation and independent review.
Real-user/consent/guardian/legal/safeguarding/payment/provider/device/launch gates stay OPEN.

Coordinator delegated JSON-form convention: explicit noscript explanation,
disabled-until-hydration inputs/button and method=post; no private GET fallback.
Native mutation is not required for this bounded slice. Existing family/demo
empty-state CTA/copy updates are root-owned integration hunks, not worker edits.
Coordinator also authorized preserving own initial dev/test databases and fresh
final targets plus baseline→forward proof; no original baseline migration changes.

Coordinator approved R4: remove automatic learners/loading.tsx after actual browser
no-JS hidden-content failure. Await protected list/detail/create HTML, as with
existing private booking pages; API reads/edits remain unchanged. A feature-local
LearnerLink uses existing Next useLinkStatus convention to retain pending navigation
words while current content stays visible; form mutation pending remains unchanged.

Coordinator approved R5 privacy preservation: awaited HTML exposed the inherited
edit form's native GET fallback. It now has SSR-disabled hydration controls,
explicit noscript text and method=post/private API action; hydrated PATCH is
unchanged. Actual no-JS list/detail/create and SSR guard regression cover this
scope. Analogous bounded privacy fixes may proceed through Recover without new
semantics approval when routes/domain behavior stay unchanged.
