# Local provider error privacy

Authority: **AUTHORIZED — build-feature delegation**, integration request and
coordinator reply msg_751cd42ed21c on2026-10-12. This is a scoped technical repair,
not separately human-approved product policy or launch clearance.

Observed production browser's deliberate email-revocation failure caused installed
Better Call to log a raw Drizzle Error containing a generated synthetic session
token, despite Better Auth logger.disabled. A diagnostic excerpt exposed it in
tool output. The exact integration-owned fixture session was revoked through the
existing provider-backed own-session endpoint; original log hash and sanitized
failure history are retained. Earlier tool output cannot be retroactively removed.
No main/peer, live user, external credential or direct auth-row rewrite occurred.

Installed Better Auth1.7.7 invokes onAPIError.onError synchronously; Better Call
catches a synchronously thrown APIError before its unknown-error console fallback.
The local auth factory now converts unknown HTTP errors to a fresh safe APIError500
through this supported hook, preserving known provider APIError/status behavior.
No raw cause/payload, global console replacement or node_modules change is used.
Email writes and revocation remain provider-owned; partial revocation still reports
uncertainty without claiming rollback. All proof, session, origin, throttle and
permission checks remain. See [official options](https://better-auth.com/docs/reference/options#onapierror)
and the integration Recover note for exact evidence and separate execution.

Verification requires real injected provider failure with zero unsafe logging,
committed-email/uncertain-session assertions, unchanged full auth/PG/browser/build
regressions and final privacy scan. Scanner classifies token/code parameters as
secret; validated token-free public callback paths remain public. The original
failed scan, containment receipt and source provenance are preserved locally.
