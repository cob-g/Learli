import { describe, expect, it } from "vitest";
import { createLearnerInput, learnerInput } from "@/features/learners/input";
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

describe("local create request", () => {
  it("requires actor-scoped retry ID and allows only local modes", () => {
    const input = {
      ...valid,
      requestId: "5f977368-34a0-4bfe-a306-51b1b8959a36",
      management: "guardian",
    };
    expect(createLearnerInput.safeParse(input).success).toBe(true);
    for (const change of [
      { requestId: "" },
      { management: "admin" },
      { learnerId: "forged" },
      { guardianUserId: "forged" },
    ])
      expect(
        createLearnerInput.safeParse({ ...input, ...change }).success,
      ).toBe(false);
  });
});

describe("optional exact school grade", () => {
  it("preserves omission and null, and accepts grades without inferring a level", () => {
    expect(learnerInput.parse(valid)).not.toHaveProperty("grade");
    expect(learnerInput.parse({ ...valid, grade: null }).grade).toBeNull();
    for (const grade of [1, 8, 12])
      for (const level of ["elementary", "middle_school", "high_school"])
        expect(learnerInput.parse({ ...valid, grade, level })).toMatchObject({
          grade,
          level,
        });
  });
  it.each([0, 13, 8.5, "8", "", true, [], {}])(
    "rejects invalid grade %j without coercion",
    (grade) => {
      expect(learnerInput.safeParse({ ...valid, grade }).success).toBe(false);
      expect(
        createLearnerInput.safeParse({
          ...valid,
          management: "guardian",
          requestId: "5f977368-34a0-4bfe-a306-51b1b8959a36",
          grade,
        }).success,
      ).toBe(false);
    },
  );
  it("rejects a school grade for College Support while allowing null", () => {
    expect(
      learnerInput.safeParse({ ...valid, level: "college_support", grade: 8 })
        .success,
    ).toBe(false);
    expect(
      learnerInput.parse({ ...valid, level: "college_support", grade: null })
        .grade,
    ).toBeNull();
  });
});
