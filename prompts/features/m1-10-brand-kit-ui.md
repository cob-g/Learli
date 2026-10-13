# M1.10 — Learli brand kit 2.0 UI adoption

Status: AUTHORIZED — build-feature delegation
Date: 2026-10-13
Type: UI / UX; existing functional behavior retained
Baseline: f5f316acbcb82c417110dac3e55e0bee35f997de

## Authority and outcome

The user requested implementing `learli-brand-kit.zip` throughout Learli UX/UI,
using build-feature, Impeccable and delegated agents. This authorizes adoption of
the supplied visual system, local implementation, verification and documentation.
It is not separate human blueprint approval or authority to commit, merge, push,
deploy, activate policies, or change production. Existing main changes were
next-env.d.ts and the untracked brand archive; preserve both and private env files.

Improve discovery, sign-in, booking and role workspaces with one coherent identity.
M1.3–M1.5/M1.9, M2.9, M3 discovery, M4.11, M5 dashboards, M8.9 accessibility support
PUB-01–04, AUTH-01–05, TUT-02/04/06, FAM-02/03, MATCH-01–03, BKG-01/04 and NFR UX.
This is a presentation pass across already implemented capabilities, not a claim
that gated milestones or real-user launch are complete.

## Binding direction

The supplied kit is the visual authority: original primary/reverse SVG wordmarks
and icon; Lexend 400/500/600 interface; Literata 400/500 reading; navy #1E2A78,
teal #2ECCB0, mint #A7DCCB, deep teal #0A7566, ink #131A3D, slate #55605D,
stone #C9D3CE, mist #E6ECE8, paper #F5F8F6, white and alert #B42318.
Use the existing semantic token API so every page inherits the coherent update.
Navy actions on light, deep-teal links/focus, 48px controls (minimum 44), 10px control
and 16px panels; selected pills only when a real choice exists. Teal never light
background text. Preserve accessible error/warning semantics. Text/controls must
meet contrast requirements, even where a literal decorative token cannot.

Adopt the kit's established world directly, code-first from supplied interface
boards, not a new speculative identity or generated photo concept. Existing
canonical product context and the user's explicit adoption request answer the
product/direction questions; do not reopen them as a routine approval step.
PRODUCT.md is a concise derived reference pointing to canonical context, not a
competing product authority. Finish with rendered evidence, independent review,
DESIGN.md and Impeccable token metadata. Photography remains absent: kit [PHOTO]
frames are briefs. Exclude practice sets, progress analytics, messages, invented
claims and matching-by-learning-style promises from example boards.

## Ownership and execution

Coordinator owns global CSS/fonts, original assets, header/footer, shared UI,
Impeccable availability/context, canonical documentation, combined verification.
Three GPT-6.1 SOL High workers use isolated branches/worktrees:

- Public: marketing routes, tutor discovery/profile/filter and matching UI.
- Accounts: auth/onboarding/account/security/support/safeguarding presentation.
- Workspaces: family/tutor/admin/booking/schedule presentation, excluding shared
  navigation files unless explicitly delegated.
  Freeze individual path boundaries before edits. Workers use build-feature stages,
  read Impeccable craft floor before UI edits, perform scoped unit/lint review, and
  return precise changed files. Coordinator integrates frozen files with hashes;
  no commits required. No worker changes dependencies, global tokens, source APIs,
  DB schema, auth/permission/service logic, tests' guards or private environment.
  Coordinator serializes builds, database/browser tests and captures.

## Acceptance and verification

1. Supplied SVG artwork is served from public/brand, correct home accessible name,
   reversed artwork on navy, usable icon metadata, no typed placeholder logo.
2. Fonts/tokens loaded via existing next/font integration, same-origin fonts, no
   unneeded package changes. Shared styles cover all current UI routes.
3. Public and private composition is usable at 320/390/768/1024/1440, keyboard and
   200% text enlargement; focus, contrast, no horizontal page overflow.
4. Keep actual data, headings, form labels/errors, return URLs, session boundaries,
   ownership/role checks, UTC/zone formatting, private links, policy/dev notices,
   native GET filtering, accessible pending/empty/error states and working actions.
5. Inspect incumbent implementation before edits; capture final desktop/mobile
   representative public/auth/directory/family/tutor/admin/booking surfaces in one
   bounded pass, batch fixes and confirm. Axe and Chromium/Firefox/WebKit smoke
   on affected journeys; real PostgreSQL ownership/concurrency regressions where
   touched, using owned loopback tests only. No Neon writes for styling QA.
6. npm run check, production build, scoped component/unit and existing browser
   regressions. Use dedicated test config; no destructive global setup against
   main development data. Keep safe evidence in ignored .local/brand-ui.
7. Independent code and Impeccable finish review; record failures and repair with
   Recover before rerunning affected checks. Then update tracker and local memory.

## Risks and boundaries

Wider Lexend and 48px controls can wrap labels and increase mobile height; verify
forms, header and dense admin navigation. Read-only review must check JSX edits
preserve event handlers, hidden proofs and private document boundaries. No runtime
policy or database changes planned. Prior production/payment/email/Neon acceptance
limits remain separate. Stop owned verification servers at closeout; the earlier
long-running development server was stopped by the user.
