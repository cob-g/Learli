# Local performance baseline

This NFR-08 / M8.9 tool measures the existing local simulation on a production
Next.js build. It records real public HTML navigation and authenticated booking
HTTP response times. It does not choose an SLA or establish production, physical
mobile device, mobile field, hosted-provider or target-connection performance.

**Current local package: verified2026-10-12.** Final own check685/build and
exclusive2-repetition workload passed, with136 samples and actual PostgreSQL
conflict/retry/ownership/history/cleanup proof. Root independently accepted
timing/source applicability (msg_344ec01fee44). See [Observed local baseline](#observed-local-baseline--2026-10-12)
for all distributions, conditions and limitations; physical-device/hosted/whole-
milestone acceptance remains separate. The failed original setup is preserved.

## Safe setup

Use the repository-pinned Node/npm and `npm ci`. In a supervised wave, obtain a
normal heavy slot before installation, setup, whole checks or build. Obtain both
heavy slots exclusively before timing; no other wave heavy job may run then.
Use only your own checkout/credentials/data. Worker 6's ports are shown below;
another operator must use its own allocated ports from private database state.

```sh
npm ci
LEARLI_DB_PORT=55506 LEARLI_DEV_PORT=3066 LEARLI_TEST_PORT=3166 npm run local:setup
npm run check
NEXT_TELEMETRY_DISABLED=1 npm run build
```

Setup generates `.env.test.local` with APP_ENV=test, AUTH_MODE=local, loopback
`learli_test` and private owner/runtime credentials. The dev seed populates only
`learli_dev`; the harness requires an empty test user/tutor/learner/booking dataset
and an active migrated Math subject. It never adopts a remote database, another
port, an existing application listener or credentials not matching owned state.
It never resets existing fixtures or changes production caps. Preserve a refused
dataset and diagnose it; do not delete unrelated records to satisfy the guard.

The operator must confirm the root-accepted dependency/runtime candidate, including
any diagnostics imports, and rebuild before recording that candidate's timings.
The explicit slot/candidate environment labels below record this coordination;
they do not independently prove machine exclusivity or grant permission.

```sh
LEARLI_DB_PORT=55506 LEARLI_TEST_PORT=3166 \
PERFORMANCE_SLOT=exclusive PERFORMANCE_CANDIDATE=coordinator-accepted-candidate \
NEXT_TELEMETRY_DISABLED=1 \
node scripts/with-test-env.mjs node scripts/performance-baseline.mjs
```

No workload overrides or arbitrary target URL are accepted. The runner starts
and stops its own `next start` on the private test origin. Existing Playwright
Chromium must be installed; it does not download a browser or enable telemetry.
All browser requests outside that exact loopback origin are blocked with CDP
interception, service workers are disabled, and no meeting/provider is opened.
Private provider sessions exist only in request contexts; no forged auth cookies,
HTML bodies, screenshots, traces or request payloads enter the summary.

## Dataset and measurement

Each invocation creates 24 synthetic approved tutors, one actual Math offering
per tutor (High School and College Support), seven 18:00–20:00 local weekly
windows and one dated exception per tutor. Teaching zones alternate UTC, Manila
and New York. Two provider-created synthetic `.test` accounts receive owner-only
verification/student/self-learner fixtures; both sign in through Better Auth.
Two real API reservations supply busy data before page measurement.

There are two repetitions. Each navigates the plain directory, actual-date
directory (24 profiles, two bounded provider batches) and one actual-date profile
at desktop 1440×900 and phone-sized 390×844. Each route/viewport/cache cell has
one discarded warmup and three recorded samples: fresh browser context per
navigation or one reused context. Server/DB/OS caches remain warm/uncontrolled;
resource cache hits are observed in the output, not assumed from the label.
No network or CPU throttling is applied. Navigation Timing measures TTFB, end
of HTML response, DOMContentLoaded and load; rendered rows/options are asserted
after load. Hydration/interaction readiness, LCP/INP/CLS and field data are not
measured. The phone-sized viewport is desktop Chromium on the same machine.

Two untimed conflict-pair warmups precede 8 measured pairs per repetition, each
using a different tutor and one selected real candidate. Two independently
authenticated accounts concurrently request the same slot. Timing surrounds
request dispatch through response-body consumption in Playwright APIRequestContext.
Successful 200, actual slot-conflict 409, availability GET and same-key retry 200
are separate distributions. Each pair must leave exactly one booking and one
creation event; replay must retain its ID. Foreign-learner availability must
return 404. A 409 quota failure is rejected, never counted as overlap latency.
Setup, candidate selection, proof queries and cleanup are outside booking POST
timings. Concurrency is two; this is not a sustained throughput/capacity test.

The fixed workload permits at most 20 successful reservations for either actor
(2 initial + 2 warmup + 16 measured); no quota/rate/TTL is weakened. Each summary
records hardware/OS/runtime/browser/PostgreSQL versions, source/dependency SHA256,
dataset sizes, start/end timestamps, raw timing-only samples and sample-size,
min/mean/p50/p95/max in milliseconds. Percentiles use nearest rank, with no outlier
discard. For n=3 or n=8, p95 is the sample maximum; interpret these small samples
as exploratory observations rather than reliable population tails.

## Evidence, failure and teardown

Output is ignored `.local/readiness-wave/performance-<timestamp>/results.json`.
The source manifest includes dirty/untracked source files as well as Git HEAD;
HEAD alone is insufficient. The private registry retains exact fixture IDs and
synthetic emails for recovery. Original server logs stay private and are never
copied to tracked reports. Failures retain the partial stage/timings and exit 1.
Any failed invariant invalidates that run as a successful baseline.

Finally, exact owned tutor reservations, queued notices, events, profiles,
learners, account audit entries and users are deleted in one owner transaction;
baseline subjects and provider throttle housekeeping stay intact. It never
deletes arbitrary records or resets global rate-limit counters. Cleanup failure
also exits 1 and preserves the registry; diagnose before a subsequent run.
An abrupt OS/process kill can prevent finally, so inspect the private registry
and owned database before rerunning. Auth verification captures remain private
local artifacts, not sent email.

Run the discovered safety/statistics tests with
`npm test -- tests/unit/performance-baseline.test.ts`. Root owns combined test
registration/CI and independent review. Same-agent Review and executed Verify
must be recorded separately in the worker report. Actual local evidence is
recorded in the tracker; implementation alone does not promote M8.9 or NFR-08.

Before selecting quantitative thresholds, the next owner must measure approved
physical target devices and realistic connection profiles, then staging/hosted
latency under separately authorized conditions. Compare matching source,
dependencies, data shape, cache policy and workload; do not optimize runtime on
the strength of this isolated tool package alone.

## Observed local baseline — 2026-10-12

Successful run: 02:05:51–02:06:12 UTC (10:05:51–10:06:12 Asia/Manila),
exclusive A+B authority msg_29ea3dca9e92. Apple M5,10 logical CPUs,16 GiB RAM,
Darwin25.5.0 arm64; Node24.20.0/npm11.19.0, PostgreSQL17.11, Next16.4.0,
Better Auth1.7.7, Playwright1.64.0 and bundled Chromium156.0.8078.4.
Production build ID `2S3koc_DzKfQ1EOxR033u`; baseline HEAD5634e44 plus exact
coordinator diagnostics/CSS/email-focus/booking-focus imports and owned harness.
Runtime/source332-file aggregate SHA256:
`ff0ecabe9b18784e837f31fddca8ab3c8b00f005d4df576819b787248173966f`.
Unchanged dependencies match the root-accepted package/lockfile hashes.

Observed setup rows:26 users,8 catalog subjects (1 subject exercised),24 tutors,
24 offerings,168 weekly windows,24 exceptions,2 self-managed learners and2
initial reservations. The two checked warmup pairs add2 reservations before
public repetition1;8 measured pairs then make12 before public repetition2,
and the final8 make20. These derived counts follow the executed one-row/event
proofs; repetitions share a growing bounded busy dataset. No policy/cap changed.

72 public load samples and64 HTTP samples were retained;24 page warmups and2
booking-pair warmups were discarded from distributions. Fresh-context samples
observed0 cached resources; reused-context samples observed13 or14. The server/
DB/OS were warm/uncontrolled, with no CPU/network throttling. Phone-sized means
desktop headless Chromium at390×844, not a physical phone or field measurement.

| Surface / viewport / cache                           | n per repetition | Rep 1 p50 / p95 ms | Rep 2 p50 / p95 ms |
| ---------------------------------------------------- | ---------------: | -----------------: | -----------------: |
| directory / desktop / fresh-context                  |                3 |        67.7 / 74.2 |        60.9 / 68.5 |
| directory / desktop / warm-context                   |                3 |        59.4 / 72.6 |      64.0 / 1054.2 |
| directory / phone-sized / fresh-context              |                3 |        63.9 / 64.1 |        61.3 / 88.4 |
| directory / phone-sized / warm-context               |                3 |        59.5 / 91.2 |       61.8 / 117.3 |
| directory-availability / desktop / fresh-context     |                3 |      328.1 / 333.2 |      323.8 / 402.9 |
| directory-availability / desktop / warm-context      |                3 |      329.7 / 337.7 |      304.5 / 314.1 |
| directory-availability / phone-sized / fresh-context |                3 |      321.9 / 332.3 |      293.0 / 294.4 |
| directory-availability / phone-sized / warm-context  |                3 |      339.6 / 374.2 |      296.0 / 369.7 |
| profile-availability / desktop / fresh-context       |                3 |        72.4 / 97.4 |        71.5 / 72.9 |
| profile-availability / desktop / warm-context        |                3 |        72.1 / 74.6 |        69.4 / 89.4 |
| profile-availability / phone-sized / fresh-context   |                3 |        72.8 / 75.2 |        72.7 / 74.0 |
| profile-availability / phone-sized / warm-context    |                3 |        72.9 / 97.6 |        65.7 / 66.3 |

| HTTP outcome               | n per repetition | Rep 1 p50 / p95 ms | Rep 2 p50 / p95 ms |
| -------------------------- | ---------------: | -----------------: | -----------------: |
| authenticated-availability |                8 |      15.16 / 18.22 |      13.97 / 36.33 |
| booking-success            |                8 |       8.18 / 10.70 |       8.06 / 11.36 |
| booking-conflict           |                8 |      12.55 / 15.51 |      12.47 / 15.78 |
| booking-retry              |                8 |       3.67 / 19.02 |        3.52 / 3.99 |

Nearest-rank p95 equals the maximum at these small sample sizes. The1,054.2ms
repetition2 desktop reused-context plain-directory outlier is preserved.
Full raw samples, TTFB/HTML/DOMContentLoaded/load/resource sizes, min/mean/max,
source manifest and conditions are retained in ignored
`.local/readiness-wave/performance-2026-10-12T02-05-51-234Z/results.json`.

All18 pairs (2 warmup +16 measured) produced one200, one actual slot-conflict409,
one saved reservation and one creation event; exact-key retries retained the ID.
Cross-owner availability returned404. Owned cleanup and empty-data proof passed;
server/browser/pool closed and both slots released. No outside-origin request was
observed by the enabled interception.

First attempt failed before samples because fixture learner/tutor emails collided.
The original zero-sample result and passed cleanup are preserved; distinct bounded
identity namespaces and a26-identity regression repaired the harness. Current
separate verification passed22 focused cases, full check685/37files with format/
lint/typecheck, and final production build. Same-agent Review is separate from
executed Verify; root reports independent source review with no performance finding.

Actual-date directory loads were typically slower than plain directory/profile
loads in this dataset. Query/candidate-generation/render contributions were not
profiled. Next: repeat on approved physical devices/connection profiles and hosted
staging before choosing thresholds or an optimization; do not infer a bottleneck
cause, throughput limit or production SLA from this local result.
