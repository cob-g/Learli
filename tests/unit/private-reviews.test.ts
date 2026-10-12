import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  submissionInput,
  moderationInput,
  nextStates,
} from "@/features/private-reviews/input";
const submission = { requestId: randomUUID(), expectedRevision: 0, rating: 4 };
describe("private review demonstration validation", () => {
  it("accepts integer rating, trims optional plain text and limits text", () => {
    expect(submissionInput.parse(submission).comment).toBe("");
    expect(
      submissionInput.parse({
        ...submission,
        comment: "  <script>synthetic</script>  ",
      }).comment,
    ).toBe("<script>synthetic</script>");
    expect(
      submissionInput.safeParse({ ...submission, comment: "a".repeat(1001) })
        .success,
    ).toBe(false);
  });
  it.each([0, 6, 1.5, "5", null])("rejects invalid rating %s", (rating) =>
    expect(submissionInput.safeParse({ ...submission, rating }).success).toBe(
      false,
    ),
  );
  it("rejects authority/source/booking overrides and invalid retry or revision", () => {
    for (const extra of [
      { authorUserId: "other" },
      { source: "live" },
      { state: "locally_approved" },
      { expectedRevision: -1 },
      { requestId: "guess" },
    ])
      expect(
        submissionInput.safeParse({ ...submission, ...extra }).success,
      ).toBe(false);
  });
  it("allows only the recorded private states and bounded expected revision", () => {
    expect(nextStates("pending")).toEqual([
      "locally_approved",
      "locally_rejected",
    ]);
    expect(nextStates("locally_approved")).toEqual(["pending"]);
    expect(nextStates("locally_rejected")).toEqual(["pending"]);
    expect(
      moderationInput.safeParse({
        requestId: randomUUID(),
        expectedRevision: 0,
        state: "published",
      }).success,
    ).toBe(false);
  });
});
