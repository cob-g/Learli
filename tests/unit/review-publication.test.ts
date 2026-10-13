import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  publicationPolicyDigest,
  validatePublicationCapability,
} from "@/features/review-publication/policy";
import {
  publicationSubmission,
  publicationDecision,
  nextPublicationStates,
} from "@/features/review-publication/input";
const fields = {
  authority: "synthetic_test",
  source: "synthetic_readiness",
  version: "synthetic-publication-v1",
  reference: "synthetic:publication:v1",
  eligibleOutcome: "administrative_completed",
  authorRelation: "current_booking_beneficiary",
  submissionRule: "one_immutable_per_logical_booking",
  moderation: "manual_exact_assigned_mfa",
  privacyReview: "explicit_before_approval_and_publication",
  publicFields: "anonymous_label_rating_plain_text_date",
  disputePath: "/support",
} as const;
const packet = {
  ...fields,
  policyId: randomUUID(),
  contentDigest: publicationPolicyDigest(fields),
};
describe("publication input and activation", () => {
  it("permits only exact test-owned readiness packets and preserves disabled default", () => {
    expect(
      validatePublicationCapability({ authority: "disabled" }, "production"),
    ).toEqual({ authority: "disabled" });
    expect(validatePublicationCapability(packet, "test")).toEqual(packet);
    for (const env of ["development", "staging", "production"])
      expect(() => validatePublicationCapability(packet, env)).toThrow();
  });
  it("refuses digest/allowlist/authority drift", () => {
    for (const v of [
      { ...packet, contentDigest: "a".repeat(64) },
      { ...packet, authority: "approved" },
      { ...packet, publicFields: "names" },
      { ...packet, extra: true },
    ])
      expect(() => validatePublicationCapability(v, "test")).toThrow();
  });
  it.each([0, 6, 1.5, "5", null])(
    "rejects noninteger bounded rating %s",
    (rating) => {
      expect(
        publicationSubmission.safeParse({
          requestId: randomUUID(),
          bookingRevision: 1,
          completionEventId: randomUUID(),
          rating,
        }).success,
      ).toBe(false);
    },
  );
  it("bounds plain text while treating markup as inert text", () => {
    const v = {
      requestId: randomUUID(),
      bookingRevision: 1,
      completionEventId: randomUUID(),
      rating: 3,
      comment: "<script>not executed</script>\nPlain text",
    };
    expect(publicationSubmission.parse(v).comment).toBe(v.comment);
    expect(
      publicationSubmission.safeParse({ ...v, comment: "a".repeat(1001) })
        .success,
    ).toBe(false);
    expect(
      publicationSubmission.safeParse({ ...v, comment: "bad\u0000" }).success,
    ).toBe(false);
  });
  it("requires explicit decision/privacy/revision and bounded transitions", () => {
    expect(
      publicationDecision.safeParse({
        requestId: randomUUID(),
        expectedRevision: 0,
        state: "published",
      }).success,
    ).toBe(false);
    expect(nextPublicationStates("published")).toEqual(["withdrawn"]);
    expect(nextPublicationStates("withdrawn")).toEqual(["pending"]);
  });
});
