import { z } from "zod";
import { learnerFields, validateLearnerGrade } from "@/features/learners/input";
import { canonicalAdmissionSelection } from "@/features/learner-admission/input";

export const parentChildInput = learnerFields
  .extend({
    requestId: z.uuid(),
    policyVersion: z.string().min(1).max(80),
    policyDigest: z.string().regex(/^[a-f0-9]{64}$/),
    noticeVersion: z.string().min(1).max(80),
    guardianConfirmed: z.literal(true, {
      error: "Confirm that you are this child’s parent or authorized guardian.",
    }),
    consentConfirmed: z.literal(true, {
      error: "Confirm your consent to create and manage this child’s profile.",
    }),
    next: z
      .string()
      .max(2048)
      .refine((value) => canonicalAdmissionSelection(value) !== null, {
        error: "Return to the tutor directory to choose a current time.",
      })
      .optional(),
  })
  .superRefine(validateLearnerGrade);
