import { z } from "zod";
export const publicationStates = [
  "pending",
  "approved",
  "rejected",
  "published",
  "withdrawn",
] as const;
export type PublicationState = (typeof publicationStates)[number];
export const publicationStateLabels: Record<PublicationState, string> = {
  pending: "Pending moderation",
  approved: "Approved for publication",
  rejected: "Rejected",
  published: "Published",
  withdrawn: "Withdrawn",
};
export const publicationSubmission = z.strictObject({
  requestId: z.uuid(),
  bookingRevision: z.number().int().min(0).max(2147483647),
  completionEventId: z.uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z
    .string()
    .trim()
    .max(1000)
    .refine((v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))
    .optional()
    .default(""),
});
export const publicationDecision = z.strictObject({
  requestId: z.uuid(),
  expectedRevision: z.number().int().min(0).max(2147483647),
  state: z.enum(publicationStates),
  privacyChecked: z.boolean(),
});
export function nextPublicationStates(
  state: PublicationState,
): PublicationState[] {
  switch (state) {
    case "pending":
      return ["approved", "rejected"];
    case "approved":
      return ["published", "pending"];
    case "published":
      return ["withdrawn"];
    default:
      return ["pending"];
  }
}
