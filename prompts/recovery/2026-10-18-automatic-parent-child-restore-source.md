# Learli Recovery — Automatic child restore acceptance source

- Status: APPROVED FOR HANDOFF under AUTHORIZED — build-feature delegation
- Mode: Targeted Fix (isolated verification-source preparation)
- Environment: owned loopback `learli_test`; ordinary `learli_dev` and app are excluded.
- Related scope: M4.4 automatic parent child onboarding, M8 backup restoration.

## Expected versus observed

The real restoration suite should progress through its intentional missing-tool
failure, record private failure evidence, then perform the fresh restoration.
The 2026-10-18 run instead failed while reading the expected `failure.json` after
3.59 seconds. Its broad rejection assertion had matched an earlier drill refusal.
Original evidence remains in `.local/automatic-children-20261018/restore.log`.

## Evidence and diagnosis

Read-only inspection of the exact guarded `learli_test` source showed 38 migration
ledger entries while the current journal has 39. The new guardian attestation table
was absent. Both `acceptedTableInventory` and `assertSyntheticSource` correctly
rejected the stale schema (`table-inventory`, `provenance-coverage`) before the
drill creates its per-run directory. Therefore no expected missing-tool failure
artifact existed. The missing artifact is the symptom; stale test-source schema is
the cause. The passing integration migration tests use separate disposable targets
and do not establish that this primary restoration source is migrated.

## Protection and recommendation

Preserve all operating data, app processes, ordinary-mode refusal, source provenance
rules, restore ownership checks and failed-attempt history. No source code repair,
reset or policy change is warranted. The separate implementation/verification owner
should apply reviewed migration0038 and exact runtime grants only to the already
owned `learli_test`, confirm 39 exact ledger receipts and current empty attestation
schema, then rerun `LEARLI_RESTORE_PORT=55812 npm run test:restore` with a new target.
Do not migrate or reset `learli_dev` as part of this recovery.

## Outcome separation

Recover performed read-only diagnosis and wrote this note. It performed no schema,
data, runtime, implementation or verification changes. Root coordinates separate
source preparation and verification under the existing authorized feature run.
