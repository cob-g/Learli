# M3.6 — Guided matching (`/get-matched`)

- Status: **AUTHORIZED — build-feature delegation**
- Date: 2026-10-11
- Authority: The repository owner said "go the next piece now" after being told
  the next piece is guided matching on level and subject only, and asked that
  nothing be committed until M3 is finished. Delegated execution authority, not
  separate human review of this blueprint.
- Baseline: branch `feature/m3-tutor-catalog` at `9dca651` plus the uncommitted,
  verified M3.4–M3.5 public discovery work.
- Package: M3.6, with M3.7 states. PRD: MATCH-01, MATCH-02; QA-01.

## Outcome

A visitor answers two questions on `/get-matched`, level then subject, and sees
the tutors who teach that subject at that level, with a sentence stating the rule
that produced them. With no match, the page says so and offers to change answers,
browse, or contact support.

## Decisions

1. **Rule-based and stated.** A tutor matches when one offering has the chosen
   subject at the chosen level. Results come from the same eligibility module and
   the same filter as the directory, so matching and browsing cannot disagree.
2. **Two questions, not three.** The "when" question is not asked because no
   availability exists until M4, and a question the rules do not use is not
   shown. It is added with M4.
3. **Order** is display name A to Z. No rank, score, percentage or "best match".
4. **A small real set:** up to five tutors, then a link to the same filtered
   directory when more exist. Fewer are shown as fewer.
5. **Answers live in the query string** and the questions are plain GET forms, so
   Back, refresh and no-JavaScript all work. Nothing from a learner profile and
   no personal detail is asked or stored.
6. A specialized subject is offered as an answer only when an eligible tutor
   teaches it at the chosen level. Core subjects are always offered.
7. Never described as AI.

## Scope

Included: `src/features/matching/` step and match rules, the `/get-matched` page,
unit and browser tests, docs. Excluded: time and day preferences, saving answers,
sign-in, booking, any ranking beyond name order.

## Verification plan — not yet executed

- Unit: step resolution for missing, invalid and complete answers; subject
  options per level; match limit and overflow flag.
- Browser: zero inventory shows the empty state with no form; with an approved
  tutor, both questions, Back, results sentence, tutor row, no-match state and
  its actions; axe and overflow at three widths.
- `npm run check`, `npm run test:integration`, `npm run build`, `npm run test:e2e`.

## Risks

- Without availability, a match does not mean the tutor has an open time. The
  page makes no availability claim.

Blueprint ready.
