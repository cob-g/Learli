# M5.9 — Local synthetic support reporting

Status: AUTHORIZED — build-feature delegation; coordinator authorized the proposed local-only workflow on 2026-10-11.
Authority: AUTHORIZED — build-feature delegation (2026-10-11), dispatched full workflow for local synthetic support reporting; no separate human blueprint approval claimed.
Baseline: clean `cob-g/m5-9-support-reporting`, HEAD `3a055deff54149be48a91b44237d0e28b26f3405`.

## Outcome and trace

An active verified synthetic account can submit a minimal fictional support or concern case, list its own cases and read its case/status history. An explicitly preauthorized reviewer can read and change the status of only the exact case assigned through trusted local tooling. This covers the local technical portion of M5.9 / OPS-05 and necessary ADM-03 access, plus AUTH-03, NFR-01/02/05/06/09/11. It does not complete real-world support/safeguarding operations.

Read AGENTS.md and the eight canonical context files in their specified order. Existing local Better Auth, `requireIdentity`, bounded JSON mutations, no-store responses, native forms/tokens, isolated PostgreSQL and fixture manifests are reused. Existing `/contact` and `/report-a-concern` are unavailable placeholders; no support schema or booking schema exists at baseline.

## Proposed decisions and scope

Decision evidence: coordinator reply to the architecture question: “Authorized: recommended fixture-only assignment/reassignment.” Categories, transitions and requester/reviewer permissions below are delegated local product decisions, not founder-approved real-world policy. Rationale: smallest complete synthetic demonstration of case-specific access without introducing runtime staff authority or incident operations. See `docs/decisions/2026-10-11-local-support-reporting.md`.

- Categories: general, account, safety. Subject 1–120 and body 1–2000 trimmed characters; reject control characters and unknown/privileged fields. Plain-text rendering only. No DOB, school, private meeting link, upload, reply/chat, email or external operation.
- Statuses: open → in_review → closed; closed → in_review for local reopening. Assigned reviewer alone changes status, with current revision required. Same-status retry at the same/current revision returns the stored case without another event.
- Assignment: trusted fixture tooling preauthorizes active verified synthetic admin accounts in a support-specific capability table and assigns/reassigns an exact case. Runtime never grants capability, claims assignment, or changes assignment. Admin role alone grants no case access. Assignment does not imply a real human escalation owner.
- Requesters may create/read only their cases; no edit/delete or staff identity disclosure. Reviewer lists/detail/status require admin role, active support capability and current exact assignment. No learner/booking reads or joins. A requester who is also assigned staff is still forbidden from reviewing their own case.
- Signed-out `/contact` and `/report-a-concern` display the local demo disclosure and sign-in entry; form submissions require a verified active account. Missing/non-owned case errors match. Suspended/unverified users are denied consistently with existing guards; actual suspended-user safety contact policy remains OPEN.
- Local-only gate: runtime environment development/test, exact loopback origin and synthetic `.test` identity; no staging/production activation. Visible disclosure: fictional local testing, not monitored and not an emergency reporting channel. No response-time claim.
- Technical anti-abuse/retry bound: at most five new cases per account per five minutes; a unique requester/request UUID makes identical network retries return one case and rejects key reuse with changed input. The initial access-row lock proposal was refined during implementation to a requester-keyed PostgreSQL transaction advisory lock, preserving atomic limits without granting runtime writes to account status. Lists are paged by twenty with explicit next-page indication. These are local implementation limits, not real service policy.

## Data and integrity

New `src/lib/db/schema/support.ts` owns support_cases (UUID, requester, category, subject, body, source local_synthetic, status, revision, UTC timestamps), support_reviewers (trusted capability/source/state), support_reviewer_events (safe capability audit), support_case_assignments (one current reviewer per case), support_case_events (append-only case-local created/assigned/reassigned/status_changed history, safe actor reference/status/revision/time only). Use foreign keys/restrict deletes, enums/check bounds and requester/reviewer indexes. No free-text audit metadata.

Generation uses the next actual baseline migration (`0008`) and ordinary Drizzle metadata, followed by `0009` strengthening nullable event checks after the first migration was applied locally; coordinator reconciles combined histories later. Runtime grants: select capability/assignment, select/insert case, column-limited status/revision/time update, select/insert event; no assignment/capability writes, event rewrites, case body/requester transfer or deletes. Service and fixture transactions lock the case row, recheck current identity/capability/assignment, validate revision/status, write state and one event atomically. Account status/role checks occur in the authorizing queries, including after the lock. Fixture provisioning preserves edits/revoked capabilities, validates the private manifest, refuses adoption, and records assignment changes.

## File ownership and build steps

1. Add schema, export, generated migration and minimal grants. Document delegated local decision in docs/decisions and architecture/PRD local notes before depending on it.
2. Add support input/policy/service/handler, guarded API list/create/read/status routes. Bounded list with explicit truncation/paging and no raw body in list. Preserve privacy-safe errors and origin checks.
3. Add trusted local reviewer/case assignment script, guarded manifest and dev/test target, no runtime endpoint. Document invocation/limitations.
4. Add `/support` requester list and detail, `/admin/support` assigned list/detail, existing contact/report forms and scoped admin navigation. Use fixed metadata/noindex/dynamic private screens, native controls, status text/icon/color, honest loading/empty/error states, pending guard and focused validation. No broad auth/CSS changes.
5. Author unit, PostgreSQL and browser tests and update progress evidence. Same-agent read-only Review then separate Verify execution, scoped Recover as needed, then Remember save.

## Planned verification (NOT RUN — Architect only)

- Check assigned ports 55454/3014/3114 before local setup; PG 17 tools supplied. Inspect scripts, npm ci pinned packages, own fresh PostgreSQL dev/test setup/migrate twice, fixture rerun consistency.
- `npm run check`, full PostgreSQL `npm run test:integration`, `npm run build`, baseline `npm run test:e2e -- --workers=1` and dedicated support browser config with one worker.
- Positive requester/reviewer paths; cross-requester/reviewer and admin bypass denial; anonymous, forged grant/assignment/body/state, CSRF/origin, invalid IDs, revoked capability/assignment/admin role, suspension/unverification, local gates, bounded/malformed inputs, SQL constraints and least-privilege denials.
- Real PostgreSQL concurrent status edits have one winner; audit insertion failure rolls back state; assignment transfer revokes former reviewer; stale revision after assignment transfer cannot change state; read events are case scoped and redacted.
- UI form/list/detail/status, persistence, empty/not-found/load/network/stale/error/pending states, keyboard focus and safe text rendering, static private metadata/no-store; axe and no horizontal overflow at 320/390/768/1024/1440, reduced motion/forced colors and 200% equivalent reflow. Visually inspect narrow/wide screenshots.
- Diff/scope/secret-value client-bundle scan, generated SQL review, `git diff --check`, own branch tracker and ignored local memory/report. Same-agent review is not independent QA. No commit/push/merge/deploy/destructive operation.

## Risks, docs and handoff

Human safeguarding owner/escalation procedures, consent/jurisdiction/legal/retention, real incident response, reviewer provisioning/MFA for real staff and suspended-user alternative channels remain launch gates. Booking reference integration is deferred until a real contract; general cases are standalone. Local grants plus server predicates protect the application boundary, not arbitrary owner SQL. Shared minimal edits: schema export, migration grants, admin nav, architecture/PRD local notes, tracker, dedicated browser config and the shared RuleError type's additive 429 status for the local report limiter (no handler/auth changes). No other worker completion claim or environment reuse. Next consumer is coordinator reviewing this branch and later reconciling migrations/combined verification.
