# Implementation Plan — Standalone meeting-link validation

## Authority and baseline

**AUTHORIZED — build-feature delegation**, 2026-10-11. User requested the
standalone M5.1 / MEET-01 validator, official format research, security tests,
verification and local handoff in this worktree only. This is not separate human
blueprint approval.

Repository: `/Users/cob/orca/workspaces/learli/m5-meeting-link-validator`.
Observed branch: `cob-g/m5-meeting-link-validator`; clean baseline
`2803d1f3bf2579cc30f5c332b15482c092a9401c`. Keep this branch. All eight required
context files and four child skills exist. Read AGENTS.md, then
`context/{project-overview,architecture,ui-context,code-standards,ai-workflow-rules,progress-tracker,prd,build-plan}.md`
in that order. Lowercase canonical paths take precedence over old mixed-case
references within documents.

## What we are building

Backend utility for future tutor meeting-link submission: synchronous
`validateMeetingLink(input: unknown)` returning a discriminated result with
provider and normalized private URL, or a fixed `INVALID_MEETING_LINK` code.
No terminology clarification needed. Acceptance means supported syntax only,
never meeting existence, ownership, attendance, eligibility or authorization.

## Requirement and milestone mapping

M5.1 / MEET-01 format-validation portion; QA-13 and library-level QA-19.
MEET-02, BR-08 and BR-14 remain integration invariants. Existing validation lives
under `src/lib/validation/`, tests use Vitest. No meeting library exists.
M4 availability and booking prerequisites are not needed for this pure slice;
full M5.1/M5 completion still depends on protected storage and integration.

## Technical decisions and assumptions

- Use native WHATWG URL parsing, with raw-input checks against parser repair:
  reject whitespace, controls, non-ASCII, backslashes, credentials, explicit ports
  (including 443), fragments, percent escapes and dot-segment normalization.
  Require literal HTTPS authority syntax; scheme/host case may normalize.
- Support `zoom.us` and exactly one ASCII DNS label beneath `zoom.us` (1–63
  characters, alphanumeric ends, internal hyphens; no `xn--` label), with
  `/j/` plus 9–11 ASCII digits. Optional sole `pwd` query parameter: 1–256
  unreserved ASCII characters. Preserve its case and bytes. Reject unknown or
  duplicate parameters rather than removing potentially meaningful credentials.
- Support exact `meet.google.com`, with three lowercase letter groups separated
  by hyphens, maximum 128-character meeting code, no query. This follows the
  documented code grammar rather than assuming every code is 3-4-3 letters.
- Bound input to 2048 characters before parsing. No coercion, trimming, network,
  logging, dependencies, API clients, environmental configuration or side effects.
- These are a conservative technical subset, not claims that other provider
  links are invalid. Exclude personal-name aliases, registration/host/web-client
  paths, extra queries such as `omn`/`tk`, alternate Zoom domains and Meet lookup
  nicknames. Later expansion requires official evidence and regression tests.

Official evidence checked 2026-10-11:

- [Zoom invite links](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0065180)
  describe meeting IDs and optional embedded passcodes.
- [Zoom recurring access](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0082196)
  documents `/j/MEETING-ID` and 9–11 digits.
- [Zoom vanity hosts](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0061540)
  document organization subdomains.
- [Zoom API examples](https://developers.zoom.us/docs/api/meetings/)
  show `/j/` invitation URLs with `pwd`, including a dot in the opaque token.
- [Google Meet spaces](https://developers.google.com/workspace/meet/api/reference/rest/v2/spaces)
  specifies joining URI, lowercase code grammar and 128-character maximum.

## Scope, data and authorization

Proposed new files: `src/lib/validation/meeting-link.ts`,
`tests/unit/meeting-link.test.ts`, `docs/meeting-link-validation.md`.
Small factual edit to `context/progress-tracker.md`; ignored local `memory.md`
handoff. No schema, migration, storage, route, UI, booking integration, OAuth/API,
availability or `src/lib/time` changes. No changes outside this worktree, commits,
pushes, merges, deployments or production operations.

Data/authorization changes: None. Future callers must validate on the server,
authenticate and authorize the exact booking, and keep returned URLs out of
public data and logs. No database access or permission bypass in the library.
Concurrency, retries, time zones, notifications and UI states: not applicable.
Missing/malformed/unsupported values all return the same safe error without input.

## Implementation sequence and acceptance

1. Implement the pure parser and explicit provider allowlist.
2. Add synthetic success and hostile-input tests: spoofed hosts, schemes,
   userinfo, ports, IP/IDN, normalization, paths, queries, fragments, size/type
   boundaries, no input coercion, no logging/fetch, preserved credentials and
   stable revalidation of normalized output.
3. Document supported rules, deliberate exclusions, source evidence, and future
   integration obligations; update tracker as partial work awaiting verification.
4. Same-agent read-only Review, separate Verification, then Remember save.

## Verification plan (NOT RUN — architecture only)

Use pinned Node 24.20.0/npm 11.19.0 and `npm ci` (dependencies absent).
Run `npm run check` (format, lint, typecheck, complete unit/component suite),
`npm run build`, and `git diff --check`. Review synthetic tests and full new files.
Inspect integration/E2E scripts for isolation before running: they require
`.env.test.local` and mutate `learli_test`; this worktree has neither local
configuration nor owned cluster. Mark these NOT RUN if unavailable, never borrow
another session's database or create/reset services for this no-database slice.
Manual responsive/accessibility checks: not applicable, no UI changes.
Remote CI/provider runtime/production checks: not run, outside authorization.

## Risks, context updates and handoff

Technical allowlist intentionally rejects some genuine provider URLs. Provider
formats may evolve. Document restrictions so callers do not silently strip data.
Per-booking versus reusable links, access timing, guardian/safety controls and
meeting settings remain founder/product decisions; none blocks pure validation.
Update only scoped tracker evidence, not shared milestone plans or product policy.
Rollback is removal of the unintegrated library/tests/docs; no persisted data.
Next integration needs approved link model and booking/participant ownership,
private storage, server validation, safe errors and cross-account privacy tests.
