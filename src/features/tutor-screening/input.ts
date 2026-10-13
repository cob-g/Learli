import { z } from "zod";
import { screeningActions } from "./policy";
export const screeningDecisionInput = z.strictObject({
  action: z.enum(screeningActions),
  revision: z.number().int().min(0).max(2147483646),
  requestKey: z.uuid(),
});
export const screeningCheckInput = z
  .strictObject({
    revision: z.number().int().min(0).max(2147483646),
    requestKey: z.uuid(),
    code: z.string().regex(/^[a-z][a-z0-9_]{0,47}$/),
    outcome: z.enum(["passed", "failed", "revoked"]),
    reference: z
      .string()
      .regex(/^screening:[0-9a-f-]{36}$/)
      .refine((v) => z.uuid().safeParse(v.slice(10)).success),
    checkedAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .refine((v) => Date.parse(v.expiresAt) > Date.parse(v.checkedAt), {
    path: ["expiresAt"],
    message: "Expiry must follow the check.",
  });
