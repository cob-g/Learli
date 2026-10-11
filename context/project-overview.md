# Learli — Project Overview

> **Project:** Learli (`learli` in the visual brand)  
> **Document:** `project-overview.md`  
> **Version:** 1.0 — Planned MVP  
> **Updated:** 2026-10-11  
> **Status:** Product direction and technical stack agreed; several launch policies remain undecided  
> **Positioning:** *Learning made personal.* (initial tagline direction, not a finalized marketing claim)
>
> **Read with:** [`PRD.md`](./PRD.md) for requirements, [`architecture.md`](./architecture.md) for technical design, and [`AGENTS.md`](./AGENTS.md) for implementation rules. If this overview is less detailed than those documents, follow the applicable detailed requirement. Never treat an **[OPEN]** decision as approved.

## Overview

**Learli is a responsive, international-facing online tutoring marketplace and booking intermediary.** It helps elementary, middle-school, high-school, and eligible college learners—or their parents/guardians—find appropriate tutors, compare profiles, view availability, request guided matches, and arrange **one-on-one online lessons**. The launch focus is **Mathematics, Science, English**, **SAT/ACT and other entrance-exam preparation**, **homework help**, **study skills**, and **specialized subjects actually offered by participating tutors**, including eligible college-level topics. Learli manages discovery, authorized accounts, booking coordination, private meeting-link access, notifications, and basic operational support. **Tutors teach independently through Zoom or Google Meet; Learli is not an LMS, classroom platform, or assignment portal.** Customer pricing and payment operations will be activated only after the founders approve the business and compliance rules.

### Who Learli serves

| Audience | Main need |
|---|---|
| **Visitors** | Understand the service and compare real, approved tutor profiles before signing up. |
| **Parents/guardians** | Find and book tutors for authorized learners; manage lesson schedules and booking details. |
| **Students / independent learners** | Discover tutors and manage their own lessons when age and applicable rules permit. |
| **Tutors** | Present their subjects and teaching offer, manage availability, receive bookings, and teach via Zoom/Meet. |
| **Admins/support** | Maintain essential account eligibility, subject listings, booking support, and learner-safety processes. |

### Product principles

- **Intermediary first:** Connect people and coordinate lessons; leave instruction and learning materials to tutors.
- **Lean, not makeshift:** Build only needed features, but enforce privacy, safeguards, and booking integrity from day one.
- **Trustworthy discovery:** Never invent tutors, qualifications, ratings, available slots, or claims of verification.
- **International-ready:** Respect time zones and supported learning levels without claiming universal curriculum coverage.
- **Future-friendly:** Structure the web app so mobile clients can later use secure, reusable server-side business logic.

## Goals

1. **Make tutor discovery usable before registration.** A first-time visitor can browse actual eligible tutors, inspect subjects/levels, and reach an available booking option or a truthful empty state.
2. **Enable reliable one-on-one bookings.** An authorized learner or guardian can request an available slot, and **zero overlapping confirmed bookings** are allowed for the same tutor and time.
3. **Support both guardian-managed and eligible independent learners.** Parents can manage only their authorized learner profiles, while eligible college learners can book without a parent account.
4. **Keep lessons outside Learli.** Every valid confirmed booking can provide its authorized participants with the appropriate private Zoom/Google Meet details; Learli does not claim to verify actual attendance without an integration.
5. **Give each role a focused workspace.** Tutors manage profiles/availability/bookings; families see schedules and history; admins carry out only essential operational and safety actions.
6. **Launch securely and economically.** The application is tested across roles and time zones, uses the approved stack, and goes live with real users/payments **only after the required safeguarding, payment, policy, email-domain, and operational gates are satisfied**.

> **Metrics note:** Conversion rates, user-count targets, revenue targets, launch countries, and service-level targets are **not yet approved**. Do not present invented targets as commitments.

## Core User Flow

### Student / parent / guardian journey

1. **Visit Learli.** Read how online tutoring works and select a subject or learning need.
2. **Choose a discovery path.** Browse the tutor directory **or** use **Get Matched**, a short **rule-based (non-AI)** questionnaire.
3. **Review real tutor profiles.** Compare genuine teaching subjects, supported school/college levels, teaching details, and current availability.
4. **Choose a tutor and slot.** Select a genuinely available one-on-one appointment shown in the user's local time zone.
5. **Sign up or sign in when necessary.** Verify the account and return to the selected tutor/slot if it remains available.
6. **Identify the learner.** An authorized parent/guardian chooses a linked child profile; an eligible independent learner books for themselves.
7. **Revalidate the booking server-side.** Learli checks user permissions, tutor eligibility, subject/level fit, time availability, and overlapping reservations.
8. **Follow the approved booking/trial/payment conditions.** **[OPEN]** The final commercial flow is not defined; test-only bookings must not charge money or imply payment succeeded.
9. **Receive confirmation and meeting details.** Once legitimately confirmed, the correct booking appears in the dashboards and authorized participants can access its private Zoom/Meet link.
10. **Attend the lesson externally.** The tutor teaches in Zoom or Google Meet using their own instructional methods.
11. **Manage the booking record.** View history/status and request cancellation or rescheduling when allowed by the **approved** policy.

### Tutor journey

1. Register, verify email, and submit basic tutoring profile details.
2. Select genuine subjects, specializations, learner levels, and an IANA time zone.
3. Complete the **minimum approved** eligibility/safeguarding review before becoming publicly bookable.
4. Manage availability and booking requests; provide a permitted Zoom or Google Meet link privately.
5. Deliver the lesson independently and view relevant bookings/history, without submitting mandatory lesson plans or progress reports.

### Admin / support journey

1. Review essential tutor eligibility and account/safety status under the approved policy.
2. Maintain the supported subject catalog and investigate booking/support issues.
3. Suspend or restrict accounts where required, with appropriate audit trails and incident escalation.
4. Access only the minimum private records needed for authorized support tasks.

## Features

### Tutor Discovery & Guided Matching

- Public homepage, how-it-works explanation, subject catalog, and tutor directory.
- Filter by subject, student level, and other genuinely supported criteria such as real availability.
- Public tutor profiles showing only approved, accurate, non-sensitive information.
- A short **rule-based** matching flow; show only available, eligible matches, with honest empty states.
- Clear paths to **Find a Tutor**, **Get Matched**, and **Become a Tutor**.

### Accounts, Roles & Learner Relationships

- Email registration, sign-in/sign-out, verification, and password reset.
- Four primary signed-in role experiences: **Student, Parent/Guardian, Tutor, Admin**.
- Parent/guardian-linked learner profiles with authorization controls appropriate to the launch market.
- Independent learner accounts when age/eligibility rules permit.
- Server-enforced permissions, record ownership, and safe handling of minors' information.

### Availability, Booking & Session Coordination

- Tutor-managed timezone, recurring availability, and applicable time-off/exception slots.
- Localized time display with UTC-backed booking records and daylight-saving handling.
- Atomic overlap prevention and retry-safe booking requests.
- Confirmed/pending/cancelled/rescheduled statuses **as defined by approved booking policies**.
- Protected Zoom/Google Meet link submission and access for legitimate booking participants.
- Booking details, upcoming lessons, history, and permitted changes.

### Focused Dashboards

- **Student:** Own tutors, confirmed lessons, safe join links, history, account basics.
- **Parent/Guardian:** Authorized learner profiles, booked tutors, session dates/status, changes, applicable payment records.
- **Tutor:** Profile, subjects/levels, availability, assigned lessons, meeting links, booking history.
- **Admin:** Essential tutor/account eligibility, subject catalog, booking lookup, support/safety reports, limited audited interventions.

### Notifications, Support & Trust

- Resend transactional emails for account verification, password resets, and booking confirmations/changes.
- Basic contact/support and reporting channels, including a path to flag unsafe behavior.
- Simple, truthful service policies visible before payment or booking commitments.
- **Reviews/ratings are a potential V1 enhancement, not permission to display invented reviews;** eligibility, moderation, and publication rules remain **[OPEN]**.
- Tutor identity/qualification and safeguarding checks required for launch are **basic trust controls**, **not** advanced tutor-performance management.

### Commercial Features — **[GATED]**

- Payment collection and payment-history views are part of the intended marketplace but **not yet approved for live implementation**.
- A founder-approved decision is required on who takes payment, prices, provider, lesson/package/subscription model, fees/commissions, tutor payouts, refunds, and supported jurisdictions.
- No real charges, claims of a paid booking, customer subscription, or tutor payout until those decisions and compliance checks are complete.

### Platform & Brand Foundation

| Layer | Agreed initial choice |
|---|---|
| Full-stack web framework | **Next.js App Router + React + TypeScript** |
| UI | **Tailwind CSS + shadcn/ui** |
| Database | **Neon PostgreSQL** |
| Schema, queries & migrations | **Drizzle ORM + Drizzle Kit** |
| Authentication | **Better Auth** |
| Authorization | Server-side RBAC and per-record ownership checks |
| App hosting | **Railway** |
| Transactional email | **Resend**, initially using its available free tier |
| Video lessons | **Zoom / Google Meet**, operated externally |
| File/object storage | **None required for initial V1**; consider later only if a real approved need arises |
| Domain | Railway-generated HTTPS URL for development; owned custom domain when ready, and a verified sending domain for production email |
| Payment gateway | **[OPEN]** — do not assume Stripe, PayMongo, or another provider is approved |

- **Architecture:** One modular Next.js application; no separate Laravel service or microservices.
- **Brand:** Lowercase `learli` wordmark, clean and friendly design, navy/teal visual direction.
- **Experience:** Mobile-first responsive web, accessible controls, SEO-friendly public pages, protected private dashboards.
- **Operations:** Separate development and production data/secrets; database migrations, backups, error monitoring, and usage/cost review before public launch.

## Scope

### In Scope

- Responsive Learli website for **Elementary, Middle School, High School, and College Support**.
- Academic core: **Math, Science, English**.
- Support categories: **SAT/ACT and other entrance exams, homework help, study skills**.
- **Specialized subjects**, limited to genuine tutor offerings.
- One-on-one tutoring directory, tutor profiles, simple matching, and availability.
- Guardian/learner relationships, account authentication, and role-specific dashboards.
- Safe booking coordination, rescheduling/cancellation **capabilities** subject to approved policy.
- Tutor-provided external Zoom/Meet links with restricted access.
- Essential transactional emails, support reporting, tutor eligibility, and admin operations.
- Secure future-compatible backend boundaries for eventual mobile clients.
- Payment integration **after** explicit commercial, provider, and policy approval—not before.

### Out of Scope

- Learning Management System (LMS), course delivery, grading, quizzes, or content libraries.
- Assignment/homework uploads, worksheet submission, student file sharing, or an upload/storage service.
- Mandatory tutor lesson plans, progress reports, parent academic analytics, or curriculum mapping.
- Built-in video calling, whiteboards, Zoom/Meet recording, or automated attendance verification.
- Built-in student/tutor messaging, social feeds, or discussion forums.
- AI tutor, AI-generated matching, AI avatars, or automated learning assessments.
- Advanced tutor management, tutor performance scoring, lesson audits, or enforced teaching methods.
- Small-group classroom workflows or mass-market hobbies/music/coding catalogs.
- Native iOS/Android apps at launch.
- Microservices, custom queues/search infrastructure, and speculative third-party integrations.

### Decisions to Resolve Before a Real Paid/Public Launch — **[OPEN]**

1. **Market and legal identity:** Company registration jurisdiction, launch countries, age/consent/privacy requirements.
2. **Tutoring commercial model:** Who receives payment, price setter, one-off vs package vs subscription, fees/commissions, payouts, taxes/currencies.
3. **Payments:** Eligible processor, verified checkout/webhooks, refunds/chargebacks, payment records.
4. **Booking policy:** Session length, trial/assessment offer, lead times, holds, late arrivals/no-shows, cancellation/rescheduling.
5. **Student/tutor safety:** Guardian verification, tutor screening thresholds, reporting and human response responsibilities, meeting-link policy.
6. **Optional product choices:** Reviews/moderation, whether tutor photos are necessary, reminders, and exact profile fields.
7. **Launch operations:** Verified Resend sending domain, privacy/terms/cancellation disclosures, backups/restore test, support ownership, and usage budget.

These are decision gates, **not** implied permissions for an agent to invent default policies or activate payments.

## Success Criteria

1. **Discoverability:** A visitor can view the current subjects and actual approved tutor profiles without creating an account; zero matching tutors produces an honest empty state.
2. **Matching:** Given a subject, level, and time preference, recommendations contain only eligible tutors who genuinely offer the requested tutoring; no fictitious tutor or guaranteed number of matches appears.
3. **Account security:** Students, guardians, tutors, and admins can sign in and reach the appropriate screens; role elevation and unauthorized record access are denied by the server.
4. **Guardian boundaries:** Parent A cannot see or change Parent B's learner or booking, including via direct URL or API requests; an eligible independent learner can book without a guardian account.
5. **Tutor controls:** A tutor can edit only their own subject/profile/availability records; unapproved/suspended tutors are not publicly bookable.
6. **Booking integrity:** Automated concurrency tests show **zero overlapping confirmed bookings** for the same tutor/time, including simultaneous requests and retries.
7. **International scheduling:** Booking times remain consistent in UTC and display correctly for tutor and learner time zones, including tested daylight-saving transitions.
8. **External sessions:** A legitimate confirmed booking shows its correct private Zoom/Meet link only to authorized participants; there is no false claim that Learli itself hosted or verified the session.
9. **Dashboards and support:** Each role can view relevant upcoming/past bookings and approved changes; safety/support reports can be routed to a responsible admin without broad private-data exposure.
10. **Operational quality:** Responsive and keyboard-accessible core paths work; build, type checks, security tests, end-to-end booking tests, migration review, and backup/restore rehearsal pass.
11. **Email readiness:** Development uses permitted Resend testing; public transactional email is not considered ready until a sending domain is verified and delivery is tested.
12. **Paid launch readiness:** Real payments are enabled **only after** founders approve the merchant/pricing/payment/refund model, the provider is validated, applicable safeguards/policies are ready, and payment reconciliation tests pass.
13. **Scope discipline:** No LMS, file-upload portal, custom classroom, AI tutor, or advanced tutor management is required to complete Learli V1.

---

**Document boundaries:** This overview explains **why Learli exists, who uses it, and what the MVP includes**. For implementable requirement IDs and detailed acceptance criteria, use [`PRD.md`](./PRD.md); for server/database/deployment decisions, use [`architecture.md`](./architecture.md); for coding-agent instructions, use [`AGENTS.md`](./AGENTS.md).
