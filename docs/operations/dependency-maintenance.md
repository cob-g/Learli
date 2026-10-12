# Dependency maintenance — 2026-10-12

The bounded M1.1/M1.6/M8.8 maintenance package (NFR-05/06) retains the existing
exact dependency versions. No compatible stable upgrade resolves the two current
underlying advisories. **The audit is not clean: 13 package findings remain,
9 high and 4 moderate.** This is a documented local maintenance result, not
security acceptance or public-launch clearance.

Authority: **AUTHORIZED — build-feature delegation** for Worker 1 of the local
readiness wave; no separate human blueprint approval. Blueprint:
[M8.8 dependency maintenance](../../prompts/features/m8-08-dependency-maintenance.md).
Baseline: `5634e44fd71e8851400e004de6bbe3554e65eae1`. Node 24.20.0/npm 11.19.0,
`.node-version`, `.nvmrc`, packageManager and exact dependencies remain unchanged.

## Staging foundation recheck — 2026-10-12

The staging code-preparation integration re-ran `npm audit --json --ignore-scripts`
at 04:15 UTC using the unchanged dependency pins and lockfile. Exit 1: **13 findings,
9 high and 4 moderate**, matching the two underlying advisories below. No dependency
fix, suppression or exposure waiver was applied. Private command/source receipts
are under `.local/staging-database-wave/audit.*` in the integration checkout.
The package script added by this wave is separate from the historical manifest
hash below; the lockfile remains unchanged. This recheck does not repeat or replace
the earlier registry compatibility investigation.

## Current findings and exposure

The audit's 13 rows include propagated dependency findings; they represent two
underlying advisories, not 13 independent vulnerabilities. Installed ancestry was
checked with `npm explain`, lockfile flags and actual installed package metadata.

| Advisory                                                                                        | Installed affected version                                 | Finding and available fix                                                                                                                                           | Application exposure and mitigation                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)       | braces 3.0.3                                               | High: deeply nested brace patterns can exhaust the stack; advisory covers<=3.0.3 and lists no patched version. Official registry latest remains3.0.3.               | Dev tooling via Next lint and shadcn CLI; no direct application/service import of braces, micromatch or fast-glob was found. Use trusted repository patterns/configuration; do not feed request or untrusted registry patterns into tooling. Development/CI exposure remains; this is not a proof of exploit impossibility. |
| [GHSA-67mh-4wv8-2f99](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99) | esbuild 0.18.20 nested under @esbuild-kit/core-utils 3.3.2 | Moderate: esbuild's serving API permits cross-origin reading; patched>=0.25.0. Stable drizzle-kit 0.31.11 still pulls esm-loader 2.6.5→core-utils→esbuild ~0.18.20. | No esbuild serving API or Drizzle Studio command is used in app/scripts. The loader uses transform functions. Migration runner uses drizzle-orm/node-postgres/migrator through current tsx, not drizzle-kit. Do not start the vulnerable esbuild development server; review any future Studio/loader use separately.        |

The braces maintainer's [upstream discussion](https://github.com/micromatch/braces/issues/70)
disputes the advisory's interpretation and emphasizes trusted glob input. The
published audit remains reported; no suppression or risk waiver follows from
that disagreement. Drizzle's [Studio documentation](https://orm.drizzle.team/docs/drizzle-kit-studio)
describes a separate local server tool; absence of that command here is an
observed usage boundary, not an assessment of every Studio version.

### All current audit rows

| Package                  | Installed version(s) | Severity | Dependency path / classification                                                   |
| ------------------------ | -------------------- | -------- | ---------------------------------------------------------------------------------- |
| braces                   | 3.0.3                | High     | Dev-only micromatch dependency; underlying advisory                                |
| micromatch               | 4.0.8                | High     | Dev-only fast-glob dependency; propagated braces finding                           |
| fast-glob                | 3.3.1,3.3.3          | High     | Dev-only Next lint/shadcn paths; propagated                                        |
| @next/eslint-plugin-next | 16.4.0               | High     | Dev eslint-config-next→fast-glob; propagated                                       |
| eslint-config-next       | 16.4.0               | High     | Direct dev dependency; propagated                                                  |
| @shadcn/registry         | 0.1.3                | High     | Dev shadcn→fast-glob; propagated                                                   |
| @ts-morph/common         | 0.27.0               | High     | Dev shadcn→ts-morph→fast-glob; propagated                                          |
| ts-morph                 | 26.0.0               | High     | Dev shadcn dependency; propagated                                                  |
| shadcn                   | 4.21.4               | High     | Direct dev dependency; propagated                                                  |
| esbuild                  | 0.18.20              | Moderate | Nested core-utils copy; underlying advisory, devOptional                           |
| @esbuild-kit/core-utils  | 3.3.2                | Moderate | esm-loader dependency; propagated, devOptional                                     |
| @esbuild-kit/esm-loader  | 2.6.5                | Moderate | Drizzle Kit dependency; propagated, devOptional                                    |
| drizzle-kit              | 0.31.11              | Moderate | Direct dev dependency and Better Auth 1.7.7 optional peer; propagated, devOptional |

Other installed esbuild copies 0.25.12 and 0.28.2 are above the patched threshold
for this advisory. Their presence does not repair the nested 0.18.20 copy.

### Runtime, development and optional peers

| Command                                       | Exit | Result                                                  |
| --------------------------------------------- | ---- | ------------------------------------------------------- |
| `npm audit --json`                            | 1    | 13 findings: 9 high/4 moderate                          |
| `npm audit --omit=dev --json`                 | 1    | 4 moderate findings in Drizzle Kit/legacy esbuild chain |
| `npm audit --omit=dev --omit=optional --json` | 0    | 0 findings in this filtered graph only                  |

Better Auth 1.7.7 explicitly declares Drizzle Kit as an optional peer with
`>=0.31.4 || >=1.0.0-beta.1`; npm marks the installed tooling chain `devOptional`.
That explains its presence in the omit-dev result even though the application
imports Better Auth/its adapter, not Drizzle Kit. [npm's audit documentation](https://docs.npmjs.com/cli/v11/commands/npm-audit/)
describes filtered dependency reporting and propagated metavulnerabilities.
The last row is a classification probe, **not** an install recommendation,
suppression rule or clean full-audit claim. Optional dependencies include platform
binaries needed by tooling/frameworks; do not broadly omit them to obtain green
output. Registry classification alone does not establish runtime reachability.

## Fix and compatibility decisions

Official npm metadata was inspected on 2026-10-12 for braces, Drizzle Kit, Better
Auth/adapter, Next lint config/plugin, shadcn and the installed ESLint plugins.
The affected direct packages already use their current stable latest versions.
Drizzle 1.0 tags are prereleases; no stable migration away from this legacy chain
was selected. npm's suggested fixes downgrade drizzle-kit to 0.18.1,
eslint-config-next to 14.2.35 and shadcn to 1.0.0. Those break the declared Better
Auth peer or current Next/tooling foundation and are rejected. No force,
legacy-peer-deps, override, vendored patch or historical migration edit was used.

ESLint 9.39.5 remains deprecated/unsupported according to installed registry
metadata and [ESLint's support policy](https://eslint.org/version-support/).
Although eslint-config-next accepts >=9, its installed eslint-plugin-react 7.37.5
and jsx-a11y 6.10.2 peers exclude 10. Moving to ESLint 10.12.0 without supported
plugin compatibility would replace one maintenance problem with invalid peers.
This separate support risk remains visible for follow-up.

`npm outdated` also lists @types/node 26.6.5, TypeScript 7.0.2 and Zod 4.6.6.
No current advisory requires these changes: Node types remain aligned with
runtime 24, and unrelated compiler/schema churn is outside this security fix.

The frozen dependency result is byte-identical to baseline:

| File              | SHA256                                                           |
| ----------------- | ---------------------------------------------------------------- |
| package.json      | 2ab198caa57f359b60c7c652c8521764eef55f434ff48bb943d6e2b967a8e927 |
| package-lock.json | fd901b5a1f86356d9feb3aa1c15def09e5c160fda7489ec526add31f0a36ec5c |

Required compatibility diff: empty. Root independently matched and accepted both
hashes (`msg_073cb8dceef5` and the verification-scope reply), recorded privately in
its accepted dependency manifest. No package import is necessary. Root owns
combined review. Package-script additions for other readiness
packages require a new coordinated freeze; they are not part of this result.

## Verification status

- Pinned `npm ci`: PASS, exit 0, 777 installed packages; unchanged manifest/lockfile.
  [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/) uses the existing lockfile
  and does not update dependency manifests.
- `npm ls --all --json`: PASS, exit 0, no dependency-tree problems.
- Current audit classification: executed with results above; security gate remains
  unresolved because advisories have no safe stable fix in this graph.
- Read-only same-agent Review: PASS, no confirmed findings, READY FOR VERIFICATION.
  This is not independent review or release clearance. Final factual documentation
  updates were re-inspected separately.
- Separate scoped Verify: PASS, `npx --no-install prettier --check` on README,
  report and blueprint, `git diff --check`, local-link existence and exact frozen
  dependency/scope checks. Canonical context is excluded by the repository's
  Prettier ignore rule; the inserted tracker entry was read for factual accuracy.
- Whole repository check, production build and provider-sensitive PostgreSQL/
  browser regressions: NOT APPLICABLE to this documentation-only result. Root
  explicitly directed no heavy reruns or database setup: all runtime, provider,
  dependencies, scripts, configuration, schema and tests remain byte-identical.
  Historical passes are not claimed as fresh execution. No owned database/private
  auth configuration was created; ports 55501/3061/3161 remain unused.
- Hosted Neon/Resend/Railway, remote CI, real users/mail and public release:
  NOT RUN under local-only authority.

Private raw audits, registry metadata, installation/tree output and final worker
report/manifest remain ignored under `.local/readiness-wave/`. They are not copied
into tracked documentation. Existing ownership, booking, browser privacy and
local capture boundaries are unchanged; no source, data or migrations changed.

## Remaining blocker and next action

Root/release owner must retain these advisories and ESLint support risk in the
readiness decision. Recheck upstream stable releases and installed ancestry before
release or adding tooling that consumes untrusted patterns/starts a server.
When supported fixes exist, update only the affected pins, regenerate the lockfile
without force, reproduce with pinned npm ci, review the exact delta and rerun
affected static/build/provider/database/browser checks. There is no authorized
waiver or production launch implied by this report.
