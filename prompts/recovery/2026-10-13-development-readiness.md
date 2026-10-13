# Development readiness recovery

Authority: AUTHORIZED — build-feature delegation; see
`prompts/features/m8-09-development-readiness.md`.

## R1 — local pre-migration inspection

The first private baseline helper returned a generic failure after successfully
writing its PostgreSQL custom backup. No migration or application configuration
change occurred. Read-only inspection confirmed that array_agg(column_name)
returns a PostgreSQL information_schema domain array as a string to node-postgres,
so the helper's Array.map assumption fails.

Classification: targeted tooling fix. Cast column_name to text before aggregation;
reuse the retained completed backup, then collect the baseline and execute the
previously planned migration/preservation checks in the separate implementation
and verification stages. Preserve the failed attempt and existing backup. No
schema, permission, data reset or application-policy change is needed.

## R2 — development fixture connection failures

Neon acceptance attempts 1 and 3 failed opening a separate, guarded fixture-owner
connection. Existing synthetic identities and successful signup/verification
evidence were retained. A subsequent read-only guarded connection probe succeeded
in 2433 ms. The configured connection deadline is 3000 ms, but the precise network
cause is not proven. No application connection guard or deadline was changed.

Classification: bounded operational recovery. Reuse the existing owned accounts;
permit at most three fixture connection attempts only when the query callback has
not started and the guard reports `connection_failed`. Never retry a query whose
execution or commit is uncertain. Record retries, preserve failures, and retain
the exact development branch, TLS and role checks on every lease.

## R3 — acceptance runner contracts

Attempt 2 reached tutor setup, then its availability PUT failed because the helper
read `version` at the response root. The actual GET contract is
`{ schedule: { version, ... } }`. Correct the helper, not the application. Its
owned synthetic tutor was suspended by cleanup. Later attempts reuse that profile
and the existing identities rather than create duplicate accounts.

Attempt 4 passed 33 assertions through actual Neon booking, idempotency and
participant/foreign meeting-link access, then failed in the browser navigation/
load-wait stage. The initial sanitized report does not establish the exact browser
error. Replace the unnecessary network-idle wait with the actual visible meeting
link assertion; retain private detailed failure evidence for any further failure.
Check the real link label and response contracts before rerunning. All fixture
cleanup remains limited to the owned synthetic tutor; no broad database reset,
real email, policy activation or production operation is part of this recovery.

Attempt 5 subsequently passed all 43 core assertions, including browser booking
rendering at 390/1440 widths, concurrency, lifecycle and College booking. Its
public-page `page.content()` failed explicitly during navigation. The same
observation failure recurred in a targeted follow-up after the heading was visible.
The final follow-up reads the visible document through a locator, with bounded
read-only DOM retries; it passed 24 assertions without a retry, including public
privacy and exact owned-tutor retirement. Successful core work was not repeated.

One earlier follow-up received the application's generic 503 at sign-in. The exact
driver/provider cause is unproven; a later explicit attempt succeeded. Retain this
as an observed transient availability limitation, not proof of a repaired network
defect. Application timeouts, TLS validation and permissions remain unchanged.
