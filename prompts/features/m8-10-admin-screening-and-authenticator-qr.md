# Admin tutor screening access and authenticator QR

Status: AUTHORIZED — build-feature delegation, 2026-11-10. The user requested
all Admins be able to claim and approve tutor reviews for the initial workflow,
and a scannable authenticator QR during setup. This is not a separately reviewed
blueprint. Primary M8.10 / ADM-01, TUT-01; related M2.9 / AUTH-02–04.

Scope: the ordinary local workflow only. Active, verified Admins with current
MFA can see unassigned local tutor-screening metadata, claim one request and
review that exact assigned case without a separate screening staff entitlement.
Preserve existing source isolation, self-review denial, current policy and
evidence, assignment, audit, account status, MFA and other capabilities. Preserve
non-local and explicitly revoked screening restrictions. No real launch approval.
Admin authenticator enrollment displays a locally generated QR for the provider's
TOTP URI, retaining the manual key and existing confirmation and recovery flow.
The URI and key must not reach external QR services, logs, storage, URLs, or caches.

Implementation: review and amend database-owned local screening authorization,
claim and current-receipt predicates with a forward migration; do not expand
other staff capabilities. Preserve existing staff/revocation records and current
assignments. Carry the provider's TOTP URI only in the private enrollment response
and document memory; render QR locally with an established pinned library. Handle
invalid/missing URI and QR failure with the existing manual fallback. Update
applicable architecture, PRD, decision, and progress evidence.

Verification: isolated actual PostgreSQL integration for eligible Admin with no
screening staff, current MFA, assignment/decision and non-admin, suspended,
unverified, self-review, revoked staff, non-local and unrelated-capability denial.
Verify concurrent claims and no cross-actor access. Auth tests and browser
enrollment must prove QR encodes the actual provider URI, works with a TOTP app,
preserves manual entry and never transmits the URI to a third party. Run relevant
lint, typecheck, tests and build, plus narrow/wide UI checks. Production deployment
and production migrations require separate authorization.
