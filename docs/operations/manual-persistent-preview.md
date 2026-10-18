# Manual persistent-booking preview

This local, fictional-only preview is separate from the older simulation
accounts and from automated fixture databases. It runs the actual persisted
booking workflow. It is not a hosted staging deployment or production launch.

Checkout: `/Users/cob/orca/workspaces/learli/private-manual-20261017`.
Origin: **http://localhost:3200**. Use this hostname consistently.
Database: owned loopback PostgreSQL `127.0.0.1:55433/learli_test`.

## Start, stop and account access

From the manual checkout, the explicit private loader starts the normal build:

```sh
node .local/manual-preview/run.mjs start
```

Use Ctrl-C in its own Orca terminal to stop it. Restarting preserves the database,
accounts, packet, MFA and booking history. To build after a deliberate source
update, stop that server and run `node .local/manual-preview/run.mjs build`.
The loader passes private environment to the child process; it does not put
`--env-file` into Next.js worker options.

The private credential sheet is `.local/manual-preview/accounts.html` in this
checkout. Open it locally; it is not served by Learli. It contains unique fresh
Parent, independent College Student, Tutor Maya, assigned Admin and unrelated
account credentials. The Admin setup key and real provider recovery codes are
kept there for the owner to import into a time-based authenticator. Keep this
file private. Do not screenshot it, upload it or commit it. Browser sessions,
cookies and verification tokens are not exported.

The exact original 24-hour authority expiry appears prominently in this sheet.
Startup and dispatch never renew the packet, policies, MFA or evidence. After
expiry, arrange an explicit scoped maintenance task; do not erase the database,
regenerate a packet or weaken permission checks to recover access.

## Same workflow, genuine saved state

1. Sign in as Parent. Use Parent Profile / My Children and the already reviewed
   fictional Grade 8 child, or submit a new fictional child for review. Eligible
   independent College Students use their own reviewed learner profile.
2. Browse Find a Tutor or Get Matched. Choose Math for the Grade 8 learner or
   College Science for the independent learner. Select an actual available slot
   and **Request booking**. Only one provisional record should result.
3. Prepare new pending review work explicitly from the manual checkout:

   ```sh
   node .local/manual-preview/run.mjs dispatch
   ```

   This reads the exact assigned Admin from the private checkpoint, snapshots at
   most 20 eligible pending records and prepares metadata only. Counts are printed;
   exact receipts remain private under `.local/manual-preview-dispatch/`.

4. Sign in as the assigned Admin with current MFA. Review the assigned request
   and confirm within its ten-minute provisional deadline. Admin role alone does
   not authorize arbitrary booking access. New child/Tutor submissions also need
   their actual assigned fictional-evidence review, not merely dispatch.
5. Refresh Parent / Student / Tutor and assigned Admin views as applicable. Check
   the same booking, learner, tutor, subject, UTC instant/local time and status.
   Parent-managed Child A is not an independently login-enabled Student account.
6. Assigned Tutor saves a validated private Zoom/Meet link on the confirmed
   booking. Authorized participants can open it. Admin and unrelated accounts
   cannot see participant-private joining details. Actual video connection is a
   separate manual check; opening a link does not establish attendance.
7. After the actual scheduled end, the assigned Tutor completes the lesson using
   Learli's supported action. All authorized history views should agree. Ending
   Zoom/Meet does not automatically complete it. Never modify saved timestamps
   to make a fresh lesson appear finished.
8. Test cancellation/rescheduling through the supported guarded controls. Keep
   the existing notice, overlap and cutoff policies; inspect replacement/history
   semantics instead of expecting a second unrelated active booking.

**Provisional** still means unconfirmed and can expire. **Confirmed** survives
that deadline. **Completed** requires the actual supported Tutor action after
end. Private-test scope remains visible once; the active preview does not use the
legacy ten-minute simulation reservation path. Old simulation records retain their
original provenance outside this new database.

## Isolation and maintenance

- Runtime `.env.manual.local` has only the restricted application connection;
  its owner connection is explicitly empty. Owner preparation uses separate
  `.env.manual-operator.local`. Both are ignored private `0600` files.
- `.env.test.local` deliberately refuses ordinary automated test runners in this
  checkout. `.env.local` disables accidental legacy startup. Never replace these
  with the ordinary generated fixture environment.
- Do not run seed, reset, global browser setup, integration suites or restore
  drills against this long-lived manual target. Automated checks belong to the
  original checkout's independently owned port 55432 test database.
- Start its owned cluster with `LEARLI_DB_PORT=55433 LEARLI_DEV_PORT=3201
LEARLI_TEST_PORT=3200 npm run db:start` only in this manual checkout if needed.
  Existing environment files are preserved. Do not run `local:setup` here.
- The private bootstrap is a guarded one-off authoring artifact, not a startup
  hook. It uses actual signup, local captured verification, provider MFA,
  onboarding and assigned reviews; only the verified finite test Admin's initial
  trusted role is owner-provisioned. It creates no bookings or historical lessons.
- No live Resend send, payment, real family data, external meeting creation,
  hosted resource change or production operation is part of this setup.

Executed evidence and known limitations belong in `context/progress-tracker.md`.
