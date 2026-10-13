# W1 — Mandatory administrator MFA and recovery

Status: AUTHORIZED — build-feature delegation. Date: 2026-10-12.
Authority: explicit dispatched W1 end-to-end build with necessary own-worktree shared integration hunks, under accepted parent m8-10-hosted-workflows-wave.md (SHA256 cc8a9677aef73717494233d1493921a88c0a4aac03cdd087803dedf208b80014). No separate human blueprint approval.
Baseline: 2fa0294c5e6cad895754b3c10a703a6c6f6ef00a; branch cob-g/m8-admin-assurance.

## Outcome and mapping

AUTH-02/03/04, ADM-01/02/03/04, NFR-05; M2.3/5/7/9, M5.6, M8.8 (parent M8.10).
Verified active administrators may reach enrollment/security setup with ordinary identity, but every administrative private projection and mutation requires actual verified TOTP or provider recovery proof for the exact current session. Existing/password/reset/email/new-role sessions have no implicit assurance. Preserve case/target/review capabilities and self-review exclusions.

## Inspected foundation and decisions

Better Auth1.7.7 installed source: twoFactor pending credential sign-in deletes provisional session and clears newSession; verification creates a newSession via supported setSessionCookie, enrollment verification replaces current session, already enrolled session step-up uses context.session. Backup-code consumption uses atomic encrypted-prior-value incrementOne comparison; use provider API only.
Use twoFactor plugin with verification required, credential password required and encrypted backup codes; no OTP delivery, passwordless option or trusted-device bypass. Generate plugin schema with installed auth CLI; additive migration0022 only, immutable0000–0021.
Minimal app security epoch and session receipt contain user/session/factor IDs, epoch, admin grant timestamp and verification method/time only. Predicate uses current persisted provider user/session, active verified account/admin role, exact factor verified+enabled, equal epoch/grant and bounded DB time. Default8-hour assurance, fresh5-minute proof for factor changes are technical security limits; root delegated routine choices.
Runtime-owned scoped provider dispatch retains HTTP rate limits and all Set-Cookie. Supported before/after hooks deny direct unscoped MFA endpoint calls; serialize bounded MFA operations with nonblocking advisory capacity lock and finally release. Commit epoch invalidation before provider enrollment/rotation/disable; proof captures epoch/factor/grant before verification and compares again before receipt insert. Uncertain writes deny access; provider transitions need not be globally atomic to fail closed.

## Scope and implementation

1. Add provider composition/hooks and minimal runtime-compatible assurance API/SQL predicate; publish concrete contract early.
2. Generate installed provider schema; add epoch/receipt/minimal audit schema, cumulative0022 snapshot and journal, exact local grants. Forward-replace only necessary protected SQL admin function checks, preserving all historical bytes.
3. Require assurance at role guard, final admin SQL projections, post-lock rechecks and existing narrow SQL functions. Keep ordinary identity/account workflows unchanged.
4. Provide manual authenticator enrollment, transient codes, TOTP/recovery challenge, password+fresh-factor code rotation and disable/replace controls. Handle twoFactorRedirect before admin navigation; no secret SSR/storage/URL/telemetry or screenshot evidence.
5. Test actual provider+owned PG, direct endpoints, backup race, stale actors after locks, partial writes, exact scopes. Update fixture helpers using real provider enrollment/verification only; no runtime bypass or assurance direct insert.

## Verification and ownership

Same agent sequential Architect → Implement → read-only Review → separate Verify → Recover as required → Remember; no nested workers. Required npm run check, actual PG suites, production build, ordinary discovery of W1 Playwright, enrollment/signout/challenge/TOTP/scoped operation/recovery reuse/rotation/disable,320/390/1440 keyboard/axe/overflow and account-switch/Back privacy. Fresh and populated0021→0022 row/hash/grant/protection preservation proof. Owned PG55901/dev3091/browser3191/disposableTLS56001/HTTPS3291; no main/peer config or credentials. Heavy leaseB granted by coordinator. Privacy-safe evidence in ignored .local/hosted-readiness-wave, freeze tracked+untracked/shared hashes after final review/verify.
Shared hunks include auth factory/options/client/handler/schema generator/generated schema, permission guards/rechecks/admin services/queries/functions, account/MFA routes/forms, schema exports/grants/migration harness, fixture helpers/discovery and governing docs. Root reconciles/imports final shared changes and independently reviews/verifies combined state.

## Recovery and operational gates

Backup codes remain provider single-use with at most one concurrent success. All factor changes require current password and fresh appropriate factor proof, except first enrollment which has no previous factor. Disabling invalidates all assurance before provider operation; re-enrollment requires real password/TOTP, never privileged password-only access. Lost password plus every factor/code has no automated administrative bypass; named owner-controlled deliberate recovery remains operational requirement. No provider record rewrites, production operations, external mail, commit/merge/push/deployment/cleanup, payments or real-user launch.
Verification status: NOT RUN — architecture stage only. Blueprint ready.
