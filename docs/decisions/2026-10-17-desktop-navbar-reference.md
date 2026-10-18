# Desktop navbar reference — 2026-10-17

The owner requested implementing the navbar from
`/Users/cob/Downloads/learli Sign In v2 (standalone).html` on desktop, preserving
current functionality and limiting the change to the navbar.

This authorizes a narrow presentation exception: at the existing 64rem breakpoint,
the public/auth header uses the reference's pale blurred sheet and bottom hairline,
a compact 72px minimum row, original small wordmark, centered white navigation
capsule and rounded account entry. Preserve the existing brand palette and artwork.
The 46px navigation capsule includes 44px link hit targets; content can grow with
text enlargement and full account names. This adapts the reference's smaller
interior links without shrinking the usable target.

The four real discovery destinations, page/section indicators, anonymous and
signed-in states, account checking/retry, native account entry, disclosure and
logout behavior remain unchanged. Keep the current sticky/no-script/short-height
safety rules. Mobile keeps its existing top bar and bottom dock; private workspace
navigation, page content, forms, footer and all other glass remain outside scope.
No authentication, authorization, data, policy, dependency or deployment change.

Authority is the owner's direct implementation request, recorded in
`prompts/features/m1-05-desktop-navbar-reference.md` as **AUTHORIZED — build-feature
delegation**; the owner did not separately inspect that generated blueprint.

The owner then explicitly requested removing navbar underlines, keeping the light
green hover treatment. Desktop links keep the mint hover/current-page capsule
fill and their existing `aria-current` values; no underline is drawn. Mobile
styling remains unchanged.

The owner's next continuation makes the desktop Sign in entry a persistent
White outlined capsule on every route, rather than revealing its background
only on hover/current page. Its hover is light Mint, without an underline;
the existing current-page teal dot and all account behavior are retained.
