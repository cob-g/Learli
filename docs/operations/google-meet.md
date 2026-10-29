# Optional local Google Meet integration

Blueprint: `prompts/features/m5-01-google-meet-provisioning.md`.
This is an optional local-only integration. Default development, build and test
commands do not start a worker. Preserve manual Zoom/Meet links and all existing
booking/history rows. Never configure production credentials or real learner data.

## Preparation and authorization

1. Apply reviewed migration `0040_google_meet_provisioning.sql` only to an isolated
   local target, using the existing guarded migration workflow. Development data
   is preserved; running a production migration is not authorized.
2. Keep the ordinary local workflow configured as documented in `local-workflow.md`.
   The application still uses `learli_app`; do not give it owner/worker credentials
   as its application DATABASE_URL. The worker uses `learli_meet_worker` and only
   scoped functions, without direct table access.
3. At an explicit local owner setup, `npm run meet:prepare-worker` enables LOGIN
   for a dedicated role (creating it with NOLOGIN first if absent), grants only
   scoped function/schema rights and development DB CONNECT, and writes
   an owner-only ignored `.local/google-meet/worker.env`. It refuses an existing
   file or already-login role. Do not rerun to rotate/reset credentials; diagnose
   an interrupted setup first. It does not call Google or start services.
4. A separately authorized operator sets up a Google Cloud project, Meet API and
   OAuth web client/consent screen with dedicated test users. Register the exact
   loopback callback. Public external OAuth requires applicable Google verification.
   Use the separately owner-approved test host. The bounded personal-Gmail
   experiment is approved in the supplemental blueprint; neither OAuth success
   nor API enablement establishes meeting-creation/account-tier compatibility.
   No account purchase is implied.
5. Supply private values in `.env.local`, outside Git:
   `GOOGLE_MEET_ENABLED=true`, `GOOGLE_MEET_CLIENT_ID`, `GOOGLE_MEET_CLIENT_SECRET`,
   `GOOGLE_MEET_REDIRECT_URI` (exact APP_URL plus
   `/api/tutor/meeting-providers/google/callback`), `GOOGLE_MEET_KEY_ID`,
   `GOOGLE_MEET_KEYS` (JSON map of key ID to independent 32-byte hex key), and
   `GOOGLE_MEET_WORKER_DATABASE_URL` from the private worker file. No public env
   variable contains a credential. Never paste these values into chat or logs.
6. `npm run dev:meet` validates configuration and restricted role before starting
   Next plus its supervised worker, on the same validated local database target.
   Each child receives only its required database credentials: Next gets no worker
   URL, and the worker gets no app database credential or Better Auth secret.
   Failure of either child stops the pair. Only
   use this command once provider calls with a dedicated test host are authorized.

Schema migration neither creates nor activates a cluster role. Worker role/grants
are installed only by explicit local operator setup, so a normal Neon schema owner
needs no CREATEROLE privilege. This local feature does not alter Railway
configuration, enable hosted public workflows, or add a deployed worker service.

## Normal operation

Tutor → Meeting setup → explicit future-booking consent → Connect Google account.
A fresh Learli session is required (also rechecked in SQL with a 24-hour maximum).
Google authorization is separate from Learli sign-in and tutor screening. New
eligible confirmed ordinary-local bookings get a job; old bookings remain manual.
There is no child/parent Google connection and no Calendar invitation.

The worker polls every 15 seconds with batches capped at ten and serial provider
calls. Claim leases are 60 seconds; provider calls time out after ten seconds.
One connection's refresh/create sequence is serialized across workers. State and
lease checks precede dispatch and installation; no HTTP occurs with domain locks.
Preparing/ready/action-required statuses are independent of confirmed booking state.
Refresh the private booking to reread its saved link/status. The tutor can supply a
manual link at any time; automation never overwrites it.

Google external testing-mode refresh grants with Meet scope normally expire after
seven days. Revocation/expiry shows reconnect-required; it does not invalidate the
booking. Same-account reconnect can retain an omitted refresh token; selecting a
different account requires explicit replacement and a new valid grant.

## Failure handling and recovery

- No dispatch: bounded safe retry/reclaim (maximum five attempts). Clear rejection
  such as quota can back off; reconnect is required for invalid refresh grants.
- Dispatch may have succeeded without a durable result: **uncertain**. Do not reset
  to pending or rerun create manually. Use the normal manual link form. Google may
  retain an unused space; there is no stable list/delete recovery API here.
- Known durable result: resume attachment of that same result after current checks.
  Never create a fresh room solely because a database acknowledgement was lost.
- Cancellation/replacement/expiry/eligibility revocation or a concurrent manual link
  suppresses installation. A late known receipt is private operational state, not
  permission to publish it. Rescheduling has a new physical booking and job.
- Disconnect removes active local credentials and fences in-flight jobs first;
  provider revocation is best effort. If not confirmed, the tutor removes access
  in Google's account-permissions settings. Existing saved links/bookings remain.
- A copied link may remain usable outside Learli. Do not end an active conference
  as cancellation/cleanup. Restricted admission still requires host vigilance and
  does not implement a Learli-user allowlist or universal recording controls.

For emergency disable, stop the explicit launcher and set GOOGLE_MEET_ENABLED=false.
The normal app/manual links stay usable. Keep additive schema, receipts, history,
new readers and decrypt keys. Do not automatically down-migrate or run an old build
which assumes every link edit has a non-null human actor. Key rotation supports an
active key ID plus retained old decrypt keys; reconnect reencrypts the credential
under the new active key. Removing old keys needs deliberate retention/recovery review.

If ordinary Next startup has incomplete or invalid enabled Google settings, the
authorized missing-link view reports action required and keeps the tutor's manual
form available. Existing links remain readable. Only configuration parsing is
isolated here: database errors and current authorization denial still fail closed.
The explicit automatic launcher and provider configuration validation remain
strict; this fallback does not authorize provider work with invalid settings.

## Privacy and verification

Do not log callbacks/query strings, codes, tokens, provider bodies, space names,
private links, Google account labels or learner details. Next already disables
incoming request logging; a future proxy must also redact callback queries. Worker
output contains only bounded safe counts and generic failures. Browser data never
includes ciphertext or credentials. Connection labels are owner-only.

For focused browser checks, use `npm run test:e2e -- --config playwright.meet.config.ts`
against the prepared isolated test DB; it reuses the main app tests and starts
the current development source without unrelated hosted mirror servers. Production
build verification is a separate required check.

Automated tests use synthetic accounts, isolated PostgreSQL and fake provider
transports. `with-test-env` explicitly disables provider config. Live OAuth/code+
PKCE, host admission, account compatibility, provider settings and actual joining
require a separately authorized dedicated-provider test; never infer these passed
from unit/integration/browser tests. See progress tracker for actual evidence.

Primary documentation: [Meet create](https://developers.google.com/workspace/meet/api/reference/rest/v2/spaces/create),
[OAuth scopes](https://developers.google.com/workspace/meet/api/guides/authenticate-authorize),
[Google account prerequisites](https://developers.google.com/workspace/meet/api/guides/quickstart/nodejs),
[OAuth token expiry](https://developers.google.com/identity/protocols/oauth2).

## Local acceptance snapshot — 2026-10-27

The approved personal-account OAuth flow completed and persisted an encrypted
connection with exactly the identity/email and app-created Meet scopes. The
callback supports Google's optional authorization-response `iss`, accepts only
`https://accounts.google.com`, and rejects duplicate/wrong issuers before exchange.
State/session/browser binding, S256 and ID-token nonce validation remain intact.
Reference: [Google OpenID Connect reference](https://developers.google.com/identity/openid-connect/reference).

This proves the tested account's OAuth connection only. In a later explicitly
owner-approved24hour synthetic local screening exercise, the fictional Tutor was
approved through the assigned MFA-confirmed Admin UI and one ordinary Parent
booking was confirmed. The sole live CreateSpace request returned HTTP403, also
visible in Google Cloud metrics with the API enabled. The job is blocked with
`create_rejected`; no private link was saved. The original request did not retain
the exact provider reason, so account-tier compatibility remains unknown.
Do not infer that purchasing Workspace will resolve this. Do not reset/replay this
job or create extra bookings to obtain a success; diagnose before controlled retest.
Effective restricted meeting settings and real joining remain NOT VERIFIED. The
synthetic receipts expire2026-10-28T07:10Z and do not establish real tutor screening
or a general expiry policy. Existing bookings are not backfilled. No production,
billing/publication or provider redesign action is implied.

## Safe rejection diagnostics

The local worker may report HTTP status plus a finite recognized Google status and
ErrorInfo reason. Provider messages, raw bodies, metadata, account labels, tokens,
IDs and links are discarded. Error reads share the10second request deadline and
64KiB limit; malformed/unknown data is UNCLASSIFIED. Reporting failure cannot
alter job persistence or retry rules. This does not enable requeue or retry.
The earlier test booking is now ended and cannot be retried. A separately
owner-approved future booking was created through the normal Parent UI on Oct27
for Oct28,10–11AM Manila after automated checks passed. Its sole creation attempt
returned HTTP403/PERMISSION_DENIED with UNCLASSIFIED reason. No space/link saved;
job blocked/create_rejected/attempts1. Both bookings remain confirmed and history
is preserved. Parent/Tutor views agree and retain manual fallback. Exact account,
project or provider-policy cause remains unknown; do not assert that buying
Workspace fixes it. No further retry, purchase or provider redesign is authorized.
