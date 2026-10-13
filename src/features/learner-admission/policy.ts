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
export type EnabledAdmissionCapability = z.infer<typeof policy>;
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
  const value = policy.parse(input);
  if (admissionPolicyDigest(value) !== value.contentDigest)
    throw new Error("Invalid admission policy digest.");
  return Object.freeze(value);
}
