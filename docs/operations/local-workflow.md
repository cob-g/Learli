# Ordinary local workflow

This is the owner's single local application in the primary checkout on local
`main`. It replaces daily use of the separate private preview. It does not enable
Railway, Neon, Resend, payments or public launch. Executed check/startup evidence
is in `context/progress-tracker.md`.

## Runtime and preservation

- Canonical origin: `http://127.0.0.1:3000`; use this exact origin consistently.
- Owned PostgreSQL: loopback55432, `learli_dev`, restricted `learli_app` runtime.
- Explicit `LOCAL_WORKFLOW_MODE=enabled`, development/local auth/database.
- Runtime contains no owner connection, private audience packet, hosted/Neon
  selection or email-provider credentials. Owner preparation uses the checkout's
  private owned cluster marker/state, never an owner URL in application config.
- Existing Neon/private-preview databases, old accounts, events and source are
  retained. New ordinary records use `local_operation`; old simulation records are
  excluded from ordinary views and remain unchanged in their original modes.
- Private source/environment snapshots and a custom operating-database backup
  were saved before the migration. They are ignored and owner-readable only.

Do not run `local:setup`, fixture seeds, global E2E setup, restore drills or
resetting tests against this operating database. Standard automated runners use
`learli_test`; the opt-in ordinary-mode checks use a separately owned55434 cluster
with its own `learli_dev`. Test identities never become operating inventory.

## Accounts and verification

Start PostgreSQL with `npm run db:start`, then the app with `npm run dev`. Normal
valid email addresses are accepted. Password and verification protections remain.
Registration does not assign Admin or authorize a learner/tutor automatically.

Verification and reset messages are captured privately on this computer. After
submitting a request, run `npm run mail:open` in this checkout and follow the
actual provider link in that message. No email is sent to the address. Email
change codes use the same private capture. Do not share captures, proof links,
codes or auth cookies; the mailbox is not served by an HTTP route.

The first Admin is an exact registered, verified, active identity selected by the
owner. Explicit owner preparation grants Admin and narrow local staff capabilities;
it never promotes the first signup or infers an Admin from an email domain.
The owner command is `node --import tsx scripts/local-workflow.ts --apply --admin
EXACT_REGISTERED_USER_ID`. Existing incompatible or revoked staff records are
refused, never relabeled or revived. Complete the normal Admin MFA setup afterward.
No request body can grant this access.

## Daily role flow

1. A verified active Parent enrolls through account settings, then uses My
   Children → Add Child. Minimal details, explicit guardian confirmation and
   consent create a NEW private child profile ready for booking immediately.
   Ordinary creation, additional children and grade edits require no Admin
   approval. Email verification and the declaration are not proof of guardianship.
   Existing-account claims are separate; never link by name/email. Earlier pending
   requests remain intact.
2. A verified active eligible independent adult uses College Student setup to
   create one self-managed College Support profile with an explicit unchecked
   adult/legal-eligibility declaration. This self-attestation is unverified;
   College Support is an education level, not proof of adulthood. Successful
   atomic setup grants Student access without routine Admin admission. New
   ordinary independent requests do not enter the legacy review queue.
3. Tutor submits a profile, subjects/levels, time zone and hours, and requests
   screening. Unapproved or currently ineligible Tutors are not discoverable.
4. For tutor screening, historical v1 admissions and exceptional cases,
   current-MFA authorized Admin opens Unassigned reviews, claims an exact request,
   records the checks actually performed and explicitly decides access. Claiming
   alone creates neither evidence nor approval. Own/conflicting requests and
   another reviewer's assignments remain inaccessible.
5. Parent chooses their authorized child, or Student their authorized self
   profile, and an eligible available60-minute tutor slot. Valid new Parent-v2
   and Independent-v2 bookings confirm atomically under their exact terms without
   routine Admin confirmation or a provisional deadline. Confirmed means no-money
   coordination, never paid; payments remain disabled. Historical v1 bookings
   retain their original ten-minute provisional hold and assigned prerequisite
   review. No attendance is implied by confirmation.
6. The same saved booking is available to its authorized learner/guardian,
   assigned Tutor and specifically assigned Admin. Admin sees minimum coordination
   details and never receives participant meeting-link access.
7. Tutor supplies a validated private Zoom/Meet link. Learli does not create or
   host the meeting and does not verify attendance.
8. Authorized changes require60-minute notice and recheck availability/ownership.
   Rescheduling preserves history and retires the old private link. Confirmed
   legacy bookings survive their original provisional deadline. Assigned Tutor
   records completion only after saved scheduled end, independent of ending a video call.

Local operating settings retain30-minute start increments,60-minute advance
notice and a14-day booking horizon. No customer commercial terms, trial, price,
payment or refund is implied. Booking notification intents are durable; external
delivery is not configured. Saved reports use exact assigned local support;
staffing/public safeguarding and emergency response remain separate launch gates.

## Recovery and cleanup

Stop only the owned application if necessary. Preserve forward migrations and all
new records. Selecting a preserved previous runtime is a rollback option; it does
not authorize a data restore, record deletion, credential change or migration
rollback. The existing synthetic backup/restore drill intentionally rejects
ordinary personal data; do not widen that tool to force a restore.

The owner will request data cleanup separately. Do not delete existing accounts,
worktrees or either database as part of normal startup or this change.

Development and build explicitly use Next's supported webpack bundler. The
Turbopack compiler currently scans an ignored private backup link while resolving
private mailbox directories; retained backups are not removed to hide that
failure. `npm run build` and `npm run dev` select the verified compatible path.

The final local production build was verified with
`NODE_OPTIONS=--max-old-space-size=8192 npm run build`; the default approximately4GB
Node heap exhausted memory on a later rebuild. This is a local build resource
setting, not a new hosted deployment memory requirement. Ordinary runtime startup
was verified separately without that heap override.

Trusted Admin preparation locks both identity and account status, sharing the
supported restriction path's serialization. Do not use ad hoc owner SQL to grant
roles while account restrictions are in progress; the supported CLI and normal
restricted application path are the tested boundary.

The Oct18 automatic-parent-child decision adds guardian admission-v2 and Parent
booking-v2 without replacing the original v1 heads or receipts. Owner policy
preparation installs only exact additive receipts and refuses revoked or
incompatible state; it does not elevate an account unless an exact Admin was
explicitly selected. Newly attested children do not enter a routine Admin queue.
The Oct18 independent-adult-self-service decision adds distinct immutable
`local-independent-admission-v2` and `local-independent-booking-v2` receipts for
the independent path above. Historical admissions, policy receipts, evidence,
booking/history rows and audits remain unchanged and readable under their
original contracts; pending/rejected/revoked records are not auto-approved.
Independent minor access, existing-account linking, public-market eligibility
and consent/legal rules, and staffed safeguarding remain separate gates.

## Optional owner-only verification and password-reset email

By default all account messages stay in the private local capture. For an explicitly authorized Resend test, set both `LOCAL_VERIFICATION_RESEND_KEY` and `LOCAL_VERIFICATION_RECIPIENT` privately in `.env.local`, then restart the app. The recipient must be the exact address of the Resend account owner and the account receiving verification or password reset. The sender is `onboarding@resend.dev`; provider restrictions apply. Other verification/reset recipients are refused. Email-change and booking delivery rules are described below. Reset links expire after 30 minutes, are single use, and successful resets revoke existing sessions. The account link points to this computer’s loopback app and must be opened there. API acceptance does not establish inbox delivery. Remove both settings and restart to return to capture. Never commit keys or links; a verified owned sending domain and separate activation are required for general-user mail.

Email changes also use this optional setting: current/new-address codes go live
only to the exact configured account-owner mailbox. Use a synthetic `.test`
address for the counterpart, whose code remains in private local capture
(`npm run mail:open`). Other real recipients are refused; a failed live send
does not fall back to capture. Both codes are still required and expire after
five minutes. Never substitute recipients or put codes in navigation URLs.
The sender remains the Resend test sender until an owned domain is verified.

Resend documents its [test-sender account-recipient restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

### Booking lifecycle email

The same optional key/recipient settings also enable all seven ordinary local
booking notices: provisional, confirmed, rescheduled, cancelled, expired,
completed and no-show. The configured account owner must be a current authorized
participant of that booking. Other destinations are not redirected or emailed;
their delivery rows remain pending. Provisional messages include the actual deadline and say not confirmed;
completion/no-show describe recorded outcomes, not verified attendance. Without the settings, existing behavior
stays unchanged.

A successful workflow mutation schedules a bounded event-specific send after
the booking transaction commits and the HTTP response finishes. The durable
queue rechecks current permissions, latest revision, state and material before
provider I/O. Emails show genuine subject/schedule/timezone and a private record
link, not learner names or meeting URLs. Reschedule uses the replacement time.
Provider acceptance does not prove inbox delivery. Email failure does not undo
the booking, and an ambiguous send retains its original retry identity.

Authenticated workspace renders and successful booking GETs also schedule
maintenance at most once per minute per runtime pool. Before a non-event-specific
drain, up to25 due owner-linked tutors are reconciled through the existing expiry
function. Its tutor-level operation may expire other already-overdue holds; mail
remains limited to the exact current owner. Locks release before any provider
call. A contention failure leaves expiry for a later run and does not undo bookings.
No automatic completion/no-show or new hold duration is introduced.

Next after is best effort, not a durable clock scheduler. No activity means
expiry mail/retries may wait for explicit recovery; exact-deadline sending is not
guaranteed. To recover missed/due
retryable work explicitly, run `npm run delivery:local -- 25` (limit 1–25).
This loads the private local env, requires admitted local runtime authority,
selects only the exact current owner and seven kinds, and prints counts only.
Existing retry deadlines, attempt caps, immutable body/configuration and provider
idempotency retention still apply; no forced resend or public endpoint is added.
It may process other eligible owner rows up to the limit, so inspect the local
test scope before invocation. Do not use it to replay personal historical mail.

Remove both optional settings and restart to stop live local sends. No queue
history is deleted. A verified owned sending domain and separate activation are
still required for general-user/hosted sending.

The local provider attempt is bounded to three seconds and verification resend responses have a 3.5-second minimum for this test mode. This reduces provider-dependent timing differences under normal local conditions; it is not a production timing guarantee or proof of delivery.
