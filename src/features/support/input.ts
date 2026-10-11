import { z } from "zod";

export const categoryLabels = {
  general: "General support",
  account: "Account issue",
  safety: "Safety concern",
} as const;
export const statusLabels = {
  open: "Open",
  in_review: "In review",
  closed: "Closed",
} as const;
export type CaseStatus = keyof typeof statusLabels;
export const transitions: Record<CaseStatus, CaseStatus[]> = {
  open: ["in_review"],
  in_review: ["closed"],
  closed: ["in_review"],
};
const safeText = (max: number, noun: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter ${noun}.`)
    .max(max, `Use ${max} characters or fewer.`)
    .refine(
      (v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v),
      "Remove control characters.",
    );
export const caseInput = z.strictObject({
  requestKey: z.uuid(),
  category: z.enum(["general", "account", "safety"], {
    error: "Choose a category.",
  }),
  subject: safeText(120, "a subject"),
  body: safeText(2000, "a fictional description"),
});
export const statusInput = z.strictObject({
  revision: z.number().int().min(0).max(2147483646),
  status: z.enum(["open", "in_review", "closed"]),
});
export const pageInput = z.coerce.number().int().min(1).max(1000).default(1);
export function describeSupportIssues(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fields[key]) fields[key] = issue.message;
  }
  return { message: "Check the report fields and try again.", fields };
}
