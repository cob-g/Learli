# Controlled staging database preparation

This is local code preparation for M2.2/M8.1/3/4/8 and NFR-05/06/09/11.
It preserves the local simulation schema and all reviewed0000–0016 SQL/journal
bytes. The application still has only disabled/local authentication; full hosted
deployment preflight remains BLOCKED. No Neon resource has been inspected,
created, migrated or verified by this preparation wave.

The runner uses the existing pinned node-postgres/Drizzle stack, a separate
staging configuration/connection boundary, and the unchanged local runtime grant
policy. It does not provision roles, widen privileges, seed data, reset a target,
run a down migration, or migrate on application startup. Local setup, seed,
restore and ordinary tests remain loopback-only. Keep migration credentials out
of application environments.

## Operator packet and authorization

Before a provider operation, root/operator must complete and approve a private
packet containing these fields. None is supplied by this runbook:

| Field           | Required evidence / unresolved state                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Target          | Exact Neon project, branch, direct endpoint, database and roles; **UNSELECTED**                                               |
| Isolation       | Provider-account verification of dedicated synthetic staging, distinct from production; **NOT RUN**                           |
| Operator        | Named authorized operator, approval record and incident/recovery responsibility; **UNASSIGNED**                               |
| Cost scope      | Resource plan, bounded purpose/usage and approved budget; **UNRESOLVED**                                                      |
| Candidate       | Frozen reviewed source/package/lock/SQL/journal/grant SHA256 manifest, observed checks and independent review                 |
| Operation       | Explicit read-only inspect or deliberate apply on this exact target, expected pending hashes and grant refresh                |
| Recovery        | Provider capability and retained verified restore-point/backup references for a populated target; **NOT RUN**                 |
| Stop conditions | Target/history/candidate drift, incompatible extension/privileges, failed protections/grants/probes or unknown partial result |

An operator target record is an attestation, not independent proof of provider
ownership or permission to execute. The user must separately authorize external
operations on that completed packet. Production targets are refused. Real
identities, customer records, mail, Railway deployment and launch remain outside
this package.

## Private input files

Use explicit JSON files beneath this checkout's ignored `.local`. All parent
directories must be owned by the current OS user and mode0700; files mode0600,
regular, <=64KiB, without symlinks. The tool loads no dotenv files and uses no
inherited connection-variable fallback. Secrets never appear in output. Use the
connection boundary's exact accepted target format (`ApprovedStagingTarget` v1)
defined in `src/lib/db/staging-config.ts`; obtain actual fields from the
authorized operator rather than replacing placeholders blindly.

The configuration has exactly these keys, with credentials supplied privately:

```json
{
  "APP_ENV": "staging",
  "STAGING_DATABASE_URL": "REPLACE_WITH_RESTRICTED_DIRECT_NEON_URL",
  "STAGING_DATABASE_URL_DIRECT": "REPLACE_WITH_MIGRATION_DIRECT_NEON_URL"
}
```

The target file must contain the following shape. `UNSELECTED`, `UNASSIGNED` and
an empty purpose list are intentionally invalid: this template cannot authorize
or open a connection. Fill it only from the separately approved operator packet;
use ISO timestamps and only the purposes actually authorized.

```json
{
  "version": 1,
  "provider": "neon",
  "environment": "staging",
  "projectId": "UNSELECTED",
  "branchId": "UNSELECTED",
  "endpointId": "UNSELECTED",
  "hostname": "UNSELECTED",
  "database": "UNSELECTED",
  "runtimeRole": "learli_app",
  "migrationRole": "UNSELECTED",
  "approvedPurposes": [],
  "operatorApproval": {
    "approvalId": "UNASSIGNED",
    "approvedBy": "UNASSIGNED",
    "approvedAt": "UNASSIGNED",
    "providerVerifiedAt": "UNASSIGNED",
    "isolation": "dedicated-synthetic-staging"
  }
}
```

The runtime role is exactly `learli_app`, separate from the exact migration role.
Both URLs must match the selected target's direct Neon hostname, database and
role, port5432 and verified TLS. Only the connection parser's explicit permitted
URL settings apply. No loopback fallback or production exception exists.

Provisioning is separate: the operator must establish `learli_app` before the
historical chain references it, restrict its attributes/memberships, grant only
database CONNECT and avoid public schema/database CREATE. Migration identity
must own application objects and have database/schema CREATE, SQL/plpgsql usage,
and capability for the available trusted `btree_gist` extension. The tool checks
prerequisites; it does not silently acquire administrative rights or replace SQL.
Runtime checks reject any effective SET/ALTER SYSTEM parameter ACL, including
PUBLIC grants, and require actual origin replication mode before callbacks and
probes. Inspection/migration sessions must also use origin mode. The grant audit
rejects delegation options on inspected columns, tables, functions, public
schema and database rights; the original runtime policy grants none. Unexpected
capabilities require deliberate operator recovery, not an automatic escalation.

## Deliberate commands

Invoke the registered `staging:database` script (or the installed
`node --import tsx scripts/staging-database.ts` entry point). These examples are
operator instructions, **not authorization or commands executed on Neon**:

```sh
npm run staging:database -- inspect-config --config .local/staging/config.json --target .local/staging/target.json
npm run staging:database -- inspect --config .local/staging/config.json --target .local/staging/target.json
npm run staging:database -- plan --config .local/staging/config.json --target .local/staging/target.json --out .local/staging/plan.json
npm run staging:database -- apply --config .local/staging/config.json --target .local/staging/target.json --plan .local/staging/plan.json --plan-hash EXACT_RETURNED_PLAN_SHA256
```

- `inspect-config`: validates explicit file/target inputs only. The underlying
  pure configuration primitive performs no I/O; CLI reads the selected files,
  with **no network/database I/O**, journal reads or output-file writes.
- `inspect`: explicit read-only target transaction, TLS/current identity through
  the connection layer, complete ordered journal/hash prefix, schema ownership,
  migration prerequisites and exact custom protection checks. Fully migrated
  targets also verify effective runtime grants and separately connect restricted
  credentials. Partial targets report grants **NOT VERIFIED**; inventory is not
  hosted application readiness.
- `plan`: read-only target inspection and a new private output file. Existing
  output paths are refused. Plan binds exact target attestation fingerprint,
  source/package/lock/grant/SQL/journal candidate digest, entire prior history,
  schema/ACL/function/trigger digest, empty/populated state and pending hashes.
  Grants may need repair; plan does not assert grants are currently correct.
- `apply`: requires exact plan hash. It acquires a nonblocking session advisory
  lock, refuses simultaneous runners, rechecks candidate/target/history/schema
  under that lock, runs captured migration statements through the pinned Drizzle
  migrator on that same client, refreshes grants transactionally, verifies
  effective column/table/function rights and probes actual restricted credentials.
  The lock spans every stage. Both pools close and checked-out clients are
  destroyed; no retained session lock or transaction survives normal cleanup.

The runner accepts only exact known history prefixes; unknown, reordered,
divergent or newer target history and unrecognized schema fail closed. It checks
stored custom function bodies/security/search paths, enabled protection triggers,
and exact deparsed booking source/state/finite-interval/expiry/exclusion definitions.
SQL and source changes require a new plan. Checks cover these protections, not
every possible provider extension or all application business acceptance.

A no-pending rerun records migrations `unchanged`, while deliberately refreshing
and verifying the same grants. It creates no application records and sends no
mail. Runtime probes read no private rows and use rollback-only transactions:
permitted no-op update plus actual permission-denied schema/role/protected
column/history mutations and three deliberately invalid source/state/interval
booking inserts rejected by actual CHECK constraints. Owner credentials cannot
supply runtime proof.
Local normal integration tests additionally exercise actual booking overlap and
permission/ownership behavior; provider concurrency remains separate evidence.

## Populated target recovery gate

Every nonempty applied history is conservatively treated as populated, even if
only reference rows exist. Before an upgrade, pass `--recovery` with a private
strict record containing `version:1`, the exact `targetHash` and `planHash`,
`restorePointReference`, `verifiedRecoveryReference` and `operatorApproval`.
The operator must retain actual evidence of provider recovery capability and a
verified backup/restore point elsewhere privately. The JSON is an attestation;
the runner cannot infer that a provider backup exists or a restore was rehearsed.
No recovery record is needed for an empty target or migration no-op.

## Receipts and failure response

Exit0 means the explicitly requested operation passed; exit1 means failure.
JSON contains fixed categories, SHA256 digests/counts and bounded stage outcomes,
never connection strings, raw SQL errors, private rows or stack traces. Keep
receipts/evidence private. A successful local test is not a Neon receipt.

Apply receipts distinguish migrations not-started/unchanged/committed/unknown,
grants not-started/committed/rolled-back/unknown, runtime not-run/pass and cleanup.
Installed Drizzle creates its journal schema/table before its transaction; a
failed fresh migration may leave empty metadata while application DDL rolls back.
A migration commit followed by grant/probe failure is partial, never success.
Connection/COMMIT/cleanup loss may leave an unknown outcome. Stop dependent work,
preserve evidence and inspect actual target journal/transactions under renewed
operation authority before retrying. Never reset, drop history, issue a down
migration or assume a code rollback reverses database changes. Restore first to
a separate approved target and verify data/schema/grants before any cutover.

## Evidence and remaining gates

Builder evidence and exact failures/commands/source hashes live in ignored
`.local/staging-database-wave/report.md` and `manifest.json`; root retains combined
independent review and verification separately. No UI changes are involved.
Actual Neon TLS/resource identity/effective roles/extension/migration/transaction/
runtime-concurrency/recovery checks are **NOT RUN** until the named provider
rehearsal is separately authorized and observed. Hosted auth/email, deployment,
dependency exposure review and all commercial/guardian/safety/launch gates remain.

Implementation references: [Drizzle migrations](https://orm.drizzle.team/docs/migrations),
[node-postgres transactions](https://node-postgres.com/features/transactions),
[PostgreSQL session advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html).
Installed Drizzle0.45.4 was inspected directly; later upgrades must recheck this
narrow typed migration adapter and rerun fresh/populated/failure/lock tests.
