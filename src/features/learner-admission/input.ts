import { z } from "zod";
import { learnerFields, validateLearnerGrade } from "@/features/learners/input";
import {
  selectionFromReturnPath,
  bookingSelectionHref,
  discoveryFromReturnPath,
  bookingDiscoveryHref,
} from "@/features/bookings/selection";

export function canonicalAdmissionSelection(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const selection = selectionFromReturnPath(input);
  if (selection) return bookingSelectionHref(selection);
  const discovery = discoveryFromReturnPath(input);
  return discovery ? bookingDiscoveryHref(discovery) : null;
}
export const admissionInput = learnerFields
  .extend({
    requestId: z.uuid(),
    management: z.enum(["guardian", "self"]),
    policyVersion: z.string().max(80),
    policyDigest: z.string().regex(/^[a-f0-9]{64}$/),
    next: z.string().max(2048).optional(),
  })
  .superRefine((v, ctx) => {
    validateLearnerGrade(v, ctx);
    if (v.management === "self" && v.level !== "college_support")
      ctx.addIssue({
        code: "custom",
        path: ["level"],
        message: "Independent requests use College Support.",
      });
  });
export const reviewInput = z.strictObject({
  requestId: z.uuid(),
  revision: z.number().int().min(0),
  action: z.enum(["authorize", "reject", "revoke"]),
});
export const evidenceInput = z.strictObject({
  requestId: z.uuid(),
  revision: z.number().int().min(0),
  checkCode: z.enum([
    "guardian_authority",
    "guardian_notice",
    "independent_eligibility",
  ]),
  reference: z
    .string()
    .regex(/^[A-Za-z0-9:_-]{1,128}$/, "Use a bounded opaque review reference."),
});
export const revokeEvidenceInput = z.strictObject({
  requestId: z.uuid(),
  revision: z.number().int().min(0),
  evidenceId: z.uuid(),
});
export const admittedLearnerInput = learnerFields.pick({
  displayName: true,
  timezone: true,
  grade: true,
});

/** Cursor contains only an opaque private request ID; authorization is checked again in SQL. */
export function admissionListCursor(input: unknown): string | null {
  return input === undefined || input === null ? null : z.uuid().parse(input);
}
