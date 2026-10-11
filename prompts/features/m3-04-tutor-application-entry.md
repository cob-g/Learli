# M3.4 (first slice) — Tutor application entry

- Status: **AUTHORIZED — build-feature delegation**
- Date: 2026-10-11
- Authority: The repository owner agreed ("agreee") to the recommendation to add a
  "Start tutor application" button on `/become-a-tutor` and asked for it to be
  built as the first piece of M3.4. Delegated execution authority, not separate
  human review of this blueprint.
- Baseline: `main` at `d22a061` plus the uncommitted, verified M3.1–M3.3 work and
  the tutor edit/reapply change. This slice's files are listed under Scope.
- Package: M3.4, application entry only. PRD: TUT-01, AUTH-01, AUTH-03.
- Decision record: `docs/decisions/2026-10-11-tutor-role-self-service.md`.

## Outcome

Any signed-in, verified, active account presses "Start tutor application" on
`/become-a-tutor`. The server gives that account the `tutor` role and sends it to
`/tutor/profile`. A signed-out visitor is sent to sign-in and returns to the page.
The tutor stays invisible to the public until an admin approves the application.

## Decisions

1. The `tutor` role is a self-selected account type. It only lets an account
   manage its own application. Approval remains the gate (BR-01).
2. The runtime database role still cannot write `user_roles`. A
   `SECURITY DEFINER` function, `grant_tutor_role(text)`, inserts the literal
   role `tutor` and nothing else; the runtime role may execute it. No path can
   grant `admin`, `student` or `parent`.
3. The service passes only the authenticated user's own id. The grant is
   idempotent and audited once as `tutor_role.self_granted`.
4. The request is a POST with an empty strict JSON body, same-origin only. A GET
   never changes a role.
5. `/become-a-tutor` states only what exists today: an application with subjects
   and levels, reviewed before it is public. It makes no claim about earnings,
   approval time, availability or bookings.

## Scope

Included: audit action and its migration; custom migration for the function;
execute grant in `scripts/migrate-local.ts`; `startTutorApplication` service and
`POST /api/tutor/application`; `/become-a-tutor` page and its button; tests; docs.

Excluded: account-type choice at sign-up, student/parent roles, public directory
and profile pages, matching, availability, rate limiting.

## Invariants

- Unverified, suspended and signed-out callers are refused.
- No client field selects a role or a user. Unknown body fields are rejected.
- A new tutor has no profile and is not publicly eligible.

## Verification plan — not yet executed

- Migrations apply to dev and test and rerun cleanly.
- Integration: role-less account gains only `tutor`, once, with one audit row, and
  can then submit an application; repeat call is a no-op; anonymous 401;
  suspended 403; cross-origin 403; forged body 400; runtime still cannot insert
  into `user_roles`; the function cannot produce any other role.
- Browser: signed-out click goes to sign-in with a return path; signed-in
  role-less account reaches the form; axe and overflow at three widths.
- `npm run check`, `npm run test:integration`, `npm run build`, `npm run test:e2e`.

## Risks

- Anyone with a verified account can hold the tutor role. It grants no access to
  other people's data. No rate limit on the endpoint; revisit before hosting.
- Tutor screening policy remains `[OPEN]`.

Blueprint ready.
