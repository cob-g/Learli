# Admin workflow — local verification record

**VERIFIED LOCAL for the approved private fictional scope; hosted activation is
not verified.** The scope is defined by the
[blueprint](../../prompts/features/m5-06-admin-workflow-acceptance.md),
[decision](../decisions/2026-10-16-scoped-admin-workflow.md) and
[corrected checklist](admin-workflow-checklist.md).

Baseline: existing dirty branch `feature/staging-interface-cleanup-20261016`,
HEAD `572cf4d`; exact 1,143-file snapshot and initial status/diff retained under
`.local/admin-workflow-20261016/`. Prior Student/Parent/Tutor verification remains
historical and does not prove the new Admin journey.

Authority is **AUTHORIZED — build-feature delegation**, not separate human
blueprint inspection or deployment approval.

## Ten-step result

| Step                      | Result                             | Verified scope / limitation                                                                                                                                                                                            |
| ------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Authentication         | PASS locally                       | Actual signup/verification, trusted Admin bootstrap, actual MFA, identity/refresh, actual logout and protected revisits.                                                                                               |
| 2. Dashboard              | PASS for scoped workspace          | Identity and navigation work; platform-wide user/role/booking totals remain deferred.                                                                                                                                  |
| 3. User management        | PASS for assigned local targets    | Literal name/role/status filters, populated pagination, read-only trusted roles, detail/history and suspend/restore. No global directory or role editing.                                                              |
| 4. Tutor administration   | PASS for basic assigned tasks      | Evidence-based screening, private legacy review denial, suspension blocks discovery/new valid-slot booking, stored bookings/roles/sessions retained, restore preserves independent eligibility rules.                  |
| 5. Subjects               | PASS for exercised catalog changes | Specialized add/duplicate rejection, rename, deactivate/reactivate, references and audit/retry. History resolves the current name, not an original-name snapshot.                                                      |
| 6. Booking administration | PASS for assigned records          | Exact-ID/status filters, populated pagination/backlinks, minimal self/guardian participants, UTC/local times and states. No universal access or meeting credentials.                                                   |
| 7. Reviews/ratings        | NOT APPLICABLE                     | Public review publication remains gated.                                                                                                                                                                               |
| 8. Payments               | NOT APPLICABLE                     | Disabled; no checkout or transactions tested.                                                                                                                                                                          |
| 9. Permissions/audits     | PASS within tested scope           | Exact assignments, current MFA/policies/audience, foreign roles/Admins, stale/revoked authority, rollback/replay and actual mutation events. Not universal read auditing.                                              |
| 10. UI/navigation         | PASS within bounded checks         | Booking queue, invalid catalog form, account list and confirmation dialog at 320/390/1440px with overflow/Axe; keyboard, dismissal, validation and preserved navigation. Not a full manual visual/screen-reader audit. |

Account tools/operator support only the owned **local-test** packet and exact
`local_fixture` grants. Hosted account management remains unsupported. Packet
membership never supplies account/booking authority.

## Review and executed checks

- Cross-author read-only Review: alignment, integrity, unintended changes and
  documentation PASS; **READY FOR VERIFICATION**, zero open confirmed findings.
  Account author reviewed browser/root; browser author reviewed account and
  Tutor/booking source; Tutor/booking author also reviewed root/shared changes.
  Subsequent test-only repairs were independently re-reviewed. The coordinator
  separately executed verification; Review ran no checks.
- Final integrated `npm run check`: PASS for formatting, ESLint, TypeScript and
  **130 unit/component files / 1,990 tests**; final test phase 12.18 seconds.
- `node scripts/with-test-env.mjs npm run build`: PASS. Four existing dynamic
  filesystem tracing warnings remain. All **140 traces** exclude local state and
  local environment files. Application/configuration source did not change during
  the later test-only repairs.
- Serialized affected actual PostgreSQL: **20 files / 339 tests PASS**, 143.50
  seconds. Covers scoped accounts, staff bookings, Tutor audience/operator,
  restrictions/mutation isolation, Admin MFA, catalog/screening, admission/Parent
  onboarding, policy bookings, meeting privacy, Student/Parent read scopes and
  Tutor completion. This is an affected selection, not every integration suite.
  Existing 34 test migrations were current; none applied in this unit.
- `npm run test:e2e:private`: **3/3 PASS**, normal production build, Chromium,
  one worker/no retries, **35.8 seconds** total: Admin 16.4, Student 10.8,
  Parent/Tutor 6.8 seconds. Actual signup, verification, MFA, reviewed admission,
  screening, fresh browser bookings, exact grants, confirmation, records,
  catalog/account actions, participant denials and logout were exercised.

Separately already-ended synthetic records completed through actual assigned-Tutor
controls and appeared in history. They are not the newly booked future lessons,
real elapsed teaching or attendance. Initial Admin fixture availability uses an
authenticated request, not schedule-editor acceptance. External meeting
destinations were intercepted; real email delivery/video were NOT RUN.

## Defects and failed attempts retained

Tutor audience regression reproduced before repair: **three failed/two passed**.
A retained outside-packet legacy grant admitted queue/detail and review mutation.
Final six scope tests pass, including observed lock-wait packet activation and
rollback. Private actions now use current assigned evidence-based screening.

Worker booking tests initially exposed an internal-function permission mistake
and a new-endpoint Origin expectation; targeted fixes added no grants. Review
caught misuse of the live confirmation operator for a historical fixture; exact
owner fixture metadata now preserves its live-only guard and actual completion.
Browser attempt 1 failed 3/3 on a POST-only route read, shared-directory expectation
and auth-counter isolation. Attempt2 passed Parent/Tutor but failed Admin navigation
timing and the final Student account menu, with the shared session counter at its
limit. Test-only repairs await exact destinations, select content backlinks,
assert exact known Tutor sets and reset guarded owned-test auth counters only
**between** cases. No production limit, permission, request or behavioral
assertion was weakened. Attempt 3 passed all three; final check repeated afterwards.

See the [recovery record](../../prompts/recovery/2026-10-16-admin-workflow-validation.md).
Failed logs/contexts, final logs, hashes and baseline are private under
`.local/admin-workflow-20261016/`; earlier worker logs are also retained.

## Closeout and limitations

This unit changes 50 scoped files, including docs and test repairs, against the
preserved 1,143-file dirty baseline. No new schema, runtime grant, dependency,
provider write, commit, merge, push, account purge or deployment. Test PostgreSQL
stopped after zero other clients, data retained; browser 3121 stopped. Owner
preview 3000 kept its existing process and health 200 on its prior configuration;
it is not this private rehearsal.

Next: reviewed adapter/preparation for an explicitly selected isolated hosted
target, then authorized staging acceptance. Dashboard totals remain separate.
Real-family, safeguarding/public-review and payment launch gates remain; this
local pass does not complete M5/M8 or authorize production release.
