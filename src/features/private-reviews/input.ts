import { z } from "zod";
export const states = [
  "pending",
  "locally_approved",
  "locally_rejected",
] as const;
export type ReviewState = (typeof states)[number];
export const stateLabels: Record<ReviewState, string> = {
  pending: "Pending local moderation",
  locally_approved: "Locally approved · private",
  locally_rejected: "Locally rejected · private",
};
export const submissionInput = z.strictObject({
  requestId: z.uuid(),
  expectedRevision: z.number().int().min(0).max(2147483647),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().default(""),
});
export const moderationInput = z.strictObject({
  requestId: z.uuid(),
  expectedRevision: z.number().int().min(0).max(2147483647),
  state: z.enum(states),
});
export function describeReviewIssues(error: z.ZodError) {
  return {
    message: "Check the rating and optional comment, then try again.",
    fields: z.flattenError(error).fieldErrors,
  };
}
export function nextStates(state: ReviewState): ReviewState[] {
  return state === "pending"
    ? ["locally_approved", "locally_rejected"]
    : ["pending"];
}
