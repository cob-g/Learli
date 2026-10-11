import { describe, expect, it } from "vitest";
import {
  caseInput,
  pageInput,
  statusInput,
  transitions,
} from "@/features/support/input";
const valid = {
  requestKey: "11111111-1111-4111-8111-111111111111",
  category: "general",
  subject: " Fictional issue ",
  body: " Synthetic description \n",
};
describe("minimal local support input", () => {
  it("normalizes plain text and accepts the three categories", () => {
    for (const category of ["general", "account", "safety"])
      expect(caseInput.parse({ ...valid, category })).toMatchObject({
        subject: "Fictional issue",
        body: "Synthetic description",
      });
  });
  it.each([
    "requesterUserId",
    "reviewerUserId",
    "assignment",
    "status",
    "role",
    "source",
    "learnerId",
    "bookingId",
  ])("rejects privileged or unowned field %s", (key) =>
    expect(caseInput.safeParse({ ...valid, [key]: "forged" }).success).toBe(
      false,
    ),
  );
  it.each([
    { subject: " " },
    { body: " " },
    { subject: "s".repeat(121) },
    { body: "b".repeat(2001) },
    { body: "a\u0000b" },
    { category: "unknown" },
    { requestKey: "not-a-uuid" },
  ])("rejects invalid bounded text/identity input %o", (patch) =>
    expect(caseInput.safeParse({ ...valid, ...patch }).success).toBe(false),
  );
  it("status edits require a bounded integer revision and accept no grants", () => {
    expect(statusInput.parse({ revision: 0, status: "in_review" })).toEqual({
      revision: 0,
      status: "in_review",
    });
    for (const input of [
      { revision: -1, status: "closed" },
      { revision: 1.2, status: "closed" },
      { revision: 0, status: "escalated" },
      { revision: 0, status: "closed", reviewerId: "forged" },
    ])
      expect(statusInput.safeParse(input).success).toBe(false);
    expect(transitions).toEqual({
      open: ["in_review"],
      in_review: ["closed"],
      closed: ["in_review"],
    });
  });
  it("bounds pagination", () => {
    expect(pageInput.parse("2")).toBe(2);
    for (const value of ["bad", "0", "1001", "1.5"])
      expect(pageInput.safeParse(value).success).toBe(false);
  });
});
