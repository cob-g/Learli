# Desktop navbar validation recovery — 2026-10-17

Authority: **AUTHORIZED — build-feature delegation**, the owner's explicit
navbar-only reference implementation request and its M1.5 blueprint.

## R1 — Empty pending surface before hydration

Independent source Review identified that the new desktop checking-panel styles
also apply without `data-live`, when the existing checking text is intentionally
hidden. This would leave an empty bordered surface in SSR/no-JavaScript output.
The native Account entry remains functional; no authorization defect is implied.

Recover classification: targeted presentation fix. Limit only the new pending
surface selector to `.site-header[data-live]`, retaining the native fallback,
existing error panel, loading status, session logic and desktop footprint. No
product decision or data work is needed. Separate implementation applies the
selector correction; independent Review checks it and separate Verify covers
no-JavaScript, pending/error/retry and navigation stability in the owned browser.

## First visual inspection

The first batched reference comparison found that a Tailwind width utility
prevailed over component-layer logo CSS. Use the existing BrandLogo `className`
prop at the desktop breakpoint, retaining original artwork and mobile sizes.
No global logo rule or asset edit is justified. Header/capsule geometry already
matches the supplied73px/46px reference; final inspection remains pending.

## R2 — Ordinary account name changes header footprint

Separate actual normal-build browser1 passed13/15 in14.5s. The1024px and1440px
initial/error/retry cases observed a22px header-height increase after the real
provider session resolved. Other navigation, enlarged-name, mobile and selected
actual authentication/logout checks passed. Logs and original error contexts are
retained under `.local/desktop-navbar-20261017/`.

Recover diagnosis: the desktop chip's small Account caption plus a two-line
ordinary display name exceeds the new compact row. This is a presentation
regression; do not weaken the stability assertions or truncate account names.
Targeted recommendation: on desktop only, hide the redundant visual Account
caption (the button retains its full explicit Account/name accessible label),
and use3px block padding so the48px chip can accommodate two20px name lines.
Keep original initials, full display name, disclosure and all auth handlers.
Longer/enlarged names may still grow naturally. Mobile/workspace styles unchanged.

Separate implementation owns the bounded CSS repair, followed by independent
read-only Review, repeated quality/build/browser checks and the final visual
batch. No new product/security decision, policy or database modification needed.

## R3 — Enlarged account name remains in a narrow column

Fresh Impeccable finish Review accepted ordinary desktop fidelity and all nine
captures, but found that the 1024px/200% long-name capture split normal words
inside a tall narrow capsule. The preceding no-overflow check was insufficient
to establish readable reflow. This is a targeted presentation correction, not a
new layout direction or a failure of authentication.

Root cause: the desktop account remains in the grid's narrow right column even
when text scaling makes that column too small. Recommend a named header size
container with a font-relative threshold: constrained/enlarged desktop layouts
give the account a full-width second row and a modest rounded boundary. Preserve
ordinary desktop reference geometry, full names, native controls, existing
session/menu behavior and all mobile/private styles. A separate implementation
applies this bounded repair; independent Review and separate Verify check the
same browser cases and recapture the same nine views with a readable-reflow
assertion. Recover performs no verification.

The same fresh Review identified stale desktop descriptions in DESIGN.md.
The separate documenter records only this authorized navbar exception and its
structured design facts, retaining unrelated mobile/private guidance. Authority
remains AUTHORIZED — build-feature delegation; no new material decision needed.

## Outcome — recorded by the separate coordinator verification stage

R1/R2/R3 resolved in the final working tree. Independent source Review returned
READY FOR VERIFICATION without blockers. Separate final checks passed1,990 unit/
component tests plus format/lint/types, production build and15 selected real
browser cases in14.2s. The same nine captures were replaced; enlarged full names
now wrap at spaces across a wide second row, with visible account-menu focus.
Fresh finish Review accepted both scored fixes with disposition **ship**.
Original failures remain recorded above; Recover did not execute these checks.
