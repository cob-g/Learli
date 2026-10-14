# Reduce local preview round trips

Authority: AUTHORIZED — build-feature delegation, 2026-10-14, owner's request
to fix the diagnosed slow local preview. Blueprint:
`prompts/features/m8-09-local-preview-performance.md`. No production change.

The local application reads a remote Neon development database. Diagnostic
round trips were about 50 ms; the original wrapper used three sequential
verification queries before each ordinary read. A warm two-query public catalog
took 433–442 ms, excluding browser work. A cold connection cost about a second.

Retain all transport/target/identity/privilege predicates and check them on
**every checkout**, in one statement instead of three. Native TLS inspection
still precedes SQL; absent/unsafe results fail closed. Connection cleanup remains
mandatory, with the convenience pool query awaiting cleanup so sequential reads
reuse the socket. Explicit transaction leases keep their release interface.

Public tutor and subject reads run concurrently and retain the existing truthful
eligibility filter and all-or-unavailable response. Account access status and
trusted role grants use one current left join, preserving no-role accounts and
all domain authority checks. Admin page setup delegates its identity check to
the existing guarded security read rather than doing the same check twice.
No session, permission, catalog or booking result is cached across requests.

The existing browser visit time-zone preference gains a session cookie containing
only a validated IANA zone. A client initializer sets it before profile navigation.
Profiles prefer explicit URL, then current authenticated account zone, then visit
cookie, then the labelled tutor fallback. Native/no-script behavior and the
first-direct-visit browser correction remain. Higher-priority choices avoid
unnecessary session/teaching-zone reads. The cookie is never an authorization,
account-setting, consent, or booking fact. It uses Path=/, SameSite=Lax, Secure
on HTTPS, no Domain and no persistent expiry. Invalid values are ignored.

Time-zone display reuses up to 512 Intl formatters but calculates the offset for
each actual date; it does not cache DST-dependent offsets or change scheduling.

Alternatives avoided: once-only security checks, shared private-data caches,
weakening MFA/session validation, switching the owner's database or adding a
service. Actual verification/performance evidence belongs in the tracker. No
promised production latency or change to launch/business policies.
