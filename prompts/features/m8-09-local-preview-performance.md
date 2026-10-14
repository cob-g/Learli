# Learli local preview performance

Status: AUTHORIZED — build-feature delegation, 2026-10-14.
Authority: the owner's request, “ok fix it, fix everything that slow it down and
find the most efficent way to amke it faster”. This authorizes scoped local
performance repairs and verification, not separate human review of this plan.

## Outcome and baseline

Make public navigation, tutor profiles and authenticated workspaces faster while
preserving current permission, session, MFA, current eligibility and booking rules.
PRD: NFR-08, NFR-01/02/05, AUTH-02/03, PUB-02/03, BKG-02. Build plan: M8.9,
supporting M2.5/M2.9, M3.5 and M4.11.

Repository /Users/cob/learli, observed branch fix/e2e-test-env, HEAD c4c28fb.
Existing uncommitted SEO, navigation, preview keepalive and test-environment work
is part of the baseline and must survive. No new branch is required; no commit,
push, production operation, migration or provider configuration is authorized.

Read AGENTS.md and the eight canonical context files in their prescribed order;
reuse unchanged context already read in this conversation. Relevant decisions:
2026-10-14-preview-speed-and-page-loading, 2026-10-14-search-indexing-and-seo,
2026-10-12-admin-assurance. No business decision is needed for this slice.

Observed baseline: preview uses Neon development in Singapore. Read-only samples
show 47–53 ms trivial round trips, 185–206 ms warm guarded SELECT 1, 1,184 ms
first guarded read. Warm catalog reads take 433–442 ms in the traced sample,
with six verification calls, two data calls and two asynchronous cleanup calls.
Two real tutors are present. Warm dev HTTP samples: how-it-works 47 ms,
sign-in 22 ms, directory 522 ms, subjects 733 ms, home 1,169 ms. These are small
diagnostic samples, not a hosted SLA or production benchmark. Time-zone option
construction takes 22–39 ms for 419 options and formats every offset twice.

## Architecture and implementation

1. Combine runtime lease identity, parameter ACL and role-privilege verification
   into one read-only SQL statement. Retain every predicate, native TLS evidence,
   opaque target binding, per-checkout verification, failure classification and
   safe error boundary. No cached authorization or once-per-connection bypass.
2. Await pool cleanup on the convenience pool.query path before resolving it,
   allowing sequential callers to reuse the connection instead of opening another
   while cleanup still holds the first. Explicit transaction leases keep their
   supported release contract; cleanup and failure eviction remain mandatory.
3. Run independent public tutor and subject reads concurrently, then apply the
   existing subject eligibility filter. No cross-request data cache or partial
   success on a failed query. Combine active-account and role reads in
   requireIdentity using a left join; preserve zero-role accounts, denial cases,
   provider session checks and all domain post-wait authorization. Remove the
   redundant outer identity read before readAdminSecurity in admin page loading.
4. Persist only the existing non-sensitive visit time-zone preference in a
   session cookie, initialized from sessionStorage/browser on public arrival.
   Profiles prefer the explicit URL zone, then the authenticated saved zone,
   validated visit cookie and tutor fallback. Skip session/fallback reads when a
   higher-priority value is already known. Keep the browser correction for a first
   direct visit without any preference, native/no-JS fallback and all server
   booking validation. The cookie is display preference only, never identity,
   consent or authority.
5. Reuse a bounded set of Intl offset formatters and compute each option's offset
   once. Format the actual supplied date every time; never cache DST-dependent
   results. Retain all supported zones and aliases.
6. Inspect browser navigation/resource/long-task evidence and apply further small
   demonstrable repairs only within this performance scope. Preserve the visual
   design, private document replacement, current SEO and truthful loading states.

Affected areas: lib/db/hosted-runtime-validation and hosted-runtime, public tutor
catalog, permissions/access and workspace, public-availability profile/zone,
root layout preference initializer, lib/time/zones, focused tests and governing
architecture/UI notes. No new dependency, schema or infrastructure.

## Verification plan

Not run at blueprint creation. Coordinator runs verification after read-only Review.

- Updated guard units and actual local TLS/PostgreSQL hosted-runtime tests:
  all role/identity/parameter ACL denials, privilege drift on reused connections,
  rollback/reset, query failure, concurrent queries and sequential pool reuse.
- Identity integration: current role changes, suspended/missing access, zero and
  multiple roles, cross-account denial, admin MFA/assignment checks remain.
- Profile/browser: one profile navigation after a preference is available,
  explicit/account/visit precedence, invalid preference, browser-first direct
  visit, native GET/no-JS, correct dated/DST candidate display and booking resume.
- Time-zone formatting: different dates across DST, aliases and uncached output
  agree with actual Intl values; cache stays bounded.
- Repository check (format/lint/types/unit/component), relevant real PostgreSQL
  integration, production build and affected Chromium journeys. Phone/desktop
  accessibility and navigation observed. Broader suites when shared guards warrant.
- Repeat the same read-only Neon-development timing and warm local HTTP/browser
  sample; retain successful/failed evidence and report actual distributions.
  Tests use isolated loopback PostgreSQL, never Neon or production fixtures.

## Risks, rollback and documentation

Network/cold connection variability and Next dev compilation cannot be eliminated
by removing application round trips. No claim of physical-device/hosted latency.
Revert only this scoped diff for rollback; preserve earlier user work and data.
Update architecture for consolidated checks/current authority, UI context for
the visit cookie and progress tracker for actual results. Save local ignored
memory after Review and Verify. No production activation or external messages.
