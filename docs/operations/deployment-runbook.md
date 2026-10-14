# Deployment preparation and release gates

This runbook supports M8.1/M8.3 and NFR-11. It describes the inspected local
application and the isolated eight-area readiness candidate; current source and
verification status are recorded in the progress tracker. It is an operator checklist.
It authorizes no provider creation, deployment, DNS/variable change, migration,
real user, external email or public release. Current execution evidence belongs
to the progress tracker and the private worker report, not this procedure.

## Current capability and deployment gap

| Area       | Actual repository behavior                                                                                                        | Consequence                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Runtime    | Node `.nvmrc` pin and npm `packageManager` pin; one Next.js Node app                                                              | Use the accepted package/lockfile pair and matching runtime                                             |
| Build      | `npm run build` runs `next build`; no standalone output in `next.config.ts`                                                       | Serve the normal `.next` build with `next start`; keep `public`, dependencies and build output together |
| Start      | `npm start` runs `next start --hostname 127.0.0.1`                                                                                | Safe local default; unsuitable for Railway ingress without an explicit service start command            |
| Health     | `/api/health` returns HTTP200, `{ "status": "ok" }`, `Cache-Control: no-store`                                                    | Process liveness only; no DB/auth/mail/booking or release-readiness proof                               |
| Auth       | `AUTH_MODE` supports disabled/local and explicit staging hosted-synthetic accounts                                                | Hosted mode needs an exact private validated packet, HTTPS ingress and selected synthetic accounts      |
| Local auth | development/test APP_ENV, loopback HTTP origin, matching auth origin, restricted dedicated local DB, synthetic `.test` identities | Never enable it in staging/production or expose synthetic identities publicly                           |
| Database   | `createDatabase` uses `localDatabaseConfig`: loopback, no URL query/fragment, `learli_dev`/`learli_test`, TLS disabled locally    | Local adapter rejects Neon; separate guarded hosted pool requires approved target/TLS/runtime identity  |
| Mail       | Local capture plus pinned Resend transport and explicit hosted account callback binding                                           | Verified sender, authorized recipient/configuration and provider acceptance remain required             |

There are two separate readiness decisions: a **shell-only Node process** with
auth disabled and no integration configuration, and an **authenticated hosted
marketplace**. The latter is blocked pending a separately authorized hosted
provider/ingress/mail acceptance and applicable launch decisions. A public
shell still requires separate deployment authorization and accurate content.
Do not bypass the local guards to make a hosted smoke test look complete.

## Prepared hosted-synthetic account entry

The separate W2 guarded pool revalidates target, TLS, effective role and session
safety for application leases. W3 adds explicit staging-only hosted-synthetic
accounts, mandatory admin assurance and pinned W4a mail transport. See
[w2 runtime](w2-hosted-runtime-provider.md), [w3 auth](w3-hosted-auth.md) and
[w4a mail](w4a-resend-provider.md) for exact packet, ingress, recipient and safe
failure contracts. Hosted account support does not activate unrelated local-only
tutor/learner/booking/support domains.

The optional start:hosted command serves the normal Next build through the
reviewed Node ingress entry; select HOSTNAME and PORT deliberately. It requires
a private HOSTED_AUTH_CONFIG_FILE, separate HOSTED_INGRESS_SECRET and exact
HTTPS/peer-header contract. Neither local setup nor startup migrates a hosted DB.
Local HTTPS and production-dependency packaging rehearsals are software evidence,
not proof of Railway isolation, Neon role provisioning or real mail delivery.
Default-denied policy factories and the hosted preflight release block remain.

## Separate staging database preparation

The M8.3 code-preparation wave adds separate operator tooling described in
[staging database operations](staging-database.md). Its explicit private JSON
configuration uses `STAGING_DATABASE_URL` for the restricted runtime role and
`STAGING_DATABASE_URL_DIRECT` for the migration owner. It requires an exact target
attestation and verified TLS. It does not alter the application adapter or local
setup/seed/restore guards, enable hosted auth, or run migrations on startup.

Configuration-only inspection performs no network I/O. Target inspection and
planning require named-resource operation authority; applying a plan additionally
requires its exact hash and applicable recovery evidence. Code preparation and
local tests are distinct from an observed Neon rehearsal. The current wave's
review and verification status is in the progress tracker; this procedure does
not imply that either has passed. `--mode hosted` remains exit 2/BLOCKED because
the authenticated hosted marketplace and release gates are still incomplete.

The default integration suite also starts disposable local PostgreSQL clusters
for staging TLS/migration tests. CI uses Ubuntu 24.04 with explicit `PG_BIN` and
PostgreSQL 17.11 tools (`17.11-1.pgdg24.04+2`) from the signed PostgreSQL APT
repository, plus OpenSSL. The two suites run sequentially and use the same owned
`LEARLI_STAGING_TEST_PORT=55703`; the existing Docker database remains separate.
The [runner image inventory](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)
lists PostgreSQL 16, so relying on its default tools would be insufficient.
Repository setup follows [PostgreSQL's Ubuntu instructions](https://www.postgresql.org/download/linux/ubuntu/);
the pinned package versions were checked in the official noble-pgdg index on
2026-10-12. Remote CI execution is still required to establish hosted-runner
results; local passes do not establish that result. Update server/client pins
together deliberately when maintaining this workflow.

## Install, build and local smoke

Read `.nvmrc` and `package.json` at the release candidate. At this baseline their
pins are Node24.20.0/npm11.19.0. Install using `npm ci`; do not use `npm install`,
`npx ...@latest` or forced audit fixes during release verification. The accepted
readiness-wave dependency result retains thirteen advisories; it is not clean.
Retain the exact package/lockfile hashes with the evidence.

For a new isolated checkout, choose unused owned ports before setup. Worker3
uses DB55503/dev3063/test3163; existing worktree ports cannot be changed by setup.
Setup creates private random credentials, separate databases and env files;
never copy another checkout's `.env*`, `.local` or database. Existing files/data
are preserved. See [local development](local-development.md).

```sh
npm ci
LEARLI_DB_PORT=55503 LEARLI_DEV_PORT=3063 LEARLI_TEST_PORT=3163 npm run local:setup
npm run check
node scripts/with-test-env.mjs npm run build
PORT=3163 node scripts/with-test-env.mjs npm start
```

Run the server in its own terminal and check from another:

```sh
PORT=3163 node --import tsx scripts/deployment-preflight.ts --mode local --config .env.test.local --require-build --health
```

This tests production **Node execution** using APP_ENV=test/AUTH_MODE=local and
synthetic data; it is not staging/production business operation. `NODE_ENV` is
set by Next's build/start command and is distinct from application `APP_ENV`.
Stop only this owned process with Ctrl-C. Keep local DB data; `npm run db:stop`
stops the owned cluster without deleting it. Never reset main or peer fixtures.

Next start honors `--port` or process `PORT` (default3000), and `--hostname`.
`APP_URL` does not set the listener; `LEARLI_*_PORT` names are setup inputs only.
PORT must be in the **process environment**, not merely Next's dotenv file,
because the server chooses the listener before application dotenv loading.
Source: [Next CLI](https://nextjs.org/docs/app/api-reference/cli/next).

Normal Node self-hosting with `next build` then `next start` is supported by
[Next self-hosting](https://nextjs.org/docs/app/guides/self-hosting). The current
[Railway Next guide](https://docs.railway.com/guides/nextjs) describes standalone
packaging; that is a different recipe and is not enabled here. Do not mix
`.next/standalone/server.js` with this build. If later approved, include both
`public` and `.next/static` with standalone output and verify it separately.

## Read-only preflight contract

Invoke through installed tsx, from repository root. Explicit `--mode` is required:

| Mode     | Checks                                                                                                                              | Exit result                                                  |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `local`  | Server parser, development/test local auth, dedicated matching runtime/owner DB roles/target, origin/PORT, no external email config | 0 only for scoped configuration and requested local liveness |
| `shell`  | Server parser, auth disabled, no auth/DB/email configuration, plain HTTPS or loopback HTTP origin, valid PORT                       | 0 only for scoped configuration and requested local liveness |
| `hosted` | Reports unresolved provider acceptance, operating policy and release gates; performs no network check                               | Always2/BLOCKED                                              |

Exit1 means invalid arguments, unavailable inputs, runtime/build/configuration
mismatch or failed requested local health. JSON has fixed messages and statuses;
never raw URLs, config values, provider errors or response bodies.

Without `--config`, only process environment is read. With it, parsed explicit
file values override inherited process values. The CLI never auto-discovers
`.env*`, starts a server, queries a DB, checks data contents, runs migrations or
delivers email. `--require-build` checks a nonempty `.next/BUILD_ID`; retain a
successful build log and candidate manifest too, since a marker alone cannot
prove a matching/current build. `--health` requests only the configured loopback
HTTP `/api/health`, has a three-second deadline/256-byte body bound, sends no
credentials, and refuses redirects. It never probes a hosted APP_URL.

Use the **same effective environment** for preflight and the server. Next loads
its normal dotenv files; this CLI does not reproduce that precedence. The test
wrapper explicitly overlays `.env.test.local` for both build/start; shell-only
smoke must explicitly set empty reserved integration variables in the process
so an existing `.env.local` cannot fill them. Failures do not change any config.

## Environment configuration — names only

| Names                                                             | Current purpose / separation rule                                                                          |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `APP_ENV`                                                         | development/test for local synthetic app; staging/production require HTTPS and reject local auth           |
| `APP_URL`                                                         | Canonical application origin; match local auth and process port locally; public HTTPS behind hosting proxy |
| `AUTH_MODE`                                                       | disabled for shell; local for development/test; hosted-synthetic only through validated staging packet     |
| `PORT`                                                            | Runtime listener; injected by Railway for a future authorized service                                      |
| `DATABASE_URL`                                                    | Local restricted loopback runtime credential; hosted pool separately consumes STAGING_DATABASE_URL         |
| `DATABASE_URL_DIRECT`                                             | Separate owner/migration credential for deliberate controlled operations; not browser/public config        |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`                           | Exact selected auth secret/origin; hosted path requires HTTPS and validated trusted-ingress contract       |
| `RESEND_API_KEY`, `EMAIL_FROM`                                    | Explicit approved mail configuration only; never enables sending merely by being present                   |
| `LEARLI_DB_PORT`, `LEARLI_DEV_PORT`, `LEARLI_TEST_PORT`, `PG_BIN` | Owned local setup only; never a Railway database-provisioning recipe                                       |

Leave integration names absent/empty in shell-only configuration. Never prefix
secrets with `NEXT_PUBLIC_`, publish `.env*`/`.local` or bake them into artifacts.
Record environment/resource identity and variable **names**, never credential
values, in a shareable release record. Private backups/captures require access
controls, not upload to a public runbook or Railway filesystem.

Search visibility is read on each request rather than at build time, and it
stays closed until the approved public launch. Search engines may index the
public pages only when the owner has set `SEARCH_INDEXING=open` and the service
runs as `APP_ENV=production` with an HTTPS, non-loopback `APP_URL`; every other
combination, including a production service without that variable, serves
`noindex` and a closed `robots.txt`. `APP_URL` is the origin written into
canonical links, the sitemap and share previews, so set the final public
address before opening indexing. Setting the variable is a production change
that needs the owner's explicit authorization.

| Environment        | Data and credentials                                                                                                               | Gate                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Local/dev and test | Owned loopback cluster, distinct `learli_dev`/`learli_test`, random private creds, synthetic `.test` users and demo states         | Local verification only; suites sharing test DB run sequentially                 |
| Future staging     | Isolated Neon resource/credentials and test recipient mechanism, synthetic data; separate Railway environment/service if justified | Hosted adapter/auth implementation and explicit external-operation authorization |
| Future production  | Separate Neon resource and runtime/migration credentials, real authorized records; no dev seeds or fictional customer catalog      | All audience/policy/security/operations gates and explicit release approval      |

Neon connection strings identify a specific branch/database/role; its current
documentation distinguishes pooled connections for many concurrent application
connections from direct connections for migrations/session-level needs and
requires secure connection configuration. Those instructions do not override
Learli's loopback validator. Source: [Neon's official connection guide source](https://github.com/neondatabase/website/blob/main/content/docs/get-started/connect-neon.md)
(official site rendering unavailable during this check). Select isolated
resources and least-privilege grants in a future approved hosted task; do not
infer environment isolation just from a differently named APP_ENV.

## Future Railway operator checklist — deferred

Before touching an account, receive authorization for the exact environment and
purpose. Use one Next.js Node web service and external Neon; the Railway guide's
Postgres template is not Learli's agreed DB. Do not add Redis/workers/storage.

1. Freeze the reviewed candidate/package pair; verify install/build/test evidence
   and unresolved security findings. Confirm runtime pin selection in the actual
   hosting builder. Do not use an unpinned latest image as evidence.
2. For an explicitly approved **shell-only** test, use auth disabled, no DB/auth/
   mail credentials and no private local artifacts. Inspect builder commands:
   install `npm ci`, build `npm run build`. For the current normal Next build,
   the explicit service start command is:

   ```sh
   node node_modules/next/dist/bin/next start --hostname 0.0.0.0
   ```

   It consumes Railway's process PORT; do not use the loopback `npm start` script
   for ingress, override the assigned port accidentally, or turn local auth on.
   This command is a documented operator setting, not a package edit/deployment.

3. Railway variables are scoped to the authorized environment/service; inspect
   names and provenance privately. Generated HTTPS domain is an app location,
   not permission for real users or an owned Resend sending domain.
4. Configure `/api/health` and the actual assigned PORT. Railway's deployment
   healthcheck waits for2xx before traffic activation; it is not continuous
   monitoring. A successful liveness check cannot clear auth/data release gates.
   Source: [Railway healthchecks](https://docs.railway.com/deployments/healthchecks).
5. Record deployed revision, builder/runtime, listener/port, health, static assets,
   representative public routes, expected auth-disabled denial and safe logs.
   Hosted DB connections and private role journeys stay **NOT RUN/BLOCKED**
   until their separately reviewed implementation exists.
6. Assign human monitoring/incident/cost ownership. Review actual Railway/Neon/
   Resend usage and current plan limits; never promise a fixed unlimited bill.

Resend requires an owned verified sending domain. A Railway subdomain and the
presence of `RESEND_API_KEY` are insufficient; local HTML capture is not delivery.
Before actual sending, approve sender/recipients, verify DNS under separate
authorization and test the implemented adapter without logging proofs or private
links. Source: [Resend verified domains](https://resend.com/docs/dashboard/domains/introduction).

## Migration, rollout and rollback ownership

- **Release owner:** root/founder names the human operator, exact target,
  revision, approval and incident contact before a hosted operation. None has
  been assigned by this worker; do not invent a contact or release approval.
- **Database owner:** inspect actual migration journal and runtime grants, target
  identity, fresh and populated-upgrade evidence, backup/restore proof and schema
  compatibility. Git merge/deploy does not migrate data. Current
  `npm run db:migrate`/`db:migrate:test` are loopback-only local tools, not a
  production Neon migration command. No hosted runner is supplied by this task.
- **Rollout:** once separately authorized and gates met, deploy the exact frozen
  candidate, deliberately apply reviewed migrations under the agreed sequence,
  verify health and real role/ownership/meeting/privacy flows against that target,
  then observe safe errors and resource use. No migrations on ordinary app start;
  no `drizzle-kit push`, dev seeds or copied real learner fixtures.
- **Application rollback:** retain the previously accepted artifact/revision and
  configuration provenance. A release operator may use Railway's supported
  prior-deployment action only after checking that artifact still matches the
  current schema. Recheck health and role boundaries. A code rollback neither
  reverses SQL nor restores data; see [Railway deployment actions](https://docs.railway.com/deployments/deployment-actions).
- **Data recovery:** stop unsafe writes through an approved incident procedure;
  preserve incident evidence and recent records. Never delete history or execute
  a speculative down migration. Restore first into an isolated owned target,
  prove schema/data/grants and obtain separate authorization for production
  cutover. Worker2 owns the backup/restore proof and recovery runbook; root
  reconciles its accepted procedure. Recovery targets/retention remain decisions,
  not invented RPO/RTO promises.

## Release record and go/no-go

Record exact candidate SHA256 manifest, reviewer identity and findings separately
from executed commands/exit status/environment/date, accepted dependencies,
failures/recovery, unrun tests, target identities and named operation authority.
Same-agent Review is not independent review. Root owns combined acceptance.

Shell liveness, production compilation and local simulation do not clear: hosted
auth/secure-cookie/Neon TLS/grants/migrations; real transactional email; restore/
incident ownership; guardian consent/minor eligibility/tutor screening/privacy;
commercial booking durations/confirmations/cancellations/payments; reviewed policy
content; or explicit pilot/public release approval. Leave each **BLOCKED** or
**NOT RUN** until actual evidence/approval exists. See PRD§17 and build-plan M8.

Official hosting references checked2026-10-12. Recheck them and the installed
runtime before executing a future hosted procedure; this runbook changes no
architecture, policy or provider state.
