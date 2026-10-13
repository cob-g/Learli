import { createHash } from "node:crypto";
import { z } from "zod";
const enabled = z.strictObject({
  authority: z.literal("synthetic_test"),
  source: z.literal("synthetic_readiness"),
  policyId: z.uuid(),
  version: z.literal("synthetic-publication-v1"),
  reference: z.literal("synthetic:publication:v1"),
  contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
  eligibleOutcome: z.literal("administrative_completed"),
  authorRelation: z.literal("current_booking_beneficiary"),
  submissionRule: z.literal("one_immutable_per_logical_booking"),
  moderation: z.literal("manual_exact_assigned_mfa"),
  privacyReview: z.literal("explicit_before_approval_and_publication"),
  publicFields: z.literal("anonymous_label_rating_plain_text_date"),
  disputePath: z.literal("/support"),
});
export type EnabledPublicationPolicy = z.infer<typeof enabled>;
export type PublicationCapability =
  { authority: "disabled" } | EnabledPublicationPolicy;
export const disabledPublication: PublicationCapability = Object.freeze({
  authority: "disabled",
});
export function publicationPolicyDigest(
  v: Omit<EnabledPublicationPolicy, "policyId" | "contentDigest">,
) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        v.authority,
        v.source,
        v.version,
        v.reference,
        v.eligibleOutcome,
        v.authorRelation,
        v.submissionRule,
        v.moderation,
        v.privacyReview,
        v.publicFields,
        v.disputePath,
      ]),
    )
    .digest("hex");
}
export function validatePublicationCapability(
  input: unknown,
  environment: string,
): PublicationCapability {
  if (
    z.strictObject({ authority: z.literal("disabled") }).safeParse(input)
      .success
  )
    return disabledPublication;
  if (environment !== "test")
    throw new Error("Publication policy unavailable.");
  const value = enabled.parse(input);
  if (publicationPolicyDigest(value) !== value.contentDigest)
    throw new Error("Publication policy digest invalid.");
  return Object.freeze(value);
}
