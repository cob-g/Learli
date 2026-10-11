import { describe, expect, it } from "vitest";
import {
  matchingHref,
  sanitizeMatchParams,
  parseMatchPreferences,
  preferenceDraft,
  preferencePredicate,
  type MatchPreferences,
} from "@/features/matching/preferences";
import { matchAvailableTutors, resolveMatch } from "@/features/matching/match";
import type { PublicTutor } from "@/features/tutors/eligibility";
const good = {
  timezone: "Asia/Manila",
  when: "preferred",
  days: ["1", "7"],
  range: "morning",
};
const time = (start: string, end: string) => ({
  startAtUtc: start,
  endAtUtc: end,
});
const fits = (preferences: MatchPreferences, start: string, end: string) =>
  preferencePredicate(
    preferences,
    new Date(start.slice(0, 10) + "T00:00:00Z"),
    new Date(new Date(start).getTime() + 2 * 86400000),
  )(time(start, end));
describe("public matching preferences", () => {
  it("requires explicit Any time and a regional viewer zone", () => {
    expect(parseMatchPreferences({}).preferences).toBeUndefined();
    expect(
      parseMatchPreferences({
        timezone: "Asia/Manila",
        when: "any",
        days: ["bad"],
        range: "bad",
      }).preferences,
    ).toEqual({ timezone: "Asia/Manila", when: "any" });
    expect(parseMatchPreferences(good).preferences).toEqual({
      timezone: "Asia/Manila",
      when: "preferred",
      days: [1, 7],
      range: "morning",
    });
  });
  it.each([
    { timezone: "+08:00" },
    { timezone: "EST" },
    { timezone: "Etc/GMT+8" },
    { timezone: "PRIVATE" },
    { timezone: ["UTC", "UTC"] },
    { when: ["any", "preferred"] },
    { when: "bad" },
    { days: [] },
    { days: ["1", "1"] },
    { days: ["1", "8"] },
    { days: ["01"] },
    { days: Array(8).fill("1") },
    { range: "PRIVATE" },
    { range: ["morning", "evening"] },
  ])("rejects malformed bounded input without exposing it: %j", (patch) => {
    const result = parseMatchPreferences({ ...good, ...patch });
    expect(result.preferences).toBeUndefined();
    expect(Object.keys(result.fields).length).toBeGreaterThan(0);
    expect(JSON.stringify(result.fields)).not.toContain("PRIVATE");
  });
  it("retains safe partial answers after errors and strips private/unknown URL keys", () => {
    expect(
      preferenceDraft({
        ...good,
        range: "bad",
        learner: "private",
        timezone: "UTC",
      }),
    ).toEqual({
      timezone: "UTC",
      when: "preferred",
      days: [1, 7],
      range: undefined,
    });
    const preferences = parseMatchPreferences(good).preferences;
    const href = matchingHref(
      { level: "college_support", subject: "math", preferences },
      "subject",
      2,
    );
    expect(href).toContain("days=1&days=7");
    const params = Object.fromEntries(
      new URL(href, "http://localhost").searchParams,
    );
    expect(params).toMatchObject({
      level: "college_support",
      subject: "math",
      change: "subject",
      timezone: "Asia/Manila",
      when: "preferred",
      range: "morning",
      page: "2",
    });
    expect(href).not.toContain("learner");
  });
  it("canonicalizes unknown and malformed query state without serializing raw values", () => {
    const safe = sanitizeMatchParams({
      level: "college_support",
      subject: "math",
      timezone: "PRIVATE_CANARY",
      when: "preferred",
      days: ["1", "PRIVATE_CANARY"],
      range: "PRIVATE_CANARY",
      learnerId: "PRIVATE_CANARY",
      change: "when",
      submit: "results",
    });
    expect(safe.changed).toBe(true);
    expect(safe.href).not.toContain("PRIVATE_CANARY");
    expect(safe.href).not.toContain("learnerId");
    expect(parseMatchPreferences(safe.params).preferences).toBeUndefined();
    expect(
      sanitizeMatchParams({
        level: "college_support",
        timezone: "UTC",
        when: "any",
      }).changed,
    ).toBe(false);
  });
  it("filters the entire half-open candidate, respecting both range edges", () => {
    const p: MatchPreferences = {
      timezone: "UTC",
      when: "preferred",
      days: [1],
      range: "morning",
    };
    expect(fits(p, "2026-10-12T06:00:00Z", "2026-10-12T07:00:00Z")).toBe(true);
    expect(fits(p, "2026-10-12T11:00:00Z", "2026-10-12T12:00:00Z")).toBe(true);
    expect(fits(p, "2026-10-12T05:30:00Z", "2026-10-12T06:30:00Z")).toBe(false);
    expect(fits(p, "2026-10-12T11:30:00Z", "2026-10-12T12:30:00Z")).toBe(false);
    expect(fits(p, "2026-10-13T06:00:00Z", "2026-10-13T07:00:00Z")).toBe(false);
  });
  it("uses viewer weekdays across the date line, not tutor or UTC weekdays", () => {
    const p: MatchPreferences = {
      timezone: "Pacific/Kiritimati",
      when: "preferred",
      days: [1],
      range: "morning",
    };
    expect(fits(p, "2026-10-11T16:00:00Z", "2026-10-11T17:00:00Z")).toBe(true);
    expect(
      fits({ ...p, days: [7] }, "2026-10-11T16:00:00Z", "2026-10-11T17:00:00Z"),
    ).toBe(false);
  });
  it("handles a Manila candidate differently before and after Los Angeles DST", () => {
    const p: MatchPreferences = {
      timezone: "America/Los_Angeles",
      when: "preferred",
      days: [1, 6],
      range: "morning",
    };
    expect(fits(p, "2026-10-31T13:00:00Z", "2026-10-31T14:00:00Z")).toBe(true);
    expect(fits(p, "2026-11-02T13:00:00Z", "2026-11-02T14:00:00Z")).toBe(false);
    expect(fits(p, "2026-11-02T14:00:00Z", "2026-11-02T15:00:00Z")).toBe(true);
  });
  it.each([
    ["America/Los_Angeles", "2026-11-01T08:30:00Z", "2026-11-01T09:30:00Z"],
    ["America/Los_Angeles", "2026-03-08T09:30:00Z", "2026-03-08T10:30:00Z"],
    ["Australia/Lord_Howe", "2026-10-03T15:00:00Z", "2026-10-03T16:00:00Z"],
    ["Australia/Lord_Howe", "2026-04-04T14:45:00Z", "2026-04-04T15:45:00Z"],
  ])(
    "preserves elapsed candidates through gap/fold in %s",
    (timezone, start, end) => {
      expect(
        fits(
          { timezone, when: "preferred", days: [7], range: "overnight" },
          start,
          end,
        ),
      ).toBe(true);
    },
  );
  it("includes an end at midnight but refuses a candidate crossing the selected day/range", () => {
    const p: MatchPreferences = {
      timezone: "UTC",
      when: "preferred",
      days: [7],
      range: "evening",
    };
    expect(fits(p, "2026-10-11T23:00:00Z", "2026-10-12T00:00:00Z")).toBe(true);
    expect(fits(p, "2026-10-11T23:30:00Z", "2026-10-12T00:30:00Z")).toBe(false);
  });
  it("Any time still rejects invalid, past-outside-query and zero-duration candidates", () => {
    const predicate = preferencePredicate(
      { timezone: "UTC", when: "any" },
      new Date("2026-10-11T00:00:00Z"),
      new Date("2026-10-12T00:00:00Z"),
    );
    expect(predicate(time("bad", "bad"))).toBe(false);
    expect(
      predicate(time("2026-10-11T01:00:00Z", "2026-10-11T01:00:00Z")),
    ).toBe(false);
    expect(
      predicate(time("2026-10-10T23:30:00Z", "2026-10-11T00:30:00Z")),
    ).toBe(false);
  });
});
const subject = {
  id: "math",
  slug: "math",
  name: "Math",
  category: "academic_core" as const,
  isActive: true,
};
const tutor = (
  slug: string,
  subjectSlug = "math",
  levels: PublicTutor["offerings"][number]["levels"] = ["college_support"],
): PublicTutor => ({
  slug,
  displayName: slug,
  headline: "Fictional",
  bio: "Fictional",
  teachingBackground: "Fictional",
  teachingLanguages: [],
  offerings: [
    { subjectSlug, subjectName: subjectSlug, levels, specialty: null },
  ],
});
describe("availability-based matching", () => {
  it("adds When without silently treating omitted preference as Any time", () => {
    expect(
      resolveMatch(
        { level: "college_support", subject: "math" },
        [subject],
        [tutor("a")],
      ).step,
    ).toBe("when");
    expect(
      resolveMatch(
        {
          level: "college_support",
          subject: "math",
          timezone: "UTC",
          when: "any",
        },
        [subject],
        [tutor("a")],
      ).step,
    ).toBe("ready");
  });
  it("restores subject and complete preferences on level/subject Back", () => {
    for (const change of ["level", "subject"])
      expect(
        resolveMatch(
          { level: "college_support", subject: "math", ...good, change },
          [subject],
          [tutor("a")],
        ),
      ).toMatchObject({
        step: change,
        subject: "math",
        preferences: { when: "preferred", days: [1, 7] },
      });
  });
  it("uses same-offering fit and orders real times before name without padding", () => {
    const times = ["2026-10-12T07:00:00Z", "2026-10-12T06:00:00Z"].map(
      (start) =>
        time(
          start,
          new Date(new Date(start).getTime() + 3600000).toISOString(),
        ),
    );
    const results = matchAvailableTutors(
      [tutor("a"), tutor("z"), tutor("empty"), tutor("wrong", "science")],
      "math",
      "college_support",
      { timezone: "UTC", when: "any" },
      [
        { tutorSlug: "a", times: [times[0]] },
        { tutorSlug: "z", times: [times[1]] },
        { tutorSlug: "wrong", times },
      ],
      new Date("2026-10-12T00:00:00Z"),
      new Date("2026-10-13T00:00:00Z"),
    );
    expect(results.map((result) => result.tutor.slug)).toEqual(["z", "a"]);
    expect(
      matchAvailableTutors(
        [tutor("empty")],
        "math",
        "college_support",
        { timezone: "UTC", when: "any" },
        [],
        new Date("2026-10-12T00:00:00Z"),
        new Date("2026-10-13T00:00:00Z"),
      ),
    ).toEqual([]);
  });
});
