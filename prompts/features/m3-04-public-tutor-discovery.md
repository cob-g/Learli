# M3.4–M3.5 — Public subjects, tutor directory and tutor profile

- Status: **AUTHORIZED — build-feature delegation**
- Date: 2026-10-11
- Authority: The repository owner said "commit and proceed next piece" after being
  told the next piece is the public tutor directory. Delegated execution
  authority, not separate human review of this blueprint.
- Baseline: branch `feature/m3-tutor-catalog` at `9dca651`, clean tree.
- Packages: M3.4 (subjects, directory, tutor detail, home entry), M3.5 (subject and
  level filters), M3.7 (truthful states), M3.8 (public metadata boundary).
- PRD: PUB-01, PUB-02, PUB-03, PUB-04, TUT-03, MATCH-02; QA-01, QA-02.
- Local-only, synthetic data, per `docs/decisions/2026-10-11-local-m2.md`.

## Outcome

A visitor, without signing in, opens `/tutors` and sees every publicly eligible
tutor as one row each, narrows by subject and level, and opens a tutor's page at
`/tutors/[slug]`. `/subjects` lists what is offered and links into the directory.
The home page shows the finder and up to three tutors when any exist. With no
eligible tutor, every page says so truthfully.

## Decisions

1. **One eligibility query.** Every public read goes through
   `src/features/tutors/eligibility.ts` (approved, active verified account, at
   least one active subject). A pending, rejected or suspended tutor, a suspended
   account and an inactive subject never appear, including by direct URL.
2. **Public address.** `tutor_profiles.slug`, unique, set once at creation from
   the display name plus a random suffix. It never changes and carries no
   account id.
3. **Public fields only:** display name, headline, introduction, teaching
   background, subjects, levels, specialty. Never email, account id, time zone,
   review history or anything about learners.
4. **Teaching background** is shown as the tutor's own words with a line saying
   Learli has not checked it. Nothing is called verified.
5. **Filters** are subject and level, the only ones real data supports. A tutor
   matches when one offering has that subject and that level together. Days,
   language and text search are not built. Default order is display name A to Z.
6. **No availability or booking yet (M4).** Rows omit the time column, as
   `ui-context.md` specifies when no availability exists. The profile says
   booking is not available and has no picker or booking button.
7. **Pagination:** 20 tutors per page with previous and next links.
8. **Without local configuration or with the database down,** public pages still
   render: no configuration shows the zero-inventory state; a failed query shows
   a load-failure message. No sample tutor is ever shown.
9. **Wording that is now false is corrected:** approving and suspending change
   what is public, and an approved tutor's notice links to their public page.
10. **Scoped simplifications:** below `lg` the filters sit above the results
    instead of in a sheet; the home page links to `/subjects` instead of
    repeating the subject index. Pages stay `noindex` site-wide as today.

## Scope

Included: slug migration with backfill; eligibility query with filters, paging
and by-slug lookup; `TutorCard` list, filter form, `/tutors`, `/tutors/[slug]`,
`/subjects`, home page; corrected admin and tutor wording; browser-test ordering
so zero-inventory checks run first; tests and docs.

Excluded: matching (`/get-matched`), availability, booking, reviews, prices,
photos, text search, sitemap or indexing changes, how-it-works copy.

## Verification plan — not yet executed

- Migration applies to existing rows and reruns cleanly.
- Integration: filters by subject, level and both; pagination; by-slug lookup
  returns only eligible tutors; public result has exactly the allowed keys.
- Browser: zero inventory on `/`, `/tutors`; after approval the tutor appears on
  `/tutors`, home, `/subjects` and their profile, signed out; filters and their
  empty states; suspension removes the tutor and the profile returns 404; public
  HTML contains no email; axe and overflow at 1440, 390, 320.
- `npm run check`, `npm run test:integration`, `npm run build`, `npm run test:e2e`.

## Risks

- By owner decision an approved tutor's edits are public without review.
- Filtering happens in memory after the eligibility query. Fine for a small
  catalog; move it into SQL before inventory grows.
- Tutor screening policy remains `[OPEN]`; nothing here is a real listing.

Blueprint ready.
