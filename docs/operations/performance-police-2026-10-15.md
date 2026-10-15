# PERFORMANCE POLICE — 2026-10-15

Two measured optimizations are implemented and independently audited. Changes
remain uncommitted on `cob-g/performance-police-20261015`, based on local main
`45d88ffd25c386868872a839d4f3e2b90f5d2d42`. Local main and the original user's
checkout/security notes are preserved. No push, deployment, production data,
live provider or cloud operation occurred.

Private evidence: `/tmp/learli-performance-police-20261015/`.
Run: `run_0e95b457ccf1`. Exact sources, commands, raw samples, original failures,
worker outcomes and preservation checks are retained there.

## Exploration and findings

Nine GPT-6 Luna high investigators completed five domain investigations, two
cross-module investigations and two independent post-implementation audits.
Two GPT-6.1 Sol high workers independently verified and implemented the changes.
Requested/effective models match every launch receipt; all 11 tasks succeeded
and all worker resources are released. At most three workers ran concurrently;
timed work had one exclusive heavy-job owner within this operation.

Coverage includes all 31 feature modules, 56 API handlers, 22 schema source
files and 32 migrations: public discovery/matching/availability, booking and
family/tutor dashboards, account/auth/admin/private services, frontend rendering
and client networking, assets/fonts/bundles, connection pools, delivery and
operator/background processing, build/test tooling and resource lifecycles.
Cross-module reviews traced public input → catalog → DB batches → scheduling →
formatting → DTO/UI, and private dashboard/API → authorized SQL → schemas/indexes
and guarded runtime. `repository-inventory.json` and `coverage-map.json` record
the source inventory and ownership.

Six unique candidate groups were triaged: two confirmed measured bottlenecks
fixed, four potential improvements deferred, no remaining high-confidence
unverified finding, and no promoted candidate disproved. Priority: Critical 0,
High 1, Medium 1, Low 4. Corroborating A/F and B/G reports are deduplicated.

| Candidate                                                            | Priority | Outcome                                                                                        |
| -------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| PERF-A-01: repeated native time formatter construction               | High     | Fixed with bounded per-computation reuse; microbenchmark, real route and output evidence       |
| BPD-01: booking display projection before overview pagination        | Medium   | Fixed with page-selected projection; actual PostgreSQL plans and paired growth measurements    |
| PERF-E-01: serial admin tutor count/page reads                       | Low      | Deferred: route benefit unmeasured; parallelism increases five-connection-pool demand          |
| PERF-E-02: serial synthetic-readiness candidate batches              | Low      | Deferred: test-only workflow, no latency evidence; parallel batches could consume the pool     |
| PERF-F-02: unused intermediate slot formatting in directory/matching | Low      | Deferred: assess residual cost after simple reuse; broader DTO/profile/API contracts involved  |
| PERF-F-03: repeated profile local-day grouping scans                 | Low      | Deferred: bounded workload, render cost unprofiled; preserve DST and selected-day presentation |

Intentional tradeoffs remain: current authorization/TLS/lease checks, fresh
security decisions, bounded serial durable delivery and retry semantics, the
documented small-catalog strategy, and approved presentation effects. No
measurements justify weakening these, adding caching/concurrency/indexes or
rewriting architecture. Delivery, real-time, file-storage and AI infrastructure
were not invented where absent.

## Implemented changes and contracts

`src/features/bookings/format-time.ts` adds a reusable formatter factory while
preserving the existing `formatLessonTime` API. The public candidate reader
retains instances only within its current batch, bounded by one viewer zone and
20 tutor zones. It caches formatter objects, never dates, offsets, results or
authorization. The four native formatters per zone and lazy cross-day formatter
still process every actual endpoint. Viewer/tutor fields, exact strings and
normalization, invalid inputs, DST folds/gaps and non-hour zones are preserved.
No server dependency enters the shared browser-safe module.

`src/features/bookings/read-query.ts` carries display scalars through the same
authorized relation and constructs JSON/correlated policy/head fields only for
selected page rows. Actor, relation/filter, authorization joins/predicates,
pagination and learner-summary sections are byte-identical. It remains one
read-only READ COMMITTED statement; global earliest expiry still covers every
permitted active timed row. List/detail/history, ordering, sentinels, current
heads, policy values and event history retain their contracts. Actual plans,+rather than a generic CTE assumption, establish the removed work; see the
[PostgreSQL 17 CTE reference](https://www.postgresql.org/docs/17/queries-with.html#QUERIES-WITH-CTE-MATERIALIZATION)
for background only.

Three application files changed, with 21 new deterministic unit regressions in
`tests/unit/lesson-time-format.test.ts` and one real-PostgreSQL regression in
`tests/integration/booking-overview-projection.test.ts`. No existing tests were
edited. The remaining changed files are this report and the progress tracker:
seven paths total. No schema/index/migration, dependency, pool size, shared
cache, new parallel execution, security control or business policy changed.

## Performance results and conditions

Apple M5, 10 logical CPUs, 16 GiB RAM, Darwin 25.5.0 arm64, Node 24.20.0,
npm 11.19.0, PostgreSQL 17.11, pinned Next 16.4.0/Better Auth 1.7.7/Playwright
1.64.0/Chromium 156.0.8078.4. Only owned loopback synthetic environments were
used. Source/dependency identities and all raw samples are retained. No
quantitative product target or production SLA was invented.

### Production-build page workload

The existing fixed harness ran successfully before edits, after formatter
integration and again on the final combined runtime source. Each run uses 24
synthetic tutors, 168 weekly windows, 24 exceptions, two real local-provider
accounts, a 14-day horizon, desktop/phone-sized Chromium viewports, fresh/reused
browser contexts, two repetitions and the same workload/dataset counts.
Each retains 72 page plus 64 API timing samples, with 18 booking invariant
groups including two warmups; foreign ownership denial and exact cleanup pass.
Source equivalence covers all 608 runtime-manifest entries, with only the three
intended application files differing from baseline.

Final comparison below aggregates the identical viewport/cache/repetition mix
(24 samples per page route). Values are nearest-rank exploratory observations.

| Page workflow               | Before p50 / p95 ms | Final p50 / p95 ms |                        Median reduction |
| --------------------------- | ------------------: | -----------------: | --------------------------------------: |
| Actual-date tutor directory |       287.9 / 343.7 |        94.5 / 98.6 |                        193.4 ms / 67.2% |
| Profile availability        |         61.2 / 69.2 |        52.0 / 56.3 |                          9.2 ms / 15.0% |
| Plain directory             |         46.4 / 65.0 |        45.2 / 50.0 | 1.2 ms; no meaningful improvement claim |

The separate formatter-only candidate run observed directory median 93.5 ms,
consistent with the final combined 94.5 ms. The final run used a new owned
cluster/loopback ports; prior test data was preserved rather than reset.
Runtime, dependencies, dataset and protocol match; warm server/DB/OS caches and
available memory remain uncontrolled on a shared development machine. There
are only three page samples per individual viewport/cache/repetition cell;
aggregation does not establish population tails or device/field performance.

API timings did not show a universal improvement. In the final comparison,
booking success median is 8.782 → 8.896 ms and conflict 13.759 → 14.046 ms;
p95 is 10.918 → 13.647 and 16.306 → 18.684 ms respectively (16 samples each).
All functional invariants pass, but these mixed/noisy movements are retained;
no API speedup or stable tail guarantee is claimed.

### Isolated formatting work

Forty ordinary-GC alternating samples per variant for 1,008 synthetic intervals
measure median 190.395 → 13.119 ms, a 177.276 ms / 93.1% reduction, and native
formatter constructions 8,064 → 24. Complete serialized outputs match. A
DST-fold workload and a one-profile workload also improve; all 596 raw timed
samples across the original and diagnostic protocols are retained. Severe
ordinary-GC tails remain, including a 712 ms candidate DST sample. Forced-GC
diagnostics are explicitly separate, with deliberate GC excluded from timing;
they are not a production model. Object counts are not retained bytes/RSS or
proof of a memory leak. Generation, DB, serialization hashing and rendering are
outside this isolated formatting timer.

### Booking overview growth experiment

Actual typed-source SQL runs on the same connection/session and synthetic
fixtures, with five warmup pairs then 30 alternating pairs per size/scope.
Histories 0/20/100/1,000 retain 24 active rows; guardian/student/tutor scopes give
12 cells and 720 normal query samples, plus separate EXPLAIN execution samples.
Every output field matches after normalizing only the changing snapshot clock.
Query timing includes local dispatch/response/JSON decoding, excluding auth,
pool checkout, route rendering and non-loopback network.

| 1,000-history scope | Before p50 / p95 ms | After p50 / p95 ms |  Median reduction |
| ------------------- | ------------------: | -----------------: | ----------------: |
| Guardian            |     62.263 / 66.647 |      4.363 / 4.857 | 57.900 ms / 93.0% |
| College student     |     66.402 / 68.651 |      4.406 / 4.790 | 61.996 ms / 93.4% |
| Tutor               |     72.755 / 96.722 |      5.281 / 5.747 | 67.474 ms / 92.7% |

Actual head projection loops fall 1,024 → 42; the guardian paired plan records
70,743 → 2,985 shared hit blocks, with zero physical reads/temp writes in those
warm plans. Authorization and global expiry still inspect relevant rows; head
lookups still scan history per selected item. Histories 0/20 add 0.04–0.11 ms
wall overhead, while at 100 history rows the median saving is about 1 ms.
Real history distributions are unknown; this is a supported synthetic growth
experiment, not measured real dashboard/hosted latency or throughput.

## Validation and independent review

| Check                                                         | Observed result                                                                                                              |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Fresh baseline format/lint/types/unit/build                   | PASS; 1,691 tests / 115 files and ordinary production build                                                                  |
| Formatter worker                                              | PASS; 373 relevant tests including 21 new cases, scoped lint/format, strict compiler                                         |
| Overview worker                                               | PASS; 121 PostgreSQL cases / 7 files, 27 unit/component cases, 172 readiness output comparisons, types/lint/format           |
| Final combined `node scripts/with-test-env.mjs npm run check` | PASS; formatting, lint, Next typegen/strict types, 1,712 tests / 116 files                                                   |
| Final combined selected PostgreSQL suites                     | PASS; 153 tests / 10 files covering reads, dashboards, policies, lifecycle, links, public candidates, directory and matching |
| Ordinary combined production build                            | PASS; final fresh-cluster runtime-equivalent build also PASS                                                                 |
| Production performance harness                                | Three successful 136-sample runs; booking/ownership/retry/cleanup assertions PASS each                                       |
| Independent Luna audits H and I                               | PASS on exact integrated source and raw evidence; no corrective change required                                              |
| Final scoped documentation formatting and diff checks         | Recorded in `final-validation.json`                                                                                          |

The new query regression's identical final bytes fail on original source (124
head loops instead of 42) and pass on the candidate. It also checks global
expiry beyond the visible page, empty distant history, detail/event output and
invalid-session denial. Its exact plan-alias/loop assertion is validated on
pinned PostgreSQL 17; review its structural bound if supported planners change.
No timing thresholds or weakened existing tests were introduced.

Retained failures: missing explicit ports refused the first root workload before
setup/samples; a test getter-spy typing issue was corrected; an external tsx
harness needed private ESM configuration; the draft plan assertion initially
missed PostgreSQL's suffixed alias; test-only Drizzle typing was corrected.
Original errors and red/green runs remain in the evidence. No application guard
or existing assertion was weakened. Existing JSDOM document-navigation notices
remain in passing baseline and final runs. No unresolved failure in executed
final checks is hidden; unexecuted broader checks are not marked passing.

## Task accountability and remaining limits

Every row succeeded and its worker is released. Paths below are within the
private evidence directory; `agent-ledger.json` contains exact lifecycle IDs.

| Task                              | Model     | Result / evidence                                                                          |
| --------------------------------- | --------- | ------------------------------------------------------------------------------------------ |
| A public discovery                | Luna high | Formatter candidate; `exploration/explore-A-public-discovery.md`                           |
| B booking data                    | Luna high | Overview candidate; `exploration/explore-B-bookings-data.md`                               |
| C frontend/runtime                | Luna high | No justified change; `exploration/explore-C-frontend-runtime.md`                           |
| D operations/delivery             | Luna high | Intentional bounds retained; `exploration/explore-D-operations-delivery.md`                |
| E auth/admin/private              | Luna high | Two deferred candidates; `exploration/explore-E-private-auth-admin.md`                     |
| F public cross-boundary           | Luna high | Corroboration and composition follow-ons; `exploration/explore-F-cross-public-pipeline.md` |
| G database/runtime cross-boundary | Luna high | Query/contract/index-watch review; `exploration/explore-G-cross-database-runtime.md`       |
| Formatter implementation          | Sol high  | Measured fix; `implementation-formatters/report.md`                                        |
| Overview implementation           | Sol high  | Measured fix; `implementation-overview/report.md`                                          |
| H formatter/evidence audit        | Luna high | PASS; `audit-H-formatters.md`                                                              |
| I query/compatibility audit       | Luna high | PASS; `audit-I-overview.md`                                                                |

No full E2E, Firefox/WebKit, physical-device/LCP/INP/CLS, field/hosted-provider,
sustained-load/capacity, retained-memory or deployment acceptance is claimed.
Source coverage does not imply every workflow was runtime-profiled. Remaining
opportunities are unmeasured, low priority or require wider contract changes.
Any index or concurrency proposal needs its own realistic plan/load evidence.

All owned databases/web/browser/test processes are stopped; synthetic data and
evidence are preserved. Two worker checkouts/branches were removed only after
source integration and verified private archives (all file hashes/modes and
symlink targets). The review worktree and original checkout remain. Exact final
source/branch/catalog/resource and original-user-preservation checks are in
`final-validation.json` and `helper-cleanup.json`. The earlier deferred security
SQL work was not reopened. No real users, production or live services were used.
