# Owner-only local email-change messages

Status: AUTHORIZED — build-feature delegation.
Authority: 2026-11-12 user request to implement Resend email changes using the
existing personal mailbox until a sending domain exists. No separate human
blueprint review or release authorization is claimed.
Baseline: main at f886191; pre-existing untracked designs/ stays untouched.
Proposed working branch: feature/resend-email-change.

## Outcome and requirement mapping

AUTH-02/03/04, M2.9/M5.7: the existing signed-in account email-change flow sends
current-address and new-address six-digit codes to the exact configured owner
through Resend. Synthetic .test counterpart addresses keep private capture so
the full local flow can be exercised within Resend's owner-only restriction.
Other real destinations fail closed; recipients are never substituted.
Read AGENTS.md and all eight canonical context documents before implementation.

## Scope and invariants

- Reuse LOCAL_VERIFICATION_RESEND_KEY/LOCAL_VERIFICATION_RECIPIENT and the existing
  local workflow admission, fixed test sender, bounded timeout and safe errors.
- Extend the branded account email shell with current/new-specific code messages,
  five-minute, single-use, private-code guidance and token-free /account/email
  navigation. Keep plaintext, CID wordmark and accessible/mobile presentation.
- An enabled failed live send must not fall back to a local capture. Only
  deliberately synthetic email-change recipients use capture in this mode.
- Keep Better Auth's hashed codes, three attempts, five-minute expiry, proof
  binding to owner/session/current/new address, freshness, same-origin checks,
  throttling, raw-endpoint denylist, other-session revocation and uncertain-change
  recovery. No change to verification/reset routing or booking notices.
- Update only the enabled local email-change guidance with truthful inbox versus
  synthetic capture instructions. No new frontend design or recipient secret.
- No dependency/schema/migration, hosted activation, domain/billing change,
  real personal-account email mutation, commit/push/merge or deployment.

## Implementation sequence

1. Add branded current/new email-change rendering using the shared account shell.
2. Extend validated local mail routing to exact owner live delivery or deliberate
   synthetic counterpart capture; refuse other real destinations.
3. Pass a safe boolean into the existing form for correct guidance at both steps.
4. Document the extension, testing limitations and actual results in governing
   context, local operations, decision record and progress tracker.

## Acceptance and verification plan (not executed in architecture)

- Transport tests: both purposes, exact recipient, wrong recipient/origin/path,
  malformed code, no proof in URL, timeout/provider failure, no fallback, default
  capture and unchanged verification/reset behavior.
- Renderer/component checks: distinct purposes, code/text/CID, HTML escaping,
  five-minute/one-use guidance and enabled versus capture-only instructions.
- Real isolated test PostgreSQL: existing email-change boundary suite and a
  provider-intercepted current/new round trip through existing signed-in handler;
  no mutation before both proofs, invalid/reused proof, session revocation,
  failed send refusal and no recipient substitution.
- Relevant lint/typecheck/build and desktop/mobile template/form browser checks.
  No broad unrelated CI/E2E repeats. Live owner-mail code request only if a
  safely admitted configured environment is available; never consume the user's
  personal proof or change their personal address automatically. Report provider
  acceptance separately from inbox receipt.
- Read-only same-agent Review precedes executed Verify; save local memory after
  verified results. Record any missing live credentials/environment honestly.

## Documentation and rollback

Update architecture, PRD, UI context, build plan, progress tracker,
docs/operations/local-workflow.md and a scoped decision record. Remove both
private settings and restart to return to capture-only behavior. No records or
historical proofs are rewritten by this change. General-recipient sending remains
gated on an owned verified sender domain.

Official references: https://better-auth.com/docs/plugins/email-otp and
https://resend.com/docs/knowledge-base/403-error-resend-dev-domain.
