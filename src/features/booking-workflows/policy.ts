import { createHash } from "node:crypto";
import { z } from "zod";
const enabled = z.strictObject({
  authority: z.literal("synthetic_test"),
  source: z.literal("synthetic_readiness"),
  policyId: z.uuid(),
  version: z.literal("synthetic-booking-v1"),
  reference: z.literal("synthetic:booking:v1"),
  contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
  admissionPolicyId: z.uuid(),
  durationMinutes: z.literal(60),
  stepMinutes: z.literal(30),
  noticeMinutes: z.literal(60),
  horizonDays: z.literal(14),
  provisionalMinutes: z.literal(10),
  cancelCutoffMinutes: z.literal(60),
  moveCutoffMinutes: z.literal(60),
  confirmationPrerequisite: z.literal("synthetic_prerequisite_review"),
  confirmationActor: z.literal("assigned_mfa_admin"),
  outcomeActor: z.literal("assigned_mfa_admin"),
  disputePath: z.literal("/support"),
  meetingAccess: z.literal("confirmed_until_end"),
});
export type EnabledBookingPolicy = z.infer<typeof enabled>;
export type BookingCapability =
  { authority: "disabled" } | EnabledBookingPolicy;
export const disabledBooking: BookingCapability = Object.freeze({
  authority: "disabled",
});
export function bookingPolicyDigest(
  v: Omit<EnabledBookingPolicy, "policyId" | "contentDigest">,
) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        v.authority,
        v.source,
        v.version,
        v.reference,
        v.admissionPolicyId,
        v.durationMinutes,
        v.stepMinutes,
        v.noticeMinutes,
        v.horizonDays,
        v.provisionalMinutes,
        v.cancelCutoffMinutes,
        v.moveCutoffMinutes,
        v.confirmationPrerequisite,
        v.confirmationActor,
        v.outcomeActor,
        v.disputePath,
        v.meetingAccess,
      ]),
    )
    .digest("hex");
}
export function validateBookingCapability(
  input: unknown,
  environment: string,
): BookingCapability {
  if (
    z.strictObject({ authority: z.literal("disabled") }).safeParse(input)
      .success
  )
    return disabledBooking;
  if (environment !== "test") throw new Error("Booking policy unavailable.");
  const v = enabled.parse(input);
  if (bookingPolicyDigest(v) !== v.contentDigest)
    throw new Error("Booking policy digest invalid.");
  return Object.freeze(v);
}
