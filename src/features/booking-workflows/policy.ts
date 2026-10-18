import { createHash } from "node:crypto";
import { z } from "zod";
const common = z.strictObject({
  authority: z.literal("synthetic_test"),
  source: z.literal("synthetic_readiness"),
  policyId: z.uuid(),
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
const legacy = common.extend({
  version: z.literal("synthetic-booking-v1"),
  reference: z.literal("synthetic:booking:v1"),
});
const tutorCompletion = common.extend({
  version: z.literal("synthetic-booking-v2"),
  reference: z.literal("synthetic:booking:v2"),
  completionActor: z.literal("assigned_tutor"),
});
const local = common.extend({
  authority: z.literal("local_operation"),
  source: z.literal("local_operation"),
  version: z.literal("local-booking-v1"),
  reference: z.literal("local:booking:v1"),
  confirmationPrerequisite: z.literal("local_prerequisite_review"),
  completionActor: z.literal("assigned_tutor"),
});
const enabled = z.discriminatedUnion("version", [
  legacy,
  tutorCompletion,
  local,
]);
export type EnabledBookingPolicy = z.infer<typeof enabled>;
export type SyntheticBookingPolicy = Exclude<
  EnabledBookingPolicy,
  { authority: "local_operation" }
>;
type PolicyTerms =
  | Omit<z.infer<typeof legacy>, "policyId" | "contentDigest">
  | Omit<z.infer<typeof tutorCompletion>, "policyId" | "contentDigest">
  | Omit<z.infer<typeof local>, "policyId" | "contentDigest">;
export function supportsTutorCompletion(policy: EnabledBookingPolicy) {
  return policy.version !== "synthetic-booking-v1";
}
export type BookingCapability =
  { authority: "disabled" } | EnabledBookingPolicy;
export const disabledBooking: BookingCapability = Object.freeze({
  authority: "disabled",
});
export function bookingPolicyDigest(v: PolicyTerms) {
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
        // Legacy v1 receipt digests remain byte-identical; newer receipts bind completion.
        ...(v.version !== "synthetic-booking-v1" ? [v.completionActor] : []),
      ]),
    )
    .digest("hex");
}
export function validateBookingCapability(
  input: unknown,
  environment: "test",
): { authority: "disabled" } | SyntheticBookingPolicy;
export function validateBookingCapability(
  input: unknown,
  environment: "development",
): { authority: "disabled" } | z.infer<typeof local>;
export function validateBookingCapability(
  input: unknown,
  environment: string,
): BookingCapability;
export function validateBookingCapability(
  input: unknown,
  environment: string,
): BookingCapability {
  if (
    z.strictObject({ authority: z.literal("disabled") }).safeParse(input)
      .success
  )
    return disabledBooking;
  const v = enabled.parse(input);
  if (
    v.authority === "local_operation"
      ? environment !== "development"
      : environment !== "test"
  )
    throw new Error("Booking policy unavailable.");
  if (bookingPolicyDigest(v) !== v.contentDigest)
    throw new Error("Booking policy digest invalid.");
  return Object.freeze(v);
}

const localTerms = {
  authority: "local_operation",
  source: "local_operation",
  version: "local-booking-v1",
  reference: "local:booking:v1",
  admissionPolicyId: "8a3658c1-773a-4533-81c6-49ff79870211",
  durationMinutes: 60,
  stepMinutes: 30,
  noticeMinutes: 60,
  horizonDays: 14,
  provisionalMinutes: 10,
  cancelCutoffMinutes: 60,
  moveCutoffMinutes: 60,
  confirmationPrerequisite: "local_prerequisite_review",
  confirmationActor: "assigned_mfa_admin",
  outcomeActor: "assigned_mfa_admin",
  completionActor: "assigned_tutor",
  disputePath: "/support",
  meetingAccess: "confirmed_until_end",
} as const;
export const localBookingPolicy = Object.freeze({
  ...localTerms,
  policyId: "8a3658c1-773a-4533-81c6-49ff79870212",
  contentDigest: bookingPolicyDigest(localTerms),
});
