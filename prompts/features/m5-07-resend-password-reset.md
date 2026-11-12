# Owner-only local password-reset email

Status: AUTHORIZED — build-feature delegation.
Authority: 2026-11-12 user request to implement Resend forgot-password/reset links using their personal email until a domain exists. This is implementation authority, not separate human review of this blueprint.

## Scope and outcome

M2.3/M5.7, AUTH-02: the existing Forgot password form sends a real Better Auth password-reset link through Resend only to the already configured owner mailbox. Use the existing private local verification credential/recipient pair, fixed test sender, timeout and ordinary local workflow capability. Default local capture remains available when delivery is disabled. No hosted activation, additional recipients, account deletion, schema changes or booking email.

## Implementation

- Extend the existing local account-proof transport to accept validated verification and reset callbacks for the exact configured recipient, with no recipient substitution or fallback capture after an enabled send fails.
- Share the existing branded email layout with a reset-specific subject, action and copy; retain plain text, CID logo, fallback URL, private-link guidance and a 30-minute expiry matching current auth options.
- Keep provider-owned reset tokens, 12–128 character password rules, single use, expiry, verified-account rules, session revocation, origin/callback validation and throttling.
- Extend the existing uniform local verification response/timing boundary to reset requests so account existence, recipient restriction and provider failure do not change the public accepted response. Preserve validation and rate-limit errors and private headers.
- Update Forgot password guidance only when this optional transport is enabled; never promise delivery. Existing environment names remain compatible and are documented as serving verification and reset.
- Record the scope extension in the decision, architecture, PRD, UI context, build plan and actual progress.

## Verification

- Focused transport/template tests: genuine reset links, exact recipient, wrong origin/callback, timeout, safe failure, logo/text/action output, default capture and verification regression.
- Isolated real PostgreSQL auth test with intercepted provider: known/unknown/disallowed/provider-failure responses and throttling; valid reset succeeds, invalid/expired/reused proofs fail, old password and sessions are revoked. Never use the personal account to change its password automatically.
- Relevant component/auth integration checks, lint, typecheck and production build. Reuse the recently passed broad checks where unaffected; no full unrelated browser/CI loops.
- One live reset email to the configured personal mailbox is authorized by the user's request; do not consume its link or change their password. Record provider acceptance separately from inbox receipt and the user's eventual reset.

## Delivery

Review the complete scoped diff read-only, then execute verification; update the tracker and local memory. No commit, push, merge or deployment is implied by this new feature request.
