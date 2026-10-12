# Local verified account email change

Authority: **AUTHORIZED — build-feature delegation**, 2026-10-12 dispatched
AUTH-02/03/04 M2.9 request. Coordinator decisions `msg_d0add227a860` and
`msg_d48887510451` authorize current/new code confirmation and supported
identifier binding. No separate human blueprint approval is claimed.
Blueprint: `prompts/features/m2-09-verified-account-email-change.md`.

Installed Better Auth1.7.7 emailOTP owns current-address verification, five-minute
hashed codes, attempt limits, new-address verification and atomic consumption.
The Learli private boundary requires current active verified owner/session and
configured freshness at every step, uses real provider HTTP middleware and
normalizes trusted local IP. Core/raw OTP endpoints remain closed. Existing
verification/reset/password/own-session behavior stays intact.

Provider old/new concatenation is ambiguous for valid email pairs. Supported
`verification.storeIdentifier` overrides namespace only the two OTP prefixes
using a server-secret HMAC of a complete, purpose-specific, unambiguous tuple:
trusted owner/session/current/new addresses plus the full provider identifier.
AsyncLocalStorage isolates actual awaited requests. Missing/mismatched context
fails closed. The hasher read-only rejects any matching plain row because the
provider supports legacy plain fallback. No custom identity/proof/token store,
flow cookie, auth-row rewrite, schema or dependency change is introduced.
Existing unrelated identifiers retain default plain storage.

The binding object belongs to the actual auth runtime and is captured in its
hasher closure; the service enters that same runtime object's context. Separate
Next bundles cannot substitute a module-level context instance. Original failed
production browser evidence and corrected verification remain in Recover/report.

The new address stays pending until final provider verification. A duplicate
target gets the same generic pending response; the UI never promises capture
exists. Final mutation retains the current session and explicitly calls provider
revocation for all other sessions. Failure after email mutation is partial/
uncertain, with no rollback claim or blind retry; native account/session recovery
reads actual saved state. Full success replaces the document with `/account`.

Capture remains owned private local files only, with token-free account navigation
and transient masked code-entry fields. Addresses are synthetic `.test`, without
introducing a new address policy. Production delivery, real users, deletion,
OAuth, MFA, migrations and deployment remain out of scope. Recover preserved
the provider binding discovery separately; Review and verification are recorded
separately in the worker report/tracker.
