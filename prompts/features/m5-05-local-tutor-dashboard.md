# M5.5 — Local tutor booking dashboard

Status: **AUTHORIZED — build-feature delegation**. Date: 2026-10-11.
Actual request: dispatched `$build-feature Build M5.5 local tutor booking dashboard
(PRD OPS-02, TUT-06, BKG-04)` in the approved six-feature local wave.
This records delegated execution, not separate human blueprint approval.

## Outcome and baseline

An active verified synthetic tutor opens `/tutor` and sees only assigned local
simulation bookings, including a next future simulation, agenda and expired/past
history, actual subject, minimal learner label/level, local time and expiry.
The existing profile review notice and profile/availability/time-off/account
navigation remain available. No terminology clarification is needed.

Observed clean branch `cob-g/m5-5-tutor-dashboard`, HEAD
`0c078bf50f9f967b20391ef3640353a7b3897e62`, repository
`/Users/cob/orca/workspaces/learli/m5-5-tutor-dashboard`.
Read AGENTS.md and eight canonical context documents in its required order.
Relevant decision: `docs/decisions/2026-10-11-local-synthetic-booking.md`.
Existing page is `src/app/(workspace)/tutor/page.tsx`; it reads own profile/account
but shows bookings unavailable. Existing shared LessonTime/server formatter,
native links, semantic tokens, EmptyState and ReviewNotice are reused.

## Scope and ownership

Own tutor landing, feature-owned presentation and tests. No student/parent route
edits, independent details route, competing booking access service, schema or
migration. No auth configuration, dependency, global CSS or booking mutation
changes. The parent owns reconciliation of Playwright config and canonical docs.
Local role navigation only; parent confirmed no new shared shell dependency.

All records stay `local_simulation`, `demo_reserved` or `demo_expired`, with
immutable fields and existing 60-minute duration/30-minute step/60-minute
notice/14-day horizon/10-minute TTL. No confirmed, paid, completed or cancelled
claims, meeting entry/join, money, attendance, cancellation, rescheduling, LMS,
messaging, uploads, performance metrics or real-user onboarding.

## Dependency contract

Parent accepted Agent1 provider `src/features/bookings/read-model.ts` and
`read-service.ts`: `BookingReadScope` student|guardian|tutor,
`BookingReadFilter` all|active|history, `BookingSummary`, `BookingDetail`,
`BookingPage`, `listParticipantBookings(runtime,headers,input)` and
`readParticipantBooking(runtime,headers,bookingId,scope)`.
List input {scope,page=1,pageSize=20 (max50),filter=all,learnerId?}; tutor rejects
learner filter; active start/id ASC, all/history DESC; hasNext, no count.
Details `/bookings/[bookingId]?scope=tutor`, private list `/bookings?scope=tutor`.
Exact TypeScript fields and frozen files/hashes were delivered and authorized
by parent message msg_a9f6ad82126e, immutable bundle m4.9-read-v2 manifest.
Only parent-authorized frozen files may be copied into this checkout; imports
and hashes must be reported separately from owned modifications.

Contract refinement authorized by parent durable ask reply on2026-10-11:
a narrow provider-owned overview returns {active:BookingPage,history:BookingPage}
from one final authorized SQL snapshot, preserving the existing list/detail API.
This avoids two-list expiry/timezone drift and guarantees earliest next selection
from the active ascending preview. Both pages include viewerTimezone and
snapshotAtUtc even when empty. Tutor learners[] remains empty. Use exact exported
overview input/type/name delivered with frozen permission; no consumer SQL or
independent expiry pruning. Parent supplied BookingSummary field shape: id,
source, tutor{displayName,slug}, subject{name,slug}, learner{id,displayName,level},
state/persistedState, snapshotAtUtc, expiresAtUtc, expiryMaterialized, time/expires
(LessonTimeValue), viewerTimezone. Client-safe bookingDetailPath(id,scope) owns
the detail URL. Raw learner IDs and source fields are not added to rendered UI.

Provider final SQL repeats current exact session expiry, user verification,
active account, role, assignment and local synthetic gating. No admin bypass.
Read-only final statement projects elapsed TTL to demo_expired without inventing
persisted events or mutating history. Suspended account/profile and removed-role,
revoked/expired sessions deny. No private learner/guardian contact/timezone fields.
Dashboard consumes provider state rather than applying a competing expiry rule.

## Implementation plan

1. Independent setup: pinned npm ci; own PostgreSQL 17.11, database55473,
   development3033/test3133; existing local setup full0000–0011 migration chain.
2. Feature-owned pure presentation receives minimal rows and server-produced
   LessonTime values, status/expiry and trusted evaluation instant. Next panel
   is the first future demo_reserved row, never titled next confirmed lesson.
   Agenda/history use aligned time columns, headings/rules and visible links.
   Render truthful empty/loading/failed-access states and retry/account route.
   Authorized routine rendering recovery removes automatic loading.tsx, whose
   Suspense completion hid first reads without scripts. Native GET refresh works
   without JavaScript; client-enhanced refresh announces pending status during
   a real private read. See retained recovery attempt4, parent msg_c6eb013eed49.
3. After exact parent import permission, wire the provider tutor overview read.
   Bounded previews link to the provider history/list for further rows.
   Use authoritative provider current-account viewerTimezone, snapshotAtUtc and
   preformatted LessonTime values; no independently selected fallback timezone.
   Dynamic route, static noindex metadata, no public caching or private metadata.
4. Retain ReviewNotice; locally accurate approved copy must not imply live booking.
   Declare any shared notice edit to parent before changing it.
5. Tests cover presentation empty/populated/history, next future selection,
   expiry, DST repeated hour and midnight; real PostgreSQL exact assignment,
   foreign tutor, removed role, suspension, revoked/expired/unverified/anonymous
   session denial and privacy projection. Browser uses real synthetic rows,
   no-JS reads/navigation, refresh expiry, keyboard, responsive/axe and failure.
   Bounded history integration verifies the actual view-all link, pagination,
   native filters, hydrated pending state and Back restoration through the
   exact provider controls. This is consumer verification, not independent
   control/detail implementation.

## Verification plan (not executed by Architect)

Separate same-agent read-only Review, then executed Verify: npm run check,
full npm run test:integration, production npm run build and default
npm run test:e2e -- --workers=1 selecting unchanged baseline suites and own new
suite. Confirm discovery before execution. Capture and inspect phone/desktop,
empty/populated/denied/loading/error screenshots; widths320/390/768/1024/1440,
640x400 reflow (not literal zoom), reduced motion/forced colors, no overflow,
keyboard focus and no-JS where relevant.
No-JS functional/visible/native-navigation assertions keep scripts disabled;
axe audits the equivalent settled authenticated state with scripts enabled,
because its injected runtime requires them (parent msg_3c9b70d74988).
Scan changed/client output for actual private values without printing values.
Keep failures and use Recover before
repair; re-review and rerun affected checks. Real PostgreSQL provider integration
is required, never substitutable by presentation fixtures or mocks.

## Documentation, risks and handoff

Update own progress tracker after meaningful implementation and exact observed
verification. Architecture/build-plan only factual local implementation notes if
needed; no product policy approval. Final Remember saves ignored root memory.md
with blueprint, exact state, review/verification separate, failures and next owner.
Save ignored .local/worker-report.md with import provenance, all changed paths and
per-file plus specified aggregate SHA256. No commits/push/main merge/deploy,
destructive reset, email/provider call or peer environment access.
Parent authorized the16 frozen provider files plus only a local column SELECT
grant for booking_events; no migration or full shared script replacement.
Imported hashes and authority are retained in ignored import-provenance.json.
Parent msg_2a138ef85304 authorized immutable m4.9-read-v3 repaired15-file
provider bundle and exactly2 old-hash-verified imported loading removals.
Core/notice SQL contract hashes stayed unchanged. Versioned import/deletion
provenance retained privately; consumer never edits provider files independently.
Parent msg_76b9b650a672 then authorized only read-controls.tsx v4 replacement,
SHA256 6f048472fc276722ad399675c80003358067560b9ba04dbb0ac88d82a4a2e3ac,
after old-hash verification. All other provider hashes and boundaries unchanged.
Final acceptance uses the real provider and actual PostgreSQL queries.
Review is same-agent, not independent release signoff; parent owns final review
and combined verification. Rollback is revert scoped source edits; no DB change.

Blueprint ready. At architecture handoff, verification was NOT RUN.

Final local execution evidence on2026-10-11: same-agent read-only Review found
no confirmed findings and recommended READY FOR VERIFICATION. Separate Verify
passed493 unit/component,171 actual PostgreSQL,56 default browser tests and
production build, with inspected nine screenshots and zero privacy-scan hits.
Exact commands/logs, recovered attempts and remaining launch gates are recorded
in progress-tracker's M5.5 verified handoff entry. This is the requested local
slice only; no independent review, whole M5.5 or production clearance.

Parent separately authorized Agent2's tested optional LessonTime variants with
preserved default: sole source path src/features/bookings/lesson-time.tsx, SHA256
37fb416efeb8e408b780517514c5b371b8aec896d16d6b7aa9c5933a01f753c7,
message msg_9d5bb971c3c4. Prominent variant is for Next; time-only agenda rows
require adjacent explicit date and per-group zone, preserving midnight ranges.
