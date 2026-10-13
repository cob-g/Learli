# Recovery — W2 pooled hosted runtime provider

Authority: **AUTHORIZED — build-feature delegation**, W2 task_b3b956915365 /
ctx_744e40c196bb. Branch cob-g/m8-hosted-runtime-foundation, baseline2fa0294.
M2.1/M8.3, NFR-05/06/11. Local synthetic scope; no external data or incident.

## Attempt 1 — TypeScript checkout overload (2026-10-12)

Mode: Targeted Fix. `npm run typecheck` exited2 with TS2394 at hosted-runtime.ts
connect(): overload signature incompatible with implementation signature.
Original evidence: ignored `.local/hosted-readiness-wave/types-1.log`.
Unit checks independently passed101 (two files), not type verification.

Observed cause: private checkout returns concrete RuntimeLease while the public
promise overload returns the deliberately narrower HostedRuntimeClient interface;
inference made the implementation return type more concrete than the public
overload contract. No runtime/raw-client path failure is indicated by this error.
Recommend an explicit `Promise<HostedRuntimeClient> | void` implementation return
annotation. Preserve every guard, the bounded API and concrete private checkout.
No reset, cast weakening, package/schema/shared-file change or new policy needed.

Separate implementation applies the annotation, scoped read-only Review checks
it, then separate Verify reruns strict types and planned actual-PG checks.
Verification NOT RUN BY RECOVER. Original failure remains retained.

## Separate implementation and Verify outcome

Explicit implementation return annotation applied; same-agent scoped read-only
Review PASS for the revised declaration. Separate `npm run typecheck` exited0,
then final `npm run check` exited0 with format/lint/types and989unit/component
checks. Final real TLS W2 PostgreSQL40 and production build also passed.
The original failure log remains unchanged. Recovery is resolved locally;
no independent Review, actual provider or shared integration result is implied.
