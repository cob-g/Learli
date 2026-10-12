# M2.9 — Verified signed-in account email change

Status: **AUTHORIZED — build-feature delegation** (2026-10-12).
Protective binding revision: **AUTHORIZED — build-feature delegation**, coordinator
reply `msg_d48887510451` to `msg_b9a5b75ebd94`,
2026-10-12; supported identifier namespace supersedes issuance-cookie proposal.
Baseline: `b6cf237554b3d46e1e4c58ce10e1ef3ebafe10c0`, isolated branch
`cob-g/m2-verified-email-change`. Request: dispatched full build-feature workflow
for AUTH-02/03/04, active verified local synthetic owners. This is delegated
execution authority, not separate human approval of this blueprint.

## Outcome and boundaries

An owner opens `/account/email`, proves control of their current address, then
proves the proposed new address. Until final confirmation the existing email
remains usable and verified. All three mutations require a currently authorized,
active, verified, fresh signed-in session. New addresses stay in private form
state and owned local captures; there is no public pending-email DTO or URL.
No migration, dependency change, external delivery, account deletion, MFA,
OAuth, consent policy, or production operation is included.

## Evidence and delegated decision

Read AGENTS.md and all eight canonical context files in their prescribed order;
read coordinator plan `/Users/cob/learli/prompts/features/m3-05-next-three-feature-wave.md`
without editing it. Existing account profile/password/session behavior and
private document navigation remain intact.

Official primary documentation inspected on 2026-10-12:
[users and accounts](https://better-auth.com/docs/concepts/users-accounts),
[email OTP](https://better-auth.com/docs/plugins/email-otp), and
[session management](https://better-auth.com/docs/concepts/session-management).
The supported OTP change flow can require current-address verification before
issuing the new-address code. Sessions can be revoked through provider APIs.

Installed Better Auth **1.7.7** is the implementation authority:

- `dist/api/routes/update-user.mjs` and `email-verification.mjs`: core change
  confirmation uses stateless JWT links, allows replay of current-address
  confirmation, can create a session on final verification without an existing
  session, and does not revoke other sessions. Leave core change-email disabled.
- `dist/plugins/email-otp/routes.mjs`: `requestEmailChangeEmailOTP` consumes
  current-address proof, binds the next proof to old and new addresses, and
  `changeEmailEmailOTP` consumes the code before updating the provider-owned
  user. `atomicVerifyOTP` uses provider atomic consume, expiry and attempt limits.
- `dist/plugins/email-otp/otp-token.mjs`: `storeOTP: "hashed"` prevents plaintext
  codes in provider storage. The plugin defaults to 300-second expiry and three
  attempts; make those explicit. Its HTTP routes have provider rate limits.
- Installed sensitive-session middleware checks validity rather than age;
  mirror the provider's configured `freshAge` against the persisted session
  creation time at the Learli boundary, as existing password change does.

Coordinator reply `msg_d0add227a860` to `msg_ebaef2054ceb` authorizes supported
code-entry UX, current session retained, all other sessions revoked on complete
success, partial revocation uncertainty, token-free local capture navigation,
and full document replacement. Coordinator `msg_6852d889d7e0` authorizes an
additive project in this branch's Playwright configuration.

## Implementation

1. Add strict discriminated input and an authenticated private POST endpoint
   `/api/account/email` for start, request, and confirm. Select the current email
   server-side; accept only normalized bounded `.test` new addresses and six
   digit codes. Reject arbitrary actor, callback, return, and role fields.
2. Add the installed emailOTP plugin in local auth factory with
   `verifyCurrentEmail: true`, hashed codes, disabled sign-up, and unchanged
   existing email-verification/reset callbacks. Preserve provider cookie, CSRF,
   trusted-origin, throttling and HTTP middleware. Raw OTP routes remain outside
   `handleAuthRequest`'s allowlist; no OTP sign-in/reset/verify bypass is exposed.
3. Recheck exact persisted session, active access and verified owner in a
   transaction before each call. Reuse password boundary's nonblocking capacity
   and per-owner advisory keys so concurrent credential operations fail safely
   and do not exhaust the provider's five-connection pool. Do not edit provider
   auth rows or verification records in application code.
4. Forward provider HTTP requests with trusted local IP and a strictly selected
   body. Project responses to safe status/stage only, retaining Set-Cookie and
   safe rate retry headers. Duplicate targets receive the same pending response
   as available targets. Wrong/expired/replayed/swapped codes get generic errors.
5. After successful final provider mutation, call provider revoke-other-sessions.
   Retain current session and forward its updated cookie. If this second step
   fails, report that the email may already have changed and other sessions may
   remain. Disable blind form retry and offer account/session recovery by native
   navigation. Never promise rollback of provider writes.
6. Extend local capture only for current/new confirmation with a private code
   and a fixed token-free `/account/email` link. Capture files remain under own
   ignored `.local/mail` with restricted permissions. No code in stdout, URLs,
   evidence, screenshots, traces, browser storage, or public surfaces.
7. Add a dedicated private account page and account navigation link. Show current
   and proposed pending states honestly, keep codes transient and clear after
   submit, provide accessible status/focus, throttled/error/reauth/uncertain
   states, responsive layouts, and disabled no-JS mutations. Completion uses
   full document replacement to `/account` and reads the actual saved email.

## Verification and definition of done

Same-agent read-only Review is explicitly distinct from verification. Meaningful
unit/component tests cover strict validation, projection/cookies, pending/focus,
no-JS and uncertainty. Real isolated PostgreSQL and real provider HTTP/cookies
cover current/new proof, old email usability until completion, duplicate/same/
malformed inputs, replay/concurrent consume, wrong/expired/swapped codes, current
address changes, stale/revoked/suspended/unverified sessions, origin/allowlist,
provider throttle, retention/revocation, and partial revocation failure.
Actual browser confirmation uses owned capture files, token-free navigation,
phone/desktop keyboard, axe, overflow and no-JS checks. Browser traces and
screenshots are disabled for private mutation tests.

Execute current `npm run check`, `npm run build`, full integration and appropriate
full browser suite, plus discovered new browser project; do not reuse fabricated
counts. Use pinned Node24.20.0/npm11.19.0, own `npm ci`, PostgreSQL17, DB55492,
dev3052/test3152. Preserve inherited13 audit findings and migrations0000–0015.
Recover records original failures before scoped repairs. Update governing auth
context and tracker only with scoped facts, then Remember into ignored memory.
Deliver sanitized `.local/next-wave/report.md` and exact path/SHA256 manifest;
coordinator later freezes and integrates. No commit, merge, push or deployment.

## Ownership and handoff

Own `features/account-email`, new account email page/route, minimum auth factory
and local capture seams, own tests, additive Playwright registration, this
blueprint and scoped auth/tracker documentation. Public directory/catalog and
peer implementation stay read-only. Report Review and Verify separately, exact
commands/results, limitations and owned local artifact paths. Settled source is
handed off once through the injected task/dispatch lifecycle.

## Protective binding revision (source finding, 2026-10-12)

Recover note: `prompts/recovery/2026-10-12-account-email-proof-binding.md`.
Provider joins old/new addresses with a hyphen, so valid address pairs can
collide. Actor/address cookies alone do not isolate two legitimately initiated
flows. Prefer installed supported `verification.storeIdentifier` prefix custom
hash overrides, documented in [options](https://better-auth.com/docs/reference/options)
and observed in `db/verification-token-storage.mjs`/`internal-adapter.mjs`.
Keep default plain for existing reset/verification behavior. Only OTP current
and change-email prefixes use a fail-closed request-scoped server context: exact
actor, session, current email and new email. Validate the complete provider
identifier then HMAC a purpose-preserving, unambiguous tuple. Provider creation,
lookup, expiry, wrong-attempt recreation and atomic consumption all use the same
supported namespace; no additional identity, token, cookie, table or direct row
rewrite. Context unavailable or identifier mismatch rejects. Final proof becomes
bound to the exact original signed-in session, so reauthentication requires a
fresh confirmation. Prove two valid colliding flows in both request orders,
same/different sessions, cross-code attempts, wrong-code recreation, replay and
interleaved operations. Existing raw OTP routes remain closed; there are no
pre-existing plain OTP flows on this baseline. Provider legacy plain fallback is
explicitly guarded: the supported hasher performs a read-only existence check
for the complete plain identifier and rejects if present before returning the
transformed key. No deletion or rewrite is used to bypass a legacy record.
Check baseline absence and injected unexpected plain rows in real provider tests.

Installed `email-otp/utils.mjs::toOTPIdentifier` supplies exact full prefixes
`email-verification-otp-` and `change-email-otp-`; supported overrides and expected
keys use those complete forms. The first verification caught an omitted segment
and is retained in Recover/report; the corrected mapping preserves fail-closed
behavior and does not change the authorized design.

Production bundling refinement (AUTHORIZED — build-feature delegation):
`getAuthRuntime` caches its factory globally, so module-level AsyncLocalStorage
is unsafe across separate Next bundles. Create a private proof binding instance
inside that exact auth factory runtime, close over it in supported provider hash
configuration and expose its run method on the runtime for the service. This
keeps actual provider operations and scoped context coupled even with duplicate
module graphs. No global mutable request metadata or new identity/token store.
Same-agent re-review and separate repeated production browser verification are
required; preserve failed original browser/context evidence in Recover/report.
