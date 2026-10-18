# Parent Profile and My Children

Targets: `/parent/profile`, `/parent/children`, `/parent/children/new` and
`/parent/children/[learnerId]`; existing AccountForm, learner forms and GradeField.
Mode: Operate. A code-led extension of the incumbent Learli workspace world.

## Direction contract

THESIS: Give parents a direct Profile → My Children → Add Child journey, with
the saved school year visible alongside the separately chosen education level.

OWN-WORLD: Reuse the original Learli wordmark, Lexend interface, Paper/White
surfaces, Navy headings/actions/current navigation and Deep teal links/focus.
Shared field, action, radius, border and type tokens remain authoritative in
`DESIGN.md`; this surface adds no fonts, artwork, system tokens or visual world.

FORM: Retain the desktop workspace sidebar and narrow Menu/account header.
Parent Profile places the existing account form in one flat bordered White
panel. Child profiles use separated rows with their edit action beside them on
wide screens and below on narrow screens. Add/edit use a single working column
of visible labels and native fields; Grade is an optional native select with
Not specified and Grade 1–12. Grade and education level remain separate controls;
College Support has no school-grade control. Content and actions wrap in normal
flow at phone widths.

STATE: Keep “Saved for local testing”, “Saved — pending review” and
“Authorized — current reviewed access” distinct. Private-staging creation says
“Child request saved” and explains that booking access awaits authorization.
Reviewed education level remains visibly locked. Preserve existing safe errors,
field associations, focused feedback, hydration guards and pending/retry wording.
Registered email is displayed separately from the editable name/time zone;
Account settings and security retains its own destination.

Authority: [approved blueprint](../../prompts/features/m4-04-parent-profile-children.md)
and [owner decision](../../docs/decisions/2026-10-17-parent-profile-children.md),
recorded as **AUTHORIZED — build-feature delegation**.

Evidence: The four route implementations and shared forms match the supplied
Parent Profile, Add Child, My Children and edit-child captures at 1440, 390 and
320px in `.impeccable/review/parent-step2-20261017/`. The supplied detector result
is `[]`. This note records static source/capture comparison; it adds no runtime
verification or launch-readiness claim.
