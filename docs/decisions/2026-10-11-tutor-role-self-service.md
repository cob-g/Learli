# Self-service tutor role

Decision date: 2026-10-11. Status: Approved. Owner and approver: the repository
owner, in the M3 build session.

## Decision

Any signed-in, verified, active account may press "Start tutor application" on
`/become-a-tutor`. The server then gives that account the `tutor` role. The role
only lets the account manage its own tutor application. A tutor is never public
or bookable until an admin approves the application.

## Why

The product documents describe a tutor registering and then being reviewed. The
role is an account type; approval is the safeguard. One sign-up form stays
enough for everyone.

## Alternative considered

An account-type choice on the sign-up form. Deferred to M4, because it also
decides how student and parent roles are granted, and parent accounts depend on
the undecided guardian-consent policy.

## Impact

- The application can now grant exactly one role, `tutor`, through a database
  function that cannot grant anything else. It still cannot write `user_roles`
  directly, and no path grants `admin`.
- Each grant is audited as `tutor_role.self_granted`.
- This supersedes, for the tutor role only, the M2 statement that roles come
  solely from fixture tooling. New accounts still start with no role.
- Local synthetic accounts only. This is not public enrollment, and the tutor
  screening policy remains open.

## Tests

`tests/integration/tutor-catalog.test.ts` and `tests/e2e/tutor-catalog.spec.ts`.
