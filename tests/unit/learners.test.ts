import { describe, expect, it } from "vitest";
import { learnerInput } from "@/features/learners/input";
const valid = {
  displayName: "Synthetic learner",
  level: "elementary",
  timezone: "Asia/Manila",
};
describe("minimal learner input", () => {
  it("trims names and accepts every launch level", () => {
    for (const level of [
      "elementary",
      "middle_school",
      "high_school",
      "college_support",
    ])
      expect(
        learnerInput.parse({
          ...valid,
          level,
          displayName: "  Synthetic learner  ",
        }).displayName,
      ).toBe("Synthetic learner");
  });
  it.each([
    "userId",
    "guardianUserId",
    "id",
    "management",
    "status",
    "source",
    "fixtureKey",
    "role",
    "consent",
    "dateOfBirth",
    "school",
  ])("rejects untrusted %s fields", (key) => {
    expect(learnerInput.safeParse({ ...valid, [key]: "forged" }).success).toBe(
      false,
    );
  });
  it.each(["", " ", "x".repeat(81)])(
    "rejects invalid display names",
    (displayName) => {
      expect(learnerInput.safeParse({ ...valid, displayName }).success).toBe(
        false,
      );
    },
  );
  it.each(["Mars/Olympus", "EST", "Etc/GMT+8"])(
    "rejects invalid or fixed-offset zone %s",
    (timezone) => {
      expect(learnerInput.safeParse({ ...valid, timezone }).success).toBe(
        false,
      );
    },
  );
});
