# Learli recovery — independent three-feature review repairs

Status: AUTHORIZED — build-feature delegation, 2026-10-12.
Mode: Targeted Fix. Severity: two Minor findings, local synthetic candidate only.
Authority: root-confirmed dispatch task_3e630db5b07f / ctx_085e3cac6d28.
Branch/HEAD: cob-g/m5-three-feature-integration / b6cf237554b3d46e1e4c58ce10e1ef3ebafe10c0.
Requirements: AUTH-02/03/04, NFR-02; M2.7/M2.9 and factual integration handoff.

## Observed failure and diagnosis

Independent auth report F1 requires changes: local malformed email/code input
produces one generic focused paragraph, losing the validator's field paths.
The controls have neither invalid state nor error description. UI context's
existing first-invalid focus/inline association contract therefore fails.
No mutation is sent on this path; provider/proof/session behavior is unaffected.
Independent marketplace report M1 identifies obsolete Next Up wording that says
no implementation result is claimed after reporting verified integration.
Both reports were read in full; no new business or architecture decision is needed.

## Scoped repair and preservation

Map only known validation issue paths to fixed bounded safe instructions; never
store validator issues, code input or provider payloads in React state/diagnostics.
Render named inline errors with aria-invalid/aria-describedby; focus the first
invalid rendered control. Preserve safe address input and transient masked code
handling. Clear each field error on editing and all errors on valid submission,
stage changes and restart. Operation/uncertainty alerts and native recovery stay.
Add component/browser assertions for individual/both invalid fields, new-address
code correction, no request, safe retained address, error cleanup and unchanged
pending/success/provider uncertainty. Correct only factual tracker wording.

Only email-form.tsx, its component/browser tests, factual tracker, the integration
blueprint and this recovery handoff may change. No backend, config, schema,
dependency, grant, provider, other feature or policy modification is authorized.
Initial 61-file freeze verified exactly against root manifest, both aggregates
and complete candidate inventory; evidence is recovery-final/initial-freeze-proof.json.
Original reports/snapshots/manifests/logs stay intact. New operational evidence
belongs to .local/next-wave/recovery-final/. No commit/merge/push/deploy/reset.

## Separate verification handoff

Same-agent read-only Review precedes separate executed Verify. Run meaningful
component cases, npm run check, production build, focused production browser
correction if useful, and the complete default single-worker browser suite with
all 115 existing cases/assertions preserved. Inspect safe phone/desktop captures.
Validate owned PG55494 dev/test and loopback3054/3154 before writes. Do not
install/seed/migrate/reset. Retain prior389 real-PG/fresh/populated/grant proof
only with exact relevant source/config/test/proof fingerprints; disclose reuse.
Perform bounded current diagnostic privacy checks, excluding restricted original
secret-bearing HTML/binaries and earlier stdout from any clean-text claim.
Save final report/manifest and ignored memory, preserving full Feature History.
Root owns the independent scoped re-review and acceptance/merge decision.

Original integration/source failure histories remain in their unchanged Recover
notes and reports; this handoff adds to them without relabeling earlier failures.
Verification: NOT RUN at diagnosis/planning checkpoint. Rollback is a scoped
source revert before release; no database change is involved.

## Separate stage results — 2026-10-12

Same-agent read-only Review: plan/system/scope/docs PASS, READY FOR VERIFICATION,
zero remaining scoped findings; no tests executed by Review and no independent
re-review claim. Separate Verify: check657/35files (format/lint/types), production
build, focused email5/5 and one full default single-worker117/117 browser PASS,
all original115 preserved. Four1440/390 inline/new-code captures inspected; actual
keyboard/axe/no-overflow, pending/clear/success and proof privacy assertions pass.
No failed application verification attempt occurred during this repair run.

Prior389real-PG/fresh/populated/grant results are retained, not rerun:370 relevant
inputs and5proof/log hashes remain exact. All559 original artifacts remain exact
and original capture paths are restored. Current bounded diagnostic privacy PASS;
final report/manifest/memory packaging is scanned separately. Original private HTML/
binaries/earlier stdout remain excluded from clean-text claims. Exact evidence and
commands are under .local/next-wave/recovery-final/. Original failures remain in
unchanged source/integration Recover notes, reports and logs.

Only6 authorized delta files (5 modified from freeze, this1 added); no backend,
config, schema, dependency, grant or policy change. Root independent scoped
re-review/acceptance remains pending; no commit/merge/push/deploy/launch authority.
Owned synthetic services/data are preserved. Hardware screen readers/OS zoom,
other browser engines and hosted/real-user operations were not verified.
