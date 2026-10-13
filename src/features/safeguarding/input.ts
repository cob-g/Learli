import { z } from "zod";
import { caseInput } from "@/features/support/input";
export const safeguardingCaseInput = caseInput.omit({ bookingId: true });
export const responseInput = z.strictObject({
  action: z.enum([
    "assign",
    "reassign",
    "escalate",
    "acknowledge",
    "request_escalation",
    "close",
    "reopen",
  ]),
  revision: z.number().int().min(0).max(2147483646),
  requestKey: z.uuid(),
  targetId: z.string().min(1).max(128).optional(),
});
export const safetyRestrictionInput = z.strictObject({
  action: z.enum(["restrict", "restore"]),
  reason: z.enum(["synthetic_safety_restrict", "synthetic_safety_restore"]),
  revision: z.number().int().min(0).max(2147483646),
  requestKey: z.uuid(),
});
