# Parent Step 2 validation recovery

- Authority: AUTHORIZED — build-feature delegation for the parent Step 2 slice.
- Environment: isolated `parent-step2-20261017` worktree; owned loopback test DB.
- Observed first `npm run check`: formatting and lint PASS, generated route types
  PASS, then TS2493/TS2339 in the new learner-creation component test (line 213).
  The argument-free async mock inferred an empty call tuple, so inspecting its
  request options was ill-typed. This is a test typing defect, not a runtime
  account/guardian failure or a reason to change business behavior.
- Mode: targeted fix. Give the synthetic fetch mock explicit request/options
  parameters; preserve its request body assertion. No reset or test weakening.
- Coordinator delegates implementation to the owning UI worker, then independently
  reviews the narrow diff and reruns affected tests/types and the combined check.
- Database and browser verification are separate; their status is not inferred
  from this diagnosis. Original preview and Neon remain untouched.

## Subsequent observed validation and scoped recovery

- Old Parent dashboard assertions updated to the approved guarded Add Child route;
  no pending-access or permission assertion removed.
- Owned private `.local` directory0755 caused correct fixture refusal; restricted
  it to0700, without altering the guard.
- Historical migration tests compared additive grade against old whole-row hashes
  and expected latest grants before applying them. They now compare every original
  column and inherited function OID/body/owner/ACL before granting the exact latest
  policy. New0033 fixture supplies its required session timestamps.
- Existing Neon TLS test mocked the old runtime getter only; it now exposes the
  same actual guarded runtime through the current domain getter. Original HEAD
  has the same stale mock, so this is not a feature-introduced product regression.
- Hosted auth tests initially lacked an assigned TLS port; rerun used owned55444.
- New browser test reloaded while client navigation was pending; destination URL
  and heading waits now precede reload, with no arbitrary sleeps. A capture during
  hydration/finite button transition was invalid; final audits wait for enabled
  controls and completed finite transitions. No product contrast patch was added.
- Separate final verification: strict check2,064/137 PASS; six affected PostgreSQL
  files28/28 PASS after the initial full82-file run; normal browser23 PASS; private
  main journey1 PASS; normal development journey1 PASS with12 zero-violation Axe
  captures. Initial failures/logs retained. No remote write or reset occurred.
