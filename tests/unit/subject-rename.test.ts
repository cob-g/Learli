import { describe, expect, it } from "vitest";
import {
  subjectNameInput,
  subjectRenameInput,
} from "@/features/subjects/input";

describe("narrow subject rename input", () => {
  it("shares the existing trim, character and length rules with create", () => {
    for (const name of [
      "  Statistics  ",
      "Français & Español",
      "日本語",
      "A".repeat(60),
      "Chemistry II (Organic)",
    ]) {
      expect(subjectRenameInput.parse({ name, expectedRevision: 0 }).name).toBe(
        subjectNameInput.parse({ name }).name,
      );
    }
  });
  it.each([
    "",
    "A",
    "-Physics",
    "<script>",
    "x".repeat(61),
    "Math\nScience",
    "📚 Study",
  ])("rejects invalid name %j", (name) => {
    expect(
      subjectRenameInput.safeParse({ name, expectedRevision: 0 }).success,
    ).toBe(false);
  });
  it.each([undefined, null, "0", -1, 0.5, 2147483647, Infinity, NaN])(
    "rejects invalid revision %j",
    (expectedRevision) => {
      expect(
        subjectRenameInput.safeParse({ name: "Statistics", expectedRevision })
          .success,
      ).toBe(false);
    },
  );
  it.each([
    { category: "academic_core" },
    { slug: "different" },
    { isActive: false },
    { status: "active" },
    { id: "other" },
    { role: "admin" },
  ])("rejects client-supplied fixed field %j", (extra) => {
    expect(
      subjectRenameInput.safeParse({
        name: "Statistics",
        expectedRevision: 0,
        ...extra,
      }).success,
    ).toBe(false);
  });
});
