# Learli Recovery — Private-preview registration feedback

- Status: DRAFT — diagnosis only; exact submitted request still unknown.
- Mode: Targeted Fix for feedback; preserve the intentional finite audience.
- Environment: selected local private fictional preview, localhost port3200.
- Related scope: M8.3 / AUTH / `m8-03-manual-persistent-booking-preview`.

## Observed and established

The owner reported the Create account message “We couldn't confirm that your
registration request finished. Try again, or sign in if you already have an
account.” The active preview responds to its health endpoint. A read-only owned
local database inspection found only the five prepared accounts, with no
additional account beyond that set. This does not identify the submitted email,
URL, response status or whether the screenshot used this exact origin.

`AuthForm` shows this fallback for unknown provider codes/statuses and thrown
requests. `handleAuthRequest` requires the exact configured Host/Origin and
rejects a submitted email when `permitsAccountEmail` refuses it.
`permitsAccountEmail` intersects valid `.test` addresses with the private packet's
finite audience. Therefore `.test` format alone does not authorize registration.
The same preflight400 message and generic UI fallback do not explain that boundary.
The normal private security browser suite previously observed duplicate prepared
signup returning the same safe200 receipt; duplicate signup is not established
as this screenshot's cause.

## Unknown / requested information

The owner was asked whether this used an existing supplied account or a new
fictional address, and for the page origin/path without query parameters.
No answer has arrived yet. No runtime reproduction is claimed.

## Recommended recovery

For prepared identities, use Sign in; do not create them again. For a new test
identity, confirm its fictional email and request origin first. Preserve the
finite audience; do not silently admit arbitrary addresses or real users.
If the request hit the known admission boundary, give safe private-preview
registration guidance without listing approved emails or exposing account
existence. Preserve hosted authentication's enumeration, origin and CSRF
protections. If a genuinely new fictional identity is requested, prepare its exact
scope deliberately without replacing policy heads or extending expiry implicitly.

An implementation owner may apply a scoped feedback correction after actual
request classification. Separate verification must cover allowed signup,
restricted fictional email, invalid origin, network failure and duplicate-safe
feedback using isolated synthetic data. Do not run fixture/reset suites on the
long-lived manual database. Existing accounts, MFA, bookings and all unrelated
uncommitted work must be preserved.

Recover changed only this note. No source, test, environment, packet, account,
booking, provider, service or Git mutation was performed. No fix/verification
success or actual per-request root cause is claimed.
