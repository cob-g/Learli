# DATA INTEGRITY POLICE — 2026-10-15

Status: complete. One confirmed Medium integrity defect fixed, independently audited and validated.

Work is uncommitted on `cob-g/data-integrity-police-20261015`, based on
`1cab7228c1a6cfa864a7136e2c2e105da4c433d5`. The original `/Users/cob/learli`
checkout, its uncommitted SECURITY POLICE notes and unrelated Claude work were
preserved. No commit, merge, push, deployment or external database/provider
operation was performed.

## Exploration

Twelve GPT-6 Luna **high** investigators were launched: eight domain explorers,
two cross-module investigators and two independent post-fix auditors. One
GPT-6.1 Sol **high** worker independently reproduced and remediated the verified
defect in an isolated checkout. Actual launch receipts confirm the requested
models and effort. At most three workers ran alongside the coordinator.

| Tasks | Coverage                                                                                             | Outcome                      |
| ----- | ---------------------------------------------------------------------------------------------------- | ---------------------------- |
| A     | Booking creation, time zones/DST, retries, expiry, lifecycle, private links                          | No new actionable finding    |
| B     | Learner creation/admission, guardian/self relationships, receipts/history                            | No new actionable finding    |
| C     | Tutor profiles, subjects, languages, discovery, weekly availability/time off                         | No new actionable finding    |
| D     | Transactional delivery, notification intents, leases, retry identity and commit/side-effect ordering | No new actionable finding    |
| E     | Account/identity, access/roles, email, passwords and sessions                                        | LEI-001 verified by Sol      |
| F     | Support, safeguarding, screening, private reviews and publication                                    | No new actionable finding    |
| G     | All 22 schema files, 32 forward migrations, metadata, migration/backup/recovery tooling              | No new actionable finding    |
| H     | Form/API normalization, request identity, stale writes and projections                               | Two contract-dependent leads |
| I     | Learner authority ↔ tutor/catalog/schedule ↔ booking commit/history                                  | No new actionable finding    |
| J     | Independent adjudication of H plus service/DB/support history                                        | Neither H lead promoted      |
| K     | Post-fix provider adapter transaction/create contracts                                               | Accepted; no residual defect |
| L     | Post-fix tests, security flows and cross-module identity relationships                               | Accepted; no residual defect |

Investigators remained read-only and ran no tests, database connections or
provider/browser probes. Their evidence is source-derived; execution evidence
below comes from the implementation worker and coordinator.

Core invariants examined included exact ownership/relationships; atomic account
and domain creation; actor/request/payload idempotency; tutor interval exclusion;
valid UTC intervals and local recurring schedules; revisioned lifecycle/history;
retention/restrictive foreign keys; one current logical booking head; atomic
booking event/outbox creation; stable delivery identity after uncertain outcomes;
and exact migration history plus recoverable schema/data/ACL preservation.
There are no enabled live payments, AI tools, uploads or organization tenancy;
no artificial financial or tenant policies were introduced.

## Findings and triage

Three initial candidate leads were recorded. **One confirmed Medium defect was
remediated.** No confirmed Critical, High or Low defect remains from this sweep.
Two leads were not promoted; they are not represented as fixed bugs.

| Finding accounting                                 | Count         |
| -------------------------------------------------- | ------------- |
| Suspected leads                                    | 3             |
| Confirmed defects, all fixed                       | 1             |
| Unresolved high-confidence defects                 | 0             |
| Intentionally permitted current semantics (H-001)  | 1             |
| Conditional contract limitation, deferred (H-002)  | 1             |
| Other proven false positives                       | 0             |
| Confirmed severity: Critical / High / Medium / Low | 0 / 0 / 1 / 0 |

### LEI-001 — Required account records could fail after signup committed

**Confirmed Medium; fixed.** At baseline,
`src/features/hosted-auth/composition.ts` used `user.create.after` to create
`user_access` and the `account.created` audit in a separate transaction.
Installed Better Auth 1.7.7 queues that hook until after its user/credential
transaction commits. Injected access/audit failure left one user and credential,
zero access and creation audit, and a repeat signup returned the enumeration-safe
200 response without recovery. Session creation requires active access, so the
partial identity was unusable.

The initial 12-case suite failed four cases on original code. The final identical
26-case suite failed ten cases on original composition and passed all 26 with the
fix; additional failing cases cover standalone creation/projection contracts.
This is executed synthetic PostgreSQL proof, not an inferred vulnerability.
Provider verification delivery can already have been attempted inside its
transaction callback; the finding does not depend on an unsent verification email.

`account-adapter.ts` decorates the installed public Drizzle adapter create and
transaction methods. Provider user/credential creation and required access/audit
inserts now share the exact Drizzle transaction. Required failure or later callback
failure rolls back the whole signup. Standalone provider user creation is also
atomic, and selected output preserves its native shape. The native adapter object
and its schema-check registration remain intact. Other methods, roleless signup,
verification, enumeration-safe responses, membership, session, reset, OTP and MFA
controls are preserved. Optional mail failure retains a complete identity.

### DIP-H-001 — Concurrent full profile snapshots

**Not promoted; current full-document semantics.** Separate stale tutor/learner
forms can replace newer values. The approved profile contract currently uses
whole-form replacement and does not establish conflict/merge semantics. Adding a
mandatory profile revision/ETag and 409 workflow changes API/schema/UX contracts.
This remains a possible future concurrency improvement; no guessed policy or
breaking optimistic-lock requirement was introduced.

### DIP-H-002 — Request continuity when browser storage fails

**Conditional local-only limitation; not a confirmed invariant violation.** An
uncertain learner-create response, unavailable session storage and a full reload
can lose the original operation UUID. The same actor/key rule still works; a new
UUID is intentionally a distinct operation, including identical-field siblings.
M4.8 governs booking retries, not learner creation. Stronger cross-reload continuity
would need an explicit token/pending-operation contract. Names/fields were not
made unique, storage was not made mandatory, and existing learners were not merged.
The helper/operations wording is stronger than its optional-storage fallback;
that limitation is retained for follow-up.

No other formal candidate was issued by the initial/cross/audit reports. Existing
0030/0031 isolation fixes were not counted as new work. The earlier provider-blocked
SQL authority investigation remains separately deferred and was not retried or
relabeled as data-integrity work.

## Implementation

One Sol worker completed one root-cause remediation across six application/test/documentation files, correcting one provider transaction boundary. No database migration,
constraint, dependency, business-rule or historical-record change was necessary.

Application/test patch:

- `src/features/hosted-auth/account-adapter.ts`: new focused transaction adapter.
- `src/features/hosted-auth/composition.ts`: use it; remove required after-commit provisioning.
- `tests/integration/signup-atomicity.test.ts`: 26 focused regressions, 13 per composition mode.

The coordinator updated this report, `context/architecture.md` and
`context/progress-tracker.md`. No unrelated application files were changed.
The exact three-file patch is bound by SHA256 in the private evidence manifest.

## Validation

| Check                                                                                        | Observed result                                                                                                                        |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline `node scripts/with-test-env.mjs npm run check`                                      | PASS: formatting, lint, strict types; 1,648 tests / 112 files                                                                          |
| Worker original/fixed final regression suite                                                 | Original: 10 failed / 16 passed; fixed: 26 passed                                                                                      |
| Worker unit/component, strict types, scoped lint/format                                      | PASS                                                                                                                                   |
| Integrated `node scripts/with-test-env.mjs npm run check`                                    | PASS: formatting, lint, strict types; 1,648 tests / 112 files                                                                          |
| Integrated production build through test environment wrapper                                 | PASS                                                                                                                                   |
| Final permitted PostgreSQL integration selection                                             | PASS: 930 tests / 63 files, 386.71s; five truncating suites excluded                                                                   |
| Existing real backup/restore test, separate clean source, baseline and exact fixed candidate | Both PASS: 79 tables, 32 migrations, 65 populated tables; exact rows/schema/grants/sequences/roles and source preserved                |
| Independent post-fix Luna audits                                                             | K and L accepted; no residual defect                                                                                                   |
| Final diff, source freeze and protected user-work checks                                     | PASS: clean diff; exact tested app/test hashes; 1,207 unrelated integration files and all 1,210 original user-checkout files preserved |

The full baseline permitted PG selection initially passed 896 tests in 61 files;
the eight-test native-TLS suite stopped in setup because its evidence directory
was absent. Creating that owned private directory and rerunning the unchanged
suite passed all eight. No application/test code was changed for this setup issue.

A first restore attempt after mixed negative integration fixtures failed before
its expected failure-evidence stage: one intentionally invalid non-.test address
remained in that synthetic database, and the existing restore guard refused it.
No record was repaired/deleted and no guard was weakened. A separate newly owned
synthetic source then passed the unchanged restore test before and after the fix.

The worker retained intermediate generic/test-API type errors and synthetic
MFA/email request-bucket 429s; final corrections only adjusted types and isolated
test request identities. Final worker checks passed with application controls
unchanged. Baseline/final unit runs emit the same three jsdom navigation notices.

Five existing suites use TRUNCATE and were deliberately not executed:
`auth`, `availability`, `teaching-languages`, `time-off`, `tutor-catalog`.
The generic browser setup also truncates fixtures, so no browser/E2E acceptance is
claimed. Existing nontruncating suites and the new auth regressions cover related
boundaries, but do not replace those omitted tests. Hosted composition ran against
owned loopback PostgreSQL/in-memory Requests; this is not new deployed TLS/ingress,
Neon or real email-provider acceptance. No dependency versions changed; no new
dependency audit or production compatibility claim is made.

## Existing data and residual risk

The fix prevents future partial signup state. No customer/deployed rows were
inspected and no historical repair was performed. Historical owner fixtures can
intentionally lack application access/audit, so missing rows alone do not prove a
failed signup. If an operational reconciliation is needed, first authorize a
provenance-aware read-only assessment of supported signup identities, compare
user/credential/access/audit state, and review each discrepancy. Any repair needs
a separately authorized, transactional, auditable plan; do not infer roles,
verification, credentials or historical events, and do not delete identities.

Real learner admission/guardian consent, tutor screening, human safeguarding,
commercial booking, payment and launch gates remain unchanged. The two unpromoted
contract questions and the earlier unrelated security/browser-harness issues
remain separate follow-up work. Deployed catalog/grants, real-provider failure
behavior and production recovery require authorized environment-specific evidence.

## Evidence and resources

Private evidence: `/tmp/learli-data-integrity-police-20261015/` contains each launch
receipt and Luna report, Sol red/green logs/report, findings ledger, baseline/final
commands, source hashes, migration/restore proofs and resource/preservation checks.
Do not publish its private database/capture artifacts.

All 13 agent tasks succeeded and their supervised terminals were released after
accepted reports; zero reclaimable worker terminals remain. Worker PostgreSQL56065,
clean restore-source56067/target56068 and final integration PostgreSQL56061 are
stopped with private data retained. All owned listeners are closed, including
TLS56063; all owned postmaster PID files are absent. Only newly owned loopback
test databases were migrated; original local development/test databases and all
external systems were untouched. The stopped implementation/proof checkouts and
branches remain for later version-control cleanup; this operation did not commit
or merge the change.
