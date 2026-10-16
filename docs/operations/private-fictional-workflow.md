# Private fictional Parent/Tutor workflow

The owner selected **private staging with fictional accounts and payments disabled**
on 2026-10-16. This is software rehearsal, with no real-family intake, charges,
automatic consent, automatic tutor approval, meeting creation or attendance claim.
The [implementation blueprint](../../prompts/features/m8-03-private-fictional-workflow.md)
and [audience decision](../decisions/2026-10-16-private-fictional-staging.md) govern this slice.

## Activation boundary

The application defaults remain unchanged without `PRIVATE_WORKFLOW_CONFIG_FILE`.
An active packet must be an owned `0600` JSON file inside an owned `0700` `.local`
directory, without symlinks. It binds one exact application origin, database
identity, finite lowercase `.test` account list, admission receipt, current screening
receipt and v2 booking receipt. Invalid or mismatched packets fail closed.
Production and the ordinary Neon development target are refused.

Supported runtime compositions are an owned loopback `learli_test` rehearsal and
the existing registered hosted account runtime in `APP_ENV=staging`. Hosted mode
still requires its exact source/target packet, independent secrets, signed ingress,
verified active identities, ownership checks and current MFA for assigned admins.
Do not change the runtime's environment to `test` to enable a hosted route.

**Hosted activation has not been performed by this change.** The new metadata CLI
deliberately supports only the owned local test target. A reviewed target-specific
hosted preparation adapter and actual isolated staging provisioning are still
required before enabling a hosted packet. Do not repurpose local fixture tooling,
copy a local database URL into staging, or infer that a parsing/unit test proves
hosted provider or database operation.

## Local automated rehearsal

With this checkout's existing isolated test environment and PostgreSQL tools:

```sh
npm run db:start
# Apply reviewed test migrations only if the owned test schema is not current.
npm run db:migrate:test
node scripts/with-test-env.mjs npm run build
npm run test:e2e:private
```

The separate Playwright configuration uses the normal production build at
`http://127.0.0.1:3121`, not a copied application or replacement feature factory.
Its setup records a finite run-specific packet in
`.local/private-fictional-workflow-browser/packet.json`, preserves the previous
packet, and uses only the owned `learli_test` database. Accounts register and verify
through the actual provider/UI; an owner test fixture grants the test admin role,
and the admin enrolls an actual test authenticator. Trace, video and automatic
failure screenshots are disabled around proofs and private data.

Policy/task preparation is explicit metadata only. For manual local operator use,
load the isolated test environment without printing credentials and invoke:

```sh
node scripts/with-test-env.mjs env \
  APP_URL=http://127.0.0.1:3121 BETTER_AUTH_URL=http://127.0.0.1:3121 \
  node --import tsx scripts/private-workflow.ts \
  --test --apply --config .local/private-fictional-workflow-browser/packet.json \
  --action prepare --reviewer <allowlisted-admin-email>
```

The same base command supports:

- `--action assign-admission --admission <request-uuid>`
- `--action assign-screening --tutor <profile-uuid> --valid-until <UTC-ISO-instant>`
- `--action grant-confirmation --booking <booking-uuid> --valid-until <UTC-ISO-instant>`
- `--action grant-account --account <exact-account-id>`

The packet origin must equal `APP_URL`. The reviewer must already be an active,
verified, allowlisted admin, distinct from the requester/tutor. Expiry must be
finite and within the current screening window. Repeat preparation verifies the
exact immutable receipt before reuse; conflicts roll back. Commands do not create
users, verify email, enroll factors, record evidence, authorize a learner or approve
a tutor. Screening staff expiry is shared by reviewer/provenance, so choose it
deliberately when assigning multiple tutor reviews.

`grant-account` is supported only for the owned local-test private packet. It
provisions the exact `local_fixture` restriction target and authorized staff grant
for one already-registered, in-packet, nonself/non-Admin account. It does not change
roles or account access, approve eligibility, grant every packet member, replace a
different source, or revive a revoked grant. Repeating the same authorized grant
does not duplicate its metadata event. Hosted account management remains unsupported.

## Connected user path

1. Parent registers, verifies email, signs in and explicitly continues as parent.
2. **Learners → Add a learner** requests reviewed admission. Middle School is the
   implemented category for Grade 8; exact grade storage is not supported. Pending
   admission grants no learner/guardian access.
3. An explicitly assigned admin with current MFA records both required fictional
   guardian checks and authorizes access. The parent then sees the learner.
4. Tutor registers, starts an application, saves profile/subjects/levels/time zone,
   requests screening and sets availability. An assigned MFA admin records required
   current fictional checks and approves screening. Approval cannot skip evidence.
5. Parent discovers the eligible tutor and time, chooses the authorized learner at
   `/bookings/new`, and creates a provisional request. The assigned admin confirms
   prerequisites; no payment is taken and no Tutor acceptance step is invented.
6. Parent and assigned Tutor see the same booking. Tutor saves a validated private
   Zoom/Meet link. Access is rechecked when opened; unrelated accounts are denied.
7. After the saved scheduled end, the assigned Tutor can record administrative
   completion. The booking history retains its outcome. Ending the external call
   alone never changes Learli status.

QA policy inputs remain 60-minute lessons, 30-minute start steps, 60-minute notice,
a 14-day horizon, a ten-minute provisional hold and 60-minute change cutoffs.
These are fictional test inputs, not launch commercial or safeguarding policies.
A newly created booking therefore cannot complete during a short immediate test:
do not substitute a different historical fixture and report a same-booking pass.

## Account mail and external boundaries

Local rehearsal uses the existing private local mailbox. Hosted account mail may
explicitly select `private-capture` with the exact app origin and an existing
owned absolute `.local` directory. It stores bounded `0600` provider verification,
reset and email-change records for operator access; there is no public capture
endpoint and no real email send. Follow the actual captured verification link;
never directly update `email_verified`. Capture failure/full capacity is visible
as failure and requires deliberate operator cleanup, not silent delivery success.

Private account capture does **not** enable Resend booking delivery. Booking
notification intents can be queued without claiming delivery. Real inbox delivery,
real Zoom/Meet connection and attendance remain separate checks. The browser test
intercepts the fictional external meeting destination and makes no video call.

Keep captures, passwords, cookies, factors and full private meeting links out of
Git, console logs and screenshots. Hosted target selection, deployment, account
purging and provider messages are separate explicit operations.
