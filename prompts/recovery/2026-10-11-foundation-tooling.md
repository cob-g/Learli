# Learli recovery — foundation tooling

- Status: AUTHORIZED — build-feature delegation
- Mode: Targeted dependency selection; local development only
- Related work: M1.1/M1.6, `prompts/features/m1-01-app-foundation.md`
- Baseline: main at 4503177 plus uncommitted foundation/skill work

## Observed evidence

The initial install resolved ESLint 9.39.5 with a deprecation notice, despite
Next's published peer range permitting ESLint >=9. The current stable ESLint is
10.12.0 and supports the installed Node 24.20.0. Use the supported release if peer
resolution and actual lint checks pass; do not suppress peer dependency errors.

The initial full audit also reports tooling advisory chains rooted in
braces 3.0.3 (shadcn and Next's lint tooling) and esbuild 0.18.20 (Drizzle Kit's
legacy loader). No patched braces release was available from the registry when
inspected. npm's suggested forced fixes would downgrade current framework tools
to old major versions; that is not an appropriate repair. Keep these limitations
visible, check the runtime dependency audit separately, and don't expose any
development tooling server to untrusted networks. No application integration or
live data has been involved.

## Separate implementation and verification handoff

ESLint 10's installation produced invalid peer dependencies in Next's bundled
React, import, and accessibility plugins. The coordinator restored 9.39.5, the
mutually compatible version, without suppressing peers. Keep its deprecation
notice documented until upstream support is available.

Recheck peer resolution and execute lint, typecheck,
tests and build. Record residual development advisories and runtime audit outcome
in the README/tracker; never assert a clean full audit without observed evidence.
No destructive changes, provider operations, or blind audit-force downgrade.

## Configuration review finding

Read-only review identified that the production/staging `superRefine` callback
could call `new URL` on a malformed value even after a preceding schema issue.
That could throw a native exception before the sanitized configuration error.
Targeted repair: guard URL parsing in the cross-field check as well, and add
stage/production malformed-origin regression cases that assert value redaction.
Authority: the same M1 build request. Recover did not execute the repair/tests.

## Verification findings and coordinator repairs

- ESLint rejected an unescaped apostrophe in the generic error heading and warned
  about an anonymous PostCSS default export. The coordinator escaped the heading
  and named the configuration object; format/lint/typecheck and all 17 tests passed.
- Vitest warned that the root package did not declare ESM despite ESM configuration
  files. Declare `type: module`, matching the existing imports; verify with a clean
  install and the complete check/build/browser sequence.
- `npm explain drizzle-kit` shows Better Auth's optional peer pulls Drizzle Kit
  into npm's runtime dependency graph even though the root declares it as a dev
  dependency. The runtime audit therefore reports four moderate esbuild-chain
  findings. Do not label it clean or claim these are excluded from production
  installation. The current application does not import these packages.
- The first browser run passed 12/15 checks. The three failures shared a test
  assumption: a 404 page has two valid noindex metadata tags (Next's automatic
  404 tag and the development shell's tag). HTTP 404, health, and displayed
  content assertions passed. Repair the assertion to require at least one robots
  tag and verify **every** emitted tag contains noindex; do not change the app's
  exclusion or discard either tag from the check. Re-run all browser projects.
- Dev startup appended a framework-generated block to the existing AGENTS.md.
  Preserve the project-owned contract: use Next's installed, typed `agentRules:
false` option and remove only that newly generated block. Check dev restart and
  the resulting diff; keep the previous skill orchestration edits intact.
