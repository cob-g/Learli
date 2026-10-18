# Parent setup failure in the preserved preview

## Observed

Owner screenshot shows the authenticated Parent setup page, no workspace, and
safe generic failure after Continue as parent. Original preview3000 process is
owned by `/Users/cob/learli`; its source calls `enroll_parent_workspace` from
migration0032. A fresh exact-target Neon development READ ONLY inspection confirms
29 applied migrations and **no** `public.enroll_parent_workspace(text,text)`.
No user records, session values or account details were read.

The service cannot complete enrollment without that function. The transaction
fails without a Parent grant; the existing handler maps the database failure to
503 and the form shows the generic message. The screenshot by itself does not
identify its URL or uniquely distinguish every possible backend failure.

## Classification and recovery

Mode1: application/schema mismatch in the preserved development preview.
The function and grant exist in already-reviewed source; no new role-grant API,
manual role insertion, user deletion, reset, validation change or error-text patch
is appropriate. Source identity matters: original checkout ends0033; the isolated
parent feature candidate adds0034. Both are ahead of this remote ledger.

Use the aligned isolated3300 preview for fictional testing, or execute the
concrete exact-development migration and original-preview update plan in
`docs/operations/parent-step2-rollout.md` after its separate authorization. Preserve
all existing accounts/history; no remote write was performed for this diagnosis.
Then verify real enrollment and child flow against the actual updated target.

Restricted factual metadata result:
`.local/parent-step2-20261017/parent-setup-diagnosis.json`.
Independent source investigator reached the same failure-chain explanation;
provider metadata confirmation was performed separately by the coordinator.

## Resolved by authorized development rollout — 2026-10-17

The exact plan subsequently received owner authorization. Six migrations and
canonical grants applied with PASS; parent enrollment function/runtime execution
now exist. Restricted-runtime rollback smoke exercised enrollment and Grade8
creation/retry successfully. Original records preserved; source integrated and
one updated original preview3000 runs. No manual role grant or security bypass.
Actual user can refresh and retry normal onboarding; no user account was deleted.
