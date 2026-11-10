# Booking and live-update performance — 2026-11-10

Implemented locally under
`prompts/features/m8-09-booking-performance.md` (AUTHORIZED — build-feature
delegation). This is local synthetic evidence, not hosted capacity or release
clearance. Same-agent read-only review and separate executed verification were
used; there was no independent reviewer. Changes remain uncommitted in the
existing dirty `main` checkout at `cbc55d7`.

## Reviewable changes

1. `booking-workflows/service.ts` reuses one native lesson-time formatter per
   candidate/reschedule operation. The reschedule page also reuses its formatter
   in the existing second display pass, preserving its chosen viewer timezone.
2. Student/Parent SSE checks use one ID-only current-authority query instead of
   rebuilding a booking overview. Actor and learner predicates are shared with
   participant booking reads. Every recheck still validates the bound current
   session, verified/active account, role, source and exact self/guardian authority,
   with private-packet checks before and after SQL. Initial provider authentication
   remains. Internal learner IDs never enter browser invalidation payloads.
3. Blocking-booking reads intersect the candidate horizon, including the last
   lesson's full end. Source-aware active/expiry rules, reschedule exclusion,
   screening, database clock, locks and atomic writes are unchanged. No index added.
4. Browser verification exposed an inherited confirmed-reschedule constraint
   defect. Forward migration 0047 permits a finite original hold deadline to
   precede a confirmed workflow replacement's creation and subsequent valid
   non-provisional states. Root, provisional/expired and legacy simulation rows
   retain strict expiry-after-creation. No hold, receipt, policy or history is
   rewritten. No permission or database function body changed. See the separate
   recovery note `prompts/recovery/2026-11-10-confirmed-reschedule-expiry.md`.

Heartbeat 25s, lifetime 240s, browser fallback 60s, reconnect/backoff and hidden/offline
cleanup remain. No dependency, pool-size, shared cache or external service added.

## Measurement setup

Apple M5, 16 GiB RAM, Node 24.20.0, installed Next.js 16.4.3 and PostgreSQL 17.
An owned source copy and PostgreSQL cluster at loopback 55435 were used; the app
ran a production build at loopback 3410 with restricted runtime credentials.
Setup used real local registration/verification, reviewer MFA, synthetic screening,
Parent/independent intake and confirmed no-money bookings. The workload has one
eligible Tutor, seven weekly windows and two confirmed bookings. Runtime traces
record timings/categories only, never SQL parameters or credentials.

The initial source SHA-256 manifest, original service, raw samples, plans, private
fixture, logs and failed attempts are retained under ignored/private
`/tmp/learli-booking-perf-20261110/`. Reproduction tools live in
`scripts/booking-performance/`; its README documents ownership guards and setup.
The primary walkthrough database was excluded from benchmarks and fixture setup.

## Paired service results

Twenty alternating measured pairs per operation after two warmups, on the same
runtime/data, assert identical complete outputs (233 candidate records per call).
The original service matches its pre-edit SHA-256 manifest. Timings include service
authentication/SQL/formatting; held-lock intervals run from the completed Tutor
lock query through COMMIT, not PostgreSQL CPU time or exact lock-wait duration.

| Operation             | Before median | After median | Tutor lock interval before → after |
| --------------------- | ------------: | -----------: | ---------------------------------: |
| Booking candidates    |      29.84 ms |      9.56 ms |                    27.43 → 7.08 ms |
| Reschedule candidates |      30.91 ms |     11.07 ms |                    26.78 → 6.63 ms |

Initial separate-phase service samples also improved, but their natural moving
clock crossed a half-hour boundary (232 versus 233 candidates). The paired result
above avoids relying on that mismatched count. No wall-clock scheduling rule was
frozen or changed to produce the comparison.

Fifteen alternating formatting-only samples per variant after two warmups:

| Zone / slot count | Fresh formatter median | Reused formatter median |
| ----------------- | ---------------------: | ----------------------: |
| Manila / 42       |                4.04 ms |                 0.40 ms |
| Manila / 210      |               19.82 ms |                 1.50 ms |
| New York / 42     |                4.09 ms |                 0.39 ms |
| New York / 210    |               21.77 ms |                 2.08 ms |
| Lord Howe / 210   |               20.84 ms |                 1.46 ms |

Every field matches. The longer New York workload spans the November DST fold;
midnight and a non-hour zone are covered. These are formatting-only measurements,
not page-speed claims. Existing unit tests cover invalid instants and other DST
and normalization boundaries.

## Production-build page samples and idle tabs

Six measured warm navigations per route after one warmup (42 samples per phase).
Below is complete navigation response time, not TTFB or full hydration completion.
Load-event elapsed times are separately retained. Before/after phases are not
alternated; warm caches, shared-machine load and the moving booking horizon are
uncontrolled. Small observed movements on unchanged routes are not attributed
to this patch.

| Current workflow           | Before median | After median |
| -------------------------- | ------------: | -----------: |
| Booking page               |       58.1 ms |      36.7 ms |
| Reschedule page            |       73.3 ms |      26.6 ms |
| Plain directory            |       27.6 ms |      20.1 ms |
| Directory with time filter |       44.2 ms |      40.4 ms |
| Parent dashboard           |       13.6 ms |      15.6 ms |
| Student dashboard          |       21.4 ms |      21.1 ms |
| Tutor dashboard            |       36.5 ms |      34.7 ms |

During the same 65-second six-tab idle workload, query/checkouts fell **147 → 99**.
Full overview queries fell **15 → 7**, with **8 focused authority queries** replacing
the stream checks. Remaining full overviews include the retained page fallback.
Median checkout time was 0.0115 → 0.0163 ms, with two maximum observed queued
checkout requests in both runs; no connection-wait improvement is claimed.

Browser `/get-session` responses were **52 × HTTP 200 in each phase**, with no 429.
The patch removes repeated internal provider reads from Student/Parent stream
checks, not browser session requests. Earlier rapid tests exhausted a shared
loopback-IP bucket; this normal-use sample did not reproduce that condition.
Authentication throttles were not weakened or reset during measurements.

## Query growth, discovery and frontend decisions

The exact blocking predicates were compared with alternating pairs and irrelevant
synthetic history inserted in one rollback-only transaction. Relevant outputs
match at every size; actual PostgreSQL plans are retained.

| Irrelevant history | Before median / returned rows | Bounded median / returned rows |
| ------------------ | ----------------------------: | -----------------------------: |
| 0                  |                  0.175 ms / 2 |                   0.179 ms / 2 |
| 100                |                0.255 ms / 102 |                   0.174 ms / 2 |
| 1,000              |              0.835 ms / 1,002 |                   0.253 ms / 2 |
| 10,000             |             6.065 ms / 10,002 |                   0.923 ms / 2 |

These query timings include dispatch and decoding. At 10,000 rows PostgreSQL
chose sequential scans in both variants: measured EXPLAIN execution 1.080 →
0.518 ms, with 417 shared-hit blocks each. The bounded query filters 10,000 rows
at the database; it does not prove constant database scan cost. The current plan
and inventory do not justify another index.

Metadata-only inspection of current local development found five Tutor profiles,
nine offerings and one eligible Tutor. Directory response samples and the already
reused public formatter do not establish a catalog bottleneck at this inventory.
Filtering/pagination and first-slot-only discovery projection remain deferred;
their independent scaling benefit and complete DTO/count equivalence need a
representative inventory experiment before changing those contracts.

A separate current-public-slot experiment measured catalog reads at 0.83 ms
median for the one eligible Tutor. Twenty alternating formatting pairs on its
237 real candidate intervals measured 3.099 ms for all viewer/Tutor time fields
versus 0.198 ms for the first slot only, with identical first-slot output. This
isolates approximately 2.9 ms of potential formatting savings at this inventory;
it is not an end-to-end directory rewrite measurement or sufficient scaling
justification for changing the shared complete-slot DTO.

Phone-sized Chromium (390×844) recorded 120 scroll/pointer animation-frame samples
per phase. Frame medians were 16.70 → 16.65 ms, p95 17.0 → 17.6 ms, with no frame
over 50 ms, no recorded long task and no horizontal overflow. No meaningful jank
was demonstrated in this bounded unthrottled headless sample, so effects/assets
were left unchanged. This is not physical-phone, field or energy evidence.

## Verification and recovery

- Strict typecheck, full lint/format checks, **2,385 unit/component tests**, and
  the final production build passed. The build used
  `NODE_OPTIONS=--max-old-space-size=8192 npm run build` in the isolated copy.
- Real PostgreSQL focused suites: **77 tests / 6 files**, plus public availability
  and directory time filters **21 tests / 2 files** passed. Includes formatter
  reuse/output, final-lesson tail conflicts, current/foreign/suspended/revoked/
  expired authority, local/private/legacy learner-set equivalence, notification
  commit/rollback, overlap/concurrency, reschedule exclusions and history.
- The added Parent heartbeat test proves expiry closes the stream without any
  booking notification or provider refetch. Existing component checks cover
  hidden/offline disposal, reconnect, queued refresh and fallback timing.
- The explicit separate ordinary-operation fixture passed its targeted workflow
  case, including current Parent and independent Student audience reads; one
  unrelated case was excluded by the name filter. Its cluster was stopped with
  data retained. Fresh/populated forward migration/protection tests passed **4/4**.
- Current production-built browser verification passed: Parent reschedule and
  cancellation update open Tutor/Parent pages, new time is displayed, and Student
  cancellation updates open Student/Tutor details within a 10-second assertion
  window, below the 60-second fallback. Reschedule layouts passed 390px/1440px.
- Initial setup rejections (macOS path spelling, prohibited owner runtime
  credentials and unsupported Etc timezone), a harness typing error and a port
  collision were corrected without weakening application guards. The unrelated
  service on 3310 was not stopped.
- Browser verification then reproduced the original expiry constraint bug in
  both original and changed services. Migration 0047 and its real regression
  prove reschedule/retry/cancel retain the exact expired hold while malformed
  root/provisional rows remain denied. Subsequent harness failures concerned
  response capture during navigation and opening the cancellation disclosure;
  these were corrected, and the actual browser flow passed.
- A mode-0600 local development backup preceded 0047 on the owned operating
  database. Ten domain-table row counts/digests matched before/after; all reviewed
  database protections and runtime grants verified. No production operation.

The formatter/access/query measurements preceded the constraint-only recovery;
its SQL changes no read plan, timing policy or application service body. Reverting
the performance source changes is independent of 0047. Do not restore the older
constraint over valid post-hold replacement records; retain the forward-compatible
check and history. No hosted SSE/proxy/load, Neon network/cost, physical device,
external email or production capacity claim is made.
