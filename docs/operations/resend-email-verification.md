# Email verification test handoff — 2026-11-11

Worktree: `/Users/cob/orca/workspaces/learli/resend-email-verification`.
Branch: `feature/resend-email-verification`, base `2a48b43`; changes remain
uncommitted in this worktree. Blueprint:
`prompts/features/m5-07-resend-email-verification.md`.

## Behavior and activation

Default verification is captured privately. An explicit ordinary local runtime
can instead send a genuine Better Auth verification link through Resend's
`onboarding@resend.dev` test sender, to the exact configured account-owner
recipient. No recipient substitution, general-user sending, password-reset,
email-change or booking-email activation is included.

When the owner has a Resend Free account and a Sending API key, add these settings
privately to this worktree's ignored `.env.local`:

```dotenv
LOCAL_VERIFICATION_RESEND_KEY=REPLACE_WITH_PRIVATE_RESEND_SENDING_KEY
LOCAL_VERIFICATION_RECIPIENT=REPLACE_WITH_EXACT_RESEND_ACCOUNT_EMAIL
```

Use these dedicated names rather than the unrelated `RESEND_API_KEY` setting.
Do not commit the file or paste a key into chat. Resend restricts its test sender
to the address associated with the account. See its
[official restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

This worktree's database is an independently created synthetic fixture on
55438; the normal Learli database is untouched. To resume this isolated app:

```sh
npm run db:start
LOCAL_WORKFLOW_MODE=enabled DATABASE_URL_DIRECT= npm run dev -- --port 3038
```

The empty owner-connection override keeps that migration credential out of the
ordinary app configuration. The real account being verified must use the same
email as the configured recipient. The verification link opens on this computer;
it will not reach this app from a different phone/computer. Remove both optional
settings and restart to restore capture-only operation.

## Observed checks

- `~/obscura/obscura --help`: PASS; installed executable is available.
- Obscura MCP opened Resend login and read official test-sender documentation.
  Google OAuth rejected the headless browser with the insecure/unsupported app
  message. The dashboard, selected plan and API key could not be inspected.
- `npm run check`: PASS, 2,429 unit/component tests across 176 files. Its initial
  four test-stub lint warnings were then removed. Final format, lint and
  TypeScript checks passed cleanly (`.local/final-static.log`).
- `NODE_OPTIONS=--max-old-space-size=8192 npm run build`: PASS
  (`.local/build.log`). Inspection found zero private paths in 158 build traces.
- `npm run test:integration -- tests/integration/auth.test.ts tests/integration/booking-notifications.test.ts tests/integration/account-email.test.ts`:
  PASS 62/62 after the Node-only server sentinel mock repair. These use the
  isolated test database.
- `LEARLI_LOCAL_VERIFICATION_INTEGRATION=1 node scripts/with-test-env.mjs node_modules/.bin/vitest run --config vitest.integration.config.ts tests/integration/local-verification-runtime.test.ts`:
  PASS 1/1 with intercepted provider HTTP and genuine provider-issued links.
  Covers exact-recipient refusal, unknown/known response comparison, delayed
  provider failure, private headers, tampered and successful link processing.
  The fixture requires an independently provisioned private ownership marker,
  matching actual PostgreSQL data directory and system identifier. It cannot
  run merely because an environment file selects a familiar local port.
- Inherited-verification-setting test of `scripts/with-test-env.mjs`: PASS;
  neither configured value reaches the child test command. The ordinary local
  fixture wrapper clears both values after its environment merge too.
- Obscura local public-API and navigation checks: signup 200; pre-verification
  sign-in 403; tampered link left the account unverified; genuine link verified;
  subsequent sign-in 200. All accounts/data in this check were synthetic.
- Obscura CDP viewport smoke checks at 1440 and 390 pixels: no horizontal
  overflow; private captures and measurements under `.local/obscura-layout-*`.
  Its native form interaction did not exercise the React submission correctly;
  the resulting native request lacked the accepted origin and was refused.
  The browser also rendered noscript/fidelity artifacts. API calls through
  browser JS supplied the truthful same-origin header, with no relaxed app
  checks. These checks do not establish full Chromium interaction fidelity.
- Independent GPT-6.1 Terra Review: `READY FOR VERIFICATION`, no remaining
  confirmed findings, including the final test-harness/fixture/wrapper deltas.

## Failures repaired and remaining limitation

The initial implementation's recipient-dependent error, response normalization,
rate-limit/header handling and Node test sentinel regressions were repaired and
re-reviewed. Repeated fixture runs initially hit accumulated local rate limits;
the isolated fixture now proves its server identity before a narrow test-counter
reset. Details: `prompts/recovery/2026-11-11-local-verification-enumeration.md`.

## Live owner-only verification — 2026-11-11 19:09 Asia/Manila

- At the owner's request, Chrome Computer Use replaced Obscura for account
  setup. The owner completed Google sign-in; the dashboard showed the account
  and an existing Sending-access onboarding key. The agent stopped before
  generating or revealing the new key. Free-plan/billing status was not inspected.
- The owner saved the dedicated key and recipient privately in the original
  checkout. Only those two settings were copied privately into the isolated
  worktree; no database, password or other configuration was copied. Both env
  files remain ignored. The original database was not queried or changed.
- Restarted only the isolated PostgreSQL cluster on 55438 and the worktree's
  loopback development app on 3038. The owner account did not exist before the
  browser test. Chrome opened the genuine signup form with the configured
  owner mailbox; the owner set and submitted the password personally.
- Inbox receipt: PASS, reported by the owner, who quoted the expected
  verification message and “Continue on Learli” action. No repeat send was made.
  The adapter does not retain provider response IDs; provider API acceptance
  was not separately inspected in the dashboard, although actual receipt
  establishes delivery for this request.
- Received-link completion: PASS. A read-only query, restricted to the isolated
  configured owner account, confirmed account existence and
  `email_verified = true`. No proof URL, key, password or mailbox is retained in
  the tracked evidence. This proves email control only, not any app role.
- Verified-account sign-in: PASS, reported by the owner at 19:11 Asia/Manila.
  The agent did not enter or inspect the password. This completes the owner-led
  live signup → inbox verification → verified sign-in walkthrough.
- No source changes or new automated suite runs in this activation step; prior
  reviewed implementation checks above still apply.
- The isolated app and database remain running for the owner. Obscura remains
  stopped. No production activation, paid-plan/billing change, merge, push or
  deployment. General-recipient sending still needs a verified owned domain;
  reset, email-change and booking mail remain capture-only in this runtime.

## Verification email design — 2026-11-11

The local verification path now uses `Learli <onboarding@resend.dev>`, the
original wordmark as a small CID PNG, an inline-styled email table, a clear
verification action, private-link/ignored-request guidance, a copyable fallback
and equivalent plain text. Other email paths and hosted sender rules are
unchanged. See `prompts/features/m5-07-verification-email-design.md`.

The Gmail sender avatar is separate from email-body HTML. The shared test sender
cannot be configured as the owner's Learli brand identity. A future independently
controlled sender/domain can pursue provider-specific logo display; Google's
[BIMI requirements](https://knowledge.workspace.google.com/admin/security/set-up-bimi?hl=en)
include DMARC and a VMC or CMC. No DNS, certificate, Google-profile, billing or
production change was made. Resend documents both
[sender display names](https://resend.com/docs/api-reference/emails/send-email)
and [CID embedding](https://resend.com/docs/dashboard/emails/embed-inline-images).

Separate checks for this refinement:

- Same-agent scoped read-only Review: READY FOR VERIFICATION, no confirmed
  findings against the delegated design blueprint. The earlier independent
  Terra review concerned the preceding implementation, not this refinement.
- Focused unit/component checks: PASS 21/21 across four files
  (`.local/email-design-tests.log`). Includes exact destination/recipient,
  escaping, real PNG/CID binding, refusals, timeout and original response/UI cases.
- Real isolated PostgreSQL verification with intercepted provider HTTP: PASS1/1
  (`.local/email-design-runtime.log`, 14.72 seconds). Genuine signup proof still
  verifies, the tampered proof fails, and permission/response checks remain.
- `npm run lint`, `npm run typecheck`, production build (8GB heap): PASS
  (`.local/email-design-{lint,types,build}.log`). Live verification settings were
  explicitly empty in the build process; the running local env was preserved.
- Production trace inspection: PNG present in148 of158 traces, zero private
  env/fixture/memory paths. No dependency or migration change.
- Chromium synthetic preview at320/390/1440: no overflow, original logo loads,
  primary action58px high and keyboard-reachable, action and alt remain usable
  without the image. An extra900-character synthetic proof also wraps safely.
  Phone/desktop captures were visually inspected; CID was replaced with the
  same PNG's data URL only for this browser preview. No real proof used.
- Mechanical detector emitted two font warnings about Arial. Intentional
  email-only compatibility exception: inline native font fallbacks avoid an
  external font request; the original wordmark retains the brand typography.
  No design-system font change or broad ignore rule was added.

A fresh Gmail visual-delivery test of this body has NOT RUN: the owner account
is already verified, and Better Auth intentionally does not resend verification
to it. Existing received emails keep their old content. Do not reset verification
state, forge a proof or use another account's proof to force a visual test.
The earlier live signup/inbox/link/sign-in result remains evidence for the
preceding body only. Synthetic preview:
`.local/verification-email-preview.html`; phone/desktop screenshots and layout
measurements are next to it. Changes remain uncommitted in the isolated worktree.

## Subsequent Gmail test and rebase — 2026-11-11

After the earlier design-only checkpoint, the owner requested removal of the
isolated owner test account to permit another signup, then reported that the new
email in Gmail looked professional. This supersedes the earlier statement that
the revised body had not been tested in Gmail. The Gmail sender avatar remains
outside the template's control.

The uncommitted email work was rebased from `2a48b43` onto remote main
`1958765`, retaining all32 changed/untracked files. A private ignored file backup
and retained Git stash are available locally. Auto-merges combined the main
Tutor signup option with the verification copy, plus three context documents;
no Git conflicts occurred. `npm run check` passed2,435 tests; the dedicated test
PostgreSQL auth/account-email/booking-notification suites passed62; the
production build passed. Read-only Chromium checks at390/1440 covered the
signup choices and directory empty state. No new live email, main database
change, deployment, commit or merge occurred during the rebase.
