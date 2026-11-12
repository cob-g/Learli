# CI recovery: Resend verification PR

Authority: user requested CI repairs before merging PR #1; authorized targeted test and CI fixes. Preserve production behavior and user data.

The integration job failed on both the base branch and PR. Inspection of the failed GitHub logs and fixtures identified mismatched PostgreSQL host/server ports in the disposable CI service, missing Git history for migration immutability checks, a synthetic screening expiring before its test bookings, and locale-dependent ordering of synthetic recipient IDs. Two additional intermittent PR failures were observed and require investigation if reproduced; their causes have not been established.

Recovery: align the disposable CI service's actual and client ports with an identity check, fetch the migration history, align the synthetic screening validity with the fixture sessions, and make fixture ordering deterministic. Preserve the migration comparisons and all authorization and booking safeguards. Verify affected tests, the full integration suite, check/build and browser E2E, then inspect GitHub checks before merging. No production database changes are authorized or required.
