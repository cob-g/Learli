# Private fictional workflow — scoped validation recovery

Authority: **AUTHORIZED — build-feature delegation**, owner-selected private
fictional staging without payments, 2026-10-16. Preserve the dirty baseline and
all existing security, admission, screening and booking improvements.

## Review finding: exact screening receipt in discovery/booking

Observed source: `src/features/private-workflow/query.ts` initially bound target
Tutor membership and screening case/head version but omitted the immutable policy
reference, authority, required checks, actions and validity fields. Screening
mutations/reads already bind all these through a transaction-safe postcheck.

Deterministic consequence: a structurally valid private packet with the same
screening version but different immutable fields could still advertise/select
the currently screened Tutor, contrary to the blueprint's mismatched-policy
denial contract. Runtime reproduction is pending a controlled PostgreSQL test;
do not claim production exposure or a live incident.

Classification: **Mode 1 — Targeted fix**. No foundation rethink, schema migration,
environment bypass, data reset, new authority or global coordination is needed.
The existing atomic booking function and final receipt check remain in place.

Recommended repair: join the target's immutable screening policy in the existing
private Tutor predicate and compare every receipt field to the explicit packet.
This same predicate protects directory, candidate, booking-choice, receipt and
private participant/meeting scopes. Preserve default SQL behavior without a packet.
Keep the current case/head validity checks; do not replace them with preflight only.

Verifier handoff: add a same-version altered-reference/criteria packet to the real
PostgreSQL scope test, observe rejection gap before repair, then verify directory,
candidates and direct reservation refusal with no writes. Re-run relevant scope,
screening and unit checks, repeat read-only Review, then the normal-build browser
flow and combined validation. No hosted/provider operation is authorized here.

Recovery analysis ends here. Implementation and verification belong to the
coordinator's separate stages.

## Browser runner origin mismatch — first attempt

Observed: the normal production build succeeded; the new3121 test web server
refused startup because `.env.test.local` still supplied Better Auth's3100 URL.
The fail-closed environment validator returned only the field name; no secrets
were logged and the connected journey did not start. Classification: targeted
**test harness configuration** repair. Set both APP_URL and BETTER_AUTH_URL to the
same owned3121 origin in the dedicated Playwright config/process. Preserve the
application validator; no production/runtime source change or rebuild is needed.
Re-review that configuration delta and rerun the same test without weakening its
startup or workflow expectations.

## Browser selector — second attempt

Observed: actual UI registration/verification, Parent role enrollment, Tutor
profile and current evidence-based screening approval succeeded. The test then
waited for an exact `Level` label, while the inspected form exposes `Learner level`.
It timed out before learner submission (one failed browser test). This is a
verified test-locator defect, not evidence of broken admission. Repair the locator
to select Middle School through the actual accessible label; preserve all intended
state/ownership assertions. Bound individual actions in this new runner so a
missing control is diagnosed promptly. Reuse the unchanged normal build and rerun.

## Observed closeout evidence

The same-version metadata test reproduced RED (one test/14 assertion failures).
After the shared full-policy predicate correction, operator/scope13 cases passed,
including a real observed meeting-save lock wait with packet Tutor removal and no
link/revision/event changes. Screening binding/replay/rollback tests also passed.
The two browser harness repairs preserved application validators and meaningful
assertions; both subsequent normal-build tests passed, with the final case also
using actual directory filters (8.7s;10.2s total). The separate hosted compatibility
suite initially lacked its required TLS port; all8 passed after selecting owned
port55703. Final combined results and remaining hosted/full-duration gates are in
`docs/qa/private-fictional-workflow-results-2026-10-16.md`. No reset, production
operation, broad reversal, waived safeguard or weakened verification was used.
