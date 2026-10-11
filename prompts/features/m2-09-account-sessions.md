# Implementation Plan — Account session management

Status: **AUTHORIZED — build-feature delegation** (2026-10-11). Execution authority is the dispatched full build request for own active-session listing and secure revocation of own other sessions; no separate human blueprint approval is claimed.

## Outcome and requirement mapping

Verified, active local synthetic account holders can open `/account/sessions` from `/account`, identify the current session, review honest session timestamps and reported browser details, and end another session. Revoked cookies lose protected access on the next server request. PRD AUTH-04, supporting AUTH-02/AUTH-03; build plan M2.3/M2.9. Baseline: clean `cob-g/m2-9-account-sessions` at `3a055deff54149be48a91b44237d0e28b26f3405`.

## Evidence and decisions

- Existing Better Auth 1.7.7, Drizzle auth schema, `requireIdentity` (verified email + active access), private responses, same-origin mutation checks, native controls and `ConfirmDialog` are reusable.
- Official Better Auth session-management docs support `listSessions` and token-based `revokeSession`; cookie caching is already disabled. Inspect installed implementation/types before writing the adapter, retain supported freshness/re-verification semantics, and escalate any material API gap.
- Installed 1.7.7 inspection confirms `listSessions` requires a fresh sign-in (default one day), while `revokeSession` uses authoritative session middleware and provider ownership. Both feature operations first use the supported list, retaining its freshness gate; stale sign-ins receive explicit sign-out/sign-in recovery. No API gap was found.
- Browser receives only session IDs and an explicit safe summary. A server-only adapter resolves the submitted ID from the authenticated user's provider session list to its token; the token never appears in page props, JSON, URLs or logging. No custom token store, auth plugin or raw auth endpoint exposure.
- Current-session revocation is refused here with instructions to use existing Sign out. Foreign/missing/expired session IDs have identical unavailable responses. No admin override.
- Device text is a limited browser/platform description derived from reported user-agent, explicitly unverified; omit IP, raw user-agent and geolocation. `updatedAt` is labelled session refresh, never last active. Timestamps carry an explicit zone.
- Individual revocation only; no email change, MFA, password policy change, roles, learner/bookings/support changes or dependency upgrades.

## Ownership and system invariants

Proposed new files under `src/features/account-sessions/`, `/account/sessions`, `/api/account/sessions` and its revoke route; feature-specific unit/component/integration/browser tests and Playwright configuration, this blueprint, operational note and branch tracker entry. Minimal account-page link only. No schema/migration/grant change expected. All identity checks execute at the protected service boundary; provider ownership and freshness protections remain intact. Existing trusted origins and cookie-cache disabling remain unchanged. Scope is loopback synthetic `.test` only, isolated PG 55455, dev 3015, test 3115; never use other checkouts' environment or databases. No commit, push, merge, deployment or production action.

## Implementation sequence and failure states

1. Inspect installed provider APIs and source; set up pinned dependencies and owned local dev/test environment after ending Architect.
2. Add safe presentation model and protected list/revoke service, with strict bounded session-ID input and safe status/error mapping. Keep tokens only in server-local variables.
3. Add thin private GET/POST handlers with exact same-origin mutation checks; provider mutation receives original authentication headers, preserving freshness semantics.
4. Add session list, current marker, explicit loading/empty/error states, confirmation, pessimistic pending state and accessible feedback/focus. After success reload the real list; stale targets are safely unavailable. Existing Sign out ends current session.
5. Add meaningful tests and factual docs/tracker updates. No product/business clarification is needed unless installed API inspection reveals a gap.

## Verification plan (NOT RUN — architecture stage)

- `npm run check`, real PostgreSQL `npm run test:integration`, production `npm run build` and existing regression browser suite with limited workers, plus dedicated session-management browser cases.
- Two independent provider sessions; safe own-only list/current marker; successful own-other revocation with immediate protected denial; cross-user ID/token tampering; current-session refusal; expired sessions excluded; unverified/suspended/anonymous denial; stale/missing targets; concurrent duplicate revocation; provider freshness denial preserved; bad origin/host/method/input, private no-store and safe outage errors; no serialized token/IP/raw-UA.
- UI at 320/390/768/1440 widths, keyboard confirmation/Escape/focus return, axe, no horizontal overflow, empty/loading/network/failure states, current sign-out and revoked browser access. Inspect screenshots of phone and desktop states.
- Review is same-agent read-only against this exact blueprint, followed by a distinct verification stage; do not claim independent review or full external QA.
- Verify ignored private artifacts and scan client/output for secrets; record exact commands/counts, limits and diff fingerprint; save local ignored memory.

## Context, rollback and open decisions

Update only branch `context/progress-tracker.md` with own observed evidence and a concise operational/API note. Schema rollback is not applicable; removal of the feature files/link reverses UI exposure without changing provider data semantics. Existing legal/safeguarding/payment/production gates remain open and irrelevant to this slice. Coordinator reconciles minimal shared documentation/account-link edits later and owns any combined verification.
