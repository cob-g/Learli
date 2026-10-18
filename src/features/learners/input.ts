import { z } from "zod";
import { timeZoneSchema } from "@/lib/validation/time-zone";

export const learnerFields = z.strictObject({
  displayName: z
    .string()
    .trim()
    .min(1, "Enter a display name.")
    .max(80, "Use 80 characters or fewer."),
  level: z.enum(
    ["elementary", "middle_school", "high_school", "college_support"],
    { error: "Choose a level." },
  ),
  timezone: timeZoneSchema,
  grade: z.number().int().min(1).max(12).nullable().optional(),
});

/** School-year metadata stays separate from the broad tutoring level. */
export function validateLearnerGrade(
  value: { level: string; grade?: number | null },
  context: z.RefinementCtx,
) {
  if (value.level === "college_support" && value.grade != null)
    context.addIssue({
      code: "custom",
      path: ["grade"],
      message: "College Support profiles do not use a school grade.",
    });
}
export const learnerInput = learnerFields.superRefine(validateLearnerGrade);

export function describeLearnerIssues(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fields[key]) fields[key] = issue.message;
  }
  return { message: "Check the learner fields and try again.", fields };
}

export const createLearnerInput = learnerFields
  .extend({
    requestId: z.uuid({ error: "Reload the form to start a new request." }),
    management: z.enum(["guardian", "self"], {
      error: "Choose a local profile type.",
    }),
  })
  .superRefine(validateLearnerGrade);
