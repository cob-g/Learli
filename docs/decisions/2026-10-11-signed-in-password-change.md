# Local signed-in password changes

Date: 2026-10-11. **AUTHORIZED — build-feature delegation** from the user's
actual request “ok lets do it and spawn agents what you need to spawn” and the
four-feature wave contract. This is delegated local execution, not separate
human blueprint approval or real-user launch authorization.

Verified active synthetic account owners can supply their current password and
a confirmed new 12–128-character password at account settings. Better Auth1.7.7
remains the sole credential/session owner. A narrow Learli POST boundary uses
its HTTP handler so provider origin, sensitive-session and persisted throttling
remain active. The exact internal change-password route is limited to five
attempts per minute using the existing trusted loopback client identity; the
raw provider route stays unavailable. Server always revokes other sessions,
forwards all Set-Cookie headers and strips the token-containing provider body.

Learli checks the current session's creation time against the installed provider
context's `freshAge` before dispatch. Installed 1.7.7 sensitive-session middleware
checks authoritative validity without checking age; this explicit local gate
denies stale sessions and directs a fresh sign-in back to account settings.

An immediate transaction advisory lock keyed by provider-resolved account ID
rejects concurrent changes through this boundary with a conflict, followed by a
fresh identity recheck before provider mutation. No new schema/grant, auth-row
lock or second password store. This does not serialize password reset or every
provider operation. Already authorized in-flight requests may finish after a
later access revocation, consistent with existing local permission semantics.

One nonblocking global provider-capacity slot precedes the account lock. This
keeps concurrent distinct account wrappers from holding all five pool connections
while Better Auth needs a connection from the same pool; excess requests return
409 and release promptly. It is a local technical capacity bound, not a quota
or commercial rule, and uses no new connection pool or runtime grants.

The provider may fail after changing a hash or deleting sessions. Unexpected
failure is an uncertain outcome, not a claimed rollback; existing sign-in/reset
provides recovery. Passwords/tokens are absent from logs, JSON/UI and sensitive
browser traces/screenshots. Only sanitized empty-password UI captures are saved.
The enhanced form requires JavaScript and says so when scripts are disabled.

Alternatives rejected: direct server API without demonstrated HTTP throttle,
broad raw auth-route exposure, optional session revocation and custom hashing.
No remote service, external mail, production, commerce, guardian/safeguarding or
real incident policy is enabled. Coordinator owns independent combined review.
