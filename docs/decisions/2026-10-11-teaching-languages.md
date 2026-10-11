# Optional tutor-declared teaching languages

Date: 2026-10-11. Authority: **coordinator-delegated in-scope product decision**
under the user's five supervised local feature builds; **AUTHORIZED — build-feature
delegation**. The coordinator authorized the proposal through Orca orchestration
ask/reply. No separate founder blueprint approval, launch approval or proficiency
verification is claimed.

Use a bounded selectable vocabulary: ar Arabic, ceb Cebuano, zh Chinese, en
English, fil Filipino, fr French, de German, hi Hindi, ja Japanese, ko Korean, pt
Portuguese, es Spanish. Chinese is a broad declaration label, not a dialect claim.
These options do not advertise actual tutor coverage. The directory offers only
languages declared by eligible tutors; an active valid filter with no inventory
remains selectable with a truthful unavailable label so visitors can change it.

Optional declarations leave existing profiles eligible. The own-profile PUT may
omit `teachingLanguages` to preserve existing declarations; [] explicitly clears
them. A unique bounded array of exact codes is validated server-side. Profile
updates retain the existing ownership checks, lock and transaction. Stored codes
live in a normalized relation with tutor FK, enum constraint and composite key;
no inferred backfill. Public labels identify declarations and state that Learli
has not checked proficiency. Subject, level and language filters compose.

Rationale: consistent codes prevent spelling/alias duplicates and unsafe free text,
while one optional relation avoids breaking existing eligibility. Alternatives:
free-text labels would make filtering inconsistent; a full translation platform
or editable language administration is unnecessary for this narrow slice.
Extend the module and enum through a forward migration when more options are
authorized; never rewrite applied history. There is no new dependency, cost,
upload, translation, safeguarding policy or external integration.

Verification: owner/negative/constraint/atomic tests on isolated PostgreSQL,
combined filters and URL tests, responsive keyboard/axe browser journeys. Local
synthetic development only; real-user and production gates remain unchanged.
