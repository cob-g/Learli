import { z } from "zod";
export const responseActions = [
  "intake",
  "assign",
  "reassign",
  "acknowledge",
  "request_escalation",
  "escalate",
  "close",
  "reopen",
  "restrict",
  "restore",
] as const;
const reference = z
  .string()
  .regex(
    /^(?:policy|synthetic):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
export const safeguardingPolicyInput = z
  .strictObject({
    mode: z.literal("synthetic_test"),
    provenance: z.literal("synthetic_readiness"),
    version: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
    reference,
    validFrom: z.iso.datetime({ offset: true }),
    validUntil: z.iso.datetime({ offset: true }),
    responsibleOwnerId: z.string().min(1).max(128),
    escalationOwnerId: z.string().min(1).max(128),
    reportingGuidanceReference: reference,
    meetingGuidanceReference: reference,
    allowedActions: z
      .array(z.enum(responseActions))
      .min(1)
      .max(10)
      .refine((v) => new Set(v).size === v.length),
    reasonCodes: z
      .array(z.enum(["synthetic_safety_restrict", "synthetic_safety_restore"]))
      .min(1)
      .max(2),
  })
  .refine(
    (v) =>
      Date.parse(v.validUntil) > Date.parse(v.validFrom) &&
      v.responsibleOwnerId !== v.escalationOwnerId,
  );
export type SafeguardingCapability =
  { mode: "disabled" } | z.infer<typeof safeguardingPolicyInput>;
export const disabledSafeguarding: SafeguardingCapability = Object.freeze({
  mode: "disabled",
});
export function validateSafeguardingCapability(
  input: unknown,
  environment: string,
): SafeguardingCapability {
  if (z.strictObject({ mode: z.literal("disabled") }).safeParse(input).success)
    return disabledSafeguarding;
  if (environment !== "test")
    throw new Error("Safeguarding capability unavailable.");
  return Object.freeze(safeguardingPolicyInput.parse(input));
}
