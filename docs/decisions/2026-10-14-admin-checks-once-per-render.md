# Admin identity and MFA checked once per page render

Date: 2026-10-14. Approved by the owner in session ("sure go ahead with 1").

## Problem

Admin pages read the same identity two or three times in one render: once in
the `loadPrivatePage` MFA pre-check (`readAdminSecurity`), again in the page's
own `requireRole`, and on the overview a third time through `readAccount`. MFA
was checked twice with two different queries. Admin › Subjects ran 9 queries
for 1 data read and the overview 12. On the Neon development database each
query costs three ~50 ms round trips, so one admin click waited about 2 s.

## Decision

`requireIdentity` and the admin assurance read (`has_admin_assurance` per user,
session and age) are wrapped in React `cache`. React scopes that memo to one
server page render, so the pre-check and the page guards share one read. Route
handlers, tests and every new request still read the session, account status,
grants and assurance afresh; outside a render `cache` calls straight through.

The pre-check now uses the same identity and assurance reads as the guards
instead of `readAdminSecurity`. It still redirects an admin without current
assurance to `/account/security` and leaves every other refusal to the page's
guarded load. `has_admin_assurance` itself re-checks session, active account,
verified email, the admin grant and the verified factor, so the redirect
condition is unchanged.

## Result

Admin pages 9–12 queries → 5 (overview, subjects, accounts, support
assignment, reviews). Tutor review queue 15 → 7. Other private pages that
re-read identity in one render also benefit (Tutor › Profile 9 → 6).

## Not changed

The per-checkout connection verification and reset (three round trips per
query) remain; that is still the owner's open decision in
`2026-10-14-preview-speed-and-page-loading.md`. No schema, endpoint, policy or
permission rule changed.
