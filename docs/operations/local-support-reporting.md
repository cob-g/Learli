# Local fictional support cases

This is a synthetic local demo, not monitored and not an emergency reporting
channel. Real incident responsibility, escalation, safeguarding/consent/legal and
retention remain OPEN. No external messages, email, bookings/meeting joins,
private learner lookup, replies, uploads, automatic moderation or production use.

Active verified synthetic accounts submit at `/contact` or `/report-a-concern`
and see only their cases at `/support`. Assigned preauthorized reviewers see
only assigned cases at `/admin/support`; admin alone grants no access. Requesters
cannot change text/status or see reviewer identities. Reviewers cannot review
their own report. Local status is open → in_review → closed, closed → in_review.

Use the checkout's own `npm run local:setup` with assigned ports and PG 17 tools,
then its private `.local/fixtures.json`. This branch uses PostgreSQL 55454,
development HTTP 3014, browser HTTP 3114; do not reuse another checkout's database.
Pinned dependencies and existing scripts are retained. Migrations `0008` and
`0009` add case records and strengthen event shape checks respectively; the
second is a forward migration preserving the already applied local history.
Coordinator reconciles combined branch numbering later. All new tables are
additive; no existing rows are deleted. For local recovery preserve case/audit
records and use a reviewed forward correction, never a destructive reset.

Trusted owner tooling validates the manifest identity, current verified synthetic
admin role and local database before capability/assignment changes:

```sh
npx --no-install tsx scripts/local-support.ts authorize admin
npx --no-install tsx scripts/local-support.ts assign admin CASE_UUID
npx --no-install tsx scripts/local-support.ts revoke admin
```

Replace CASE_UUID with a real fictional case ID from the local requester page/API.
No case is assigned automatically; there is no blanket queue or self-claim API.
The CLI accepts only a fixture label already owned by the private manifest.
Rerunning authorization/assignment preserves state and adds no duplicate audit;
revoked capability is preserved rather than silently reactivated. Reassignment
to another preauthorized fixture changes the revision and revokes former access.
Capability and assignment changes are auditable and contain no report body.

Server services recheck session, verification/account status, local gate and exact
record access. Case creation uses a requester-owned UUID to deduplicate identical
retries, a technical five-cases-per-five-minutes limit, 120-character subject,
2000-character description and 16 KiB JSON bound. Lists show twenty per page,
with next-page links. Status updates require the current revision; row locks and
transactions ensure one concurrent winner and rollback on event failure. Runtime
DB grants cannot change reviewer capability/assignment, case ownership/text or
delete/overwrite audit. Queries and response history disclose no staff/requester
IDs or unrelated record bodies. These are application boundary controls, not
row-level protection against direct owner SQL.

Local checks: `npm run check`, `npm run test:integration`, `npm run build`,
`npm run test:e2e -- --workers=1`, and
`npm run test:e2e -- --config playwright.support.config.ts`. Browser tests use
only `learli_test`, one worker and no credential-bearing traces/screenshots;
selected synthetic UI captures and logs remain ignored. Exact observed results
are recorded in this branch's tracker and private worker report.
