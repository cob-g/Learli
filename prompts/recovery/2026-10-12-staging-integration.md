# Learli Recovery — Staging integration verification

Status: AUTHORIZED — build-feature delegation for scoped local repairs.
Mode: Targeted Fix. Baseline `0d7f2dd`; parent blueprint
`prompts/features/m8-03-staging-database-foundation.md`.

## R1 — Parent blueprint formatting

Observed: initial combined `npm run check` exited 1 in format:check, naming only
the parent blueprint. Lint, typecheck and tests did not run. Private receipt/log:
`.local/staging-database-wave/combined-check.{json,log}`. The new parent blueprint
had not been formatted after drafting; no application defect is established.

Recovery recommendation: end diagnosis, format only that document and this note,
inspect the resulting documentation diff, refreeze the candidate and rerun the
required combined check. Preserve the first failed receipt. No source, policy,
assertion, dependency or database change is needed. NOT RUN BY RECOVER.

The current user request authorizes routine scoped repairs through build-feature;
no separate human approval is claimed. Independent review remains pending.

## R2 — CLI unit fixtures depend on checkout directory permissions

Observed: combined-check-2 passed formatting, lint and TypeScript; unit checks
reported 892 PASS and three failures in staging-database.test.ts. Inspect-config
returned private_file_invalid rather than PASS, and two malformed-input cases
were refused before reaching their intended config/plan validation. The
integration checkout's pre-existing .local is mode 0755, while the production
private-path guard correctly requires mode 0700 for every ancestor inside the
selected root. Recursive fixture mkdir does not change existing ancestor modes.
Builder B's different local permissions concealed this fixture dependency.

Recovery recommendation: end diagnosis, make each CLI test own a synthetic root
and its complete private directory tree, copy only nonsecret candidate inputs,
pass that root explicitly, and clean up only owned fixture roots. Exercise the
readable-parent rejection directly while preserving all current assertions. Do
not chmod the real checkout's .local or weaken the production guard. This is a
root-owned test-only repair within the current delegated build-feature scope.
Re-review the narrow diff, rerun the failed CLI tests and combined checks, then
freeze a new candidate for independent review. NOT RUN BY RECOVER.

## R3 — Independent effective-privilege findings F1/F2

Independent candidate-v3 review covered all 34 exact files and returned CHANGES
REQUIRED with two Important findings despite the observed 895 unit/430 PG/build
passes. Original report/findings remain in the private review directory. No
provider configuration or exploit was observed.

F1: attribute/membership/object checks omit independent PostgreSQL parameter
ACLs and actual session_replication_role. Direct/PUBLIC SET can permit replica;
privileged role/database defaults can start replica without remaining SET ACL.
Origin triggers and FK checks can then be suppressed. Read-only owned PG17.11
catalog inspection confirmed no default parameter ACL privileges, including
ordinary work_mem SET. Add a shared staging-only effective parameter ACL check
to runtime checkout, migration prerequisites, grant audit and runtime probes;
require actual origin mode before every callback, inspection/apply and probe.
Bind new helper bytes into candidate identity. Tests must exercise direct/PUBLIC
SET and ALTER SYSTEM grants, role/database defaults with no runtime ACL, drift
after opening, refusal before callbacks and normal recovery after revocation.
Never execute ALTER SYSTEM in these tests.

F2: the original grant policy grants no delegation options. Existing function
EXECUTE/public schema USAGE grant options survive re-GRANT; table/column options
also pass read-only auditing. Query effective WITH GRANT OPTION for every
inspected column/table/function and schema/database right, deny extras, and test
real function/schema inspect-and-apply plus table/column/database inspection.
Keep original SQL and grant batch byte-identical; do not silently revoke an
operator's unexpected capability to make verification pass.

Diagnosis ends here. Root owns these authorized narrow repairs; then scoped
review, new regression execution, exact freeze, independent follow-up review and
required fresh check/integration/build. Existing failures/passes remain retained
with their actual candidate. NOT RUN BY RECOVER.

Primary semantics consulted: [PostgreSQL 17 privilege inquiry functions](https://www.postgresql.org/docs/17/functions-info.html#FUNCTIONS-INFO-ACCESS-TABLE),
[parameter settings](https://www.postgresql.org/docs/17/config-setting.html), and
[replication mode](https://www.postgresql.org/docs/17/runtime-config-client.html#GUC-SESSION-REPLICATION-ROLE).

### R3 verification fixture follow-up

Focused real-PG/TLS repair coverage passed 62/62, including all22 new cases.
The first broader repair check passed format/lint/types but reported889 PASS/6
FAIL: existing pool mocks omitted the newly required origin identity and safe
parameter-ACL result. Their old clearAllMocks also retained unused one-shot
responses after an early failure, cascading into following tests. This is a
confirmed mocked-result contract mismatch, not an observed production failure.
End diagnosis; update those mock rows/query counts and reset mock queues between
cases, preserving failure/cleanup assertions; rerun check. Keep the first failed
receipt. Independent real-PG62 results remain attached to their source version.

## Final coordinator acceptance

F1/F2 follow-up independent review on candidate-v4 closed both findings with zero
remaining/new confirmed findings and READY FOR VERIFICATION. Separate root
verification passed895 unit/component plus format/lint/types, full452 PostgreSQL
cases and production build on all35 exact v4 source hashes. Focused62 and prior
failed checks remain preserved with their actual source applicability. No SQL,
grant policy, dependency or local guard weakening was required. Actual Neon and
remote CI remain NOT RUN. Final status-only documentation is coordinator-reviewed
separately; this note does not relabel prior failed candidates as accepted.
