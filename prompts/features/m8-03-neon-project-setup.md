# M8.3 — Neon project operational setup

Status: **AUTHORIZED — build-feature delegation** (2026-10-12).

## Outcome and authority

The current user explicitly authorizes `npm i -g neon@latest && neon login`,
`neon skills -y`, `neon mcp -y`, linking project `withered-grass-51575984`
branch `production`, `neon config init`, the exact empty config below, and
`neon deploy`. This records execution authority, not separate human blueprint
approval. The worker owns this checkout alone on main, baseline
`2fa0294c5e6cad895754b3c10a703a6c6f6ef00a`; no worktree or nested agents.

Primary owning package: M8.3 operational environment setup; related M8.1 and
PRD NFR-05, NFR-06, NFR-11, §13. The seven commands are a bounded operational
subset, not whole-milestone acceptance or a public application launch.

## Scope and invariants

- Install/current CLI authentication, separate third-party skills, MCP setup,
  exact named existing target link, config creation and authorized deployment.
- Read actual CLI help, installed Neon skills and current official docs before
  relying on integration behavior. Resolve package naming from installed code.
- Preserve local `.env.local` and `.env.test.local` bytes and their loopback
  PostgreSQL 55432 dev/test databases, currently through 22 migrations.
- Privately back up affected project/global configuration and credentials;
  retain receipts under ignored `.local/neon-setup/` with restrictive modes.
- Keep canonical `skills/` and `.agents`/`.claude` source symlinks intact.
- Drizzle owns schema; no app SQL migrations, seeds, test production access,
  real-user activation, payment operations, Railway deployment, commit or push.
- No unrelated EduSphere/session changes. Do not print credentials or private
  provider data.

Exact required `neon.ts`:

```ts
import { defineConfig } from "@neon/config/v1";

export default defineConfig({});
```

## Implementation sequence and failure handling

1. Preserve pre-existing configuration, env hashes, skill links and package state.
2. Install latest global CLI; inspect help and login. Forward safe interactive
   login instructions promptly using coordinator ask if human action is needed.
3. Execute skills/MCP installation, inspect installed skill sources and all edits.
4. Inspect authenticated project/production branch metadata, then link using
   supported safe env override or restore original local env after command.
5. Initialize config and required packages; pin installed package releases and
   lockfile, then write the exact config. Retain Drizzle unchanged.
6. Inspect live config and dry-run plan plus installed deployment implementation.
   If omission deletes existing services/data, stop dependent work and ask the
   coordinator with concrete evidence; authorization does not waive this gate.
7. Execute authorized deploy only after target and preservation are established;
   capture receipt and verify actual resource changes. Preserve local env.
8. Update tracker and sanitized `.local/neon-setup/report.md` with each step,
   CLI version, actual target, deploy result/resources changed and limitations.

## Verification plan (not executed by Architect)

- Same-agent read-only Review against baseline and exact diff; label honestly.
- Actual CLI/API link/plan/deploy receipts, no destructive plan, exact config.
- Byte/hash checks for both env files, canonical skill links and configuration
  preservation; local read-only database identity/migration counts if needed.
- Scoped format/lint and typecheck for config/dependency changes; inspect scripts
  before execution. No full unchanged app suite unless a relevant concern arises.
- Git diff/check, changed/untracked files, sensitive-file ignore/mode checks,
  secret hygiene and private evidence verification.
- Separate Verify status PASS/FAIL/NOT RUN; no fabricated deployment success.
- Remember saves only ignored untracked `memory.md`, preserving history.

## Documentation and risks

Update progress tracker after meaningful implementation and observed results;
update governing context only if actual boundaries change. Existing unresolved
business/legal/safeguarding/provider launch gates remain. Login/access, package
compatibility or a destructive empty-config plan may block completion. Preserve
backups and report the precise safe next action instead of claiming success.

Blueprint ready. Verification: NOT RUN — architecture planning only.
