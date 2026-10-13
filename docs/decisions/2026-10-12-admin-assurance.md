# Mandatory administrator MFA and controlled recovery

Date2026-10-12; authority AUTHORIZED — build-feature delegation for explicit W1
software task and accepted hosted-readiness parent. No separate human blueprint
approval, production operation or real-user activation.

Use installed Better Auth1.7.7 TOTP/backup-code plugin and supported request hooks,
HTTP handler/session APIs; generate provider schema with installed tooling.
Require current8h assurance for every administrative read/action, exact session/
user/factor/epoch/admin-grant binding;5min proof for enrolled factor changes.
Password success, reset/email and new role grants never assure a session. Keep
existing exact tasks, assignment/capability and self-review protections.

A runtime-bound scoped dispatch serializes provider MFA operations and limits pool
capacity with nonblocking advisory lock; no native Pool requirement. Provider
hooks record receipt only after actual verification and current SQL recheck.
Before factor mutation, actual password plus current fresh factor proof (except
initial enrollment) precedes committed epoch invalidation. Provider partial writes
and receipt/audit failure deny privileges with explicit safe recovery; all provider
Set-Cookie values survive. No ad hoc provider mutation, secret copying/logging,
email/SMS/passwordless or trusted-device bypass, external QR service or dependency.

Recovery codes are provider single-use and rotation invalidates old assurance.
Disable followed by password-required enrollment and verified replacement factor
never creates privileged password-only access. Other sessions are revoked via
provider. No automated recovery for lost password plus all factors/codes. Before
real staffing, a named owner must define identity evidence, deliberate recovery
review, audit/revocation and re-enrollment under an approved operational runbook;
this software task supplies no owner bypass endpoint or direct credential reset.

Alternatives rejected: enrollment boolean/session-age/password-only admin guards;
app-owned TOTP/code credential store; UI-only boundary; email or trusted-device
fallback. Additive0022 preserves historic schema/data. Disable new admin access
paths for rollback; restore only an owned rehearsal or separately authorized
operation, never destructive down-migrate real records.
