// Client-safe: types only from the schema, no database code.
import type { AuditAction, ReviewStatus } from "@/lib/db/schema/app";

export const reviewActions = {
  approve: { from: "pending", to: "approved", audit: "tutor_review.approved" },
  reject: { from: "pending", to: "rejected", audit: "tutor_review.rejected" },
  suspend: {
    from: "approved",
    to: "suspended",
    audit: "tutor_review.suspended",
  },
  reinstate: {
    from: "suspended",
    to: "approved",
    audit: "tutor_review.reinstated",
  },
  reopen: { from: "rejected", to: "pending", audit: "tutor_review.reopened" },
} as const satisfies Record<
  string,
  { from: ReviewStatus; to: ReviewStatus; audit: AuditAction }
>;
export type ReviewAction = keyof typeof reviewActions;
export const reviewActionNames = Object.keys(reviewActions) as ReviewAction[];

/** The only moves an admin may make from a given status. */
export function reviewActionsFrom(status: ReviewStatus) {
  return reviewActionNames.filter(
    (action) => reviewActions[action].from === status,
  );
}

/**
 * A tutor edits while pending, approved or rejected. Saving a rejected profile
 * submits it again (owner decision, 2026-10-11). A suspended profile is locked.
 */
export function tutorCanEdit(status: ReviewStatus) {
  return status !== "suspended";
}

export const reviewStatusLabels: Record<ReviewStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};
