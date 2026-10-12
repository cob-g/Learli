# Private synthetic review demonstration

Local M5.10 / OPS-06 demonstration only; AUTHORIZED — build-feature delegation.
Every review is private. No public tutor page, aggregate, review editing/deletion,
real attendance or customer review policy is enabled. Ratings1–5, optional trimmed
plain text up to1000characters; pending can become locally approved/rejected, and
an explicit reconsideration returns either decision to pending. No direct flip.

Use only this checkout's generated `.env.local`, owned loopback `learli_dev`
cluster and `.local/fixtures.json` fixture identities. Do not copy peer state or
change roles. Existing synthetic family/learner/tutor offering must be current.
The owner CLI never sends email, contacts providers or prints private content.

1. Run pinned `npm ci`, then owned local setup with assigned ports. In this worker:
   `LEARLI_DB_PORT=55815 LEARLI_DEV_PORT=3085 LEARLI_TEST_PORT=3185 npm run local:setup`.
   Integration commands also set `LEARLI_STAGING_TEST_PORT=55715`.
2. Find the synthetic learner UUID through the authorized `/learners` page, tutor
   fixture label through the local fixture manifest, and actual offered subject slug.
   Seeded family labels include `parent`; use an actual approved synthetic tutor.
3. Generate one request UUID and keep it. For an explicit demonstration, use actual
   past ISO UTC instants exactly60minutes apart, for example October10,2026
   12:00–13:00UTC after that date has passed. Substitute exact owned inputs:

   ```sh
   npx tsx scripts/local-private-reviews.ts prepare-history parent tutor-1 <learner-uuid> math 2026-10-10T12:00:00Z 2026-10-10T13:00:00Z <stable-request-uuid>
   ```

   `tutor-1` is an example label; use the label actually in this checkout manifest.
   The command checks owner/manifest/current family/learner/tutor/subject/level,
   locks tutor and preserves original instants plus10minute creation TTL. It creates
   one immutable synthetic booking with normal creation audit, then calls accepted
   owner-only completion in a separate transaction. No clock override or existing
   booking date mutation. If completion is uncertain, preparation stays recorded;
   repeat the identical command/request UUID to retry the same booking. Changed
   payload is refused; no duplicate is created. A later ineligible/expired state
   stays refused, with existing data preserved for diagnosis. Do not choose a new
   key to conceal uncertainty. `complete-ended <booking-uuid>` can retry completion
   of an existing ended owned fixture; it never changes its dates.

4. Open the printed loopback `/bookings/<id>/review` URL as the currently authorized
   family fixture and save synthetic rating/text once. Submissions are immutable;
   current author/learner/relationship authority is required even for reading/retry.
   Other guardians, tutors and generic admins cannot read the submitted content.
5. Run `npm run db:seed` in the owned development environment to add the distinct
   `review-moderator` admin fixture, then provision its narrow capability and exact
   review grant explicitly (the seed grants neither):

   ```sh
   npx tsx scripts/local-private-reviews.ts authorize review-moderator
   npx tsx scripts/local-private-reviews.ts grant review-moderator <review-uuid>
   ```

   The review UUID can be obtained from the authorized POST result or by an owner
   SELECT of its ID for that booking; do not export content. Then open
   `/admin/reviews` as that exact moderator; the queue contains only exact grants.
   Capability alone or admin role alone grants no review. Local approved/rejected
   states remain private. Use explicit revision guarded forms and reload stale tabs.

6. `revoke-grant review-moderator <review-uuid>` or `revoke review-moderator` removes that narrow access;
   owner tooling records minimal append-only provisioning history. Restoring uses
   the explicit grant/authorize command. No self/tutor grant or runtime provisioning.

Mutation forms require JavaScript and use disabled POST fallback with a visible
explanation. Protected SSR reads work without JavaScript. A lost response can be
retried with the same request/payload; differing/stale requests are refused. Every
web boundary authenticates and validates same-origin/bounded JSON; no secret,
learner name or review content is placed in a URL.

Schema: additive integration0020 (worker isolated0018), five new private tables, supported
metadata and immutable review/provisioning audit triggers. Runtime obtains SELECT
on minimal review tables and EXECUTE only on submit/moderate functions; no direct
feature table writes/capability grants. SECURITY DEFINER bodies use fixed pg_catalog
search path and qualified public relations. No0000–0017 SQL rewrite. Disable routes
for rollback; preserve private records. Root owns final migration metadata/grants/
schema export/test registration/navigation and combined acceptance.

The authorized family can also open Add/View private synthetic review from the
current completed fixture booking detail. The admin workspace links to private
review scope; the link itself grants no access. To reconsider a local decision,
return approved/rejected to pending before selecting a new decision. Nothing is
published at any step.
