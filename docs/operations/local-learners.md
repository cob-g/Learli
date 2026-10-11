# Local synthetic learner profiles (M4.4)

This slice supports fixture-provisioned list/detail/edit only. It does not enable
real learner onboarding, self-service profile creation, guardian proof, child
logins or bookings. Do not enter real learner data.

After setting up an **isolated local development and test database** and applying
this branch's migrations, provision the existing trusted account fixtures and
then the learner fixtures:

```sh
npm run db:seed
npx --no-install tsx scripts/seed-local-learners.ts
```

The learner seed verifies each account against `.local/fixtures.json` and the
stored synthetic account identity and role. It creates two profiles for the
parent fixture, one for the multi-role fixture, and one self-managed College
Support profile for the student fixture. Reruns preserve edits, inactive profiles
and revoked relationships; they never adopt an arbitrary account or learner.
Private credentials remain in `.local/`; use the existing `fixtures:open` command.

Sign in, open the Parent or Student workspace from Account settings, then choose
**Your learners**. `/learners` lists only authorized active profiles. Each edit
page accepts display name, level and time zone; the independent profile stays at
College Support. An empty list means no authorized profiles are available.

The API exposes `GET /api/learners`, `GET /api/learners/[learnerId]` and
`PATCH /api/learners/[learnerId]`. IDs are opaque references, never access grants.
The application database role cannot create/delete profiles, write guardian
links or change ownership, status, fixture provenance or fixture identifiers.
Trusted fixture provisioning is not real-world eligibility or consent evidence.

## Verification and parallel worktrees

```sh
npm run check
npm run test:integration
npm run build
npm run test:e2e -- --config playwright.learners.config.ts
```

The dedicated learner browser config reads `APP_URL` from `.env.test.local`,
requires local test mode and starts its own server with reuse disabled. This
worktree used DB **55434**, development HTTP **3002**, test HTTP **3102**. Its
`.env*` and `.local/` files are private and ignored. Do not copy another worktree's
credentials, run the baseline fixed-port `local:setup` blindly, or reset/stop
another worktree's cluster. Existing regression browser specs contain fixed-port
3100 references; this run used ignored copies changing those references to 3102.

Migration `0006_local_learner_profiles` and its journal/snapshot must be reconciled
with the independently developed availability migration before combining branches.
Preserve the learner SELECT and column-limited UPDATE grants in
`scripts/migrate-local.ts` when reconciling that shared file. Apply no migration
from another branch to this worktree's databases.

Real age eligibility, guardian consent/proof, child login and role self-assignment
remain OPEN. FAM-01/FAM-02 and M4.4 are not declared complete for real users.
