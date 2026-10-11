# Learli — Product Requirements Document (PRD)

> **Product:** Learli (visual wordmark: `learli`)  
> **Document:** Product Requirements Document / MVP Product Specification  
> **Version:** 1.0  
> **Date:** 2026-10-11  
> **Status:** **Working MVP specification.** Product boundaries and technical direction are agreed; launch policies marked `[OPEN]` still require founder approval.  
> **Audience:** Founders, product/design, engineering, QA, and coding agents  
> **Companion documents:** [`architecture.md`](./architecture.md) · [`AGENTS.md`](./AGENTS.md)

---

## 0. Read me first

### 0.1 What this PRD does

This document defines **what Learli must do, for whom, and how we will know it works**. It is written so a beginner can follow the actual user journey, while developers can turn each requirement into a page, backend workflow, and test.

- **`PRD.md`:** product outcomes, scope, workflows, requirements, acceptance criteria, launch gates.
- **`architecture.md`:** approved technology direction, data architecture, implementation constraints, deployment, and security rationale.
- **`AGENTS.md`:** instructions for coding agents and contributors implementing the approved architecture.

**Precedence:** Follow the latest explicit founder decision; preserve the `[AGREED]` boundaries in `architecture.md`; use this PRD to implement product behavior; follow `AGENTS.md` for coding workflow. If the documents conflict, **stop and resolve the discrepancy**, rather than silently implementing a guess. Update the affected documents and record the decision.

### 0.2 Decision labels

| Label | How to interpret it |
|---|---|
| **`[AGREED]`** | Confirmed product or stack direction. In MVP unless otherwise stated. |
| **`[RECOMMENDED]`** | Reasonable default proposed for implementation; can be refined through review. |
| **`[OPEN]`** | Founders or responsible reviewers must decide; **do not invent a policy**. |
| **`[LATER]`** | Explicitly excluded from first launch. |
| **`[GATED]`** | Required capability, but cannot go live until its dependent `[OPEN]` rules are decided. |

### 0.3 Priorities and release meanings

- **P0:** Essential for a safe, functioning marketplace or paid launch. A P0 can still be **blocked** by an `[OPEN]` business decision.
- **P1:** Valuable MVP support or polish; ship if feasible without compromising P0.
- **P2:** Optional after usage validates a need; not a reason to delay a safe first pilot.
- **Internal demo:** Fictional accounts, test email, simulated bookings/payments in **development/test only**.
- **Controlled pilot:** Limited audience with an approved operating/safety policy and no misleading payment claims; determine which activities are legally and operationally permitted.
- **Paid public launch:** Real students, tutors, bookings, and money; **all applicable launch gates must pass first**.

A feature described in this PRD is **not automatically implemented**, and a suggested UI is not proof a policy has been approved.

---

## 1. Executive summary

### 1.1 Product concept `[AGREED]`

**Learli is an online tutoring marketplace and coordination platform** connecting students or parents/guardians with tutors for academic assistance from **Elementary through College Support**.

**Core journey:**

```text
Discover a tutor → Compare profiles → Select an available time
→ Sign in / provide authorized learner details → Book
→ Follow approved trial/payment step [OPEN]
→ Get confirmed booking and private Zoom / Google Meet link
→ Attend the lesson with the tutor outside Learli
→ View booking history and manage future sessions
```

**Learli is the medium, not the classroom.** It provides discovery, matching, scheduling, booking coordination, relevant payment records, and basic support. **Tutors decide how they teach and manage their learning materials independently.**

### 1.2 User problem

Families and learners may struggle to find an appropriate tutor, compare credible options, coordinate across time zones, and keep track of booked lessons. Tutors need a simple way to communicate what they offer and make their availability bookable. Parents booking for younger learners need a straightforward view of their children's schedules without navigating a full LMS.

### 1.3 Product promise

> **Find the right tutor. Learn your way.**

**Brand direction:** “Learning made personal.” This is an initial tagline direction, not a registered or legally cleared slogan.

### 1.4 Competitive inspiration (not a feature mandate)

| Inspiration | Product idea Learli draws from | Our V1 adjustment |
|---|---|---|
| **Preply** | Modern tutor profiles, intuitive discovery and booking | Lightweight profiles; no custom classroom |
| **Superprof** | Searchable tutor marketplace | Small, real subject/tutor catalog; no fake scale |
| **Varsity Tutors** | Guided selection and academic focus | Simple rule-based matching; no complex assessments |
| **Outschool** | Approachable family-facing experience | Parent booking visibility, not group classes |
| **AGEUS** | Straightforward tutoring coordination | Modern self-serve site; pricing/trial terms still `[OPEN]` |

### 1.5 V1 boundaries in one sentence

**A real, eligible tutor can be discovered and booked safely for an actually available one-to-one Zoom/Google Meet session, and the appropriate people can manage the booking.**

---

## 2. Launch scope and explicit exclusions

### 2.1 Supported levels `[AGREED]`

1. Elementary
2. Middle School
3. High School
4. **College Support** — included from launch, not postponed.

For minor learners, parent/guardian linkage and appropriate consent must be established according to the approved launch-country policy. An eligible adult college learner can manage bookings independently.

### 2.2 Subjects and learning needs `[AGREED]`

| Category | Included at launch |
|---|---|
| **Academic core** | Mathematics, Science, English |
| **Test preparation** | SAT, ACT, entrance exams where qualified tutors are available |
| **Academic assistance** | Homework help, study skills |
| **Specialized subjects** | Relevant specialist/college topics **only when a real eligible tutor offers them** |

**Not a V1 feature:** A catalog of every academic subject globally or software that maps international curricula. Tutor expertise and advertised coverage must be accurate. No standalone **Coding** category is part of the launch scope; any later expansion needs approval.

### 2.3 Delivery model `[AGREED]`

- **Individual (1:1) tutoring only** in V1.
- Lessons are delivered using **Zoom or Google Meet**, using the tutor's account/link subject to platform safety requirements.
- No Learli video/audio streaming, whiteboards, recordings, or meeting-attendance verification.
- No mandatory tutor-managed learning materials, exercises, reports, or teaching methodology.

### 2.4 Explicitly OUT of V1 `[AGREED]`

Do **not** implement these unless founders approve a revised scope:

- Assignment/worksheet uploads, homework submissions, file sharing, student document libraries, or learner file storage.
- LMS modules, quizzes, grading, curriculum mapping, classroom content management, academic progress analytics.
- Required post-lesson tutor progress reports, lesson plans, teaching-quality scores, and advanced tutor management.
- Built-in messaging between minors and tutors, discussion forums, social feeds, live chat, or video conferencing.
- Small-group classes, native mobile applications, AI tutor/AI matching/AI avatars.
- Custom calendar synchronization, advanced tutor payout systems, and subscription infrastructure **unless required by an explicitly approved payment model**.
- Complex infrastructure: microservices, Redis, Kafka, Kubernetes, external search clusters, separate front/back repositories.

**Photos and storage:** Use initials avatars and static brand assets initially. No upload service is needed for basic V1. Evaluate storage (potentially Neon Object Storage) only after approving a genuine file requirement.

### 2.5 Important distinction: minimal operations vs advanced tutor management

**Must exist:** essential tutor registration, basic eligibility/safety review, account approval/suspension, profile/availability management, and reporting unsafe behavior.

**Not required:** staff-controlled lesson plans, tutor scoring, curriculum enforcement, performance programs, and other advanced tutor-management operations.

---

## 3. Users and jobs to be done

| Actor | Primary job | Main pages/capabilities |
|---|---|---|
| **Visitor** | Understand Learli and find potentially suitable tutors | Home, subjects, directory, tutor profile, how it works |
| **Student / eligible independent learner** | Choose a tutor and manage own lessons | Discovery, learner profile, bookings, private join link |
| **Parent / guardian** | Find and book tutoring for an authorized child; view schedule/status | Linked learners, tutor search, bookings, changes, applicable payments |
| **Tutor** | Explain teaching offer, set available times, fulfill bookings externally | Profile, subjects, timezone, availability, bookings, meeting link |
| **Admin / support** | Keep accounts and bookings operable and respond to essential safety issues | Approval, catalog, limited support, booking review, audit trail |

A single account may hold more than one legitimate role. Roles must be assigned through trusted server-side logic, not uncontrolled form inputs.

### 3.1 Design principles

- Make the **next action obvious** to a new visitor.
- Avoid collecting a learner's personal details before genuinely needed.
- Keep booking understandable across countries and time zones.
- Do not pretend a recommendation is AI-generated or a tutor is “verified” beyond the actual review performed.
- Prefer **one clean workflow** to a dashboard with many unused modules.
- Design for future mobile clients through reusable server-side business logic, without building mobile apps now.

---

## 4. Product outcomes and measures

### 4.1 Product goals `[AGREED]`

1. A learner/parent can find **real, approved tutors** for an actual offered subject and level.
2. A visitor can understand tutor fit before creating an account.
3. An authorized user can book a **genuinely free** tutoring slot without double-booking.
4. Only booking participants can access the correct private meeting details.
5. Tutors and families can reliably view/change permitted bookings without needing an LMS.
6. Learli can be safely operated by a small team at modest infrastructure cost.

### 4.2 Suggested launch metrics `[RECOMMENDED]`

Metrics are **proposed; no baselines, numeric targets, or achievements have been established**.

| Metric | Basic calculation | Caution |
|---|---|---|
| Tutor search-to-profile | Tutor-profile opens ÷ directory visits | Privacy-respecting, aggregate events only |
| Profile-to-booking intent | Booking starts ÷ eligible tutor-profile visits | Distinguish starts from completed bookings |
| Booking completion | Confirmed bookings ÷ valid booking starts | Split out payment-related failures after payment exists |
| Double-booking incidents | Confirmed overlaps for same tutor | Required outcome: **zero** |
| Booking failure categories | Invalid slot, expired slot, eligibility, auth, payment, provider errors | Don't log private student details |
| Tutor activation | Approved, publicly visible tutors ÷ eligible applications | Not a substitute for safety review |
| Support responsiveness | Time from report to first human acknowledgment | Set specific target only after operating plan is approved |
| Infrastructure consumption | Railway usage, Neon utilization, Resend quota | Cost is usage-dependent; no promised flat $5 total |

Track only data needed to operate and improve Learli. Avoid behavioral profiling of minors as an MVP feature.

---

## 5. Primary user journeys (plain-language walkthroughs)

### 5.1 Journey A: Visitor finds a tutor

1. Open Learli at the Railway-provided HTTPS URL during development, or the official domain later.
2. Choose a subject or search the directory.
3. Narrow results by supported level, subject, optional language, and actual time fit.
4. Read an approved tutor profile; see only truthful credentials/capabilities.
5. Choose a displayed available time, or select **Get Matched**.
6. If authentication is needed, sign in/register and return to the same tutor/selection if still valid.
7. Continue through the booking eligibility and approved payment/trial flow.

**Acceptance outcome:** A first-time visitor can reach an appropriate real tutor without an unnecessary long registration form. An empty catalog gives a clear, truthful message.

### 5.2 Journey B: Parent books for a child

1. Parent registers, verifies their email, and creates a **minimal** parent-managed learner profile.
2. An approved process establishes that the account is authorized to act for that learner.
3. Parent selects the learner, subject, tutor, date, and available time.
4. Server rechecks guardian authorization, tutor eligibility, slot availability, and approved business conditions.
5. Only after valid confirmation does the parent see a confirmed booking and restricted meeting link.
6. Parent can review upcoming and past sessions, request permitted changes, and see basic payment records if payments are live.

**Acceptance outcome:** A different parent account cannot view or edit this learner or their booking, even by guessing URLs/IDs.

### 5.3 Journey C: Eligible college learner books independently

1. Adult/otherwise legally eligible college learner creates and verifies an account.
2. Maintains a self-managed learner profile.
3. Finds a tutor for a supported college/core/specialized subject.
4. Books an eligible slot and accesses the private meeting details when confirmed.
5. Views personal booking history and permitted changes.

**Acceptance outcome:** Such a learner is **not forced to create a parent account**.

### 5.4 Journey D: Tutor offers lessons

1. Tutor registers, verifies email, and submits basic profile/teaching information.
2. Learli performs only the **approved minimum eligibility/safety review** (details `[OPEN]`).
3. Once eligible, the tutor is publicly visible and can become bookable.
4. Tutor sets an IANA timezone, recurring weekly availability, and necessary exceptions.
5. Tutor receives booking notices and provides an allowed Zoom/Google Meet link privately.
6. Tutor conducts the session outside Learli, then can view session status/history.

**Acceptance outcome:** No unapproved/suspended tutor is publicly bookable; tutor A cannot alter tutor B's schedule.

### 5.5 Journey E: Guided tutor matching

1. Ask only for subject/topic, learner level, preferred days/times, and timezone as needed.
2. Filter to approved, eligible tutors who actually teach the subject and level.
3. Consider true available slots; apply simple, explainable ranking.
4. Present a **small number of genuine matches**, plus a way to browse other tutors.
5. When no tutor fits, show honest alternatives or a support contact.

**Acceptance outcome:** No fabricated tutors, skills, ratings, availability, or guarantee of “three matches.” This is **rule-based**, not AI.

### 5.6 Journey F: Booking through external lesson

```text
Tutor slot selected
   ↓
Authenticated learner/guardian eligibility checked on server
   ↓
Database checks tutor, level, subject, overlap, and request idempotency
   ↓
Provisional booking state (if appropriate for approved policy)
   ↓
Approved free/paid trial or payment outcome [OPEN]
   ├─ Failed/cancelled/expired → no false confirmation; release reservation
   └─ Conditions satisfied → confirmed booking
                                 ↓
                        Private meeting link shown
                                 ↓
                        Confirmation notices sent
                                 ↓
                        Lesson takes place in Zoom/Meet
                                 ↓
                        Basic status/history updated
```

**Acceptance outcome:** Two families racing for the same slot cannot both hold a conflicting confirmed reservation. Learli must **not** claim it tracked actual meeting attendance without a real attendance integration.

---

## 6. Screens, navigation, and UI scope

These routes are **examples**, not an instruction to create separate applications. Route names may be refined without changing the product behavior.

| Route / screen | Audience | Main content | Priority |
|---|---|---|---|
| `/` Homepage | Public | Value proposition, subject entry, Find a Tutor / Get Matched CTAs | P0 |
| `/subjects` | Public | Only actual offered learning categories and subjects | P0 |
| `/tutors` | Public | Approved tutor cards, search, filters, truthful empty state | P0 |
| `/tutors/[slug]` | Public | Approved tutor biography, levels, subjects, useful availability | P0 |
| `/get-matched` | Public / signed-in | Short rule-based questionnaire and relevant matches | P0 |
| `/how-it-works` | Public | How browsing, booking, and external lessons work | P1 |
| `/become-a-tutor` | Public | Tutor benefits and registration/application start | P0 |
| `/sign-up`, `/sign-in`, reset and verification | User | Secure Better Auth flows | P0 |
| `/student` | Student | Own upcoming/past bookings, private links when eligible | P0 |
| `/parent` | Parent | Authorized learner selection, bookings, changes, applicable payments | P0 |
| `/tutor` | Tutor | Profile, subjects, schedule, bookings, meeting links | P0 |
| `/admin` | Admin | Limited account approvals, subjects, booking support, safety cases | P0 |
| `/privacy`, `/terms`, `/cancellations` | Public | Reviewed policies; do not publish invented terms | Paid launch P0 |
| `/pricing` | Public | **Only after** pricing/payment rules approved | `[GATED]` |
| `/support` or equivalent | Public / user | Clear operational and safety report channel | P0 |

**Visual identity `[AGREED]`:** `learli` lowercase logo/wordmark, “Learli” in ordinary prose, friendly contemporary interface, navy/teal direction, mobile-first and accessible components. No copyrighted competitor screenshots or unsupported claims.

---
## 7. Functional requirements and acceptance criteria

### How to read the requirement IDs

Each requirement has an **ID**, **priority**, **status**, a user-visible outcome, and acceptance checks. Implementers should create corresponding automated and/or manual tests. The acceptance criteria describe **behavior**, not a promise that the code already exists.

### 7.1 Public site and catalog (`PUB`)

#### PUB-01 — Discover Learli and its boundaries `P0 [AGREED]`

**As a visitor**, I can understand that Learli helps me find and book **1:1 online tutors**, while the lesson happens on Zoom or Google Meet.

**Acceptance criteria:**

- Homepage has clear **Find a Tutor** and **Get Matched** entry points.
- Copy identifies the real launch levels, including College Support.
- The site does not claim to be an LMS, in-house video platform, or provider of every subject worldwide.
- Main CTA paths are usable on mobile and desktop.
- No invented prices, success statistics, tutor counts, accreditation, or reviews appear.

#### PUB-02 — Browse supported subjects `P0 [AGREED]`

**As a visitor**, I can see what Learli actually offers.

**Acceptance criteria:**

- Core categories include Math, Science, English, test preparation, homework help, study skills, and available specialized subjects.
- An inactive or unsupported specialized subject is not advertised as bookable.
- Clicking a subject displays real eligible tutors or a truthful no-results state.
- Admins can disable an offering without deleting booking history.

#### PUB-03 — Tutor directory and filtering `P0 [AGREED]`

**As a visitor**, I can explore the tutors who are genuinely eligible for public bookings.

**Acceptance criteria:**

- Only tutors with the required **approved, active, publicly eligible** status appear.
- Search/filter works for subject and level; timezone/availability and teaching language are included where accurate data exists.
- Changing/removing filters visibly updates results without inventing inventory.
- Empty and error states explain what to do next.
- Search results don't leak private tutor details, meeting URLs, or learner information.

#### PUB-04 — Public tutor profile `P0 [AGREED]`

**As a visitor**, I can assess whether a tutor is suitable.

**Acceptance criteria:**

- Profile displays an approved display name, concise introduction, offered subjects, supported levels, and useful scheduling context.
- Experience/qualifications are only displayed with appropriately defined provenance; never call a claim “verified” unless that review actually happened.
- Only valid public review data is shown under the approved review policy.
- Profile has a clear booking action when eligible; suspended/closed profiles are not bookable.
- Public pages omit child data and private Zoom/Meet details.
- Static/initials avatars are acceptable. Uploading headshots or intro videos is **not a V1 requirement**.

#### PUB-05 — Clear help, trust, and policies `P0 for paid launch [GATED]`

**As a potential customer**, I can understand who operates Learli, how bookings work, and where to get help.

**Acceptance criteria:**

- Contact/support channel is easy to find.
- Terms, privacy, cancellation/refund policies are published **after** jurisdictional/legal and business review.
- Pricing/trials are not described as “free,” “guaranteed,” or refundable unless actually approved.
- No misleading safety guarantees (e.g., “100% secure”).

### 7.2 Authentication, accounts, and permissions (`AUTH`)

#### AUTH-01 — Register and verify email `P0 [AGREED]`

**As an eligible account holder**, I can create an account and verify my email securely.

**Acceptance criteria:**

- Better Auth powers email/password registration and verification.
- Client cannot register directly as `admin` or self-approve a tutor by manipulating a request.
- Email format/required fields are validated on the server; suspicious/abusive attempts are throttled.
- A restricted action checks verified status wherever the approved policy requires it.
- Development works with test-email procedures; real customer email requires a verified sending domain.

#### AUTH-02 — Sign in, sign out, reset password `P0 [AGREED]`

**As a returning user**, I can access my account and recover access safely.

**Acceptance criteria:**

- Sign-in/sign-out correctly creates and revokes secure sessions.
- Password reset uses time-limited, single-purpose provider-supported tokens/flows.
- Errors avoid unnecessary account enumeration.
- Private screens cannot be reached after logout merely by using browser history or stale authorization.

#### AUTH-03 — Trusted user roles and record ownership `P0 [AGREED]`

**As Learli**, I protect private bookings and profiles based on the account and record relationship.

**Acceptance criteria:**

- Roles support `admin`, `tutor`, `student`, `parent`; legitimate multiple roles are possible.
- Each sensitive request checks **authentication, applicable role, and ownership/authorized relationship on the server**.
- Student A cannot access Student B; Parent A cannot access unrelated Learner B; Tutor A cannot edit Tutor B.
- Client-supplied role, account state, IDs, hidden buttons, or route slugs do not bypass checks.
- Suspended/ineligible accounts cannot perform restricted booking/teaching actions.

#### AUTH-04 — Safe account settings `P1 [RECOMMENDED]`

**As a user**, I can review/update my own permitted basic settings.

**Acceptance criteria:**

- User can view/update their own display name and timezone as appropriate.
- Email change, session removal, and other security-sensitive changes use Better Auth-supported re-verification where applicable.
- Changing my profile never edits another user's records.
- Do not add unnecessary profile fields simply because a library offers them.

#### AUTH-05 — Return to intended booking after authentication `P1 [RECOMMENDED]`

**As a visitor**, I do not lose my chosen tutor/subject after login.

**Acceptance criteria:**

- Safe in-app return path preserves tutor/subject/slot selection when possible.
- Selection is **revalidated** after sign-in; expired slots are not promised or auto-booked.
- External redirect URLs are rejected or restricted to trusted origins.

### 7.3 Tutors, eligibility, and profile control (`TUT`)

#### TUT-01 — Tutor application and public eligibility `P0 [AGREED + OPEN policy]`

**As a tutor**, I can request to join Learli, but I am not automatically publicly bookable.

**Acceptance criteria:**

- Tutor can register and submit required basic professional/subject information.
- Until approved under the launch-market review policy, the tutor is **not shown as bookable**.
- The exact identity/qualification/safeguarding review is **`[OPEN]`**; developers must not substitute a checkbox for actual required review.
- Approved, rejected, and suspended outcomes are controlled by authorized admin/server logic and audited.
- No elaborate tutor teaching-quality or performance-management features are built.

#### TUT-02 — Tutor manages own public profile `P0 [AGREED]`

**As an approved tutor**, I can maintain an accurate teaching profile.

**Acceptance criteria:**

- Tutor can edit own headline/bio, supported subjects/levels, and applicable teaching languages.
- Empty or invalid required fields are rejected with clear errors.
- Display text is safely rendered; unsafe HTML/scripts are not executed.
- Updating another tutor's profile is forbidden even via direct API calls.
- The profile reflects review/publication rules chosen for the launch market.
- Owner decision 2026-10-11: an approved tutor's edit needs no re-review, and a rejected tutor may edit and submit again, which returns the application to pending (`docs/decisions/2026-10-11-tutor-profile-edits.md`).

#### TUT-03 — Supported subjects and specialization `P0 [AGREED]`

**As a tutor**, I can identify the topics and learner levels I actually teach.

**Acceptance criteria:**

- Tutor selects from real active subjects and can describe an available specialization according to catalog rules.
- Tutor cannot offer a subject that the catalog has explicitly disabled for bookings.
- Search/matching uses actual declared and eligible tutor-subject/level relations.
- Tutors supporting college topics can appear for **College Support** searches.

#### TUT-04 — Set timezone and recurring availability `P0 [AGREED]`

**As a tutor**, I can express the days/times when I accept lessons.

**Acceptance criteria:**

- Tutor chooses a real **IANA timezone**.
- Availability is defined in **tutor-local wall-clock time** and rendered into concrete UTC slots for specific dates.
- Invalid periods (end before start, unsupported ambiguous conversions) receive clear validation.
- Tutor cannot expose already-booked times as newly available.
- Only the owner/authorized support can manage the relevant schedule.

#### TUT-05 — Exceptions/time off `P1 [RECOMMENDED]`

**As a tutor**, I can mark a holiday or unavailable period.

**Acceptance criteria:**

- An exception suppresses affected candidate slots without deleting the repeating schedule.
- If an exception conflicts with a confirmed booking, Learli does not silently cancel it; it invokes the approved change/support workflow.
- All displayed times remain timezone-correct.

#### TUT-06 — View assigned bookings `P0 [AGREED]`

**As a tutor**, I can see bookings assigned to me.

**Acceptance criteria:**

- Upcoming and past bookings show accurate status, learner's **minimum necessary** information, subject, and local schedule.
- Tutor cannot view other tutors' bookings or unrelated children.
- Changes update after committed booking transitions; empty states are handled.

### 7.4 Learners and guardian relationships (`FAM`)

#### FAM-01 — Parent-managed learner profile `P0 [AGREED; consent policy OPEN]`

**As a parent/guardian**, I can manage a minimal profile for a child I am authorized to represent.

**Acceptance criteria:**

- Collect only the approved minimum learner fields (e.g., display name and level); **school name/address/date of birth are not default requirements**.
- Guardian association is trusted/verified under the approved age/consent policy, not proven merely by knowing a child's name.
- Unrelated users cannot search, view, or alter the private learner profile.
- Parent can choose among only their authorized linked learners when booking.
- Do **not** enable public child onboarding if the country-specific consent rules remain unresolved.

#### FAM-02 — Eligible self-managed learner `P0 [AGREED]`

**As an eligible college learner**, I can create/use my own learner profile without requiring a guardian.

**Acceptance criteria:**

- Appropriate eligibility is determined under the approved country/age policy.
- User can view their own learner profile and bookings.
- User cannot self-link to another learner or impersonate a guardian.

#### FAM-03 — Parent booking overview `P0 [AGREED]`

**As a parent**, I can see the practical status of tutoring I arranged.

**Acceptance criteria:**

- Dashboard shows linked learners and each learner's upcoming/past bookings, tutor, subject, local date/time, and status.
- Any payment history shown represents **actual approved payment records only**.
- No gradebook, detailed mastery scores, assignment progress, or mandatory academic feedback dashboard.
- Parent cannot read another family's bookings through guessed IDs or route changes.

#### FAM-04 — Parent-only child login model `P1 [RECOMMENDED; OPEN]`

**As a family**, I can coordinate tutoring without needing a separate account for every young child.

**Acceptance criteria:**

- The implementation may use **parent-managed child profiles** as the simpler initial model.
- Whether independently signed-in minors are allowed remains **`[OPEN]`**, based on consent/safeguarding and product decision.
- Do not enable independent child accounts by default without approved controls.

### 7.5 Search, matching, and availability display (`MATCH`)

#### MATCH-01 — Simple guided matching `P0 [AGREED]`

**As a learner or parent**, I can get suitable tutor suggestions without manually searching everything.

**Acceptance criteria:**

- Questionnaire asks for **subject/topic, level, preferred availability and timezone**; any extra fields must have a clear purpose.
- Matching only uses **eligible tutors** with real compatible subject/level offerings.
- Ranking is rule-based and explainable (e.g., fit and available times), not described as AI.
- Results show fewer than three suggestions if fewer than three fit.
- A no-match case offers to change filters or contact support; no synthetic/fake tutors.

#### MATCH-02 — Search and matching agreement `P0 [AGREED]`

**As a user**, I should not see a tutor offered through matching when browsing would say they are ineligible.

**Acceptance criteria:**

- Search, matching, and booking share the same underlying tutor status/subject/level eligibility rules.
- An admin suspension or subject removal prevents future bookability everywhere.
- Availability shown as a preview is revalidated server-side when booking.

#### MATCH-03 — Real available slots `P0 [AGREED]`

**As a user**, I can see valid bookable local times.

**Acceptance criteria:**

- Candidate times respect tutor schedule, exceptions, existing active bookings, supported session duration once approved, and timezone/DST transitions.
- Dates/times explicitly show the **viewer-local date/time and timezone context**.
- Past/unavailable times do not appear as selectable.
- A stale UI selection results in a graceful error, never an overlap.

### 7.6 Booking and lifecycle (`BKG`)

#### BKG-01 — Start a booking for an authorized learner `P0 [AGREED]`

**As a learner or parent**, I can request a session with an eligible tutor.

**Acceptance criteria:**

- Server validates signed-in identity, learner ownership/link, tutor status, offered subject/level, and requested time.
- Missing/malformed fields produce clear, non-sensitive errors.
- No confirmed booking is created from an unverified browser-only availability claim.
- Repeat submission with the same idempotency key cannot generate duplicate bookings.

#### BKG-02 — Atomic double-booking prevention `P0 [AGREED]`

**As every customer and tutor**, we never have two mutually overlapping active reservations for one tutor.

**Acceptance criteria:**

- Concurrent requests for overlapping tutor times are resolved **in PostgreSQL**, not just by disabling a button.
- At most one conflicting reservation succeeds; rejected requester sees “That time is no longer available” (or equivalent).
- Booking interval requires `end_at_utc > start_at_utc`.
- Integration tests use an actual PostgreSQL-compatible database with concurrent requests.

#### BKG-03 — Correct provisional and confirmed statuses `P0 [GATED]`

**As a customer**, I know whether I really have a confirmed lesson.

**Acceptance criteria:**

- Final state machine/hold duration depend on approved trial and payment policy **`[OPEN]`**.
- A pending/test/awaiting-payment record is **not labeled confirmed or paid** unless all approved requirements are satisfied.
- Expired/failed abandoned reservations do not block a tutor slot forever.
- Important transitions are recorded for support/audit.
- Developers may demonstrate this workflow using **clearly marked simulated data only in dev/test** until rules are approved.

#### BKG-04 — Booking detail and history `P0 [AGREED]`

**As an authorized participant**, I can review my actual bookings.

**Acceptance criteria:**

- Booking detail shows tutor, learner-safe identifier, subject, local date/time, current status, and relevant private meeting information **only when access is permitted**.
- Student, guardian, and assigned tutor see only their corresponding records.
- Completed, cancelled, and expired statuses are distinguished rather than silently deleting past bookings.

#### BKG-05 — Reschedule a lesson `P0 capability; [GATED] policy`

**As an eligible participant**, I can move a booking when the approved policy allows it.

**Acceptance criteria:**

- UI displays actual allowed changes under published terms (cutoff windows are `[OPEN]`).
- Rescheduling atomically checks availability and conflicts for the new time.
- Failed reschedule does **not** lose the original valid booking.
- Successful change updates history, all relevant dashboards, and notices.
- If policy is undecided, show an honest support/contact route rather than inventing self-serve eligibility.

#### BKG-06 — Cancel a lesson `P0 capability; [GATED] policy`

**As an authorized participant**, I can cancel under the approved terms.

**Acceptance criteria:**

- Confirm who may cancel, cutoff, refund/credit/no-show implications **before** enabling live cancellation.
- Changes are server-authorized, recorded, and reflected in schedules.
- A cancellation does not cause unsupported automatic payouts or refunds.
- Cancellation result and booking/payment state cannot contradict each other.

#### BKG-07 — Basic completion and no-show status `P1 [OPEN rules]`

**As a user**, I can understand the operational booking outcome.

**Acceptance criteria:**

- Authorized actions may set outcomes under an approved policy.
- **“Completed” is a Learli administrative status, not verified Zoom/Meet attendance.**
- Actual attendance claims require a later supported integration and appropriate privacy/consent review.

### 7.7 External lesson links (`MEET`)

#### MEET-01 — Tutor provides an allowed meeting URL `P0 [AGREED]`

**As a tutor**, I can supply the relevant Zoom/Google Meet join details securely.

**Acceptance criteria:**

- Accept approved `https://` Zoom/Google Meet URL host patterns; parse hostnames safely, **not substring matching**.
- URL belongs to a booking or another approved protected setting; it is **not shown on public tutor profiles**.
- Only authorized tutor/support actors can change the link.
- Decide reusable vs per-booking link handling with founder/product owner `[OPEN]` before treating either as a safety default.

#### MEET-02 — Participants access the correct private link `P0 [AGREED]`

**As an eligible participant**, I can join my confirmed lesson.

**Acceptance criteria:**

- Link visible only to the booking's authorized student/guardian and assigned tutor, according to safety policy.
- Unrelated visitors/users do not gain access by guessing a booking URL.
- Link availability follows booking status and approved access rules.
- Learli does not log full meeting URLs, expose them in SEO metadata, or add them to public search.

#### MEET-03 — External lesson boundary `P0 [AGREED]`

**As a user**, I understand what Learli does and what Zoom/Meet does.

**Acceptance criteria:**

- The lesson opens externally through Zoom or Google Meet; Learli doesn't claim to host the call.
- No embedded video SDK, auto recording, meeting transcript collection, or live attendance-tracking implementation.
- Safety guidance explains appropriate meeting settings and guardian oversight requirements without falsely claiming Learli controls the third-party service.

### 7.8 Dashboards, notifications, and support (`OPS`)

#### OPS-01 — Student booking dashboard `P0 [AGREED]`

**As a learner**, I can see my own next lesson and booking history.

**Acceptance criteria:**

- Upcoming, past, and changed bookings have accurate status and local timezone.
- Private meeting link is restricted by the same rules as booking detail.
- No homework submissions, grades, lesson-progress charts, or file attachments.

#### OPS-02 — Tutor booking dashboard `P0 [AGREED]`

**As a tutor**, I can manage my availability and view assigned lessons.

**Acceptance criteria:**

- Tutor controls only their profile/schedule and sees only assigned bookings.
- Tutor can supply permitted external meeting details.
- Suspended tutors cannot accept new bookings.

#### OPS-03 — Parent coordination dashboard `P0 [AGREED]`

**As a guardian**, I can organize tutoring for linked learners.

**Acceptance criteria:**

- Select an authorized learner; view bookings/status and applicable actual payment records.
- Do not show unrelated child data or fabricate tutor progress assessments.
- Appropriate changes have clear actions and explanations of policy.

#### OPS-04 — Transactional email `P0 [AGREED]`

**As an account holder**, I receive essential notices related to authentication and bookings.

**Acceptance criteria:**

- Use Resend for verified email and password reset, booking confirmations and material booking changes/cancellations.
- Send booking notices **after committed DB transitions**; email failure must not roll back an otherwise valid booking into a false state.
- Do not send private student data, secrets, or full session links in unsafe subjects/logs.
- Test against supported Resend development recipients; use a **verified owned domain** before broad public sending.
- Optional scheduled reminders are included **only if** a reliable, cost-appropriate scheduling method is approved.

#### OPS-05 — Contact, support, and incident reporting `P0 [AGREED]`

**As a learner, guardian, or tutor**, I have a way to report a booking issue or safety concern.

**Acceptance criteria:**

- Prominent route to contact/support and report inappropriate/unsafe conduct.
- Safety reports are visible only to authorized human reviewers.
- Cases have minimal status, assignment/escalation capability, and safe audit trail.
- Review/escalation process and responsible owner must exist before public operation involving minors.
- No custom real-time support chat or automated moderation engine required.

#### OPS-06 — Verified lesson reviews `P1 [AGREED concept; OPEN policy]`

**As a legitimate customer**, I may submit a fair review when the review policy allows it.

**Acceptance criteria:**

- Reviewer eligibility is tied to an authorized **eligible completed booking**, not an anonymous visitor.
- Prevent duplicate/unrelated reviews and allow moderation of inappropriate content under an approved policy.
- No fake reviews, misleading average ratings, or invented lesson counts.
- Exact eligibility, display, dispute, and moderation rules remain `[OPEN]`; no live review publishing before these are specified.

### 7.9 Essential administration (`ADM`)

#### ADM-01 — Tutor eligibility administration `P0 [AGREED capability; OPEN details]`

**As an authorized admin**, I can review and activate/suspend tutors according to the approved safety process.

**Acceptance criteria:**

- Approval/rejection/suspension restricted to authorized staff.
- Public discovery and future bookability respond promptly to status changes.
- Decision and actor/time are auditable, with minimal data exposure.
- No academic performance reviews or curriculum audits.

#### ADM-02 — Subject/catalog administration `P0 [AGREED]`

**As an admin**, I can maintain the real list of available subjects.

**Acceptance criteria:**

- Create/update/deactivate allowed subjects or specialist offerings.
- Referential integrity prevents breaking existing bookings; deactivation prevents new unsuitable bookings.
- Changes propagate to search/matching and tutor selection.

#### ADM-03 — Booking/support lookup `P0 [AGREED]`

**As a support admin**, I can investigate a specific support request without uncontrolled access to all student data.

**Acceptance criteria:**

- Legitimate support roles see only the information necessary for the case.
- Sensitive actions are logged; admin is not an unmonitored super-user.
- Manual support operations cannot silently bypass booking constraints or payment status rules.

#### ADM-04 — Account safety actions `P0 [AGREED]`

**As an admin**, I can restrict unsafe or ineligible accounts under approved procedures.

**Acceptance criteria:**

- Restriction affects the relevant abilities (booking/teaching/viewing privileged data).
- Existing sessions/bookings receive an operational response rather than disappearing.
- Actions and reasons are appropriately recorded without exposing unnecessary confidential data.

### 7.10 Payments and commerce (`PAY`) — **decision-gated**

**Payment processing is a planned marketplace function, but the specific business model is not approved.** Avoid building a “complete” commerce system against guessed rules.

#### PAY-01 — Founder-approved money flow `P0 for paid launch [OPEN]`

**Decisions required:** Who receives customer money (Learli or tutor), one-off vs package vs subscription, price setter, commission/fees/payouts, launch jurisdictions and currencies, provider eligibility.

**Acceptance criteria before coding live checkout:**

- Founder records approved commercial model and exact customer-facing offer.
- Payment provider is eligible for the actual company/jurisdiction and the settlement model.
- Pricing, tax/disclosure, cancellation/refund, trial and chargeback responsibilities are reviewed.
- New payments schema follows that approved model rather than a generic marketplace template.

#### PAY-02 — Secure verified checkout `P0 after PAY-01 [GATED]`

**As a customer**, I pay securely through an approved provider.

**Acceptance criteria:**

- Use provider-hosted checkout or approved secure elements; **no raw card number/CVV storage**.
- Server owns expected price, amount, currency, booking and settlement status.
- A browser success redirect **does not** establish payment success; use verified server events.
- Webhook signatures and event IDs are validated/deduplicated; retries are idempotent.
- Payment failure, late success, cancellation, refunds, and applicable payouts have auditable, reconciled outcomes.
- No real charges or misleading “paid” status in unapproved environments.

#### PAY-03 — Payment visibility `P1 after PAY-01 [GATED]`

**As a paying user**, I can see relevant authentic payment/receipt history.

**Acceptance criteria:**

- Show actual provider-backed transactions only, with correct currency and status.
- Parent sees only payments tied to their authorized transactions/learners.
- Refund/credit history matches the approved processor and policy; no invented balances.

---
## 8. Cross-feature business rules and invariants

These rules apply across routes, forms, background work, and future mobile APIs. **Do not rely on the UI alone to enforce them.**

| ID | Invariant / required behavior | Status |
|---|---|---|
| BR-01 | A tutor must be appropriately **approved and active** to appear as bookable. | `[AGREED]` |
| BR-02 | A tutor may offer only subjects/levels recorded as eligible offerings. | `[AGREED]` |
| BR-03 | A parent may act only for learners with a **valid authorized guardian link**. | `[AGREED]` |
| BR-04 | An eligible independent college learner may book for self. | `[AGREED]` |
| BR-05 | Any reservation or booking mutation rechecks identity, ownership, eligibility, and availability server-side. | `[AGREED]` |
| BR-06 | **At most one conflicting active booking/hold** exists for a tutor/time interval; enforce at DB transaction level. | `[AGREED]` |
| BR-07 | Persist booked instants in UTC, store actual IANA timezone where relevant, and display correct local date/offset. | `[AGREED]` |
| BR-08 | Meeting URLs remain **private** to authorized participants; public profile/SEO pages cannot contain them. | `[AGREED]` |
| BR-09 | No payment is “successful” on browser navigation alone; server must verify provider state. | `[AGREED]` |
| BR-10 | Payment/trial/hold/cancellation windows and fee amounts cannot be assumed before business approval. | `[OPEN]` |
| BR-11 | Significant booking, approval, and money transitions should have an appropriate audit/history record. | `[RECOMMENDED]` |
| BR-12 | Email delivery failures must not misrepresent a committed booking's status. | `[AGREED]` |
| BR-13 | Reviews require eligible real bookings; no artificial reviews or fabricated tutor counts. | `[AGREED concept / OPEN details]` |
| BR-14 | No lesson attendance is inferred merely from having generated a Zoom/Meet link. | `[AGREED]` |
| BR-15 | Public child profile search, unnecessary child data collection, adult–minor private chat, and recordings are excluded. | `[AGREED]` |
| BR-16 | Minimum guardian/age/safeguarding processes must be approved before a real-minor launch. | `[OPEN required gate]` |
| BR-17 | No actual financial charge, subscription, payout, or refund occurs without explicit approved model/provider. | `[AGREED]` |
| BR-18 | Historical bookings/payment obligations cannot be silently deleted to hide an error. | `[AGREED]` |

### 8.1 Booking states are **proposed**, not yet contractually final

Until PAY-01 and cancellation/trial policies are approved, the following names are **illustrative**, consistent with the architecture draft:

```text
PENDING → AWAITING_PAYMENT → CONFIRMED → COMPLETED
   │              │              │
   ├─ EXPIRED     ├─ EXPIRED     ├─ CANCELLED
   └─ CANCELLED   └─ FAILED      └─ NO_SHOW (approved policy only)
```

Developers must define **allowed transitions, actor permissions, hold expiry, retries, and refund effects** in a reviewed state machine before wiring real money or cancellation automation.

### 8.2 Double-booking example

Two parents independently see a tutor free at the same time. Both submit a booking request. The database transaction/constraint permits only one conflicting active reservation. One sees an accepted result; the other sees that the slot is unavailable and may choose another time. This must still hold under concurrent execution and retried requests.

### 8.3 Cross-time-zone example

A Manila tutor offers a recurring evening window. A California family sees the **correct local date and time for each actual date**, including when California enters or leaves daylight-saving time. Do not hard-code a fixed country-to-country hour difference.

---

## 9. Conceptual data requirements (not a final ERD)

The technical schema remains governed by `architecture.md` §9. **These are product entities and relationships, not permission to run migrations without schema review.**

| Entity / group | Product purpose | Key constraints |
|---|---|---|
| **Better Auth identity records** | Account, session, credential linkage, verification | Use installed Better Auth schema; protect secrets |
| `user_roles` | Authorized student, parent, tutor, admin roles | Trusted assignment; unique relevant role membership |
| `tutor_profiles` | Public teaching offer and review state | One owner; approval and suspension gate |
| `subjects`, `tutor_subjects` | Real catalog and tutor eligibility by level/topic | No fake/disabled offerings in search |
| `learner_profiles` | Minimal data for children or eligible independent learners | Private; self-owned or guardian-managed |
| `guardian_learner_links` | Who may represent each learner | Authorized/verified link required |
| `tutor_availability` | Recurring local teaching windows | IANA timezone, valid local intervals |
| `tutor_availability_exceptions` | Time off/unavailability | Must not silently erase confirmed bookings |
| `bookings` | Tutor, learner, subject, UTC start/end, state | Ownership, legal transition, atomic no-overlap |
| `booking_events` | Minimal history of important changes | Actor, timestamp, safe metadata |
| `reviews` | Booking-backed feedback if policy approved | Eligibility + moderation policy |
| `support_cases` | Support and safeguarding reports | Restricted access and responsible reviewer |
| `audit_events` | Sensitive staff/financial/guardian actions | No unnecessary personal details in logs |
| Payment-related entities | Provider states/transactions/payouts, **if selected** | **`[OPEN]`: do not design definitive tables yet** |

### Data-minimization rules

- Do not collect default child home address, exact school, birthdate, government ID, grades, assignments, or sensitive education details merely for “future use.”
- Do not store a student's classroom materials in PostgreSQL or an object store in MVP.
- Store only meeting URLs necessary for authorized bookings, with private read rules and safe logging.
- Use genuine verification/consent statuses, not UI booleans trusted from the browser.
- Avoid hard deletion of important booking/payment records; implement documented, lawful retention and deletion processes after legal review.

---

## 10. Edge cases and expected user experience

| Scenario | Expected result / product behavior | Priority |
|---|---|---|
| No tutors in the database | Helpful empty state; no fictional tutor cards or ratings | P0 |
| No tutors match the search | Explain no current match; allow changing subject, level, or availability | P0 |
| Tutor deactivated during profile visit | New booking is rejected; public bookability changes | P0 |
| Tutor removes subject after existing booking | Existing booking/history remains intact; support needed for any impacted lesson | P0 |
| Selected slot taken before checkout | Server rejects gracefully; show real alternative times | P0 |
| Two overlapping requests arrive together | Database allows only one conflicting active reservation | P0 |
| User double-clicks booking or retries after timeout | Idempotent request avoids duplicate reservations | P0 |
| Payment not completed | Do not show paid/confirmed unless approved model allows confirmation | Paid-launch P0 |
| Payment webhook arrives twice or out of order | Verified idempotent reconciliation; no duplicate charge/confirmation | Paid-launch P0 |
| Email provider is temporarily unavailable | Keep correct DB state; safe retry/error handling; no false email claims | P0 |
| Parent uses another parent's learner ID | Deny/avoid resource disclosure; create no booking | P0 |
| Tutor opens unrelated private booking | Deny access; audit suspicious repeated access as appropriate | P0 |
| Account suspended after a booking | Block inappropriate new operations; existing lesson handled through reviewed support policy | P0 |
| DST makes a proposed local time nonexistent/ambiguous | Correctly resolve/reject and explain; never shift silently into wrong time | P0 |
| Tutor tries to delete availability covering a confirmed session | Existing booking protected; prompt approved support/reschedule process | P0 |
| Wrong/malicious third-party meeting URL | Reject unsafe hostname/scheme; keep private data private | P0 |
| Meeting link not yet provided | Do not fabricate one; show accurate missing-link status and support route | P0 |
| Resend account has no verified sending domain | Development uses permitted testing; production general-user sending blocked until domain verified | Paid-launch P0 |
| No prices/payment model decided | Do not activate live checkout, pricing promises, auto-confirmed paid sessions | P0 gate |
| Tutor has no genuine reviews | Display “No reviews yet,” not a fabricated 5-star score | P0 |
| Learner/parent uses mobile narrow screen | Core paths usable without horizontal overflow, broken forms, or inaccessible controls | P0 |
| User changes timezone after booking | Same stored UTC instant; display recalculated local date/time | P0 |
| Search engine indexes site | Public pages indexable; private dashboards, child data, and meeting URLs not exposed/indexable | P0 |
| User requests account/data access or deletion | Route to actual privacy process; keep lawfully required records only | Paid-launch P0 |

---

## 11. Security, privacy, safeguarding, and policy requirements

**These are product launch requirements, not a claim that compliance is complete.** The business must identify its actual operating jurisdiction, target countries, and applicable laws with qualified advice before handling real minors or processing payments.

### 11.1 Account and access protections `[AGREED]`

- Production HTTPS and secure HTTP-only session cookies.
- Authentication and role/ownership authorization for every private read/write.
- Protected Better Auth password-reset/verification workflows; rate limiting for abuse-prone endpoints.
- Server input validation and safe output rendering; no unsafe profile HTML or arbitrary redirects.
- Secrets stored server-side in environment variables; never in Git or `NEXT_PUBLIC_*`.
- Limit exposure of private meeting links, student data, support cases, and financial details.
- Appropriate minimal audit logs for staff permissions and high-impact actions.
- Consider enforcing admin MFA before live handling of user records.

### 11.2 Children and guardian protection `[AGREED baseline; OPEN legal details]`

- Parent/guardian relationship must be appropriately **established and authorized** before child bookings.
- Do not expose minors' personal data in the public directory, tutor profiles, URL previews, analytics payloads, or meeting link metadata.
- Tutors see the minimum necessary learner context for delivering assigned tutoring.
- Explicitly **no adult–minor in-platform private chat** or Learli-recorded sessions in V1.
- Establish a practical staff-run way to report concerning behavior, review it, restrict accounts, and escalate issues.
- Define tutor screening, platform communications, guardian supervision, and third-party meeting settings suitable for launch countries.
- Country-specific age thresholds, consent notices, retention, and contact rules are **`[OPEN]`**. Do not invent them.

### 11.3 Policies needed before a public paid launch `[GATED]`

- Accurate Terms of Service, Privacy Notice, and applicable consent notices.
- Tutor onboarding/eligibility requirements and safety/incident-response process.
- Parent/guardian authorization and account access rules.
- Cancellation, reschedule, no-show, trial, refund/credit, chargeback terms.
- Who is merchant/payee, tutor payout/fee responsibilities, taxes, currencies, and record retention.
- Appropriate contact details and accessible complaint/safety channel.
- Verify applicability of Philippine Data Privacy Act, COPPA (U.S. children), GDPR/UK GDPR, and any other jurisdiction-specific rules **as relevant**; these examples are not a universal list or legal determination.

### 11.4 Retention and backups `[AGREED requirement; OPEN retention values]`

- Determine a justified record-retention schedule and a process for data access/deletion requests.
- Review Neon plan backup/restore capabilities; do not assume the free tier is sufficient for production records.
- Test restoration in a non-production environment and record who is responsible for an incident.
- Production logs and backups should not contain unnecessary child information or secrets.
- Choose recovery targets appropriate to business risk; do not invent an SLA in the product copy.

---

## 12. Non-functional requirements (`NFR`)

| ID | Requirement | Measurable acceptance / implementation guidance | Status |
|---|---|---|---|
| **NFR-01** | Responsive design | Primary discovery/booking/auth/dashboard flows usable on phone, tablet, desktop; no critical clipping/overflow | P0 `[AGREED]` |
| **NFR-02** | Accessibility | Semantic landmarks, labeled inputs, keyboard navigation, focus indicators, readable errors and contrast; WCAG 2.2 AA as a recommended design target | P0 `[RECOMMENDED]` |
| **NFR-03** | Timezone correctness | UTC booking storage; IANA zones; validated DST boundary tests; correct local date and offset | P0 `[AGREED]` |
| **NFR-04** | Booking consistency | Concurrent requests cannot create overlapping active tutor bookings; idempotent retries | P0 `[AGREED]` |
| **NFR-05** | Privacy/access control | No cross-user data leakage in tests; restricted meeting URLs; no secrets in client assets | P0 `[AGREED]` |
| **NFR-06** | Maintainable architecture | Next.js modular monolith; business rules in server-side services; reviewed Drizzle migrations | P0 `[AGREED]` |
| **NFR-07** | Search visibility | Public marketing/tutor pages use accessible metadata and SEO-friendly rendering; private pages not indexable | P1 `[RECOMMENDED]` |
| **NFR-08** | Performance | Establish a baseline on actual target devices/connection profiles before choosing quantitative thresholds; measure real public page loading and booking-response time | P1 `[RECOMMENDED]` |
| **NFR-09** | Error resilience | Useful retry/error states; mail failures do not corrupt booking records; clear support path | P0 `[AGREED]` |
| **NFR-10** | Observability | Monitor Railway CPU/RAM/network/billing, Neon utilization, email failures, booking errors; redact sensitive data | P0 `[RECOMMENDED]` |
| **NFR-11** | Environment separation | Development and production data/secrets isolated; synthetic data in tests; controlled migrations | P0 `[AGREED]` |
| **NFR-12** | Backup/recovery | Tested restore path and documented responsibilities before handling paying customers' records | Paid-launch P0 `[AGREED]` |
| **NFR-13** | Mobile future readiness | Server business rules independent from page components; future secured API possible without replacing app | P1 `[AGREED direction]` |
| **NFR-14** | Cost visibility | Usage alerts/reviews where provider permits; no assumption Railway is a fixed unlimited $5/month | P1 `[AGREED direction]` |

**Not promised:** An unverified 99.9% SLA, fixed response latency, guaranteed tutoring outcomes, or 24/7 live support. Quantitative service targets must be decided using actual operations and data.

---

## 13. Technology and third-party integration constraints

This section summarizes the agreed stack; implementation details belong to `architecture.md` and `AGENTS.md`.

| Concern | Approved / planned approach | Product implication |
|---|---|---|
| Application | **Next.js App Router + React + TypeScript** | One responsive full-stack web app |
| UI | **Tailwind CSS + shadcn/ui** | Consistent, accessible, mobile-first design |
| Database | **Neon PostgreSQL** | Structured user, tutor, and booking records |
| DB access | **Drizzle ORM / Drizzle Kit** | Typed server-side queries and reviewed migrations |
| Authentication | **Better Auth** | Email/password, verification, sessions, resets |
| Hosting | **Railway** | One conventional Next.js Node service initially |
| Transactional email | **Resend (start Free tier)** | Test on supported recipients; verify owned sending domain for broad public mail |
| Live instruction | **Zoom / Google Meet** | External lesson links; no Learli media processing |
| File uploads | **Not provisioned** | Use static branded assets/initials avatars |
| Payments | **Provider `[OPEN]`** | No live checkout until legal/business decisions |
| Optional future storage | Neon Object Storage **only if justified** | Not an MVP account or dependency |

### 13.1 Deployment and domains

- Learli can initially run on a generated Railway `*.up.railway.app` HTTPS URL; **website-domain purchase is not required to begin development**.
- An assigned Railway URL is **not** a domain that the team owns for arbitrary Resend sender verification. Plan to acquire/verify a sending domain before relying on email to real customers.
- Maintain distinct Neon credentials/data for local development and production (staging if justified).
- A paid public release requires reliable backup/restore verification and acceptable operational monitoring.
- Confirm actual provider quotas, features, pricing, terms, and runtime compatibility at implementation time.

### 13.2 External-integration boundaries

- **Zoom/Meet:** tutor-provided HTTPS joining information with appropriate safety settings. No OAuth/meeting APIs at launch unless explicitly approved.
- **Resend:** transactional email, not a newsletter or marketing automation system.
- **Payments:** once approved, prefer provider-hosted checkout, server-verified signed webhooks, reconciliation, and idempotency. Never collect/stash raw card data.
- **Analytics:** use minimal aggregate events; don't create a tracking profile of a child to optimize conversions.

---

## 14. UX, content, and design acceptance

### 14.1 Overall language and layout

- Style: clean, welcoming, credible, modern; friendly for parents/young learners, appropriate for college students.
- Logo: **`learli`** in lowercase; **Learli** in regular body text.
- Initial palette direction: deep navy plus teal accent; do not invent a rigid design system before design review.
- Use plain language rather than internal terms (e.g., “Find a tutor,” “Choose a time,” “Your bookings”).
- Avoid claiming AI matching, validated academic outcomes, guaranteed availability, or “international curriculum certification.”

### 14.2 Form UX

- Ask only information needed **at the step where it becomes necessary**.
- Show required fields, inline validation, progress/disabled states while submitting, and a clear next action.
- Remember selections across a legitimate login flow; revalidate booking availability afterward.
- Distinguish **viewer local time** from tutor local time if shown; include the calendar date.
- Confirmation screens display only actual persisted state, not optimism from a click.

### 14.3 Public trust

- List only real eligible tutors; no placeholder faces, invented testimonial quotes, fake reviews, inflated counts, or unverified credentials in production.
- If no profile photo upload is implemented, use a consistent initials/avatar design.
- A tutor bio does not imply platform endorsement beyond the actual stated review process.
- Avoid “Book a Free Trial” as an unconditional CTA until the trial policy is `[AGREED]`.

---

## 15. Quality assurance and test plan

### 15.1 Required testing layers `[RECOMMENDED tools; AGREED outcomes]`

- **Unit:** match/filter rules, validation, time zone utilities, authorization helpers, valid booking-state transitions.
- **Integration:** Postgres schema constraints and transactions, guardian linkage, booking concurrency, account suspension, email failure handling; payment webhook verification after provider chosen.
- **End-to-end:** browse → profile → sign-in → authorized learner booking → private meeting link; parent vs unrelated parent; tutor control; admin review.
- **Manual QA:** actual mobile/desktop viewports, keyboard and screen-reader spot checks, empty/error states, time zones, support/report path, link privacy.

### 15.2 P0 acceptance matrix

| Test ID | Required scenario | Related requirements | Pass condition |
|---|---|---|---|
| **QA-01** | Zero-tutor and no-match site | PUB-02/03, MATCH-01 | Honest message; no fabricated profiles |
| **QA-02** | Pending/suspended tutor | TUT-01, MATCH-02 | Not publicly bookable |
| **QA-03** | Profile ownership attack | AUTH-03, TUT-02 | Cross-tutor edit denied |
| **QA-04** | Parent A accesses Parent B learner/booking | AUTH-03, FAM-01/03 | Unauthorized access denied |
| **QA-05** | Eligible independent college student | FAM-02 | Can manage own bookings without guardian |
| **QA-06** | Two customers book same slot concurrently | BKG-02 | At most one conflicting active booking |
| **QA-07** | Booking retry/double-click | BKG-01/02 | No duplicate booking created |
| **QA-08** | Manila/California across DST boundary | TUT-04, MATCH-03, BKG-01 | Correct absolute time and local display |
| **QA-09** | Reschedule conflict | BKG-05 | Original booking remains if new slot fails |
| **QA-10** | Unapproved payment/trial mode | BKG-03, PAY-01 | No real checkout or false paid confirmation |
| **QA-11** | Browser success without verified payment | PAY-02 | Booking/payment not marked paid |
| **QA-12** | Webhook retry and signature failure | PAY-02 | Forged/duplicate events do not change financial state |
| **QA-13** | Invalid/malicious meeting URL | MEET-01 | Rejected server-side |
| **QA-14** | Unrelated user guesses a booking URL | MEET-02, BKG-04 | Meeting link remains private |
| **QA-15** | Resend unavailable after DB commit | OPS-04 | Booking record remains correct; safe failure visible for operations |
| **QA-16** | Verified-review requirement | OPS-06 | No anonymous/unrelated published review |
| **QA-17** | Child safety report | OPS-05, ADM-03 | Accessible channel, restricted reviewer, traceable case |
| **QA-18** | Account suspension with existing booking | ADM-04 | No new forbidden actions; existing obligation not silently deleted |
| **QA-19** | Secrets and private URLs | AUTH-03, MEET-02, NFR-05 | No sensitive values in client code/public metadata/logs |
| **QA-20** | Narrow viewport + keyboard flow | NFR-01/02 | Browse/auth/book core flow usable and accessible |

Tests QA-11/12 are **gated** until an approved provider/business model exists. QA-16 depends on approved review rules. Testing need not fabricate live policy outcomes to achieve green checks.

### 15.3 Before merging/deploying changes

- Run the repo's actual lint, typecheck, relevant test commands, and Next.js production build; report real results.
- Review schema migrations against non-production database; never casually push experimental schema to production.
- Check authorization/privacy and booking concurrency on any feature touching those boundaries.
- Review changes for accidental scope creep (LMS, uploads, custom video, unapproved financial features).
- Validate responsive screens and critical loading, error, empty, and permission-denied states.
- Do not describe a simulated booking as a real transaction or an unverified screen as working backend behavior.

---

## 16. Recommended phased implementation plan

Each phase should produce a **testable outcome** without assuming the next phase already exists. These are **sequence recommendations, not calendar commitments**.

| Phase | Deliverables | Demonstration / exit condition |
|---|---|---|
| **0 — Decide & scaffold** | Repo, documentation, initial constraints, Next.js/TypeScript, basic UI system | App builds/runs locally; scope and blockers visible |
| **1 — Foundation & auth** | Neon dev, Drizzle migrations, Better Auth, roles/ownership, protected routes | Sign up/sign in; forbidden role/record access denied |
| **2 — Tutor catalog** | Subjects, tutor profiles, approval state, public directory/profile, search | Real fictional-dev tutors filter correctly; pending tutors hidden |
| **3 — Matching and schedules** | Guided matching, tutor timezone, weekly availability, exceptions | Correct recommendations and displayed slots across tested time zones |
| **4 — Learners and booking** | Parent-managed learner links (once consent policy settled), eligible college self-management, transactional booking logic | Atomic no-overlap, authorized booking test, correct statuses |
| **5 — Coordination & safety** | Basic dashboards, private Zoom/Meet links, transactional email testing, support/report workflows | Authorized user sees own booking; others cannot view link; cases routed |
| **6 — Commerce decision gate** | **Founder-approved** price/trial/merchant/payout/cancellation model, provider eligibility and policy text | Decisions documented and approved; no guesswork in finance implementation |
| **7 — Approved checkout** | Only required payment integration, verified webhooks, reconciliation, receipts/history | Sandbox payments match bookings; negative tests pass |
| **8 — Controlled pilot & launch** | Railway/Neon production isolation, verified sending domain, safety/legal review, backup/restore, QA, monitoring | Pilot gates met; measured reliability; explicit launch approval |

**Dependency warning:** Real minor onboarding cannot proceed before guardian/consent/safeguarding decisions, even if account screens are technically ready. Paid checkout cannot proceed before commercial and legal decisions.

---

## 17. Launch checklists and definition of done

### 17.1 Development demo readiness

- [ ] Responsive app and real backend routes working in a test environment.
- [ ] Fictional tutor/learner profiles clearly labeled as test data.
- [ ] Better Auth, role protection, catalog, matching, UTC booking correctness demonstrated.
- [ ] Private meeting link flow works without publicly leaking join details.
- [ ] Payment operations (if simulated) **cannot** charge real money and are visibly demo-only.
- [ ] No minor's real data, production credentials, or private financial records used.

### 17.2 Public/paid launch **hard gates**

- [ ] Company location and initial customer/tutor markets confirmed.
- [ ] Money recipient, merchant responsibilities, pricing/fees/commission/payout model decided.
- [ ] One-off/packages/subscriptions and trial policy explicitly documented.
- [ ] Payment provider and supported countries/currencies verified; live financial integration tested end to end.
- [ ] Refund, cancellation, reschedule, no-show, chargeback, and customer-support terms published after review.
- [ ] Required tutor eligibility checks and human safeguarding operations are functional.
- [ ] Guardian/age/consent and child-data controls appropriate to the operating market are approved and tested.
- [ ] Accessible privacy/terms/complaint and safety-report channels are present.
- [ ] Domain ownership and **Resend sender verification** completed; public emails tested.
- [ ] Real-user environments separated from test data; secrets/permissions reviewed.
- [ ] Production backups/restoration tested and incident owner identified.
- [ ] Booking collision, identity/record ownership, meeting-link privacy, refund/payment idempotency QA pass.
- [ ] Railway/Neon/Resend usage observed; alerts or manual cost review cadence established.
- [ ] Founders explicitly approve limited/pilot or public release.

### 17.3 MVP definition of done

Learli V1 is **functionally complete** when, under approved operating and commercial rules:

1. A visitor can find **actual eligible tutors** for the approved subject/level scope.
2. A learner or authorized guardian can select and safely book a genuinely available **1:1** slot.
3. The valid booking/trial/payment conditions are applied correctly without double-bookings or fictitious paid states.
4. Participants can access the **private Zoom/Google Meet** information and manage their legitimate booking/history.
5. A tutor can operate their own profile and schedule; admins can carry out essential eligibility/safety/support actions.
6. Required security, privacy, child-safety, QA, backup, email and legal launch gates are satisfied for the intended audience.

**Learli does not need assignments, a custom classroom, an LMS, AI, tutor teaching-performance management, or uploaded files to meet this definition.**

---

## 18. Open decisions requiring founder approval

**Do not silently convert any of these into a requirement, UI promise, migration, or live feature.** These are also listed in `architecture.md` §20 and `AGENTS.md` §16.

| Priority | Decision | Owner | Why it blocks / affects implementation |
|---|---|---|---|
| **P0** | Who receives customer payments—Learli or tutors directly? | Founder | Merchant model, provider onboarding, payouts, taxes |
| **P0** | One-off lesson, prepaid plan, subscription, or combination? | Founder | Checkout, renewals, booking rights, billing schema |
| **P0** | Exact prices, price setter, fees, commission, and tutor compensation/payout policy | Founder | Currency display, ledgers, settlement, refund math |
| **P0** | Business registration jurisdiction and first launch markets | Founder | Payment provider eligibility, legal/privacy and tax obligations |
| **P0** | Free trial, paid trial, assessment, or none? | Founder | Homepage promise, booking states, payment/hold behavior |
| **P0** | Booking durations, lead times, provisional hold expiration | Founder/Product | Valid slots, reservation lifecycle, reminders |
| **P0** | Cancellation/rescheduling, refund/credit/no-show rules | Founder + legal | Legal terms, actions, payment reconciliation |
| **P0** | Tutor identity/qualification and safeguarding screening, incident owner | Founder + qualified safety/legal reviewers | Whether adults can be publicly bookable to minors |
| **P0** | Minor eligibility, guardian proof/consent, data protection by launch market | Founder + qualified safety/legal reviewers | Whether real child accounts/bookings can open |
| **P1** | Tutor pricing standardized or tutor-set? | Founder | Profiles, filters, price quotes and accounting |
| **P1** | Exact required fields for tutor/learner profile | Product + privacy review | Forms, data minimization, catalog quality |
| **P1** | Tutor-provided meeting link per booking or approved reusable link? | Product + safety review | Security settings and tutor workflow |
| **P1** | Parent-only access for young children vs separate child logins | Product + safety review | Role and session model for minors |
| **P1** | Review eligibility, visibility, moderation, dispute policy | Product | Publishing ratings and reviewer workflows |
| **P1** | Whether reliable scheduled reminders justify a job/scheduler | Product/Engineering | Operational complexity and additional cost |
| **P1** | Whether tutor photos are essential at launch | Product | Future upload/storage decision |

### 18.1 Decision record format

For each approved change, create a short entry under `docs/decisions/`:

```text
Decision ID:
Date:
Status: Approved / Rejected / Deferred
Owner and approver:
Problem and alternatives:
Chosen behavior / rule:
Impact on PRD, architecture, schema, UI, safety, cost:
How acceptance will be tested:
```

A significant product change should update **`PRD.md`**, **`architecture.md`**, and **`AGENTS.md`** wherever relevant, so implementation assistants never receive conflicting instructions.

---

## 19. Future roadmap — not V1 commitments

Only consider these after marketplace demand and operational data justify them:

- Tutor photo and intro-video media uploads (then assess file storage, moderation, consent).
- More advanced availability management or automatic Zoom/Meet creation.
- Tutor-specific packages, settlements or subscriptions **if chosen by the business**.
- More advanced verified reviews, matching/search, or dedicated search indexing.
- Reliable scheduled reminders using a background delivery mechanism.
- Optional learning notes, parent progress insights, or AI-assisted practice **only with a new business decision**.
- Small-group classes, wider categories, formally mapped curricula, advanced tutor operations.
- Native iOS/Android applications consuming appropriate secured APIs.

The roadmap is **not authorization** to build these during MVP.

---

## 20. Traceability: where requirements come from

| This PRD area | Supporting source |
|---|---|
| Learli intermediary scope, exclusions, launch levels/subjects | `architecture.md` §§1–3; `AGENTS.md` §§1–3 |
| Main user flows and page inventory | `architecture.md` §§5–7; `AGENTS.md` §6 |
| Proposed entities and integrity | `architecture.md` §§9–11; `AGENTS.md` §§8–9 |
| Authentication and personal data protection | `architecture.md` §§10,17; `AGENTS.md` §§7,10 |
| Payment gating and external lessons | `architecture.md` §§12–13; `AGENTS.md` §11 |
| Resend, Railway URL, optional storage | `architecture.md` §§14–15,18; `AGENTS.md` §§3,11,14 |
| QA, milestones, launch and open decisions | `architecture.md` §§16–21; `AGENTS.md` §§13,15–17 |
| Historical vision and positioning | Original CalcStream Learning proposal; **superseded by Learli's latest decisions wherever scope conflicts** |

### Final product instruction

> **Build the smallest safe marketplace that connects a real learner to a real eligible tutor for a legitimately bookable 1:1 session. Keep Learli out of the classroom, keep minors' data private, and never guess an unresolved business rule.**
