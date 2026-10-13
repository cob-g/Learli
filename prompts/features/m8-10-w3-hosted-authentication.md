# Implementation Plan — W3 hosted synthetic authentication

Date: 2026-10-12. Owning package: **M8.10 / W3**, with M2.3–M2.9,
M8.3/M8.8/M8.9. Status: **AUTHORIZED — build-feature delegation**.
Blueprint ready. **Architecture only; implementation and verification NOT RUN.**

## Authority, checkout and handoff

The owner authorized the eight-area software wave under root coordination, using
GPT-6.1 Sol High builders and actual Playwright flows. This blueprint is the
delegated Architect stage, not separate human blueprint approval, real intake
permission, or permission to execute during this dispatch. Root later dispatches
Implement → read-only Review → separate Verify → Remember with Recover for defects.

Checkout: `/Users/cob/orca/workspaces/learli/m8-hosted-auth`; observed branch
`cob-g/m8-hosted-auth`, HEAD `2fa0294c5e6cad895754b3c10a703a6c6f6ef00a`, clean
before the two prompt additions. No proposed new branch is needed.
Parent: `prompts/features/m8-10-hosted-workflows-wave.md`, exact SHA-256
`80e76571d47f2d4c9ad51467e58c5cc87587f5ca5cabedde770dd6f6c0bbb610`.
The copied parent remains unchanged. Root's decision refinement supersedes its
hypothetical generic R0: actual AuthRuntime and feature-owned composition only,
without a generic policy engine or activation-receipt prerequisite.

Authoritative decision inspected in root integration:
`docs/decisions/2026-10-12-hosted-workflows-software.md`, SHA-256
`08f4c7b4e77ce96fd1defbb1a5cf63890a85f8fabed458d3dd2bef35a83351eb`.
Eventual ownership comes from root `/Users/cob/learli/.local/hosted-readiness-wave/`
`w3-spec.txt` and `w3-ownership-followup.txt`, respectively SHA-256
`e8294c5966a94416e21ae1c666bb45e39889622e9bbd44ef41ececfe236fe1b1` and
`c3c7f1e8bba4427bdbbb066e19304e73b797ea487e7195c5060ca53e6da5c121`.
These files grant no current code edit/execution permission.

Read AGENTS.md, ORCHESTRATION-LESSONS.md, the eight canonical contexts in their
required order, this prompt/parent, root's current decision, and the applicable
repository-source skill at each stage. Never substitute mixed-case context copies.
Current context records verified local functionality, not hosted acceptance.

## What we are building

An explicit staging-only hosted-synthetic account experience: approved fictional
accounts register, verify, sign in/out, reset credentials, complete administrator
TOTP/recovery, manage their own settings/sessions/password/current-new email proofs
over an exact HTTPS origin. Actual application routes/forms select the composed
runtime. The same provider and guarded database paths are exercised in an owned
local TLS/HTTPS app with real PostgreSQL and supported fake SDK transport. Existing
HTTP local demonstrations keep their current factory, mailbox and boundaries.

PRD: AUTH-01–AUTH-05, NFR-01/02/05/06/09/11; prerequisite use of W1 mandatory
assurance for ADM-01/03/04. OPS-04 applies to account callbacks only. This does not
complete any entire requirement, M2, M8, real-provider acceptance or launch gate.
Terminology needs no further clarification: synthetic account membership is an
operator-selected test set, email proof establishes address control only, provider
acceptance is not delivery, and factor enrollment is not administrator assurance.

Included: concrete config/runtime selection, ingress, provider composition, account
callback wiring, safe selected-runtime account/MFA UI, ordinary test discovery and
complete synthetic harness. Excluded: live/cloud sends, provider operations, env or
global TLS changes, payments, real participants, business-policy activation, new
dependencies, producer edits/imports during Architect, deployment/commit/merge/push.
W4b owns durable booking delivery; W5–W8 own their workflows. No new W3 schema or
migration is expected; accepted W1 auth schema/migration/grants are prerequisites.

## Actual existing-file contracts and source dependencies

| Existing evidence                                                                                                                                                                                                   | Consequence for W3                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/auth.ts`: synchronous local-only singleton; `auth-factory.ts`: `createLocalAuth(source)` returns native Pool, Database, provider, origin, development/test environment and runtime-owned emailProofBinding | Preserve this synchronous local entry and exact inferred local Pool typing; add an awaited account/auth selector, sharing the very same local singleton |
| `auth-options.ts`: provider cookies, disabled cookie cache, persistent rate limits, explicit origin/CSRF checks and x-learli-local-ip                                                                               | Merge hosted overrides deeply; never accidentally drop existing session/password/rate/security options                                                  |
| `auth-handler.ts`: bounded JSON, explicit HTTP route/field allowlist, local Host/Origin validation, overwritten loopback IP                                                                                         | Preserve local behavior and add selected-mode account request validation; never broadly open every provider endpoint                                    |
| `account-password/service.ts` and `account-email/service.ts`: internal HTTP dispatch plus loopback IP assignment, account/capacity advisory locks, fresh identity recheck                                           | Replace only provider-header construction with the consumed selected-runtime sanitizer; HTTP provider throttling stays active                           |
| `account-sessions/service.ts`: supported list/revoke API and safe device/time/id DTO                                                                                                                                | Preserve exact owner/freshness projection and no token/IP/raw-UA disclosure                                                                             |
| `permissions/workspace.ts`: local-only private-page loader; AuthFrame requires local mode                                                                                                                           | Account/security pages need a separate awaited account loader; unrelated domain pages retain local-only loader                                          |
| `features/auth/document-boundary.tsx`, successful sign-in/out native replacement and email completion replacement                                                                                                   | Preserve entire document-lifetime privacy across revoked cookies, failed sign-in and Back                                                               |
| `scripts/with-test-env.mjs`: APP_ENV=test and AUTH_MODE=local; staging-config.ts opaque strict Neon staging target/TLS parser                                                                                       | Neither becomes a hosted test runner or admits loopback staging configuration                                                                           |

W2 accepted source inspected in integration and producer report:
`createHostedRuntimeDatabase(config: StagingDatabaseConfig): Promise<{ db:
Database; pool: HostedRuntimePool; close(): Promise<void> }>`; both runtime files
are frozen at `0edc86f3f64dd6ef2a4c54bb6e67d278c9ee8db7616a6b694414dbeec3450b04`
and `dd3d850669e7b453c640f1ce333547398ec1adaa621ff28f864e4f34ba6fc43e`.
The guarded pool is structural, never native Pool; its verified checkout,
transaction cleanup, safe SQLSTATE/constraint errors and minified constructor
handling remain producer-owned. Do not add a second cast-to-Pool at this consumer.

W4a inspected `createAuthMessageConstructors({ appOrigin, identitySecret })` and
`createResendTransport(configuration?, testing?: {fetch, now?})`. Runtime file
hashes: `e25b582a0e5a7ddda026645d665eb6dfd1abeb825562e17661ab41be34fd91d3`
and `eb10eea200bc8c822c77779ad3ef88aeb10db83b394e87fd4cf5063543d57d07`.
Transport test injection is supported only when its configuration.environment is
`test`; it is not available in the staging application factory. Its safe union is
accepted/retryable/rejected/uncertain and its SDK endpoint is fixed.

W1 core-v2 independently accepted fifteen-path manifest:
`/Users/cob/orca/workspaces/learli/m8-admin-assurance/.local/hosted-readiness-wave/core-v2.json`.
Inspected `adminTwoFactorPlugin()` and **`createAdminSecurityProvider(db)`** returning
`{plugin, run}`; no Pool argument exists. The actual runtime holds adminSecurity
alongside emailProofBinding; both closures travel with that runtime across bundles.
W1 ordinary assurance is 8h, fresh factor changes 5min; preserve actual provider
checks and receipts, rather than implementing new proof rules. The full W1 UI/test
delivery still awaits final verification. Do not import, edit or execute producer
files now; implementation starts only with root's final accepted combined bundle,
including W1 account/security and pending two-factor routes/forms/client changes.

## Explicit configuration and default denial

Proposed feature-owned `config.ts` performs pure validation; `config-file.ts` loads
one explicit private JSON file without loading dotenv or operator/migration code.
Extend server env with `AUTH_MODE=hosted-synthetic`, `HOSTED_AUTH_CONFIG_FILE` and
`HOSTED_INGRESS_SECRET`; all unset by default. The latter is an independent random
32–512-character server-only secret, different from BETTER_AUTH_SECRET. This is
internal ingress authentication, never identity/guardian/policy evidence.

Hosted mode requires APP_ENV=staging; APP_URL and explicit BETTER_AUTH_URL must be
identical canonical HTTPS origins (string === URL.origin). Reject credentials,
paths including trailing slash, query, fragment, wildcards, whitespace/control/
backslash forms, IP literals, loopback, localhost and `.localhost` hosts. Require
BETTER_AUTH_SECRET 32–512 chars, no DATABASE_URL/DATABASE_URL_DIRECT fallback,
and no migration credential in this packet. APP_ENV=production always refuses
hosted-synthetic before any connection/send. Disabled remains the shipped default.

Exact proposed packet, strict unknown-key rejection:

- `version: 1`, `purpose: "hosted_synthetic"`, `realIntake: "disabled"` literals.
- `accountEmails`: 1–100 unique canonical lower-case valid mailboxes, each passing
  the existing syntheticEmail `.test` rule. This is an explicit test allowlist,
  not legal consent or permission to send to any real person.
- `STAGING_DATABASE_URL`: restricted runtime URL; `target`: existing exact
  ApprovedStagingTarget shape. Call stagingDatabaseConfig with appEnv staging,
  purpose runtime; require learli_app and approved runtime purpose. Do not copy
  its schema, relax registration or use main's Neon production branch.
- `ingress`: `mode: "disabled"` by default, or `"trusted-proxy"`; exact literal
  IP `trustedPeerAddresses` (1–16, no broad private subnet/wildcard); `clientIp:
"shared-bucket"` default or `"overwritten-single-header"` (one overwritten
  `x-forwarded-for` literal, never a chain). The enabled contract
  also requires `httpsHeader: "x-forwarded-proto"`, value exactly `https`.
  Activating a real platform contract requires independent ingress evidence.
- `mail`: `{mode:"disabled"}` default or `{mode:"resend-single-attempt",
transport: ResendTransportConfig, identitySecret: 32–512 chars}`. Validate using
  the actual accepted W4a configuration contract, require staging environment,
  exact appOrigin, bounded recipients equal to accountEmails, and the exact
  sender/environment/origin attestation. Never infer enabled mail from API key.

Read only an explicit absolute file under this checkout's private `.local` tree:
bounded <=64KiB regular file, owned by current uid, no group/other bits, symlinks
refused via O_NOFOLLOW/fstat, owned non-symlink private ancestors. Reuse the design
of scripts/staging-database.ts's readPrivateJson, without importing that CLI and
its migration dependencies into request code. Hosted packaging must arrange its
private mounted file deliberately; do not chmod shared directories automatically.
Errors contain fixed fields/codes only, not values, filenames or credentials.
An absent/disabled ingress denies hosted account requests before auth/database use
where possible; disabled mail permits existing sign-in/session operations but
registration/verification/reset/email proof requests disclose service unavailable.

At raw HTTP input and provider user-create/session hooks, require allowlisted test
membership. On email change require both current and proposed address membership.
No public role parameter, arbitrary real signup, unlisted `.test` address, or
existing nonallowlisted identity can enter the hosted account runtime. New users
receive only existing user_access/audit records and **no roles**. Tests grant roles
through isolated owner tooling only. Keep existing local `.test` registration.

## Runtime selection, types and failure handling

Keep `createLocalAuth(source)` synchronous and export `LocalAuthRuntime =
ReturnType<typeof createLocalAuth>` with native pool inference intact. Local
tests/integration/support.ts's World.runtime and tests/integration/auth.test.ts
must use that precise local type if the common AuthRuntime alias is generalized.
Do not widen local owner/fixture functions accepting native Pool, pool.options,
or pg Submittable APIs. The concrete common AuthRuntime is LocalAuthRuntime |
HostedAuthRuntime, with exactly consumed provider/db/origin/environment/proof/
admin-security members; hosted pool remains HostedRuntimePool. Prefer omitting
pool from a narrow service argument when unused, not inventing a generic runtime.

Proposed `composition.ts` constructs the actual Better Auth provider from typed
Database, concrete origin/environment, runtime-owned proof closures, selected
account membership and selected mail callbacks. Local createLocalAuth retains
its local database creation and capture behavior while sharing only provider
composition that is truly duplicated. Hosted `factory.ts` validates config,
awaits W2, then composes provider; close W2 on any subsequent composition failure.
Include adminTwoFactorPlugin(), createAdminSecurityProvider(db).plugin and existing
emailOTP plugin, with identical identifier hashing/binding and safe onAPIError.

`auth.ts` retains `getAuthRuntime(): LocalAuthRuntime|null` for existing local
domain consumers. Add `getAccountAuthRuntime(): Promise<AuthRuntime|null>`:
disabled => null; local => the exact same getAuthRuntime object; hosted-synthetic
=> one process singleton initialization Promise shared by simultaneous account
route/page calls. Store both pending and fulfilled state on existing globalThis
singleton ownership; never launch a duplicate local factory/pool. Bind successful
and pending state to mode plus a private configuration fingerprint; config change
requires restart and denies reuse of stale credentials. Failed initialization
awaits pool cleanup, clears only that same pending attempt, returns/throws a fresh
safe availability error, and permits later retry with a 1-second bounded cooldown.
No raw cause, abandoned Promise, permanent rejected Promise, fallback to local/
production, or premature fulfilled runtime. Test concurrent first callers,
failure/retry/cleanup and selected-mode changes explicitly.

Use the awaited selector in `/api/auth/[...all]`, `/api/account/[userId]`, account
password/email/sessions/revoke facades and account pages. Add
`loadPrivateAccountPage` beside existing loadPrivatePage with the same redirect/
unavailable semantics and selected headers; use it in account/sessions/security.
W1 pending two-factor page/handler/client must use selected auth runtime as well.
Leave unrelated local domain callers on the existing local selector and loader;
sameLocalOrigin remains explicitly loopback local only. Do not make local tutor,
learner, support, booking or private review routes hosted through a renamed helper.

## Exact HTTPS, Origin, Host and client-IP boundary

**Platform limitation:** a Web Request/NextRequest does not give this code a
trustworthy TCP peer address. A matching Host/X-Forwarded-* set alone is not ingress
authentication. Use a thin hosted Node entry wrapper and Next's supported
`next(...).prepare()/getRequestHandler()` in the **same Node process and service**.
No second gateway, service, worker or dependency is required. Proposed
`ingress-node.ts` is Node-only and does not import application server-only guards;
the hosted entry loads config and calls it before handing IncomingMessage to Next.
Local npm start/dev remain unchanged. Root owns a proposed opt-in hosted-start
script/package hunk; shipping this script is not deployment authorization.

Exact proposed startup hunk: `start:hosted` runs `node --import tsx
scripts/start-hosted-auth.ts` using installed tooling, normal `.next` output,
public/static assets and the entry/feature source. Keep build as `next build`,
output non-standalone, and no auto migrations/fixtures/provider probe on start.
Validate explicit PORT (1–65535) without guessed adjacent ports; only the later
approved service entry binds its intended interface. Tests bind127.0.0.1. Set
owned response headers before Next's handler sends bytes. GET `/api/health`
retains the no-data liveness response without identity, DB or provider access;
it never claims auth readiness. Other requests pass ingress checks before private
content/provider dispatch. SIGTERM/SIGINT stop accepting, drain bounded in-flight
requests, await pending runtime initialization/cleanup, close its one W2 pool
and Next/server resources once, then exit. Bounded shutdown failure records only
a safe code. Startup/cleanup never print raw exceptions. Access the existing
singleton cleanup handle, not a second provider from another bundle. Test startup
refusal, health, SIGTERM after success/failure, closed ports and borrower drain.
Root msg_d68f7d5acc6e explicitly acknowledged this bounded entry.

The ingress wrapper reads rawHeaders to reject duplicate Host/Origin/proto/IP and
ambiguous comma chains. Require Host exactly configured URL.host; no fallback to
Request.url, suffix comparison, case-normalizing an attacker field or forwarded
host. In trusted-proxy mode require socket.remoteAddress in exact configured peer
set and one platform-overwritten x-forwarded-proto=https. Direct unknown peers,
HTTP marker/missing marker, disabled contract and duplicate headers deny. Actual
Railway network isolation/peer/header provenance must be independently established
before this contract is enabled remotely; a Railway URL or JSON assertion alone
does not prove it. If fixed safe peers/overwrite cannot be established, leave
hosted auth unavailable and report the limitation; never trust a broad CIDR.

Strip inbound Forwarded, x-forwarded-host, x-forwarded-for, x-real-ip,
cf-connecting-ip, x-learli-local-ip and _*every x-learli-* internal header_*.
Read a single validated platform client IP before stripping only when that
overwriting contract is explicitly accepted; use node:net isIP, reject commas,
ports, zones, whitespace and malformed literals, normalize mapped IPv4, and let
provider ipv6Subnet=64 collapse equivalent IPv6 rate keys. Otherwise use the fixed
`0.0.0.0` shared bucket: all hosted users share the existing database-backed limits,
which may reduce availability but cannot be evaded with spoofed headers. Missing
or invalid claimed IP in single-header mode denies rather than guessing a client.

The wrapper overwrites internal `x-learli-ingress-token` with the server secret,
`x-learli-ingress-proto:https`, `x-learli-ingress-host:URL.host`, and
`x-learli-client-ip` with the validated IP/shared bucket. None is reflected/logged.
Auth/account boundary helper checks the internal token with bounded constant-time
comparison and exact proto/host, then checks Origin for every mutation, including
sign-in/up without cookies. Origin must equal configured origin; absent/null,
duplicate, malicious/mismatched and Sec-Fetch-Site cross-site are denied. GET
verification/reset navigation can omit Origin; if present it must match. Existing
provider proof/callback validity remains mandatory. GET reads require validated
ingress too; RSC account reads validate the same header envelope before identity.

Only after validation, build the provider Request URL from fixed runtime.origin
plus allowlisted route/search; ignore internally reconstructed HTTP Request.url
origin. Delete all forwarding/internal token metadata from provider headers; set
only x-learli-client-ip (hosted) or existing x-learli-local-ip=127.0.0.1 (local).
Keep cookies, real Origin, safe Fetch Metadata and user-agent; remove content-length
when rewriting a body. Password/email internal HTTP requests consume this same
sanitizer, not a repeated hardcoded IP. Session API calls receive validated headers.
Better Auth has static baseURL, trustedOrigins=[origin], trustedProxyHeaders=false;
its ipAddressHeaders is exactly the selected private IP header, no XFF fallback.
No missing-IP unthrottled path; same shared bucket on all account wrappers.

The local HTTPS harness acts as the known stripping proxy. The actual Node entry
authenticates its backend socket peer and mints this envelope. An unknown peer
fails at that entry; a direct call to the inner Next boundary without its envelope
fails there. These are different assertions: a caller from the already trusted
proxy peer with matching Host/proto cannot be distinguished from the proxy by this
wrapper, and supplying/omitting an incoming token cannot change that fact because
the wrapper strips it. Real network isolation is part of external ingress acceptance.
Browser-forged internal headers arriving through the proxy are overwritten, and
forwarded host/proto/IP cannot change origin or rate key.
This demonstrates the software contract, **not proved Railway behavior**.

## Provider, cookies, callback, account and UI behavior

Hosted options deeply preserve authOptions and explicitly set useSecureCookies=true,
defaultCookieAttributes {secure:true,httpOnly:true,sameSite:"lax",path:"/"},
crossSubDomainCookies.enabled=false, disableOriginCheck=false and disableCSRFCheck=false.
No Domain attribute, cookie-cache enablement, shared subdomain session, trust-device
option or URL-derived baseURL. Confirm actual plugin challenge/session cookies in
browser evidence; do not hardcode guessed cookie names or drop Set-Cookie headers.
Retain provider expirations, freshness, verified/active owner and MFA requirements.

Preserve W1's narrow HTTP MFA allowlist, adminSecurity.run wrapper, success
projection and all-cookie/partial-revocation handling. On sign-in examine actual
`twoFactorRedirect` before ordinary success; carry validated next to existing
`/two-factor`, then full document replacement after proof. Password-only pending
challenge never grants privileged access. Enrollment/rotation/disable use W1's
actual password/fresh factor constraints and invalidate assurance. No raw OTP/core
change-email/change-password/list-session endpoint expansion: existing account
wrappers are still authoritative. Consider only W1's final accepted route additions.

Callbacks map installed provider fields directly:
sendVerificationEmail({user,url}) => constructors.verification;
sendResetPassword({user,url}) => passwordReset;
emailOTP.sendVerificationOTP({email,otp,type}) => emailChangeCurrent for
email-verification and emailChangeNew for change-email. Other types fail safely.
Each callback validates configured test membership and uses a fresh UUID eventId,
firstAttemptAt=Date.now(), exact origin/secret constructor and **one awaited send**.
Only accepted completes the callback. Retryable/rejected/uncertain becomes a safe
provider APIError/unavailable result; never log raw payload/result or persist proof.
No blind automatic resend, durable token queue or clock/key reset. Native provider
resend/reset/proof restart is recovery; a new provider proof is a new attempt.
Registration may already have persisted an unverified user, and provider/email
changes may partially complete: never claim rollback or false mail delivery.
Existing enumeration-safe responses stay generic, including unknown reset email.

W4a currently accepts verification callbacks to /sign-in, /account or / and reset
callback exactly /reset-password; its safe next uses existing safeReturnPath.
W3 validates callbackURL/redirectTo in the HTTP allowlist before dispatch, using
the existing safeBookingReturnPath for next/public selection and those actual
constructor routes. Reject external, protocol-relative, duplicate, fragment,
control/backslash and malformed encoded fields; never alter W4a frozen validators.
Test the real provider-generated verification/reset URL against the constructor,
including canonical public booking selection. Selection survives authentication
but never reserves automatically, and unavailable hosted demo shows truthful denial.

AuthFrame consumes selected mode/config status, renders hosted synthetic disclosure
without local mailbox claims, and supplies only safe presentation props. Account,
sessions/email/password/security pages use existing components/tokens and mode-aware
copy. Hosted notices say request/acceptance, never delivery or guardian approval;
no key, allowlist, target, sender attestation, proxy config or secret goes to clients.
Keep private no-store/referrer/noindex headers on HTML/RSC/API/proof navigation,
safe sessions DTO, credential/code clearing and transient MFA secret/recovery display.
No secrets in URLs/storage/SSR bootstrap/captures. Preserve document boundaries,
native replacements on sign-in/out/email changes and bfcache current-authority reload.
No-JS reads/navigation work; mutations remain clearly hydration gated with POST
fallback, and no password/OTP/name can reach a GET URL through a native form.

## Isolated local TLS/HTTPS harness and ordinary registration

Proposed owned files: tests/support/hosted-auth-runtime.ts,
hosted-auth-app.mjs, hosted-auth-proxy.ts, and unique unit/component/integration/
e2e hosted-auth files. Ports reserved: local55903, dev3093, ordinary browser3193,
TLS56003, HTTPS3293. Root must grant a heavy lease before install/setup/PG/build/
browser; current Architect uses none. Never use main55432, unrelated5432, peer
ports/data, existing env, provider keys, global trust or extra services.

Use existing createStagingTlsHarness on56003 with owned 0700/0600 state, real
verified TLS PG settings, owner/runtime identities and exact reviewed migrations/
grants including accepted W1. W2 integration already substitutes only
stagingPoolConfig in test modules: call the real opaque parser/lookup first, then
substitute owned loopback TLS PoolConfig. Reuse that pattern solely in test-owned
module compilation; actual production/staging parser remains byte-identical and
refuses this pairing. Exercise the real W2 guarded runtime/Drizzle/Better Auth.

The test-owned app launcher creates an ignored temporary mirror of the exact
candidate's full application source/routes/assets/config (record source hashes),
sharing installed dependencies read-only. Build the mirror independently; never
patch real checkout, installed package or server-env parser. Exact substitutions:

1. Mirror `src/features/hosted-auth/config.ts` is a test-owned wrapper re-exporting
   the renamed unchanged real module. Its parseHostedAuthConfig calls the real
   parser first against a strict fictional canonical nonloopback staging packet,
   then substitutes only the fixture's fixed https://127.0.0.1:3293 origin,
   test transport environment and trusted proxy peer127.0.0.1 (or exact
   documentation peer192.0.2.10 for the isolated denial-start scenario). Test validation
   accepts only these fixed values, owned absolute files and fixed assigned ports.
   This is an explicit config-admission substitution, not production acceptance.
   Server env keeps APP_ENV=staging/AUTH_MODE=hosted-synthetic; its primitive parse
   remains unchanged. Loopback refusal belongs to the full feature config parser,
   which is separately tested unmodified. No generic env-loader rewrite is allowed.
2. Mirror `src/lib/db/staging-config.ts` re-exports its renamed unchanged module;
   only stagingPoolConfig calls real opaque lookup first and substitutes the
   test-owned real TLS PG settings. All target schemas/registration/TLS guards and
   actual W2 guard/validation/Drizzle code remain byte-identical.
3. Mirror `src/features/hosted-auth/factory.ts` is a small test-owned entry replacing
   only createHostedAuth: consume that fixture config, await the actual W2 runtime
   and call actual composition.ts with environment=test and actual W1 closures.
   Construct actual W4a transport with its supported test fetch argument. No auth,
   SDK, mail constructor, provider handler or composition module is rewritten.

Retain exact selected-runtime accessor, server env parsing, config-file private
file reader, Node ingress/token/header checks, route tree, account services/forms,
provider proof binding and composition. Record every mirror replacement/original
hash and diff; no substitutions beyond these named exports without root review.
Original production factory/config tests prove loopback/test/production refusal
before I/O. Fixture compilation proves application/provider behavior after
admission, not staging activation. No shipped factory has a test target/CA override.

Instantiate actual W4a transport with test environment and injected fake fetch;
execute actual SDK.emails.send/post/serialization/Idempotency-Key. The fetch accepts
only fixed HTTPS /emails POST, validates body, stores private supported proof
captures, returns schema-valid UUIDs or controlled429/409/5xx/timeout responses and
never calls network. Keep provider failures/ambiguous sends visible. It replaces
transport only, not Better Auth proofs, HTTP routes, DB transactions or SDK itself.

Launch mirror Next backend on3193 through the actual hosted Node entry and
ingress-node.ts, and an owned TLS reverse proxy on3293 with a
short-lived certificate containing IP SAN127.0.0.1. Trust the test CA only in the
owned HTTP clients/proxy; Playwright's HTTPS tolerance, if needed, is confined to
the single exact loopback HTTPS context and disclosed, with secure cookies still
asserted and separate actual TLS validation/negative certificate tests. Never use
NODE_TLS_REJECT_UNAUTHORIZED=0, NODE_EXTRA_CA_CERTS, global CA installation or a
production hostname exception. Proxy checks external HTTPS/Host, strips spoofed
headers and emits only platform Host/proto/single-IP inputs; the real backend
Node entry authenticates its raw peer, strips private headers again and creates
the internal token/host/proto/IP envelope. Both ports bind loopback. Unit/service
tests cover raw peer handling. For a portable executable network denial, start
the actual owned entry on3193 with trustedPeerAddresses=[192.0.2.10], an exact
documentation-only address never contacted. Send an ordinary loopback request
with matching external Host/proto and forged private headers: actual socket
peer127.0.0.1 is not trusted and must be rejected before Next. Stop that entry,
then start a fresh child with trustedPeerAddresses=[127.0.0.1] for actual proxy
flows, preserving singleton configuration restart semantics. Record both source-
identical starts and differing fixture peer packets. No OS alias/firewall/global
networking change or new port. Optionally an owned IPv6 ::1 listener sharing the
same handler can provide a simultaneous unknown-peer assertion, without making
IPv6 availability a required gate. Separately exercise missing/forged-token denial by direct
inner-boundary Request invocation; do not claim that is Node network rejection.
Direct same-trusted-peer requests with missing/HTTP proto still deny, but matching
trusted-peer/proto is explicitly not an attacker-distinguishable path. Browser-
forged XFF through the proxy cannot change the provider rate key. Full real-page
journeys and real entry shutdown are required; the launcher never bypasses the
Node entry by manufacturing internal credentials. Root msg_d0c5c2bde579 owns this
clarification of trust boundaries and fixture seams; msg_aa8b3be38dd7 supplies
the portable denied-peer startup option.

Existing unit/component and integration globs discover named tests automatically.
Root adds a hosted-auth project in ordinary playwright.config.ts, with explicit
testMatch hosted-auth.spec.ts, exact HTTPS baseURL, serial fixture work, trace/
failure screenshots off for credential-bearing flows, and owned harness webServer
startup/teardown alongside the existing local server. Existing default HTTP
validation and with-test-env stay intact; the hosted project boots its own child
fixture app rather than turning that wrapper into hosted mode. No isolated config
only acceptance: ordinary npm run test:e2e must discover and run it. Record both
candidate and mirror substitution manifest and ensure owned processes stop in
finally on failure without deleting preserved private evidence.

## Ordered implementation and separate verification

1. At implementation dispatch, inspect root's final accepted import manifest and
   hash every imported file; import only those bytes into this checkout, never a
   producer's env/data. Preserve accepted W1/W2/W4a or escalate concrete compatibility
   defects for a revised root freeze. Root still owns cumulative migration metadata.
2. Implement feature config/private loader, common concrete composition, hosted
   factory and selected account singleton; keep raw local fixture types and tests.
3. Implement ingress wrapper/envelope and account/provider sanitization; wire every
   listed account/MFA route/page, W1 challenge, selected copy and callback. Keep
   unrelated domains local-only. No helper-only completion.
4. Author discovered config/singleton/boundary/provider/PG tests and full test-owned
   mirror/TLS/SDK browser harness; register ordinary project through root allocation.
5. Perform read-only Review against this exact blueprint/source before separate
   execution; Recover defects without weakening guards or producer ownership.
6. Separate Verify runs actual scripts: npm run check; npm run test:integration
   with hosted-auth and affected auth/password/email/sessions/W1/W2 suites, then
   required broader suites; guarded ordinary production npm run build; npm run
   test:e2e with discovered hosted project and affected local regression matrix.
   Root owns final combined independent reviews, broader wave/restore/cross-browser
   checks and all source/document reconciliation. Do not claim these ran now.

Required evidence beyond happy paths:

- Pure config default/production/unknown-field/missing target/unsafe file/origin/
  forged opaque target denial before I/O; exact allowlisted signup/current-new email,
  no role escalation, disabled mail, invalid changed configuration and no fallback.
- Singleton concurrent first calls one pool/provider, local object equality across
  selectors, safe failed initialization cleanup/retry, no leaked rejection/pool.
- HTTPS Secure/HttpOnly/SameSite/host-only cookie and challenge cookie assertions;
  exact Host/Origin/HTTP/duplicate/forwarded spoof/direct backend/CSRF denial;
  database rate keys remain stable under malicious XFF/IP changes on auth and
  password/email wrappers, including shared fallback and IPv6 equivalence.
- Real provider registration → fake-SDK proof link → verification → login;
  unverified/suspended/unlisted denial; unknown-account generic reset; genuine
  reset/expiry/reuse and all other-session invalidation; current/new proof binding,
  replay/foreign/session/purpose failures and partial email/password revocation.
- Real W1 enrollment/challenge/TOTP/recovery reuse/rotation/disable/assurance
  failure, current/revoked session and no password-only administrator access.
- Real TLS wrong CA/hostname/expired cert and W2 wrong-role/database/drift/rollback
  evidence; inherited passing W2 source-bound tests may be retained explicitly,
  while integrated provider/auth usage and actual transactions need fresh evidence.
- Browser own-account/session controls and cross-user refusal, revoked-cookie
  failed sign-in/Back-before-reauth, account switching, no retained private HTML/RSC
  bootstrap, no private values in URLs/storage/public responses/logs/client files.
- 320/390/1440, keyboard/focus/axe, no-JS safe account navigation/mutation refusal,
  loading/unavailable/error/uncertain recovery. Capture only scrubbed safe UI;
  inspect artifacts as well as HTTP output. No hardware/device proof inferred.
- W1 prerequisite migration: fresh and populated0021→accepted chain preserves
  prior44 table values/history, actual grants/functions/triggers and denied writes.
  No new W3 migration or fictional count; source manifest controls exact chain.

Acceptance is all listed end-to-end behavior plus passing source-bound discovered
tests, current read-only Review and truthful limits. Failed attempts remain in the
report with Recover/rerun identity. No test/assertion skip or cloud workaround.

## Documentation, risks, rollback and next owner

Source references consulted2026-10-12: installed Better Auth1.7.7
`@better-auth/core/dist/types/init-options.d.mts`, `utils/ip.mjs`, provider
`cookies/index.mjs`, `plugins/two-factor/client.mjs` and actual W1 composition.
Static baseURL, secure host-only cookies, active CSRF/origin checks and sanitized
client IP header follow supported options; installed source owns pinned behavior.
[Better Auth security](https://better-auth.com/docs/reference/security),
[options](https://better-auth.com/docs/reference/options),
[two-factor](https://better-auth.com/docs/plugins/2fa),
[Next integration](https://better-auth.com/docs/integrations/next).
The same-process prepare/getRequestHandler entry and ordinary output restriction
are documented by [Next custom server](https://nextjs.org/docs/app/guides/custom-server).
Its entry is outside Next's compiler, so use pinned installed tsx loading.
Next's installed server type exposes close():Promise<void> for shutdown.
[Railway public networking](https://docs.railway.com/networking/public-networking)
does not supply inspected proof of this exact peer/IP overwrite contract;
real ingress acceptance remains a separate gate.

After implementation only, root reconciles architecture (local versus selected
account runtime, guarded pool and ingress), UI mode/uncertainty copy, build-plan
partial W3 evidence, README/.env.example and an operational hosted-auth guide.
Progress tracker records actual implemented/Review/Verify status separately; this
Architect does not edit it. W3 may submit only allocated own-checkout hunks.

No material human policy answer is needed for this denied-by-default synthetic
software. Real market/guardian/consent/screening/booking/publication activation,
verified sending and named staging/provider/ingress operations remain gated to
their owners. Runtime config is an attestation, not legal evidence. Actual Railway
peer/header contracts are **NOT VERIFIED**; do not copy test proxy peer/IP facts
into deployment. Next custom-server packaging cannot silently switch to standalone
output, which does not trace the custom entry; root must review the explicit entry
and hosted-start packaging before later deployment. Existing package advisories
remain; no upgrade is implied.

Rollback: disable hosted-synthetic/ingress/mail and restart the owned process;
local factory/demos remain available under local config. Close owned pools/servers
and retain evidence. Never undo W1 applied schema or delete account/history rows;
no destructive down migration, production target fallback or automatic repair.

Next owner: root accepts this architecture-only handoff, supplies the final W1/
W2/W4a source bundle and a fresh implementation dispatch/lease. No implemented W3
or verification claim is made by this blueprint. Approval gate is delegated
software authority above; all external operations and real activation require
their applicable separate explicit authorization.

## Implementation dispatch and narrow allocated revisions — 2026-10-12

Root current dispatch ctx_b76911159b12 authorizes Implement → Review → Verify → Remember, including actual shared account/auth/env composition, existing account/auth pages and forms, test discovery and same-process Node entry. Accepted 119-file provider baseline aggregate 0f0dd8511da6629e67b1252641c13131bbaa2337c6f26b84b69f903801f615ec was independently hash-checked before edits. Authority remains AUTHORIZED — build-feature delegation. The root also authorized moving the existing exact tsx4.23.15 pin to runtime dependencies for start:hosted, preserving all resolutions/integrity.

Root answered the concrete port collision: the test-owned hosted Node backend uses reserved3093, ordinary local Playwright remains3193, HTTPS3293 and TLS PostgreSQL56003 remain unchanged. This supersedes the earlier backend3193 test allocation only; with-test-env, local origin settings and real parsers remain unchanged. No additional admission substitution is authorized.

### Evidenced installed-provider compatibility refinement

Pinned Better Auth1.7.7 awaits but suppresses some callback errors through runInBackgroundOrAwait. The actual runtime therefore carries a narrowly consumed request-local boolean mailAttempt closure beside its existing proof/admin closures. Hosted HTTP/internal email proof dispatch checks its outcome and preserves every returned cookie while reporting unavailable/uncertain recovery; local dispatch behavior remains unchanged. No proof material, recipient, body or durable queue is stored in the closure. This is the smallest technical repair needed for the authorized truthful single-attempt contract, reported to root before implementation; provider/W4a bytes remain frozen.

### Current selected membership after restart

Hosted composition additionally guards persisted provider sessions, pending factor challenges and existing reset/verification proofs against the current immutable selected set. Use supported provider session/signed-cookie/verification/user lookup APIs before mutation and beforeEmailVerification; do not consume/rewrite proof or alter W1. The fixed provider plugin tuple places this guard first; its local matcher is strictly inert, preserving local provider behavior and native MFA type inference. Selected-set changes require restart; real PostgreSQL negative acceptance covers that deliberate restart with preserved old records.
