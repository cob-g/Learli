# Staging database code preparation — 2026-10-12

Status: **AUTHORIZED — build-feature delegation; locally verified code preparation**.

The user requested execution of the proposed staging database foundation wave:
“ok lets proceed on the current wave lets do that”. This authorizes two builders,
coordinated local verification and independent review under
`prompts/features/m8-03-staging-database-foundation.md`. It is execution authority,
not a claim that the user separately inspected a detailed implementation.

Prepare a separate staging-only Neon configuration/connection boundary using the
existing Node PostgreSQL and Drizzle driver, plus deliberate target inspection,
migration planning/application tooling and restricted runtime-grant checks.
Use certificate and hostname verification, exact operator-approved target
binding, separate runtime/migration identities and private sanitized evidence.
Existing local setup, fixtures, auth, mail capture and restore tooling retain
their loopback restrictions. Existing SQL history and simulation states remain.

The 2026-10-11 local-M2 decision remains the authority for the current application
runtime. This bounded extension permits preparing future staging tools; it does
not activate hosted auth or authorize a provider connection. No generic change to
local environment validation, database routing or hosted application behavior
is part of this decision. Maintain one Node application and the existing drivers.

Alternatives considered: weakening the local URL parser would blur test/production
separation; switching drivers would add avoidable transaction compatibility work;
combining auth, email and deployment would widen this slice before its database
prerequisite is verified. The separate tooling path keeps those dependencies clear.

No cloud resource, target identity, cost budget or human operator is invented.
Before any cloud operation, finish a concrete packet for the named isolated
resource, reviewed SQL/target identity, exact mutations, recovery and stop
conditions, and obtain the operation authority that is still missing. Production,
real-user onboarding, payments and launch remain outside this code-preparation
request. Permission to implement the runner is not permission to run it remotely.

Acceptance requires meaningful local TLS/permission/migration failure tests and
independent review of the frozen candidate. Actual Neon/TLS/role/migration checks
remain NOT RUN until separately executed on an authorized target. Evidence and
remaining work belong in `context/progress-tracker.md`; this decision is not a
verification result or release approval.
