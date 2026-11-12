# M5.7 — Branded verification email

Status: **AUTHORIZED — build-feature delegation**

Authority: owner's 2026-11-11 request to professionalize the verification email
and sender picture shown in Gmail. This is delegated implementation authority,
not separate human blueprint approval. Continues the local owner-only slice in
`m5-07-resend-email-verification.md` on branch
`feature/resend-email-verification`, HEAD `2a48b43`, with its existing uncommitted
implementation and passing checks preserved.

## Outcome and scope

AUTH-01 / OPS-04, M5.7: the existing local verification email uses a clear
Learli sender name, supplied wordmark, readable navy/paper layout, one primary
“Verify email address” link, private-link explanation, ignored-request advice,
fallback link and equivalent plain text. No invented expiration or support claim.
“Sender picture” means Gmail's inbox avatar; it is controlled by the receiving
provider. Do not promise or fake an avatar for the shared Resend test address.
No terminology or material product decision blocks the email-body improvement.

## Implementation decisions and invariants

- Reuse the original `public/brand/learli-wordmark.svg` without redrawing it.
  Convert a small PNG for email compatibility and embed using Resend's documented
  CID attachment API. No public asset host, user upload or tracking image.
- Set the display name to `Learli`, keeping `onboarding@resend.dev` as the fixed
  mailbox. Exact owner recipient, callback proof validation, timeouts, no-retry
  policy, private headers and authentication behavior stay unchanged.
- Render a complete table-based HTML document with inline styles and native
  font fallbacks; retain usable content when styles/images are unavailable.
  Only the already-validated proof URL is variable, escaped in HTML.
- Limit this refinement to the active local verification path. Other templates,
  hosted sender rules, account/booking permissions and delivery enablement are
  unchanged. No new dependency, schema, domain, certificate, billing or deployment.
- Save the body/asset under `src/lib/email/` and `public/brand/`, update the
  affected unit assertions and canonical UI/progress/operational documentation.

## Separate verification plan

Review the scoped diff before executing verification. Run focused email/auth
unit tests, typecheck/lint/format, the isolated mocked runtime verification and
production build. Prove the payload retains the exact proof/recipient, CID
matches the supplied PNG, plain text agrees with HTML, special characters are
escaped, no external images/scripts are introduced, and the new renderer does
not weaken existing refusal/timeout cases. Confirm the asset appears in the
production trace without private env or fixture data.

Render a synthetic, nonfunctional proof preview at phone and desktop widths;
inspect layout, logo, focus, overflow and image-disabled fallback. Existing live
signup/link/sign-in results apply to the prior body only. A new Gmail visual
send may use the existing owner-only authorization, without resetting the
verified owner or using a proof for a different account. If real inbox testing
would require creating a new credential/account or changing verified state,
leave that step to the owner and disclose the limit. Never expose a live proof.

## Known limit and rollback

The Gmail avatar needs an independently controlled sender identity/domain and
provider-specific logo setup (for example BIMI with Google's requirements).
Do not alter the owner's personal Google profile, purchase a certificate, or
modify DNS as part of this slice. Roll back only this renderer/display name and
PNG reference; preserve accounts, proof behavior and previous feature changes.

Planning verification: NOT RUN. Context reviewed: the eight canonical files,
existing brand-kit context, original verification blueprint and local handoff.
