# Public/auth desktop navbar

Targets: src/components/shared/site-header.tsx, src/components/shared/site-shell.css
Mode: Operate. A scoped extension of the incumbent brand-kit-ui world.

## Direction contract

THESIS: Keep the four real discovery destinations centered and the existing
account entry readable in the owner's compact desktop reference.

OWN-WORLD: Original Learli SVG, existing Paper/White/Navy/Mint palette and Lexend
interface. At 64rem and above, the owner's standalone Sign in reference replaces
only the previous desktop transparent-until-scroll header material and sizing.
Mobile top bar/dock, private workspaces, forms, footer and other glass retain
their established treatment.

FORM: Pale translucent header present at rest and on scroll, 72px minimum row,
90rem maximum width with 2rem gutters, local 78px wordmark, centered 46px White
capsule, 44px usable links and 36px visible inset fills at normal text size.
The four labels remain medium weight. The owner explicitly removed desktop
navbar underlines while retaining the light green hover/current-page treatment.

ACCOUNT: Preserve real session states, native Account entry, readable checking
and recovery text, full wrapping names, initials, disclosure, focus and logout.
The anonymous Sign in entry always has a White rounded background and a Navy
outline (18%), with Mint hover (26%) and no underline. The current Sign in
destination also has a decorative 6px teal dot, never an authentication-status
badge. A font-relative desktop
container threshold of 50rem gives the account the full second row, with a
surface-radius signed-in trigger; ordinary desktop keeps the right column.

ACCESS: Keep aria-current and visible focus. Height can grow with text. Sticky
behavior still requires scripts, 64rem width and 40rem height. Reduced
transparency, high contrast, forced colors and missing backdrop support retain
solid/system surfaces.

Authority: [owner decision](../../docs/decisions/2026-10-17-desktop-navbar-reference.md)
and [blueprint](../../prompts/features/m1-05-desktop-navbar-reference.md), recorded
as **AUTHORIZED — build-feature delegation**. This brief records source facts;
verification and finish disposition remain in the root coordinator's records.
