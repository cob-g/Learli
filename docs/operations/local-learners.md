# Local synthetic learner profiles (M4.4)

This local flow supports authorized list/detail/edit plus minimal fictional
profile creation for existing verified, active synthetic parent/student accounts.
It does not establish real learner eligibility, guardian proof, consent or child
login. Do not enter real learner data.

At `/learners/new`, a parent creates a new profile and its own guardian link
atomically. A student creates only their own College Support profile. There is no
arbitrary existing-learner linking or role acquisition. Creation uses a stable
request UUID: an identical retry recovers the same profile after current
permission checks, while a changed payload conflicts. Same-name siblings are not
automatically merged. Parent runtime creation is capped at20 profiles per actor;
trusted seed fixtures do not consume that technical demonstration cap.

The learner list and empty booking/dashboard states link to creation. A valid
public selected tutor/subject/level/time is retained through creation and the
success page offers a return link; it never places learner data in the URL.
Forms require JavaScript for mutations; awaited server pages still support native
list/detail reads. The older owner fixture seed below remains optional.

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

The API exposes `GET|POST /api/learners`, `GET /api/learners/[learnerId]` and
`PATCH /api/learners/[learnerId]`. IDs are opaque references, never access grants.
The application database role has no direct profile/link INSERT permission;
creation uses a narrowly validated database function with an immutable creation
receipt. It cannot delete profiles, arbitrarily link learners or change ownership,
status, fixture provenance or fixture identifiers.
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

Apply the complete reviewed forward migration chain from this checkout. Preserve
historical migrations and do not import another worktree's applied journal or
credentials. The runtime grant policy lives in `scripts/runtime-grants.ts`;
creation adds its narrow function execution permission without raw link writes.

Real age eligibility, guardian consent/proof, child login and role self-assignment
remain OPEN. FAM-01/FAM-02 and M4.4 are not declared complete for real users.
