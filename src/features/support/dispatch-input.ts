import { z } from "zod";
export const assignmentKinds = {
  assign: "Assign reviewer",
  reassign: "Reassign reviewer",
  escalate: "Escalate to another reviewer",
} as const;
export const assignmentInput = z.strictObject({
  revision: z.number().int().min(0).max(2147483646),
  reviewerId: z
    .string()
    .min(1, "Choose a reviewer.")
    .max(128)
    .regex(/^[a-zA-Z0-9_-]+$/, "Choose a reviewer."),
  kind: z.enum(["assign", "reassign", "escalate"]),
  requestKey: z.uuid(),
});
