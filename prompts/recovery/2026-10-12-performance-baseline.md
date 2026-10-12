# Performance baseline recovery

Authority: AUTHORIZED — build-feature delegation, Worker 6 NFR-08/M8.9.
Mode: targeted fix; local tooling only. Baseline5634e44; user data unaffected.

## R1 — Directory accessible-name assertion

Observed in read-only follow-up Review: `tutor-card.tsx` renders visible View
profile text but supplies `aria-label="View profile: <display name>"`. The new
harness's exact accessible-name locator would find zero links and fail before
recording public navigation. R1 initial READY FOR VERIFICATION is superseded by
CHANGES REQUIRED for this confirmed tooling assertion defect; no runtime test
failure is being fabricated.

Recovery recommendation: match the existing accessible-name prefix and retain
the exact20 first-page assertion. Preserve all application accessibility labels,
fixture caps, ownership, timing and failure rules. End Recover before the
implementation changes the assertion; re-review, execute static/unit/build and
the actual public navigation workload separately. No reset or new policy needed.

Recover ran no tests and changed no implementation. Runtime verification is
pending; the coordinator owns repair/re-review/Verify and root independent review.

## R2 — Cleanup exception ordering

Follow-up read-only Review found redundant request-context disposal and browser/
context close operations preceding database cleanup in the outer finally. A
teardown exception could skip the owned fixture transaction and evidence write.
Recommend one centralized disposal pass with settled results, catch each teardown
failure, preserve failure status, and continue exact-owned cleanup/server stop.
Record output after any setup failure once the private directory exists. This is
a targeted harness robustness repair, not permission to delete unrelated data.
Required separate verification: injected context-disposal/partial-fixture failure
plus the ordinary successful lifecycle; Recover executes none of these.

## R3 — Single-connection cleanup proof

Observed read-only: cleanup holds the sole owner pool client through its final
empty-dataset proof. Calling that proof through the pool would wait forever for
the held client. Recommend using the same checked-out client after COMMIT, then
releasing it in finally. No SQL deletion scope or application limit changes.
Separate Verify must complete the actual single-connection lifecycle and confirm
empty owned data; no executed deadlock or passing proof is claimed by Recover.

## R4 — First actual setup attempt: fixture email collision

Exclusive attempt1 under root grant msg_dc50267e5595 exited1 at setup, before any
timing samples. Private results retain original source hashes/conditions; cleanup
PASS. PostgreSQL reported user_email_unique. The owned registry shows two learner
accounts and the first planned tutor. Source inspection confirms learner index0
and tutor index0 generated the same synthetic email namespace. No application
defect or constraint weakening is indicated.

Targeted recommendation: use explicit learner/tutor email namespaces through a
small tested fixture helper; test uniqueness across the complete fixed dataset.
Preserve provider auth, database uniqueness, caps and exact-owned cleanup. End
Recover, implement/re-review, execute affected tests/static checks under a new
normal grant and request a fresh exclusive timing grant. Accepted application
runtime/build bytes are unchanged; no production rebuild is needed for CLI-only
fixture/test edits. Both slots were promptly released after attempt1. No sample
or performance acceptance is claimed from this failed attempt.

## Separate executed resolution

R4 targeted namespace repair passed22 focused cases and full check679 before
later root-supplied runtime updates. Final accepted candidate check685/37files
and production build passed. Fresh exclusive grant msg_29ea3dca9e92 produced
successful2 repetitions/136 timing samples,18 actual conflict pairs including
warmups, idempotency/history/foreign-owner refusal and exact-owned cleanup.
Original attempt1 remains unchanged; no constraint/cap/assertion/authorization
weakened. R1–R3 paths also completed under the actual lifecycle. These results
were executed by Verify, not Recover; same-agent review is not independent.
