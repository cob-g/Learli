# Eight-area local workflow verification

Date: 2026-10-13. Candidate: `cob-g/m8-hosted-workflows-integration`, based on
`2fa0294c5e6cad895754b3c10a703a6c6f6ef00a`, uncommitted. Scope: W1–W8 in
`prompts/features/m8-10-hosted-workflows-wave.md`, migrations0000–0028.
This report excludes the separate Neon activation delta.

| Check                                        | Observed result                                                             | Private evidence under `.local/hosted-readiness-wave/`                   |
| -------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Format, lint, types, unit/component          | PASS; 1,304 tests/81 files; one inherited lint warning                      | `root-final-check-5.log`                                                 |
| Final format, lint, types after test repairs | PASS; same warning                                                          | `root-final-static-1.log`                                                |
| Actual PostgreSQL full suite                 | PASS; 889 tests/59 files                                                    | `root-final-pg-2.log`                                                    |
| Added delivery recipient variants            | PASS; 2 selected cases, 21 deselected                                       | `root-delivery-variants-pg-1.log`                                        |
| Production build after application repairs   | PASS                                                                        | `root-final-build-3.log`                                                 |
| Full normal Chromium                         | PASS; 171/171, 7.0 minutes                                                  | `root-final-chromium-3.log`                                              |
| Affected Firefox/WebKit                      | All 32 distinct cases covered across separate runs; no single 32-pass claim | `root-final-cross-browser-1.log`, `root-publication-cross-browser-3.log` |
| Through0028 populated restore                | PASS; 79 tables, 66 populated, 29 stamps                                    | `root-final-restore-3.log`                                               |
| Production output tracing                    | 132 manifests; zero private references                                      | `root-private-trace-after-2.json`                                        |
| Current text privacy scan                    | PASS; 2,980 patterns, 2,899 files, 402 audit rows; zero hits                | `root-provider-privacy-scan-final-v2.json`                               |
| Browser mirror applicability                 | PASS; combined436/5 declared substitutions, admission430/1; zero drift      | `root-final-mirror-applicability.json`                                   |

The full PostgreSQL run and the additional two recipient variants are separate
executions. Earlier hosted HTTPS evidence passed seven cases in each of Chromium,
Firefox and WebKit; the production-only package installation/start, disabled-ingress
403, clean shutdown and production-mode refusal were also observed. These provider
foundation results remain scoped to their accepted source and are not Neon cloud
acceptance. Remote CI was not run. Thirteen dependency advisories remain inherited.

The strict combined browser journey is included in the full Chromium result. It
covers new guardian/tutor admission, screening, discovery continuation, booking,
SDK notices, administrative outcome, public review, safety restriction and exact
old-case Back/account-switch privacy. Policy-enabled tests use isolated source
mirrors with only explicitly declared capability factories substituted. Actual
source/pins/assets match; shipped real-policy factories remain disabled.

Restore evidence includes exact row/catalog/grant/sequence/role equality, source
preservation, 14 immutable histories plus prepared-delivery immutability, five runtime
denials and rejection of a real CHECK-constraint change. Text privacy scanning uses
current owned raw/URI/JSON credential patterns across Git-visible source, build
assets, captured HTML, reports, logs and audit data. It does not perform OCR or
establish absence of deleted credentials or secrets in every image pixel.

Earlier failures were retained, diagnosed and repaired under
`prompts/recovery/2026-10-12-root-hosted-integration.md`. The last four repairs cover
migration-restore collection/canonicalization, isolated admission composition,
shared synthetic fixture identity/MFA observation and collision-free historical
publication fixtures. Business and privacy assertions were preserved.

Final independent combined review passed plan alignment and unintended-change
audit with zero open Critical, Important or Minor findings. Root accepted the
settled reviewer and released its terminal. The reviewed source is final v2 plus
heading overlay v12 (effective aggregate
`628af7011b38330c226d4908785947f7b36219c720964fce28119d34a9ae21e7`);
post-review edits only record this disposition in the three status documents.
Private accepted report: root `.local/hosted-readiness-wave/final-combined-review-accepted/report.md`.
The reviewer checked source, evidence and actual mirror copies, and executed no checks.
This local verification does not enable real users, approve consent/booking/review
policies, provide staffed safeguarding, send live mail or deploy the application.
Payments remain paused. Commit, merge and push are separate actions.
