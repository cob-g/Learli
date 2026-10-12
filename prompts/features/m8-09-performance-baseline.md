# M8.9 — Reproducible local performance baseline

Status: **AUTHORIZED — build-feature delegation** (2026-10-12).
Authority: user-dispatched Worker 6 readiness package, NFR-08 / M8.9. The user
authorized scoped local work, not separate human inspection of this blueprint.
Baseline: `5634e44fd71e8851400e004de6bbe3554e65eae1`; assigned isolated checkout,
PostgreSQL 55506, development 3066, test application 3166.

## Outcome and terminology

Provide a small repeatable LOCAL lab harness and evidence/runbook using existing
Node, PostgreSQL and Playwright tooling. Public page loading means Chromium's
actual navigation timing through load and a checked rendered result; booking
response means elapsed authenticated HTTP request through body consumption.
These are local simulation observations, not mobile field data, hosted latency,
throughput capacity, a production SLA or complete NFR-08 device acceptance.

## Decisions and scope

- No product/policy decision needed. Preserve existing local simulation durations,
  quotas, TTL, rate limits, ownership and PostgreSQL overlap protection.
- Own `scripts/performance-baseline*`, dedicated harness tests, this blueprint,
  `docs/operations/performance-baseline.md`, factual isolated tracker contribution
  and ignored evidence/memory only. Root owns shared registration and canonical
  integration; Worker 1 owns dependency files. No application, schema/migration,
  package, CI or shared test-config changes.
- Require APP_ENV=test, AUTH_MODE=local, explicit loopback app/DB ports, owned
  cluster marker and private generated state. Refuse nonempty application data
  before fixture setup (subjects and migration metadata are permitted).
- Use 24 synthetic approved tutor profiles across UTC/Manila/New York, actual
  Math/College Support offerings and seven two-hour weekly windows each. Add
  dated time off and pre-existing simulated reservations via real API requests.
  Stay below all current availability caps. Two independent synthetic .test
  accounts sign up/sign in through Better Auth; owner tooling supplies only
  verification and trusted student/self-profile fixture setup.
- Measure plain directory, directory with actual-date availability (two batches),
  and a profile with real available radio options. Separate fresh-browser-cache
  and warm-browser-cache observations on desktop and phone-sized Chromium;
  retain server/DB warmup and no throttling facts. Never label emulated phone a
  physical device. Abort all non-loopback browser requests.
- Bound warmups, samples, repeats and HTTP concurrency (two overlapping booking
  requests only). Record availability response, successful booking, conflicting
  booking and retry response distributions separately with sample counts and
  nearest-rank percentiles. Check each pair yields 200/409, one reservation and
  one creation event; replay returns same ID and cross-owner reads deny. Never
  count quota failures as overlap conflicts.
- Teardown only exact owned fixture IDs; preserve failure evidence and identify
  incomplete cleanup. No blanket throttle reset or unrelated data deletion.
  Do not capture HTML, screenshots, traces, credentials or meeting links.
- Save sanitized JSON with hardware/OS/runtime/browser/PostgreSQL versions,
  Git HEAD plus source hashes, dependency hashes, dataset counts, clock bounds,
  cache/warmup/repetition method, raw timing-only samples and distributions.

## Implementation sequence

1. End Architect; implement guards/statistics/source identity helper tests.
2. Implement fixture lifecycle and bounded runner; write reproducible runbook.
3. Read-only same-agent Review against exact diff; no independent claim.
4. Separate Verify under granted normal slot: npm ci/local setup, discovered
   focused tests, format/lint/typecheck/unit checks and production build.
5. Import only root-accepted frozen runtime/dependencies; recheck necessary
   compatibility. Authoritative timings require both heavy slots exclusively.
   Run two bounded repetitions, validate outcomes/cleanup and preserve failures.
6. Update factual evidence and tracker; read Remember/save, local ignored memory.

## Acceptance and verification

- Guards reject remote/mismatched/unsafe environments before imports/DB writes.
- Statistics handle empty, invalid and known percentile fixtures; bounds cannot
  be increased by arbitrary CLI options. Tests are demonstrably discovered.
- Actual production-built public directory and availability render real fixture
  rows/times; authenticated requests use provider sessions, never forged cookies.
- Real PostgreSQL conflict/idempotency/history and foreign-learner denial probes
  pass; owner data/fixtures are restored to the initial empty state on success.
- Exact commands/status/source manifest, same-agent Review and separate Verify
  recorded in `.local/readiness-wave/report.md`; final dependency candidate and
  exclusive slot authority must be known before measurement acceptance.
- Relevant code-quality/build checks pass or remain explicitly blocked; no
  fabrication of SLA, production/device or unexecuted verification.

## Rollback, documents and gates

Rollback removes only newly authored tooling/docs and exact owned synthetic
fixtures. No migration or runtime rollout is required. Tracker records observed
partial/final status; runbook records local limits and target-device/connection
follow-up. Real minors, consent/safeguarding/commercial/provider/production gates
remain OPEN. Root independently accepts/integrates this uncommitted slice.

## Executed outcome — 2026-10-12

Own implementation follows this blueprint; first fixture setup exposed an email
namespace collision, preserved and repaired through the unique Recover note.
Root supplied exact diagnostics, CSS and focus source/test imports as the frozen
application candidate, with explicit authority/preimage/source/result hashes in
the ignored report. These imports are not own runtime authorship or separate
human blueprint approval. Dependencies remain root-accepted unchanged.

Same-agent read-only re-review READY FOR VERIFICATION; root reports independent
source review without performance/runtime findings. Separate final check685/
37files, focused22, production build and exclusive2-repetition real workload
PASS. Measured72 public +64HTTP samples and all conflict/retry/ownership/history/
cleanup proofs; original failed attempt retained. Source332-file aggregate
ff0ecabe9b18784e837f31fddca8ab3c8b00f005d4df576819b787248173966f;
details in docs/operations/performance-baseline.md and ignored worker report.
This completes the bounded local package, not target-device/hosted NFR-08 or
whole-M8/production acceptance. Root owns combined integration and release.
