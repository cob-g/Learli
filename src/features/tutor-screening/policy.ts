import { z } from "zod";

export const screeningActions = [
  "approve",
  "reject",
  "suspend",
  "reinstate",
  "reopen",
  "revoke",
] as const;
const instant = z.iso
  .datetime({ offset: true })
  .refine((v) => Number.isFinite(Date.parse(v)));
const distinctCodes = z
  .array(z.string().regex(/^[a-z][a-z0-9_]{0,47}$/))
  .min(1)
  .max(20)
  .refine((v) => new Set(v).size === v.length);
export const screeningPolicyInput = z
  .strictObject({
    mode: z.literal("synthetic_test"),
    provenance: z.literal("synthetic_readiness"),
    version: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
    reference: z
      .string()
      .regex(
        /^policy:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      ),
    authorityReference: z
      .string()
      .regex(
        /^synthetic:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      ),
    validFrom: instant,
    validUntil: instant,
    requiredCheckCodes: distinctCodes,
    allowedActions: z
      .array(z.enum(screeningActions))
      .min(1)
      .max(6)
      .refine((v) => new Set(v).size === v.length),
    expiryRule: z.literal("all_checks_current"),
  })
  .refine((v) => Date.parse(v.validUntil) > Date.parse(v.validFrom));
export type ScreeningCapability =
  { mode: "disabled" } | z.infer<typeof screeningPolicyInput>;
export type ScreeningScope = "local_demo" | "synthetic_readiness";
export const disabledScreening: ScreeningCapability = Object.freeze({
  mode: "disabled",
});

/** Validation grants no real authority. Production never consumes synthetic packets. */
export function validateScreeningCapability(
  input: unknown,
  environment: string,
): ScreeningCapability {
  if (z.strictObject({ mode: z.literal("disabled") }).safeParse(input).success)
    return disabledScreening;
  if (environment !== "test")
    throw new Error("Screening capability unavailable.");
  return Object.freeze(screeningPolicyInput.parse(input));
}
