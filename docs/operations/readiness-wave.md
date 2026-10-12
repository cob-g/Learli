# Local readiness wave — 2026-10-12

The user-authorized readiness candidate was committed as
`581b4219a4fb9a323f50656dd6b82db90adac637` and fast-forwarded into local `main`
on 2026-10-12. All 55 committed files matched the independently reviewed freeze
before and after merge. A fresh production build from merged main passed using
the pinned Node/npm versions and the owned local test configuration. No new
migration was introduced or needed; main databases were unchanged.

Independent Reviews A/B/C cover the complete candidate with zero open confirmed
findings. The local test evidence below remains applicable to the identical
application source; it was not rerun merely because Git advanced. This report
and the progress tracker were then updated solely to record the merge.

This is local synthetic-data evidence, not hosted deployment, pilot or public
launch clearance. The seven wave worktrees and branches remain preserved; this
closeout did not push, deploy or remove them. Private merge, source-identity,
main-document backups and fresh-build receipts are in
`.local/readiness-wave/merge-closeout/` in the main checkout.

Authority: the user requested the proposed wave using GPT-6.1 Sol **High** effort
and `$build-feature`. The [wave blueprint](../../prompts/features/m8-01-readiness-wave.md)
records **AUTHORIZED — build-feature delegation**, not separate human approval
of each generated blueprint. All six original workers and scoped repair/review
workers used verified requested/effective model and effort settings.

## Delivered packages

| Package                                                  | Result                                                                                                                   | Boundary                                                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| [Dependency maintenance](dependency-maintenance.md)      | Installed graph, advisories and compatible fixes investigated; exact pins/lockfile retained                              | 13 inherited findings remain: nine high, four moderate, from two underlying advisories; no clean audit or waiver        |
| [Backup and restoration](local-backup-restore.md)        | Owned synthetic backup into a new disposable target, complete comparisons/probes and post-start failure cleanup          | Dedicated operations test outside default Docker integration; no production restore, retention or recovery-time promise |
| [Deployment preparation](deployment-runbook.md)          | Explicit configuration/build/health preflight and actual startup/migration/rollback runbook                              | Hosted mode stays blocked; local/shell startup is not Railway deployment                                                |
| [Safe diagnostics](safe-diagnostics.md)                  | Four bounded server categories and generated event identifiers, without error/request payload collection                 | Local signal only, not hosted monitoring, incident staffing or a public debug route                                     |
| [Firefox/WebKit acceptance](cross-browser-acceptance.md) | Selected real synthetic journeys; 44px native select targets with a visible marker and forced-color fallback             | Playwright engines and emulated viewports, not physical devices or accessibility certification                          |
| [Performance baseline](performance-baseline.md)          | Fixed production-build workload: public navigation and two-account booking conflicts, with exact cleanup/source identity | Local loopback measurements, not a production SLA, mobile field result or capacity test                                 |

Each original worker used an independent branch, checkout and allocated local
ports. Root reconciled shared changes in a seventh integration checkout, using
DB55507, dev/test3067/3167 and new disposable restore targets55517. At most two
heavy checks ran at once; authoritative timing held both slots exclusively.
Source imports required exact inventory and SHA256 checks. Credentials, dumps,
captures and raw logs remain in ignored private storage. No schema migration or
dependency change was introduced.

## Verification

| Check                             | Observed outcome and applicability                                                                                                                                                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pinned install and isolated setup | PASS in integration; existing seventeen migrations applied to its fresh owned database                                                                                                                                                                         |
| Combined check                    | PASS790/790 in43files, including formatting, lint and TypeScript; explicit real SDK privacy-failure regression included                                                                                                                                        |
| Production build                  | PASS after all application changes; later harness/documentation changes do not affect application inputs                                                                                                                                                       |
| PostgreSQL integration            | PASS390/390 in25files; retained after exact comparison of327 unchanged relevant inputs, with only CSS/email/booking presentation changes                                                                                                                       |
| Revised restoration               | Root explicit command PASS1/1: three real post-start fault cases plus normal full33-table/17-migration restore; original pre-repair success retained separately                                                                                                |
| Default Chromium                  | One full117/117 run passed before the booking result-focus repair; affected existing booking/profile projects then passed9/9 after repair. This is retained coverage plus an affected rerun, not another full117 run                                           |
| Firefox/WebKit                    | One final18/18 run passed, nine per engine, with zero retries/skips and every accepted runtime repair present                                                                                                                                                  |
| Performance                       | PASS72 public navigation samples and16 measured conflict pairs, plus separate availability/success/conflict/retry samples; two untimed pair warmups, all ownership/idempotency/one-record/event invariants and cleanup passed                                  |
| Command registration              | Dedicated restore ran successfully; local preflight configuration passed; cross-browser alias discovered18cases/1file; default discovery remained117cases/26files                                                                                              |
| Presentation/privacy              | Worker geometry/keyboard/axe checks and public capture inspection; root also inspected phone/desktop/forced-color public captures. Private-data assertions remain in browser/database suites; bounded actual-config-secret/client scans are recorded privately |

Root executions and worker executions remain separate evidence. Exact command
arguments, exit status, timestamps and source hashes are retained under
`.local/readiness-wave/verification/` in integration and each source worker's
ignored evidence. All270 application/lock/Next-config/runtime-pin files matched
between the measured performance checkout and integration. No remote CI,
Docker restore, hosted provider or real email result is implied.

## Review and repairs

Independent Review A found restore startup could leave its new target running
when a tool-log write failed after PostgreSQL started. The repair records startup
intent and positively identifies the owned process before cleanup. Real starts
followed by injected log-write, nonzero-result and timeout-result failures prove
shutdown and withholding PASS. The timeout result was injected after a real
successful start; an actual120-second timeout was not reproduced. Independent
Review B closed F1 at the repaired hashes.

Two initial combined checks failed an inherited email-focus assertion (759/760
passed in each; isolated8/8 passed). Controlled early-frame tests reproduced the
missing focus on unchanged code. A committed-notice effect replaces one-shot
frame focus. The final Firefox matrix later exposed the same failure class in a
saved-booking heading after retry; three controlled saved/expired/retry cases
failed before its result-focus repair and passed afterward. Existing requests,
retry payloads, uncertainty, expiry, ownership and notice/field focus remain.
The exact frame ordering in the original browser failures was not observed.

Independent Review C found new harness transport exceptions could print a
verification URL or session header through Playwright's reporter. Safe wrappers
now reject with fixed diagnostics, keeping assertions outside the wrapper. A
real installed-SDK regression first proves the raw failure contains generated
proof/cookie values, then proves the projected child still exits1 with those
values absent from its list output. Independent source re-review found F-C1
addressed; the negative regression and final browser matrix passed. Source
re-reviews also covered the two focus repairs, CSS, harness and command changes,
with no other confirmed source finding remaining in those reviewed scopes.

Reviewers performed read-only inspection, not verification. Their reports and
per-file scope hashes are preserved separately as Review A/B/C artifacts; root
owns final coverage reconciliation, factual documentation and acceptance.

Other original failures remain preserved: restore-development attempts, a
performance fixture identity collision before any samples, an auth-only Back
assumption, WebKit30px selects, a Firefox immediate forced-color-to-default
contrast sample, empty browser selection and test/import authoring errors. No
failed full run was relabeled by a focused pass. Stable forced-color modes now
use separate fresh documents with unchanged motion/contrast assertions;
**immediate live mode-switch transition correctness remains unverified**.

## Commands, remaining gates and next action

The explicit `test:restore`, `db:restore:drill`, `deployment:preflight`,
`test:e2e:cross-browser` and `performance:baseline` commands supplement existing
scripts. Read their runbooks and owned-environment requirements first. Default
Docker integration and Chromium CI contracts are unchanged; these operational,
additional-engine and performance commands do not become automatic CI gates.

The complete M8 milestone remains open. Existing dependency findings and ESLint
support risk, hosted auth/database/email wiring, provider operations/domain
verification, human escalation ownership, production recovery policy and target
physical-device/connection measurements still need their respective work.
Commercial, guardian, legal and safeguarding decisions and explicit pilot/public
release approval remain gated. No local success resolves those decisions.

The authorized commit and local merge are complete. Remote publication and safe
worktree/branch cleanup can follow a subsequent instruction. Preserve the seven
wave worktrees and their ignored evidence until that closeout. No database
migration is required by this wave; hosted and real-user launch gates remain.
