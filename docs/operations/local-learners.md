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
npm run test:e2e
# Optional focused project; includes its configured prerequisite projects:
npm run test:e2e -- --project learners
```

The standard browser configuration reads APP_URL from `.env.test.local` and runs
all baseline, availability and learner cases. Learner cases run serially after the
other auth work, so test-only throttle cleanup cannot race another suite. No
private copied specs or separate learner configuration is needed.

For a new integration checkout choose unused ports before `local:setup`, e.g.
DB 55442, development HTTP 3003 and browser HTTP 3103; see README. Configuration
and cluster files remain ignored and private. Never copy a source checkout's
credentials or reset/stop another cluster.

The combined migration chain is availability `0006_tutor_weekly_availability`
then `0007_local_learner_profiles`. The original learner branch used its own
0006 in its isolated database on 55434; that database remains unchanged and is
not an upgrade target for the combined chain. Use a fresh database for integration.
Learner SELECT and column-limited UPDATE grants remain in `scripts/migrate-local.ts`.

Real age eligibility, guardian consent/proof, child login and role self-assignment
remain OPEN. FAM-01/FAM-02 and M4.4 are not declared complete for real users.
