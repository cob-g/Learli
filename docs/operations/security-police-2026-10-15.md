# SECURITY POLICE — 2026-10-15

## Local integration update — 2026-10-16

The owner explicitly authorized committing and merging the preserved security
work into local main. Only this report and the progress notes remained
uncommitted; the branch's application-code baseline `1cab722` was already in
main. Commit `af1a7ee` preserves the two original documents exactly, and merge
`5c37def` integrates them without replacing application code. All newer main
progress history and the original security entry are retained.

The historical browser blocker below was subsequently corrected in `cc7e579`;
see [the accepted browser follow-up](security-browser-followup-2026-10-15.md).
The [completed regression sweep](regression-police-2026-10-16.md) later passed
206 Chromium and 78 Firefox/WebKit cases, alongside 1,751 unit/component and
996 PostgreSQL cases, build and backup/restore. All 833 validated program/test
hashes still match after this documentation-only merge. Formatting and staged
diff checks passed; no functional suite was rerun for these record changes.

The conditional SQL authority lead, development advisory and staging proxy/
rate-limit follow-up remain deferred. Relevant SQL functions and dependency
manifests are unchanged from the audit baseline. The provider-blocked SQL task
was not reopened; this integration claims no new application vulnerability fix,
updated dependency-audit result or security certification.

The original `/tmp/learli-security-police-20261015/` evidence directory is no
longer present at integration. The original report's observations and counts
below remain historical records, not newly executed or independently recertified
checks. Exact original document copies and integration proof are preserved in
`/Users/cob/orca/archives/learli/security-local-integration-20261016/`.
No push, deployment, live-provider test or production mutation occurred.

## Original audit record — 2026-10-15

**Repository review finished; remediation remains incomplete/deferred. No application or test fix is retained. The final changes are this report and the progress record.**

Baseline: `1cab7228c1a6cfa864a7136e2c2e105da4c433d5`. Branch: `fix/security-police-20261015`. Evidence directory: `/tmp/learli-security-police-20261015/`. Supervised Orca run: `run_1c3be5d9b860`.

## Exploration and coverage

Spawned **14 GPT-6 Luna investigators at high effort** and **two GPT-6.1 Sol workers at high effort**. Effective launch receipts were checked. Six primary scopes, three cross-module scopes, two final evidence audits and three bounded browser-failure/candidate audits ran. Up to three workers ran alongside the coordinator. Luna investigators stayed read-only; Sol attempts used separate checkouts.

Reconnaissance inventoried **1,210 tracked regular files, 12 tracked directory symlinks, 56 API route files and 70 page files**. This is inventory and architectural coverage, not a claim of exhaustive line-by-line verification. Project instructions, eight canonical context files, applicable decisions, current migration replacements, actual callers and tests informed triage.

Covered authentication, sessions, reset/email/MFA flows; current role/ownership/guardian/assigned-tutor/staff scopes; API schemas/origins/errors; PostgreSQL privileges and narrow definer functions; learner/tutor/booking/support/safeguarding/review workflows; asynchronous delivery and recipient authority; private meeting links; frontend rendering/redirects/cache/document boundaries; environment/database/operator guards; build and supply chain. Cross-module agents compared auth to SQL, relationships to final data projections, and configuration/events to integrations.

The implemented stack is one Next.js/TypeScript marketplace using Better Auth, Drizzle/PostgreSQL, Resend and private Zoom/Meet links. No organization tenancy, AI tool execution, upload/object-storage or enabled payment/webhook architecture was found in the active application. The relevant isolation boundaries are account, guardian/learner, tutor and assigned staff. Existing readiness, child-safety and real-user launch gates were preserved.

[OWASP ASVS](https://owasp.org/projects/asvs) and [OWASP API Security Top 10](https://api-security.owasp.org/editions/2023/en/0x11-t10/) guided investigation of actual trust boundaries. This is not an ASVS or production-readiness certification.

## Findings and severity

**Four promoted security lead groups**, plus one separate validation-harness defect. Negative hypotheses in individual reports are not each counted as vulnerabilities.

| Lead                                                                        | Disposition                                                                                           | Severity / evidence                                                                      |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| SQL snapshot-authority family (`SQL-ISO-01/02`, original B moderation lead) | One grouped conditional lead across three functions; verification/remediation deferred                | Proposed Low; high-confidence source concern, no accepted complete executed verification |
| `AUTH-AVAIL-01`                                                             | Documented shared rate-limit mode; operational follow-up                                              | Low conditional availability concern; source behavior established, deployment unknown    |
| `DEP-DEV-01`                                                                | One known advisory affecting nine development-tool entries; compatible remediation deferred           | Advisory High; all affected lockfile nodes dev-only, runtime-only audit zero             |
| Forged actor through ordinary services                                      | Rejected for the inspected supported user path                                                        | Identity/session server-derived and current SQL predicates scoped                        |
| `SEC-TEST-01` (separate)                                                    | Existing stale browser-test selector confirmed; attempted repairs failed validation and were reverted | Validation infrastructure defect; no demonstrated application vulnerability              |

**New confirmed application vulnerabilities accepted: 0. Application vulnerabilities fixed: 0.** One high-confidence conditional application lead remains unverified/deferred; one promoted lead was rejected and two remain dependency/operational risks. Confirmed application severity totals: Critical **0**, High **0**, Medium **0**, Low **0**. The provisional SQL severity and development advisory rating above are separate. These counts do not prove absence of vulnerabilities.

### Conditional SQL authority concern

Locations: `record_learner_admission_evidence` and `revoke_learner_admission_evidence` in `drizzle/0023_learner_admission.sql:312,391`; `moderate_private_review` in `drizzle/0020_private_synthetic_reviews.sql:125`. Its helper is replaced in `drizzle/0022_admin_assurance.sql:203–214` and **does enforce W1 MFA assurance**. The older helper is not the current implementation.

The W1 contract requires current exact admin-role/session/assurance/assignment enforcement at narrow SQL boundaries (`context/architecture.md:1601–1613`, `docs/decisions/2026-10-12-admin-assurance.md`). These three function bodies do not reject caller-selected fixed-snapshot isolation; snapshot-bound reads may retain older role authority. Triggering this concern requires direct SQL-session control as the restricted server database principal. No browser/API isolation-selection path was found. Admission services explicitly use READ COMMITTED; private moderation normally uses an autocommit query. Effects concern synthetic admission evidence/local private reviews; no real-user or public-publication exploit is claimed.

If independently verified through an appropriate authorized process, the focused recommendation is the existing early READ COMMITTED guard pattern in a new forward migration, preserving current predicates, grants, function contracts, history and replay semantics. Actual committed effects, compatibility and migration/regression proof remain required. No such migration or fix is retained here.

### Dependency and operational risks

The all-dependency audit reports nine High package entries tracing to **one** `braces` advisory, [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The primary advisory lists no patched version at assessment time. Root lockfile reconciliation and independent E/I/K reviews found every affected node development-only and no public application input path to the vulnerable parser. The runtime-only audit reports zero vulnerabilities. This does not certify deployed build-stage tooling. No DoS payload, forced major downgrade, dependency change or manual lockfile rewrite was performed; track a compatible upstream fix.

The explicit hosted-synthetic `shared-bucket` mode conservatively shares an HTTP per-path limiter key. Its runbook documents that choice; it does not establish an authentication bypass or universal private-page outage. Before separately authorized externally exposed staging, establish the trusted-proxy overwrite contract and edge/client fairness. Do not trust arbitrary forwarding headers or infer live settings from source. No shared-bucket exhaustion or deployment test was performed.

Independent checks rejected the obsolete-migration missing-MFA claim and ordinary forged-actor claim. An initial report's unused `refusedMailResponse` statement was corrected by current auth/account-email callers. The already merged 0030/0031 fixes are excluded from new findings.

## Implementation attempts and exact outcome

**SQL Sol attempt — failed/interrupted.** The worker independently inspected current code and authored an untracked draft test. Its incomplete draft run reported **18 failed / 15 passed** with fixture expectation/retained-assignment errors; it is not accepted as complete three-function verification. The provider ended the turn with `cyberPolicy`, `willRetry: false`; a cleanup-only follow-up was also blocked. Root did not retry or replace that blocked task. It stopped/released the exact supervised worker, checked real owned cluster paths/marker/ports/stop script, stopped only its synthetic port 56049 cluster and preserved its draft/data. No SQL/source patch was imported.

**Browser Sol attempt — failed/deferred.** The unchanged full browser run produced **200 passed / 1 failed**; a focused original rerun produced **6 passed / 1 failed**. Luna L traced the failing Sign in locator to authenticated workspace chrome. Sol independently proposed a test-only client-navigation correction that retained all original privacy assertions. The first formatted candidate failed waiting for public-header Sign in after its initial mount. One bounded correction used another genuine public client navigation and corresponding history checks; it reached initial auth/failed-login privacy assertions, then timed out observing a fresh Back-navigation main-document response. Independent Luna M/N audits recorded these blockers rather than declaring green.

Root verified the exact candidate hash and restored **only its owned test change** to the immutable original (`tests/e2e/hosted-auth.spec.ts` SHA256 `01acb3a1bcc34086e49c2a818a887d896cc912817c8045bb391af0d00f3cfc07`). Child candidates, patches/manifests and logs remain diagnostic artifacts, **not verified fixes**. No assertions were weakened to force passing results.

**Retained implementation totals:** application/control changes **0**; source/test files changed **0**; integrated regression tests **0**. Only this report and `context/progress-tracker.md` remain changed. No commit, merge, push, deployment, credential rotation, policy activation, public API change or production operation occurred.

## Validation actually executed

| Check                                     | Observed result                                                                                                           | Evidence file                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Fresh baseline `npm run check`            | Exit 0: format/lint/types and **1,648 tests / 112 files** passed, 8.92s                                                   | `baseline-check.log`                                |
| Owned synthetic PostgreSQL integration    | Exit 0: **969 tests / 67 files** passed, 438.66s                                                                          | `baseline-integration.log`                          |
| Production-mode build under test wrapper  | Exit 0; 131 app paths; 3 existing path-inference warnings                                                                 | `baseline-build.log`                                |
| Exact synthetic client artifact/path scan | 65 static text files; 0 selected private-value hits; 0 private-path trace references                                      | `build-client-boundary-evidence.json`               |
| Full dependency audit                     | Exit 1: 1 underlying High dev advisory, 9 package effects                                                                 | `dependency-audit.json`                             |
| Runtime-only dependency audit             | Exit 0; 0 reported vulnerabilities                                                                                        | `dependency-runtime-audit.json`                     |
| Full existing browser suite               | Exit 1: **200 passed, 1 failed**, 7.4m                                                                                    | `final-browser.log`                                 |
| Original affected 7-case browser project  | Exit 1:6 passed, 1 failed, same absent Sign in selector                                                                   | `focused-hosted-browser.log`                        |
| Candidate static/unit checks              | First stopped at formatting; exact-file formatter resolved it. Subsequent checks passed format/lint/types and 1,648 tests | `final-check-formatted.log`, `final-check-rev3.log` |
| First formatted browser candidate         | Exit 1:6 passed, 1 failed; initial public-header selector,35.4s                                                           | `postfix-hosted-browser.log`                        |
| Final bounded browser candidate           | Exit 1:6 passed, 1 failed; history response observation,1.0m; candidate reverted                                          | `postfix-rev3-hosted-browser.log`                   |
| SQL draft                                 | Incomplete: 18 failed / 15 passed; no accepted verification/fix                                                           | `sol-interrupted-handoff.md`                        |

No complete green browser suite or successful remediation is claimed. Candidate runs are not counted as additional unique regression cases. Luna A's 54 focused pure unit cases overlap the full unit suite. Database/build evidence is baseline evidence on runtime inputs that remain byte-identical; it is not post-fix certification.

The three existing Turbopack warnings concern broad dynamic local-mail path inference. They do not prove private contents were bundled. The artifact scan compares only named synthetic test values against `.next/static` and private-path trace entries; it does not prove absence of every secret, derived value or server-output leak, and does not assess production artifacts. Live credentials and private capture contents were not disclosed.

## Independent audits, residual risks and follow-up

J/K independently audited final triage/dependency/data evidence; M/N audited the rejected test candidates and actual failing execution. Their source-shape acceptance did not override runtime failures. No successful post-remediation audit is possible because no fix was accepted. N's candidate hash describes its pre-revert review; the coordinator's revert/integrity receipts establish the final original source.

Unresolved: conditional SQL authority verification after the provider block; existing hosted-auth selector/history-observation harness issue; compatible development dependency remediation; actual staging proxy, deployed grants/artifact/cache controls and operational response assessment under separate authorization. The next bounded engineering task is sanitized local browser navigation/history evidence for the harness, preserving existing privacy checks.

No live Railway/Neon/edge/CDN state, real account, mailbox, external provider or production data was tested. No organization/AI/upload/payment system was invented. Existing guardian/College/screening/safeguarding/publication/commercial gates remain unchanged. No security readiness or production safety certification is made.

## Task accountability

All 16 spawned worker resources are released: 14 successful read-only investigations/audits and 2 failed/deferred Sol attempts. The unused Task `task_56bcb4062b76` was cancelled after structured-session reuse failed preflight; inspection proved it had no Dispatch and spawned no additional agent. No Task or terminal is left without an outcome/owner decision.

Each report below is in the evidence directory. The SQL handoff is explicitly a coordinator observation because the blocked worker could not complete its own report.

| Worker      | Task              | Dispatch         | Scope                                  | Outcome             | Report                                  |
| ----------- | ----------------- | ---------------- | -------------------------------------- | ------------------- | --------------------------------------- |
| luna-a      | task_cbf46aeb0964 | ctx_9e616e7cca11 | Auth/session/MFA/ingress               | succeeded; released | luna-a-auth-security.md                 |
| luna-b      | task_e3c47b89d510 | ctx_ae4de6508617 | SQL grants/current authorization       | succeeded; released | luna-b-database-security.md             |
| luna-c      | task_b4232b850f24 | ctx_f35a856b7f22 | Domain ownership and lifecycle         | succeeded; released | luna-c-domain-security.md               |
| luna-d      | task_0c87fea81b92 | ctx_fbc6bf0ad624 | Frontend/API/input/output/cache        | succeeded; released | luna-d-frontend-api-security.md         |
| luna-e      | task_7d8a3c6d8c69 | ctx_4089a131349e | Runtime/operator/supply chain          | succeeded; released | luna-e-runtime-supply-chain-security.md |
| luna-f      | task_dd3b166229cf | ctx_f43aa5eb4f52 | Integrations/sensitive data            | succeeded; released | luna-f-integrations-data-security.md    |
| luna-g      | task_c81c8df4f025 | ctx_587ca6de5c37 | Cross-boundary auth/config/SQL         | succeeded; released | luna-g-auth-sql-crosscheck.md           |
| luna-h      | task_485292b288c2 | ctx_a7410bbb895b | Cross-module data projections          | succeeded; released | luna-h-projection-crosscheck.md         |
| luna-i      | task_881c8af9a806 | ctx_714321b2b2a6 | Cross-module runtime/integrations      | succeeded; released | luna-i-runtime-data-crosscheck.md       |
| sol-sql     | task_407c4138790f | ctx_48c6a35b3ec7 | SQL verification interrupted           | failed; released    | sol-interrupted-handoff.md              |
| luna-j      | task_ed6c2217cde9 | ctx_be03c66da408 | Final triage/evidence audit            | succeeded; released | luna-j-final-triage-audit.md            |
| luna-k      | task_667546bf0653 | ctx_0524f50f4f1b | Final dependency/data audit            | succeeded; released | luna-k-final-boundary-audit.md          |
| luna-l      | task_9933e4ee0a07 | ctx_4a48d8caf689 | Existing browser failure diagnosis     | succeeded; released | luna-l-browser-failure.md               |
| sol-browser | task_f4607a1e4a83 | ctx_4b656a16c46f | Browser candidates rejected/reverted   | failed; released    | sol-browser-result.md                   |
| luna-m      | task_6d27cbefed5e | ctx_8d4f0db37b9c | First test candidate independent audit | succeeded; released | luna-m-browser-reaudit.md               |
| luna-n      | task_f5053af37e83 | ctx_b369301cab6f | Final test candidate independent audit | succeeded; released | luna-n-browser-final-audit.md           |

Owned browser/TLS/SQL worker ports were observed closed; unrelated user services and the Claude checkout were preserved. Two stopped child checkouts preserve diagnostic work. Root's final integrity receipt verifies unchanged runtime/test/migration/dependency bytes and 12 symlink targets, only report/progress document changes, no staged work and unchanged HEAD.
