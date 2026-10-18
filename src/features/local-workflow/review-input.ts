import { z } from "zod";

export const localReviewKinds = [
  "admission",
  "screening",
  "booking",
  "support",
  "account",
] as const;
export type LocalReviewKind = (typeof localReviewKinds)[number];
export const localReviewClaimInput = z
  .strictObject({
    kind: z.enum(localReviewKinds),
    targetId: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/),
    requestId: z.uuid(),
  })
  .superRefine((value, context) => {
    if (value.kind !== "account" && !z.uuid().safeParse(value.targetId).success)
      context.addIssue({
        code: "custom",
        path: ["targetId"],
        message: "Choose a current request.",
      });
  });

export const localReviewLabels: Record<LocalReviewKind, string> = {
  admission: "Learner admission",
  screening: "Tutor screening",
  booking: "Booking confirmation",
  support: "Support request",
  account: "Account administration",
};

export function localReviewHref(kind: LocalReviewKind, targetId: string) {
  const id = encodeURIComponent(targetId);
  switch (kind) {
    case "admission":
      return `/admin/learner-admission/${id}`;
    case "screening":
      return `/admin/tutors/${id}`;
    case "booking":
      return `/admin/bookings/${id}`;
    case "support":
      return `/admin/support/${id}`;
    case "account":
      return `/admin/accounts/${id}`;
  }
}
