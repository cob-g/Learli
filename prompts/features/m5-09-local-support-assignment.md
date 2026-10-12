# Local support assignment and escalation

Date: 2026-10-12. Status: AUTHORIZED — build-feature delegation.
Authority: AUTHORIZED — build-feature delegation for Task D, task_90c92df5e58a / ctx_0b225f4361e8.
Baseline: 0494f6b4cd1044ebebb89f0d41b1b706cb851352, clean at dispatch.
Parent: /Users/cob/orca/workspaces/learli/m4-local-completion-integration/prompts/features/m4-10-local-completion-wave.md.

## Outcome and mapping

M5.6/M5.9, OPS-05/ADM-03: an explicitly provisioned synthetic dispatcher can
assign, reassign or escalate an exact authorized case to an eligible provisioned
reviewer. Escalation is a visibly local reassignment, without a response promise.
Existing requester reporting, reviewer status transitions and booking context stay.
Read AGENTS.md, all eight canonical context files, ORCHESTRATION-LESSONS.md and
skills/build-feature plus the child skills at their stages.

## Coordinator-confirmed local contract

Owner tooling provisions exact dispatcher-to-case grants and case-specific
reviewer choices. These never auto-reactivate revoked grants. No browser grant,
self-assignment, global user/case directory, report body or booking projection in
dispatcher views. Minimal safe reviewer display names and opaque fixture IDs only.
Actor must have current provider session, active verified .test account, admin
role and exact authorized grant; candidate must have active verified .test admin
account, reviewer capability and case choice, excluding requester and dispatcher.

All actions share the existing case revision. An actor-scoped UUID request key
identifies exact case/reviewer/action/expected-revision payload. Same-key retries
return current permission-checked acknowledgement without another write; differing
payload or stale revision conflicts. Escalation requires existing assignment and
a different reviewer. Assignment does not change report status. Closed cases reject new assignment
actions until the existing authorized reviewer reopens them; current-authorized
exact-key receipt replay may acknowledge an earlier action without mutation. No live policy follows from these semantics.

Coordinator answer to the Orca ask confirmed this contract on 2026-10-12, with
the closed-case amendment above. Execution authority is delegated build work,
not separate human blueprint approval. Root allows installation/setup now.

## Data and implementation

Owned new support schema defines dispatcher grants, case reviewer choices,
append-only provisioning audit and assignment mutation audit. Keep existing
assignment/event structure; new action audit associates actor/key/kind/revision
and prior/next reviewer, while existing case history receives assigned/reassigned.
A narrow SECURITY DEFINER function uses pg_catalog search path and schema-qualified
relations, no public execution. Case-first lock plus actor-key serialization;
fresh READ COMMITTED authorization after waits. Current revocation/suspension
committed before final authorization denies; previously authorized in-flight work
may complete according to existing project boundary. Runtime cannot directly
write grants, choices, assignments or new history. Existing status reviewer guard
continues denying former assignees after case lock waits.

Isolated next contiguous migration is 0017_local_support_assignment, per root
followup msg_735f289b7606; final integration reserves0019. Preserve0000–0016.
Root owns final schema exports/journal/snapshots/grants/staging compatibility and
Playwright registration. Own essential shared hunks only; no booking edits.

Sequence: schema/function → owner fixture tooling → minimal current-authorized
read/mutation service and handlers → admin support dispatch pages/form → focused
unit/component and real PostgreSQL race/negative tests → browser regression.
Use existing native field/action/token patterns; hydration-gated mutations with
pending, stale, denied, uncertain outcome, reload and no-JS explanation.
Dispatcher navigation uses native document links to clear private document data.

## Verification plan (NOT RUN — planning only)

Pinned npm ci; owned DB55814/dev3084/browser3184/disposable55714 only. Request
heavy-work lease before setup/PG/check/build/browser. Sequential own tests.
Static format/lint/types/unit, full configured check and production build. Real PG:
initial assign/reassign/escalate, same-key concurrency, stale competing writes,
actor-key conflict across cases, immediate former reviewer denial, unauthorized
admin/requester/self, revoked dispatcher/candidate/capability and suspension/
role/session races in both lock orders, immutable audit and rollback on audit
failure, raw runtime grant denial, fresh migration and baseline preservation.
Browser: synthetic .test actors, 320/390/768/1024/1440, desktop/phone keyboard,
no-JS, pending/conflict/empty/denied/error, axe/overflow, Back/actor change privacy,
no requester/learner/meeting/email projection, inspected sanitized screenshots.
Retain original failed attempts and Recover records, separate read-only same-agent
Review recommendation from executed Verify outcomes. No independent review claim.

## Documentation and completion

Update own progress tracker with actual partial evidence; root reconciles PRD,
architecture/build plan/decision records before integrated use. Save report and
exact source hashes at .local/local-completion-wave/report.md + manifest.json,
ignored memory.md preserving history. No commit/merge/push/cloud/deploy/external
email/payments/real minors/customer policy. Next consumer: root integration and
independent combined acceptance. Whole M5 and real incident readiness remain open.

## Coordinator amendment — native protected support reads

2026-10-12 Orca ask answer authorizes removing only admin/support/loading.tsx
after actual no-JS browser failure: inherited automatic parent loading boundary
kept core dispatcher/reviewer HTML hidden. Preserve awaited protected SSR and
all authorization, form pending/error feedback and native navigation. Verify
existing reviewer/support-booking routes, no-JS, delayed navigation and privacy.
History-provenance correlation repair is separate and preserves original labels.

The coordinator additionally authorized analogous SSR hydration/POST/noscript
guards in the inherited status form and supported-schema name/check-shape
alignment to immutable SQL. Final literal-only native reviewer placeholder is
shortened to fit320px; no new role/action/permission/state/SQL behavior. Root
accepts retained runtime verification for metadata/copy adjustments with focused
format/type validation and precise applicability, and owns combined final build/UI.
