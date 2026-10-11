# Learli M1 — Application foundation

- Status: AUTHORIZED — build-feature delegation
- Date: 2026-10-11
- Authority: The repository owner requested, “set up the app foundation first the dependecises and the the tools that this project needs” and analysis of `context/build-plan.md`.
- Repository: `/Users/cob/learli`, `main` at `4503177` when inspected.
- Existing changes: uncommitted Build Feature skill, child orchestrated-mode sections, AGENTS/workflow/tracker edits, and memory ignore rule from the previous task. Preserve these; they are not application implementation.
- Work packages: M0.1/M0.6 evidence; M1.1–M1.9, owned by M1.1.
- PRD: PUB-01 visual foundation; supporting NFR engineering requirements. Full marketplace discovery remains M3.
- This is delegated implementation authority, not separate human review of this blueprint.

## Outcome and scope

Create a locally runnable Next.js App Router application with strict TypeScript,
Tailwind v4, the documented Learli theme, shadcn tooling, a truthful public
shell and unavailable discovery states, safe health endpoint, and quality tools.
Install the planned Neon, Drizzle, Better Auth, and Resend packages for subsequent
work. A public page must load without database, auth, or email credentials.

Read AGENTS.md and the eight canonical context files in their declared order.
`context/build-plan.md` defines the sequence; UI values remain proposed defaults.
No terminology or policy clarification is needed for this local foundation.

## Decisions and invariants

- Reuse installed Node 24 LTS; pin Node/npm, direct dependencies, and npm lockfile.
- Manual scaffold in the existing root avoids overwriting documents or skills.
- Use current compatible stable package versions verified from official docs and
  package manifests. ESLint/Prettier, Vitest/Testing Library, and Playwright form
  one consistent local/CI toolchain.
- Use Server Components by default. Only error recovery and an accessible mobile
  navigation disclosure need client behavior in this slice.
- `ui-context.md` decision 14 explicitly reserves generated-primitive edits for
  design approval. Configure shadcn (`new-york` as a provisional tooling setting)
  without generating/customizing primitives in this slice. Shared native controls
  support the small shell; final primitive/preset approval remains open.
- Use the documented development-only plain “Learli” home-link placeholder until
  approved wordmark files exist. No invented logo, favicon, tutor, rating, price,
  subject inventory, claim of live bookings, or externally collected user data.
- The public shell explains tutoring over Zoom/Meet and provides clear discovery
  paths with unavailable states. No search or matching forms pretending to work.
- Private workspace routes are placeholders without identity or private data;
  they must not imply authentication/authorization is implemented. Prevent indexing.
- Validate configuration without including secret values in errors or responses.
  Health reports process liveness only, not database/auth/email readiness.

## Proposed affected areas and implementation

1. Root package/lockfile, runtime pins, TS/Next/PostCSS/ESLint/Prettier configs,
   shadcn components config, ignore rules, environment template, README.
2. `src/app`: layout/theme, public page shells, health route, robots exclusion,
   no-access workspace placeholders, not-found and error handling.
3. `src/components`: only used primitives/shared shells and empty states;
   `src/lib`: semantic class merger and server-only configuration validation.
4. `tests`: meaningful configuration validation, health contract, class-merger
   regression, component recovery interaction, and browser route/mobile/a11y checks.
5. CI: clean install, lint/format/typecheck/tests/build, Chromium smoke tests.
6. README and tracker: exact commands, installed versus connected integrations,
   remaining M2 work, missing assets and local-only release status.

## Data, authorization, and external impact

No schema, migrations, seeded records, database queries, accounts, email sends,
payment integration, or provider provisioning in M1. Dependencies are installed
but integrations are explicitly unconfigured. Neon/Drizzle schema and Better Auth
integration belong to M2. Do not deploy, commit, or push under this request.

## Verification plan — not yet executed

- Dependency resolution/peer compatibility; pinned lockfile and runtime.
- Typecheck, ESLint, Prettier, unit/component tests, production build.
- Browser checks of public routes, privacy-safe placeholder routes, genuine 404,
  health JSON/no-cache semantics, keyboard navigation and mobile layout.
- Automated accessibility checks and manual screenshot inspection at phone and
  desktop widths; light rendering under dark OS preference.
- Configuration tests: absent optional integrations, malformed values rejected,
  and secrets not disclosed in error messages.
- Public shell/production build with no integration credentials. Check client
  output for accidental server modules or secret exposure.
- UI detector required by `ui-context.md`, with any narrow exceptions documented.

## Risks and handoff

Brand artwork and proposed design tokens have no final design approval. This
does not block a development foundation; public launch remains unapproved.
Neon, auth, email delivery, provider accounts and Railway are not verified by a
successful local build. Missing credentials must not be recorded as integration
success. Record review and verification separately in the tracker and local memory.

Blueprint ready.
