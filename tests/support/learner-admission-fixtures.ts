// Trusted owner provisioning of synthetic policy/task metadata ONLY. Identity,
// factor enrollment, evidence and decisions run through actual provider/domain APIs.
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import {
  admissionPolicyDigest,
  validateAdmissionCapability,
  type EnabledAdmissionCapability,
} from "@/features/learner-admission/policy";
export const syntheticAdmissionFields = {
  authority: "synthetic_test",
  source: "synthetic_readiness",
  version: "synthetic-admission-v1",
  reference: "synthetic:admission:v1",
  marketCode: "synthetic_test",
  noticeVersion: "synthetic-notice-v1",
  guardianProofMethod: "synthetic_guardian_review",
  independentEligibilityRule: "synthetic_independent_review",
  reviewerCapabilityCode: "learner_admission_review",
  revocationEffect: "deny_current_learner_access",
} as const;
export function syntheticAdmissionPolicy(
  policyId: string,
): EnabledAdmissionCapability {
  const value = {
    ...syntheticAdmissionFields,
    policyId,
    contentDigest: admissionPolicyDigest(syntheticAdmissionFields),
  };
  const cap = validateAdmissionCapability(value);
  if (cap.authority === "disabled")
    throw new Error("Synthetic fixture invalid.");
  return cap;
}
export async function provisionAdmissionPolicy(owner: Pool) {
  let id = (
    await owner.query(
      "SELECT id FROM learner_admission_policies WHERE source='synthetic_readiness' AND market_code='synthetic_test' AND version='synthetic-admission-v1'",
    )
  ).rows[0]?.id as string | undefined;
  id ??= randomUUID();
  const cap = syntheticAdmissionPolicy(id);
  await owner.query(
    `INSERT INTO learner_admission_policies(id,source,authority,version,reference,market_code,content_digest,notice_version,guardian_proof_method,independent_eligibility_rule,reviewer_capability_code,revocation_effect)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING`,
    [
      id,
      cap.source,
      cap.authority,
      cap.version,
      cap.reference,
      cap.marketCode,
      cap.contentDigest,
      cap.noticeVersion,
      cap.guardianProofMethod,
      cap.independentEligibilityRule,
      cap.reviewerCapabilityCode,
      cap.revocationEffect,
    ],
  );
  await owner.query(
    `INSERT INTO learner_admission_policy_state(source,market_code,current_policy_id,enabled) VALUES('synthetic_readiness','synthetic_test',$1,true)
 ON CONFLICT(source,market_code) DO UPDATE SET enabled=true,current_policy_id=excluded.current_policy_id,revision=learner_admission_policy_state.revision+1,updated_at=clock_timestamp()`,
    [id],
  );
  return cap;
}
export async function assignAdmissionReviewer(
  owner: Pool,
  admissionId: string,
  reviewerId: string,
) {
  const client = await owner.connect();
  try {
    await client.query("BEGIN");
    // Same lock order as the runtime functions, including requester/reviewer users.
    await client.query(
      `SELECT u.id FROM "user" u WHERE u.id=$1 OR u.id=(SELECT requester_user_id FROM learner_admissions WHERE id=$2) ORDER BY u.id FOR NO KEY UPDATE`,
      [reviewerId, admissionId],
    );
    await client.query(`SELECT public.lock_learner_admission($1,NULL,$2)`, [
      reviewerId,
      admissionId,
    ]);
    await client.query(
      `INSERT INTO learner_admission_reviewers(user_id,source,capability_code,active) VALUES($1,'synthetic_readiness','learner_admission_review',true)
 ON CONFLICT(user_id,source,capability_code) DO UPDATE SET active=true,updated_at=clock_timestamp()`,
      [reviewerId],
    );
    await client.query(
      `INSERT INTO learner_admission_assignments(admission_id,reviewer_user_id,source,capability_code) VALUES($1,$2,'synthetic_readiness','learner_admission_review')
 ON CONFLICT(admission_id) DO UPDATE SET reviewer_user_id=excluded.reviewer_user_id`,
      [admissionId, reviewerId],
    );
    await client.query("COMMIT");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}
