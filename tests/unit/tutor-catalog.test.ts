import { describe, expect, it } from "vitest";
import {
  learnerLevels,
  reviewStatuses,
  subjectCategories,
} from "@/lib/db/schema/app";
import { listTimeZoneOptions, timeZoneLabel } from "@/lib/time/zones";
import {
  groupSubjects,
  learnerLevelOptions,
  levelNames,
  subjectCategoryOptions,
} from "@/features/subjects/catalog";
import { subjectNameInput } from "@/features/subjects/service";
import { slugify } from "@/features/subjects/slug";
import {
  describeTutorProfileIssues,
  tutorProfileInput,
} from "@/features/tutors/input";
import {
  reviewActionsFrom,
  tutorCanEdit,
} from "@/features/tutors/review-rules";

const subjectId = "0b0e7a52-6f0e-4b63-9d43-6d1f3d2a9c11";
const valid = {
  headline: "  Synthetic algebra tutor  ",
  bio: "Fictional introduction.",
  teachingBackground: "Fictional background.",
  timezone: "Asia/Manila",
  offerings: [
    { subjectId, levels: ["high_school", "elementary"], specialty: "  " },
  ],
};

describe("tutor profile input", () => {
  it("trims text, stores levels in catalog order and drops a blank specialty", () => {
    expect(tutorProfileInput.parse(valid)).toEqual({
      headline: "Synthetic algebra tutor",
      bio: "Fictional introduction.",
      teachingBackground: "Fictional background.",
      timezone: "Asia/Manila",
      offerings: [
        { subjectId, levels: ["elementary", "high_school"], specialty: null },
      ],
    });
  });

  it.each([
    { reviewStatus: "approved" },
    { userId: "someone-else" },
    { id: subjectId },
    { headline: " " },
    { headline: "x".repeat(101) },
    { bio: "x".repeat(1501) },
    { teachingBackground: "" },
    { timezone: "+08:00" },
    { timezone: "Mars/Olympus" },
    { offerings: [] },
    { offerings: [{ subjectId: "math", levels: ["elementary"] }] },
    { offerings: [{ subjectId, levels: [] }] },
    { offerings: [{ subjectId, levels: ["graduate"] }] },
    { offerings: [{ subjectId, levels: ["elementary", "elementary"] }] },
    { offerings: [{ subjectId, levels: ["elementary"], tutorId: subjectId }] },
    {
      offerings: [
        { subjectId, levels: ["elementary"] },
        { subjectId, levels: ["high_school"] },
      ],
    },
  ])("rejects %j", (patch) => {
    expect(tutorProfileInput.safeParse({ ...valid, ...patch }).success).toBe(
      false,
    );
  });

  it("explains invalid fields as instructions without echoing the input", () => {
    const result = tutorProfileInput.safeParse({
      ...valid,
      headline: "",
      timezone: "PRIVATE_VALUE",
      offerings: [],
    });
    const described = describeTutorProfileIssues(result.error!);
    expect(Object.keys(described.fields).sort()).toEqual([
      "headline",
      "offerings",
      "timezone",
    ]);
    expect(JSON.stringify(described)).not.toContain("PRIVATE_VALUE");
    const forged = tutorProfileInput.safeParse({ ...valid, role: "admin" });
    expect(describeTutorProfileIssues(forged.error!).fields).toEqual({});
  });
});

describe("review rules", () => {
  it("allows exactly the documented transitions from each status", () => {
    expect(
      Object.fromEntries(
        reviewStatuses.map((status) => [status, reviewActionsFrom(status)]),
      ),
    ).toEqual({
      pending: ["approve", "reject"],
      approved: ["suspend"],
      rejected: ["reopen"],
      suspended: ["reinstate"],
    });
  });

  it("locks a tutor's own edits only while suspended", () => {
    expect(reviewStatuses.filter(tutorCanEdit)).toEqual([
      "pending",
      "approved",
      "rejected",
    ]);
  });
});

describe("subject catalog helpers", () => {
  it("labels every stored category and level, so none can drift", () => {
    expect(subjectCategoryOptions.map(([value]) => value)).toEqual([
      ...subjectCategories,
    ]);
    expect(learnerLevelOptions.map(([value]) => value)).toEqual([
      ...learnerLevels,
    ]);
    expect(levelNames(["college_support", "elementary"])).toEqual([
      "Elementary",
      "College Support",
    ]);
  });

  it("groups subjects under category labels and drops empty categories", () => {
    const subject = (name: string, category: "academic_core" | "specialized") =>
      ({ id: name, name, category, isActive: true }) as const;
    expect(
      groupSubjects([
        subject("Science", "academic_core"),
        subject("Math", "academic_core"),
      ]).map((group) => [group.label, group.subjects.map((s) => s.name)]),
    ).toEqual([["Academic core", ["Math", "Science"]]]);
  });

  it("builds stable slugs and validates subject names", () => {
    expect(slugify("  Organic Chemistry II ")).toBe("organic-chemistry-ii");
    expect(slugify("Français & Español")).toBe("francais-espanol");
    expect(slugify("日本語")).toBe("");
    expect(subjectNameInput.parse({ name: "  Statistics  " }).name).toBe(
      "Statistics",
    );
    for (const name of ["", "A", "-Physics", "<script>", "x".repeat(61)])
      expect(subjectNameInput.safeParse({ name }).success).toBe(false);
    expect(
      subjectNameInput.safeParse({ name: "Law", category: "academic_core" })
        .success,
    ).toBe(false);
  });
});

describe("time zone labels", () => {
  it("names a zone by city and its offset on the given date", () => {
    expect(timeZoneLabel("Asia/Manila", new Date("2026-10-11T00:00:00Z"))).toBe(
      "Manila (GMT+8)",
    );
    // Daylight saving ends in Los Angeles on 2026-11-01.
    expect(
      timeZoneLabel("America/Los_Angeles", new Date("2026-10-31T12:00:00Z")),
    ).toBe("Los Angeles (GMT-7)");
    expect(
      timeZoneLabel("America/Los_Angeles", new Date("2026-11-02T12:00:00Z")),
    ).toBe("Los Angeles (GMT-8)");
    expect(
      timeZoneLabel("Asia/Kolkata", new Date("2026-10-11T00:00:00Z")),
    ).toBe("Kolkata (GMT+5:30)");
  });

  it("lists zones west to east with identifiers kept out of the labels", () => {
    const options = listTimeZoneOptions(new Date("2026-10-11T00:00:00Z"));
    const index = (value: string) =>
      options.findIndex((option) => option.value === value);
    expect(index("UTC")).toBeGreaterThan(-1);
    expect(index("America/Los_Angeles")).toBeLessThan(index("UTC"));
    expect(index("UTC")).toBeLessThan(index("Asia/Manila"));
    expect(options.some((option) => /[_/]/.test(option.label))).toBe(false);
    expect(new Set(options.map((option) => option.value)).size).toBe(
      options.length,
    );
  });
});
