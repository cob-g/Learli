import { z } from "zod";
export const accessStatuses = ["active", "suspended"] as const;
export const localReasons = [
  "local_access_test",
  "local_review_test",
  "local_restore_test",
] as const;
export const reasonLabels: Record<(typeof localReasons)[number], string> = {
  local_access_test: "Local access test",
  local_review_test: "Local review test",
  local_restore_test: "Local restoration test",
};
export const targetIdInput = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
export const pageInput = z.coerce.number().int().min(1).max(1000);
export const changeInput = z
  .strictObject({
    revision: z.number().int().min(0).max(2147483646),
    status: z.enum(accessStatuses),
    reason: z.enum(localReasons),
    requestKey: z.uuid(),
  })
  .superRefine((v, ctx) => {
    if ((v.status === "active") !== (v.reason === "local_restore_test"))
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Choose a reason for this local action.",
      });
  });
export function invalidInput(error: z.ZodError) {
  return {
    message: "Check the local action fields.",
    errors: Object.fromEntries(
      error.issues.map((i) => [
        String(i.path[0] ?? "form"),
        i.path[0] === "reason"
          ? "Choose a reason for this local action."
          : "Reload the account and choose valid local action fields.",
      ]),
    ),
  };
}
