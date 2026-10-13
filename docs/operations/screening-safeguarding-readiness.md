# Screening and safeguarding software readiness

Authority: AUTHORIZED — build-feature delegation, W8. This software acceptance is
not approval of any actual screening threshold, human responder, meeting guidance,
retention rule, or public launch.

The shipped `getScreeningContext` and `getSafeguardingContext` factories are disabled.
No environment flag activates them. Missing policy, required current evidence, exact
reviewer/task grants, verified active account, or current MFA denies readiness actions.
A readiness marker is permanent: an enrolled tutor never falls back to demo eligibility.
The SQL predicate accepts only `local_demo` or `synthetic_readiness`; operational and
unknown scopes return false. Its VOLATILE SQL reads use fresh database time after an outer mutation waits; no command-start expiry clock is reused. Existing demo records remain in the old demo scope.

Owner-only fixture tooling creates versioned fictional packets and separate expiring
reviewer, dispatcher, reviewer-choice and account-restriction grants. It rejects
cross-source collisions. A named policy owner does not gain global case access.
Dispatch queues project metadata only, excluding report subject/body, requester,
learner and meeting information. Acknowledgment is bound to the current assignment;
reassignment/escalation and reopening clear it. Account restoration cannot reinstate
screening, revive bookings or grant support case access.

`0024_screening_safeguarding` follows the root-accepted `0023` bridge. Historical
migrations remain unchanged. Policy/evidence/decision/action history is append-only;
current heads, permanent enrollment and bound receipt completeness are constrained.
Runtime grants use narrow functions and deny direct authority/history/status writes.
Mutations take domain locks, recheck actual current authority after waits and after
writes, and roll back the transaction on a late denial.

Local browser acceptance uses `scripts/w8-readiness-mirror.ts` with this checkout's
own isolated test database and assigned ports. It copies complete application source,
records source hashes and exact diffs, and overrides only the two composition factories
with fixed versioned synthetic packets. It does not mock session, MFA, permission,
domain or database code. Its accounts, authenticator material, screenshots, source
manifest and failures stay in ignored private artifacts. The ordinary application
must separately prove no-intake/default-deny behavior. Browser success is not actual
human monitoring, identity screening or external message delivery.

Forward recovery requires a reviewed correcting migration and preserved history.
There is no destructive down migration or authorization to restore production data.
Root performs independent combined review, normal-command discovery and full-wave
verification before considering any software milestone complete.

The owned mirror serially runs `next build` then `next start`. Its default port is
3098; `LEARLI_SCREENING_MIRROR_PORT` selects another reserved loopback port in an
isolated checkout. `LEARLI_ADMISSION_MIRROR_PORT` similarly selects the admission
mirror (default3095). Both validate the current checkout's private database marker,
port and owner/runtime credentials before touching its synthetic `learli_test`
database. A peer checkout's test database is rejected; values stay out of errors.

Root authorized the production-mode harness after retained evidence showed development
refresh loops interrupting mutation pages. Shipped application configuration and
application bytes remain unchanged; exactly the two recorded synthetic composition
overrides apply. Normal registered Chromium and Firefox/WebKit commands use the same
selected placement. The ordinary server continues to exercise default-disabled flows.
