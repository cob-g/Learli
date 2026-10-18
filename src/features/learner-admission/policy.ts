import { createHash } from "node:crypto";
import { z } from "zod";

const policy = z.strictObject({
  authority: z.literal("synthetic_test"),
  source: z.literal("synthetic_readiness"),
  policyId: z.uuid(),
  version: z.literal("synthetic-admission-v1"),
  reference: z.literal("synthetic:admission:v1"),
  marketCode: z.literal("synthetic_test"),
  contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
  noticeVersion: z.literal("synthetic-notice-v1"),
  guardianProofMethod: z.literal("synthetic_guardian_review"),
  independentEligibilityRule: z.literal("synthetic_independent_review"),
  reviewerCapabilityCode: z.literal("learner_admission_review"),
  revocationEffect: z.literal("deny_current_learner_access"),
});
const local = policy.extend({
  authority: z.literal("local_operation"),
  source: z.literal("local_operation"),
  version: z.literal("local-admission-v1"),
  reference: z.literal("local:admission:v1"),
  marketCode: z.literal("local_operation"),
  noticeVersion: z.literal("local-notice-v1"),
  guardianProofMethod: z.literal("local_guardian_review"),
  independentEligibilityRule: z.literal("local_independent_review"),
});
const enabled = z.discriminatedUnion("authority", [policy, local]);
export type EnabledAdmissionCapability = z.infer<typeof enabled>;
export type AdmissionCapability =
  { authority: "disabled" } | EnabledAdmissionCapability;
export const disabledAdmission: AdmissionCapability = { authority: "disabled" };
export function admissionPolicyDigest(
  value: Omit<EnabledAdmissionCapability, "policyId" | "contentDigest">,
) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        value.authority,
        value.source,
        value.version,
        value.reference,
        value.marketCode,
        value.noticeVersion,
        value.guardianProofMethod,
        value.independentEligibilityRule,
        value.reviewerCapabilityCode,
        value.revocationEffect,
      ]),
    )
    .digest("hex");
}
export function validateAdmissionCapability(
  input: unknown,
): AdmissionCapability {
  if (
    z.strictObject({ authority: z.literal("disabled") }).safeParse(input)
      .success
  )
    return disabledAdmission;
  const value = enabled.parse(input);
  if (admissionPolicyDigest(value) !== value.contentDigest)
    throw new Error("Invalid admission policy digest.");
  return Object.freeze(value);
}

const localTerms = {
  authority: "local_operation",
  source: "local_operation",
  version: "local-admission-v1",
  reference: "local:admission:v1",
  marketCode: "local_operation",
  noticeVersion: "local-notice-v1",
  guardianProofMethod: "local_guardian_review",
  independentEligibilityRule: "local_independent_review",
  reviewerCapabilityCode: "learner_admission_review",
  revocationEffect: "deny_current_learner_access",
} as const;
export const localAdmissionPolicy = Object.freeze({
  ...localTerms,
  policyId: "8a3658c1-773a-4533-81c6-49ff79870211",
  contentDigest: admissionPolicyDigest(localTerms),
});
