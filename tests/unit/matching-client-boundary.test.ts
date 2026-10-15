import { describe, expect, it, vi } from "vitest";

// These URL helpers are shared by client forms. Loading them must not evaluate
// persistence tables, even when all database constructors are unavailable.
vi.mock("drizzle-orm/pg-core", () => {
  throw new Error(
    "Browser matching helpers must not load Drizzle constructors",
  );
});

describe("client-safe matching URLs", () => {
  it("round-trips every launch level and ordered preferences without a persistence runtime", async () => {
    const { matchingHref, parseMatchPreferences, sanitizeMatchParams } =
      await import("@/features/matching/preferences");
    const { preferences } = parseMatchPreferences({
      timezone: "Asia/Manila",
      when: "preferred",
      days: ["7", "1"],
      range: "morning",
    });
    expect(preferences).toEqual({
      timezone: "Asia/Manila",
      when: "preferred",
      days: [1, 7],
      range: "morning",
    });

    for (const level of [
      "elementary",
      "middle_school",
      "high_school",
      "college_support",
    ]) {
      const href = matchingHref(
        { level, subject: "math", preferences },
        "when",
        2,
      );
      expect(href).toBe(
        `/get-matched?level=${level}&subject=math&timezone=Asia%2FManila&when=preferred&days=1&days=7&range=morning&change=when&page=2`,
      );
      const query = new URL(href, "https://learli.test").searchParams;
      const params = Object.fromEntries(
        [...new Set(query.keys())].map((key) => {
          const values = query.getAll(key);
          return [key, values.length === 1 ? values[0] : values];
        }),
      );
      expect(
        sanitizeMatchParams({ ...params, learnerId: "PRIVATE_CANARY" }),
      ).toEqual({ params, changed: true, href });
      expect(parseMatchPreferences(params).preferences).toEqual(preferences);
    }
  });

  it("rejects invalid scalar levels without reflecting them into URLs", async () => {
    const { matchingHref, sanitizeMatchParams } =
      await import("@/features/matching/preferences");
    for (const level of [
      undefined,
      "",
      "college",
      "College Support",
      "high-school",
      " elementary",
      "elementary ",
      "PRIVATE_CANARY",
    ]) {
      expect(matchingHref({ level, subject: "math" })).toBe(
        "/get-matched?subject=math",
      );
      expect(sanitizeMatchParams({ level })).toEqual({
        params: { level: "" },
        changed: level !== "",
        href: "/get-matched?level=",
      });
    }
  });

  it("rejects repeated level parameters instead of choosing an answer", async () => {
    const { sanitizeMatchParams } =
      await import("@/features/matching/preferences");
    for (const level of [
      [],
      ["college_support"],
      ["elementary", "elementary"],
      ["high_school", "college_support"],
    ]) {
      expect(sanitizeMatchParams({ level })).toEqual({
        params: { level: "" },
        changed: true,
        href: "/get-matched?level=",
      });
    }
  });
});
