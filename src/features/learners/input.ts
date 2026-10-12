import { z } from "zod";
import { timeZoneSchema } from "@/lib/validation/time-zone";

export const learnerInput = z.strictObject({
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
});

export function describeLearnerIssues(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fields[key]) fields[key] = issue.message;
  }
  return { message: "Check the learner fields and try again.", fields };
}

export const createLearnerInput = learnerInput.extend({
  requestId: z.uuid({ error: "Reload the form to start a new request." }),
  management: z.enum(["guardian", "self"], {
    error: "Choose a local profile type.",
  }),
});
