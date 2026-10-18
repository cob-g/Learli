# Desktop navbar reference — M1.5

- Status: **AUTHORIZED — build-feature delegation**
- Authority: the owner's explicit 2026-10-17 request to implement the desktop
  navbar from `/Users/cob/Downloads/learli Sign In v2 (standalone).html`, navbar
  only, while preserving current functionality. This is delegated execution
  authority, not separate human approval of this written blueprint.
- Repository: `/Users/cob/learli`
- Observed baseline: clean local `main`, commit
  `616e8c734acebec0f7b51c5f96fb182dc4001d93`.
- Working branch: coordinator choice; a dedicated feature branch is proposed,
  not created by Architect. No commit, merge, push or deployment is implied.

## Implementation Plan — Learli desktop navbar

### What we are building

Visitors on the existing public/auth shell see the supplied reference's compact
desktop header: original Learli artwork at the left, the four current discovery
links in a centered white capsule, and the existing account entry at the right.
Only desktop navbar presentation changes. Current destinations, current-page
semantics, auth states, account disclosure and the mobile bottom dock remain.

### Requirement and milestone mapping

- Primary build-plan owner: **M1.5 — Create shared page shells**, specifically
  the public header and meaningful navigation. This is a continuation, not a new
  fabricated work package or completion of all M1.5 criteria.
- PRD: **PUB-01**, navigation support for **PUB-02/PUB-03**, **NFR-01/NFR-02**.
  Preserve **AUTH-02/AUTH-03**; no auth requirement is reimplemented.
- Inspected source: `src/components/shared/site-header.tsx`,
  `header-account.tsx`, `brand-logo.tsx`, `site-shell.css`, and shared
  `.nav-link`/`.brand-home` rules in `src/app/globals.css`.
- Existing component coverage: `tests/components/site-header-glass.test.tsx`
  and `tests/components/header-account.test.tsx`. Existing actual browser
  coverage: `tests/e2e/header-navigation.spec.ts` includes desktop/mobile,
  anonymous/signed-in, pending/error/retry, session revalidation and enlarged
  long-name cases. Read and reuse these rather than inventing redundant tests.
- The supplied file's JSON `script[type="__bundler/template"]` contains the
  actual HTML/CSS. Its desktop header has a 72px inner row, max-width1440px,
  32px side gutters, centered `1fr auto 1fr` layout with 24px gaps; a 46px white
  navigation capsule (1px border, 4px inset, 2px gap), 36px links with 16px
  inline padding and 14px medium text, and a 40px account entry with 18px inline
  padding. Current Sign in has a white outlined capsule and a 6px teal dot.
  The reference uses a pale86% translucent header, blur12px/saturation1.4 and
  a subtle navy8% bottom edge. It does not use the current liquid rim/glint.
- Reference visual rendering and baseline screenshots are coordinator work,
  not Architect verification. Coordinator reported an observed reference
  capsule of approximately480px by46px at1440px viewport width.

### Language we agreed on

- Desktop navbar means the existing wide public/auth header, at the current
  64rem breakpoint. No terminology clarification is needed.
- Reference means its navbar geometry/material and anonymous account styling;
  its placeholder `href="#"`, text-drawn logo, mobile hamburger, form and
  content are not product behavior to import.

### Decisions made

- Apply the reference narrowly to desktop header presentation, using the
  existing semantic brand tokens and Lexend font. Do not replace global palette,
  fonts, radius rules, assets or unrelated components with template values.
- Preserve the original `BrandLogo` artwork. Size it locally for the compact
  reference composition (coordinator visual target approximately78px wide);
  never reproduce the template's hand-built text logo.
- Prefer desktop-only CSS in `site-shell.css`. Existing markup already has
  all required links and account states, including a direct anonymous
  `.site-header-account > .nav-link`; no auth refactor is necessary.
- The owner-supplied reference authorizes a narrow exception to the older
  desktop transparent-at-top/liquid-header and ordinary-control-radius rules:
  desktop header is a restrained translucent sheet from the top, with pill
  navigation and account entry. Mobile retains its existing glass top bar/dock.
- Preserve the existing no-script and short-viewport safety rules unless a
  small desktop-only adjustment is necessary for this reference. Do not add
  JavaScript to achieve the reference's visual geometry.

### Coordinator implementation clarification — 2026-10-17

Preserve 44px usable link targets while matching the supplied compact visual:
the 46px navigation shell contains a 44px link with a 36px inset hover surface.
The account entry uses a 44px minimum rather than the reference's40px height.
This is a disclosed accessibility adaptation within the owner's navbar request,
not a change of routes, content, brand, or separate human blueprint approval.

### Assumptions

Owner continuation on 2026-10-17: the desktop Sign in entry must have a
persistent background, not only on hover/current page. Keep its White capsule
and outlined edge at rest on every route, with a light Mint hover and no
underline. Retain the current-page decorative dot and all account behavior.
This is authorized by the owner's direct continuation within the same scope.

- The existing 64rem desktop/mobile boundary stays; the reference's1040px
  hamburger breakpoint is not adopted.
- Normal desktop composition targets72px inner height; this is a minimum,
  allowing enlarged text, long names and failures to grow/wrap accessibly.
- Existing canonical route arrays and `aria-current` calculation stay intact.

### Scope

- Included: desktop header surface/bottom edge, inner row spacing/width,
  original wordmark sizing, centered capsule, link typography/spacing/hover/
  current/focus states, compact anonymous/checking/signed-in account alignment.
- Excluded: mobile top-bar/dock redesign, footer/home/auth-page content,
  private workspace shell, route changes, new screens, dependencies,
  authentication changes, business rules, schema, integrations or deployment.

### System invariants

- Header presentation grants no identity, role, learner or booking authority.
- Session pending/error remains neutral Account with existing checking/retry;
  successful absent-session response alone shows Sign in.
- Preserve same-session refetch stability, account name/initials, disclosure,
  outside-click/blur/Escape behavior, Sign out feedback and document replacement.
- Keep server permission checks, private document boundaries and current
  disabled policy/real-use factories unchanged.
- Keep all four discovery links and the original Learli home link accessible.
  No invented availability, prices, reviews, trust claims or account status.

### Affected areas

- Primary: `src/components/shared/site-shell.css` desktop header overrides.
- Only if proven necessary: `site-header.tsx` or `header-account.tsx` for a
  presentation-only hook/comment; preserve all handlers, semantics and state.
- Context: `context/ui-context.md`, concise dated navbar decision in
  `docs/decisions/` (proposed path
  `docs/decisions/2026-10-17-desktop-navbar-reference.md`), and factual
  `context/progress-tracker.md` evidence owned by the coordinator.

### Data and authorization changes

None. No schema/migration, API, session, role, policy, secret or infrastructure
change. Do not operate Neon, Resend or Railway for this UI slice.

### Workflow and failure states

Existing navigation and account transitions remain unchanged. Current Sign in
uses the reference dot alongside its label and retains `aria-current="page"`;
the owner’s later explicit instruction removes desktop navbar underlines while
retaining light green hover/current-page fills and `aria-current`.
Checking/error/retry and signed-in disclosure must stay readable within the
desktop account area without shifting the central nav during revalidation.
Long names and enlarged text wrap rather than truncate or overflow. Reduced
transparency, missing backdrop support and forced colors retain solid readable
surfaces and visible focus. No new requests, retries, timers or loading state.

### How to build it

1. Record the narrow owner-authorized desktop exception in UI context and a
   concise decision record before implementing against it. Preserve all other
   UI rules. Do not update the PRD, architecture or build plan for this visual
   continuation, since no product/technical boundary or sequencing changes.
2. In desktop CSS, adapt the existing header surface to the pale reference
   with subtle bottom border and no liquid rim/glint. Keep the rest of `.glass`
   and all mobile rules intact. Ensure later no-backdrop/preference/forced-color
   selectors cannot accidentally restore desktop liquid material.
3. Set the desktop row's centered bounded composition, compact original logo,
   white rounded nav and link states. Override inherited `.nav-link` min48px,
   underline/current typography only where needed within this navbar. Match
   the supplied geometry at ordinary desktop sizes and permit accessible wrap.
4. Compact the existing account presentation using desktop selectors. Override
   the older70px account minimum and the `@container header-account
(max-width:12rem)`110px minimum on desktop where necessary. Preserve actual
   full-name wrapping, neutral fallbacks and disclosure controls; min-height40px
   is not a fixed content cap. Keep the account footprint stable across its
   ordinary pending, signed-in and anonymous states.
5. Perform independent Review, then the separate verification below. Repair
   only confirmed in-scope defects, retaining failed evidence. Coordinator
   records actual results in the tracker and saves the final handoff.

### Verification plan for the separate verification skill (DO NOT EXECUTE)

- Automated: existing `npm run check` (format/lint/typecheck/unit-component),
  normal configured `npm run build`, and the relevant existing header browser
  selection through the repository's isolated test-env workflow. Use no
  production credentials or service changes.
- Relevant coverage must continue to prove exact destinations/current markers,
  account loading/error/retry and refetch semantics, disclosure keyboard/Escape,
  outside dismissal and Sign out behavior. Do not weaken those expectations to
  accommodate a visual change. Update a historical visual assertion only if
  the implementation deliberately changes that presentation contract.
- Manual/visual: compare reference and final header at1440px, check1024px and
  intermediate width, narrow320/390/768px unchanged mobile/dock,200% text with
  full long name, keyboard focus/Tab/Escape, scrolled and top-of-page header,
  reduced transparency/contrast/forced-colors, and no page overflow. Check both
  public and auth routes; private workspaces must retain their own shell.
- Inspect the actual reference-style Sign in current state and a discovery
  current destination; confirm decorative dot never implies session status.
- No database correctness suite, new business tests or provider acceptance is
  required solely because CSS changed. Header browser fixtures may use only
  the existing isolated synthetic test database.
- Operational: none; no migration, hosted activation or deployment.
- Evidence: exact commands/outcomes, screenshot or ignored artifact paths,
  browser engines/viewports actually exercised, remaining limitations.
- Verification status: **NOT RUN — architecture planning only**.

### Acceptance criteria

1. At ordinary desktop widths, the navbar visibly matches the reference's
   compact72px row, bounded32px-gutter layout, centered white46px capsule,
   four14px-medium links with36px inset surfaces/44px targets, pale header and
   current Sign in capsule/dot (44px minimum accessibility adaptation above).
2. The original logo and exact current routes/labels/`aria-current` remain.
3. Anonymous/checking/error/retry/signed-in behavior and keyboard disclosure
   remain functional, readable and stable through same-session revalidation.
4. Mobile top bar/dock and private workspaces retain their current behavior;
   text enlargement/full names do not clip or cause page overflow.
5. Review and relevant quality/build/browser checks pass with observed
   evidence. Documentation distinguishes this navbar completion from all M1.5
   or production readiness.

### Context updates

The downstream implementer narrowly amends `context/ui-context.md`'s public
header material/radius/desktop-control treatment and adds the dated decision;
the coordinator updates `context/progress-tracker.md` with actual evidence.
Architect changes only this blueprint.

### Risks and open decisions

No unresolved material decision. Main implementation risks are CSS cascade,
the old account container sizing, centered-nav room at1024px/enlarged text,
and accidentally propagating desktop overrides to the mobile dock or home glass.
Use local selectors, flexible minimum heights and the existing header checks.
Rollback is reverting the scoped CSS/presentation/doc change, without data work.

### Approval gate

- **AUTHORIZED — build-feature delegation**, within the owner's2026-10-17
  desktop-navbar-only request and established project boundaries.
- No routine blueprint confirmation is required in orchestrated mode. A new
  material scope/business/security decision or production/destructive action
  still requires its applicable authorization; none is needed for this slice.
- Handoff dependencies: coordinator's reference/baseline visuals, separate
  implementation, independent Review, separate executed verification, Remember.

## Owner steering — 2026-10-17

During implementation the owner requested “also remove the underline on the navbar
Im good with the light green hover”, with a screenshot of the active Find a tutor
link. Remove desktop capsule underlines; keep the light green hover/current-page
fill and current-page semantics. This explicit choice supersedes the earlier
underline-based visual current marker only; no destination or behavior changes.
