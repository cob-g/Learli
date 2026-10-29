# Implementation Plan — Optional Automatic Google Meet Links

## Approved configuration-fallback repair — 2026-10-27

Authority: user replied “ok approve do that” to the blast-radius recommendation
to preserve the manual-link form when optional Google configuration is invalid.
This is a bounded repair under M5.1/MEET-01/02/03, not provider activation.
Blueprint handoff recorded by Architect; implementation and verification follow
as separate stages. No new product or architecture decision is needed.

- Baseline: `feature/google-meet-provisioning` at `6d9a8fc`, with the existing
  uncommitted Meet implementation, skill installation and unrelated work preserved.
- Problem: the live missing-link reader parses optional configuration before its
  fresh authorized projection; a configuration exception hides the manual form.
- Correction: catch only optional configuration parsing at that read boundary.
  Use a null fingerprint and safe `action_required` state on parse failure. Keep
  the status SQL and fresh ownership/eligibility read outside the catch. Never
  swallow authorization, packet-continuity or database failures.
- Reuse the existing meeting states and form. Preserve present links, participant
  edit restrictions, concurrent manual saves, private responses, booking state,
  history, worker behavior and strict launcher/provider configuration validation.
- Scope: meeting reader; focused regression tests; operations guidance and progress
  tracker. No schema, migration, dependency, credentials, production or live
  provider operation. Rollback is a source-only reversal of this narrow repair.
- Acceptance: first manual-link read remains editable for an authorized tutor
  under invalid enabled settings; participants stay read-only; current denial and
  database failures stay failures; a concurrent saved link wins; valid preparing
  and disabled behavior remain unchanged. The strict config parser still throws.
- Separate verification: demonstrate the new behavioral regression fails on the
  original reader, then passes with the fix; run affected unit/components and
  actual PostgreSQL Meet/private-link suites, lint/typecheck and production build.
  UI markup is unchanged; existing component tests cover the reused action state.
  Do not retry Google creation. Update tracker with actual results and Remember
  with reviewed/verified state. No commit, merge or deployment is authorized.

## Status and handoff authority

- Status: **APPROVED — user approved this complete blueprint.**
- Planning date: 2026-10-26.
- Repository: `/Users/cob/learli`.
- Observed branch: `feature/workspace-redesign`.
- Observed HEAD: `6d9a8fcb5cebf15c0d621e3f710e39c67d965bc7`.
- Observed pre-planning changes: untracked `designs/`; preserve untouched.
- Proposed working branch: `feature/google-meet-provisioning`; not created.
- Authority: user requested planning before implementation, selected
  **tutor-owned Google accounts, optional connection, manual fallback**, then
  approved this complete blueprint with **“OKAY APPROVED”** on 2026-10-26.
  This authorizes the scoped separate implementation workflow, not the external
  provider, production, deployment, or purchase operations excluded below.
- Investigation: read-only repository inspection, two read-only delegated seam
  investigations, and current official Google documentation. No application
  code, context, configuration, database, or service was changed. No checks ran.

Downstream readers must read `AGENTS.md`, then the eight canonical context files
in its required order. Also read this blueprint, the existing M5.1 private-link
blueprints, and relevant approved booking/authentication decisions. Recheck the
actual working tree before implementation; preserve other ongoing work.

## What we are building

A tutor can optionally connect their own Google account and authorize Learli to
create Google Meet links for **future newly confirmed bookings**. Confirmation
atomically records work; a background runner creates the space outside the booking
transaction, then attaches its validated private link to the existing booking.
Authorized parent, student, and assigned tutor views read that same saved link.
Tutors without a connection, or with provider problems, retain the existing manual
Google Meet/Zoom workflow. A Google failure never cancels a valid booking or marks
it paid, attended, or completed.

## Requirement and milestone mapping

- Primary owner: **M5.1** supplemental enhancement; related **M5.2, M5.5, M5.11**,
  **M2.3/2.5/2.6/2.7**, **M4.5–M4.10**, and applicable M8 integration/recovery checks.
- PRD: **MEET-01/02/03**, **TUT-06**, **BKG-01/02/03/04/05/06/07**;
  **AUTH-03**, **NFR-01/02/03/04/05/06/09/10/11** as applicable.
- Current architecture and PRD §13.2 intentionally defer meeting-creation OAuth.
  Approval must promote only this bounded optional integration from `[LATER]`;
  it does not approve Calendar synchronization, conferencing, or attendance.
- Proposed build-plan clarification: extend M5.1 to cover optional provider-created
  private links while preserving tutor-supplied links. Do not invent a new approved
  milestone or mark the whole M5 complete.

### Repository evidence and reuse

| Existing area                         | Evidence                                                                                                              | Implication                                                                                                                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Private current link and edit history | `src/lib/db/schema/booking-meeting-links.ts`; `drizzle/0013_thankful_typhoid_mary.sql`                                | Reuse one current link per physical booking, revision checks, and append-only safe edit events. Current actor columns require a genuine user; automation needs explicit provenance.            |
| Meeting save service                  | `src/features/booking-meeting-links/service.ts:56`                                                                    | Reuse URL validation and revision semantics; preserve tutor-before-booking lock order. Do not fake a tutor session to call the human save service.                                             |
| Meeting visibility                    | `src/features/booking-meeting-links/query.ts:47`; `model.ts`, `handler.ts`, `meeting-section.tsx` in the same feature | Current ownership/policy checks, confirmed/future access, private no-store responses, and guarded join redirects remain authoritative. Admin is not a blanket link recipient.                  |
| URL validation                        | `src/lib/validation/meeting-link.ts`                                                                                  | Validate provider-returned URLs through the same exact HTTPS host/path rules as manual links.                                                                                                  |
| Confirmation and rescheduling         | `drizzle/0039_independent_adult_learner.sql:388`, `:558`; `src/features/booking-workflows/service.ts`                 | Parent-v2/independent-v2 can confirm without money. Rescheduling replaces a physical booking, retains logical history, and can emit both replacement-confirmed and old-row-rescheduled events. |
| Retried domain mutations              | `src/features/bookings/service.ts`                                                                                    | Google requests must never run inside retryable booking transactions.                                                                                                                          |
| Durable external-delivery pattern     | `src/features/transactional-delivery/drain.ts`; `operator.ts`; `scripts/transactional-delivery.ts`                    | Reuse short leases, freshness checks, and I/O after commit. Existing queue is email-specific and operator-only; it is not an automatic Meet runner.                                            |
| Authentication                        | `src/lib/auth-handler.ts`; `src/lib/auth-options.ts`; `src/features/hosted-auth/composition.ts`                       | Better Auth email/password remains unchanged. Its closed route allowlist does not currently enable social/OAuth account linking.                                                               |
| Sensitive account changes             | `src/features/account-password/service.ts`; `src/features/account-email/service.ts`                                   | Reuse the existing explicit session-freshness pattern for connecting/replacing/disconnecting provider access.                                                                                  |
| Runtime isolation                     | `src/lib/db/hosted-runtime.ts`, `hosted-runtime-validation.ts`, existing environment and deployment gates             | Do not weaken verified runtime-role checks or open a production mode to make a worker connect.                                                                                                 |

These are static observations, not fresh executed verification of existing flows.

## Language and decisions

- **Google connection:** permission to create meetings using the tutor's Google
  account; it is separate from Learli login, tutor screening, and role assignment.
- **Automatic link:** a private Google Meet space created after Learli confirms
  the booking. Learli remains the schedule and booking-state source of truth.
- **Meeting host:** the connected tutor's Google identity, not an implicit shared
  Learli administrator or service account.
- **One booking/link:** one authoritative attached link for a physical booking.
  This is not a promise of exactly-once creation of a remote Google resource.
- **Manual fallback:** the existing assigned-tutor save/edit of a valid Zoom or
  Meet URL, with the same permissions and optimistic concurrency checks.
- **Decided by user:** tutor ownership, optional connection, manual fallback.
- **Recommended engineering choices pending blueprint approval:** direct Meet
  API, separate OAuth connector, durable PostgreSQL work, opt-in supervised runner,
  minimal scopes, no retroactive processing, and fail-safe uncertain outcomes.

## Scope and non-goals

Included:

- Tutor connection, reconnect, disconnect, and clear provider status.
- Explicit consent that connection enables automatic links for future confirmed
  bookings. Optional means a tutor may continue using manual links indefinitely.
- Per-booking creation, safe private installation, cancellation/reschedule fencing,
  manual precedence, accessible progress/recovery states, and auditable provenance.
- Disabled-by-default integration; isolated local development and dedicated
  provider test accounts. Existing local and synthetic booking sources remain
  separately identified; only ordinary `local_operation` confirmations can be
  configured for real provider calls in the first controlled environment.

Excluded:

- Google sign-in; Calendar events/sync/invitations; asking students to connect
  Google; sending child names/emails or booking details to Google to create spaces.
- Automatic Zoom creation, service accounts/domain-wide delegation, shared
  platform hosting, recording/transcripts/AI notes, attendance/webhooks, embedded
  calls, automatic completion, reminders, payments, or changes to cancellation
  and rescheduling permissions/policies.
- Automatic conversion/backfill of existing bookings, links, legacy admissions,
  policy receipts, or historical records. Connecting applies prospectively.
- A new notification type or exposing links in existing email payloads.
- Production deployment/activation or live database/Google Cloud changes.

## System invariants

1. Existing eligibility, consent, guardian ownership, role checks, booking states,
   database overlap protections, and idempotency remain unchanged.
2. A meeting job is separate from booking status. Link preparation/failure does
   not change confirmed/unpaid status or create another booking.
3. Only the current assigned eligible tutor can connect their account. No
   administrator can impersonate that connection or inspect its tokens.
4. The background worker uses an explicit system principal and active recorded
   consent; it never fabricates a Better Auth session or bypasses current policy.
5. All views use the existing private link boundary. No URLs, Google space IDs,
   credentials, or owner account details enter public DTOs, metadata, logs, or
   unrelated users' responses. Participant status is minimal and generic.
6. Confirmed bookings alone qualify; stale, cancelled, replaced, completed,
   provisional, expired, ineligible, or policy-invalid bookings cannot acquire a
   new automated link. Check again after provider I/O.
7. Google connection is not required for tutor approval/discovery or valid booking.
8. A manual link saved during generation wins. Existing links are never silently
   replaced by automation. Every attachment creates the normal revision/event.
9. Existing link rows and history are retained when access expires. Disconnect
   does not cancel bookings or erase already saved meeting information.
10. Google controls the actual call and external admission. Learli does not claim
    that a hidden/cancelled link becomes unusable outside Learli.

## Provider design and constraints

Use the stable Google Meet API `POST /v2/spaces`, with a minimal request containing
reviewed access configuration. No Calendar permission or event is necessary to
create a space. Request restricted host admission rather than `OPEN`; verify the
effective returned configuration. If an account cannot support the required
configuration, use manual fallback instead of silently relaxing it.

Restricted access does not bind the space to Learli's user list: guests may knock
and the tutor controls admission. Host/organization defaults, recording settings,
duration limits, and account restrictions still apply. This integration does not
enable or collect artifacts; it must not claim to override organizational
auto-recording defaults using a scope that cannot control them. Safer host settings
and real-minor use remain subject to existing safeguarding launch gates.

Google's quickstart lists a Meet-enabled Google Workspace account as a prerequisite.
Use a dedicated eligible Workspace test host for initial provider verification;
personal-Gmail compatibility and account-tier limitations remain unverified until
separately demonstrated. Do not buy subscriptions or promise universal/free account
support. An unsupported account can still use manual links.

The documented create method has no idempotency key. The stable spaces resource
does not expose list/delete operations for recovering an unknown created space or
permanently deleting it. Therefore an ambiguous create response must not trigger a
blind repeat. A known space can be fetched by its returned name; an unknown one
cannot be recovered by assuming a client-selected ID. `endActiveConference` does
not revoke a permanent link and must not be called on cancellation/disconnect.

## Data and authorization changes

All names below are **proposed**. Use reviewed forward Drizzle/SQL migrations;
choose the actual next migration number at implementation, preserving existing
migrations and records. The first slice remains disabled until subsequent slices
are integrated and verified.

### Minimal feature-owned persistence

1. `tutor_google_meet_connections`: stable connection ID, owner tutor/user,
   verified Google `sub`, owner-only account label, granted scopes, client/environment
   binding, connection state/generation, consent timestamp/version, token generation,
   encrypted token material/expiry/key ID, and timestamps. One active connection
   per tutor; reconnect to the same account cannot lose a still-valid refresh token
   when Google omits it. A different Google account requires explicit replacement
   confirmation and invalidates old in-flight work. No silent account transfer.
2. `google_meet_oauth_attempts`: hashed random state, owner and exact Learli session,
   browser-binding hash, nonce, encrypted PKCE verifier, intended callback/client/
   environment fingerprint, expected connection generation, expiry, consumed time.
   Bounded transient rows; expired material can be purged without deleting audit.
3. `booking_meeting_provisioning`: unique physical booking ID, immutable confirmed
   event reference, connection/generation, bounded state, attempt/lease token,
   dispatch marker, retry timing, safe failure code, and protected returned space
   name/validated URI receipt. A single successful remote receipt is immutable;
   this is feature operational state, not a second booking or a public audit log.

Use foreign keys, appropriate unique/check constraints, indexed bounded claims,
UTC timestamps, and exact environment/source binding. Jobs must not be insertable
for arbitrary user/booking/connection combinations by general application SQL.

### Automation provenance in existing meeting records

Extend `booking_meeting_links` and `booking_meeting_link_events` with an explicit
human/system actor discriminator and an exact provisioning-job reference. Preserve
all existing human rows via defaults; retain the existing positive revision,
unique request, and revision-increment constraints. User actor fields may be NULL
**only** for the system case with the correctly bound job. Add composite identity
constraints so a job for booking A cannot authorize a link/event for booking B.
No synthetic tutor user, fake session, or guessed actor ID.

Use narrow feature-owned database functions for enqueue/claim/prepare/receipt/
install. Follow existing SECURITY DEFINER hygiene, fixed safe search paths, exact
ownership/state checks, and restricted EXECUTE grants. The worker receives a
dedicated minimum-privilege role; it cannot edit bookings or freely select learner,
auth, token, or meeting tables. The web role sees owner-scoped connection metadata
and the minimal existing participant link projection, not ciphertext. Do not
grant owner credentials or relax the hosted runtime guard to support this role.

### Encryption and identity

- Use Node's AES-256-GCM and a dedicated environment-held key/key ID; unique
  nonces, authenticated ciphertext, and AAD binding connection/owner/Google-sub/
  client/environment/token purpose/version. No secret values in the database,
  repository, browser, errors, telemetry, or logs. Preserve required decrypt keys
  during rotation until old ciphertext has been safely migrated.
- Use a maintained official Google auth library for OAuth and ID-token validation;
  verify its current stable compatible version when implementing and pin it.
  A narrow server-only REST adapter can avoid a large generated API dependency.
- Do not reuse Better Auth `account` token fields or change its login providers.

## OAuth and API surface

Proposed private page: `/tutor/meetings`, linked in the existing Tutor teaching
navigation. Proposed dedicated endpoints, separate from Better Auth:

| Method/path                                           | Contract                                                                                                                                                                                                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST `/api/tutor/meeting-providers/google/connect`    | Same-origin, active verified tutor, fresh session, bounded validated body, explicit future-generation consent; creates a single-use attempt and redirects to Google.                                                                                      |
| GET `/api/tutor/meeting-providers/google/callback`    | Strict bounded callback fields; same session/browser/state/nonce/client binding; single consumption; exchanges code outside DB locks, validates ID token/scopes, then rechecks authority/generation before save. Redirects to a clean fixed private page. |
| POST `/api/tutor/meeting-providers/google/disconnect` | Same-origin, fresh session, owner-only; disables connection/increments generation, removes active token material and suppresses in-flight attachment. Provider revocation is best effort outside the transaction.                                         |

Connection metadata can be rendered server-side on the private page; no generic
token/status API is needed. Reconnect uses the same connect flow. Callback errors
must be mapped to safe fixed messages, not echoed provider text. Callback/header/
proxy logging must redact query strings, codes and state; use `private, no-store`,
`Referrer-Policy: no-referrer`, a fixed return destination, and prompt URL cleanup.

Request only `openid`, `email`, and
`https://www.googleapis.com/auth/meetings.space.created`, offline access, validated
state/nonce, and supported S256 PKCE. Validate token signature, issuer, audience,
expiry, nonce and required scopes; bind by stable Google `sub`, never by matching
email to a Learli user. No Calendar, Drive, media, settings or attendance scope.
Keep Better Auth's existing social/callback allowlist closed.

Concurrent callbacks and token refreshes use generation checks and a short
per-connection claim; never hold locks during Google I/O. A late refresh/callback
cannot resurrect a disconnected/replaced connection. A changed Google identity
cannot inherit the previous account's refresh token. Invalid/revoked grants lead
to reconnect-required, not infinite retries. Google revocation failure does not
undo local disconnect; show truthful guidance to remove access in Google settings.

## Booking workflow and automatic execution

1. In the existing confirmed-lifecycle event transaction, enqueue a minimal intent
   only when integration/source gates, current connection consent, and booking
   eligibility hold. A focused event trigger/function avoids rewriting all booking
   services. No trigger performs HTTP. Unique physical booking ID deduplicates
   retried confirmation and the two events associated with rescheduling.
2. An opt-in supervised runner claims a bounded PostgreSQL batch. Prepare under
   short READ COMMITTED transactions and the established lock direction:
   tutor → booking when needed → connection → job/link. Claim-only transactions
   release queue locks before taking domain locks. Recheck current policy, exact
   logical-head/physical booking, tutor/learner eligibility, consent, generation,
   time, missing-link revision, and source after waits.
3. Commit the exact attempt's dispatch marker before sending Google create; use
   finite network timeouts, bounded concurrency and per-connection token refresh
   serialization. Disable SDK/transport automatic replay for create POST.
4. Store a validated known result in the exact attempt's restricted receipt. An
   immutable receipt does not itself authorize installation. Recheck current
   consent/booking/claim and link revision before attaching in a short transaction;
   append system-provenance edit history atomically. Duplicate acknowledgements
   return the same saved result rather than create another revision/space.
5. Existing authorized meeting views show preparing/ready/recovery states. Reads,
   join redirects and page rendering never create meetings or refresh Google tokens.
   A refresh rereads the shared record; no websocket synchronization is claimed.

**Actual execution mechanism:** proposed `scripts/google-meet-worker.ts` plus a
small supervised local launcher (proposed `scripts/run-with-meet.ts` and `dev:meet`
command) runs Next and the polling loop together. Default `dev`, tests, builds and
ordinary starts remain provider-disabled. Use the existing single repository and
PostgreSQL, without Redis or a separate deployed worker service. Keep bounded
polling, leases/fencing, graceful shutdown and redacted health counters. Fail startup
with a clear configuration error when explicitly enabled with missing dependencies;
do not silently label an operator-only drain as automatic.

A future opt-in hosted launcher may use the same supervised arrangement after
separate deployment/runtime approval. No Railway process changes in this local
slice. Unawaited post-response promises, user page visits, instrumentation startup
side effects, and an unspecified cron are not acceptable substitutes.

## Failure states, retries and races

| Situation                                                               | Required outcome                                                                                                                                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No connection or generation disabled                                    | Confirm booking normally; existing manual missing-link state.                                                                                                                  |
| Work queued; worker unavailable                                         | Booking remains confirmed; truthful preparing status with manual fallback; resume durable work when runner returns.                                                            |
| Claim expires before dispatch marker                                    | Safe bounded reclaim; no provider request has been made.                                                                                                                       |
| Auth rejection/revoked consent                                          | Mark reconnect required; never cancel booking or retry indefinitely.                                                                                                           |
| Provably rejected request/rate limit                                    | Bounded retry/backoff only where rejection is known to have created no space. No blanket retry on all 5xx responses.                                                           |
| Timeout/reset/5xx or crash after dispatch with no durable result        | Mark **uncertain**; do not issue a second create automatically. Tutor can use manual fallback. A crash between marker and actual send can conservatively enter this state too. |
| Returned name/URI durably recorded; attachment interrupted              | Reconcile the same known space/receipt and attempt installation after fresh checks; no new create.                                                                             |
| Response lost before durable receipt                                    | Space might exist externally; no exactly-once guarantee or invented recovery-by-list. Retain safe incident status and manual fallback; an unused orphan may remain in Google.  |
| Manual save during Google I/O                                           | Keep manual link. Auto result cannot overwrite it; retain operational result privately as superseded.                                                                          |
| Automatic install precedes manual save                                  | Existing revision conflict asks tutor to reload; intentional manual edit can then replace the link.                                                                            |
| Cancellation/completion/end time/policy or authority revoked during I/O | Suppress attachment and participant disclosure; retain booking/history and safe operational outcome.                                                                           |
| Confirmed booking rescheduled                                           | Old physical row/link retains history and loses current access; replacement confirmed row gets its own unique job/space. Provisional replacement waits for confirmation.       |
| Disconnect/reconnect races                                              | Exact consent/connection generation fences old work. Existing saved links survive; no automatic conversion to a different host.                                                |
| Copied link after cancellation                                          | Learli hides it as today; cannot promise external revocation. Do not end an active call as cleanup.                                                                            |

Durable receipts of late known responses may be recorded for that immutable attempt
without giving an expired claimant permission to attach or change current state.
State updates use exact claim/generation compare-and-swap, not just job ID.

## Frontend behavior

- Follow current Tutor shell/navigation, navy/teal tokens, responsive panels,
  semantic forms, keyboard/focus conventions and reduced-motion preference.
- Connection page: not connected; redirecting; connected owner-only account label;
  reconnect required; unsupported account/configuration; disconnect confirmation;
  cancelled/failed connection. Explain host responsibility and future-only scope.
- Meeting section: keep manual form and guarded external Join link. Add truthful
  states: “Preparing meeting link”, “Meeting link ready”, or “Your tutor needs to
  arrange the meeting link”. Tutor sees actionable reconnect/manual guidance.
- No perpetual spinner implying success; no false success when consent is denied.
  Pending status may refresh through a bounded read-only request, pausing when hidden;
  manual refresh always works. No sensitive provider details in participant messages.
- Confirmed bookings with no link remain clearly confirmed. A meeting link is
  separate from payment, time-zone display, attendance, and session completion.
- Existing tutor completion after the scheduled end remains unchanged; ending a
  Meet call does not complete the Learli booking.

## Incremental implementation sequence

Each slice receives a focused diff, separate review, and independent verification.
No slice is labelled fully automatic until the runner and integration are present.

1. **Connection foundation:** record approved scope in context; add feature config,
   reviewed connection/OAuth schema, encryption, narrow role grants, dedicated
   OAuth endpoints and optional Tutor connection page. Add focused tests. Leave
   booking generation off. Review callback/credential/privacy behavior first.
2. **Durable per-booking creation:** additive job schema and explicit system link
   provenance; atomic confirmation enqueue; provider adapter; prepare/dispatch/
   receipt/attach logic; supervised local runner. Preserve existing mutation and
   conflict logic. Keep real calls off in all automated tests.
3. **Integrated lifecycle and UX:** shared private status projection, manual wins,
   reschedule/cancellation/disconnect fencing, owner-only recovery guidance,
   stale callback/refresh protection, and redacted operational controls.
4. **Controlled provider acceptance and handoff:** separate verifier exercises
   isolated automated checks, then an explicitly authorized dedicated Google test
   host. Record actual API/account/settings limitations. Production remains off.

If a slice reveals a material policy/account/deployment conflict, stop that slice
and return to architecture; do not change existing working behavior to hide it.

## Verification plan for a separate verifier — DO NOT EXECUTE IN ARCHITECT

Existing scripts: `npm run format:check`, `npm run lint`, `npm run typecheck`,
`npm test`, `npm run test:integration`, `npm run test:e2e`,
`npm run test:e2e:private`, and `npm run build`. Use actual local synthetic test
environment guards; never production connection strings/accounts.

Reuse/extend existing meeting test suites:
`tests/unit/meeting-link.test.ts`, `tests/unit/booking-meeting-links.test.ts`,
`tests/integration/booking-meeting-links.test.ts`,
`tests/e2e/booking-meeting-links.spec.ts`; existing workflow/concurrency and
private-workflow suites remain required related coverage. New OAuth/provisioning
unit, integration and E2E filenames are proposed by the implementer.

Required automated evidence:

- OAuth denial, tampering, missing/repeated/expired fields, state replay, wrong
  browser/session, cross-user callback, stale connection generation, wrong Google
  subject/client/audience/nonce/scopes, and revoked role/session fail safely.
- No Google social-login/role escalation; Parent/Student/Admin cannot manage another
  tutor's connection. Current participant authorization governs ready and pending
  meeting responses; no cross-role owner labels/tokens/URLs leak.
- Encryption integrity, wrong AAD/key rejection, safe rotation, concurrent refresh,
  disconnect during token refresh/exchange, and refresh-token omission preservation.
- Real PostgreSQL tests for atomic confirmation+intent rollback, repeated confirm,
  one job per physical booking, two workers, expired claims, late receipts, manual
  edit races, job/booking mismatch rejection, least-privilege grants, and migrations
  preserving legacy/human rows and audit history. Include blocking interleavings.
- Deterministic fake Google transport: success; explicit rejection; timeout before/
  after acceptance; 5xx; crash after dispatch; response before receipt/attachment;
  forbidden config; invalid URL; quota; same known-space recovery. Assert create
  call counts, saved links/events and booking state, not only response status.
- Cancellation, reschedule/replacement confirmation, tutor suspension, beneficiary
  authorization revocation, end time and policy change during I/O prevent attach.
- Retain existing booking overlap/idempotency/time-zone/history tests and no-money
  status assertions. Rescheduling does not create duplicate active bookings.
- Playwright independent tutor/parent/student/unrelated contexts: connect UI with
  fake transport, create booking, observe same private link, manual fallback,
  reconnect/disconnect, guarded join, status freshness, desktop/mobile/keyboard.
  Browser tests must never open a real call or contact real OAuth/provider APIs.
- Default scripts/builds produce zero Google egress. New opt-in runner shutdown,
  restart, lease recovery and startup configuration failures are explicitly tested.

Controlled manual/operational checks, only with provider action authorization:

- Owner creates/configures a dedicated Google Cloud OAuth web client, Meet API,
  consent audience/test users, exact redirects and secrets outside Git. Validate
  OIDC/code+PKCE interoperability and real account capabilities with synthetic data.
- Tutor connects their dedicated eligible host; newly confirmed synthetic-person
  booking in the ordinary local-operation environment gets a working restricted
  space; authorized learners open the saved same link and tutor admits them.
- Validate actual host admission and organization defaults, reconnect, disconnect,
  consent revoked at Google, network loss, runner restart, future-only cutover, and
  no accidental names/child details/calendar invitation/email transmission.
- Check additive migration from populated historical data, worker credential scope,
  encrypted backups/key recovery, safe OAuth proxy-log configuration, and emergency
  disable. Do not drop data or run a production migration as a rollback test.

Expected evidence: exact branch/commit/diff, commands/counts/pass/fail/skips,
race/negative-case outcomes, redacted screenshots where helpful, actual account
type, provider acceptance results, and documented unverified categories.
**Verification status: NOT RUN — architecture planning only.**

## Transition, operational configuration and rollback

- Proposed configuration names: `GOOGLE_MEET_ENABLED`, `GOOGLE_MEET_CLIENT_ID`,
  `GOOGLE_MEET_CLIENT_SECRET`, `GOOGLE_MEET_REDIRECT_URI`, a dedicated encryption
  key/key ID, and worker database identity/config. Exact names must follow existing
  env conventions; examples contain names/placeholders only. No `NEXT_PUBLIC_`
  secrets. Derive/bind trusted origin from validated environment config.
- Use separated Google clients/secrets and databases for local/staging/production.
  Existing hosted auth/fixture-only staging restrictions remain; public runtime
  support is not implicitly authorized. No provider writes during planning/build.
- Enabling affects new eligible confirmed events only. Existing future bookings
  retain manual links/missing-link handling. Do not scan/backfill old bookings,
  auto-enqueue after connection, or rewrite old event/policy provenance.
- Emergency disable stops new work/Google I/O and preserves manual access,
  bookings, current links, receipts and history. Dispatched work becomes known-
  receipt recovery or uncertain; disabling does not imply external room deletion.
- Prefer forward corrective migrations. Do not automatically down-migrate/drop
  connection/job/history tables. New nullable system actors mean rollback to an old
  binary needs explicit reader-compatibility review; do not claim arbitrary old
  builds safely understand automated rows. Keep the new readers with feature off
  as the initial rollback path. Never discard encryption keys needed for retained
  encrypted records without an approved retention/recovery decision.
- Monitor only safe counts, queue age, error categories and runner heartbeat.
  No full request/response bodies, callback query strings, tokens, private space
  names/links, student data, or connection emails in operational logs.

## Required context updates after approval

- `context/project-overview.md`, `context/architecture.md`, `context/prd.md`:
  bounded promotion of optional tutor-owned Meet creation; manual fallback,
  provider uncertainty and external-admission limits; unchanged payments/safety.
- `context/build-plan.md`: M5.1 enhancement and related M2/M4/M5/M8 dependencies,
  without checking off broader milestones.
- `context/ui-context.md`: connection/recovery and preparing-vs-confirmed copy.
- `context/code-standards.md` and `context/ai-workflow-rules.md`: only necessary
  connector credential, worker lifecycle and non-idempotent-I/O conventions.
- `AGENTS.md` §11: reconcile initial manual/later-OAuth wording with this bounded
  approved enhancement; preserve third-party responsibilities and future gates.
- A proposed `docs/decisions/` record plus a proposed local Google setup/recovery
  runbook under `docs/operations/`. Choose repository-conventional filenames.
- `context/progress-tracker.md`: downstream implementation/review/verification
  evidence separately, real blockers and next action; never completion from plan.

## Risks, gates and acceptance

- **OAuth public access:** `meetings.space.created` is sensitive. Public external
  rollout requires applicable Google verification/consent/domain requirements.
  Testing-mode external refresh tokens with this scope expire after seven days;
  reconnect handling is necessary, not a permanent provider failure.
- **Remote uncertainty:** no documented idempotent create means a lost response
  can leave an unused space and require manual fallback. No claim of exactly-once
  remote creation. If product later requires automatic reconciliation in every
  case, separately evaluate a Calendar-based design and its broader permissions.
- **External security:** copies of links and host-controlled admission/settings
  remain outside Learli's enforcement. Real-minor and public launch safety gates
  are not closed by OAuth or a restricted meeting setting.
- **Account support:** supported host account/tier and organization permissions
  must be demonstrated. No automatic subscription purchase or universal promise.
- **Operations:** background creation needs an explicitly running supervised loop;
  production enablement, deployment, real Google API use and production data changes
  require their own authorization. No such action is authorized here.

Acceptance: connection is optional and secure; new eligible confirmed bookings
receive at most one authoritative valid private link without blocking confirmation;
ambiguous creates do not replay automatically; all authorized views reference that
same record; manual links and existing lifecycle/permissions/history remain valid;
in-flight stale work cannot attach; verification evidence distinguishes simulated
transport tests from an authorized real-provider test. No attendance/payment claims.

## Approval gate and downstream handoff

- **APPROVED — user approval recorded on 2026-10-26:** “OKAY APPROVED”, directly
  responding to the request to approve this exact blueprint for the separate
  implementation workflow. No additional scope was approved.
- Approved scope: this optional tutor-owned, direct-Meet, future-confirmation
  design; additive credential/job/provenance migrations; the opt-in local supervised
  runner; context reconciliation; the incremental implementation/test scope above.
- Approval does not authorize deployment, production changes, external provider
  setup/calls, purchasing accounts, or public launch. These remain later operational
  gates, not blockers to implementing disabled local code with a fake transport.
- With this full-blueprint approval, a **separate implementation workflow**
  can build one slice at a time, followed by separate read-only review, independent
  verification and evidence-based memory/progress updates. Architect stops here.

## Primary references inspected on 2026-10-26

- [Meet create method](https://developers.google.com/workspace/meet/api/reference/rest/v2/spaces/create): request/response and creation scope; no documented request-id field.
- [Meet spaces resource](https://developers.google.com/workspace/meet/api/reference/rest/v2/spaces): generated identity, configuration and stable methods; no delete/list method.
- [Meet authentication and scopes](https://developers.google.com/workspace/meet/api/guides/authenticate-authorize): user authorization and sensitive created-space scope.
- [Node quickstart prerequisites](https://developers.google.com/workspace/meet/api/guides/quickstart/nodejs): Google Cloud project and Meet-enabled Google Workspace account.
- [OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server): server-side code/offline access and redirect registration.
- [OIDC identity validation](https://developers.google.com/identity/openid-connect/openid-connect): validated claims and stable subject identity.
- [OAuth token expiry](https://developers.google.com/identity/protocols/oauth2): external testing-mode seven-day refresh-token rule.
- [Meeting-space configuration](https://developers.google.com/workspace/meet/api/guides/meeting-spaces-configuration): host settings/artifact configuration; avoid unsupported safety promises.
- [Meet API limits](https://developers.google.com/workspace/meet/api/guides/limits): quota handling and backoff.
- [OAuth security BCP, RFC 9700](https://www.rfc-editor.org/info/rfc9700/): authorization-code-flow protections including PKCE.

## Approved verification-unblock patch — 2026-10-27

The user explicitly approved applying Next.js and matching eslint-config-next
from 16.4.0 to exact 16.4.3 in this checkout, then continuing verification.
This adds only the compatible framework patch and its required lockfile changes;
no broad dependency upgrade, security bypass, provider activation, deployment or
production change is authorized. Re-review the dependency diff, run the existing
check/build commands and scoped Playwright acceptance, and preserve earlier valid
PostgreSQL evidence unless affected code changes.

## Supplemental plan — Personal Gmail provider acceptance (2026-10-27)

### Status and authority

**APPROVED — user authorized Computer Use setup with their selected logged-in
personal Google account on 2026-10-27.** This authorizes the bounded local test
setup and provider acceptance below, without purchasing Workspace, enabling
billing or production access. Legal agreements and authentication changes retain
the Computer Use action-time confirmation/human-handoff requirements.
This section does not change the implemented feature or framework-patch approval. Keep the current implementation; first establish account compatibility.
Observed repository: `/Users/cob/learli`, branch
`feature/google-meet-provisioning`, baseline HEAD `6d9a8fc`, dirty Meet work and
pre-existing untracked `designs/`. Preserve all of it, including generated
`next-env.d.ts`; no checkout, reset, migration or code change is planned here.

### Outcome, requirement mapping and language

Owner: existing **M5.1** provider acceptance, **MEET-01/02/03**, **TUT-06** and the
authorization/booking invariants already mapped above. No new milestone.
Prove whether one dedicated personal Gmail host can authorize the existing
direct-Meet connector, create a space with its required restricted configuration,
and host an authorized synthetic Learli booking. A Google Cloud project is the
app's API/OAuth configuration; it is not a tutor Workspace subscription. No
additional terminology decision is needed.

Existing code: `src/features/google-meet/config.ts`, `provider.ts`, connection
page/routes, `scripts/google-meet-worker-setup.ts`, `scripts/run-with-meet.ts`,
and the private shared-link service. The tracker records local automated evidence;
that evidence is not live Google acceptance. Official quickstart lists Workspace,
while the create reference does not explicitly settle personal-account support.
Neither absence of a restriction nor one generic API failure proves compatibility.

### Scope, decisions and invariants

- User-approved: try the user-selected personal Gmail host before considering
  a paid account. No purchase, trial subscription, billing
  activation or domain purchase in this slice.
- Reuse tutor-owned optional OAuth, manual fallback, exact existing scopes
  (`openid`, `email`, `meetings.space.created`), private link authorization,
  restricted admission and non-idempotent-create protections.
- Use only synthetic Learli records and the user-selected Google host. Human host signs
  into Google and approves consent personally. No Google passwords/secrets in
  chat, Git, screenshots or logs. No real children, customer data or notifications.
- No Calendar permission/event fallback, service account, shared platform host,
  production/Railway change, attendance claim, payment or weaker meeting settings.
- Data/schema/API/UI changes: **None planned.** Limited local configuration,
  restricted local worker credential and prospective test booking only after
  explicit approval. Existing links, history and user changes remain intact.

### Ordered execution by the separate implementation/verification workflow

1. Owner supplies the selected personal Gmail account and sets up/selects a
   dedicated non-production Google Cloud project. Enable Meet API; create a Web
   application OAuth client, External testing consent and that host as test user.
   Stop rather than accepting any billing/subscription requirement automatically.
   Register the exact configured local callback, currently
   `http://127.0.0.1:3000/api/tutor/meeting-providers/google/callback`.
2. Owner stores client ID/secret privately outside Git/chat. Downstream operator
   prepares the restricted worker with the existing guarded command, generates
   the local encryption key and configures the documented variables. Inspect
   existing private configuration before writing; never overwrite saved keys or
   an existing worker credential. No new migration or historical job backfill.
3. Start the explicit local launcher only for the authorized test. Sign into a
   synthetic Tutor, open Meeting setup and consent/connect using the Gmail host.
   Keep Google configuration errors, refused consent and account restrictions
   distinct. If OAuth fails, diagnose the safe error category before concluding
   that a paid account is required.
4. Create one new eligible confirmed synthetic booking through Learli's normal
   workflow. Verify the durable job attaches one authoritative private link and
   leaves booking/payment state unchanged. Check authorized Parent/Student/Tutor
   views and unrelated-account refusal. Open the same link in separate authorized
   browser sessions; the human Tutor verifies hosting/admission and participants
   verify joining. Do not log/publish the link or infer attendance/completion.
5. Record account-type-specific results and stop the test services. Preserve
   receipts/history. If successful, describe only the tested personal-account
   workflow as supported; do not promise all accounts/settings work. If blocked,
   distinguish a fixable configuration problem from an established account-tier
   limitation. Present evidence/options before any purchase or alternative design.

### Failure handling, evidence and rollback

An ambiguous create must never be blindly retried. Keep the existing uncertain
state and manual fallback. Never remove restricted access to make the test pass.
Test-mode token expiry and renewal are separate from account compatibility.
If stopping, halt the launcher and disable new provider work; existing links,
bookings, encryption keys, receipts and audit history remain preserved. A copied
remote link is not revoked by hiding it in Learli. No automatic remote deletion,
database cleanup or down-migration.

Separate verifier collects sanitized PASS/FAIL/NOT RUN for OAuth and identity
binding, effective restricted settings, one authoritative link installation,
participant access denial, real host admission/joining and preserved booking
state. Reuse the earlier automated check/build/PostgreSQL/Playwright evidence
unless implementation changes invalidate it; rerun affected checks after repairs.
**Verification for this supplemental plan: NOT RUN — architecture planning only.**

### Context updates and approval gate

After authorized execution, update `context/progress-tracker.md` with actual
results and `docs/operations/google-meet.md` with demonstrated account support.
Reconcile governing PRD/architecture wording only if evidence establishes a new
supported contract. Do not advertise broad free-account support from inference.

**Blueprint ready; user approved this limited local Gmail/provider setup on
2026-10-27 and explicitly requested Computer Use with their logged-in account.**
Private Google client configuration is still needed. The separate resumed
implementation/verification workflow performs the authorized work. Any paid account,
Calendar-based redesign or public production activation needs its own decision.

### Supplemental local-client authorization and observed setup (2026-10-27)

The user explicitly approved the prepared **Learli Local Meet Web** client in
**Learli Meet Local Test**, private local credential storage and saving exactly
`openid`, `userinfo.email` and `meetings.space.created` metadata. Sole redirect:
`http://127.0.0.1:3000/api/tutor/meeting-providers/google/callback`. No JavaScript
origins, AI-agent flag, billing, publishing or other service scopes. Client and
scope save completed. Restricted worker and private encryption/configuration
prepared without schema changes or historical conversion. Actual account data
grant remains separately pending at Google consent; this approval is not evidence
of granted scopes, live space creation or personal-account support.

### Live consent approval and callback compatibility recovery (2026-10-27)

User specifically approved completing Google identity/email and app-created Meet
consent, with encrypted local storage for the existing synthetic Tutor. Consent
completed; first callbacks exposed Google's optional `iss` field, absent from the
strict allowlist. The in-scope recovery accepts only the exact Google issuer when
present, still rejects duplicate/unknown fields and preserves all binding/token
checks. A PostgreSQL regression failed before the repair and passed afterward;
live OAuth then connected successfully and survived refresh. No new migration,
permissions expansion or provider fallback. Space creation/admission/joining still
require prospective acceptance after normal Tutor screening; do not auto-approve
the pending synthetic Tutor. Exact results remain in the progress tracker.

### Bounded synthetic approval and live-create evidence (2026-10-27)

After completing assigned Admin MFA, the owner explicitly approved24hour local-only
synthetic identity/eligibility records for the existing fictional Tutor. Two exact
receipts and approval were saved through normal UI; no real-person screening or
general validity policy claimed. One normal Parent booking confirmed, with both
authorized dashboards referencing that record. The sole actual CreateSpace call
failed HTTP403 (Google metrics independently confirmed, API enabled); no private
link/receipt installed. Job remains blocked, not replayed. This is FAILED live
creation, with precise provider cause unknown; it does not establish Workspace
necessity. Next is safe diagnostic planning before controlled retest, preserving
current booking, encrypted grant, restricted settings and no-purchase boundaries.
No source/schema change or additional automated-suite result in this slice.

## Supplemental implementation plan — Diagnose live Google403 (2026-10-27)

### Status and handoff

**APPROVED — user explicitly replied “approve” to this diagnostic/retest plan.**
The original booking has since ended; its current-eligibility gate prohibits a
live retry. Diagnostics/tests may proceed. A separate request for one fresh future
synthetic booking is pending; do not create it without that decision. Main feature,
client/grant and24hour synthetic screening approvals above remain separately valid.
Repository `/Users/cob/learli`, observed branch `feature/google-meet-provisioning`,
HEAD `6d9a8fc`, existing dirty feature and `designs/` preserved. Reuse this branch
(proposed); do not create/reset/commit anything during planning. Downstream must
read AGENTS.md and all eight canonical context files in its required order, this
blueprint and the existing recovery note. No terminology clarification needed.

### Outcome and requirement mapping

Primary M5.1 recovery; related M5.2/5/11, MEET-01/02/03, NFR-04/05/06/09 and the
existing booking/authentication invariants. Capture a safe documented Google
failure category from one controlled attempt and retain a truthful booking result.
OAuth Connected is not proof of space-creation capability. The current private
receipt/Cloud UI establish one403 CreateSpace failure, API Enabled, one confirmed
booking, one blocked/create_rejected job, attempts1 and no link/space receipt.
`provider.ts` currently discards response detail before mapping400/401/403 to
create_rejected. The existing normal worker never requeues that blocked result.

### Scope and architectural decisions

1. Add bounded safe diagnostic extraction without changing business failure codes,
   public error responses, OAuth scopes, worker credentials or job retry policy.
2. A single explicit owned-local recovery command may retry ONLY the exact known
   rejected job, after separate automated verification and current eligibility
   checks. This is a proposed one-off local operator action, not a public retry
   feature or permission to reset arbitrary jobs. Approval of this section includes
   that one controlled retest only if all preconditions still hold.
3. Preserve the confirmed booking, logical request, confirmation event, manual-link
   precedence, restricted room configuration and current actor/policy/grant fences.
   No new booking, historical conversion, weaker settings or fabricated link.
4. No Workspace purchase, billing/trial, Calendar fallback, new scope, replacement
   host, public publishing, production/Railway action or normal screening policy
   change. Current synthetic receipts still expire2026-10-28T07:10Z; never extend
   them implicitly. Broader choices return for an explicit decision.

### Affected modules and data

- Existing `src/features/google-meet/provider.ts`: bounded rejection-body parser
  and optional finite diagnostic metadata on GoogleFailure. Keep create non-retrying.
- Existing `worker.ts` and `scripts/google-meet-worker.ts`: safe local diagnostic
  reporting only where needed; keep existing lease/receipt/install/failure logic.
- Proposed `scripts/google-meet-retry-local.ts`: narrow explicit operator command
  using existing owned-local configuration/directory guards and worker factory.
  No HTTP route, general framework, database role expansion or new migration.
- Existing unit/PG integration tests and proposed focused operator tests; operations
  runbook, recovery note and tracker after approved implementation/verification.
  No dashboard redesign or changes to meeting-link visibility contracts.

### Diagnostic contract and privacy

Bound HTTP error-body reads by the existing10second deadline and64KiB cap; malformed,
large or unexpected bodies fail closed to an unclassified category. Emit/store
only numeric HTTP status plus finite recognized Google status/reason categories
from a reviewed allowlist. Never echo raw messages/bodies, arbitrary metadata,
headers, tokens/codes/cookies, account labels, project identifiers, space identifiers,
private links or learner data. Unknown reasons remain unknown; don't derive
“Workspace required” from403/PERMISSION_DENIED alone. Use private owner-only local
receipts for the allowed diagnostic summary and the operator attempt history.
No diagnostics returned to unrelated dashboard users.

### Controlled recovery and failure states

Stop the owned polling launcher before the operator command. No HTTP in a SQL
transaction. Before any mutation, record a private immutable sanitized before-state
receipt; refuse collisions or uncertain previous operator execution. Validate the
owned loopback development target, exact existing booking/job identifiers, matching
fingerprint/connection generation, active grant, current domain eligibility,
confirmed future booking, no replacement/manual link, no space/URI receipt,
blocked/create_rejected state, attempts exactly1, and the recorded known403 outcome.
Reject uncertain/dispatched/ready/changed/expired targets and unrelated queued work.
Use the existing tutor→booking→connection→job lock order for the guarded rearm.

Only after approval/current guards, clear the failed dispatch/claim lease for this
exact job into pending without reducing attempts or deleting the before-state
receipt. Run one batch of the existing restricted worker with limit1 while the
normal poller remains stopped; receipt/install still use existing SQL authority.
Refuse a second invocation after the attempt count changes. On crash/ambiguous I/O,
retain the uncertain/dispatched result and never replay. On another refusal, retain
blocked/error state plus safe diagnostics. If the result is retryable/pending,
keep the polling worker stopped rather than permit another automatic call. Do not
resume it until that prospective continuation is deliberately resolved. No
booking, payment, notification or session-completion transition is caused by retry.

If the real response identifies an in-scope implementation defect, prepare the
smallest focused repair and regression test under the existing build workflow;
material permission/account/cost/design changes need separate approval. If the
reason is still unclassified, report that limit rather than claim a diagnosis.

### Implementation and separate verification sequence

1. Implement error classification plus pure privacy/size/deadline tests. Demonstrate
   recognized403 detail survives while arbitrary sensitive strings do not escape.
2. Implement the exact-job operator guard and real-PostgreSQL denial/concurrency
   checks: wrong target, changed connection, expired screening/booking, manual link,
   prior receipt, non-rejection/uncertain result, repeat invocation and competing
   claim. Verify attempts/history and existing installation fences remain correct.
3. Separate read-only Review against this scope, then execute npm run check,
   affected Google Meet/private-link PG suites, production build and scoped
   Playwright where affected. Reuse unrelated evidence only for unchanged paths.
4. Only after passing checks, perform the approved single local operator retest if
   its exact target remains eligible. No request if guards fail. Capture a safe
   diagnostic category and counts, preserving the one existing booking.
5. If successful, verify the same private installed link in authorized Parent/Tutor
   views and unrelated-account refusal. Real host/participant admission remains a
   separate human-supported check; never infer attendance/completion. If refused,
   report the proven reason or unknown, manual fallback and next bounded decision.
6. Update actual context/progress/runbook/recovery, perform final scoped Review,
   and use Remember through the separate coordinator. No commit/deploy implied.

### Risks, rollback and approval gate

The main risk is duplicating a non-idempotent remote create; exact known-rejection
preconditions, one-shot operation, retained attempt count and fail-closed crashes
are mandatory. Diagnostic allowlisting can yield an unknown result; that is safer
than exposing provider payloads. No schema rollback required. Stop the explicit
worker to contain provider activity, retaining keys/connection/jobs/booking/history.
Source rollback must never automatically rerun the blocked job. No active remote
conference is deleted or ended for cleanup.

**Verification status: NOT RUN — architecture planning only.** No application,
configuration, database or service changes made by Architect. Existing evidence
above is historical supplied verification. Blueprint was approved by the user with “approve”. Diagnostic implementation
may proceed; its live retry remains subject to the documented current-eligibility
gate. The exact original booking is now ended, so it must not be retried.

### Diagnostic execution reconciliation

At implementation start, UTC clock2026-10-27T10:11Z established that the original
08:30–09:30UTC booking had ended. The current-eligibility condition therefore
forbids rearming it; no job reset or retry command has been run. Asked the owner
for one fresh synthetic booking on Oct28,10–11AM Manila within the existing
24hour synthetic screening window, after passing checks and availability validation.
That distinct live operation is pending; it is not authorized by elapsed time.
Diagnostic parsing/reporting and relevant tests can proceed independently. Defer
building a general job-recovery command for an expired target until the owner
selects the actual retest path; do not introduce unused recovery machinery.

### Authorized future-booking outcome — 2026-10-27

Owner selected **Approve one future test booking** for Oct28,10–11AM Manila,
after passing checks and current availability validation. This specific normal
booking replaces the expired-target retry as the live diagnostic operation;
no general rearm operator was implemented or needed. Original job untouched.

One normal Parent submission saved one confirmed no-money booking with correct
associations and UTC02:00–03:00/Asia-Manila receipt. The restricted worker sent
one creation attempt, recorded blocked/create_rejected/attempts1, no space/link.
Safe diagnostic: HTTP403, PERMISSION_DENIED, UNCLASSIFIED reason. This establishes
Google's refusal but not its exact account/project/policy cause. No blind replay,
weaker access, payment, purchase, extra grant or production action occurred.
Parent/Tutor views agree; parent sees tutor must arrange the link, tutor has
manual fallback. Original ended booking/time/job/attempt count retained.
Final read-only counts2bookings/2jobs/0links. Private evidence under
`.local/google-meet/diagnostics-live-result.json`, `diagnostics-parent.jpg`,
`diagnostics-tutor.jpg`, `diagnostics-runtime.log`. Existing account timezone
preferences remain UTC; displayed02:00–03:00UTC equals10–11AM Manila.

Separate verification on this source: check2367 tests/164files plus format/lint/
typecheck PASS; targeted real-PG54/54 PASS; production build PASS; scoped Playwright
6/6 PASS. Same-agent scoped read-only Review found no confirmed diagnostic issues;
READY FOR VERIFICATION was followed by those executed checks. Full provider
acceptance remains FAIL403; no real room/admission/joining verified. Next requires
a bounded provider/account decision, not repeated bookings to chase success.
