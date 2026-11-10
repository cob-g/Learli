# Student–Tutor booking screening coverage

- Date: 2026-11-10, Asia/Manila.
- The owner selected “Huwag ialok ang time slot hangga’t hindi renewed ang screening” when required Tutor screening would expire before the lesson ends, then approved `prompts/features/m5-03-student-tutor-coordination.md` for implementation.
- New and rescheduled lesson times must end strictly before the expiry of each required current screening check and any finite governing screening policy. Show only qualifying slots in public and signed-in availability, and enforce the same condition in the authoritative booking transaction. Screening revocation after booking remains possible.
- Preserve existing bookings and current participant access checks. A currently MFA-assured Admin with an exact booking assignment can see a confirmed booking requiring screening support; this read does not grant a meeting link or bypass mutation eligibility. Completion requires current eligibility when the Tutor acts; coverage through the lesson does not guarantee later completion access.
- The owner separately selected 2026-11-12 18:00 Asia/Manila for the local synthetic test Tutor's re-review. This is an explicitly temporary test value, not real identity verification or a general screening duration.
- Real screening criteria, evidence providers and public launch remain open. No production deployment or external provider action is authorized. Executed work and checks belong in `context/progress-tracker.md`.
