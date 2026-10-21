import { z } from "zod";
import { canonicalAdmissionSelection } from "@/features/learner-admission/input";
import { timeZoneSchema } from "@/lib/validation/time-zone";

export const independentLearnerInput = z.strictObject({
  requestId: z.uuid({ error: "Reload the form to start a new request." }),
  policyVersion: z.string().min(1).max(80),
  policyDigest: z.string().regex(/^[a-f0-9]{64}$/),
  noticeVersion: z.string().min(1).max(80),
  displayName: z
    .string()
    .trim()
    .min(1, "Enter your display name.")
    .max(80, "Use 80 characters or fewer."),
  timezone: timeZoneSchema,
  eligibilityDeclared: z.literal(true, {
    error:
      "Confirm that you are legally eligible to manage this tutoring account independently.",
  }),
  next: z
    .string()
    .max(2048)
    .refine((value) => canonicalAdmissionSelection(value) !== null, {
      error: "Return to the tutor directory to choose a current time.",
    })
    .optional(),
});

export function describeIndependentLearnerIssues(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fields[key]) fields[key] = issue.message;
  }
  return {
    message: "Check your profile details and eligibility declaration.",
    fields,
  };
}
