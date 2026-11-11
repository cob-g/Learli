# State machines in Learli

A map of every lifecycle in the app and where each one is decided, so a change
starts in the right place. Audited 2026-11-11. File references are the ones to
read first; line numbers drift, so search for the names.

## 1. Domain state (the database decides)

Every domain lifecycle is enforced in PostgreSQL: a `state`/`status` CHECK, an
`*_events` table whose shape CHECK lists the allowed `from → to` pairs, and a
SECURITY DEFINER function or trigger that performs the transition with locks
and `clock_timestamp()` guards. TypeScript only mirrors the value lists for
types and labels. **Never move transition authority into TypeScript**, and
never weaken a CHECK to make the UI simpler.

| Machine                     | States                                                                                     | Enforced in                                                                               | TS mirror                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Bookings, local simulation  | demo_reserved, demo_confirmed, demo_completed, demo_expired, demo_cancelled, demo_replaced | `bookings_demo_state` CHECK; trigger `preserve_demo_booking` (latest: migration 0035)     | `DemoBookingState`, `demoStateLabels` (`features/bookings/lifecycle-model.ts`) |
| Bookings, workflow/policy   | provisional, confirmed, completed, no_show, expired, cancelled, replaced                   | same CHECK; `create/change_policy_booking`, `expire_policy_bookings` (0025, 0039)         | `workflowStates` (`features/booking-workflows/model.ts`)                       |
| Support cases               | open, in_review, closed                                                                    | `support_case_events_shape`; `change_safeguarding_response` (0024)                        | `statusLabels`, `transitions` (`features/support/input.ts`)                    |
| Safeguarding response cycle | unassigned → assigned → acknowledged → escalation requested, per `response_cycle`          | `response_state_shape` CHECK + deferred `validate_response_state` (0024)                  | presentation only                                                              |
| Tutor screening case        | pending, approved, rejected, suspended, revoked                                            | `decide_tutor_screening` (0024); validity is time-derived from check expiry               | `tutor-screening/*`                                                            |
| Tutor profile review        | pending, approved, rejected, suspended (a revoked case shows as suspended)                 | same function                                                                             | `schema/app.ts`                                                                |
| Learner admission           | pending, authorized, rejected, revoked                                                     | `decide_learner_admission` (0023); effective authority is `has_current_learner_authority` | `learner-admission/*`                                                          |
| Transactional delivery      | pending, claimed, retryable, uncertain, provider_accepted, suppressed, blocked             | state CHECKs + claim trigger (60 s claim)                                                 | `deliveryStates`, `DELIVERY_CLAIM_MS`, `DELIVERY_MAX_ATTEMPTS`                 |
| Google Meet job             | pending, claimed, dispatched, uncertain, ready, suppressed, blocked                        | migration 0040 functions; UI sees only `google_meet_job_status`                           | `schema/google-meet.ts`                                                        |
| Publication review          | pending, approved, rejected, published, withdrawn                                          | `decide_publication_review` + `publication_events_shape`                                  | `publicationStates`, `nextPublicationStates`                                   |
| Private review              | pending, locally_approved, locally_rejected                                                | `moderate_private_review` + events CHECK                                                  | `states`, `nextStates`                                                         |

Some states are implicit by design: a booking's **current head** is "no later
revision of the same logical booking", **expiry** is `expires_at <= now` until a
read or job materialises it (`effectiveDemoState`), and a **meeting link** is
present or absent rather than a state.

`tests/integration/state-machine-drift.test.ts` reads the live constraints and
function sources and fails if a TS mirror (state sets, transition pairs,
delivery claim interval and attempt cap) drifts from the database. Add a case
there when you add a stateful table.

## 2. Presenting a booking's status

Use `bookingPhase(state)` from `features/bookings/lifecycle-model.ts`:
`held` (reserved with a deadline that can still expire), `confirmed`, or
`ended`. Its table must place every `BookingState`, so a new state fails to
compile until it is placed. Do not write new negations such as
`!demoLiveState(s) && s !== "provisional" && s !== "confirmed"`; a new state
would silently land in whichever branch the negation leaves it in.
`tests/unit/booking-phase.test.ts` pins its equivalence with the checks it
replaced.

## 3. Client form lifecycles

Forms keep their lifecycle in local state. They fall into five patterns. They
are deliberately **not** one shared hook yet: idempotency-key lifetime, what
counts as an uncertain outcome, and how a user recovers differ per endpoint and
are pinned by tests.

| Pattern                  | Lifecycle                                                                                                      | Members (examples)                                                                                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1 Keyed mutation        | idle → pending → succeeded / rejected / uncertain; a client request key is reused while the outcome is unknown | booking-workflows `useMutation`, demo booking, cancel/reschedule, support case/assignment, account restriction, safeguarding report and response, review publication, private reviews, local review claim |
| P2 Durable create        | as P1, with the key kept in sessionStorage by a fingerprint of the fields so a reload retries safely           | create learner, parent child, independent learner, learner admission                                                                                                                                      |
| P3 Plain save            | idle → pending → saved / failed (`{ text, failed }`), optional dirty tracking and a revision for concurrency   | availability, time off, tutor profile, learner edit, account, subject name, support status                                                                                                                |
| P4 Multi-step / security | explicit step plus P2/P3 per step; secrets cleared on `pagehide`                                               | sign-in/up, email change, password, admin security                                                                                                                                                        |
| P5 Load + action         | load (latest-wins, abortable) plus a confirm-dialog action                                                     | account sessions                                                                                                                                                                                          |

When you add or change a form:

- Start from the closest existing member of its pattern and keep its key policy.
- Treat 408, 499, 5xx, network failure and an unreadable body as **uncertain**:
  keep the same request key and say the outcome is unknown. Never show raw
  `Error.message` text (for example "Failed to fetch") to a user.
- A latched uncertain state must name its recovery (retry the same request, or
  reload the current status).
- Announce failures with `role="alert"` and success with `role="status"`.
- Only mark a form clean if nothing was edited since the save started.

## 4. Session, shell and live updates (leave as they are)

These encode state through keys and derived flags on purpose. Read their
comments before touching them.

- `HeaderAccount` and `WorkspaceShell`/`AccountChrome`: the request key
  `[path, revision, attempt]` gives stale-response protection for free; a
  reducer would need its own request token.
- `NavigationProgress`: `useOptimistic` cannot leave a stuck indicator.
- `useBookingLiveUpdates`: event stream with 2–30 s backoff and 60 s polling;
  resources live in the effect closure.
- `BookingReadStatus`: the client "elapsed" flag is remembered per deadline,
  so a later deadline starts unexpired.

## 5. Known follow-ups (not yet changed)

Found in the 2026-11-11 audit; each is small and should land with a test.

- Email change says "Your email may already have changed" for a 5xx at the
  start/request step, where nothing can have changed.
- Support `CaseForm`, `PublicationForm` and `ClaimLocalReview` read error
  bodies with `response.json()`, so a non-JSON 5xx shows a connection or
  uncertain message instead of a plain failure.
- `ResponseForm`, `PublicationForm` and `ClaimLocalReview` announce success with
  `role="alert"`.
- Learner admission review forms mint a new key per submit, so a 5xx retry is
  not deduplicated.
- `useBookingLiveUpdates` keeps showing "connected" after the tab is hidden or
  goes offline, until the next event.
- A safeguarding report reloaded mid-retry shows blank, enabled fields that will
  be sent with the saved key.
