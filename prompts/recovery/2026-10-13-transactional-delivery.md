# W4 verification recovery

Authority: AUTHORIZED — build-feature delegation, Task task_5093c3ee1a3d /
Dispatch ctx_db1bf1931f45. Blueprint m8-10-transactional-delivery.md.

## R1 — scoped browser config working directory

Mode: Targeted Fix. Environment: own synthetic local checkout, no real users.
Observed `account-browser-chromium-1.log`: ERR_MODULE_NOT_FOUND resolves
tests/support/hosted-auth-app.ts relative to .local/transactional-delivery.
No browser assertions executed; process exited before fixture readiness. Explicit
listener inspection finds no occupied owned3194/3314/3414/56004 afterward.
Root cause: the private scoped config inherits relative webServer commands but
changes Playwright's default working directory to the private config directory.
Expected: actual accepted W3 source fixture runs from this checkout, excluding
unneeded W8 fixture startup during this scoped account-only run.
Recommended repair: set each retained webServer.cwd to process.cwd(), preserving
all source, assertions, default config and production guard behavior. No cleanup,
reset, timeout increase, assertion waiver or application edit is required.
Separate verifier must rerun the exact seven actual account/HTTPS/SDK/privacy
cases at own endpoints; original failure remains private evidence.
Recover executed no repairs or verification. Runtime checks1250, unit87 and
accountPG8 were observed before this failure and remain separate evidence.

## R2 — operator containment classified loader IPC as TCP

Mode: Targeted Fix, private test instrumentation only. `operator-1.log` retains
the failed assertion: actual registered command returned disabled, fetch0, but
the generic Socket.connect interceptor counted2 attempts as TCP. Read-only
installed tsx `require-CBjy4Foe.mjs` shows its module loader invokes
`net.createConnection(getIpcPath(process.ppid))` and absorbs IPC connection failure.
The interceptor did not distinguish Unix IPC paths from network host/port calls.
Recommendation: classify loader IPC separately and preserve strict refusal and
zero-count assertions for database/provider TCP and HTTP. Do not change operator,
configuration, disabled result, production transport or existing security guards.
The separate verifier must rerun the actual registered command, retaining its
original failure, and observe disabled/tcp0/fetch0 with private child proof.
Recover performed no repairs or execution. No real endpoint was contacted.

## R3 — guarded runtime database compatibility and Playwright declaration

Mode: Targeted Fix. Current check-2 passed format/lint, then strict types found
operator.ts passing W2 HostedRuntimePool to a native Pool-only binder. Independent
reviewer reported the same Important finding. W2 intentionally exposes guarded
query/connect leases, not a native Pool. A new cast or native-pool escape would
violate the accepted runtime contract.
Recommendation: bind the existing typed Database returned by W2/local composition;
use its short READ COMMITTED transaction for claim/prepare and ordinary independent
queries for pre-send/ACK. This preserves guarded leases through the already accepted
Drizzle boundary and requires no new provider changes or compatibility casts.
Also move Playwright timeout to test.setTimeout; its third argument is TestDetails,
not milliseconds, and remove one unused owned test import. Preserve all assertions.
Separate Review and Verify must cover current types, actual queue/SDK/database and
lock-release evidence after repair. Earlier current check failure remains retained.

## R4 — current queue PostgreSQL test1 findings

Observed queue-pg-1:18PASS/3FAIL across2files. The actual queue races/retry/ACK/
clock-boundary/lock-wait cases passed. Two migration grant checks reject at the
function inventory: the inherited84-function count omitted0027's two new private
functions. Actual permissions/constraints did not fail. Update the allocated exact
inventory to86, preserving every permitted-signature and grant-option check.
The guardian-revocation case's direct link UPDATE is correctly refused by W5's
admission consistency guard. Use real readAssignedAdmission/mutateAdmissionReview
with current reviewer MFA/exact assignment/revision and action revoke, rather than
bypassing any guard. Preserve the noSDK/two-suppression assertions.
Separate Verify must rerun affected grant/forward proof and actual revocation,
then full owned queue cases. No failed assertion is waived and no historical SQL,
domain permission or production operation changes. Original failure is retained.

## R5 — expiry test invoked a read-only candidate query

Observed queue-pg-3:23PASS/1FAIL across2files. Completion and no-show SDK notices
passed; expiry fixture stayed provisional because readWorkflowCandidates is a
read-only current availability projection, not the accepted expiry materializer.
Mode: Targeted Fix, owned new test only. Invoke the actual createPolicyReservation
service via the existing booking helper; its tutor transaction calls the accepted
expiry function before booking mutation. Retain committed expired event, stale
provisional suppression and exact expiry SDK assertions. Do not change provider
source or call an invented scheduler; rerun the affected test then the owned suite.

## R6 — browser heading assertion used the wrong exact label

Chromium booking-browser-chromium-1 reached actual request/confirmation and the
503 SDK failure with committed confirmed state intact, then failed an exact
heading assertion. The accepted W6 model labels confirmed as "Synthetic booking
confirmed"; the new owned test asked for "Synthetic confirmed booking".
Mode: Targeted Fix, owned assertion locator only. Correct it to the existing
model label, preserving exact matching and all DB/SDK/retry/privacy checks.
Retain the original failure and private DOM context; rerun the full browser case.

## R7 — cancellation confirmation is inside a closed details disclosure

Chromium booking-browser-chromium-2 passed confirmation/retry, responsive/axe,
move and its SDK notice, then timed out clicking the cancellation button. Accepted
booking detail source puts that button inside a closed details element; the test
never opened its "Cancel synthetic booking" summary. This is a new owned journey
setup omission, not missing domain capability. Mode: Targeted Fix, test interaction
only. Click the exact summary before its confirmation button; keep assertions,
180second total bound and all no-JS/uncertainty/privacy checks. Rerun full journey.

## R8 — fresh denied route metadata is not retained private booking material

Chrome3's blanket identifier assertion failed only after Back restored a requested
booking URL as a fresh denied page. Exact inspection found2 hits solely in the
current bookingId routing parameter and current URL bootstrap, learner ID/name0.
Account sign-out and new actor document passed all identifier checks before Back.
The denied document must permit only those2 exact current-route structures; all
prior identifier/detail/private-field checks stay intact, with explicit denied
heading and current-route checks. This distinguishes requested public path metadata
from retained private payload without removing needles generally or changing the
shared document/privacy boundary. Original failure/evidence remain private.

## R9 — guarded TLS operator fixture must respect local owner tooling

operator-hosted-pg-1 failed before sending: W8 correctly refused a fixture owner
named learli_migrator on learli_staging. Do not mock/relax requireFixtureOwner.
Create a fresh owned learli_owner/learli_test inside the disposable TLS cluster,
run actual W3/W5/W8/W6 fixtures and migrations, close their local sessions, preserve
the initial empty staging DB by renaming it, then rename that owned synthetic DB
for the actual guarded TLS operator. No borrowed records, guard relaxation,
production target or deletion. Separate verification must observe claim commit,
NOWAIT lock release, actual guarded leases/SDK, accepted CAS and terminal no-duplicate.

## R10 — browser history restores different safe entries across engines

Cross1:WebKit passed; Firefox passed the actual booking/outcome/SDK checks but
Back restored the new actor's /account entry, not Chromium/WebKit's fresh denied
/bookings/current-ID route. The test incorrectly required identical browser history
entry selection. Mode: Targeted Fix, exact owned history classification only.
Allow the observed safe account/sign-in/denied-current-route entries, require full
old private needles absent everywhere, and permit the2 exact routing fields only
when the current URL is that requested denied booking. Never strip other IDs or
payload fields. Preserve original cross failure and rerun both critical engines.
