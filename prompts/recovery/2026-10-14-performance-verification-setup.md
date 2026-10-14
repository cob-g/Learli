# Local performance verification setup

Status: AUTHORIZED — build-feature delegation, 2026-10-14.
Authority: user request to fix local slowness; bounded local verification setup
under `prompts/features/m8-09-local-preview-performance.md`.

## Observed failure

The first full integration run passed 890 cases but failed one test and two
suite setup hooks (16 cases skipped). The hosted-auth hook explicitly requires
`LEARLI_STAGING_TEST_PORT`, omitted from the invocation. The native TLS suite
writes a receipt into the absent ignored `.local/neon-activation` directory.
The booking-notification test expects its synthetic mailbox directory to have
mode 0700; the existing `.local/mail/test/booking-notifications` has mode 0755.
Evidence: `.local/performance-repair/integration.log`; suite sources and local
directory metadata. No application performance regression is indicated by these
three errors. No production data or external deliveries are involved.

## Recovery recommendation

Failure mode 1: targeted local verification setup correction. Assign an unused
loopback TLS test port, create the ignored receipt directory, and tighten only
the synthetic test mailbox directory to 0700. Preserve its contents and all
source/user work. Rerun the three failed files against the isolated test database;
retain the passing 58-file evidence because application sources are unchanged.
Then execute the standard browser suite. Do not weaken tests or application
security checks. No application repair, reset, migration, or deployment is needed.

The earlier static-check failure was formatting in the new blueprint only;
formatting was corrected and the complete static/unit check subsequently passed.

Same-agent recovery diagnosis; not independent review or production signoff.

## Coordinator outcome

Applied only the local setup corrections above; application sources remained
identical to the reviewed state. Separate verification with assigned port 55703
passed all 44 cases in the three previously affected files. Combined with the
initial 58 passing files, all 907 integration cases have passing evidence;
this is aggregate evidence, not a single uninterrupted full pass. Original
failure log is retained alongside `integration-recheck.log` in the evidence
directory. Browser verification proceeds separately.

## Browser assertions affected by the preference

The first browser run passed 66 cases and failed two (104 did not run due to
project dependencies). The hosted test assumed every cookie must be HttpOnly;
the new validated display-preference cookie is intentionally client-readable.
The profile test issued two immediate document navigations without waiting for
the first page's preference-saving effect, so the next server render correctly
used the previous cookie. Evidence: `e2e.log`, existing assertions and the
profile component's effect. No auth-cookie protection failure was observed.

Targeted test repair: explicitly assert the preference's HTTPS Secure, SameSite,
host, session lifetime, path and valid zone; apply the existing HttpOnly
assertions to every other cookie and require auth cookies to remain present.
Before immediate profile navigation, assert both sessionStorage and the cookie
contain the explicitly chosen zone. These are stronger assertions of the new
contract, not application fallback or permission changes. Re-review the test
delta, run static checks, then repeat the full browser suite because most
dependent projects did not run. Existing application/build/PG evidence remains
applicable to unchanged sources.

The second browser run passed 94 cases, including both repaired assertions and
all hosted authentication/profile checks. A pre-existing booking-notification
Back-navigation assertion then called `page.content()` while the document was
changing; Playwright rejected the read before any privacy assertion ran. This
blocked 77 dependent cases. The original `e2e-2.log` is retained. Recommended
bounded repair: retry that actual HTML assertion while the expected `about:blank`
Back destination settles, still requiring the private learner marker to be
absent. Do not substitute empty HTML on errors or change navigation/application
guards. Review this test-only delta, run its static checks and repeat the browser
suite to cover the unexecuted dependent cases.

## Final verification outcome

The test-only repairs passed fresh same-agent read-only review, scoped ESLint,
formatting and typecheck. The third full standard browser run passed 172/172
cases in 7.0 minutes. Original failures remain in the evidence directory; no
application workaround or security relaxation was needed. Scoped application
hashes match the initial reviewed/built/PG-tested implementation. Later concurrent
signed-in-header edits are separate work and are not covered by this build or
browser result. This scoped recovery is resolved.
