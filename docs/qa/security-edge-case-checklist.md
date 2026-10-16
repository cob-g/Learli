# Security and edge-case acceptance checklist

Use only synthetic accounts in the isolated local test environment. The current
bounded run follows `prompts/features/m8-09-security-edge-case-acceptance.md`.
Actual results, commands and limitations belong in
[the results record](security-edge-case-results-2026-10-16.md).

This checklist preserves the owner’s seven areas and clarifies the existing
contracts. PASS applies only to the observed test boundary. PARTIAL means a
narrower local assertion passed while a requested operational condition remains
unverified. A guardian-managed child uses the Parent account; an eligible
independent College Student uses their own account.

## 1. Authentication and sessions

- Wrong credentials: safe rejection and no authenticated session.
- Duplicate signup: one persisted account, unchanged credentials/roles and a
  generic response that does not disclose account existence.
- Password recovery: actual provider reset, one-use token, old-password denial,
  other-session revocation and new-password recovery. Local capture is not email
  delivery evidence.
- Logged-out and expired sessions: protected document/API denial, real sign-in
  recovery and refresh. Session-expiry fixture adjustment must be exact-target.
- Disabled accounts: server-side restricted reads and mutations denied; restore
  does not erase booking history or grant new roles.
- Refresh: account identity and authorized records persist. Do not promise that
  temporary failures or legitimate rate limiting can never occur.

## 2. Role and data access

- Parent cannot access a foreign linked learner or booking.
- Student cannot access another Student’s booking.
- Tutor cannot access another Tutor’s private sessions or edit their profile.
- Student/Tutor/Parent without trusted Admin authority cannot use Admin surfaces.
- URL/ID changes do not bypass server ownership.
- Meeting details remain participant-scoped; exact assigned Admin receives only
  permitted support information without meeting credentials.

## 3. Booking integrity

- Distinct learners racing for one Tutor interval have one winner.
- Repeated click, committed-but-lost response/hard reload and same-key replay
  retain one logical booking; fresh conflicting key is rejected.
- Past, unavailable and reserved intervals cannot be newly reserved.
- Cancellation and rescheduling preserve consistent role views/history, release
  the old interval and protect the new interval without duplicate active heads.
- Confirmed UTC instants and history survive valid recurring-availability and
  recurrence-timezone edits; future candidate generation still excludes bookings.

## 4. Validation and failure feedback

- Representative required, email, length, date and time-range boundaries reject
  invalid input without a mutation. This is not a claim about every form.
- Relevant mutation retries use existing idempotency semantics; generic profile
  saves are not promised to share the booking receipt contract.
- Failed precommit requests expose safe errors rather than success.
- Ambiguous committed results direct callers to authoritative records and safe
  replay, preserving submitted data where supported.
- Recovery restores safe retry; never bypass ownership or rate limits.

## 5. Timezones and international scheduling

- Explicit Tutor Account `Asia/Manila` and Student Account `America/New_York`
  display the same stored UTC interval in their respective local zones.
- Before/after rescheduling, check actual-date local date/time/offset/zone,
  including date rollover. Account display zone differs from recurrence zone.
- Existing fixed-date unit/PostgreSQL checks cover DST gaps/overlaps and actual
  offsets. A short future browser journey is not both-season browser evidence.
- Full live emailed confirmation rendering and international physical devices
  remain separate checks.

## 6. Reliability and recovery

- An independently owned closed application pool produces safe private 503 for
  protected booking read/create; no new booking/event/notice intent is saved.
- A fresh runtime against the same owned database can retry the same cookie/key
  once, replay the receipt and read unchanged history; foreign access is denied.
- Existing owned TLS connection-loss tests cover same-pool healthy recovery.
- Actual Neon idle-to-wake behavior needs a separately authorized hosted run.
- Controlled mail failure/timeout does not roll back a committed booking;
  retries are bounded/idempotent according to the current delivery contract.
- Checked responses/errors omit credentials, cookies, internal SQL and private
  meeting information. This is not a repository-wide penetration certification.

## 7. Payments

NOT APPLICABLE: payment processing remains disabled and its business/provider
choices are open. Do not add a gateway, checkout or callback test to satisfy this
checklist. Sandbox verification follows separate payment approval.
